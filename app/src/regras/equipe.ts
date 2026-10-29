// Função de cada membro da equipe e o que ela permite no contrato (banco/015_funcao_na_equipe.sql).
// A função é diferente do papel no sistema: administrador é quem gere a equipe e vê tudo; "administrativo" é uma função.
import type { Funcao, Membro } from '../dados/tipos';

export const FUNCOES: Record<Funcao, string> = { advogado: 'Advogado', administrativo: 'Administrativo', estagiario: 'Estagiário' };
/** Função de quem entra na equipe, até um administrador ajustar (o padrão do banco). */
export const FUNCAO_INICIAL: Funcao = 'advogado';

const funcaoDe = (m: Membro) => m.funcao ?? FUNCAO_INICIAL;
const ativo = (m: Membro) => m.ativo !== false;

/** Quem pode ser o responsável: os advogados ativos e quem já é o responsável (mesmo que não seja mais, para não sair sem querer). */
export const opcoesDeResponsavel = (equipe: Membro[], atual = '') =>
  equipe.filter(m => (ativo(m) && funcaoDe(m) === 'advogado') || m.id === atual);

/** Por que a pessoa não pode entrar como participante (null se pode): o participante é sempre alguém ativo da equipe. */
export function motivoParaNaoParticipar(equipe: Membro[], pessoaId: string): string | null {
  const m = equipe.find(x => x.pessoa_id === pessoaId);
  return !m ? 'não é da equipe' : !ativo(m) ? 'desativado na equipe' : null;
}
