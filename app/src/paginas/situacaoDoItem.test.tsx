// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A gravação comum de mudar a Situação (#350): o ✓ do cartão, o menu Situação e o círculo da miniatura e da tabela gravam igual,
// com o aviso, o Desfazer e a oferta de cada módulo (concluir a demanda da tarefa; criar o processo da demanda).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Coluna } from '../dados';
import { falha, feito, sinalizarMudanca } from '../ui/avisos';
import { MoverNoQuadro } from '../ui/quadro/moverNoQuadro';
import { oferecerConcluirDemanda, oferecerProcesso } from './concluirDemanda';
import { ConcluirItem, concluirOuReabrirItem, mudarSituacaoDoItem, type ItemQueMuda } from './situacaoDoItem';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn(), falha: vi.fn(), sinalizarMudanca: vi.fn() }));
vi.mock('./concluirDemanda', () => ({ oferecerConcluirDemanda: vi.fn(() => Promise.resolve(false)), oferecerProcesso: vi.fn(() => Promise.resolve()) }));

const coluna = (id: string, nome: string, marco: Coluna['marco'] = null): Coluna => ({ id, nome, ordem: 1, criado_por: null, oculta: false, marco });
const COLUNAS = [coluna('c-fazer', 'Para fazer', 'inicio'), coluna('c-fazendo', 'Fazendo'), coluna('c-feita', 'Concluída', 'concluido')];
const TAREFA: ItemQueMuda = { id: 't1', titulo: 'Emitir a GRU', etapa_id: 'c-fazendo', etapa_ordem: 3, ligadoADemanda: false };
const navegar = vi.fn();

describe('Mudar a Situação de um item (gravação comum)', () => {
  beforeEach(() => {
    vi.mocked(feito).mockClear();
    vi.mocked(falha).mockClear();
    vi.mocked(sinalizarMudanca).mockClear();
    vi.mocked(oferecerConcluirDemanda).mockClear();
    vi.mocked(oferecerProcesso).mockClear();
  });

  it('dada uma tarefa em "Fazendo", quando ela é concluída, então vai para a coluna das concluídas, com o aviso, e o Desfazer a devolve ao lugar', async () => {
    // Dado
    const mover = vi.spyOn(SD, 'tarefaMover').mockResolvedValue();
    // Quando
    const gravou = await concluirOuReabrirItem('tarefas', COLUNAS, TAREFA, 'concluir', navegar);
    // Então
    expect(gravou).toBe(true);
    expect(mover).toHaveBeenCalledWith('t1', 'c-feita', expect.any(Number));
    expect(feito).toHaveBeenCalledWith('Tarefa concluída.', 'mudança de situação', expect.any(Function));
    await vi.mocked(feito).mock.calls[0][2]();
    expect(mover).toHaveBeenLastCalledWith('t1', 'c-fazendo', 3);
  });

  it('dada uma tarefa concluída, quando ela é reaberta, então volta para a coluna do início, com o nome dela no aviso', async () => {
    // Dado
    const mover = vi.spyOn(SD, 'tarefaMover').mockResolvedValue();
    // Quando
    await concluirOuReabrirItem('tarefas', COLUNAS, { ...TAREFA, etapa_id: 'c-feita' }, 'reabrir', navegar);
    // Então
    expect(mover).toHaveBeenCalledWith('t1', 'c-fazer', expect.any(Number));
    expect(feito).toHaveBeenCalledWith('Tarefa reaberta em "Para fazer".', 'mudança de situação', expect.any(Function));
  });

  it.each([
    [true, 1],
    [false, 0]
  ])('dada uma tarefa ligada a uma demanda = %s, quando ela muda de coluna, então a pergunta de concluir a demanda é feita %s vez', async (ligada, vezes) => {
    // Dado
    vi.spyOn(SD, 'tarefaMover').mockResolvedValue();
    // Quando
    await concluirOuReabrirItem('tarefas', COLUNAS, { ...TAREFA, ligadoADemanda: ligada }, 'concluir', navegar);
    // Então
    expect(oferecerConcluirDemanda).toHaveBeenCalledTimes(vezes);
  });

  it('dada uma demanda, quando ela é concluída, então grava a coluna das concluídas e oferece criar o processo, depois de avisar', async () => {
    // Dado
    const mover = vi.spyOn(SD, 'demandaMover').mockResolvedValue();
    const depois = vi.fn();
    const demanda: ItemQueMuda = { id: 'd1', titulo: 'Notificar o devedor', etapa_id: 'c-fazer', etapa_ordem: 1 };
    // Quando
    await concluirOuReabrirItem('demandas', COLUNAS, demanda, 'concluir', navegar, depois);
    // Então
    expect(mover).toHaveBeenCalledWith('d1', 'c-feita', expect.any(Number));
    expect(feito).toHaveBeenCalledWith('Demanda concluída.', 'mudança de situação', expect.any(Function));
    expect(depois).toHaveBeenCalledWith(expect.any(Number), 'c-feita');
    expect(oferecerProcesso).toHaveBeenCalledWith(demanda, 'c-feita', navegar);
  });

  it('dado o banco recusando, quando a tarefa muda de coluna, então avisa o erro e não faz mais nada', async () => {
    // Dado
    vi.spyOn(SD, 'tarefaMover').mockRejectedValue(new Error('Sem permissão.'));
    const depois = vi.fn();
    // Quando
    const gravou = await mudarSituacaoDoItem('tarefas', { ...TAREFA, ligadoADemanda: true }, 'c-feita', 'Tarefa concluída.', navegar, depois);
    // Então
    expect(gravou).toBe(false);
    expect(falha).toHaveBeenCalled();
    expect(feito).not.toHaveBeenCalled();
    expect(depois).not.toHaveBeenCalled();
    expect(oferecerConcluirDemanda).not.toHaveBeenCalled();
  });

  it('dado um quadro sem a coluna das concluídas, quando alguém pede para concluir, então nada é gravado', async () => {
    // Dado
    const mover = vi.spyOn(SD, 'tarefaMover').mockResolvedValue();
    // Quando
    const gravou = await concluirOuReabrirItem('tarefas', COLUNAS.filter(c => c.marco !== 'concluido'), TAREFA, 'concluir', navegar);
    // Então
    expect(gravou).toBe(false);
    expect(mover).not.toHaveBeenCalled();
  });
});

