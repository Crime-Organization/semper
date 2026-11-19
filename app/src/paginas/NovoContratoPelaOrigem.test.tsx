// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O contrato nascido no cartão de uma demanda (?demanda=) ou de um processo (?processo=), #376: herda os clientes da origem (e o
// responsável, se for advogado), nasce ligado a ela e volta ao cartão de onde a pessoa partiu. A ligação que falha depois de gravar
// avisa: o contrato fica, uma vez só, e a tela vai ao cartão dele.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Demanda, type Processo, type TarefaLigada } from '../dados';
import { OBJETOS_AINDA_VIRAM_DEMANDAS, TAREFA_DA_DEMANDA_EM_CONTRATO } from '../regras/nascerLigado';
import { avisar, feito } from '../ui/avisos';
import NovoContrato from './NovoContrato';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn(), avisar: vi.fn() }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({
    perfil: { id: 'u-bruno' }, ehAdmin: true, escritorio: { modulos: { processos: true, contratos: true } },
    equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true, funcao: 'estagiario' }, { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true, funcao: 'advogado' }]
  })
}));

const JOSE = { id: 'p1', codigo: 'P1', nome: 'JOSÉ DA SILVA TESTE' };
const demanda = (extra: Partial<Demanda> = {}) => ({
  id: 'd1', codigo: 'D1', titulo: 'Notificar o devedor', clientes: [JOSE], responsavel_id: 'u-ana', contrato_id: null, ...extra
}) as unknown as Demanda;
const processo = {
  id: 'pr1', codigo: 'PR1', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Cobrança do aluguel', cliente_nome: 'JOSÉ DA SILVA TESTE',
  clientes: [JOSE], responsavel_id: 'u-bruno'
} as unknown as Processo;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(feito).mockClear();
  vi.mocked(avisar).mockClear();
  // O jsdom não rola a página (não tem scrollIntoView); o cadastro volta ao topo a cada etapa.
  Object.assign(Element.prototype, { scrollIntoView: () => undefined });
  vi.spyOn(SD, 'objetosSugeridos').mockResolvedValue([]);
  vi.spyOn(SD, 'colunasListar').mockResolvedValue([]);
  vi.spyOn(SD, 'gruposListar').mockResolvedValue([]);
});

/** Abre o cadastro pela origem e espera a primeira etapa; devolve a gravação do contrato novo e o roteador. */
async function abrirPela(origem: string) {
  const criar = vi.spyOn(SD, 'contratoCriar').mockResolvedValue({ id: 'k-novo', codigo: 'AT01-0001-2026' });
  const roteador = createMemoryRouter([
    { path: '/contratos/novo/', element: <NovoContrato /> }, { path: '/contratos/', element: <p>Cartão do contrato novo</p> },
    { path: '/demandas/', element: <p>Cartão da demanda</p> }, { path: '/processos/judicial/', element: <p>Cartão do processo</p> }
  ], { initialEntries: ['/contratos/novo/?' + origem] });
  render(<RouterProvider router={roteador} />);
  await screen.findByRole('heading', { name: /Cliente/, level: 2 });
  return { criar, roteador };
}
/** Preenche o objeto e a categoria (o que a origem não traz) e salva, passando pelas etapas. */
async function preencherESalvar() {
  await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await userEvent.type(await screen.findByRole('combobox', { name: 'Objeto 1' }), 'Notificação extrajudicial');
  await userEvent.click(screen.getByText('Pró-labore', { exact: true }));
  while (!screen.queryByRole('button', { name: 'Salvar contrato' })) await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar contrato' }));
}

describe('Contrato nascido no cartão de uma demanda (#376)', () => {
  it('dada uma demanda sem contrato, quando o contrato é criado por ela, então nasce com os clientes e o responsável advogado dela, a demanda fica ligada a ele e volta ao cartão da demanda', async () => {
    // Dado
    vi.spyOn(SD, 'demandaObter').mockResolvedValue(demanda());
    vi.spyOn(SD, 'tarefasDaDemanda').mockResolvedValue([]);
    const ligar = vi.spyOn(SD, 'demandaAtualizar').mockResolvedValue({ id: 'd1', codigo: 'D1' });
    const { criar, roteador } = await abrirPela('demanda=d1');
    // Então: a origem aparece e o responsável já vem escolhido
    expect(screen.getByText(/Este contrato nasce da demanda/)).toHaveTextContent('Este contrato nasce da demanda D1 (Notificar o devedor), que fica ligada a ele.');
    expect(screen.getByLabelText(/Advogado responsável/)).toHaveValue('u-ana');
    // Então: e que, ao assinar, os objetos ainda viram demandas além desta
    expect(screen.getByText(OBJETOS_AINDA_VIRAM_DEMANDAS)).toBeInTheDocument();
    // Quando
    await preencherESalvar();
    // Então
    await screen.findByText('Cartão da demanda');
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ clientes: ['p1'], responsavel_id: 'u-ana', objetos: ['Notificação extrajudicial'] }));
    expect(ligar).toHaveBeenCalledWith('d1', { contrato_id: 'k-novo' });
    expect(roteador.state.location.search).toBe('?id=d1');
    expect(avisar).not.toHaveBeenCalled();
  });

  it('dada uma demanda que outra pessoa ligou a outro contrato com o cadastro aberto, quando o contrato é criado, então ele fica gravado uma vez, avisa que a demanda não foi ligada e abre o cartão do contrato novo (no da demanda, ele não estaria)', async () => {
    // Dado
    vi.spyOn(SD, 'demandaObter').mockResolvedValueOnce(demanda()).mockResolvedValue(demanda({ contrato_id: 'k-outro' }));
    const ligar = vi.spyOn(SD, 'demandaAtualizar').mockResolvedValue({ id: 'd1', codigo: 'D1' });
    const { criar } = await abrirPela('demanda=d1');
    // Quando
    await preencherESalvar();
    // Então
    await screen.findByText('Cartão do contrato novo');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(ligar).not.toHaveBeenCalled();
    expect(feito).toHaveBeenCalledWith('Contrato AT01-0001-2026 cadastrado.', 'cadastro do contrato', expect.any(Function));
    expect(avisar).toHaveBeenCalledWith('Não foi possível ligar a demanda D1 ao contrato novo: Esta demanda já está ligada a outro contrato.', 'erro');
  });
});

