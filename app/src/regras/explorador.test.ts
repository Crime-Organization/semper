// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  ALVO_SEM_PASTA, anotacoesPorPasta, avisoDaMudancaDePasta, mudaDePasta, ORDENS_DO_EXPLORADOR, ordemDoExplorador, pastaDoAlvo, pastasParaMostrar,
  type AnotacaoDoExplorador
} from './explorador';
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

describe('Arrastar a anotação para outra pasta (#370)', () => {
  it('dado o alvo "Sem pasta", quando a anotação é solta nele, então ela vai para fora das pastas; numa pasta, para ela', () => {
    // Então
    expect(pastaDoAlvo(ALVO_SEM_PASTA)).toBeNull();
    expect(pastaDoAlvo('pops')).toBe('pops');
  });

  it.each([
    ['numa pasta, solta em outra', 'esc', 'pops', true],
    ['numa pasta, solta na mesma', 'pops', 'pops', false],
    ['numa pasta, solta em "Sem pasta"', 'pops', ALVO_SEM_PASTA, true],
    ['fora das pastas, solta em "Sem pasta"', null, ALVO_SEM_PASTA, false],
    ['fora das pastas, solta numa pasta', null, 'mod', true]
  ])('dada a anotação %s, quando passa por cima do alvo, então ele a aceita só se a pasta muda', (_caso, atual, alvo, muda) => {
    // Então
    expect(mudaDePasta(atual, alvo)).toBe(muda);
  });

  it('quando a anotação muda de pasta, então o aviso diz o caminho da pasta nova, ou que ela saiu das pastas', () => {
    // Então
    expect(avisoDaMudancaDePasta(PASTAS, 'pops')).toBe('Anotação levada para a pasta Escritório › POPs.');
    expect(avisoDaMudancaDePasta(PASTAS, null)).toBe('Anotação levada para fora das pastas.');
  });
});
