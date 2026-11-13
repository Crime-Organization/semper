// Colunas-marco dos quadros: o código fixo de cada uma diz ao sistema qual ponto do fluxo ela marca, mesmo que a coluna
// seja renomeada. Elas têm cor própria no quadro e não podem ser excluídas nem criadas à mão (supabase/migrations/20261027000014_colunas_marco.sql).
import type { GrupoDeColunas, MarcoColuna } from '../dados/tipos';

export const MARCOS: Record<MarcoColuna, { rotulo: string; explicacao: string }> = {
  assinado: {
    rotulo: 'Contrato assinado',
    explicacao: 'Coluna do contrato assinado: cada contrato que chegar aqui gera uma demanda para cada objeto ("A definir" não conta), e cada demanda ganha as tarefas do modelo de lista com o mesmo nome do objeto. Pode ser renomeada, mas não excluída.'
  },
  aguardando_assinatura: {
    rotulo: 'Aguardando assinatura',
    explicacao: 'Coluna do contrato que espera a assinatura: o contrato criado sozinho, quando a pessoa chega a "Contrato fechado", entra aqui. Pode ser renomeada, mas não excluída.'
  },
  contrato_fechado: {
    rotulo: 'Contrato fechado',
    explicacao: 'Coluna do cliente que fechou: a pessoa que chegar aqui ganha um contrato em "Aguardando assinatura", com ela como cliente. Pode ser renomeada, mas não excluída.'
  },
  inicio: {
    rotulo: 'Início do fluxo',
    explicacao: 'Primeira coluna do fluxo: o que o sistema cria sozinho entra aqui. Pode ser renomeada, mas não excluída.'
  },
  concluido: {
    rotulo: 'Concluído',
    explicacao: 'Última coluna do fluxo: o item chega aqui quando é concluído. Pode ser renomeada, mas não excluída.'
  }
};

/** Se a coluna em que o cartão está agora é a coluna-marco pedida. */
export const colunaComMarco = (colunas: { id: string; marco?: MarcoColuna | null }[], etapaId: string | null, marco: MarcoColuna) =>
  !!etapaId && colunas.some(c => c.id === etapaId && c.marco === marco);

/** Só administradores excluem colunas, e coluna-marco nunca. */
export const podeExcluirColuna = (c: { marco?: MarcoColuna | null }, ehAdmin: boolean) => ehAdmin && !c.marco;

// ---------- grupos de colunas ----------
/** Um trecho do quadro: as colunas de um grupo, na ordem delas (grupo null: as colunas sem grupo). */
export interface BlocoDoQuadro<C> { grupo: GrupoDeColunas | null; colunas: C[] }

/**
 * Um item do topo do quadro: uma coluna sem grupo ou um grupo inteiro. As ordens dos dois valem juntas, e por isso um grupo
 * pode ficar entre colunas sem grupo (#296). A ordem das colunas de dentro de um grupo só vale dentro dele.
 */
export interface ItemDoTopo { id: string; ordem: number; grupo: boolean }

type ColunaNoQuadro = { id: string; ordem: number; grupo_id?: string | null };

/** As colunas sem grupo (ou de um grupo que não existe mais) e os grupos, na ordem da tela. No empate, a coluna vem antes. */
export function filaDoTopo(colunas: ColunaNoQuadro[], grupos: Pick<GrupoDeColunas, 'id' | 'ordem'>[]): ItemDoTopo[] {
  const existe = new Set(grupos.map(g => g.id));
  return [
    ...colunas.filter(c => !c.grupo_id || !existe.has(c.grupo_id)).map(c => ({ id: c.id, ordem: c.ordem, grupo: false })),
    ...grupos.map(g => ({ id: g.id, ordem: g.ordem, grupo: true }))
  ].sort((a, b) => a.ordem - b.ordem || Number(a.grupo) - Number(b.grupo));
}

