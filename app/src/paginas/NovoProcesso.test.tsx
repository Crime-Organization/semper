// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui o processo é aberto também como quem não é.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Contrato, type Processo, type Tarefa, type TipoProcesso } from '../dados';
import { avisar } from '../ui/avisos';
import { Janelas } from '../ui/janela';
import { lojaDePapeisEscritos } from '../ui/papeisEscritos';
import NovoProcesso from './NovoProcesso';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), avisar: vi.fn(), feito: vi.fn() }));

const sessao = vi.hoisted(() => ({ ehAdmin: false }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: sessao.ehAdmin, equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }] })
}));

const processo = (tipo: TipoProcesso, numero: string) => ({
  id: 'p1', codigo: 'ABCD1234', tipo, numero, titulo: null, responsavel_id: 'u-bruno', colaboradores: [], cliente_nome: 'JOSÉ', orgao: null, sistema: null, polo: null, area: 'Marítimo', meio: null,
  natureza: null, gratuidade: null, comarca: null, vara: null, classe: null, assunto: null, juiz: null, distribuicao: null, valor_causa: null, instancia: null, segredo: false, advogado_contrario: null,
  observacoes: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: 'u-bruno', criado_em: '2026-11-01T12:00:00Z', atualizado_por: null, atualizado_em: '2026-11-01T12:00:00Z',
  clientes: [{ id: 'c1', codigo: 'C1', nome: 'JOSÉ', tipo: 'pf', arquivado_em: null }]
}) as unknown as Processo;

/** Abre o processo para editar: todas as etapas na tela. */
async function abrir(tipo: TipoProcesso, numero: string, extra: Partial<Processo> = {}) {
  vi.spyOn(SD, 'processoObter').mockResolvedValue({ ...processo(tipo, numero), ...extra });
  // O lápis pergunta antes de sair com algo mudado (#395): precisa do roteador com dados, como o do app.
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <NovoProcesso edicao={{ id: 'p1', aoTerminar: () => undefined }} /> }])} />);
  await screen.findByLabelText(/Número do processo/);
}
const ACRESCENTAR = { name: 'Acrescentar opção' };

