// O e-mail de acesso de quem entrou: a regra do pedido de troca. Tudo puro, sem tela nem banco.
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import { emailValido } from './pessoa';

export const normalizarEmail = (v: string) => v.trim().toLowerCase();

/** O motivo para não aceitar o e-mail novo, ou null se o pedido pode seguir. */
export function erroDoNovoEmail(novo: string, atual: string): string | null {
  const email = normalizarEmail(novo);
  if (!email) return 'Informe o e-mail novo.';
  if (!emailValido(email) || email.length > TAMANHO_EMAIL_DE_ACESSO) return 'Informe um e-mail válido.';
  return email === normalizarEmail(atual) ? 'Este já é o seu e-mail de acesso.' : null;
}
