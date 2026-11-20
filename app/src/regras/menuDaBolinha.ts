// O menu da bolinha da equipe no topo do cartão (#388, pedido do dono): o clique numa bolinha não tira mais ninguém na hora; abre
// um menu com o nome e o papel de quem está nela e o que dá para fazer. Quem chama a peça (EquipeDoCartao) diz quais ações cada
// bolinha tem, por esta tabela (o lugar de quem está na bolinha): tipo novo de bolinha = entrada nova, sem mexer nas outras.
// A ação que não pode ser feita aparece no menu com o motivo, no lugar dela.
import type { Membro } from '../dados/tipos';

/** O que o menu de uma bolinha pode oferecer. */
export type AcaoDaBolinha = 'tornarResponsavel' | 'trocarResponsavel' | 'tirar' | 'verPerfil';

/**
 * Onde está quem a bolinha mostra: o responsável do item, um participante (ou colaborador) ou um dos responsáveis da pessoa
 * (#387: vários, todos iguais, sem um principal).
 */
export type LugarNaEquipe = 'responsavel' | 'participante' | 'responsavelDaPessoa';

/**
 * As ações de cada bolinha, na ordem do menu. Decisão do dono (#388): ao tornar um participante responsável, o responsável de
 * antes continua no item como participante. O responsável não sai pelo menu (ele é obrigatório): só se troca. A pessoa não tem
 * responsável principal, e por isso não há "tornar" nem "trocar".
 */
export const ACOES_NA_BOLINHA: Record<LugarNaEquipe, readonly AcaoDaBolinha[]> = {
  responsavel: ['trocarResponsavel', 'verPerfil'],
  participante: ['tornarResponsavel', 'tirar', 'verPerfil'],
  responsavelDaPessoa: ['tirar', 'verPerfil']
};

/**
 * As ações da tabela sem as que não valem ali: no contrato, "Tornar responsável" para quem não é advogado; na anotação nova, ainda
 * não gravada, "Ver perfil" (o link fecharia a anotação, e o que foi escrito se perderia).
 */
export const acoesSem = (acoes: readonly AcaoDaBolinha[], ...fora: AcaoDaBolinha[]) => acoes.filter(a => !fora.includes(a));

/** O nome de cada ação no menu ("Tirar" vem de quem chama, porque muda com o item e com quem é: "Tirar da tarefa", "Sair da tarefa"). */
export const NOME_DA_ACAO: Record<Exclude<AcaoDaBolinha, 'tirar'>, string> = {
  tornarResponsavel: 'Tornar responsável',
  trocarResponsavel: 'Trocar o responsável',
  verPerfil: 'Ver perfil'
};

/** O endereço do perfil de alguém, ou o motivo de não poder abri-lo; null: não há perfil para ver (o usuário foi excluído). */
export type PerfilNaBolinha = { para: string } | { motivo: string } | null;

/** Por que o "Ver perfil" de outra pessoa não abre para quem não é administrador: a página do perfil da equipe é só deles. */
export const PERFIL_SO_DE_ADMINISTRADOR = 'Só um administrador abre o perfil de outra pessoa.';

/**
 * Onde fica o perfil profissional de quem está na bolinha: o próprio, em Minha conta; o de outra pessoa, na página do perfil da
 * equipe (a mesma de "Equipe e acessos"), que só o administrador abre. Quem foi excluído não tem mais perfil.
 */
export function perfilNaBolinha(perfilId: string, quem: { eu: string; ehAdmin: boolean }, equipe: readonly Membro[]): PerfilNaBolinha {
  if (!equipe.some(m => m.id === perfilId && !m.excluido)) return null;
  if (perfilId === quem.eu) return { para: '/minha-conta/' };
  return quem.ehAdmin ? { para: '/equipe/perfil/?id=' + perfilId } : { motivo: PERFIL_SO_DE_ADMINISTRADOR };
}
