// Quando a última tarefa de uma demanda chega à coluna das concluídas, o sistema oferece levar a demanda para a
// coluna-marco "Concluído". Nada é movido sem o aceite de quem está mexendo (e dá para desfazer).
import { SD } from '../dados';
import { tarefasDaDemandaConcluidas } from '../regras/tarefa';
import { falha, feito } from '../ui/avisos';
import { confirmar } from '../ui/janela';
import { ordemNoFim } from '../ui/quadro/posicao';

/** As ofertas em andamento, uma depois da outra (veja oferecerConcluirDemanda). */
let fila: Promise<unknown> = Promise.resolve();
/** Quantas vezes a pergunta já apareceu, e para qual demanda foi a última. */
let perguntas = 0, ultimaDemanda = '';

/**
 * Chame depois de mover a tarefa. Só pergunta se ela foi para a coluna das concluídas, está ligada a uma demanda que
 * quem está logado vê, a demanda ainda não está concluída e todas as tarefas ativas dela estão concluídas.
 * Devolve true se a demanda foi movida.
 * Uma oferta espera a anterior terminar: marcando duas tarefas seguidas, a conferência da primeira já veria a segunda
 * concluída, e as duas perguntariam. Na fila, a segunda confere depois: se, enquanto esperava, a pergunta já apareceu
 * para a mesma demanda (aceita ou não), ela não pergunta de novo.
 */
export function oferecerConcluirDemanda(tarefaId: string, etapaId: string | null): Promise<boolean> {
  const jaFeitas = perguntas;
  const vez = fila.then(() => perguntar(tarefaId, etapaId, jaFeitas));
  fila = vez;
  return vez;
}

async function perguntar(tarefaId: string, etapaId: string | null, jaFeitas: number): Promise<boolean> {
  try {
    const concluida = (await SD.colunasListar('tarefas')).find(c => c.marco === 'concluido')?.id ?? null;
    if (!concluida || etapaId !== concluida) return false;
    const demanda = (await SD.tarefaObter(tarefaId))?.demanda;
    if (!demanda) return false;
    if (perguntas !== jaFeitas && ultimaDemanda === demanda.id) return false;
    const fim = (await SD.colunasListar('demandas')).find(c => c.marco === 'concluido');
    if (!fim || demanda.etapa_id === fim.id) return false;
    if (!tarefasDaDemandaConcluidas(await SD.tarefasDaDemanda(demanda.id), concluida)) return false;
    perguntas++; ultimaDemanda = demanda.id;
    const sim = await confirmar('Concluir a demanda?',
      `Todas as tarefas da demanda "${demanda.titulo}" estão concluídas. Quer levar a demanda para "${fim.nome}"?`, 'Concluir a demanda');
    if (!sim) return false;
    const antes = demanda.etapa_id;
    await SD.demandaMover(demanda.id, fim.id, ordemNoFim());
    feito(`Demanda ${demanda.codigo} foi para "${fim.nome}".`, 'conclusão da demanda', async () => { await SD.demandaMover(demanda.id, antes, ordemNoFim()); });
    return true;
  } catch (e) { falha(e); return false; }
}
