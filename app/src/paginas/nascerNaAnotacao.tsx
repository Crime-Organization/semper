// A anotação de onde o cadastro foi aberto (#376), pelo "+ Novo…" da seção "Ligada a" (?anotacao=<id>): a tarefa, a demanda, o
// compromisso e o contrato a usam do mesmo jeito. O cadastro lê a anotação (o aviso do topo diz de onde o item nasce ou, com ela
// arquivada ou cheia, que ele não fica ligado), e ao salvar liga o item novo a ela e volta ao cartão dela. Se a ligação falhar
// depois de gravar, o item fica, o aviso do pé diz o que faltou e a tela vai ao cartão do item novo. Os textos e as decisões ficam
// em regras/nascerLigado.ts; a pessoa única da anotação já vem no endereço (regras/novoNaAnotacao.ts). A pessoa nova tem o cadastro
// dela (novaPessoa/origem.ts).
import { useEffect, useState } from 'react';
import { SD, type ModuloDaAnotacao } from '../dados';
import { depoisDeCriar } from '../regras/origemDoCadastro';
import {
  aoSalvarPelaOrigem, avisoDaLigacaoQueFalhou, origemDaAnotacao, origemRecusada, textoDaOrigem, type OrigemDoItem, type QueNasceNaAnotacao
} from '../regras/nascerLigado';
import { PARAMETRO_DA_ANOTACAO_DE_ORIGEM } from '../regras/novoNaAnotacao';
import { avisar, falha } from '../ui/avisos';
import { Aviso } from '../ui/base';

/** O módulo do item que nasce, como a anotação o liga. */
const MODULO_DO_QUE_NASCE: Record<QueNasceNaAnotacao, ModuloDaAnotacao> = { tarefa: 'tarefas', demanda: 'demandas', compromisso: 'compromissos', contrato: 'contratos' };

/** O id da anotação de origem no endereço do cadastro (na atualização de um item, não há origem). */
export const anotacaoNoEndereco = (params: Pick<URLSearchParams, 'get'>, atualizando: boolean) =>
  atualizando ? null : params.get(PARAMETRO_DA_ANOTACAO_DE_ORIGEM);

/** Lê a anotação de origem: null enquanto lê, sem origem ou se ela não foi achada (aí o cadastro segue como o comum). */
export function useAnotacaoDeOrigem(id: string | null, nasce: QueNasceNaAnotacao) {
  const [origem, setOrigem] = useState<OrigemDoItem | null>(null);
  useEffect(() => {
    if (!id) return;
    let vale = true;
    Promise.all([SD.anotacaoObter(id), SD.anotacaoItens(id)])
      .then(([a, itens]) => { if (vale && a) setOrigem(origemDaAnotacao(a, itens.visiveis.length + itens.ocultos, nasce)); })
      .catch(falha);
    return () => { vale = false; };
  }, [id, nasce]);
  return origem;
}

/**
 * Depois de criar o item: liga-o à anotação de origem (se ela aceita) e diz para onde a tela vai: o cartão da anotação, onde ele
 * aparece em "Ligada a", ou, sem a ligação, o cartão do item novo (`doCriado`).
 */
export async function depoisDeCriarNaAnotacao(origem: OrigemDoItem | null, nasce: QueNasceNaAnotacao, itemId: string, doCriado: string) {
  if (!origem || !aoSalvarPelaOrigem(origem, '', doCriado).liga) return doCriado;
  let ligado = false;
  try {
    // false: o item já estava ligado (outra aba ligou antes); a ligação existe do mesmo jeito.
    await SD.anotacaoLigar(origem.id, MODULO_DO_QUE_NASCE[nasce], itemId);
    ligado = true;
  } catch (e) { avisar(avisoDaLigacaoQueFalhou(`anotação: ${nasce}`, origem.codigo, e), 'erro'); }
  return depoisDeCriar(origem.cartao, ligado, doCriado);
}

/** O aviso do topo do cadastro: de onde o item nasce ou, com a anotação arquivada ou cheia, que ele não fica ligado a ela. */
export function AvisoDaAnotacaoDeOrigem({ origem }: { origem: OrigemDoItem | null }) {
  if (!origem) return null;
  const [antes, depois] = textoDaOrigem(origem);
  return <Aviso tipo={origemRecusada(origem) ? 'erro' : 'info'}>{antes} <b>{origem.codigo}</b> ({origem.nome}){depois}</Aviso>;
}
