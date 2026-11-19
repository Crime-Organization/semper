// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A demanda nascida no cartão de uma tarefa (?tarefa=) ou de um processo (?processo=), #376: herda o que a origem tem, nasce ligada a
// ela e volta ao cartão de onde a pessoa partiu. A ligação que falha depois de gravar só avisa: a demanda fica, uma vez só.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type ContratoLista, type Demanda, type Processo, type Tarefa } from '../dados';
import { CONTRATO_FORA_DA_TAREFA } from '../regras/nascerLigado';
import { avisar, feito } from '../ui/avisos';
import NovaDemanda from './NovaDemanda';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn(), avisar: vi.fn() }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({
    perfil: { id: 'u-bruno' }, ehAdmin: true, escritorio: { modulos: { processos: true } },
    equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }]
  })
}));

const JOSE = { id: 'p1', codigo: 'P1', nome: 'JOSÉ DA SILVA TESTE' };
const tarefa = (extra: Partial<Tarefa> = {}) => ({
  id: 't1', codigo: 'T1', titulo: 'Renovar a procuração', pessoas: [JOSE], demanda_id: null, demanda: null, demanda_codigo: null,
  contrato_id: 'k1', contrato_codigo: 'MA96-0001-2026', contrato: { id: 'k1', codigo: 'MA96-0001-2026', servico: 'Registro de marca' }, ...extra
}) as unknown as Tarefa;
const demandaNova = { id: 'd-nova', codigo: 'DNOVA', clientes: [JOSE], contrato_id: 'k1' } as unknown as Demanda;
const processo = {
  id: 'pr1', codigo: 'PR1', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Cobrança do aluguel', cliente_nome: 'JOSÉ DA SILVA TESTE', clientes: [JOSE]
} as unknown as Processo;

beforeEach(() => {
  vi.restoreAllMocks();
  // O jsdom não rola a página (não tem scrollIntoView); o cadastro volta ao topo a cada etapa.
  Object.assign(Element.prototype, { scrollIntoView: () => undefined });
  vi.mocked(feito).mockClear();
  vi.mocked(avisar).mockClear();
  vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
  vi.spyOn(SD, 'colunasListar').mockResolvedValue([]);
  vi.spyOn(SD, 'gruposListar').mockResolvedValue([]);
});

/** Abre o cadastro pela origem, dá o título e passa até a última etapa; devolve a gravação da demanda nova e o roteador. */
async function abrirPela(origem: string) {
  const criar = vi.spyOn(SD, 'demandaCriar').mockResolvedValue({ id: 'd-nova', codigo: 'DNOVA' });
  const roteador = createMemoryRouter([
    { path: '/demandas/nova/', element: <NovaDemanda /> }, { path: '/demandas/', element: <p>Cartão da demanda nova</p> },
    { path: '/tarefas/', element: <p>Cartão da tarefa</p> }, { path: '/processos/judicial/', element: <p>Cartão do processo</p> }
  ], { initialEntries: ['/demandas/nova/?' + origem] });
  render(<RouterProvider router={roteador} />);
  await userEvent.type(await screen.findByLabelText(/Título/), 'Renovar o mandato');
  await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Próxima' }));
  await screen.findByRole('button', { name: 'Salvar demanda' });
  return { criar, roteador };
}
const salvar = () => userEvent.click(screen.getByRole('button', { name: 'Salvar demanda' }));

