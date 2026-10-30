// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataCurta, dataHora, hojeISO, numero, relativo } from './util';

describe('Datas na tela', () => {
  it('quando a data vem do banco, então aparece como dia/mês/ano no fuso de Brasília', () => {
    // Quando
    const mostrada = dataCurta('2026-10-28T01:00:00Z');
    // Então
    expect(mostrada).toBe('27/10/2026');
  });

  it('quando a data tem horário, então aparece com dia e hora no fuso de Brasília', () => {
    // Quando
    const mostrada = dataHora('2026-10-28T13:45:00Z');
    // Então
    expect(mostrada).toBe('28/10/2026, 10:45');
  });

  it('quando se pede o dia de hoje, então vem como o banco guarda as datas, no fuso de quem usa', () => {
    // Quando (23h de 28/10 em Brasília já é 29/10 em UTC)
    const hoje = hojeISO(new Date('2026-10-29T02:00:00Z'));
    // Então
    expect(hoje).toBe('2026-10-28');
  });

  it.each([[null], [undefined], ['']])('quando não há data (%j), então não aparece nada', vazia => {
    // Quando
    const mostradas = [dataCurta(vazia), dataHora(vazia), relativo(vazia)];
    // Então
    expect(mostradas).toEqual(['', '', '']);
  });
});

describe('Tempo desde uma ação', () => {
  describe('Dado que agora são 28/10/2026, 12:00 em Brasília', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T15:00:00Z')); });
    afterEach(() => { vi.useRealTimers(); });

    it.each([
      ['30 segundos', '2026-10-28T14:59:30Z', 'agora'],
      ['5 minutos', '2026-10-28T14:55:00Z', 'há 5 min'],
      ['3 horas', '2026-10-28T12:00:00Z', 'há 3 h'],
      ['1 dia', '2026-10-27T15:00:00Z', 'ontem'],
      ['4 dias', '2026-10-24T15:00:00Z', 'há 4 dias']
    ])('quando a ação foi há %s, então aparece "%s"', (_tempo, quando, esperado) => {
      // Quando
      const texto = relativo(quando);
      // Então
      expect(texto).toBe(esperado);
    });

    it('quando a ação foi há mais de uma semana, então aparece a data', () => {
      // Quando
      const texto = relativo('2026-08-10T15:00:00Z');
      // Então
      expect(texto).toBe('10/08/2026');
    });
  });
});

describe('Números na tela', () => {
  it('quando o número é grande e tem decimais, então usa ponto nos milhares e vírgula nos decimais', () => {
    // Quando
    const mostrado = numero(1234567.5);
    // Então
    expect(mostrado).toBe('1.234.567,5');
  });
});
