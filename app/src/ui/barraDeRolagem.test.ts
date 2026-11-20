// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acompanharBarraDeRolagem, medirBarraDeRolagem, VARIAVEL_DA_BARRA } from './barraDeRolagem';

/** Largura da caixa de teste (a janela toda, nesta simulação). */
const LARGURA_DA_CAIXA = 1440;
/** O jsdom não desenha nada: a caixa de teste (a filha do body) mede LARGURA_DA_CAIXA, e o que cabe dentro dela, menos a barra. */
function simularBarra(barra: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const largura = this.parentElement === document.body ? LARGURA_DA_CAIXA : LARGURA_DA_CAIXA - barra;
    return { width: largura } as DOMRect;
  });
}
const naRaiz = () => document.documentElement.style.getPropertyValue(VARIAVEL_DA_BARRA);

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty(VARIAVEL_DA_BARRA);
});

describe('Largura da barra de rolagem', () => {
  it('dado um navegador em que a barra ocupa 15px (Windows), quando mede, então devolve 15 e não deixa a caixa de teste na página', () => {
    // Dado
    simularBarra(15);
    // Quando
    const barra = medirBarraDeRolagem();
    // Então
    expect(barra).toBe(15);
    expect(document.body.children).toHaveLength(0);
  });

  it('dado o zoom em 110% (a barra com fração de px), quando mede, então a fração não se perde', () => {
    // Dado
    simularBarra(13.625);
    // Quando / Então
    expect(medirBarraDeRolagem()).toBe(13.625);
  });

  it('dada a barra por cima do conteúdo (Mac, celular), quando mede, então devolve 0', () => {
    // Dado
    simularBarra(0);
    // Quando / Então
    expect(medirBarraDeRolagem()).toBe(0);
  });

  it('quando começa a acompanhar, então põe a medida na raiz, e a refaz quando a janela muda de tamanho (o zoom também)', () => {
    // Dado
    simularBarra(15);
    // Quando
    const parar = acompanharBarraDeRolagem();
    // Então
    expect(naRaiz()).toBe('15px');
    // Quando: o zoom aumenta, e a barra fica menor em px da página
    vi.restoreAllMocks();
    simularBarra(10);
    window.dispatchEvent(new Event('resize'));
    // Então
    expect(naRaiz()).toBe('10px');
    // Quando: parou de acompanhar
    parar();
    vi.restoreAllMocks();
    simularBarra(30);
    window.dispatchEvent(new Event('resize'));
    // Então
    expect(naRaiz()).toBe('10px');
  });
});