describe('Demanda nascida no cartão de uma tarefa (#376)', () => {
  it('dada uma tarefa com pessoas e contrato, quando a demanda é criada por ela, então nasce com essas pessoas e esse contrato, a tarefa fica nela e volta ao cartão da tarefa', async () => {
    // Dado
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(tarefa());
    vi.spyOn(SD, 'demandaObter').mockResolvedValue(demandaNova);
    const ligar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    const { criar, roteador } = await abrirPela('tarefa=t1');
    // Então: a origem aparece, e o contrato da tarefa já vem escolhido, sem aviso de contrato diferente
    expect(screen.getByText(/Esta demanda nasce da tarefa/)).toHaveTextContent('Esta demanda nasce da tarefa T1 (Renovar a procuração), que fica ligada a ela.');
    expect(screen.getByText('MA96-0001-2026 · Registro de marca')).toBeInTheDocument();
    expect(screen.queryByText(CONTRATO_FORA_DA_TAREFA)).not.toBeInTheDocument();
    // Quando
    await salvar();
    // Então
    await screen.findByText('Cartão da tarefa');
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Renovar o mandato', clientes: ['p1'], contrato_id: 'k1' }));
    expect(ligar).toHaveBeenCalledWith('t1', { demanda_id: 'd-nova' });
    expect(roteador.state.location.search).toBe('?id=t1');
    expect(avisar).not.toHaveBeenCalled();
  });

  it('dada uma tarefa com contrato, quando a pessoa escolhe outro contrato para a demanda, então avisa que a tarefa não ficará nela', async () => {
    // Dado
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(tarefa());
    const outro = { id: 'k2', codigo: 'HE62-0002-2026', cliente_nome: 'MARIA APARECIDA EXEMPLO', servico: 'Ação de cobrança' } as unknown as ContratoLista;
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [outro], total: 1 });
    await abrirPela('tarefa=t1');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o contrato' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Contrato' }), 'HE62-0002-2026 · MARIA APARECIDA EXEMPLO · Ação de cobrança');
    // Então
    expect(await screen.findByText(CONTRATO_FORA_DA_TAREFA)).toBeInTheDocument();
  });

  it('dada uma tarefa com contrato e a demanda com outro, quando a demanda é criada, então a tarefa não é ligada, sem aviso de erro, e abre o cartão da demanda nova', async () => {
    // Dado
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(tarefa());
    const outro = { id: 'k2', codigo: 'HE62-0002-2026', cliente_nome: 'MARIA APARECIDA EXEMPLO', servico: 'Ação de cobrança' } as unknown as ContratoLista;
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [outro], total: 1 });
    const ligar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    const { criar, roteador } = await abrirPela('tarefa=t1');
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o contrato' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Contrato' }), 'HE62-0002-2026 · MARIA APARECIDA EXEMPLO · Ação de cobrança');
    await screen.findByText(CONTRATO_FORA_DA_TAREFA);
    // Quando
    await salvar();
    // Então
    await screen.findByText('Cartão da demanda nova');
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ contrato_id: 'k2' }));
    expect(ligar).not.toHaveBeenCalled();
    expect(roteador.state.location.search).toBe('?id=d-nova');
    expect(avisar).not.toHaveBeenCalled();
  });

  it('dada uma tarefa arquivada, quando o cadastro abre por ela e a demanda é criada, então avisa que ela não vale, não herda nada, não a liga e abre o cartão da demanda nova', async () => {
    // Dado
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(tarefa({ arquivado_em: '2026-11-01T10:00:00Z' }));
    const ligar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    const { criar, roteador } = await abrirPela('tarefa=t1');
    // Então
    expect(screen.getByText(/A tarefa/)).toHaveTextContent('A tarefa T1 (Renovar a procuração) está arquivada: a demanda nova não leva nada dela nem fica ligada a ela.');
    expect(screen.queryByText(/Esta demanda nasce da tarefa/)).not.toBeInTheDocument();
    expect(screen.queryByText('MA96-0001-2026 · Registro de marca')).not.toBeInTheDocument();
    // Quando
    await salvar();
    // Então
    await screen.findByText('Cartão da demanda nova');
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ clientes: [], contrato_id: null }));
    expect(ligar).not.toHaveBeenCalled();
    expect(roteador.state.location.search).toBe('?id=d-nova');
  });

  it('dada uma tarefa que outra pessoa pôs noutra demanda com o cadastro aberto, quando a demanda é criada, então ela fica gravada uma vez, avisa que a tarefa não foi ligada e volta ao cartão da tarefa', async () => {
    // Dado
    vi.spyOn(SD, 'tarefaObter').mockResolvedValueOnce(tarefa()).mockResolvedValue(tarefa({ demanda_id: 'd-outra' }));
    vi.spyOn(SD, 'demandaObter').mockResolvedValue(demandaNova);
    const ligar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    const { criar } = await abrirPela('tarefa=t1');
    // Quando
    await salvar();
    // Então
    await screen.findByText('Cartão da tarefa');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(ligar).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith('Não foi possível ligar a tarefa T1 à demanda nova: Esta tarefa já está em outra demanda.', 'erro');
  });
});

describe('Demanda nascida no cartão de um processo (#376)', () => {
  it('dado um processo, quando a demanda é criada por ele, então nasce com os clientes dele, fica ligada a ele e volta ao cartão do processo', async () => {
    // Dado
    vi.spyOn(SD, 'processoObter').mockResolvedValue(processo);
    const ligar = vi.spyOn(SD, 'processoDemandaLigar').mockResolvedValue(true);
    const { criar, roteador } = await abrirPela('processo=pr1');
    // Então: o processo já escolhido nos processos da demanda
    expect(screen.getByRole('group', { name: 'Processos' })).toHaveTextContent('Cobrança do aluguel');
    // Quando
    await salvar();
    // Então
    await screen.findByText('Cartão do processo');
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ clientes: ['p1'] }));
    expect(ligar).toHaveBeenCalledWith('pr1', 'd-nova', 'atua');
    expect(roteador.state.location.search).toBe('?id=pr1');
  });

  it('dado um processo, quando a ligação falha depois de gravar, então a demanda fica, avisa qual ligação faltou e volta ao cartão do processo', async () => {
    // Dado
    vi.spyOn(SD, 'processoObter').mockResolvedValue(processo);
    vi.spyOn(SD, 'processoDemandaLigar').mockRejectedValue(new Error('Você não está neste processo.'));
    const { criar } = await abrirPela('processo=pr1');
    // Quando
    await salvar();
    // Então
    await screen.findByText('Cartão do processo');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(feito).toHaveBeenCalledWith('Demanda DNOVA cadastrada.', 'cadastro da demanda', expect.any(Function));
    expect(avisar).toHaveBeenCalledWith('Não foi possível ligar o processo PR1 à demanda nova: Você não está neste processo. Ligue pelo cartão.', 'erro');
  });
});
