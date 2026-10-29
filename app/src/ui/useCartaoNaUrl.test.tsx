// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useCartaoNaUrl } from './useCartaoNaUrl';

function montar(endereco: string) {
  const naUrl = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[endereco]}>{children}</MemoryRouter>;
  return renderHook(() => ({ cartao: useCartaoNaUrl(), local: useLocation() }), { wrapper: naUrl });
}

describe('Cartão aberto na URL', () => {
  it('quando o endereço traz ?id=, então esse é o cartão aberto', () => {
    // Quando
    const { result } = montar('/contratos/?id=k1');
    // Então
    expect(result.current.cartao.aberto).toBe('k1');
  });

  it('quando um cartão é aberto, então o id vai para o endereço', () => {
    // Dado
    const { result } = montar('/contratos/');
    // Quando
    act(() => result.current.cartao.abrir('k2'));
    // Então
    expect(result.current.cartao.aberto).toBe('k2');
    expect(result.current.local.search).toBe('?id=k2');
  });

  it('quando o cartão é fechado, então o endereço fica sem id', () => {
    // Dado
    const { result } = montar('/pessoas/?id=p1');
    // Quando
    act(() => result.current.cartao.fechar());
    // Então
    expect(result.current.cartao.aberto).toBeNull();
    expect(result.current.local.search).toBe('');
  });
});
