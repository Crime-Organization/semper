// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O fuso vem da configuração (vite.config.ts), não do comando: o "TZ=" do comando não funciona no Windows. A rotina do GitHub roda em UTC,
// então este teste falha lá se a configuração sair.
import { describe, expect, it } from 'vitest';

describe('Fuso dos testes', () => {
  it('quando os testes rodam, em qualquer computador, então o fuso é o de Brasília', () => {
    // Quando
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Então
    expect(fuso).toBe('America/Sao_Paulo');
  });

  it('dado meio-dia em UTC, quando lê a hora local, então são 9 horas', () => {
    // Dado
    const meioDia = new Date('2026-07-01T12:00:00Z');
    // Quando / Então
    expect(meioDia.getHours()).toBe(9);
  });
});
