// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a tarefa é editada também por quem não é.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Processo, type Tarefa } from '../dados';
import { feito } from '../ui/avisos';
import NovaTarefa from './NovaTarefa';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn() }));
const sessao = vi.hoisted(() => ({ ehAdmin: false, escritorio: undefined as { modulos: Record<string, boolean> } | undefined }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({
    perfil: { id: 'u-bruno' }, ehAdmin: sessao.ehAdmin, escritorio: sessao.escritorio,
    equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }, { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }, { id: 'u-caio', nome: 'Caio Teste', ativo: true }]
  })
}));

const tarefa = (extra: Partial<Tarefa>) => ({
  id: 't1', codigo: 'T1', titulo: 'Emitir a GRU', descricao: null, prazo: null, data_inicio: '2026-11-10', responsavel_id: 'u-bruno', participantes: [], pessoas: [], demanda_id: null, demanda: null,
  demanda_codigo: null, contrato_id: null, contrato_codigo: null, contrato: null, criado_por: 'u-ana', ...extra
}) as unknown as Tarefa;
const DEMANDA_QUE_VEJO = { id: 'd1', codigo: 'D1', titulo: 'Registro de marca', etapa_id: null, criado_por: 'u-ana', responsavel_id: 'u-bruno', colaboradores: [], contrato_id: null, contrato: null };

/** Abre a tarefa para editar, passa a responsabilidade à Ana e salva. */
async function passarParaAna(t: Tarefa) {
  vi.spyOn(SD, 'tarefaObter').mockResolvedValue(t);
  const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: t.id, codigo: t.codigo });
  render(<MemoryRouter><NovaTarefa edicao={{ id: t.id, aoTerminar: () => undefined }} /></MemoryRouter>);
  await userEvent.selectOptions(await screen.findByLabelText(/Responsável/), 'Ana Teste Lima');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(gravar).toHaveBeenCalled());
  return gravar;
}

describe('Passar a tarefa a outro responsável', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    sessao.escritorio = undefined;
    vi.mocked(feito).mockClear();
    vi.spyOn(SD, 'demandasListar').mockResolvedValue({ linhas: [], total: 0 });
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
  });

  it('quando quem passa não é administrador, não criou a tarefa e não vê a demanda, então grava o resto e sai pelo caminho próprio', async () => {
    // Dado
    const sair = vi.spyOn(SD, 'cartaoSair').mockResolvedValue();
    // Quando
    const gravar = await passarParaAna(tarefa({ demanda_id: 'd1' }));
    // Então
    expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ responsavel_id: 'u-ana', participantes: ['u-bruno'] }));
    await waitFor(() => expect(sair).toHaveBeenCalledWith('tarefas', 't1'));
    expect(feito).not.toHaveBeenCalled();
  });

  it.each([
    ['é administrador', true, tarefa({})],
    ['criou a tarefa', false, tarefa({ criado_por: 'u-bruno' })],
    ['vê a demanda ligada', false, tarefa({ demanda_id: 'd1', demanda: DEMANDA_QUE_VEJO })]
  ])('quando quem passa %s, então sai de fato, sem aviso', async (_caso, ehAdmin, t) => {
    // Dado
    sessao.ehAdmin = ehAdmin;
    // Quando
    const gravar = await passarParaAna(t);
    // Então
    expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ responsavel_id: 'u-ana', participantes: [] }));
    await waitFor(() => expect(vi.mocked(feito).mock.calls[0][0]).toBe('Tarefa atualizada.'));
  });
});

