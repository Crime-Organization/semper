// Quando a última tarefa de uma demanda chega à coluna das concluídas, o sistema oferece levar a demanda para a
// coluna-marco "Concluído". Nada é movido sem o aceite de quem está mexendo (e dá para desfazer). Quando a demanda chega lá,
// o sistema pergunta se quer criar o processo dela.
import { SD } from '../dados';
import { devePerguntarProcesso } from '../regras/processoDaDemanda';
import { tarefasDaDemandaConcluidas } from '../regras/tarefa';
import { avisar, falha, feito } from '../ui/avisos';
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
export function oferecerConcluirDemanda(tarefaId: string, etapaId: string | null, navegar: (para: string) => void): Promise<boolean> {
  const jaFeitas = perguntas;
  const vez = fila.then(() => perguntar(tarefaId, etapaId, jaFeitas, navegar));
  fila = vez;
  return vez;
}

/** Chame depois de mover a demanda. Se ela chegou à coluna das concluídas e ainda não tem processo, pergunta se quer criar. */
export async function oferecerProcesso(d: { id: string; titulo: string }, etapaId: string | null, navegar: (para: string) => void) {
  try {
    const [ctx, colunas, ligados, atual] = await Promise.all([SD.contexto(), SD.colunasListar('demandas'), SD.processosDaDemanda(d.id), SD.demandaObter(d.id)]);
    const concluida = colunas.find(c => c.marco === 'concluido')?.id ?? null;
    if (!devePerguntarProcesso({ modulo: !!ctx?.escritorio?.modulos?.processos, arquivada: !atual || !!atual.arquivado_em, etapa: etapaId, concluida, ligados: ligados.visiveis.length + ligados.ocultos })) return;
    const sim = await confirmar('Criar o processo?', `A demanda "${d.titulo}" foi concluída. Quer criar o processo dela agora?`, 'Criar processo');
    if (!sim) return;
    // Enquanto a pergunta estava aberta, a conclusão pode ter sido desfeita.
    const agora = await SD.demandaObter(d.id);
    if (agora?.etapa_id !== concluida) { avisar('A demanda não está mais concluída. O processo não foi aberto.', 'erro'); return; }
    navegar('/processos/novo/?demanda=' + d.id);
  } catch (e) { falha(e); }
}

async function perguntar(tarefaId: string, etapaId: string | null, jaFeitas: number, navegar: (para: string) => void): Promise<boolean> {
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
    // Sem esperar a resposta: o cartão já mostra a demanda concluída enquanto a pergunta está aberta.
    void oferecerProcesso(demanda, fim.id, navegar);
    return true;
  } catch (e) { falha(e); return false; }
}
