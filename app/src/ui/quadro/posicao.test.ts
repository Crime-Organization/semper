// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ordemNoFim } from './posicao';

describe('Posição no fim da ordem manual', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('quando um cartão entra depois de outro, então fica depois dele', () => {
    // Dado
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const primeiro = ordemNoFim();
    vi.setSystemTime(new Date('2026-10-28T12:00:01Z'));
    // Quando
    const segundo = ordemNoFim();
    // Então
    expect(segundo).toBeGreaterThan(primeiro);
  });

  it('quando a coluna já tem cartões arrastados (ordem 1, 2, 3…), então o novo fica depois de todos', () => {
    // Quando
    const novo = ordemNoFim();
    // Então
    expect(novo).toBeGreaterThan(1_000_000);
  });
});
