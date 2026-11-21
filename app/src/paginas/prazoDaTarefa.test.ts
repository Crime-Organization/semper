// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Concluir a tarefa que cumpre um prazo de processo pergunta se ele foi cumprido; reabri-la, se ele volta a ficar aberto (#355).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Coluna, type PrazoDeProcesso } from '../dados';
import { falha, feito } from '../ui/avisos';
import { confirmar } from '../ui/janela';
import { oferecerPrazoDoProcesso } from './prazoDaTarefa';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn(), falha: vi.fn() }));
vi.mock('../ui/janela', () => ({ confirmar: vi.fn() }));

const coluna = (id: string, marco: Coluna['marco'] = null): Coluna => ({ id, nome: id, ordem: 1, criado_por: null, oculta: false, marco });
const COLUNAS = [coluna('fazer', 'inicio'), coluna('fazendo'), coluna('feita', 'concluido')];
const prazo = (id: string, descricao: string, concluido_em: string | null = null) =>
  ({ id, descricao, concluido_em, processo_id: 'p1', tarefa_id: 't1' }) as PrazoDeProcesso;

describe('A pergunta do prazo do processo ao concluir ou reabrir a tarefa (#355)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(feito).mockClear();
    vi.mocked(falha).mockClear();
    vi.mocked(confirmar).mockReset();
    vi.spyOn(SD, 'colunasListar').mockResolvedValue(COLUNAS);
  });

  it('dada a tarefa que cumpre um prazo aberto, quando é concluída e a pessoa diz sim, então o prazo fica cumprido, e o Desfazer o reabre', async () => {
    // Dado
    vi.spyOn(SD, 'prazosDaTarefa').mockResolvedValue([prazo('z1', 'Contestação')]);
    const atualizar = vi.spyOn(SD, 'processoPrazoAtualizar').mockResolvedValue(prazo('z1', 'Contestação'));
    vi.mocked(confirmar).mockResolvedValue(true);
    // Quando
    const gravou = await oferecerPrazoDoProcesso('t1', 'fazendo', 'feita');
    // Então
    expect(gravou).toBe(true);
    expect(confirmar).toHaveBeenCalledWith('O prazo do processo foi cumprido?', expect.stringContaining('"Contestação"'), 'Sim, foi cumprido');
    expect(atualizar).toHaveBeenCalledWith('z1', { concluido_em: expect.any(String) });
    expect(feito).toHaveBeenCalledWith('Prazo do processo marcado como cumprido.', 'prazo cumprido', expect.any(Function));
    await vi.mocked(feito).mock.calls[0][2]();
    expect(atualizar).toHaveBeenLastCalledWith('z1', { concluido_em: null });
  });

  it('dada a pessoa que diz não, quando a tarefa é concluída, então o prazo continua aberto', async () => {
    // Dado
    vi.spyOn(SD, 'prazosDaTarefa').mockResolvedValue([prazo('z1', 'Contestação')]);
    const atualizar = vi.spyOn(SD, 'processoPrazoAtualizar');
    vi.mocked(confirmar).mockResolvedValue(false);
    // Quando
    const gravou = await oferecerPrazoDoProcesso('t1', 'fazendo', 'feita');
    // Então
    expect(gravou).toBe(false);
    expect(atualizar).not.toHaveBeenCalled();
  });

  it('dada a tarefa reaberta com o prazo cumprido, quando a pessoa diz sim, então o prazo volta a ficar aberto', async () => {
    // Dado
    vi.spyOn(SD, 'prazosDaTarefa').mockResolvedValue([prazo('z1', 'Réplica', '2026-11-20T10:00:00Z')]);
    const atualizar = vi.spyOn(SD, 'processoPrazoAtualizar').mockResolvedValue(prazo('z1', 'Réplica'));
    vi.mocked(confirmar).mockResolvedValue(true);
    // Quando
    await oferecerPrazoDoProcesso('t1', 'feita', 'fazer');
    // Então
    expect(confirmar).toHaveBeenCalledWith('O prazo do processo volta a ficar aberto?', expect.any(String), 'Sim, reabrir o prazo');
    expect(atualizar).toHaveBeenCalledWith('z1', { concluido_em: null });
  });

  it.each([
    ['a tarefa sem prazo de processo', [], 'fazendo', 'feita'],
    ['o prazo já cumprido', [prazo('z1', 'Contestação', '2026-11-20T10:00:00Z')], 'fazendo', 'feita'],
    ['a tarefa que só mudou entre colunas abertas', [prazo('z1', 'Contestação')], 'fazer', 'fazendo']
  ])('dada %s, quando a tarefa muda de coluna, então nada é perguntado', async (_, prazos, de, para) => {
    // Dado
    vi.spyOn(SD, 'prazosDaTarefa').mockResolvedValue(prazos);
    // Quando
    const gravou = await oferecerPrazoDoProcesso('t1', de, para);
    // Então
    expect(gravou).toBe(false);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('dado o banco recusando, quando a pessoa diz sim, então avisa o erro', async () => {
    // Dado
    vi.spyOn(SD, 'prazosDaTarefa').mockResolvedValue([prazo('z1', 'Contestação')]);
    vi.spyOn(SD, 'processoPrazoAtualizar').mockRejectedValue(new Error('Sem permissão.'));
    vi.mocked(confirmar).mockResolvedValue(true);
    // Quando
    const gravou = await oferecerPrazoDoProcesso('t1', 'fazendo', 'feita');
    // Então
    expect(gravou).toBe(false);
    expect(falha).toHaveBeenCalled();
    expect(feito).not.toHaveBeenCalled();
  });
});
