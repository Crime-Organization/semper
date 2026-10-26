// Menu que abre por cima da página, preso a um botão (menu "⋯" da barra do módulo, menu da coluna do quadro).
// Fecha ao clicar fora ou com Esc (o foco volta ao botão); o primeiro item já vem com o foco.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function MenuFlutuante({ botao, aoFechar, children }: { botao: HTMLElement; aoFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: 0 });
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useLayoutEffect(() => {
    const r = botao.getBoundingClientRect(), m = ref.current!;
    setPos({ top: r.bottom + window.scrollY + 6, left: Math.max(12, Math.min(r.left + window.scrollX, window.innerWidth - m.offsetWidth - 12)) });
    m.querySelector('button')?.focus();
  }, [botao]);
  useEffect(() => {
    const fora = () => fechar.current();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { fechar.current(); botao.focus(); } };
    const t = setTimeout(() => document.addEventListener('click', fora), 0);
    document.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); document.removeEventListener('click', fora); document.removeEventListener('keydown', tecla); };
  }, [botao]);
  return createPortal(<div className="kmenu" role="menu" ref={ref} style={pos}>{children}</div>, document.body);
}
