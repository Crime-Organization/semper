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

/** O quadro em trechos: primeiro as colunas sem grupo, depois cada grupo, na ordem dele (mesmo sem nenhuma coluna). */
export function blocosDoQuadro<C extends { ordem: number; grupo_id?: string | null }>(colunas: C[], grupos: GrupoDeColunas[]): BlocoDoQuadro<C>[] {
  const naOrdem = [...colunas].sort((a, b) => a.ordem - b.ordem);
  const existe = new Set(grupos.map(g => g.id));
  return [
    { grupo: null, colunas: naOrdem.filter(c => !c.grupo_id || !existe.has(c.grupo_id)) },
    ...[...grupos].sort((a, b) => a.ordem - b.ordem).map(grupo => ({ grupo, colunas: naOrdem.filter(c => c.grupo_id === grupo.id) }))
  ];
}

/** Se o grupo aparece aberto: vale o que a pessoa escolheu; sem escolha, o grupo diz como começa. */
export const grupoEstaAberto = (g: GrupoDeColunas, escolhas: Record<string, boolean>) => escolhas[g.id] ?? !g.comeca_fechado;

/** A ordem de quem fica entre dois vizinhos (ou numa ponta); sem vizinhos, a atual. */
export function ordemEntre(anterior: { ordem: number } | undefined, seguinte: { ordem: number } | undefined, atual: number) {
  if (anterior && seguinte) return (anterior.ordem + seguinte.ordem) / 2;
  if (anterior) return anterior.ordem + 1;
  return seguinte ? seguinte.ordem - 1 : atual;
}

/**
 * A ordem nova de quem muda de lugar numa fila (colunas de um grupo, ou os grupos do quadro), já na ordem da tela:
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
export function colunaDoCartaoNovo<C extends { ordem: number; grupo_id?: string | null; marco?: MarcoColuna | null }>(colunas: C[], grupos: GrupoDeColunas[]): C | null {
  return colunas.find(c => c.marco === 'inicio') ?? blocosDoQuadro(colunas, grupos).find(b => b.colunas.length)?.colunas[0] ?? null;
}

/** A quantidade de cartões em palavras, para quem usa leitor de tela (null: ainda carregando). */
export function cartoesEmPalavras(total: number | null, formatar: (n: number) => string) {
  if (total === null) return 'carregando';
  return total === 1 ? '1 cartão' : `${formatar(total)} cartões`;
}
