// Avatares ("carinhas") da equipe: a foto redonda de cada um (150×150) ou, sem foto, as iniciais sobre uma cor fixa por pessoa.
import { useState, type CSSProperties } from 'react';
import type { Membro } from '../dados';

const PALETA = ['#5B6B7F', '#7A5C61', '#4F6D5A', '#8A6E3D', '#5E5A7A', '#3F6E73', '#7A4E3B', '#55617A'];
export function corDe(p?: Partial<Membro> | null) {
  if (p?.cor) return p.cor;
  let h = 0;
  for (const ch of String(p?.id || p?.nome || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}
// Só as palavras que começam com letra: o "(excluído)" no fim do nome de quem saiu da equipe não vira inicial.
export function iniciais(nome?: string | null) {
  const w = String(nome || '?').trim().split(/\s+/).filter(p => /^\p{L}/u.test(p));
  return ((w[0]?.[0] || '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}
const tamanho = (tam: number) => ({ '--av': tam + 'px' }) as CSSProperties;

export function Avatar({ p, tam = 28 }: { p?: Partial<Membro> | null; tam?: number }) {
  const nome = p?.nome || 'Usuário removido';
  // O link da foto vale por um dia: se não abrir (venceu, ou a foto foi tirada), voltam as iniciais.
  const [semFoto, setSemFoto] = useState<string | null>(null);
  if (p?.foto && semFoto !== p.foto) {
    return <span className="avatar com-foto" style={tamanho(tam)} title={nome} role="img" aria-label={nome}>
      <img src={p.foto} alt="" width={tam} height={tam} loading="lazy" decoding="async" onError={() => setSemFoto(p.foto ?? null)} />
    </span>;
  }
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
