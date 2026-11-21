// O lugar de uma pessoa do cadastro na equipe, visto do cartão dela (#327): já é da equipe (o cartão mostra, com o link para a
// Equipe), já tem convite, pode ser convidada (o administrador vê "Convidar para a equipe" no ⋯) ou nada disso. O convite em si é o
// da tela Equipe ("Dar acesso a uma pessoa"): o cartão só leva até ele, já com a pessoa escolhida.
import type { Convite, Membro, Pessoa, Usuario } from '../dados/tipos';
import { normalizarEmail } from './conta';

export type LugarNaEquipe = 'da-equipe' | 'convidada' | 'pode-convidar' | 'nenhum';

/** O que o cartão mostra em cada caso: o selo (sem selo, null) e se o ⋯ tem "Convidar para a equipe". */
export const NO_CARTAO: Record<LugarNaEquipe, { selo: string | null; convidar: boolean }> = {
  'da-equipe': { selo: 'Da equipe', convidar: false },
  convidada: { selo: 'Convite enviado', convidar: false },
  'pode-convidar': { selo: null, convidar: true },
  nenhum: { selo: null, convidar: false }
};

/** O que basta de um usuário ou de um convite para saber se é desta pessoa: o cadastro ligado e o e-mail de acesso. */
type DeAlguem = Pick<Usuario | Convite, 'pessoa_id' | 'email'>;
type PessoaDoCartao = Pick<Pessoa, 'id' | 'tipo' | 'emails' | 'arquivado_em'>;

/**
 * Onde a pessoa está em relação à equipe. É da equipe quem tem o cadastro ligado a um usuário (também a conta reservada) ou o
 * mesmo e-mail de um usuário; convidada, quem tem convite pendente (pelo cadastro ou pelo e-mail). Só se convida a pessoa
 * física com e-mail e não arquivada; quem foi excluído da equipe não volta (o banco recusa, como em motivoParaNaoDarAcesso).
 * Os usuários e convites só vêm para o administrador; para os outros, só a equipe (sem e-mails), e o cartão mostra o que dá.
 */
export function lugarNaEquipe(p: PessoaDoCartao, equipe: Membro[], usuarios: DeAlguem[] = [], convites: DeAlguem[] = []): LugarNaEquipe {
  const emails = p.emails.map(normalizarEmail);
  const eDela = (x: DeAlguem) => x.pessoa_id === p.id || emails.includes(normalizarEmail(x.email));
  // Na ordem: o primeiro caso que vale decide.
  const casos: [LugarNaEquipe, () => boolean][] = [
    ['nenhum', () => equipe.some(m => m.excluido && m.pessoa_id === p.id)],
    ['da-equipe', () => equipe.some(m => m.pessoa_id === p.id) || usuarios.some(eDela)],
    ['convidada', () => convites.some(eDela)],
    ['nenhum', () => p.tipo !== 'pf' || !emails.length || !!p.arquivado_em]
  ];
  return casos.find(([, vale]) => vale())?.[0] ?? 'pode-convidar';
}

/** O parâmetro do endereço da Equipe com a pessoa a convidar: a tela o lê uma vez e já escolhe a pessoa no convite. */
export const PARAMETRO_DO_CONVITE = 'convidar';
/** O endereço do convite da tela Equipe, já com a pessoa escolhida (só o id dela: nome e e-mail nunca vão no endereço). */
export const conviteDaPessoa = (pessoaId: string) => `/equipe/?${PARAMETRO_DO_CONVITE}=${encodeURIComponent(pessoaId)}`;
