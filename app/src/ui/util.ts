// Utilidades de texto, datas e título da página.
import { useEffect, useState } from 'react';
import { MARCA } from '../marca';
import { DIA, ESPERA_AO_DIGITAR, HORA, MINUTO } from './tempos';
import type { Papel } from '../dados';

export const PAPEIS: Record<Papel, string> = { master: 'Master', admin: 'Administrador', usuario: 'Usuário' };

export const dataCurta = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
/** Hoje, no fuso de quem usa, como o banco guarda as datas sem hora (aaaa-mm-dd). */
export const hojeISO = (agora = new Date()) => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
export const dataHora = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
export function relativo(iso?: string | null) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < MINUTO) return 'agora';
  if (ms < HORA) return `há ${Math.floor(ms / MINUTO)} min`;
  if (ms < DIA) return `há ${Math.floor(ms / HORA)} h`;
  if (ms < 7 * DIA) { const d = Math.floor(ms / DIA); return d === 1 ? 'ontem' : `há ${d} dias`; }
  return dataCurta(iso);
}
export const numero = (n: number) => n.toLocaleString('pt-BR');


/** Volta ao começo do cadastro em etapas, na página ou na janela do cadastro (onde quem rola é a janela, não a página). */
export function subirAoCadastro() {
  document.querySelector('.passos')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** Título da aba do navegador: "Pessoas · SEMPER". null deixa como está (ex.: o formulário aberto dentro de um cartão). */
export function useTitulo(nome: string | null) {
  useEffect(() => { if (nome !== null) document.title = `${nome} · ${MARCA.nome}`; }, [nome]);
}

/** Valor que só muda depois de um tempo parado (ex.: busca enquanto digita). */
export function useAtrasado<T>(valor: T, ms = ESPERA_AO_DIGITAR) {
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
