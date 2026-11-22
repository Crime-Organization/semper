// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { topoDaEscala } from './escalaDosGraficos';

describe('O topo do eixo das barras em pé', () => {
  it.each([
    // [maior valor, topo]: em centavos, as linhas caem em reais redondos
    [810037, 900000],   // R$ 8.100,37 → linhas em R$ 3 mil, 6 mil e 9 mil
    [320000, 450000],   // R$ 3.200,00 → R$ 1,5 mil, 3 mil e 4,5 mil
    [300000, 300000],   // já redondo: fica
    [7, 7.5],           // 7 → 2,5, 5 e 7,5
    [0.25, 0.3]         // frações: 0,1, 0,2 e 0,3
  ])('dado o maior valor %d e três linhas, quando a escala não é de contagem, então o topo é %d', (maior, topo) => {
    // Quando
    const t = topoDaEscala(maior, 3);
    // Então
    expect(t).toBeCloseTo(topo, 6);
    expect(t).toBeGreaterThanOrEqual(maior);
  });

  it.each([[1, 3], [2, 3], [4, 6], [7, 9], [9, 9]])('dada uma contagem com o maior valor %d, quando a escala é inteira, então o topo é %d (as linhas em números inteiros)', (maior, topo) => {
    // Então
    expect(topoDaEscala(maior, 3, true)).toBe(topo);
  });

  it.each([0, -5, Number.NaN])('dado um gráfico sem nada (maior valor %d), então a escala vai de 0 ao número de linhas', maior => {
    // Então
    expect(topoDaEscala(maior, 3)).toBe(3);
    expect(topoDaEscala(maior, 3, true)).toBe(3);
  });
});
