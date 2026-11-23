// Mudar a tarefa ou a demanda de coluna (a Situação), num lugar só: o menu e o ✓ do cartão (#397) e o círculo antes do título, na
// miniatura do quadro e na linha da tabela (#350), gravam igual. Leva o item para a coluna (no fim da ordem manual), mostra o aviso
// com o Desfazer e, depois, faz o que o módulo oferece: a tarefa que cumpre um prazo de processo pergunta se ele foi cumprido (ou,
// reaberta, se volta a ficar aberto, #355), e a ligada a uma demanda pergunta se conclui a demanda; a demanda concluída pergunta se
// cria o processo. Concluir e Reabrir levam às colunas-marco (regras/conclusaoNoCartao.ts), com os nomes que o escritório deu a
// elas. O arrastar no quadro e a caixa da tarefa no cartão da demanda gravam do jeito deles, mas fazem as mesmas ofertas
// (oferecerDepoisDeMudar).
import { useContext } from 'react';
import { useNavigate } from 'react-router';
import { SD } from '../dados';
import type { Coluna } from '../dados';
import {
  avisoDaConclusao, circuloDoItem, colunaDaAcao, CONCLUIDA_NO_ITEM, type AcaoDeConclusao, type ModuloQueConclui
} from '../regras/conclusaoNoCartao';
import { ENVIADA_PARA_APROVACAO } from '../regras/aprovacaoDaTarefa';
import { falha, feito, sinalizarMudanca } from '../ui/avisos';
import { ConcluirNaMiniatura } from '../ui/quadro/ConcluirNaMiniatura';
import { MoverNoQuadro } from '../ui/quadro/moverNoQuadro';
import { ordemNoFim } from '../ui/quadro/posicao';
import { oferecerConcluirDemanda, oferecerProcesso } from './concluirDemanda';
import { oferecerPrazoDoProcesso } from './prazoDaTarefa';

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

/** Como cada módulo grava a coluna nova, e a coluna em que o item ficou: a tarefa que precisa de aprovação, concluída por quem não
 *  aprova, fica na coluna de aprovação (#313). */
const MOVER: Record<ModuloQueConclui, (id: string, etapa: string | null, ordem: number | null) => Promise<string | null>> = {
  tarefas: (id, etapa, ordem) => SD.tarefaMover(id, etapa, ordem),
  demandas: (id, etapa, ordem) => SD.demandaMover(id, etapa, ordem).then(() => etapa)
};

/** O que cada módulo oferece depois de mudar de coluna: a tarefa, cumprir (ou reabrir) o prazo do processo que ela cumpre e, depois,
 *  concluir a demanda dela; a demanda, criar o processo. Cada oferta confere as condições dela (a coluna de chegada, entre outras).
 *  Devolve se a tarefa levou a demanda à coluna das concluídas. */
const OFERTA: Record<ModuloQueConclui, (item: ItemQueMuda, etapa: string | null, navegar: Navegar) => Promise<boolean>> = {
  tarefas: async (item, etapa, navegar) => {
    await oferecerPrazoDoProcesso(item.id, item.etapa_id, etapa);
    return item.ligadoADemanda ? oferecerConcluirDemanda(item.id, etapa, navegar) : false;
  },
  demandas: (item, etapa, navegar) => oferecerProcesso(item, etapa, navegar).then(() => false)
};

/**
 * As ofertas do módulo depois que o item mudou de coluna por um caminho que grava do seu jeito (o arrastar no quadro, a caixa da
 * tarefa no cartão da demanda). `item.etapa_id` é a coluna de onde ele saiu; `etapa`, a de agora. Devolve se a tarefa levou a demanda
 * à coluna das concluídas.
 */
export const oferecerDepoisDeMudar = (modulo: ModuloQueConclui, item: ItemQueMuda, etapa: string | null, navegar: Navegar) =>
  OFERTA[modulo](item, etapa, navegar);

/**
 * Leva o item para a coluna `etapa` (no fim da ordem manual), com o aviso e o Desfazer (que o devolve para onde estava). Depois,
 * `depois` (o cartão se relê; no quadro, a miniatura muda de coluna na tela; na tabela, a página relê), com a ordem e a coluna
 * novas, e a oferta do módulo. Se o banco deixou o item em outra coluna (a tarefa que vai para a aprovação, #313), vale a coluna em
 * que ele ficou, com o aviso dela. Devolve se gravou; se o banco recusa, avisa o erro e não faz mais nada.
 */
export async function mudarSituacaoDoItem(modulo: ModuloQueConclui, item: ItemQueMuda, etapa: string | null, aviso: string,
  navegar: Navegar, depois?: (ordem: number, etapa: string | null) => unknown): Promise<boolean> {
  const ordem = ordemNoFim();
  try {
    const ficou = await MOVER[modulo](item.id, etapa, ordem);
    feito(ficou === etapa ? aviso : ENVIADA_PARA_APROVACAO, 'mudança de situação', async () => { await MOVER[modulo](item.id, item.etapa_id, item.etapa_ordem); });
    await depois?.(ordem, ficou);
    await OFERTA[modulo](item, ficou, navegar);
    return true;
  } catch (e) {
    falha(e);
    return false;
  }
}

/** Concluir leva à coluna das concluídas (a do marco, qualquer que seja o nome); Reabrir, de volta à do início. Sem a coluna da
 *  ação no quadro, nada é gravado. */
export function concluirOuReabrirItem(modulo: ModuloQueConclui, colunas: Coluna[], item: ItemQueMuda, acao: AcaoDeConclusao,
  navegar: Navegar, depois?: (ordem: number, etapa: string | null) => unknown): Promise<boolean> {
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

/** O círculo de concluir de um item do quadro ou da tabela (#350), já ligado à gravação comum. Depois de gravar: no quadro, a
 *  miniatura só muda de coluna na tela, como no arrastar (o quadro não é relido: a coluna com "Carregar mais" fica como está, e o
 *  foco de quem usa o teclado não se perde); na tabela, a página e o cartão aberto se releem. */
export function ConcluirItem({ modulo, colunas, item, podeAgir }: PropsConcluirItem) {
  const navegar = useNavigate();
  const moverNaTela = useContext(MoverNoQuadro);
  const depois = (peloTeclado: boolean) => (ordem: number, etapa: string | null) => moverNaTela
    ? moverNaTela(item.id, etapa, ordem, peloTeclado)
    : sinalizarMudanca({ tipo: 'situacaoMudou', id: item.id });
  return <ConcluirNaMiniatura id={item.id} titulo={item.titulo} estado={circuloDoItem(colunas, item.etapa_id, podeAgir)}
    concluida={CONCLUIDA_NO_ITEM[modulo]}
    aoAgir={(acao, peloTeclado) => concluirOuReabrirItem(modulo, colunas, item, acao, navegar, depois(peloTeclado))} />;
}
