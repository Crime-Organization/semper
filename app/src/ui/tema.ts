// Tema claro, escuro ou automático (segue o aparelho) e cor de destaque da marca.
import { useSyncExternalStore } from 'react';
import { MARCA } from '../marca';
import { salvarPreferencia } from './preferencias';

export type Tema = 'auto' | 'claro' | 'escuro';
export const TEMAS: Record<Tema, string> = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };

const html = document.documentElement;
const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export const temaAtual = (): Tema => (html.dataset.tema as Tema) || 'auto';

/** Só muda o que aparece na tela (a entrada força o claro sem mexer na preferência guardada). */
export function mostrarTema(t: Tema) {
  if (t === 'claro' || t === 'escuro') html.dataset.tema = t;
  else delete html.dataset.tema;
  ouvintes.forEach(f => f());
}
export function temaGuardado(): Tema {
  try { const t = localStorage.getItem('semper-tema'); return t === 'claro' || t === 'escuro' ? t : 'auto'; }
  catch { return 'auto'; }
}
/** Aplica e guarda neste aparelho (vale já no próximo carregamento, antes de qualquer consulta). */
export function aplicarTema(t: Tema) {
  mostrarTema(t);
  try { if (t === 'claro' || t === 'escuro') localStorage.setItem('semper-tema', t); else localStorage.removeItem('semper-tema'); }
  catch { /* sem armazenamento: vale só nesta visita */ }
}
/** Aplica e grava no perfil, para valer em qualquer aparelho. */
export async function definirTema(t: Tema) {
  aplicarTema(t);
  await salvarPreferencia('tema', t);
}
export const useTema = () => useSyncExternalStore(assinar, temaAtual);

// Cor de destaque vinda da marca (os tons derivados só mudam se a marca trocar o verde padrão).
const mudarTom = (hex: string, f: number) => '#' + [16, 8, 0].map(s => {
  const c = (parseInt(hex.slice(1), 16) >> s) & 255;
  return Math.round(f < 1 ? c * f : c + (255 - c) * (f - 1)).toString(16).padStart(2, '0');
}).join('');
export function aplicarCoresDaMarca() {
  const raiz = html.style, d = MARCA.cores.destaque;
  if (d.toLowerCase() !== '#377d22') {
    raiz.setProperty('--accent', d);
    raiz.setProperty('--accent-hover', mudarTom(d, .86));
    raiz.setProperty('--accent-ink', mudarTom(d, .78));
    raiz.setProperty('--accent-deep', mudarTom(d, .57));
    raiz.setProperty('--accent-bright', mudarTom(d, 1.3));
  }
  if (MARCA.cores.escuro.toLowerCase() !== '#1a1916') raiz.setProperty('--dark', MARCA.cores.escuro);
}