describe('Sair da tarefa', () => {
  const FASE = { modulos: { equipe_ve_tudo: true, equipe_edita_tudo: true } };
  beforeEach(() => {
    sessao.ehAdmin = false;
    sessao.escritorio = undefined;
    vi.mocked(feito).mockClear();
    vi.spyOn(SD, 'demandasListar').mockResolvedValue({ linhas: [], total: 0 });
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
  });

  async function editar(alvo: Tarefa, antesDeSalvar?: () => Promise<void>) {
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(alvo);
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: alvo.id, codigo: alvo.codigo });
    const sair = vi.spyOn(SD, 'cartaoSair').mockResolvedValue();
    sair.mockClear();
    render(<MemoryRouter><NovaTarefa edicao={{ id: alvo.id, aoTerminar: () => undefined }} /></MemoryRouter>);
    await screen.findByRole('group', { name: 'Participantes' });
    await antesDeSalvar?.();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(gravar).toHaveBeenCalled());
    return { gravar, sair };
  }

  it('dada a fase de adaptação, quando quem não está no cartão salva, então não entra nem sai dele', async () => {
    // Dado
    sessao.escritorio = FASE;
    // Quando
    const { gravar, sair } = await editar(tarefa({ responsavel_id: 'u-ana', participantes: [] }));
    // Então
    expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ participantes: [] }));
    await waitFor(() => expect(feito).toHaveBeenCalled());
    expect(sair).not.toHaveBeenCalled();
  });

  it('dada a fase de adaptação, quando quem está no cartão se tira, então sai na própria gravação e dá para desfazer', async () => {
    // Dado
    sessao.escritorio = FASE;
    // Quando
    const { gravar, sair } = await editar(tarefa({ responsavel_id: 'u-ana', participantes: ['u-bruno'] }), () => userEvent.click(screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })));
    // Então
    expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ participantes: [] }));
    await waitFor(() => expect(feito).toHaveBeenCalled());
    expect(sair).not.toHaveBeenCalled();
  });

  it('dada a fase desligada, quando quem só participa se tira, então a gravação não muda a ordem e a saída vem depois', async () => {
    // Quando
    const { gravar, sair } = await editar(tarefa({ responsavel_id: 'u-ana', participantes: ['u-bruno', 'u-caio'] }), () => userEvent.click(screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })));
    // Então
    expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ participantes: ['u-bruno', 'u-caio'] }));
    await waitFor(() => expect(sair).toHaveBeenCalledWith('tarefas', 't1'));
  });
});

