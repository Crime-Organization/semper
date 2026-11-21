// Concluir e Reabrir no cartão (#397): o botão redondo ✓ ao lado da Situação, só nos módulos que concluem (a tarefa e a demanda).
// Concluir leva à coluna-marco das concluídas; Reabrir, de volta à do início. Valem as colunas-marco, quaisquer que sejam os nomes
// que o escritório deu a elas. Sem tela nem banco: o cartão pergunta qual ação cabe e onde ela leva, e mostra o aviso daqui.
import type { MarcoColuna } from '../dados/tipos';
import { colunaComMarco } from './quadro';

/** Os módulos com o Concluir no cartão. */
export type ModuloQueConclui = 'tarefas' | 'demandas';
/** O que o botão faz: concluir o item ou reabri-lo. */
export type AcaoDeConclusao = 'concluir' | 'reabrir';

/** A coluna-marco a que cada ação leva o item. */
export const DESTINO_DA_ACAO: Record<AcaoDeConclusao, MarcoColuna> = { concluir: 'concluido', reabrir: 'inicio' };

/** O nome de cada ação, no botão (para o leitor de tela) e na dica. */
export const NOME_DA_ACAO: Record<AcaoDeConclusao, string> = { concluir: 'Concluir', reabrir: 'Reabrir' };

/** O aviso no pé da tela depois de cada ação, em cada módulo. */
export const CONCLUSAO: Record<ModuloQueConclui, { concluida: string; reaberta: (coluna: string) => string }> = {
  tarefas: { concluida: 'Tarefa concluída.', reaberta: coluna => `Tarefa reaberta em "${coluna}".` },
  demandas: { concluida: 'Demanda concluída.', reaberta: coluna => `Demanda reaberta em "${coluna}".` }
};

type ColunaComMarco = { id: string; nome: string; marco?: MarcoColuna | null };

/**
 * A ação que cabe ao item que está na coluna `etapaId`: Reabrir, se ele está na coluna das concluídas (e o quadro tem a do início);
 * Concluir, se não está (e o quadro tem a das concluídas); senão, nenhuma (o botão não aparece).
 */
export function acaoDeConclusao(colunas: ColunaComMarco[], etapaId: string | null): AcaoDeConclusao | null {
  const acao: AcaoDeConclusao = colunaComMarco(colunas, etapaId, 'concluido') ? 'reabrir' : 'concluir';
  return colunaDaAcao(colunas, acao) ? acao : null;
}

/** A coluna a que a ação leva (a coluna-marco dela), ou undefined se o quadro não a tem. */
export const colunaDaAcao = <C extends ColunaComMarco>(colunas: C[], acao: AcaoDeConclusao): C | undefined =>
  colunas.find(c => c.marco === DESTINO_DA_ACAO[acao]);

/** O aviso depois da ação, no módulo, com o nome da coluna a que o item voltou (no Reabrir). */
export const avisoDaConclusao = (modulo: ModuloQueConclui, acao: AcaoDeConclusao, coluna: string) =>
  acao === 'concluir' ? CONCLUSAO[modulo].concluida : CONCLUSAO[modulo].reaberta(coluna);
