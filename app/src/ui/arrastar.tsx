// Arrastar um item e soltá-lo num alvo (#370: a anotação numa pasta do explorador de Documentos), com o mouse e com o dedo.
// Vai pelos eventos de ponteiro, e não pelo arrastar nativo do navegador, que não funciona com o dedo em todos os celulares:
// - com o mouse, o arrasto começa quando ele anda um pouco com o botão apertado (menos que isso é um clique comum);
// - com o dedo, ao segurar parado um instante (SEGURAR_PARA_ARRASTAR); antes disso, mexer o dedo rola a lista, como sempre.
// Os alvos são os elementos com o atributo ATRIBUTO_DO_ALVO, e quem usa diz quais aceitam o item (o que não aceita nem se
// destaca). Perto da borda da lista que rola, o arrasto a rola. Esc desiste. O arrasto não tem teclado: quem usa oferece o mesmo
// por um menu (na anotação, "Mover para pasta").
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as EventoDoPonteiro, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SEGURAR_PARA_ARRASTAR } from './tempos';

/** O atributo que marca um alvo do arrasto; o valor é a chave do alvo, que quem usa recebe ao soltar. */
export const ATRIBUTO_DO_ALVO = 'data-alvo-do-arrasto';
/** Quantos pixels o mouse anda, com o botão apertado, para virar arrasto (menos que isso é clique). */
const DISTANCIA_PARA_ARRASTAR = 5;
/** Quantos pixels o dedo pode tremer enquanto segura; mais que isso é rolar a lista, e o arrasto não começa. */
const TREMOR_DO_DEDO = 10;
/** A esta distância da borda de cima ou de baixo da lista que rola, o arrasto a rola, para alcançar o que está fora da vista. */
const BORDA_QUE_ROLA = 40;
/** Quantos pixels a lista rola a cada movimento perto da borda. */
const PASSO_DA_ROLAGEM = 12;

/** O arrasto em andamento: o item, onde está o ponteiro e o alvo aceito embaixo dele (null: nenhum). */
export interface Arrasto { id: string; x: number; y: number; alvo: string | null }

interface Regras {
  /** Se o alvo aceita o item (ex.: a pasta em que a anotação já está não aceita). */
  aceita: (id: string, alvo: string) => boolean;
  /** O item foi solto num alvo que o aceita. */
  aoSoltar: (id: string, alvo: string) => void;
}

/** A lista que rola em volta do elemento (a árvore, ou a gaveta no celular), para o arrasto rolá-la perto da borda. */
function listaQueRola(el: HTMLElement | null): HTMLElement | null {
  for (let atual = el?.parentElement; atual; atual = atual.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(atual).overflowY) && atual.scrollHeight > atual.clientHeight) return atual;
  }
  return null;
}

function rolarNaBorda(lista: HTMLElement | null, y: number) {
  if (!lista) return;
  const { top, bottom } = lista.getBoundingClientRect();
  if (y < top + BORDA_QUE_ROLA) lista.scrollTop -= PASSO_DA_ROLAGEM;
  else if (y > bottom - BORDA_QUE_ROLA) lista.scrollTop += PASSO_DA_ROLAGEM;
}

/** Depois de um arrasto com o mouse, o clique que o navegador manda ao soltar não abre o item que foi arrastado. */
function engolirOClique() {
  const parar = () => window.removeEventListener('click', engolir, true);
  function engolir(e: MouseEvent) { e.preventDefault(); e.stopPropagation(); parar(); }
  window.addEventListener('click', engolir, true);
  // Sem clique (o dedo, depois de segurar, não manda), a escuta sai logo depois.
  setTimeout(parar, 0);
}

/**
 * O arrasto: `arrasto` (null: nenhum) e `alca(id)`, as propriedades do elemento que se arrasta (o item). Ele deixa de ser
 * arrastável pelo navegador (o link arrastaria o endereço), e o arrasto é todo daqui.
 */
