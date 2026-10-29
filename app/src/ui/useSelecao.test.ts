// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSelecao } from './useSelecao';

describe('Seleção da tabela', () => {
  it('quando itens são marcados, então ficam na seleção e são contados', () => {
    // Dado
    const { result } = renderHook(() => useSelecao());
    // Quando
    act(() => result.current.marcar(['a', 'b'], true));
    // Então
    expect([...result.current.selecionadas]).toEqual(['a', 'b']);
    expect(result.current.quantas).toBe(2);
  });

  it('quando um item é desmarcado, então só ele sai da seleção', () => {
    // Dado
    const { result } = renderHook(() => useSelecao());
    act(() => result.current.marcar(['a', 'b', 'c'], true));
    // Quando
    act(() => result.current.marcar(['b'], false));
    // Então
    expect([...result.current.selecionadas]).toEqual(['a', 'c']);
  });

  it('quando a seleção é limpa, então nada fica marcado', () => {
    // Dado
    const { result } = renderHook(() => useSelecao());
    act(() => result.current.marcar(['a'], true));
    // Quando
    act(() => result.current.limpar());
    // Então
    expect(result.current.quantas).toBe(0);
  });
});
