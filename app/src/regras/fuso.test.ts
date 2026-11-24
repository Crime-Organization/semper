// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { diaNoEscritorio } from './fuso';

describe('Fuso do escritório', () => {
  it('dado um momento de madrugada em UTC, quando vira dia, então é o dia anterior no relógio de Brasília', () => {
    // Dado
    const momento = '2030-05-21T01:30:00Z';
    // Quando
    const dia = diaNoEscritorio(momento);
    // Então
    expect(dia).toBe('20/05/2030');
  });

  it('dado um momento à tarde em UTC, quando vira dia, então é o mesmo dia', () => {
    // Quando / Então
    expect(diaNoEscritorio('2030-05-20T15:00:00Z')).toBe('20/05/2030');
  });
});
