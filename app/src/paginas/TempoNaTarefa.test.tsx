// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício devolve o tempo a todos; aqui o banco responde como o de verdade responde a quem só lê a tarefa (#397).
// A regra mudou na #442 só no lugar: o total de quem só lê saiu da faixa das datas ("Tempo total") e foi para a linha da equipe
// ("Total da equipe 2 h"), embaixo do bloco "Prazo e tempo". Quem só lê continua vendo o total só quando o banco o devolve.
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosTempo, Tarefa } from '../dados';
import { DadosDaTarefa } from './TempoNaTarefa';

// Quem só lê usa só a leitura do tempo; o mock declara exatamente essa operação.
const SD = vi.hoisted(() => ({ tempoDaTarefa: vi.fn<DadosTempo['tempoDaTarefa']>() }));
vi.mock('../dados', () => ({ SD: SD satisfies Pick<DadosTempo, 'tempoDaTarefa'> }));

const TAREFA = { id: 't1', criado_em: '2026-11-20T12:00:00Z' } as Tarefa;
const PRAZO = <div role="group" aria-label="Prazo"><b>25/11/2026</b></div>;
const abrirParaLer = () => render(<DadosDaTarefa t={TAREFA} podeAlterar={false} prazo={PRAZO} />);

describe('O tempo total da tarefa para quem só lê (#397, #442)', () => {
  beforeEach(() => SD.tempoDaTarefa.mockReset());

  it('dado o banco que devolve o total (quem lê está no contrato da tarefa), quando o cartão abre, então a linha da equipe mostra o total', async () => {
    // Dado
    SD.tempoDaTarefa.mockResolvedValue({ registros: [], equipe: [{ perfil_id: 'u-ana', percentual: 100 }], total: 7200 });
    // Quando
    abrirParaLer();
    // Então
    expect(await screen.findByRole('group', { name: 'Tempo da equipe' })).toHaveTextContent('Total da equipe 2 h');
  });

  it('dado o banco que não devolve o total (quem lê só vê a tarefa porque a equipe vê tudo), quando o cartão abre, então não há um total falso', async () => {
    // Dado: o banco não devolve nada a quem não está na tarefa, mesmo com 2 h registradas por outra pessoa
    SD.tempoDaTarefa.mockResolvedValue({ registros: [], equipe: [], total: 0 });
    // Quando
    abrirParaLer();
    // Então
    await act(() => SD.tempoDaTarefa.mock.results[0].value);
    expect(screen.getByRole('group', { name: 'Prazo' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tempo da equipe' })).toBeNull();
  });

  it('dado quem só lê, quando o cartão abre, então vê o prazo no bloco "Prazo e tempo", sem o relógio "Seu tempo" e sem botões', async () => {
    // Dado
    SD.tempoDaTarefa.mockResolvedValue({ registros: [], equipe: [{ perfil_id: 'u-ana', percentual: 100 }], total: 7200 });
    // Quando
    abrirParaLer();
    // Então
    await screen.findByRole('group', { name: 'Tempo da equipe' });
    expect(within(screen.getByRole('group', { name: 'Prazo e tempo' })).getByRole('group', { name: 'Prazo' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Seu tempo' })).toBeNull();
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