describe('Hora e lembrete do prazo (#286)', () => {
  beforeEach(() => {
    sessao.ehAdmin = true;
    sessao.escritorio = undefined;
    vi.mocked(feito).mockClear();
    // O jsdom não rola a tela: o formulário rola até o erro.
    Object.assign(Element.prototype, { scrollIntoView: () => undefined });
    vi.spyOn(SD, 'demandasListar').mockResolvedValue({ linhas: [], total: 0 });
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
  });

  /**
   * Desde a #361, o lápis do cartão não tem mais o prazo, a hora e o lembrete (o cartão os muda no próprio lugar): aqui eles são
   * conferidos na página "Atualizar tarefa", que tem o cadastro inteiro, em etapas.
   */
  async function abrir(alvo: Tarefa) {
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(alvo);
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: alvo.id, codigo: alvo.codigo });
    gravar.mockClear();
    const roteador = createMemoryRouter([{ path: '/tarefas/nova/', element: <NovaTarefa /> }, { path: '/tarefas/', element: <p>Tarefas</p> }],
      { initialEntries: ['/tarefas/nova/?id=' + alvo.id] });
    render(<RouterProvider router={roteador} />);
    await screen.findByLabelText('Hora');
    return gravar;
  }
  /** Passa pela etapa das pessoas e salva: o cadastro de tarefa tem duas etapas (#299). */
  async function salvar() {
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar alterações' }));
  }
  /** O botão do lembrete, com o sino, ao lado do prazo (#299). */
  const sino = () => screen.getByRole('button', { name: /^Lembrete:/ });
  async function marcarLembrete(nome: string) {
    await userEvent.click(sino());
    await userEvent.click(screen.getByRole('menuitemradio', { name: nome }));
  }

  it('dado uma tarefa com prazo, quando marca a hora e o lembrete e salva, então os dois são gravados', async () => {
    // Dado
    const gravar = await abrir(tarefa({ prazo: '2030-11-15' }));
    // Quando
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '14:00' } });
    await marcarLembrete('1 hora antes');
    await salvar();
    // Então
    await waitFor(() => expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ prazo: '2030-11-15', prazo_hora: '14:00', lembrete: 60 })));
  });

  it('dado uma tarefa salva com hora e lembrete, quando abre para atualizar, então o prazo e a hora vêm no mesmo campo e o sino mostra o lembrete, com as opções combinadas', async () => {
    // Quando
    await abrir(tarefa({ prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 1440 }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Prazo' })).toHaveValue('15/11/2030');
    expect(screen.getByLabelText('Hora')).toHaveValue('14:00');
    expect(sino()).toHaveAccessibleName('Lembrete: 1 dia antes');
    // Quando
    await userEvent.click(sino());
    // Então
    expect(screen.getAllByRole('menuitemradio').map(o => o.textContent)).toEqual(['Na hora do prazo', '30 minutos antes', '1 hora antes', '1 dia antes', 'Sem lembrete']);
    expect(screen.getByRole('menuitemradio', { name: '1 dia antes' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Sem hora, o lembrete conta o prazo às 9h/)).toBeInTheDocument();
  });

  it('dado uma tarefa sem prazo, quando marca a hora e segue, então pede o prazo, o sino fica desligado e não grava', async () => {
    // Dado
    const gravar = await abrir(tarefa({ prazo: null }));
    // Quando
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '14:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // Então
    expect(await screen.findByText('Informe o prazo para pôr a hora')).toBeInTheDocument();
    expect(screen.getByLabelText('Hora')).toHaveAttribute('aria-invalid', 'true');
    expect(sino()).toHaveAttribute('aria-disabled', 'true');
    expect(gravar).not.toHaveBeenCalled();
  });

  it('dado uma tarefa com lembrete, quando a pessoa apaga o prazo e segue, então pede o prazo e o sino continua ligado para tirar o lembrete', async () => {
    // Dado
    const gravar = await abrir(tarefa({ prazo: '2030-11-15', lembrete: 30 }));
    // Quando
    await userEvent.clear(screen.getByRole('textbox', { name: 'Prazo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // Então
    expect(await screen.findByText('Informe o prazo para marcar o lembrete')).toBeInTheDocument();
    expect(sino()).not.toHaveAttribute('aria-disabled');
    expect(gravar).not.toHaveBeenCalled();
    // Quando
    await marcarLembrete('Sem lembrete');
    // Então
    expect(screen.queryByText('Informe o prazo para marcar o lembrete')).not.toBeInTheDocument();
  });
});

describe('O lápis sem as datas que o cartão muda no lugar (#361)', () => {
  beforeEach(() => {
    sessao.ehAdmin = true;
    sessao.escritorio = undefined;
    vi.spyOn(SD, 'demandasListar').mockResolvedValue({ linhas: [], total: 0 });
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
  });

  it('dado o lápis de uma tarefa com prazo, quando a pessoa o abre e salva, então ele não mostra nem grava o prazo, a hora, o lembrete e o início', async () => {
    // Dado
    const alvo = tarefa({ prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 60 });
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(alvo);
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: alvo.id, codigo: alvo.codigo });
    gravar.mockClear();
    // Quando
    render(<MemoryRouter><NovaTarefa edicao={{ id: alvo.id, aoTerminar: () => undefined }} /></MemoryRouter>);
    await screen.findByLabelText(/Responsável/);
    // Então
    for (const rotulo of ['Prazo', 'Hora', 'Lembrete', 'Data de início']) expect(screen.queryByLabelText(rotulo)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Lembrete/ })).not.toBeInTheDocument();
    // As ligações ficam na primeira etapa do cadastro (#299): no lápis, a seção tem o nome delas.
    expect(screen.getByRole('heading', { name: 'Demanda, contrato e processo' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A tarefa' })).not.toBeInTheDocument();
    // E as pessoas continuam antes das ligações, como antes da #299.
    expect(screen.getAllByRole('heading', { level: 3 }).map(t => t.textContent)).toEqual(['Pessoas', 'Demanda, contrato e processo']);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    await waitFor(() => expect(gravar).toHaveBeenCalled());
    for (const campo of ['prazo', 'prazo_hora', 'lembrete', 'data_inicio']) expect(gravar.mock.calls[0][1]).not.toHaveProperty(campo);
  });
});

describe('Tarefa que nasce do "+ Nova tarefa" de um processo (#376)', () => {
  const PROCESSO = { id: 'p1', codigo: 'ABCD1234', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: 'Ação do José', cliente_nome: 'JOSÉ',
    clientes: [{ id: 'c1', codigo: 'C1', nome: 'JOSÉ', tipo: 'pf', arquivado_em: null }] } as unknown as Processo;
  /** O cadastro da tarefa, para conferir o que foi gravado. */
  const criarTarefa = vi.fn<typeof SD.tarefaCriar>();
  /** O lugar para onde a tela foi depois de salvar. */
  function Destino() {
    const { pathname, search } = useLocation();
    return <p>Foi para {pathname + search}</p>;
  }
  beforeEach(() => {
    sessao.ehAdmin = false;
    sessao.escritorio = { modulos: { processos: true } };
    Object.assign(Element.prototype, { scrollIntoView: () => undefined });
    vi.spyOn(SD, 'demandasListar').mockResolvedValue({ linhas: [], total: 0 });
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
    vi.spyOn(SD, 'colunasListar').mockResolvedValue([]);
    vi.spyOn(SD, 'gruposListar').mockResolvedValue([]);
    vi.spyOn(SD, 'processoObter').mockResolvedValue(PROCESSO);
    criarTarefa.mockReset().mockResolvedValue({ id: 't9', codigo: 'T9' });
    vi.spyOn(SD, 'tarefaCriar').mockImplementation(criarTarefa);
  });
  /** Abre o cadastro pelo endereço e escreve o título. */
  async function abrir(endereco: string) {
    const roteador = createMemoryRouter([{ path: '/tarefas/nova/', element: <NovaTarefa /> }, { path: '*', element: <Destino /> }], { initialEntries: [endereco] });
    render(<RouterProvider router={roteador} />);
    await userEvent.type(await screen.findByLabelText(/Título/), 'Protocolar a petição');
  }
  /** Abre o cadastro pelo cartão do processo: o processo já vem escolhido, e o aviso do topo diz de onde a tarefa nasce. */
  async function abrirPeloProcesso() {
    await abrir('/tarefas/nova/?processo=p1');
    expect(await screen.findByRole('button', { name: 'Tirar o processo Ação do José' })).toBeInTheDocument();
    expect(screen.getByText(/Esta tarefa nasce do processo/)).toHaveTextContent('Esta tarefa nasce do processo ABCD1234 (Ação do José) e fica ligada a ele.');
  }
  async function salvar() {
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar tarefa' }));
  }

  it('dado o processo com um cliente, quando a tarefa é criada por ele, então nasce com o processo e o cliente como pessoa, e a tela volta ao processo', async () => {
    // Dado
    await abrirPeloProcesso();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // Então
    expect(await screen.findByRole('group', { name: 'Pessoas ligadas' })).toHaveTextContent('JOSÉ');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }));
    // Então
    expect(await screen.findByText('Foi para /processos/judicial/?id=p1')).toBeInTheDocument();
    expect(criarTarefa).toHaveBeenCalledWith(expect.objectContaining({ processo_id: 'p1', pessoas: ['c1'] }));
  });

  it('dado o cadastro aberto pelo processo, quando a pessoa tira o processo e salva, então a tela vai à tarefa nova', async () => {
    // Dado
    await abrirPeloProcesso();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o processo Ação do José' }));
    await salvar();
    // Então
    expect(await screen.findByText('Foi para /tarefas/?id=t9')).toBeInTheDocument();
    expect(criarTarefa).toHaveBeenCalledWith(expect.objectContaining({ processo_id: null }));
  });

  it('dado o cadastro aberto pelo processo, quando a pessoa tira o processo, então o aviso de onde a tarefa nasce some', async () => {
    // Dado
    await abrirPeloProcesso();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o processo Ação do José' }));
    // Então
    expect(screen.queryByText(/Esta tarefa nasce do processo/)).not.toBeInTheDocument();
  });

  it('dado um processo arquivado depois que o cartão abriu, quando a tarefa é criada pelo endereço dele, então o aviso diz que ela não fica ligada e ela nasce com os clientes dele, mas sem o processo', async () => {
    // Dado
    vi.spyOn(SD, 'processoObter').mockResolvedValue({ ...PROCESSO, arquivado_em: '2026-11-18T10:00:00Z' });
    await abrir('/tarefas/nova/?processo=p1');
    // Então
    expect(await screen.findByText(/está arquivado/)).toHaveTextContent('O processo ABCD1234 (Ação do José) está arquivado: esta tarefa não fica ligada a ele.');
    expect(screen.queryByText(/Esta tarefa nasce do processo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar o processo Ação do José' })).not.toBeInTheDocument();
    // Quando
    await salvar();
    // Então
    expect(await screen.findByText('Foi para /tarefas/?id=t9')).toBeInTheDocument();
    expect(criarTarefa).toHaveBeenCalledWith(expect.objectContaining({ processo_id: null, pessoas: ['c1'] }));
  });

  it('dado um endereço com a pessoa e o processo, quando as duas leituras respondem no mesmo instante, então a pessoa do endereço fica e a tarefa nasce ligada ao processo', async () => {
    // Dado
    vi.spyOn(SD, 'pessoaObter').mockResolvedValue({ id: 'x1', codigo: 'X1', nome: 'MARIA', tipo: 'pf', arquivado_em: null } as never);
    // Quando
    await abrir('/tarefas/nova/?pessoa=x1&processo=p1');
    expect(await screen.findByRole('button', { name: 'Tirar o processo Ação do José' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // Então
    const pessoas = await screen.findByRole('group', { name: 'Pessoas ligadas' });
    expect(pessoas).toHaveTextContent('MARIA');
    expect(pessoas).not.toHaveTextContent('JOSÉ');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }));
    // Então
    expect(await screen.findByText('Foi para /processos/judicial/?id=p1')).toBeInTheDocument();
    expect(criarTarefa).toHaveBeenCalledWith(expect.objectContaining({ processo_id: 'p1', pessoas: ['x1'] }));
  });
});
