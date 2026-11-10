// Função de cada membro da equipe e o que ela permite no contrato (supabase/migrations/20261027000015_funcao_na_equipe.sql).
// A função é diferente do papel no sistema: administrador é quem gere a equipe e vê tudo; "administrativo" é uma função.
import { TAMANHO_NOME_DA_EQUIPE } from '../dados/limites';
import type { Funcao, Membro, RecusaDaReserva, Usuario } from '../dados/tipos';
import { normal } from './texto';

/** O que há de errado com o nome de alguém da equipe (o mesmo que o banco confere), ou null se está bom. */
export function erroDoNomeDaEquipe(nome: string): string | null {
  const limpo = nome.trim();
  return limpo.length < TAMANHO_NOME_DA_EQUIPE.minimo || limpo.length > TAMANHO_NOME_DA_EQUIPE.maximo
    ? `Informe um nome de ${TAMANHO_NOME_DA_EQUIPE.minimo} a ${TAMANHO_NOME_DA_EQUIPE.maximo} letras.` : null;
}

export const FUNCOES: Record<Funcao, string> = { advogado: 'Advogado', administrativo: 'Administrativo', estagiario: 'Estagiário' };
/** Função de quem entra na equipe, até um administrador ajustar (o padrão do banco). */
export const FUNCAO_INICIAL: Funcao = 'advogado';

const funcaoDe = (m: Membro) => m.funcao ?? FUNCAO_INICIAL;
const ativo = (m: Membro) => m.ativo !== false;

/** Quem consta nos contratos: quem está ativo e quem tem conta reservada, que não entra no sistema mas faz parte da equipe. Quem foi excluído, não. */
const constaNosContratos = (m: Membro) => !m.excluido && (ativo(m) || !!m.reservada);

/**
 * Por que a pessoa não pode receber acesso nem conta reservada (null se pode): quem foi excluído da equipe não volta (o banco
 * recusa), e quem já tem acesso ou convite já tem.
 */
export function motivoParaNaoDarAcesso(pessoaId: string, equipe: Membro[], comAcessoOuConvite: (string | null)[]): string | null {
  if (equipe.some(m => m.excluido && m.pessoa_id === pessoaId)) return 'foi excluída da equipe e não volta';
  return comAcessoOuConvite.includes(pessoaId) ? 'já tem acesso ou convite' : null;
}

/** O nome de alguém da equipe nos registros: quem foi excluído continua com o nome, marcado. */
export const nomeNaEquipe = (nome: string, excluido = false) => excluido ? `${nome} (excluído)` : nome;

/**
 * Se quem está logado pode excluir este usuário: a regra de desativar (nunca a si mesmo nem um master; um administrador, só o
 * master), e só depois de desativado, ou se a conta é reservada (que já não tem acesso). O banco confere de novo (public.equipe_excluir).
 */
export const podeExcluir = (u: Pick<Usuario, 'id' | 'papel' | 'ativo'>, eu: string, souMaster: boolean) =>
  !u.ativo && u.id !== eu && u.papel !== 'master' && (u.papel !== 'admin' || souMaster);

/** Quem pode ser o responsável: os advogados que constam nos contratos e quem já é o responsável (mesmo que não seja mais, para não sair sem querer). */
export const opcoesDeResponsavel = (equipe: Membro[], atual = '') =>
  equipe.filter(m => (constaNosContratos(m) && funcaoDe(m) === 'advogado') || m.id === atual);

/** Por que a pessoa não pode entrar como participante (null se pode): o participante é sempre alguém da equipe que consta nos contratos. */
export function motivoParaNaoParticipar(equipe: Membro[], pessoaId: string): string | null {
  const m = equipe.find(x => x.pessoa_id === pessoaId);
  return !m ? 'não é da equipe' : !constaNosContratos(m) ? 'desativado na equipe' : null;
}

/**
 * Quem da equipe pode ser adicionado a uma lista (participantes, colaboradores, responsáveis da pessoa): quem está ativo,
 * ainda não está na lista nem foi deixado de fora (o responsável), e tem no nome todas as palavras digitadas, sem diferença
 * de maiúsculas e acentos. Sem nada digitado, vêm todos os que podem entrar. Em ordem alfabética.
 */
export function candidatosDaEquipe(equipe: Membro[], termo: string, fora: string[]): Membro[] {
  const palavras = normal(termo).split(/\s+/).filter(Boolean);
  return equipe
    .filter(m => ativo(m) && !fora.includes(m.id) && palavras.every(p => normal(m.nome).includes(p)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** O que a tela diz quando a conta reservada não é criada (cada resposta da função equipe-reservar-conta). */
export const RECUSA_DA_RESERVA: Record<RecusaDaReserva, string> = {
  'sem-permissao': 'Você não pode reservar uma conta para esta pessoa.',
  'ja-na-equipe': 'Esta pessoa já faz parte da equipe.',
  'convite-pendente': 'Esta pessoa já tem um convite pendente. Cancele o convite para reservar a conta.',
  erro: 'Não foi possível reservar a conta agora. Tente de novo.'
};