describe('O círculo ligado à gravação comum (#350)', () => {
  it('dada uma tarefa que a pessoa altera, quando ela clica no círculo, então a tarefa é concluída e a página é avisada para reler', async () => {
    // Dado
    const mover = vi.spyOn(SD, 'tarefaMover').mockResolvedValue();
    render(<MemoryRouter><ConcluirItem modulo="tarefas" colunas={COLUNAS} item={TAREFA} podeAgir /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Concluir Emitir a GRU' }));
    // Então
    expect(mover).toHaveBeenCalledWith('t1', 'c-feita', expect.any(Number));
    expect(sinalizarMudanca).toHaveBeenCalledWith({ tipo: 'situacaoMudou', id: 't1' });
  });

  it('dada uma demanda concluída que a pessoa só lê, quando o círculo aparece, então é só o visto, sem botão', () => {
    // Quando
    render(<MemoryRouter><ConcluirItem modulo="demandas" colunas={COLUNAS} item={{ ...TAREFA, etapa_id: 'c-feita' }} podeAgir={false} /></MemoryRouter>);
    // Então
    expect(screen.getByRole('img', { name: 'Demanda concluída' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['o mouse', (b: HTMLElement) => userEvent.click(b), false],
    ['o teclado', async (b: HTMLElement) => { b.focus(); await userEvent.keyboard('{Enter}'); }, true]
  ])('dada uma tarefa no quadro, quando ela é concluída pelo círculo com %s, então a miniatura só muda de coluna na tela, sem a página reler', async (_, agir, focar) => {
    // Dado
    vi.spyOn(SD, 'tarefaMover').mockResolvedValue();
    const moverNaTela = vi.fn();
    render(<MemoryRouter><MoverNoQuadro.Provider value={moverNaTela}>
      <ConcluirItem modulo="tarefas" colunas={COLUNAS} item={TAREFA} podeAgir />
    </MoverNoQuadro.Provider></MemoryRouter>);
    // Quando
    await agir(screen.getByRole('button', { name: 'Concluir Emitir a GRU' }));
    // Então
    expect(moverNaTela).toHaveBeenCalledWith('t1', 'c-feita', expect.any(Number), focar);
    expect(sinalizarMudanca).not.toHaveBeenCalled();
  });
});
