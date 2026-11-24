// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A ajuda de cada tela de módulo (#85) e das outras telas (#411): três ou quatro parágrafos curtos, iguais para todos os escritórios.
import { describe, expect, it } from 'vitest';
import { AJUDA, AJUDA_DAS_TELAS, LETRAS_DO_PARAGRAFO, PARAGRAFOS_DA_AJUDA, type AjudaDaTela, type ModuloComAjuda, type TelaComAjuda } from './ajuda';

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

describe('A ajuda das telas que não são de módulo (#411)', () => {
  const outras = Object.entries(AJUDA_DAS_TELAS) as [TelaComAjuda, AjudaDaTela][];

  it('dada cada tela, quando se lê a ajuda dela, então tem de três a quatro parágrafos, nenhum repetido', () => {
    // Quando
    const foraDaMedida = outras.filter(([, { textos }]) => textos.length < PARAGRAFOS_DA_AJUDA.minimo || textos.length > PARAGRAFOS_DA_AJUDA.maximo
      || new Set(textos).size !== textos.length).map(([tela]) => tela);
    // Então
    expect(foraDaMedida).toEqual([]);
  });

  it('dado cada parágrafo, quando se lê, então é curto, começa com maiúscula e termina com ponto', () => {
    // Quando
    const errados = outras.flatMap(([tela, { textos }]) => textos
      .filter(p => p.length > LETRAS_DO_PARAGRAFO || !/^[A-ZÀ-Ú]/.test(p) || !p.endsWith('.'))
      .map(p => `${tela}: ${p}`));
    // Então
    expect(errados).toEqual([]);
  });

  it('dadas as telas, quando se leem os títulos das janelas, então nenhum fica vazio nem se repete, nem com os das telas de módulo', () => {
    // Dado: os títulos das páginas de módulo que poderiam se confundir com os destas telas
    const dosModulos = ['Pessoas', 'Contratos', 'Demandas', 'Tarefas', 'Agenda', 'Documentos'];
    // Quando
    const titulos = outras.map(([, { titulo }]) => titulo);
    // Então
    expect(titulos.every(t => t.trim())).toBe(true);
    expect(new Set(titulos).size).toBe(titulos.length);
    expect(titulos.filter(t => dosModulos.includes(t))).toEqual([]);
  });
});
