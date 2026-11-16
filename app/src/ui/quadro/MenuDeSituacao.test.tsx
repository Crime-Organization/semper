// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Coluna, GrupoDeColunas } from '../../dados';
import { situacoesDoQuadro } from '../../regras/quadro';
import { MenuDeSituacao } from './MenuDeSituacao';

const AGUARDANDO: GrupoDeColunas = { id: 'g', nome: 'AGUARDANDO', ordem: 3, comeca_fechado: false };
const coluna = (id: string, nome: string, ordem: number, grupo_id: string | null = null, oculta = false): Coluna => ({ id, nome, ordem, grupo_id, criado_por: null, oculta });
const COLUNAS = [coluna('fazer', 'Para fazer', 1), coluna('analise', 'ANÁLISE', 1, 'g'), coluna('fim', 'Concluída', 4), coluna('velha', 'Velha', 2, 'g', true)];

function montar(aoMudar = vi.fn(), valor: string | null = 'analise') {
  render(<MenuDeSituacao rotulo="Situação da tarefa" quadro={{ situacoes: situacoesDoQuadro(COLUNAS, [AGUARDANDO]) }} valor={valor}
    semSituacao="Sem situação" aoMudar={aoMudar} />);
  return screen.getByRole('combobox', { name: 'Situação da tarefa' });
}

describe('Menu "Situação" do cartão (#302)', () => {
  it('dado um quadro com um grupo, quando a pessoa abre o menu, então as colunas do grupo vêm com o nome dele na frente, na ordem do quadro', () => {
    // Quando
    const menu = montar();
    // Então
    expect(within(menu).getAllByRole('option').map(o => o.textContent)).toEqual([
      'Sem situação', 'Para fazer', 'AGUARDANDO: ANÁLISE', 'AGUARDANDO: Velha (oculta para você)', 'Concluída'
    ]);
  });

  it('dado um cartão numa coluna do grupo, quando o menu aparece fechado, então mostra o grupo e a coluna', () => {
    // Quando
    const menu = montar();
    // Então
    expect(within(menu).getByRole('option', { selected: true })).toHaveProperty('textContent', 'AGUARDANDO: ANÁLISE');
  });

  it('dado o menu, quando a pessoa escolhe outra situação, então a escolha chega com o id da coluna', () => {
    // Dado
    const aoMudar = vi.fn();
    const menu = montar(aoMudar, null);
    // Quando
    fireEvent.change(menu, { target: { value: 'fim' } });
    // Então
    expect(aoMudar).toHaveBeenCalledWith('fim');
  });
});
