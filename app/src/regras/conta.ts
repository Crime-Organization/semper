// O e-mail de acesso de quem entrou: a regra do pedido de troca. Tudo puro, sem tela nem banco.
import { TAMANHO_EMAIL_DE_ACESSO, TROCAS_DE_EMAIL_POR_HORA } from '../dados/limites';
import type { DestinoDoAvisoDaTroca, RecusaDaTrocaDeEmail, RegistroAuditoria } from '../dados/tipos';

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
  limite: `O escritório chegou ao limite de ${TROCAS_DE_EMAIL_POR_HORA} trocas de e-mail por hora. Nada mudou: tente de novo mais tarde.`,
  erro: 'Não foi possível trocar o e-mail agora. Tente de novo.'
};

const DESTINO_DO_AVISO: Record<DestinoDoAvisoDaTroca, string> = { antigo: 'o e-mail antigo', gestao: 'a administração' };

/**
 * O que o registro de ações diz sobre o aviso por e-mail de uma troca. Sem a marca, o envio não chegou ao fim (a função caiu no
 * meio ou a troca é de antes do aviso); lista vazia é que saiu para todos, e aí não há o que dizer.
 */
export function situacaoDoAvisoDaTroca(falhas?: DestinoDoAvisoDaTroca[]): string {
  if (!falhas) return 'o aviso por e-mail não foi confirmado';
  return falhas.length ? `o aviso por e-mail não saiu para ${falhas.map(f => DESTINO_DO_AVISO[f]).join(' e ')}` : '';
}

const SELO_DO_AVISO = {
  enviado: { tipo: 'ok', texto: 'Aviso enviado' },
  falhou: { tipo: 'erro', texto: 'Aviso não saiu' },
  'sem-confirmacao': { tipo: 'pend', texto: 'Aviso sem confirmação' }
} as const;

/** O destaque de uma troca na lista própria. Quando o login recusou, não houve troca, e não há aviso de que falar. */
export function seloDoAvisoDaTroca(resumo: RegistroAuditoria['resumo']) {
  if (resumo?.situacao === 'falhou') return null;
  const falhas = resumo?.aviso_falhas;
  return SELO_DO_AVISO[!falhas ? 'sem-confirmacao' : falhas.length ? 'falhou' : 'enviado'];
}

/** O que dizer depois do pedido: sem pendência, a troca já valeu. */
export const avisoDaTroca = (pendente: string | null) => pendente ? 'Pedido enviado. Confirme pelo link que chegará por e-mail.' : 'E-mail de acesso alterado.';
