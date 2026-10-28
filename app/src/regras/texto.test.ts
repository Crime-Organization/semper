// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { normal } from './texto';

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
