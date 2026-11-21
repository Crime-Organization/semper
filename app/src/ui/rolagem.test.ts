// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it, vi } from 'vitest';
import { irAte, travarRolagem } from './rolagem';

const travada = () => document.body.classList.contains('sem-rolagem');

describe('Trava da rolagem da página', () => {
  it('quando uma janela trava e depois solta, então a página volta a rolar', () => {
    // Quando
    const soltar = travarRolagem();
    // Então
    expect(travada()).toBe(true);
    // Quando
    soltar();
    // Então
    expect(travada()).toBe(false);
  });

  it('dado o cartão aberto (uma trava), quando a busca abre por cima e fecha, então a página continua travada até o cartão fechar', () => {
    // Dado
    const soltarCartao = travarRolagem();
    // Quando
    const soltarBusca = travarRolagem();
    soltarBusca();
    // Então
    expect(travada()).toBe(true);
    // Quando
    soltarCartao();
    // Então
    expect(travada()).toBe(false);
  });

  it('dada uma trava solta duas vezes, quando outra trava continua de pé, então a página continua travada', () => {
    // Dado
    const soltarCartao = travarRolagem();
    const soltarBusca = travarRolagem();
    // Quando
    soltarBusca();
    soltarBusca();
    // Então
    expect(travada()).toBe(true);
    soltarCartao();
  });
});

describe('Ir até uma coisa da tela (#399)', () => {
  it('dada uma seção e o botão dela, quando a pessoa pede para ir até ela, então a seção rola para o alto, deslizando, e o foco vai ao botão sem outro pulo', () => {
    // Dado
    const secao = document.createElement('section'), botao = document.createElement('button');
    secao.append(botao);
    document.body.append(secao);
    const rolar = vi.fn();
    secao.scrollIntoView = rolar;
    const focar = vi.spyOn(botao, 'focus');
    // Quando
    irAte(secao, botao);
    // Então
    expect(rolar).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(focar).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(botao);
    secao.remove();
  });

  it('dado quem pediu ao sistema menos movimento, quando vai até uma data, então a tela pula direto para ela, no meio', () => {
    // Dado
    const antes = window.matchMedia;
    window.matchMedia = (q: string) => ({ matches: q.includes('reduce') }) as MediaQueryList;
    const data = document.createElement('span');
    const rolar = vi.fn();
    data.scrollIntoView = rolar;
    // Quando
    irAte(data, null, 'center');
    // Então
    expect(rolar).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
    window.matchMedia = antes;
  });

  it('dada uma coisa que não está na tela, quando a pessoa pede para ir até ela, então nada acontece', () => {
    // Então
    expect(() => irAte(null)).not.toThrow();
  });
});
