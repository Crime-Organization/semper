// Loja observável (padrão Observer): guarda um valor e avisa quem se inscreveu quando ele muda. Serve ao estado que
// é do sistema todo, fora dos componentes (avisos, janelas, tema), e o React acompanha com usar().
import { useSyncExternalStore } from 'react';

export interface Loja<T> {
  ler: () => T;
  /** Troca o valor (ou calcula o novo a partir do atual) e avisa os inscritos. */
  mudar: (novo: T | ((atual: T) => T)) => void;
  /** Inscreve para ser avisado das mudanças; devolve como cancelar a inscrição. */
  assinar: (ouvinte: () => void) => () => void;
  /** Volta ao valor inicial e avisa os inscritos (útil nos testes). */
  reiniciar: () => void;
  /** Hook: o componente mostra o valor atual e é desenhado de novo a cada mudança. */
  usar: () => T;
}

export function criarLoja<T>(inicial: T): Loja<T> {
  let valor = inicial;
  const ouvintes = new Set<() => void>();
  const avisarTodos = () => ouvintes.forEach(f => f());
  const ler = () => valor;
  const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
  const useValor = () => useSyncExternalStore(assinar, ler);
  return {
    ler,
    assinar,
    mudar: novo => { valor = typeof novo === 'function' ? (novo as (atual: T) => T)(valor) : novo; avisarTodos(); },
    reiniciar: () => { valor = inicial; avisarTodos(); },
    usar: useValor
  };
}
