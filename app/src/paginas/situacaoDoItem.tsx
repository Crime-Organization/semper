// Mudar a tarefa ou a demanda de coluna (a Situação), num lugar só: o menu e o ✓ do cartão (#397) e o círculo antes do título, na
// miniatura do quadro e na linha da tabela (#350), gravam igual. Leva o item para a coluna (no fim da ordem manual), mostra o aviso
// com o Desfazer e, depois, faz o que o módulo oferece: a tarefa ligada a uma demanda pergunta se conclui a demanda; a demanda
// concluída pergunta se cria o processo. Concluir e Reabrir levam às colunas-marco (regras/conclusaoNoCartao.ts), com os nomes
// que o escritório deu a elas.
import { useNavigate } from 'react-router';
import { SD } from '../dados';
import type { Coluna } from '../dados';
import {
  avisoDaConclusao, circuloDoItem, colunaDaAcao, CONCLUIDA_NO_ITEM, type AcaoDeConclusao, type ModuloQueConclui
} from '../regras/conclusaoNoCartao';
import { falha, feito, sinalizarMudanca } from '../ui/avisos';
import { ConcluirNaMiniatura } from '../ui/quadro/ConcluirNaMiniatura';
import { ordemNoFim } from '../ui/quadro/posicao';
import { oferecerConcluirDemanda, oferecerProcesso } from './concluirDemanda';

/** O item que muda de coluna: o que a gravação, o Desfazer e as ofertas precisam. `etapa_id` e `etapa_ordem` são onde ele está
 *  agora (o Desfazer o devolve para lá). */
export interface ItemQueMuda {
  id: string;
  titulo: string;
  etapa_id: string | null;
  etapa_ordem: number | null;
  /** A tarefa ligada a uma demanda (na demanda, não se aplica). */
  ligadoADemanda?: boolean;
}

type Navegar = (para: string) => void;

/** Como cada módulo grava a coluna nova. */
const MOVER: Record<ModuloQueConclui, (id: string, etapa: string | null, ordem: number | null) => Promise<void>> = {
  tarefas: (id, etapa, ordem) => SD.tarefaMover(id, etapa, ordem),
  demandas: (id, etapa, ordem) => SD.demandaMover(id, etapa, ordem)
};

/** O que cada módulo oferece depois de mudar de coluna: a tarefa, concluir a demanda dela; a demanda, criar o processo. As duas só
 *  perguntam se o item chegou à coluna das concluídas (e o resto das condições delas vale). */
const OFERTA: Record<ModuloQueConclui, (item: ItemQueMuda, etapa: string | null, navegar: Navegar) => Promise<unknown>> = {
  tarefas: (item, etapa, navegar) => item.ligadoADemanda ? oferecerConcluirDemanda(item.id, etapa, navegar) : Promise.resolve(),
  demandas: (item, etapa, navegar) => oferecerProcesso(item, etapa, navegar)
};

/**
 * Leva o item para a coluna `etapa` (no fim da ordem manual), com o aviso e o Desfazer (que o devolve para onde estava). Depois,
 * `depois` (o cartão se relê; a miniatura avisa a página) e a oferta do módulo. Devolve se gravou; se o banco recusa, avisa o erro
 * e não faz mais nada.
 */
export async function mudarSituacaoDoItem(modulo: ModuloQueConclui, item: ItemQueMuda, etapa: string | null, aviso: string,
  navegar: Navegar, depois?: (ordem: number) => unknown): Promise<boolean> {
  const ordem = ordemNoFim();
  try {
    await MOVER[modulo](item.id, etapa, ordem);
    feito(aviso, 'mudança de situação', async () => { await MOVER[modulo](item.id, item.etapa_id, item.etapa_ordem); });
    await depois?.(ordem);
    await OFERTA[modulo](item, etapa, navegar);
    return true;
  } catch (e) {
    falha(e);
    return false;
  }
}

/** Concluir leva à coluna das concluídas (a do marco, qualquer que seja o nome); Reabrir, de volta à do início. Sem a coluna da
 *  ação no quadro, nada é gravado. */
export function concluirOuReabrirItem(modulo: ModuloQueConclui, colunas: Coluna[], item: ItemQueMuda, acao: AcaoDeConclusao,
  navegar: Navegar, depois?: (ordem: number) => unknown): Promise<boolean> {
  const coluna = colunaDaAcao(colunas, acao);
  return coluna ? mudarSituacaoDoItem(modulo, item, coluna.id, avisoDaConclusao(modulo, acao, coluna.nome), navegar, depois) : Promise.resolve(false);
}

interface PropsConcluirItem {
  modulo: ModuloQueConclui;
  /** As colunas do quadro daquele escritório (com as colunas-marco). */
  colunas: Coluna[];
  item: ItemQueMuda;
  /** Quem altera o item, com ele ativo; senão, o círculo só mostra o visto do concluído (ou nada). */
  podeAgir: boolean;
}

/** O círculo de concluir de um item do quadro ou da tabela (#350), já ligado à gravação comum: depois de gravar, a página (o quadro
 *  ou a tabela) e o cartão aberto se releem. */
export function ConcluirItem({ modulo, colunas, item, podeAgir }: PropsConcluirItem) {
  const navegar = useNavigate();
  return <ConcluirNaMiniatura id={item.id} titulo={item.titulo} estado={circuloDoItem(colunas, item.etapa_id, podeAgir)}
    concluida={CONCLUIDA_NO_ITEM[modulo]}
    aoAgir={acao => concluirOuReabrirItem(modulo, colunas, item, acao, navegar, () => sinalizarMudanca({ tipo: 'situacaoMudou', id: item.id }))} />;
}
