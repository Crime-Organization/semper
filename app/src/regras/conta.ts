// O e-mail de acesso de quem entrou: a regra do pedido de troca. Tudo puro, sem tela nem banco.
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';

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

/** O que dizer depois do pedido: sem pendência, a troca já valeu. */
export const avisoDaTroca = (pendente: string | null) => pendente ? 'Pedido enviado. Confirme pelo link que chegará por e-mail.' : 'E-mail de acesso alterado.';
