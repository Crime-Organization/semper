// Regras da foto do perfil: o corte redondo (arrastar e aproximar, como foto de perfil de rede social) e o que vai
// ser gravado. Tudo puro, sem tela: a tela só desenha o que estas contas dizem.
import { FOTO_GRANDE } from '../dados/limites';

/** Até quanto a foto se aproxima, em relação ao menor corte (a foto inteira cobrindo o círculo). */
export const ZOOM_MAXIMO = 4;

/** Tamanho da imagem original, em pixels. */
export interface Medidas { largura: number; altura: number }
/** O corte: quanto aproximou (1 = o menor lado da foto inteiro no círculo) e o centro do corte, em pixels da foto. */
export interface Corte { zoom: number; x: number; y: number }
/** O quadrado da foto que vai para o círculo, em pixels da foto. */
export interface Recorte { x: number; y: number; lado: number }

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Lado do quadrado recortado: o menor lado da foto, dividido pelo zoom. */
export const ladoDoRecorte = (img: Medidas, zoom: number) => Math.min(img.largura, img.altura) / zoom;

/** O corte não sai da foto: zoom entre 1 e o máximo, e o quadrado sempre inteiro dentro dela. */
export function prender(c: Corte, img: Medidas): Corte {
  const zoom = entre(c.zoom, 1, ZOOM_MAXIMO), meio = ladoDoRecorte(img, zoom) / 2;
  return { zoom, x: entre(c.x, meio, img.largura - meio), y: entre(c.y, meio, img.altura - meio) };
}

/** Ao abrir a foto: sem aproximar, no centro. */
export const corteInicial = (img: Medidas): Corte => ({ zoom: 1, x: img.largura / 2, y: img.altura / 2 });

/**
 * Arrastar a foto na janela do corte: dx e dy são o quanto o ponteiro andou na tela, em pixels da janela (de lado
 * "janela"). A foto anda junto com o ponteiro, então o centro do corte vai para o lado contrário.
 */
export function arrastar(c: Corte, img: Medidas, dx: number, dy: number, janela: number): Corte {
  const pixelsDaFotoPorPixelDaTela = ladoDoRecorte(img, c.zoom) / janela;
  return prender({ ...c, x: c.x - dx * pixelsDaFotoPorPixelDaTela, y: c.y - dy * pixelsDaFotoPorPixelDaTela }, img);
}

/** Aproximar ou afastar mantendo o mesmo centro (e sem deixar o corte sair da foto). */
export const aproximar = (c: Corte, img: Medidas, zoom: number): Corte => prender({ ...c, zoom }, img);

/** O quadrado da foto que vai para o círculo. */
export function recorteDaFoto(c: Corte, img: Medidas): Recorte {
  const { zoom, x, y } = prender(c, img), lado = ladoDoRecorte(img, zoom);
  return { x: x - lado / 2, y: y - lado / 2, lado };
}

/**
 * Como a foto aparece na janela do corte (de lado "janela"): a escala e o deslocamento do canto da foto, para a tela
 * desenhar com transform. O recorte ocupa a janela inteira.
 */
export function naJanela(c: Corte, img: Medidas, janela: number) {
  const r = recorteDaFoto(c, img), escala = janela / r.lado;
  return { escala, x: 0 - r.x * escala, y: 0 - r.y * escala };
}

/** A foto tem menos pixels que a versão grande: no site, pode ficar sem nitidez (avisa, mas deixa usar). */
export const fotoPequena = (img: Medidas) => Math.min(img.largura, img.altura) < FOTO_GRANDE;

/** Os dois arquivos da foto, na pasta de cada pessoa: <escritório>/<usuário>/<lado>.avif. */
export const caminhoDaFoto = (escritorioId: string, perfilId: string, lado: number) => `${escritorioId}/${perfilId}/${lado}.avif`;
