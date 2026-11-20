// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acompanharBarraDeRolagem, medirBarraDeRolagem, VARIAVEL_DA_BARRA } from './barraDeRolagem';

/** Quantos avisos de mudança de tamanho chegam juntos, ao arrastar a borda da janela. */
const AVISOS_SEGUIDOS = 5;
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
  vi.unstubAllGlobals();
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

  it('quando começa a acompanhar, então põe a medida na raiz, e a refaz no quadro seguinte à mudança de tamanho da janela (o zoom também)', async () => {
    // Dado
    simularBarra(15);
    // Quando
    const parar = acompanharBarraDeRolagem();
    // Então
    expect(naRaiz()).toBe('15px');
    // Quando: o zoom aumenta, e a barra fica menor em px da página
    trocarBarra(10);
    window.dispatchEvent(new Event('resize'));
    await proximoQuadro();
    // Então
    expect(naRaiz()).toBe('10px');
    // Quando: parou de acompanhar
    parar();
    trocarBarra(30);
    window.dispatchEvent(new Event('resize'));
    await proximoQuadro();
    // Então
    expect(naRaiz()).toBe('10px');
  });

  it('dados vários avisos de mudança de tamanho seguidos (arrastar a borda da janela), quando chegam, então mede uma vez só, no quadro seguinte', async () => {
    // Dado
    simularBarra(15);
    const parar = acompanharBarraDeRolagem();
    const medidas = vi.spyOn(document.body, 'append');
    // Quando
    for (let i = 0; i < AVISOS_SEGUIDOS; i++) window.dispatchEvent(new Event('resize'));
    // Então: nada antes do quadro
    expect(medidas).not.toHaveBeenCalled();
    await proximoQuadro();
    // E uma medida só depois dele
    expect(medidas).toHaveBeenCalledTimes(1);
    parar();
  });

  it('dada a barra trocada no sistema, fora do navegador (por cima ou ocupando espaço), quando a janela volta a ter o foco, então refaz a medida', async () => {
    // Dado
    simularBarra(0);
    const parar = acompanharBarraDeRolagem();
    trocarBarra(15);
    // Quando
    window.dispatchEvent(new Event('focus'));
    await proximoQuadro();
    // Então
    expect(naRaiz()).toBe('15px');
    parar();
  });

  it('dada a janela levada para um monitor de outra densidade, sem mudar de tamanho, quando a densidade muda, então refaz a medida e passa a ouvir a densidade nova', async () => {
    // Dado
    const consultas = simularDensidade();
    simularBarra(15);
    const parar = acompanharBarraDeRolagem();
    expect(consultas.map(c => c.media)).toEqual(['(resolution: 1dppx)']);
    // Quando
    trocarBarra(10);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.5 });
    consultas[0].avisar();
    await proximoQuadro();
    // Então
    expect(naRaiz()).toBe('10px');
    expect(consultas.map(c => c.media)).toEqual(['(resolution: 1dppx)', '(resolution: 1.5dppx)']);
    expect(consultas[0].ouvindo()).toBe(false);
    // Quando: parou de acompanhar
    parar();
    // Então
    expect(consultas[1].ouvindo()).toBe(false);
  });
});

/** Troca a barra simulada por outra largura. */
function trocarBarra(barra: number) {
  vi.restoreAllMocks();
  simularBarra(barra);
}
/** Espera o próximo quadro desenhado (quando a medida pedida é refeita). */
const proximoQuadro = () => new Promise(pronto => requestAnimationFrame(() => pronto(undefined)));

/** Uma consulta de mídia simulada: o texto dela, quem a ouve e o aviso de que mudou. */
interface ConsultaSimulada { media: string; avisar: () => void; ouvindo: () => boolean }
/** O jsdom não tem matchMedia: cada consulta feita fica guardada, para o teste avisar a mudança e ver quem ainda a ouve. */
function simularDensidade(): ConsultaSimulada[] {
  const consultas: ConsultaSimulada[] = [];
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  vi.stubGlobal('matchMedia', (media: string) => {
    const ouvintes = new Set<() => void>();
    consultas.push({ media, avisar: () => [...ouvintes].forEach(o => o()), ouvindo: () => ouvintes.size > 0 });
    return {
      media,
      addEventListener: (_: string, ouvinte: () => void) => ouvintes.add(ouvinte),
      removeEventListener: (_: string, ouvinte: () => void) => ouvintes.delete(ouvinte),
    } as unknown as MediaQueryList;
  });
  return consultas;
}
