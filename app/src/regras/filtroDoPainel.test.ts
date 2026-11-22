// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { alcanceDoPainel, daPessoa, EQUIPE_TODA, escolhaDoAlcance, FRASE_DO_ALCANCE, MEU_TRABALHO, pessoasDoFiltro } from './filtroDoPainel';

const EQUIPE = [
  { id: 'eu', nome: 'Mauro' }, { id: 'b', nome: 'Bruno' }, { id: 'a', nome: 'Ana' },
  { id: 'x', nome: 'Xavier', ativo: false }, { id: 'z', nome: 'Zeca (excluído)', excluido: true }
];
const ADMIN = { ehAdmin: true, eu: 'eu', equipe: EQUIPE };

describe('Quem entra no filtro do painel', () => {
  it('dada a equipe, quando monta a lista, então vem o resto da equipe ativa, em ordem de nome', () => {
    // Então
    expect(pessoasDoFiltro(EQUIPE, 'eu').map(m => m.id)).toEqual(['a', 'b']);
  });
});

describe('Alcance do painel', () => {
  it('dado quem não é administrador, quando a escolha guardada é a equipe ou outra pessoa, então vê só o próprio trabalho', () => {
    // Então
    expect(alcanceDoPainel(EQUIPE_TODA, { ...ADMIN, ehAdmin: false })).toEqual({ tipo: 'eu', pessoa: 'eu' });
    expect(alcanceDoPainel('a', { ...ADMIN, ehAdmin: false })).toEqual({ tipo: 'eu', pessoa: 'eu' });
  });

  it('dado um administrador, quando escolhe a equipe toda ou uma pessoa, então o painel mostra esse trabalho', () => {
    // Então
    expect(alcanceDoPainel(EQUIPE_TODA, ADMIN)).toEqual({ tipo: 'equipe', pessoa: null });
    expect(alcanceDoPainel('a', ADMIN)).toEqual({ tipo: 'pessoa', pessoa: 'a' });
    expect(alcanceDoPainel(MEU_TRABALHO, ADMIN)).toEqual({ tipo: 'eu', pessoa: 'eu' });
  });

  it('dada uma escolha que não serve mais (quem saiu da equipe, quem está desligado ou um valor estragado), então volta ao próprio trabalho', () => {
    // Então
    for (const escolha of ['z', 'x', 'ninguem', 42, null, undefined]) expect(alcanceDoPainel(escolha, ADMIN)).toEqual({ tipo: 'eu', pessoa: 'eu' });
  });

  it('quando guarda um alcance, então a escolha volta ao mesmo alcance', () => {
    // Então
    for (const escolha of [MEU_TRABALHO, EQUIPE_TODA, 'a']) expect(escolhaDoAlcance(alcanceDoPainel(escolha, ADMIN))).toBe(escolha);
  });

  it('quando escreve de quem é o trabalho, então cada alcance tem a sua frase', () => {
    // Então
    expect(FRASE_DO_ALCANCE.pessoa('Ana')).toBe('O trabalho de Ana.');
    expect(FRASE_DO_ALCANCE.equipe('')).toBe('O trabalho da equipe toda.');
  });
});

describe('Trabalho da pessoa', () => {
  it('dado um item, quando a pessoa é a responsável ou uma colaboradora, então ele é dela', () => {
    // Então
    expect(daPessoa({ responsavel_id: 'a', colaboradores: [] }, 'a')).toBe(true);
    expect(daPessoa({ responsavel_id: 'b', colaboradores: ['a'] }, 'a')).toBe(true);
    expect(daPessoa({ responsavel_id: 'b', colaboradores: null }, 'a')).toBe(false);
  });
});
