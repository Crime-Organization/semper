// A página por trás de uma janela ou de um painel não rola enquanto ele está aberto (classe "sem-rolagem" no body, em estilo.css).
// Peça comum de quem cobre a página (o painel do cartão, a busca geral): cada um pede a sua trava, e a página só volta a rolar
// quando a última for solta. Assim, fechar a busca aberta por cima de um cartão não solta a página por trás do cartão.

/** A classe do body que trava a rolagem (estilo.css). */
const CLASSE = 'sem-rolagem';
/** Quantas travas estão de pé. */
let travas = 0;

/** Trava a rolagem da página. Devolve a função que solta esta trava (chamar de novo não faz nada). */
export function travarRolagem() {
  travas++;
  document.body.classList.add(CLASSE);
  let solta = false;
  return () => {
    if (solta) return;
    solta = true;
    travas--;
    if (!travas) document.body.classList.remove(CLASSE);
  };
}

/**
 * Leva a pessoa até uma coisa da tela (#399: o "ver" do menu "Acrescentar ao cartão"): rola quem a contém até ela ficar no alto
 * (`onde`: 'start') ou no meio ('center') e põe o foco em `foco`, sem outro pulo. Desliza, a não ser para quem pediu ao sistema
 * menos movimento.
 */
export function irAte(alvo: HTMLElement | null | undefined, foco?: HTMLElement | null, onde: ScrollLogicalPosition = 'start') {
  if (!alvo) return;
  const semMovimento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  alvo.scrollIntoView?.({ block: onde, behavior: semMovimento ? 'auto' : 'smooth' });
  foco?.focus({ preventScroll: true });
}
