// "Copiar para outra demanda", no ⋯ do cartão da tarefa (#312): escolhe a demanda (a busca das ligações, só as que quem copia
// altera) e cria nela a cópia, com os checklists desmarcados e o cronômetro zerado (regras/copiaDaTarefa.ts). A original não muda.
import { SD, type DemandaParaEscolher } from '../dados';
import { COPIAR_PARA_OUTRA_DEMANDA, dadosDaCopia, O_QUE_VAI_NA_COPIA, prazosDosItensCopiados } from '../regras/copiaDaTarefa';
import { arvoreDoChecklist } from '../regras/gruposDaLista';
import { avisar, registrarDesfazer } from '../ui/avisos';
import { janela } from '../ui/janela';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { ordemNoFim } from '../ui/quadro/posicao';
import { arquivarTarefaCriada } from './processo/tarefaDoProcesso';

/** A tarefa sumiu enquanto a pessoa escolhia a demanda (outra pessoa a excluiu, ou tirou quem copia dela). */
export const TAREFA_SUMIU = 'Esta tarefa não foi encontrada. Ela pode ter sido excluída, ou você não participa mais dela.';

/** Pede a demanda numa janela, com a busca das ligações; fora a demanda em que a tarefa já está. null: a pessoa desistiu. */
export const escolherDemandaDaCopia = (demandaAtual: string | null) => janela<DemandaParaEscolher>({
  titulo: COPIAR_PARA_OUTRA_DEMANDA,
  corpo: responder => <LigarDoModulo modulo="demandas" naJanela filtro={{ fora: demandaAtual ? [demandaAtual] : [] }} aviso={O_QUE_VAI_NA_COPIA}
    aoEscolher={responder} />,
  acoes: [{ rotulo: 'Cancelar', valor: null }]
});

/**
 * Cria a cópia da tarefa na demanda: a tarefa, na coluna de início do quadro, e cada checklist (um depois do outro, na ordem), com os
 * prazos dos itens. Se algo falhar no meio, a cópia sai inteira: tentar de novo não deixa uma cópia pela metade.
 */
export async function copiarTarefa(tarefaId: string, demanda: DemandaParaEscolher) {
  const [t, listas, coluna] = await Promise.all([SD.tarefaObter(tarefaId), SD.listasDoCartao('tarefas', tarefaId), colunaInicial('tarefas')]);
  if (!t) throw new Error(TAREFA_SUMIU);
  const copia = await SD.tarefaCriar({ ...dadosDaCopia(t, demanda), etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
  try {
    await listas.reduce(async (antes, l) => {
      await antes;
      const nova = await SD.listaCriar('tarefas', copia.id, l.nome, arvoreDoChecklist(l));
      await Promise.all(prazosDosItensCopiados(l, nova).map(({ id, prazo }) => SD.itemAtualizar(id, { prazo })));
    }, Promise.resolve());
  } catch (e) {
    await SD.tarefasArquivar([copia.id], true).then(() => SD.tarefasExcluir([copia.id])).catch(() => {});
    throw e;
  }
  return copia;
}

/** O ⋯ do cartão: escolhe a demanda, copia e avisa, com o botão que abre a cópia (o Ctrl+Z a leva para o arquivo). */
export async function copiarParaOutraDemanda(t: { id: string; demanda_id: string | null }, abrir: (id: string) => void, depois: () => void) {
  const demanda = await escolherDemandaDaCopia(t.demanda_id);
  if (!demanda) return;
  const copia = await copiarTarefa(t.id, demanda);
  registrarDesfazer('cópia da tarefa', () => arquivarTarefaCriada(copia.id));
  avisar(`Cópia ${copia.codigo} criada na demanda "${demanda.titulo}".`, 'ok', { rotulo: 'Abrir a cópia', fn: () => abrir(copia.id) });
  depois();
}
