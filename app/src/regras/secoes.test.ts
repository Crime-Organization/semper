// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { quantosPreenchidos } from './secoes';

describe('Quantos campos de uma seção estão preenchidos', () => {
  it('dado campos vazios, com traço e preenchidos, quando conta, então só os preenchidos entram', () => {
    // Então
    expect(quantosPreenchidos(['JOSÉ', '', '—', null, undefined, '  ', 0, 'Belo Horizonte'])).toBe(3);
  });
});
