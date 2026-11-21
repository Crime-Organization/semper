// Copiar a tarefa para outra demanda (#312): toda tarefa pertence a uma demanda e, para usá-la em outra, se faz uma cópia. A cópia
// nasce na demanda escolhida com o título, a descrição, o prazo (com a hora e o lembrete), a equipe (responsável, participantes e
// grupos), as pessoas do cadastro e os checklists da original, com os itens desmarcados e o cronômetro zerado (a cópia não tem
// tempo). O contrato é o da demanda de destino (a tarefa não fica num contrato diferente do da demanda); sem pessoas, a cópia leva os
// clientes da demanda, como ao ligar uma tarefa a ela. O processo e as etiquetas não vão: o prazo do processo é cumprido pela
// original. A original não muda. Sem tela nem banco: daqui saem os dados da cópia e os prazos dos itens dos checklists.
import type { DadosTarefa, DemandaParaEscolher, ListaDoCartao, Tarefa } from '../dados/tipos';
import { arvoreDaLista, emOrdemDeLeitura } from './gruposDaLista';
import { tarefaNaDemanda } from './ligarExistente';

/** O nome da ação, no ⋯ do cartão e no título da janela. */
export const COPIAR_PARA_OUTRA_DEMANDA = 'Copiar para outra demanda';
/** Embaixo da busca da demanda: o que vai na cópia. */
export const O_QUE_VAI_NA_COPIA = 'A cópia leva o título, a descrição, o prazo, as pessoas e os checklists (desmarcados), com o cronômetro zerado. '
  + 'Quem está na demanda escolhida passa a ver a cópia. Esta tarefa não muda.';

export type TarefaParaCopiar = Pick<Tarefa, 'titulo' | 'descricao' | 'prazo' | 'prazo_hora' | 'lembrete' | 'responsavel_id' | 'participantes' | 'grupos' | 'pessoas'>;
export type DemandaDaCopia = Pick<DemandaParaEscolher, 'id' | 'clientes' | 'contrato_id'>;

/** O que a cópia grava ao nascer na demanda `d` (sem a coluna do quadro: quem cria põe a coluna de início). */
export function dadosDaCopia(t: TarefaParaCopiar, d: DemandaDaCopia): DadosTarefa {
  const pessoas = t.pessoas.map(p => p.id);
  return {
    titulo: t.titulo, descricao: t.descricao, prazo: t.prazo, prazo_hora: t.prazo_hora, lembrete: t.lembrete,
    responsavel_id: t.responsavel_id, participantes: [...t.participantes], grupos: [...(t.grupos ?? [])], pessoas,
    ...tarefaNaDemanda({ pessoas, contrato_id: null }, d)
  };
}

/** Os itens do checklist na ordem de leitura (de cima para baixo, entrando nos grupos). */
const itensEmOrdem = (lista: Pick<ListaDoCartao, 'grupos' | 'itens'>) =>
  emOrdemDeLeitura(arvoreDaLista(lista)).flatMap(n => n.tipo === 'item' ? [n.item] : []);

/**
 * Os prazos dos itens que a cópia do checklist precisa gravar: a cópia nasce do mesmo modelo (os textos e os grupos, na mesma ordem
 * de leitura), e cada item dela recebe o prazo do item na mesma posição da original. Só os que têm prazo.
 */
export function prazosDosItensCopiados(original: Pick<ListaDoCartao, 'grupos' | 'itens'>, copia: Pick<ListaDoCartao, 'grupos' | 'itens'>) {
  const daCopia = itensEmOrdem(copia);
  return itensEmOrdem(original).flatMap((item, i) => item.prazo && daCopia[i] ? [{ id: daCopia[i].id, prazo: item.prazo }] : []);
}
