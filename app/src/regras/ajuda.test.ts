// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A ajuda de cada tela de módulo (#85): três ou quatro parágrafos curtos, iguais para todos os escritórios.
import { describe, expect, it } from 'vitest';
import { AJUDA, LETRAS_DO_PARAGRAFO, PARAGRAFOS_DA_AJUDA, type ModuloComAjuda } from './ajuda';

const telas = Object.entries(AJUDA) as [ModuloComAjuda, readonly string[]][];

describe('A ajuda de cada tela de módulo (#85)', () => {
  it('dada cada tela, quando se lê a ajuda dela, então tem de três a quatro parágrafos', () => {
    // Quando
    const foraDaMedida = telas.filter(([, paragrafos]) => paragrafos.length < PARAGRAFOS_DA_AJUDA.minimo || paragrafos.length > PARAGRAFOS_DA_AJUDA.maximo)
      .map(([tela]) => tela);
    // Então
    expect(foraDaMedida).toEqual([]);
  });

  it('dado cada parágrafo, quando se lê, então é curto, começa com maiúscula e termina com ponto', () => {
    // Quando
    const errados = telas.flatMap(([tela, paragrafos]) => paragrafos
      .filter(p => p.length > LETRAS_DO_PARAGRAFO || !/^[A-ZÀ-Ú]/.test(p) || !p.endsWith('.'))
      .map(p => `${tela}: ${p}`));
    // Então
    expect(errados).toEqual([]);
  });

  it('dada cada tela, quando se lê a ajuda dela, então nenhum parágrafo se repete', () => {
    // Quando
    const comRepetido = telas.filter(([, paragrafos]) => new Set(paragrafos).size !== paragrafos.length).map(([tela]) => tela);
    // Então
    expect(comRepetido).toEqual([]);
  });
});
