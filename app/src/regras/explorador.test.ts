// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { anotacoesPorPasta, ORDENS_DO_EXPLORADOR, ordemDoExplorador, pastasParaMostrar, type AnotacaoDoExplorador } from './explorador';
import type { PastaDaArvore } from './pastas';

const pasta = (id: string, nome: string, pasta_mae_id: string | null = null): PastaDaArvore => ({ id, nome, pasta_mae_id });
const nota = (id: string, pasta_id: string | null): AnotacaoDoExplorador => ({ id, titulo: 'Anotação ' + id, pasta_id });
// Escritório › POPs; Modelos.
const PASTAS = [pasta('esc', 'Escritório'), pasta('pops', 'POPs', 'esc'), pasta('mod', 'Modelos')];

describe('O explorador da página Documentos', () => {
  it('dadas anotações em pastas e fora delas, quando são repartidas, então cada pasta fica com as suas, na ordem em que vieram, e as sem pasta ficam juntas', () => {
    // Dado
    const lista = [nota('a', 'pops'), nota('b', null), nota('c', 'pops'), nota('d', 'mod')];
    // Quando
    const grupos = anotacoesPorPasta(lista, PASTAS);
    // Então
    expect(grupos.get('pops')?.map(a => a.id)).toEqual(['a', 'c']);
    expect(grupos.get('mod')?.map(a => a.id)).toEqual(['d']);
    expect(grupos.get(null)?.map(a => a.id)).toEqual(['b']);
    expect(grupos.has('esc')).toBe(false);
  });

  it('dada uma anotação numa pasta que a lista ainda não conhece, quando são repartidas, então ela aparece no primeiro nível, sem sumir', () => {
    // Quando
    const grupos = anotacoesPorPasta([nota('a', 'pasta-nova')], PASTAS);
    // Então
    expect(grupos.get(null)?.map(a => a.id)).toEqual(['a']);
  });

  it('dada a anotação aberta numa subpasta e outra pasta escolhida, quando a árvore aparece, então abrem as pastas do caminho até as duas, sem repetir', () => {
    // Então
    expect(pastasParaMostrar(PASTAS, 'pops', 'esc', null)).toEqual(['esc', 'pops']);
    expect(pastasParaMostrar(PASTAS, null)).toEqual([]);
  });

  it.each([
    ['recentes', 'recentes'],
    ['nome_desc', 'nome_desc'],
    ['manual', 'nome'],
    ['qualquer', 'nome']
  ])('dada a ordem guardada %s, quando o explorador abre, então usa %s', (guardada, usada) => {
    // Então
    expect(ordemDoExplorador(guardada)).toBe(usada);
    expect(ORDENS_DO_EXPLORADOR[0]).toBe('nome');
  });
});
