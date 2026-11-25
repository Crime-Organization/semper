// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { diaNoEscritorio, horaNoEscritorio, isoNoEscritorio } from './fuso';

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

  it('dado um momento perto da meia-noite em UTC, quando vira dia aaaa-mm-dd, então é o dia do relógio de Brasília (#442)', () => {
    // Dado: 00:30 em UTC é 21:30 do dia anterior em Brasília
    const momento = '2026-11-27T00:30:00Z';
    // Quando
    const dia = isoNoEscritorio(momento);
    // Então
    expect(dia).toBe('2026-11-26');
    expect(isoNoEscritorio('2026-11-27T03:30:00Z')).toBe('2026-11-27');
  });

  it('dado um momento em UTC, quando vira hora, então é a hora do relógio de Brasília, com dois dígitos (#442)', () => {
    // Quando / Então
    expect(horaNoEscritorio('2026-11-25T17:10:00Z')).toBe('14:10');
    expect(horaNoEscritorio('2026-11-25T03:05:00Z')).toBe('00:05');
  });
});
