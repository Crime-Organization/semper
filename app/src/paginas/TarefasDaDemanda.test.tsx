// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A lista de tarefas no cartão da demanda (#298): só a caixinha conclui; o nome é o link que abre a tarefa.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Coluna, type TarefaLigada } from '../dados';
import { TarefasDaDemanda } from './TarefasDaDemanda';

const coluna = (id: string, nome: string, ordem: number, marco: Coluna['marco']) => ({ id, nome, ordem, grupo_id: null, criado_por: null, oculta: false, marco }) as Coluna;
const tarefa = (id: string, titulo: string, etapa_id: string) =>
  ({ id, codigo: id.toUpperCase(), titulo, prazo: null, prazo_hora: null, etapa_id, arquivado_em: null, criado_em: '2026-11-01T12:00:00Z', papeis: [] }) as TarefaLigada;

async function montar(somenteLer: boolean) {
  render(<MemoryRouter><TarefasDaDemanda demandaId="d1" versao={0} aoMudar={() => undefined} somenteLer={somenteLer} /></MemoryRouter>);
  return screen.findByRole('region', { name: 'Tarefas da demanda' });
}

describe('Tarefas no cartão da demanda (#298)', () => {
  beforeEach(() => {
    vi.spyOn(SD, 'tarefasDaDemanda').mockResolvedValue([tarefa('t1', 'Emitir a GRU', 'fazer'), tarefa('t2', 'Organizar a pasta', 'fim')]);
    vi.spyOn(SD, 'colunasListar').mockResolvedValue([coluna('fazer', 'Para fazer', 1, 'inicio'), coluna('fim', 'Concluída', 2, 'concluido')]);
  });

  it('dada a lista, quando a pessoa olha cada linha, então a caixinha e o nome são dois controles, e não há botão de seta', async () => {
    // Quando
    await montar(false);
    // Então
    expect(await screen.findByRole('checkbox', { name: 'Concluir Emitir a GRU' })).toHaveProperty('checked', false);
    expect(screen.getByRole('link', { name: 'Emitir a GRU' }).getAttribute('href')).toBe('/tarefas/?id=t1');
    expect(screen.getByRole('checkbox', { name: 'Concluir Organizar a pasta' })).toHaveProperty('checked', true);
    expect(screen.queryAllByRole('link', { name: /^Abrir a tarefa/ })).toHaveLength(0);
  });

  it('dado quem não pode mudar a demanda, quando olha a lista, então a caixinha fica travada, mas o nome continua abrindo a tarefa', async () => {
    // Quando
    await montar(true);
    // Então
    expect(await screen.findByRole('checkbox', { name: 'Concluir Emitir a GRU' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('link', { name: 'Emitir a GRU' }).getAttribute('href')).toBe('/tarefas/?id=t1');
    expect(screen.getByRole('link', { name: 'Organizar a pasta' }).getAttribute('href')).toBe('/tarefas/?id=t2');
  });
});
