// A aprovação interna da tarefa (#313, decisão do dono): só vale para a tarefa com a caixa "Precisa de aprovação" marcada (o cadastro
// a marca sozinho quando o solicitante é outra pessoa que não o responsável). Concluída por quem não aprova, ela espera na coluna de
// aprovação ("Aguardando: análise do solicitante"); só o solicitante ou um administrador aprova (ela vai para as concluídas) ou devolve,
// com um comentário (ela volta para "Fazendo"). As mesmas regras estão no banco (supabase/migrations/20261123013306_tarefa_aprovacao.sql).
// Sem tela nem banco.
import { TAMANHO_TAREFA } from '../dados/limites';
import type { MarcoColuna, Membro, Tarefa } from '../dados/tipos';
import { chaveDaColuna } from './colunasPadrao';

type ComAprovacao = Pick<Tarefa, 'precisa_aprovacao' | 'solicitante_id'>;
type ColunaDoQuadro = { id: string; nome?: string; marco?: MarcoColuna | null; de_aprovacao?: boolean };
type QuemAprova = Pick<Membro, 'id' | 'papel'>;

/** A recusa de quem não aprova (a mesma do banco). */
export const SO_QUEM_PEDIU_APROVA = 'Só quem pediu a tarefa ou um administrador aprova ou devolve.';
/** A recusa de quem executa e tenta tirar a aprovação ou trocar o solicitante (a mesma do banco). */
export const SO_QUEM_PEDIU_MUDA_A_APROVACAO = 'Só quem pediu a tarefa ou um administrador muda a aprovação ou o solicitante dela.';
/** A recusa de aprovar ou devolver a tarefa que não está esperando (a mesma do banco). */
export const NAO_ESPERA_APROVACAO = 'Esta tarefa não está esperando aprovação.';
/** A recusa da devolução sem comentário (a mesma do banco). */
export const SEM_COMENTARIO_DA_DEVOLUCAO = 'Diga o que precisa ser ajustado.';
/** A recusa do comentário comprido demais (a mesma do banco). */
export const DEVOLUCAO_LONGA = `O comentário da devolução pode ter até ${TAMANHO_TAREFA.devolucao} caracteres.`;
/** Como o comentário da devolução começa no cartão (o mesmo do banco). */
export const INICIO_DA_DEVOLUCAO = 'Tarefa devolvida: ';
/** O nome da coluna para onde a tarefa devolvida volta (sem ela, a do início). */
export const COLUNA_DA_DEVOLUCAO = 'Fazendo';

/** O aviso de quem concluiu e a tarefa foi para a aprovação. */
export const ENVIADA_PARA_APROVACAO = 'Tarefa enviada para a aprovação de quem a pediu.';
/** Os avisos de quem aprova. */
export const AVISO_DA_APROVACAO = { aprovada: 'Tarefa aprovada e concluída.', devolvida: 'Tarefa devolvida, com o seu comentário.' };

/** Se quem está logado aprova a tarefa: é o solicitante dela ou um administrador. */
export const aprovaATarefa = (t: Pick<Tarefa, 'solicitante_id'>, m: QuemAprova) =>
  m.papel === 'master' || m.papel === 'admin' || (!!t.solicitante_id && t.solicitante_id === m.id);

/** A caixa "Precisa de aprovação" vem marcada quando o solicitante é outra pessoa que não o responsável (quem executa). */
export const aprovacaoPadrao = (solicitanteId: string, responsavelId: string) => !!solicitanteId && solicitanteId !== responsavelId;

/** A coluna de aprovação do quadro (undefined se ele não a tem). */
export const colunaDeAprovacao = <C extends ColunaDoQuadro>(colunas: readonly C[]) => colunas.find(c => c.de_aprovacao);

/** Se a tarefa está esperando aprovação: tem a caixa e está na coluna de aprovação. */
export const esperaAprovacao = (t: ComAprovacao & Pick<Tarefa, 'etapa_id' | 'arquivado_em'>, colunas: readonly ColunaDoQuadro[]) =>
  t.precisa_aprovacao && !t.arquivado_em && !!t.etapa_id && colunaDeAprovacao(colunas)?.id === t.etapa_id;

/**
 * Para onde a tarefa vai quando alguém a leva à coluna `etapa` (como o gatilho aa_aprovacao do banco): a que precisa de aprovação e
 * é levada às concluídas por quem não aprova vai para a coluna de aprovação (se o quadro a tem). Nos outros casos, para `etapa`.
 */
export function etapaComAprovacao(t: ComAprovacao, etapa: string | null, colunas: readonly ColunaDoQuadro[], quem: QuemAprova): string | null {
  const vaiConcluir = !!etapa && colunas.some(c => c.id === etapa && c.marco === 'concluido');
  if (!t.precisa_aprovacao || !vaiConcluir || aprovaATarefa(t, quem)) return etapa;
  return colunaDeAprovacao(colunas)?.id ?? etapa;
}

/**
 * Confere a gravação que mexe na caixa ou no solicitante (como o banco): com a aprovação, antes ou depois, só quem aprova (pelo
 * solicitante de antes) muda um dos dois. Recusa com a mensagem do banco.
 */
export function conferirMudancaDaAprovacao(novo: Partial<ComAprovacao>, antes: ComAprovacao, quem: QuemAprova) {
  const precisa = novo.precisa_aprovacao ?? antes.precisa_aprovacao;
  const mudou = (novo.precisa_aprovacao !== undefined && novo.precisa_aprovacao !== antes.precisa_aprovacao)
    || (novo.solicitante_id !== undefined && (novo.solicitante_id ?? null) !== (antes.solicitante_id ?? null));
  if ((antes.precisa_aprovacao || precisa) && mudou && !aprovaATarefa(antes, quem)) throw new Error(SO_QUEM_PEDIU_MUDA_A_APROVACAO);
}

/** O comentário da devolução como o banco grava (sem espaços nas pontas), ou a recusa. */
export function comentarioDaDevolucao(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) throw new Error(SEM_COMENTARIO_DA_DEVOLUCAO);
  if (limpo.length > TAMANHO_TAREFA.devolucao) throw new Error(DEVOLUCAO_LONGA);
  return INICIO_DA_DEVOLUCAO + limpo;
}

/** O erro do comentário da devolução enquanto se digita (null: pode devolver). */
export function erroDaDevolucao(texto: string): string | null {
  try { comentarioDaDevolucao(texto); return null; } catch (e) { return (e as Error).message; }
}

/**
 * Para onde a tarefa devolvida volta (como public.tarefa_devolver): a coluna comum chamada "Fazendo" (sem contar acentos e sinais;
 * a primeira, pela ordem) ou, sem ela, a coluna do início. undefined: o quadro não tem nenhuma das duas.
 */
export const colunaDaDevolucao = <C extends ColunaDoQuadro & { ordem: number }>(colunas: readonly C[]) =>
  colunas.filter(c => !c.marco && !c.de_aprovacao && chaveDaColuna(c.nome ?? '') === chaveDaColuna(COLUNA_DA_DEVOLUCAO)).sort((a, b) => a.ordem - b.ordem)[0]
  ?? colunas.find(c => c.marco === 'inicio');