/** O quadro em trechos, na ordem do topo: as colunas sem grupo que ficam juntas e cada grupo (mesmo sem nenhuma coluna). */
export function blocosDoQuadro<C extends ColunaNoQuadro>(colunas: C[], grupos: GrupoDeColunas[]): BlocoDoQuadro<C>[] {
  const naOrdem = [...colunas].sort((a, b) => a.ordem - b.ordem);
  const blocos: BlocoDoQuadro<C>[] = [];
  for (const item of filaDoTopo(colunas, grupos)) {
    const ultimo = blocos[blocos.length - 1];
    if (item.grupo) blocos.push({ grupo: grupos.find(g => g.id === item.id)!, colunas: naOrdem.filter(c => c.grupo_id === item.id) });
    else if (ultimo && !ultimo.grupo) ultimo.colunas.push(colunas.find(c => c.id === item.id)!);
    else blocos.push({ grupo: null, colunas: [colunas.find(c => c.id === item.id)!] });
  }
  return blocos;
}

/** A ordem de quem entra no fim do quadro (coluna sem grupo nova, grupo novo, coluna que sai do grupo): depois de tudo. */
export const ordemNoFimDoQuadro = (colunas: { ordem: number }[], grupos: { ordem: number }[]) =>
  Math.max(0, ...colunas.map(c => c.ordem), ...grupos.map(g => g.ordem)) + 1;

/** Se o grupo aparece aberto: vale o que a pessoa escolheu; sem escolha, o grupo diz como começa. */
export const grupoEstaAberto = (g: GrupoDeColunas, escolhas: Record<string, boolean>) => escolhas[g.id] ?? !g.comeca_fechado;

/** A ordem de quem fica entre dois vizinhos (ou numa ponta); sem vizinhos, a atual. */
export function ordemEntre(anterior: { ordem: number } | undefined, seguinte: { ordem: number } | undefined, atual: number) {
  if (anterior && seguinte) return (anterior.ordem + seguinte.ordem) / 2;
  if (anterior) return anterior.ordem + 1;
  return seguinte ? seguinte.ordem - 1 : atual;
}

/**
 * A ordem nova de quem muda de lugar numa fila (colunas de um grupo, ou o topo do quadro), já na ordem da tela:
 * o item "id" passa para antes de "antesDe" (null: para o fim). Devolve null quando nada muda.
 */
export function ordemAoPosicionar<T extends { id: string; ordem: number }>(fila: T[], id: string, antesDe: string | null): number | null {
  const i = fila.findIndex(x => x.id === id);
  if (i < 0 || antesDe === id) return null;
  const outros = fila.filter(x => x.id !== id);
  const lugar = antesDe ? outros.findIndex(x => x.id === antesDe) : outros.length;
  if (lugar < 0) return null;
  const ant = outros[lugar - 1], prox = outros[lugar];
  if (fila[i - 1]?.id === ant?.id && fila[i + 1]?.id === prox?.id) return null;   // já está aí
  return ordemEntre(ant, prox, fila[i].ordem);
}

/** Antes de quem o item fica ao andar um passo na fila (null: no fim); undefined quando já está na ponta. */
export function antesDeAoAndar<T extends { id: string }>(fila: T[], id: string, passo: -1 | 1): string | null | undefined {
  const i = fila.findIndex(x => x.id === id);
  if (i < 0 || i + passo < 0 || i + passo >= fila.length) return undefined;
  return passo < 0 ? fila[i - 1].id : fila[i + 2]?.id ?? null;
}

/** A coluna do cartão novo quando ninguém escolheu: a coluna-marco de início, se o quadro tem; se não, a primeira da tela. */
export function colunaDoCartaoNovo<C extends ColunaNoQuadro & { marco?: MarcoColuna | null }>(colunas: C[], grupos: GrupoDeColunas[]): C | null {
  return colunas.find(c => c.marco === 'inicio') ?? blocosDoQuadro(colunas, grupos).find(b => b.colunas.length)?.colunas[0] ?? null;
}

/** A quantidade de cartões em palavras, para quem usa leitor de tela (null: ainda carregando). */
export function cartoesEmPalavras(total: number | null, formatar: (n: number) => string) {
  if (total === null) return 'carregando';
  return total === 1 ? '1 cartão' : `${formatar(total)} cartões`;
}