export function useArrastar(regras: Regras) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const atuais = useRef(regras);
  useEffect(() => { atuais.current = regras; });
  /** Encerra o arrasto (ou a pressão que ainda não virou arrasto); nada a encerrar: não faz nada. */
  const encerrar = useRef<(() => void) | null>(null);
  useEffect(() => () => encerrar.current?.(), []);
  /** Se o arrasto já começou (o dedo segurou, ou o mouse andou): só então mexer o dedo deixa de rolar a página. */
  const arrastando = useRef(false);
  /**
   * Arrastando com o dedo, mexê-lo leva o item, e não rola a página. A escuta fica no próprio item desde que ele aparece, e não
   * só depois de o toque começar: o Safari do iPhone decide, no começo do toque, se ele pode ser impedido de rolar, pelas escutas
   * que já existem ali; uma escuta posta no meio do toque não impediria nada. Fora do arrasto, ela não faz nada (a lista rola).
   */
  const prenderAoToque = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const segurarARolagem = (ev: TouchEvent) => { if (arrastando.current && ev.cancelable) ev.preventDefault(); };
    el.addEventListener('touchmove', segurarARolagem, { passive: false });
    return () => el.removeEventListener('touchmove', segurarARolagem);
  }, []);

  function comecar(e: EventoDoPonteiro<HTMLElement>, id: string) {
    if (!e.isPrimary || e.button !== 0 || encerrar.current) return;
    const dedo = e.pointerType === 'touch';
    const inicio = { x: e.clientX, y: e.clientY, ponteiro: e.pointerId };
    const lista = listaQueRola(e.currentTarget);
    let ativo = false;
    const alvoEm = (x: number, y: number) => {
      const alvo = document.elementFromPoint(x, y)?.closest(`[${ATRIBUTO_DO_ALVO}]`)?.getAttribute(ATRIBUTO_DO_ALVO) ?? null;
      return alvo !== null && atuais.current.aceita(id, alvo) ? alvo : null;
    };
    const mostrar = (x: number, y: number) => setArrasto({ id, x, y, alvo: alvoEm(x, y) });
    const ativar = (x: number, y: number) => { ativo = arrastando.current = true; mostrar(x, y); };
    const espera = dedo ? setTimeout(() => ativar(inicio.x, inicio.y), SEGURAR_PARA_ARRASTAR) : undefined;

    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== inicio.ponteiro) return;
      const andou = Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y);
      if (!ativo && dedo) { if (andou > TREMOR_DO_DEDO) fim(); return; }
      if (!ativo && andou < DISTANCIA_PARA_ARRASTAR) return;
      ativo = arrastando.current = true;
      rolarNaBorda(lista, ev.clientY);
      mostrar(ev.clientX, ev.clientY);
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerId !== inicio.ponteiro) return;
      const arrastou = ativo, alvo = ativo ? alvoEm(ev.clientX, ev.clientY) : null;
      fim();
      if (arrastou) engolirOClique();
      if (alvo !== null) atuais.current.aoSoltar(id, alvo);
    };
    const cancelar = (ev: PointerEvent) => { if (ev.pointerId === inicio.ponteiro) fim(); };
    // Esc desiste do arrasto e não chega a mais ninguém (fecharia a gaveta, no celular).
    const tecla = (ev: KeyboardEvent) => { if (ativo && ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fim(); } };
    // Segurar o dedo no link abriria o menu do navegador (abrir em outra aba, copiar).
    const semMenu = (ev: Event) => { if (dedo) ev.preventDefault(); };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', cancelar);
    window.addEventListener('keydown', tecla, true);
    window.addEventListener('contextmenu', semMenu);
    function fim() {
      clearTimeout(espera);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', cancelar);
      window.removeEventListener('keydown', tecla, true);
      window.removeEventListener('contextmenu', semMenu);
      encerrar.current = null;
      arrastando.current = false;
      setArrasto(null);
    }
    encerrar.current = fim;
  }

  const alca = (id: string) => ({ draggable: false, ref: prenderAoToque, onPointerDown: (e: EventoDoPonteiro<HTMLElement>) => comecar(e, id) });
  return { arrasto, alca };
}

/** O que segue o ponteiro durante o arrasto (o nome do item), por cima de tudo; o ponteiro passa através dele, até o alvo. */
export function FantasmaDoArrasto({ arrasto, children }: { arrasto: Arrasto | null; children: ReactNode }) {
  if (!arrasto) return null;
  const onde = { '--x': `${arrasto.x}px`, '--y': `${arrasto.y}px` } as CSSProperties;
  return createPortal(<div className="arrasto-fantasma" aria-hidden="true" style={onde}>{children}</div>, document.body);
}
