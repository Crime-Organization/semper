// O quadro rola de lado quando as colunas não cabem na tela (#87). Este gancho mede a rolagem da área e diz se há mais à
// esquerda e à direita, para a tela acender o degradê da borda (estilo.css, ".area-quadro"). Mede ao rolar, quando a área
// muda de tamanho (a janela, a barra lateral) e depois de cada desenho do quadro (colunas que entram ou saem, grupos que
// abrem ou fecham). A conta fica na regra pura maisNosLados (regras/quadro.ts). Mede também a altura da barra de rolagem de
// lado (zero onde ela flutua por cima, como no celular), para o degradê parar acima dela e não esconder as setas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { maisNosLados } from '../../regras/quadro';

export interface LadosComMais { esquerda: boolean; direita: boolean; barra: number }
const NENHUM: LadosComMais = { esquerda: false, direita: false, barra: 0 };

export function useMaisNosLados() {
  const [lados, setLados] = useState<LadosComMais>(NENHUM);
  const area = useRef<HTMLElement | null>(null);

  const medir = useCallback(() => {
    const el = area.current;
    if (!el) return;
    // A barra de rolagem de lado é o que a área tem de altura e não mostra conteúdo (o quadro não tem borda).
    const novo = { ...maisNosLados({ rolado: el.scrollLeft, total: el.scrollWidth, visivel: el.clientWidth }), barra: Math.max(0, el.offsetHeight - el.clientHeight) };
    // Rolar dispara muitas medidas: o quadro só é redesenhado quando um dos lados (ou a barra) muda.
    setLados(atual => atual.esquerda === novo.esquerda && atual.direita === novo.direita && atual.barra === novo.barra ? atual : novo);
  }, []);

  // Depois de cada desenho: o que mudou no quadro pode ter mudado a largura de tudo o que há nele.
  useEffect(() => { medir(); });

  /** Liga a medida à área que rola (vai no "ref" dela); devolve o que a desliga quando a área sai da tela. */
  const ligar = useCallback((el: HTMLElement | null) => {
    area.current = el;
    if (!el) return undefined;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      observador?.disconnect();
      area.current = null;
    };
  }, [medir]);

  return { lados, ligar };
}
