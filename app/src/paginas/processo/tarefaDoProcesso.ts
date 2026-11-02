// A tarefa que nasce de uma intimação ou de um prazo: entra na coluna de início do quadro de tarefas, já ligada ao processo.
import { SD, type DadosTarefa, type Membro } from '../../dados';
import type { QuemRecebe } from '../../regras/andamentos';
import { demandaParaTarefa } from '../../regras/processoDaDemanda';
import { colunaInicial } from '../../ui/quadro/colunaInicial';
import { ordemNoFim } from '../../ui/quadro/posicao';

/** Quem pode receber a tarefa, pela equipe do escritório. */
export const quemRecebe = (eu: string, equipe: Membro[]): QuemRecebe => ({ eu, ativos: equipe.filter(m => m.ativo !== false).map(m => m.id) });

/** Cria a tarefa, já com a demanda do processo quando não há dúvida de qual é, e grava a ligação no item de origem.
 *  Se a ligação falhar, a tarefa sai: tentar de novo não a duplica. */
export async function criarTarefaLigada(dados: DadosTarefa, ligar: (tarefaId: string) => Promise<unknown>) {
  const [coluna, demandas] = await Promise.all([colunaInicial('tarefas'), SD.demandasDoProcesso(dados.processo_id!)]);
  const r = await SD.tarefaCriar({ ...dados, demanda_id: demandaParaTarefa(demandas), etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
  try { await ligar(r.id); } catch (e) {
    await SD.tarefasArquivar([r.id], true).then(() => SD.tarefasExcluir([r.id])).catch(() => {});
    throw e;
  }
  return r;
}

/** Desfaz a criação sem perder o que já foi feito nela: a tarefa vai para o arquivo, de onde pode ser recuperada ou excluída. */
export const arquivarTarefaCriada = async (id: string) => { await SD.tarefasArquivar([id], true); };
