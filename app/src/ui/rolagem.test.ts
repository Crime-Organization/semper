// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { travarRolagem } from './rolagem';

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
