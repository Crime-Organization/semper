// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A faixa da aprovação no cartão da tarefa (#313): de quem é a aprovação e, para quem aprova, o Aprovar e o Devolver.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Coluna } from '../dados';
import { SEM_COMENTARIO_DA_DEVOLUCAO } from '../regras/aprovacaoDaTarefa';
import { falha } from '../ui/avisos';
import { pedirTexto } from '../ui/janela';
import { FaixaDaAprovacao } from './AprovacaoDaTarefa';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), avisar: vi.fn(), falha: vi.fn() }));
vi.mock('../ui/janela', () => ({ pedirTexto: vi.fn() }));
const sessao = vi.hoisted(() => ({ perfil: { id: 'u-ana', papel: 'usuario' } }));
vi.mock('../ui/sessao', () => ({ useCtx: () => sessao }));

const coluna = (id: string, nome: string, extra: Partial<Coluna> = {}): Coluna => ({ id, nome, ordem: 1, criado_por: null, oculta: false, ...extra });
const COLUNAS = [coluna('c-fazendo', 'Fazendo'), coluna('c-aprovacao', 'Aguardando: análise do solicitante', { de_aprovacao: true }),
  coluna('c-feita', 'Concluída', { marco: 'concluido' })];
/** A tarefa pedida pela Ana, esperando na coluna de aprovação. */
const ESPERANDO = { id: 't1', etapa_id: 'c-aprovacao', arquivado_em: null, precisa_aprovacao: true, solicitante_id: 'u-ana' };
const nomeDe = (id: string | null) => ({ 'u-ana': 'Ana Teste Lima' } as Record<string, string>)[id ?? ''] ?? 'Usuário removido';

describe('A faixa da aprovação no cartão da tarefa', () => {
  const aoMudar = vi.fn();
  beforeEach(() => {
    sessao.perfil = { id: 'u-ana', papel: 'usuario' };
    aoMudar.mockReset();
    vi.mocked(falha).mockClear();
    vi.mocked(pedirTexto).mockReset();
  });

  it('dada a tarefa que espera a aprovação da Ana, quando a Ana aprova, então o banco a aprova e o cartão relê', async () => {
    // Dado
    const aprovar = vi.spyOn(SD, 'tarefaAprovar').mockResolvedValue('c-feita');
    render(<FaixaDaAprovacao t={ESPERANDO} colunas={COLUNAS} nomeDe={nomeDe} aoMudar={aoMudar} />);
    expect(screen.getByText('Esta tarefa espera a sua aprovação.')).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    // Então
    expect(aprovar).toHaveBeenCalledWith('t1');
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dada a tarefa que espera a aprovação da Ana, quando ela devolve com um comentário, então o banco grava a devolução com ele', async () => {
    // Dado
    const devolver = vi.spyOn(SD, 'tarefaDevolver').mockResolvedValue('c-fazendo');
    vi.mocked(pedirTexto).mockResolvedValue('Falta a guia.');
    render(<FaixaDaAprovacao t={ESPERANDO} colunas={COLUNAS} nomeDe={nomeDe} aoMudar={aoMudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Devolver' }));
    // Então
    expect(devolver).toHaveBeenCalledWith('t1', 'Falta a guia.');
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dada a devolução, quando a Ana confirma sem comentário, então ela é avisada e nada é gravado', async () => {
    // Dado
    const devolver = vi.spyOn(SD, 'tarefaDevolver').mockResolvedValue('c-fazendo');
    vi.mocked(pedirTexto).mockResolvedValue('');
    render(<FaixaDaAprovacao t={ESPERANDO} colunas={COLUNAS} nomeDe={nomeDe} aoMudar={aoMudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Devolver' }));
    // Então
    expect(falha).toHaveBeenCalledWith(new Error(SEM_COMENTARIO_DA_DEVOLUCAO));
    expect(devolver).not.toHaveBeenCalled();
  });

  it('dado o Bruno (quem executa), quando o cartão abre, então a faixa diz de quem é a aprovação, sem os botões', () => {
    // Dado
    sessao.perfil = { id: 'u-bruno', papel: 'usuario' };
    // Quando
    render(<FaixaDaAprovacao t={ESPERANDO} colunas={COLUNAS} nomeDe={nomeDe} aoMudar={aoMudar} />);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Esta tarefa espera a aprovação de Ana Teste Lima.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('dada a tarefa fora da coluna de aprovação, quando o cartão abre, então não há faixa', () => {
    // Quando
    render(<FaixaDaAprovacao t={{ ...ESPERANDO, etapa_id: 'c-fazendo' }} colunas={COLUNAS} nomeDe={nomeDe} aoMudar={aoMudar} />);
    // Então
    expect(screen.queryByRole('status')).toBeNull();
  });
});