describe('Formulário de processo', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    vi.spyOn(SD, 'processoOpcoes').mockResolvedValue([{ id: 'o1', campo: 'sistema', valor: 'Tucujuris' }]);
    vi.spyOn(SD, 'processoSugestoes').mockResolvedValue({ orgaos: [], comarcas: [], varas: [] });
  });

  it('quando quem abre não é administrador, então escolhe nas listas, inclusive as opções do escritório, mas não acrescenta opção', async () => {
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024');
    // Então
    expect(screen.queryAllByRole('button', ACRESCENTAR)).toHaveLength(0);
    expect(await screen.findByRole('option', { name: 'Tucujuris' })).toBeTruthy();
  });

  it('quando quem abre é administrador, então cada lista do processo judicial pode ganhar opção', async () => {
    // Dado
    sessao.ehAdmin = true;
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024');
    // Então
    expect(screen.getAllByRole('button', ACRESCENTAR)).toHaveLength(3);
  });

  it('quando é administrativo, então não aparecem os campos do judicial', async () => {
    // Dado
    sessao.ehAdmin = true;
    // Quando
    await abrir('administrativo', 'INPI 1');
    // Então
    expect(screen.getAllByRole('button', ACRESCENTAR)).toHaveLength(2);
    expect(screen.queryByLabelText('Comarca')).toBeNull();
    expect(screen.queryByLabelText('Natureza processual')).toBeNull();
    expect(screen.queryByText('Formato do número')).toBeNull();
  });

  it('quando o processo salvo tem um número fora do padrão, então ele vem marcado como antigo, para poder salvar', async () => {
    // Quando
    await abrir('judicial', '1234/98');
    // Então
    expect((screen.getByRole('checkbox', { name: /número antigo/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('quando o valor salvo saiu da lista, então ele continua aparecendo como escolhido', async () => {
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024');
    // Então
    expect((screen.getByLabelText('Área do direito') as HTMLSelectElement).value).toBe('Marítimo');
  });

  it('dado um processo antigo sem papel do cliente, quando a pessoa tenta salvar, então não salva e a tela diz que o papel é obrigatório (#426)', async () => {
    // Dado
    const gravar = vi.spyOn(SD, 'processoAtualizar').mockResolvedValue({ id: 'p1', codigo: 'ABCD1234' });
    gravar.mockClear();
    Object.assign(Element.prototype, { scrollIntoView: () => undefined });
    await abrir('judicial', '0001234-97.2026.8.13.0024', { papeis_clientes: {} });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    // Então
    expect(await screen.findByText(/O papel do cliente é obrigatório/)).toBeInTheDocument();
    expect(screen.getByLabelText('Papel do cliente')).toHaveAttribute('aria-invalid', 'true');
    // O leitor de tela diz por que o papel está inválido, e não só que está.
    expect(screen.getByLabelText('Papel do cliente')).toHaveAccessibleDescription(/O papel do cliente é obrigatório/);
    expect(gravar).not.toHaveBeenCalled();
  });

  it('dado um processo com o papel do cliente, quando abre para editar, então o papel aparece ao lado do cliente, na lista das pessoas com papel', async () => {
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024', { papeis_clientes: { c1: 'reu' } });
    // Então
    const papel = screen.getByLabelText('Papel do cliente') as HTMLSelectElement;
    expect(papel.value).toBe('reu');
    expect([...papel.options].map(o => o.text)).toContain('Apenado');
    // O Outro papel fecha a lista fixa; por último, a opção de escrever um papel (#443).
    expect([...papel.options].at(-2)?.text).toBe('Outro papel');
    expect([...papel.options].at(-1)?.text).toBe('+ Escrever outro papel…');
    expect(screen.queryByLabelText('Polo do cliente')).toBeNull();
  });

  it.each(['SEEU', 'Seeu'])('dado um escritório que gravou "%s" antes de ela ser pronta, quando o administrador abre um processo com esse sistema, então o nome aparece uma vez e não há "Retirar da lista" (#288)', async valor => {
    // Dado
    sessao.ehAdmin = true;
    vi.spyOn(SD, 'processoOpcoes').mockResolvedValue([{ id: 'o2', campo: 'sistema', valor }]);
    // Quando
    await abrir('judicial', '0001234-97.2026.8.13.0024', { sistema: valor });
    // Então
    expect((screen.getByLabelText('Sistema de tramitação') as HTMLSelectElement).value).toBe(valor);
    expect(screen.getAllByRole('option', { name: /^seeu$/i })).toHaveLength(1);
    expect(screen.queryAllByRole('button', { name: 'Retirar da lista' })).toHaveLength(0);
  });
});

describe('Processo que nasce do "+ Novo processo" de um contrato ou de uma tarefa (#376)', () => {
  const CLIENTE = { id: 'c1', codigo: 'C1', nome: 'JOSÉ', tipo: 'pf', arquivado_em: null };
  const NUMERO = '0001234-97.2026.8.13.0024';
  /** O cadastro do processo, para conferir o que foi gravado. */
  const criarProcesso = vi.fn<typeof SD.processoCriar>();
  /** O lugar para onde a tela foi depois de salvar. */
  function Destino() {
    const { pathname, search } = useLocation();
    return <p>Foi para {pathname + search}</p>;
  }
  beforeEach(() => {
    sessao.ehAdmin = false;
    // O jsdom não rola a página (não tem scrollIntoView); o cadastro volta ao topo a cada etapa.
    Object.assign(Element.prototype, { scrollIntoView: () => undefined });
    vi.mocked(avisar).mockClear();
    vi.spyOn(SD, 'processoOpcoes').mockResolvedValue([]);
    vi.spyOn(SD, 'processoSugestoes').mockResolvedValue({ orgaos: [], comarcas: [], varas: [] });
    vi.spyOn(SD, 'processoCampos').mockResolvedValue([]);
    vi.spyOn(SD, 'colunasListar').mockResolvedValue([]);
    vi.spyOn(SD, 'gruposListar').mockResolvedValue([]);
    criarProcesso.mockReset().mockResolvedValue({ id: 'p9', codigo: 'P9' });
    vi.spyOn(SD, 'processoCriar').mockImplementation(criarProcesso);
  });
  /** Abre o cadastro pelo endereço, espera o aviso da origem, passa pelas etapas e salva. */
  async function criar(endereco: string, aviso: RegExp) {
    const roteador = createMemoryRouter([{ path: '/processos/novo/', element: <NovoProcesso /> }, { path: '*', element: <Destino /> }], { initialEntries: [endereco] });
    render(<RouterProvider router={roteador} />);
    expect(await screen.findByText(aviso)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Número do processo/), NUMERO);
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('JOSÉ')).toBeInTheDocument();
    // O papel do cliente é obrigatório (#426).
    await userEvent.selectOptions(screen.getByLabelText('Papel do cliente'), 'autor');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar processo' }));
  }

  it('dado um contrato com cliente, quando o processo é criado por ele, então nasce com o cliente e o responsável, fica ligado e a tela volta ao contrato', async () => {
    // Dado
    vi.spyOn(SD, 'contratoVer').mockResolvedValue({ id: 'k1', codigo: 'K1', responsavel_id: 'u-bruno', clientes: [CLIENTE] } as unknown as Contrato);
    vi.spyOn(SD, 'contratosDoProcesso').mockResolvedValue({ visiveis: [], ocultos: 0 });
    const ligar = vi.spyOn(SD, 'contratoProcessoLigar').mockResolvedValue(true);
    // Quando
    await criar('/processos/novo/?contrato=k1', /nasce do contrato/);
    // Então
    expect(await screen.findByText('Foi para /contratos/?id=k1')).toBeInTheDocument();
    expect(criarProcesso).toHaveBeenCalledWith(expect.objectContaining({ clientes: ['c1'], papeis_clientes: { c1: 'autor' }, responsavel_id: 'u-bruno' }));
    expect(ligar).toHaveBeenCalledWith('k1', 'p9');
  });

  it('dada uma tarefa sem processo, quando o processo é criado por ela, então as pessoas dela são os clientes, o processo fica gravado nela e a tela volta à tarefa', async () => {
    // Dado
    const t = { id: 't1', codigo: 'T1', titulo: 'Emitir a GRU', processo_id: null, pessoas: [CLIENTE] } as unknown as Tarefa;
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(t);
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    // Quando
    await criar('/processos/novo/?tarefa=t1', /nasce da tarefa/);
    // Então
    expect(await screen.findByText('Foi para /tarefas/?id=t1')).toBeInTheDocument();
    expect(criarProcesso).toHaveBeenCalledWith(expect.objectContaining({ clientes: ['c1'] }));
    expect(gravar).toHaveBeenCalledWith('t1', { processo_id: 'p9' });
  });

  it('dada uma tarefa que ganhou outro processo com o cadastro aberto, quando o processo é criado, então ele fica, o aviso diz por que não ligou e a tela vai ao processo novo', async () => {
    // Dado: ao abrir, a tarefa não tinha processo; ao ligar, já tem outro
    const t = { id: 't1', codigo: 'T1', titulo: 'Emitir a GRU', processo_id: null, pessoas: [CLIENTE] } as unknown as Tarefa;
    vi.spyOn(SD, 'tarefaObter').mockResolvedValueOnce(t).mockResolvedValue({ ...t, processo_id: 'outro' });
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    gravar.mockClear();
    // Quando
    await criar('/processos/novo/?tarefa=t1', /nasce da tarefa/);
    // Então
    expect(await screen.findByText('Foi para /processos/judicial/?id=p9')).toBeInTheDocument();
    expect(avisar).toHaveBeenCalledWith('Não foi possível ligar o processo à tarefa T1. Esta tarefa já está ligada a outro processo.', 'erro');
    expect(gravar).not.toHaveBeenCalled();
  });

  /** Abre o cadastro por um endereço velho, espera o aviso de erro, passa pelas etapas e salva. */
  async function criarComRecusa(endereco: string, aviso: string) {
    const roteador = createMemoryRouter([{ path: '/processos/novo/', element: <NovoProcesso /> }, { path: '*', element: <Destino /> }], { initialEntries: [endereco] });
    render(<RouterProvider router={roteador} />);
    expect(await screen.findByText(/não fica ligado/)).toHaveTextContent(aviso);
    expect(screen.queryByText(/nasce d[ao]/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Número do processo/), NUMERO);
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // A origem que recusa ainda traz o que tem (os clientes): só a ligação fica de fora.
    expect(await screen.findByText('JOSÉ')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Papel do cliente'), 'autor');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar processo' }));
  }

  it('dada uma tarefa que já tem processo (a pessoa voltou pelo navegador depois de criar), quando o cadastro abre pelo endereço dela, então o aviso diz que o processo não fica ligado e nada é gravado na tarefa', async () => {
    // Dado
    const t = { id: 't1', codigo: 'T1', titulo: 'Emitir a GRU', processo_id: 'p9', arquivado_em: null, pessoas: [CLIENTE] } as unknown as Tarefa;
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(t);
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: 't1', codigo: 'T1' });
    gravar.mockClear();
    // Quando
    await criarComRecusa('/processos/novo/?tarefa=t1', 'A tarefa T1 já tem um processo: este processo novo não fica ligado a ela.');
    // Então
    expect(await screen.findByText('Foi para /processos/judicial/?id=p9')).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
    expect(avisar).not.toHaveBeenCalled();
  });

  it('dado um contrato arquivado depois que o cartão abriu, quando o cadastro abre pelo endereço dele, então o aviso diz que o processo não fica ligado e a ligação não é tentada', async () => {
    // Dado
    vi.spyOn(SD, 'contratoVer').mockResolvedValue({ id: 'k1', codigo: 'K1', responsavel_id: 'u-bruno', clientes: [CLIENTE], arquivado_em: '2026-11-18T10:00:00Z' } as unknown as Contrato);
    const ligar = vi.spyOn(SD, 'contratoProcessoLigar').mockResolvedValue(true);
    ligar.mockClear();
    // Quando
    await criarComRecusa('/processos/novo/?contrato=k1', 'O contrato K1 está arquivado: este processo não fica ligado a ele.');
    // Então
    expect(await screen.findByText('Foi para /processos/judicial/?id=p9')).toBeInTheDocument();
    expect(ligar).not.toHaveBeenCalled();
    expect(criarProcesso).toHaveBeenCalledWith(expect.objectContaining({ clientes: ['c1'] }));
  });
});

