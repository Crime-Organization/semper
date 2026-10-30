// Quando a última tarefa de uma demanda chega à coluna das concluídas, o sistema oferece levar a demanda para a
// coluna-marco "Concluído". Nada é movido sem o aceite de quem está mexendo (e dá para desfazer).
import { SD } from '../dados';
import { tarefasDaDemandaConcluidas } from '../regras/tarefa';
import { falha, feito } from '../ui/avisos';
import { confirmar } from '../ui/janela';
import { ordemNoFim } from '../ui/quadro/posicao';

/**
 * Chame depois de mover a tarefa. Só pergunta se ela foi para a coluna das concluídas, está ligada a uma demanda que
 * quem está logado vê, a demanda ainda não está concluída e todas as tarefas ativas dela estão concluídas.
 * Devolve true se a demanda foi movida.
 */
export async function oferecerConcluirDemanda(tarefaId: string, etapaId: string | null): Promise<boolean> {
  try {
    const concluida = (await SD.colunasListar('tarefas')).find(c => c.marco === 'concluido')?.id ?? null;
    if (!concluida || etapaId !== concluida) return false;
    const demanda = (await SD.tarefaObter(tarefaId))?.demanda;
    if (!demanda) return false;
    const fim = (await SD.colunasListar('demandas')).find(c => c.marco === 'concluido');
    if (!fim || demanda.etapa_id === fim.id) return false;
    if (!tarefasDaDemandaConcluidas(await SD.tarefasDaDemanda(demanda.id), concluida)) return false;
    const sim = await confirmar('Concluir a demanda?',
      `Todas as tarefas da demanda "${demanda.titulo}" estão concluídas. Quer levar a demanda para "${fim.nome}"?`, 'Concluir a demanda');
    if (!sim) return false;
    const antes = demanda.etapa_id;
    await SD.demandaMover(demanda.id, fim.id, ordemNoFim());
    feito(`Demanda ${demanda.codigo} foi para "${fim.nome}".`, 'conclusão da demanda', async () => { await SD.demandaMover(demanda.id, antes, ordemNoFim()); });
    return true;
  } catch (e) { falha(e); return false; }
}
