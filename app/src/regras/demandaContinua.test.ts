// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { GrupoDaEquipe } from '../dados/tipos';
import {
  CONTINUA_GERAL, continuaInicial, ehContinua, grupoDaContinuaAoGravar, grupoPeloGatilho, NOME_DA_GERAL, opcoesDaContinua, semAContinuaComDemanda, tituloDaContinua,
  usaAContinua
} from './demandaContinua';

const CIVEL: GrupoDaEquipe = { id: 'g-civel', nome: 'Núcleo Cível', integrantes: ['u-bia', 'u-caio'] };
const PENAL: GrupoDaEquipe = { id: 'g-penal', nome: 'Núcleo Penal', integrantes: ['u-caio'] };
const GRUPOS = [PENAL, CIVEL];

describe('A demanda contínua (#313)', () => {
  describe('Dado o cadastro de uma tarefa sem demanda', () => {
    it.each([
      ['está em um grupo só', 'u-bia', [{ valor: 'g-civel', nome: 'Núcleo Cível' }], 'g-civel'],
      ['está em dois grupos', 'u-caio', [{ valor: 'g-civel', nome: 'Núcleo Cível' }, { valor: 'g-penal', nome: 'Núcleo Penal' }], ''],
      ['não está em grupo nenhum', 'u-eva', [{ valor: CONTINUA_GERAL, nome: NOME_DA_GERAL }], CONTINUA_GERAL]
    ])('quando quem cadastra %s, então vê os grupos dele (ou a Geral) e a escolha já vem marcada só se há uma', (_caso, eu, opcoes, inicial) => {
      // Quando
      const r = opcoesDaContinua(GRUPOS, eu);
      // Então
      expect(r).toEqual(opcoes);
      expect(continuaInicial(r)).toBe(inicial);
    });

    it('quando o escritório não tem grupos, então só a Geral', () => {
      // Então
      expect(opcoesDaContinua(undefined, 'u-bia')).toEqual([{ valor: CONTINUA_GERAL, nome: NOME_DA_GERAL }]);
    });

    it('quando grava, então a Geral vai ao banco sem grupo, e o grupo pelo id', () => {
      // Então
      expect(grupoDaContinuaAoGravar(CONTINUA_GERAL)).toBeNull();
      expect(grupoDaContinuaAoGravar('g-civel')).toBe('g-civel');
    });
  });

  it.each([
    ['em um grupo só', ['g-civel'], 'g-civel'],
    ['em dois grupos', ['g-civel', 'g-penal'], null],
    ['em grupo nenhum', [], null]
  ])('dada a tarefa gravada sem demanda por outro caminho, quando quem cria está %s, então ela vai para a contínua dele ou para a Geral', (_caso, grupos, esperado) => {
    // Então
    expect(grupoPeloGatilho(grupos)).toBe(esperado);
  });

  it.each([
    ['a Geral, por qualquer um', { continua: true, continua_grupo_id: null }, false, [], true],
    ['a de um grupo, por quem está nele', { continua: true, continua_grupo_id: 'g-civel' }, false, ['g-civel'], true],
    ['a de um grupo, por quem não está nele', { continua: true, continua_grupo_id: 'g-civel' }, false, ['g-penal'], false],
    ['a de um grupo, pelo administrador', { continua: true, continua_grupo_id: 'g-civel' }, true, [], true],
    ['uma demanda comum', { continua: false, continua_grupo_id: null }, true, [], false]
  ])('dada %s, então usa a contínua: %s', (_caso, d, ehAdmin, meus, esperado) => {
    // Então
    expect(usaAContinua(d, ehAdmin as boolean, meus as string[])).toBe(esperado);
  });

  it('dada uma tarefa avulsa, quando ganha uma demanda de verdade, então a contínua sai; só com a contínua, ela fica', () => {
    // Dado
    const continua = (id: string) => id === 'c1';
    // Então
    expect(semAContinuaComDemanda(['c1', 'd1'], continua)).toEqual(['d1']);
    expect(semAContinuaComDemanda(['c1'], continua)).toEqual(['c1']);
    expect(semAContinuaComDemanda([], continua)).toEqual([]);
  });

  it('dado o nome do grupo, então o título é o do banco; e só a marcada é contínua', () => {
    // Então
    expect(tituloDaContinua('Geral')).toBe('Contínua: Geral');
    expect(ehContinua({ continua: true })).toBe(true);
    expect(ehContinua({})).toBe(false);
    expect(ehContinua(null)).toBe(false);
  });
});
