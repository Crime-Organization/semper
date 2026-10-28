// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataDaOrdem } from './ordem';

describe('Data que acompanha a ordem escolhida', () => {
  const item = { criado_em: '2026-10-12T15:00:00Z', atualizado_em: '2026-10-28T13:00:00Z' };
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-28T15:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it.each([['novos'], ['antigos']] as const)('quando a ordem é "%s", então o cartão mostra a data do cadastro', ordem => {
    // Quando
    const texto = dataDaOrdem(ordem, item);
    // Então
    expect(texto).toBe('Cadastro: 12/10/2026');
  });

  it('quando a ordem é "atualizados recentemente", então o cartão mostra há quanto tempo mudou', () => {
    // Quando
    const texto = dataDaOrdem('recentes', item);
    // Então
    expect(texto).toBe('Atualização: há 2 h');
  });

  it.each([['manual'], ['nome'], ['nome_desc']] as const)('quando a ordem é "%s", então o cartão não mostra data', ordem => {
    // Quando
    const texto = dataDaOrdem(ordem, item);
    // Então
    expect(texto).toBe('');
  });

  it('quando o item não tem a data da ordem, então o cartão não mostra data', () => {
    // Quando
    const texto = dataDaOrdem('novos', { atualizado_em: item.atualizado_em });
    // Então
    expect(texto).toBe('');
  });
});
