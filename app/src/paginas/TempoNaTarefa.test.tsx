// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício devolve o tempo a todos; aqui o banco responde como o de verdade responde a quem só lê a tarefa (#397).
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosTempo, Tarefa } from '../dados';
import { DadoDoGrupo } from '../ui/base';
import { DadosDaTarefa } from './TempoNaTarefa';

// Quem só lê usa só a leitura do tempo; o mock declara exatamente essa operação.
const SD = vi.hoisted(() => ({ tempoDaTarefa: vi.fn<DadosTempo['tempoDaTarefa']>() }));
vi.mock('../dados', () => ({ SD: SD satisfies Pick<DadosTempo, 'tempoDaTarefa'> }));

const TAREFA = { id: 't1', criado_em: '2026-11-20T12:00:00Z' } as Tarefa;
const PRAZO = <DadoDoGrupo rotulo="Prazo"><b>25/11/2026</b></DadoDoGrupo>;
const abrirParaLer = () => render(<DadosDaTarefa t={TAREFA} podeAlterar={false} datas={PRAZO} />);

describe('O tempo total da tarefa para quem só lê (#397)', () => {
  beforeEach(() => SD.tempoDaTarefa.mockReset());

  it('dado o banco que devolve o total (quem lê está no contrato da tarefa), quando o cartão abre, então a faixa mostra o tempo total', async () => {
    // Dado
    SD.tempoDaTarefa.mockResolvedValue({ registros: [], equipe: [{ perfil_id: 'u-ana', percentual: 100 }], total: 7200 });
    // Quando
    abrirParaLer();
    // Então
    expect(await screen.findByRole('group', { name: 'Tempo total' })).toHaveTextContent('2 h');
  });

  it('dado o banco que não devolve o total (quem lê só vê a tarefa porque a equipe vê tudo), quando o cartão abre, então a faixa não mostra um tempo total falso', async () => {
    // Dado: o banco não devolve nada a quem não está na tarefa, mesmo com 2 h registradas por outra pessoa
    SD.tempoDaTarefa.mockResolvedValue({ registros: [], equipe: [], total: 0 });
    // Quando
    abrirParaLer();
    // Então
    await act(() => SD.tempoDaTarefa.mock.results[0].value);
    expect(screen.getByRole('group', { name: 'Prazo' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tempo total' })).toBeNull();
  });
});
