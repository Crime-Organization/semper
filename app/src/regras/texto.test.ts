// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { normal, sugestoesQueCombinam } from './texto';

describe('Busca sem acento', () => {
  it.each([
    ['  José da Conceição ', 'jose da conceicao'],
    ['ÁGUA', 'agua'],
    [null, ''],
    [42, '42']
  ])('quando o texto é %j, então a forma comparável é "%s"', (texto, esperado) => {
    // Quando
    const comparavel = normal(texto);
    // Então
    expect(comparavel).toBe(esperado);
  });
});

describe('Sugestões enquanto se digita', () => {
  const OBJETOS = ['Ação de cobrança', 'Ação de indenização por danos morais', 'Busca de anterioridade', 'Revisão de cobrança', 'Divórcio consensual']
    .map(valor => ({ valor }));
  const valores = (lista: { valor: string }[]) => lista.map(s => s.valor);

  it('quando a pessoa digita parte do texto, sem acento, então vêm primeiro as que começam por ele e depois as que o contêm', () => {
    // Quando
    const achadas = sugestoesQueCombinam('cobranca', OBJETOS, 8);
    const porInicio = sugestoesQueCombinam('acao', OBJETOS, 8);
    // Então
    expect(valores(achadas)).toEqual(['Ação de cobrança', 'Revisão de cobrança']);
    expect(valores(porInicio)).toEqual(['Ação de cobrança', 'Ação de indenização por danos morais']);
  });

  it('quando o texto já é igual a uma sugestão, então ela não aparece de novo', () => {
    // Quando
    const achadas = sugestoesQueCombinam('ação de cobrança', OBJETOS, 8);
    // Então
    expect(valores(achadas)).toEqual([]);
  });

  it('quando o campo está vazio, então vêm as primeiras sugestões, até o limite', () => {
    // Quando
    const achadas = sugestoesQueCombinam('', OBJETOS, 2);
    // Então
    expect(valores(achadas)).toEqual(['Ação de cobrança', 'Ação de indenização por danos morais']);
  });
});
