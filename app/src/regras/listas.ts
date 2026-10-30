// Regras das listas da demanda (como as do Trello): o progresso, o prazo de cada item e a troca de posição de uma
// lista ou de um item. Tudo puro, sem tela nem banco.
import type { ItemDaLista } from '../dados/tipos';
import { situacaoDoPrazo, type SituacaoPrazo } from './demanda';

/** Quantos itens da lista estão feitos, de quantos, e a porcentagem (inteira) para a barra. */
export function progressoDaLista(itens: Pick<ItemDaLista, 'feito_em'>[]) {
  const feitos = itens.filter(i => i.feito_em).length, total = itens.length;
  return { feitos, total, percentual: total ? Math.round(100 * feitos / total) : 0 };
}

/** Situação da data de entrega do item: só importa enquanto ele não está feito. */
export const prazoDoItem = (item: Pick<ItemDaLista, 'prazo' | 'feito_em'>, hoje: string): SituacaoPrazo | null =>
  item.feito_em ? null : situacaoDoPrazo(item.prazo, hoje);

/** A posição para o que entra no fim (depois do maior). */
export const ordemNoFimDaLista = (itens: { ordem: number }[]) => Math.max(0, ...itens.map(i => i.ordem)) + 1;

/**
 * Sobe (passo -1) ou desce (passo 1) o item da posição i: devolve as novas posições de quem mudou de lugar (todos
 * renumerados na nova ordem, a partir de 1, para posições repetidas não atrapalharem). Vazio se não há para onde ir.
 */
export function moverNaLista<T extends { id: string; ordem: number }>(itens: T[], i: number, passo: 1 | -1): { id: string; ordem: number }[] {
  const j = i + passo;
  if (i < 0 || i >= itens.length || j < 0 || j >= itens.length) return [];
  const nova = [...itens];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova.map((x, k) => ({ id: x.id, ordem: k + 1 })).filter(x => itens.find(y => y.id === x.id)!.ordem !== x.ordem);
}
