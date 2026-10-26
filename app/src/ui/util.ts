// Utilidades de texto, datas e título da página.
import { useEffect, useState } from 'react';
import { MARCA } from '../marca';
import type { Papel } from '../dados';

export const PAPEIS: Record<Papel, string> = { master: 'Master', admin: 'Administrador', usuario: 'Usuário' };

export const dataCurta = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
export const dataHora = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
export function relativo(iso?: string | null) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) { const d = Math.floor(s / 86400); return d === 1 ? 'ontem' : `há ${d} dias`; }
  return dataCurta(iso);
}
export const numero = (n: number) => n.toLocaleString('pt-BR');

/** Texto comparável: sem acentos, sem espaços nas pontas, em minúsculas. */
export const normal = (t: unknown) => String(t || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Título da aba do navegador: "Pessoas · Braga Ferreira SEMPER". */
export function useTitulo(nome: string) {
  useEffect(() => { document.title = `${nome} · ${MARCA.nome} ${MARCA.submarca}`; }, [nome]);
}

/** Valor que só muda depois de um tempo parado (ex.: busca enquanto digita). */
export function useAtrasado<T>(valor: T, ms = 350) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setAtrasado(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return atrasado;
}

/** Entrega um arquivo gerado na tela (CSV, por exemplo) como download. */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copia um texto; se o navegador não deixar, seleciona o elemento para Ctrl+C. Devolve se copiou. */
export async function copiarTexto(texto: string, selecionar?: HTMLElement | null) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch {
    if (selecionar) {
      const r = document.createRange(); r.selectNodeContents(selecionar);
      getSelection()?.removeAllRanges(); getSelection()?.addRange(r);
    }
    return false;
  }
}
