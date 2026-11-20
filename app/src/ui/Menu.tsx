// Menu que abre por cima da página, preso a um botão (menu "⋯" da barra do módulo, menu da coluna do quadro).
// Fecha ao clicar fora ou com Esc (o foco volta ao botão); o primeiro item (botão ou link) já vem com o foco.
// Com "painel" (ex.: os filtros), clicar dentro não fecha: dá para mexer em vários campos seguidos.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props { botao: HTMLElement; aoFechar: () => void; painel?: boolean; rotulo?: string; children: ReactNode }

/** Quanto o menu fica longe das bordas da tela e do botão que o abriu, em pixels. */
export const MARGEM_DA_TELA = 12, DISTANCIA_DO_BOTAO = 6;

/** Os menus abertos agora: cada um sabe se fechar. */
const abertos = new Set<() => void>();
/**
 * Fecha os menus abertos, para outra janela abrir por cima (a busca geral, pelo Ctrl+K): escondido atrás dela, o menu
 * continuaria pegando o Esc. O foco que estava dentro do menu volta ao botão dele, como no Esc.
 */
export const fecharMenusAbertos = () => [...abertos].forEach(fechar => fechar());

export function MenuFlutuante({ botao, aoFechar, painel = false, rotulo, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: 0 });
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useLayoutEffect(() => {
    const m = ref.current!;
    const posicionar = () => {
      const r = botao.getBoundingClientRect();
      // Abre abaixo do botão; se não couber, sobe até caber na tela (o menu mais alto que a tela rola por dentro: .kmenu).
      const noFimDaTela = window.scrollY + window.innerHeight - m.offsetHeight - MARGEM_DA_TELA;
      setPos({
        top: Math.max(window.scrollY + MARGEM_DA_TELA, Math.min(r.bottom + window.scrollY + DISTANCIA_DO_BOTAO, noFimDaTela)),
        left: Math.max(MARGEM_DA_TELA, Math.min(r.left + window.scrollX, window.innerWidth - m.offsetWidth - MARGEM_DA_TELA))
      });
    };
    posicionar();
    // No menu, o primeiro item pode ser um link (o "Ver perfil" da bolinha da equipe, #388, quando as outras ações não valem).
    m.querySelector<HTMLElement>(painel ? 'select, input, button' : 'button, a[href]')?.focus();
    // O painel que cresce (ex.: uma etiqueta nova na lista) sobe para continuar dentro da tela.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(posicionar);
    observador?.observe(m);
    return () => observador?.disconnect();
  }, [botao, painel]);
  useEffect(() => {
    // composedPath: vale mesmo se o clique tirou da tela o elemento clicado (ex.: o formulário de um painel).
    const fora = (e: MouseEvent) => { if (painel && e.composedPath().includes(ref.current!)) return; fechar.current(); };
    // Antes dos outros (captura): o Esc fecha só o menu, e não também a janela ou o cartão onde ele está.
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fechar.current(); botao.focus(); } };
    const fecharDeFora = () => {
      const focoDentro = !!ref.current?.contains(document.activeElement);
      fechar.current();
      if (focoDentro) botao.focus();
    };
    abertos.add(fecharDeFora);
    const t = setTimeout(() => document.addEventListener('click', fora), 0);
    document.addEventListener('keydown', tecla, true);
    return () => { abertos.delete(fecharDeFora); clearTimeout(t); document.removeEventListener('click', fora); document.removeEventListener('keydown', tecla, true); };
  }, [botao, painel]);
  return createPortal(<div className={painel ? 'kmenu painel' : 'kmenu'} role={painel ? 'dialog' : 'menu'} aria-label={rotulo} ref={ref} style={pos}>
    {children}
  </div>, document.body);
}
