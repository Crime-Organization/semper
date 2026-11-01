// Etiquetas do escritório: a paleta fixa, o texto opcional e o que não pode repetir. Tudo puro, sem tela nem banco.
import type { Etiqueta } from '../dados/tipos';
import { TAMANHO_ETIQUETA } from '../dados/limites';
import { normal } from './texto';

/** A paleta fixa (exigida pelo banco: supabase/migrations/20261101131705_etiquetas.sql). Cada cor tem o seu par de tinta em estilo.css. */
export type CorDaEtiqueta = 'vermelho' | 'laranja' | 'amarelo' | 'verde' | 'azul' | 'roxo' | 'rosa' | 'cinza';
export const CORES_DA_ETIQUETA: Record<CorDaEtiqueta, string> = {
  vermelho: 'Vermelho', laranja: 'Laranja', amarelo: 'Amarelo', verde: 'Verde', azul: 'Azul', roxo: 'Roxo', rosa: 'Rosa', cinza: 'Cinza'
};
export const CORES = Object.keys(CORES_DA_ETIQUETA) as CorDaEtiqueta[];

/** O texto como fica guardado: sem espaços sobrando; vazio vira etiqueta só de cor. */
export const textoDaEtiqueta = (texto: string) => texto.trim().replace(/\s+/g, ' ') || null;

/** Como a etiqueta se chama onde não dá para mostrar a cor (filtros, leitores de tela). */
export const nomeDaEtiqueta = (e: Pick<Etiqueta, 'cor' | 'texto'>) => e.texto ?? `Só cor: ${CORES_DA_ETIQUETA[e.cor]}`;

/** As com texto em ordem alfabética, depois as só de cor, na ordem da paleta. */
export function etiquetasNaOrdem<E extends Pick<Etiqueta, 'cor' | 'texto'>>(lista: E[]): E[] {
  const comTexto = lista.filter(e => e.texto).sort((a, b) => a.texto!.localeCompare(b.texto!, 'pt-BR'));
  const soCor = lista.filter(e => !e.texto).sort((a, b) => CORES.indexOf(a.cor) - CORES.indexOf(b.cor));
  return [...comTexto, ...soCor];
}

/** O que há de errado na etiqueta, ou null. `id`: a que está sendo editada (não conta como repetida). */
export function erroDaEtiqueta(e: Pick<Etiqueta, 'cor' | 'texto'>, existentes: Etiqueta[], id?: string): string | null {
  const outras = existentes.filter(x => x.id !== id);
  if (!e.texto) return outras.some(x => !x.texto && x.cor === e.cor) ? `Já existe uma etiqueta só de cor em ${CORES_DA_ETIQUETA[e.cor].toLowerCase()}.` : null;
  if (e.texto.length > TAMANHO_ETIQUETA) return `O texto da etiqueta pode ter até ${TAMANHO_ETIQUETA} caracteres.`;
  return outras.some(x => normal(x.texto) === normal(e.texto)) ? 'Já existe uma etiqueta com esse texto.' : null;
}

/** Muda ou exclui a etiqueta quem criou ou um administrador. */
export const podeMudarEtiqueta = (e: Pick<Etiqueta, 'criado_por'>, perfilId: string, ehAdmin: boolean) => ehAdmin || e.criado_por === perfilId;