describe('O papel do cliente escrito pela equipe (#443)', () => {
  const gravar = vi.fn<typeof SD.processoAtualizar>();
  beforeEach(() => {
    sessao.ehAdmin = false;
    Object.assign(Element.prototype, { scrollIntoView: () => undefined });
    vi.spyOn(SD, 'processoOpcoes').mockResolvedValue([]);
    vi.spyOn(SD, 'processoSugestoes').mockResolvedValue({ orgaos: [], comarcas: [], varas: [] });
    vi.spyOn(SD, 'processoPapeisEscritos').mockResolvedValue([]);
    gravar.mockReset().mockResolvedValue({ id: 'p1', codigo: 'ABCD1234' });
    vi.spyOn(SD, 'processoAtualizar').mockImplementation(gravar);
    lojaDePapeisEscritos.reiniciar();
  });
  /** Abre o processo para editar, com as janelas (a de escrever o papel) na tela. */
  async function abrirComJanelas(extra: Partial<Processo> = {}) {
    vi.spyOn(SD, 'processoObter').mockResolvedValue({ ...processo('judicial', '0001234-97.2026.8.13.0024'), papeis_clientes: { c1: 'reu' }, ...extra });
    render(<><RouterProvider router={createMemoryRouter([{ path: '/', element: <NovoProcesso edicao={{ id: 'p1', aoTerminar: () => undefined }} /> }])} /><Janelas /></>);
    await screen.findByLabelText(/Número do processo/);
    return screen.getByLabelText('Papel do cliente') as HTMLSelectElement;
  }
  const escolhido = (select: HTMLSelectElement) => select.selectedOptions[0]?.text;

  it('dado um cliente escolhido, quando escolhe "+ Escrever outro papel…" e escreve Inventariante com Enter, então o papel fica Inventariante e o processo o grava', async () => {
    // Dado
    const papel = await abrirComJanelas();
    // Quando
    await userEvent.selectOptions(papel, '+ Escrever outro papel…');
    const janela = await screen.findByRole('dialog', { name: 'Escrever outro papel' });
    await userEvent.type(within(janela).getByRole('textbox', { name: 'Escrever outro papel' }), '  Inventariante {Enter}');
    // Então
    expect(await screen.findByRole('option', { name: 'Inventariante', selected: true })).toBeInTheDocument();
    expect(escolhido(papel)).toBe('Inventariante');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    // Então
    expect(gravar).toHaveBeenCalledWith('p1', expect.objectContaining({ papeis_clientes: { c1: 'outro' }, papeis_escritos: { c1: 'Inventariante' } }));
  });

  it('dada a janela de escrever aberta, quando a pessoa desiste com Esc, então o papel de antes continua', async () => {
    // Dado
    const papel = await abrirComJanelas();
    await userEvent.selectOptions(papel, '+ Escrever outro papel…');
    await screen.findByRole('dialog', { name: 'Escrever outro papel' });
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog', { name: 'Escrever outro papel' })).toBeNull();
    expect(escolhido(papel)).toBe('Réu');
  });

  it('dado Inventariante na lista do escritório, quando escreve inventariante, então escolhe o que já existe, sem criar outro', async () => {
    // Dado
    vi.spyOn(SD, 'processoPapeisEscritos').mockResolvedValue([{ id: 'x1', nome: 'Inventariante' }]);
    const papel = await abrirComJanelas();
    const grupo = await screen.findByRole('group', { name: 'Do escritório' });
    expect(within(grupo).getByRole('option', { name: 'Inventariante' })).toBeInTheDocument();
    // Quando
    await userEvent.selectOptions(papel, '+ Escrever outro papel…');
    const janela = await screen.findByRole('dialog', { name: 'Escrever outro papel' });
    await userEvent.type(within(janela).getByRole('textbox', { name: 'Escrever outro papel' }), 'inventariante{Enter}');
    // Então
    expect(await screen.findByRole('option', { name: 'Inventariante', selected: true })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Inventariante' })).toHaveLength(1);
  });

  it('dado um processo com papel escrito que saiu da lista, quando abre para editar, então o nome continua escolhido', async () => {
    // Quando
    const papel = await abrirComJanelas({ papeis_clientes: { c1: 'outro' }, papeis_escritos: { c1: 'Curador' } });
    // Então
    expect(escolhido(papel)).toBe('Curador');
  });
});
