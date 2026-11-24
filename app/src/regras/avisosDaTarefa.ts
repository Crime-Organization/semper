// Os avisos da tarefa na caixa de Mensagens (#415, vem da #313): quem é posto como solicitante recebe "incluiu você"; o solicitante é
// avisado quando a tarefa que precisa de aprovação chega à coluna de aprovação; quem executa é avisado quando o solicitante a devolve,
// com o comentário. Quem recebe e quando, é o banco que decide (supabase/migrations/20261124033230_avisos_da_tarefa.sql); o banco
// fictício segue as mesmas regras por estas funções. Tudo puro, sem tela nem banco.
import type { AvisoDaTarefa, AvisoDaTarefaDaMensagem, FuncaoNaTarefa, MarcoColuna, Tarefa } from '../dados/tipos';
import { AVISO_DESFEITO } from '../ui/tempos';
import { INICIO_DA_DEVOLUCAO } from './aprovacaoDaTarefa';
import { enderecoDoComentario, trechoDaMensagem } from './mensagens';

/** O que a caixa mostra de cada aviso. Aviso novo = uma entrada nova. */
export interface TextoDoAvisoDaTarefa {
  /** O nome do aviso, nos rótulos para quem usa leitor de tela: "Marcar como lido o aviso de aprovação da tarefa X". */
  nome: string;
  /** O que quem fez fez, entre o nome dele e o da tarefa: "Ana incluiu você como solicitante da tarefa X". */
  acao: string;
  /** A segunda linha. */
  trecho: (a: Pick<AvisoDaTarefaDaMensagem, 'comentario'>) => string;
}
/** A segunda linha da devolução cujo comentário foi apagado. */
export const DEVOLUCAO_SEM_COMENTARIO = 'O comentário da devolução foi apagado.';
export const AVISOS_DA_TAREFA: Record<AvisoDaTarefa, TextoDoAvisoDaTarefa> = {
  solicitante: { nome: 'solicitante', acao: 'incluiu você como solicitante da tarefa', trecho: () => 'Agora você é o solicitante da tarefa.' },
  aprovacao: { nome: 'aprovação', acao: 'enviou para a sua aprovação a tarefa', trecho: () => 'Aprove ou devolva com um comentário do que falta.' },
  devolvida: { nome: 'devolução', acao: 'devolveu a tarefa', trecho: a => a.comentario ? trechoDaMensagem(textoDaDevolucao(a.comentario.texto)) : DEVOLUCAO_SEM_COMENTARIO }
};
/** O aviso de uma tarefa que a pessoa não vê mais (sem o título nem o link). */
export const TAREFA_QUE_NAO_VE = 'Este aviso é de uma tarefa que você não vê mais.';

/** O comentário da devolução sem o começo que o banco põe no cartão ("Tarefa devolvida: "). */
export const textoDaDevolucao = (texto: string) => texto.startsWith(INICIO_DA_DEVOLUCAO) ? texto.slice(INICIO_DA_DEVOLUCAO.length) : texto;

type TarefaDoAviso = NonNullable<AvisoDaTarefaDaMensagem['tarefa']>;
/** O nome da tarefa no aviso: o título; sem ele, o código. */
export const nomeDaTarefaDoAviso = (t: TarefaDoAviso) => t.titulo || t.codigo;
/** O endereço que abre o cartão da tarefa; na devolução, no comentário dela (quando ele ainda existe). */
export const enderecoDoAvisoDaTarefa = (tarefa: TarefaDoAviso, comentario: AvisoDaTarefaDaMensagem['comentario']) =>
  comentario ? enderecoDoComentario('tarefas', tarefa.id, comentario.id) : `/tarefas/?${new URLSearchParams({ id: tarefa.id })}`;

/**
 * Os rótulos da linha e do botão "Marcar como lida" (o botão começa pelo texto que aparece nele). Com a tarefa, têm quem fez e o nome
 * dela; sem ela, só o aviso, sem nada da tarefa.
 */
