// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { aproximar, arrastar, caminhoDaFoto, corteInicial, fotoPequena, naJanela, prender, recorteDaFoto, ZOOM_MAXIMO } from './foto';

// Uma foto deitada, de 2000 por 1000 pixels, numa janela de corte de 250 pixels.
const DEITADA = { largura: 2000, altura: 1000 };
const JANELA = 250;

describe('Corte redondo da foto', () => {
  it('quando a foto abre, então o corte pega o maior quadrado possível, no centro', () => {
    // Quando
    const recorte = recorteDaFoto(corteInicial(DEITADA), DEITADA);
    // Então
    expect(recorte).toEqual({ x: 500, y: 0, lado: 1000 });
  });

  it('quando a pessoa arrasta a foto para a direita, então o corte vai para a esquerda da foto', () => {
    // Quando: 50 pixels na tela valem 200 pixels da foto (1000 de foto em 250 de tela)
    const corte = arrastar(corteInicial(DEITADA), DEITADA, 50, 0, JANELA);
    // Então
    expect(recorteDaFoto(corte, DEITADA)).toEqual({ x: 300, y: 0, lado: 1000 });
  });

  it('quando a pessoa arrasta além da borda, então o corte para na borda da foto', () => {
    // Quando
    const corte = arrastar(corteInicial(DEITADA), DEITADA, 5000, 5000, JANELA);
    // Então
    expect(recorteDaFoto(corte, DEITADA)).toEqual({ x: 0, y: 0, lado: 1000 });
  });

  it('quando a pessoa aproxima o dobro, então o quadrado fica com a metade do lado, no mesmo centro', () => {
    // Quando
    const corte = aproximar(corteInicial(DEITADA), DEITADA, 2);
    // Então
    expect(recorteDaFoto(corte, DEITADA)).toEqual({ x: 750, y: 250, lado: 500 });
  });

  it('quando o zoom passa dos limites, então fica entre 1 e o máximo', () => {
    // Quando / Então
    expect(prender({ ...corteInicial(DEITADA), zoom: 0.2 }, DEITADA).zoom).toBe(1);
    expect(prender({ ...corteInicial(DEITADA), zoom: 99 }, DEITADA).zoom).toBe(ZOOM_MAXIMO);
  });

  it('quando a pessoa afasta perto da borda, então o corte volta para dentro da foto', () => {
    // Dado: aproximado e encostado no canto esquerdo de cima
    const noCanto = arrastar(aproximar(corteInicial(DEITADA), DEITADA, 2), DEITADA, 5000, 5000, JANELA);
    // Quando
    const corte = aproximar(noCanto, DEITADA, 1);
    // Então
    expect(recorteDaFoto(corte, DEITADA)).toEqual({ x: 0, y: 0, lado: 1000 });
  });

  it('quando a tela desenha o corte, então o recorte ocupa a janela inteira', () => {
    // Quando
    const desenho = naJanela(corteInicial(DEITADA), DEITADA, JANELA);
    // Então: 1000 pixels de foto em 250 de tela, com o canto do recorte (500, 0) no canto da janela
    expect(desenho).toEqual({ escala: 0.25, x: -125, y: 0 });
  });

  it('quando a foto tem menos de 1000 pixels no menor lado, então ela é pequena para o site', () => {
    // Quando / Então
    expect(fotoPequena({ largura: 3000, altura: 900 })).toBe(true);
    expect(fotoPequena({ largura: 1200, altura: 1000 })).toBe(false);
  });

  it('quando se monta o caminho da foto, então vai na pasta do escritório e da pessoa, com o lado no nome', () => {
    // Quando / Então
    expect(caminhoDaFoto('esc-1', 'u-ana', 150)).toBe('esc-1/u-ana/150.avif');
  });
});
