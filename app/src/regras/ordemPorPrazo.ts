// Ordem de tarefas e demandas pelo prazo, a data de entrega (#291). É a mesma do banco de verdade (supabase.ts), para o banco
// fictício (falso.ts) ordenar igual: sem prazo sempre no fim; no mesmo dia, como na Agenda, o prazo sem hora vem antes dos com
// hora, e a hora mais cedo antes. "O mais distante primeiro" é o inverso disso, mas os sem prazo continuam no fim.

/** O que a ordem por prazo precisa do item: a data (aaaa-mm-dd) e a hora (hh:mm), as duas podendo faltar. */
export interface ComPrazo { prazo: string | null; prazo_hora: string | null }

/** Para onde a lista anda: 1, o mais próximo primeiro; -1, o mais distante primeiro. */
export type SentidoDoPrazo = 1 | -1;

/** Compara dois valores que podem faltar: o que falta vem antes (a hora vazia é o começo do dia). */
const comparar = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');

/**
 * Compara dois itens pelo prazo, no sentido pedido. Os sem prazo ficam no fim nos dois sentidos; entre eles, conta só a hora,
 * como no banco (que ordena pela data e depois pela hora, com o id desempatando).
 */
export function compararPeloPrazo(a: ComPrazo, b: ComPrazo, sentido: SentidoDoPrazo = 1): number {
  if (!a.prazo !== !b.prazo) return a.prazo ? -1 : 1;
  return sentido * (comparar(a.prazo, b.prazo) || comparar(a.prazo_hora, b.prazo_hora)) || 0;   // "|| 0": sem o -0 do empate
}