export function rotulosDoAvisoDaTarefa(a: Pick<AvisoDaTarefaDaMensagem, 'aviso' | 'tarefa'>, quem: string, situacao: string) {
  const texto = AVISOS_DA_TAREFA[a.aviso];
  if (!a.tarefa) {
    return { linha: `Aviso ${situacao}: ${TAREFA_QUE_NAO_VE.replace(/\.$/, '')}`, marcarLida: `Marcar como lido o aviso de ${texto.nome} de uma tarefa que você não vê mais` };
  }
  const nome = nomeDaTarefaDoAviso(a.tarefa);
  return { linha: `Aviso ${situacao}: ${quem} ${texto.acao} ${nome}`, marcarLida: `Marcar como lido o aviso de ${texto.nome} da tarefa ${nome}` };
}

// ---------- quem recebe (as mesmas contas do banco) ----------
/**
 * As trocas de solicitante que vêm a menos de AVISO_DESFEITO uma da outra (o desfazer, a troca logo corrigida) contam como uma só:
 * quem era o solicitante antes da primeira, quando ela começou e a última (em ms). Como privado.mudancas_do_solicitante.
 */
export interface SequenciaDoSolicitante { solicitante_antes: string | null; desde: number; em: number }
/**
 * Depois de uma troca de solicitante (de `antes` para `agora`), a sequência (a que vinha, com a última troca agora, ou uma nova) e
 * quem vale ser avisado: quem ficou de solicitante, se não era o de antes da sequência (null: ninguém). Quem usa apaga os avisos
 * de solicitante da sequência (os criados desde `desde`) que ninguém leu e que não são de quem vale, e avisa quem vale, se ele ainda
 * não tem um aviso da sequência. Como privado.aviso_do_solicitante.
 */
export function avisoDoSolicitante(anterior: SequenciaDoSolicitante | undefined, antes: string | null, agora: string | null, agoraMs: number) {
  const sequencia: SequenciaDoSolicitante = anterior && agoraMs - anterior.em < AVISO_DESFEITO
    ? { ...anterior, em: agoraMs }
    : { solicitante_antes: antes, desde: agoraMs, em: agoraMs };
  return { sequencia, vale: agora !== sequencia.solicitante_antes ? agora : null };
}

type ColunaDoQuadro = { id: string; marco?: MarcoColuna | null; de_aprovacao?: boolean };
type TarefaQueChega = Pick<Tarefa, 'precisa_aprovacao' | 'arquivado_em'>;
const aprovacaoDo = (colunas: readonly ColunaDoQuadro[]) => colunas.find(c => c.de_aprovacao)?.id;

/** A tarefa chegou à coluna de aprovação (de `de`, null: é nova, para `para`) e precisa de aprovação: o solicitante é avisado. */
export function chegouAAprovacao(t: TarefaQueChega, de: string | null, para: string | null, colunas: readonly ColunaDoQuadro[]) {
  const aprovacao = aprovacaoDo(colunas);
  return !!aprovacao && para === aprovacao && de !== aprovacao && t.precisa_aprovacao && !t.arquivado_em;
}

/**
 * A tarefa saiu da coluna de aprovação para outra que não a das concluídas: se foi quem a enviou, logo depois (menos de
 * AVISO_DESFEITO desde o aviso), é o Desfazer, e o aviso que o solicitante não leu sai.
 */
export function saiuDaAprovacao(de: string | null, para: string | null, colunas: readonly ColunaDoQuadro[]) {
  const aprovacao = aprovacaoDo(colunas);
  return !!aprovacao && de === aprovacao && para !== aprovacao && !colunas.some(c => c.id === para && c.marco === 'concluido');
}
/** O aviso de aprovação que o Desfazer apaga: não lido, de quem retirou a tarefa, e de menos de AVISO_DESFEITO. */
export const avisoDesfeito = (m: { lido_em: string | null; feito_por: string | null; criado_em: string }, quem: string, agoraMs: number) =>
  !m.lido_em && m.feito_por === quem && agoraMs - Date.parse(m.criado_em) < AVISO_DESFEITO;

/** Quem executa a tarefa, avisado da devolução: o responsável e os participantes com uma função de execução, sem repetir. */
export function quemExecuta(t: Pick<Tarefa, 'responsavel_id' | 'participantes' | 'funcoes'>, funcoes: readonly Pick<FuncaoNaTarefa, 'id' | 'executa'>[]) {
  const deExecucao = new Set(funcoes.filter(f => f.executa).map(f => f.id));
  const participantes = t.participantes.filter(p => deExecucao.has(t.funcoes?.[p] ?? ''));
  return [...new Set([t.responsavel_id, ...participantes].filter((p): p is string => !!p))];
}
