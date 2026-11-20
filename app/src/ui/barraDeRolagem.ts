// A largura da barra de rolagem deste navegador, na variável --barra-de-rolagem da raiz (estilo.css), #381.
// As áreas que rolam guardam o lugar da barra (scrollbar-gutter), e esse lugar empurra o conteúdo delas para dentro: no Windows,
// uns 15px; no Mac e no celular, nada (a barra passa por cima). Os botões da janela do cartão ficam fora de quem rola e não sofrem
// esse empurrão. Com a medida, o CSS põe o X, o "Expandir tudo" e as setas das seções num eixo só, em qualquer computador.
// A barra muda de largura em px da página com o zoom (que dispara o "resize"), ao levar a janela para um monitor de outra densidade
// (muda a densidade de pixels, às vezes sem "resize") e quando a pessoa troca, no sistema, a barra por cima pela que ocupa espaço
// (o que se faz fora do navegador: a medida se refaz quando a janela volta a ter o foco). Vários avisos seguidos viram uma medida só,
// no próximo quadro desenhado.

/** O nome da variável na raiz da página. */
export const VARIAVEL_DA_BARRA = '--barra-de-rolagem';

/**
 * Mede o lugar que as áreas que rolam guardam para a barra (o mesmo scrollbar-gutter delas), com uma caixa de teste invisível: a
 * largura da caixa menos a do que cabe dentro dela. É esse lugar que empurra o conteúdo, e não a barra desenhada: no Chrome sem
 * janela dos testes, a barra some, mas o lugar dela continua guardado.
 * As duas medidas vêm com fração de px (getBoundingClientRect), para o zoom (110%, 125%…) não arredondar o eixo.
 */
export function medirBarraDeRolagem(documento: Document = document): number {
  const caixa = documento.createElement('div');
  Object.assign(caixa.style, { position: 'fixed', top: '0', left: '0', width: '100%', visibility: 'hidden', overflowY: 'hidden', scrollbarGutter: 'stable', pointerEvents: 'none' });
  const dentro = documento.createElement('div');
  caixa.append(dentro);
  documento.body.append(caixa);
  const largura = caixa.getBoundingClientRect().width - dentro.getBoundingClientRect().width;
  caixa.remove();
  return Math.max(0, largura);
}

/**
 * Chama `aoMudar` quando a densidade de pixels da tela muda (outro monitor, zoom). A consulta leva a densidade de agora; depois de
 * cada mudança, passa a ouvir a nova. Sem matchMedia (fora do navegador), não faz nada. Devolve a função que para.
 */
function acompanharDensidade(janela: Window, aoMudar: () => void): () => void {
  let consulta: MediaQueryList | undefined;
  const mudou = () => { aoMudar(); ouvir(); };
  function ouvir() {
    consulta?.removeEventListener('change', mudou);
    consulta = janela.matchMedia?.(`(resolution: ${janela.devicePixelRatio}dppx)`);
    consulta?.addEventListener('change', mudou);
  }
  ouvir();
  return () => consulta?.removeEventListener('change', mudou);
}

/** Os avisos da janela que refazem a medida (veja o alto do arquivo). */
const AVISOS_QUE_REFAZEM = ['resize', 'focus'] as const;

/**
 * Põe a medida na raiz agora e de novo a cada aviso que pode mudar a barra (o tamanho da janela e o zoom, a densidade da tela, a
 * volta do foco), uma vez por quadro desenhado. Devolve a função que para.
 */
export function acompanharBarraDeRolagem(janela: Window = window): () => void {
  const documento = janela.document;
  const aplicar = () => documento.documentElement.style.setProperty(VARIAVEL_DA_BARRA, `${medirBarraDeRolagem(documento)}px`);
  let pedido: number | undefined;
  const pedir = () => {
    if (pedido !== undefined) return;
    pedido = janela.requestAnimationFrame(() => { pedido = undefined; aplicar(); });
  };
  aplicar();
  for (const aviso of AVISOS_QUE_REFAZEM) janela.addEventListener(aviso, pedir);
  const pararDensidade = acompanharDensidade(janela, pedir);
  return () => {
    for (const aviso of AVISOS_QUE_REFAZEM) janela.removeEventListener(aviso, pedir);
    pararDensidade();
    if (pedido !== undefined) janela.cancelAnimationFrame(pedido);
    pedido = undefined;
  };
}
