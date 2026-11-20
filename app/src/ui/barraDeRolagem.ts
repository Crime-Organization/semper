// A largura da barra de rolagem deste navegador, na variável --barra-de-rolagem da raiz (estilo.css), #381.
// As áreas que rolam guardam o lugar da barra (scrollbar-gutter), e esse lugar empurra o conteúdo delas para dentro: no Windows,
// uns 15px; no Mac e no celular, nada (a barra passa por cima). Os botões da janela do cartão ficam fora de quem rola e não sofrem
// esse empurrão. Com a medida, o CSS põe o X, o "Expandir tudo" e as setas das seções num eixo só, em qualquer computador.
// O zoom do navegador muda a largura da barra em px da página (e dispara o "resize"): a medida se refaz a cada um.

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

/** Põe a medida na raiz agora e de novo a cada mudança do tamanho da janela (o zoom também). Devolve a função que para. */
export function acompanharBarraDeRolagem(janela: Window = window): () => void {
  const documento = janela.document;
  const aplicar = () => documento.documentElement.style.setProperty(VARIAVEL_DA_BARRA, `${medirBarraDeRolagem(documento)}px`);
  aplicar();
  janela.addEventListener('resize', aplicar);
  return () => janela.removeEventListener('resize', aplicar);
}
