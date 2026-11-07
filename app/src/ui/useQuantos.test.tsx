// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLista, useQuantos } from './useQuantos';

describe('A lista de uma seção do cartão', () => {
  it('dado uma leitura que dá certo, quando o cartão abre, então traz a lista e quantos são', async () => {
    // Quando
    const { result } = renderHook(() => ({ lista: useLista(async () => ['a', 'b'], 'k1'), quantos: useQuantos(async () => ['a', 'b', 'c'], 'k1') }));
    // Então
    await waitFor(() => expect(result.current.quantos).toBe(3));
    expect(result.current.lista).toEqual(['a', 'b']);
  });

  it('dado uma leitura que falha, quando o cartão abre, então não há número', async () => {
    // Quando
    const { result } = renderHook(() => useQuantos(() => Promise.reject(new Error('sem rede')), 'k1'));
    // Então
    await waitFor(() => expect(result.current).toBeUndefined());
  });

  it('dado a seção desligada (módulo fora do escritório), quando o cartão abre, então nada é lido', async () => {
    // Dado
    const carregar = vi.fn(async () => ['a']);
    // Quando
    const { result } = renderHook(() => useQuantos(carregar, 'k1', false));
    // Então
    await Promise.resolve();
    expect(carregar).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it('dado uma chave nova (outro cartão ou algo mudou), quando muda, então lê de novo', async () => {
    // Dado
    let vez = 0;
    const carregar = vi.fn(async () => Array.from({ length: ++vez }, () => 'x'));
    const { result, rerender } = renderHook(({ chave }) => useQuantos(carregar, chave), { initialProps: { chave: 'k1' } });
    await waitFor(() => expect(result.current).toBe(1));
    // Quando
    rerender({ chave: 'k2' });
    // Então
    await waitFor(() => expect(result.current).toBe(2));
    expect(carregar).toHaveBeenCalledTimes(2);
  });
});
