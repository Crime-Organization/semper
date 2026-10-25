// Avatares ("carinhas") da equipe: iniciais sobre uma cor fixa por pessoa.
import type { CSSProperties } from 'react';
import type { Membro } from '../dados';

const PALETA = ['#5B6B7F', '#7A5C61', '#4F6D5A', '#8A6E3D', '#5E5A7A', '#3F6E73', '#7A4E3B', '#55617A'];
export function corDe(p?: Partial<Membro> | null) {
  if (p?.cor) return p.cor;
  let h = 0;
  for (const ch of String(p?.id || p?.nome || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}
export function iniciais(nome?: string | null) {
  const w = String(nome || '?').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}
const tamanho = (tam: number) => ({ '--av': tam + 'px' }) as CSSProperties;

export function Avatar({ p, tam = 28 }: { p?: Partial<Membro> | null; tam?: number }) {
  const nome = p?.nome || 'Usuário removido';
  return <span className="avatar" style={{ ...tamanho(tam), background: corDe(p) }} title={nome} aria-label={nome}>{iniciais(p?.nome)}</span>;
}

export function Avatares({ ids, equipe, max = 4, tam = 26 }: { ids: string[]; equipe: Membro[]; max?: number; tam?: number }) {
  const lista = ids.map(id => equipe.find(p => p.id === id) || { id, nome: 'Usuário removido' });
  if (!lista.length) return null;
  const extra = lista.length - max;
  return <span className="avatares">
    {lista.slice(0, max).map(p => <Avatar key={p.id} p={p} tam={tam} />)}
    {extra > 0 && <span className="avatar mais" style={tamanho(tam)} title={lista.slice(max).map(p => p.nome).join(', ')}>+{extra}</span>}
  </span>;
}