describe('Contrato nascido no cartão de uma demanda cuja tarefa já é de um contrato (#376)', () => {
  it('dada uma demanda sem contrato com uma tarefa já num contrato, quando o contrato é criado por ela, então avisa antes, não liga a demanda e abre o cartão do contrato novo', async () => {
    // Dado
    vi.spyOn(SD, 'demandaObter').mockResolvedValue(demanda());
    vi.spyOn(SD, 'tarefasDaDemanda').mockResolvedValue([{ id: 't1', contrato_id: 'k-outro' } as unknown as TarefaLigada]);
    const ligar = vi.spyOn(SD, 'demandaAtualizar').mockResolvedValue({ id: 'd1', codigo: 'D1' });
    const { criar, roteador } = await abrirPela('demanda=d1');
    // Então
    expect(await screen.findByText(TAREFA_DA_DEMANDA_EM_CONTRATO)).toBeInTheDocument();
    // Quando
    await preencherESalvar();
    // Então
    await screen.findByText('Cartão do contrato novo');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(ligar).not.toHaveBeenCalled();
    expect(roteador.state.location.search).toBe('?id=k-novo');
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe('Contrato nascido no cartão de um processo arquivado (#376)', () => {
  it('dado um processo arquivado, quando o cadastro abre por ele, então avisa que ele não vale e não traz os clientes nem o responsável dele', async () => {
    // Dado
    vi.spyOn(SD, 'processoObter').mockResolvedValue({ ...processo, responsavel_id: 'u-ana', arquivado_em: '2026-11-01T10:00:00Z' } as Processo);
    // Quando
    await abrirPela('processo=pr1');
    // Então
    expect(screen.getByText(/O processo/)).toHaveTextContent('O processo PR1 (Cobrança do aluguel) está arquivado: o contrato novo não leva nada dele nem fica ligado a ele.');
    expect(screen.queryByText(/Este contrato nasce do processo/)).not.toBeInTheDocument();
    expect(screen.queryByText('JOSÉ DA SILVA TESTE')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Advogado responsável/)).toHaveValue('');
  });
});

describe('Contrato nascido no cartão de um processo (#376)', () => {
  it('dado um processo, quando o contrato é criado por ele, então o campo de processos aparece com ele já escolhido, o contrato fica ligado a ele e volta ao cartão do processo', async () => {
    // Dado
    vi.spyOn(SD, 'processoObter').mockResolvedValue(processo);
    const ligar = vi.spyOn(SD, 'contratoProcessoLigar').mockResolvedValue(true);
    const { criar, roteador } = await abrirPela('processo=pr1');
    // Então: quem é responsável pelo processo não é advogado, e o responsável fica por escolher
    expect(screen.getByLabelText(/Advogado responsável/)).toHaveValue('');
    // Quando
    await userEvent.selectOptions(screen.getByLabelText(/Advogado responsável/), 'Ana Teste Lima');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // Então
    expect(await screen.findByRole('group', { name: 'Processos do contrato' })).toHaveTextContent('Cobrança do aluguel');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    await preencherESalvar();
    // Então
    await screen.findByText('Cartão do processo');
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ clientes: ['p1'], responsavel_id: 'u-ana' }));
    expect(ligar).toHaveBeenCalledWith('k-novo', 'pr1');
    expect(roteador.state.location.search).toBe('?id=pr1');
  });

  it('dado um processo, quando a ligação falha depois de gravar, então o contrato fica, avisa qual ligação faltou e abre o cartão dele (no do processo, ele não estaria)', async () => {
    // Dado
    vi.spyOn(SD, 'processoObter').mockResolvedValue(processo);
    vi.spyOn(SD, 'contratoProcessoLigar').mockRejectedValue(new Error('Você não está neste processo.'));
    const { criar } = await abrirPela('processo=pr1');
    await userEvent.selectOptions(screen.getByLabelText(/Advogado responsável/), 'Ana Teste Lima');
    // Quando
    await preencherESalvar();
    // Então
    await screen.findByText('Cartão do contrato novo');
    expect(criar).toHaveBeenCalledTimes(1);
    expect(avisar).toHaveBeenCalledWith('Não foi possível ligar o processo PR1 ao contrato novo: Você não está neste processo. Ligue pelo cartão.', 'erro');
  });
});
