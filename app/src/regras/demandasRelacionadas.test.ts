// Regras das demandas relacionadas (#310). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { foraDaBuscaDeRelacionadas, outraDaRelacao, parDaRelacao, refazALigacao, type LinhaDaRelacao } from './demandasRelacionadas';

const linha: LinhaDaRelacao<{ titulo: string }> = { demanda_a: 'd1', demanda_b: 'd2', codigo_a: 'A1', codigo_b: 'B2', a: { titulo: 'Primeira' }, b: null };

describe('O par de uma ligação', () => {
  it('dadas duas demandas, quando se forma o par em qualquer sentido, então ele sai sempre na mesma ordem', () => {
    // Dado / Quando / Então
    expect(parDaRelacao('d2', 'd1')).toEqual(['d1', 'd2']);
    expect(parDaRelacao('d1', 'd2')).toEqual(['d1', 'd2']);
  });
});

describe('A outra demanda da ligação', () => {
  it('dada uma ligação, quando vista do cartão da primeira, então mostra a segunda, sem conteúdo se quem lê não a vê', () => {
    // Dado / Quando / Então
    expect(outraDaRelacao(linha, 'd1')).toEqual({ id: 'd2', codigo: 'B2', demanda: null });
  });

  it('dada a mesma ligação, quando vista do cartão da segunda, então mostra a primeira, com o conteúdo', () => {
    // Dado / Quando / Então
    expect(outraDaRelacao(linha, 'd2')).toEqual({ id: 'd1', codigo: 'A1', demanda: { titulo: 'Primeira' } });
  });
});

describe('A busca para ligar', () => {
  it('dada uma demanda com relacionadas, quando a busca abre, então deixa de fora a própria demanda e as já relacionadas', () => {
    // Dado / Quando / Então
    expect(foraDaBuscaDeRelacionadas('d1', [{ id: 'd2' }, { id: 'd3' }])).toEqual(['d1', 'd2', 'd3']);
  });
});

describe('O Desfazer depois de desfazer a ligação', () => {
  it('dada a outra demanda visível e ativa, quando a ligação é desfeita, então o aviso oferece refazê-la', () => {
    // Dado / Quando / Então
    expect(refazALigacao({ id: 'd2', codigo: 'B2', demanda: { arquivado_em: null } })).toBe(true);
  });

  it('dada a outra demanda arquivada, ou que quem desfaz não vê, quando a ligação é desfeita, então o aviso sai sem refazer', () => {
    // Dado / Quando / Então
    expect(refazALigacao({ id: 'd2', codigo: 'B2', demanda: { arquivado_em: '2026-11-22T10:00:00Z' } })).toBe(false);
    expect(refazALigacao({ id: 'd3', codigo: 'C3', demanda: null })).toBe(false);
  });
});
