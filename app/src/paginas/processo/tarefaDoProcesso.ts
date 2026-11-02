// A tarefa que nasce de uma intimação ou de um prazo: entra na coluna de início do quadro de tarefas, já ligada ao processo.
import { SD, type DadosTarefa } from '../../dados';
import { colunaInicial } from '../../ui/quadro/colunaInicial';
import { ordemNoFim } from '../../ui/quadro/posicao';

export async function criarTarefaLigada(dados: DadosTarefa) {
  const coluna = await colunaInicial('tarefas');
  return SD.tarefaCriar({ ...dados, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
}

/** Desfaz a criação: só tarefas arquivadas podem ser excluídas. */
export async function apagarTarefaCriada(id: string) {
  await SD.tarefasArquivar([id], true);
  const x = await SD.tarefasExcluir([id]);
  if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer a criação da tarefa.');
}
