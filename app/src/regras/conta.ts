// O e-mail de acesso de quem entrou: a regra do pedido de troca. Tudo puro, sem tela nem banco.
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import type { RecusaDaTrocaDeEmail } from '../dados/tipos';

/** Como o login confere o e-mail: sem acento e sem ponto duplo no domínio. É mais rígido que emailValido, que serve aos cadastros. */
const EMAIL_QUE_O_LOGIN_ACEITA = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const normalizarEmail = (v: string) => v.trim().toLowerCase();

/** O motivo para não aceitar o e-mail novo, ou null se o pedido pode seguir. */
export function erroDoNovoEmail(novo: string, atual: string): string | null {
  const email = normalizarEmail(novo);
  if (!email) return 'Informe o e-mail novo.';
  if (!EMAIL_QUE_O_LOGIN_ACEITA.test(email) || email.length > TAMANHO_EMAIL_DE_ACESSO) return 'Informe um e-mail válido.';
  return email === normalizarEmail(atual) ? 'Este já é o seu e-mail de acesso.' : null;
}

/** O administrador troca o e-mail de um colega digitando duas vezes: sem link de confirmação, um erro de digitação entregaria a conta a um estranho. */
export function erroDoEmailDoColega(novo: string, repetido: string, atual: string): string | null {
  if (normalizarEmail(novo) === normalizarEmail(atual)) return 'Este já é o e-mail de acesso desta pessoa.';
  return erroDoNovoEmail(novo, atual) ?? (normalizarEmail(novo) === normalizarEmail(repetido) ? null : 'Os dois e-mails não são iguais.');
}

/** O que a tela diz quando a troca pelo administrador não acontece (cada resposta da função equipe-trocar-email). */
export const RECUSA_DA_TROCA: Record<RecusaDaTrocaDeEmail, string> = {
  'sem-permissao': 'Você não pode trocar o e-mail de acesso desta pessoa.',
  'so-o-master': 'Esta pessoa alcança informações sigilosas: só o master pode trocar o e-mail de acesso dela.',
  'email-invalido': 'Informe um e-mail válido.',
  'email-em-uso': 'Este e-mail já é usado em outra conta do SEMPER.',
  'convite-pendente': 'Este e-mail já tem um convite pendente.',
  erro: 'Não foi possível trocar o e-mail agora. Tente de novo.'
};

/** O que dizer depois do pedido: sem pendência, a troca já valeu. */
export const avisoDaTroca = (pendente: string | null) => pendente ? 'Pedido enviado. Confirme pelo link que chegará por e-mail.' : 'E-mail de acesso alterado.';
