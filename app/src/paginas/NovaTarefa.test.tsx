// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a tarefa é editada também por quem não é.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Tarefa } from '../dados';
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
  id: 't1', codigo: 'T1', titulo: 'Emitir a GRU', descricao: null, prazo: null, responsavel_id: 'u-bruno', participantes: [], pessoas: [], demanda_id: null, demanda: null,
  demanda_codigo: null, contrato_id: null, contrato_codigo: null, contrato: null, criado_por: 'u-ana', ...extra
}) as unknown as Tarefa;
const DEMANDA_QUE_VEJO = { id: 'd1', codigo: 'D1', titulo: 'Registro de marca', etapa_id: null, criado_por: 'u-ana', responsavel_id: 'u-bruno', colaboradores: [] };

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

  async function abrir(alvo: Tarefa) {
    vi.spyOn(SD, 'tarefaObter').mockResolvedValue(alvo);
    const gravar = vi.spyOn(SD, 'tarefaAtualizar').mockResolvedValue({ id: alvo.id, codigo: alvo.codigo });
    gravar.mockClear();
    render(<MemoryRouter><NovaTarefa edicao={{ id: alvo.id, aoTerminar: () => undefined }} /></MemoryRouter>);
    await screen.findByLabelText('Hora');
    return gravar;
  }

  it('dado uma tarefa com prazo, quando marca a hora e o lembrete e salva, então os dois são gravados', async () => {
    // Dado
    const gravar = await abrir(tarefa({ prazo: '2030-11-15' }));
    // Quando
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '14:00' } });
    await userEvent.selectOptions(screen.getByLabelText('Lembrete'), '1 hora antes');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    await waitFor(() => expect(gravar).toHaveBeenCalledWith('t1', expect.objectContaining({ prazo: '2030-11-15', prazo_hora: '14:00', lembrete: 60 })));
  });

  it('dado uma tarefa salva com hora e lembrete, quando abre para editar, então os campos vêm preenchidos, com as opções combinadas', async () => {
    // Quando
    await abrir(tarefa({ prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 1440 }));
    // Então
    expect(screen.getByLabelText('Hora')).toHaveValue('14:00');
    expect(screen.getByLabelText('Lembrete')).toHaveValue('1440');
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(expect.arrayContaining(['Sem lembrete', 'Na hora do prazo', '30 minutos antes', '1 hora antes', '1 dia antes']));
    expect(screen.getByText(/Sem hora, o lembrete conta o prazo às 9h/)).toBeInTheDocument();
  });

  it('dado uma tarefa sem prazo, quando marca hora e lembrete e salva, então pede o prazo e não grava', async () => {
    // Dado
    const gravar = await abrir(tarefa({ prazo: null }));
    // Quando
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '14:00' } });
    await userEvent.selectOptions(screen.getByLabelText('Lembrete'), 'Na hora do prazo');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Informe o prazo para pôr a hora')).toBeInTheDocument();
    expect(screen.getByText('Informe o prazo para marcar o lembrete')).toBeInTheDocument();
    expect(gravar).not.toHaveBeenCalled();
  });
});
