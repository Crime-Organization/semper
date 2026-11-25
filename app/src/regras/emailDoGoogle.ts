// O "e-mail do Google" de cada pessoa da equipe (#166): o que recebe, por compartilhamento, as agendas do escritório no
// Google Agenda. Por padrão, o de entrada no SEMPER; a própria pessoa e o administrador podem informar outro (por exemplo,
// o Gmail pessoal de quem entra no SEMPER com o e-mail do escritório). Puro: as mesmas regras de public.email_do_google_salvar
// (supabase/migrations/20261125102621_agendas_google.sql), que o banco fictício também segue.
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import type { Papel } from '../dados/tipos';
import { normalizarEmail } from './conta';

/** As recusas, com as mesmas palavras do banco. */
export const RECUSA_DO_EMAIL_DO_GOOGLE = {
  naoAdmin: 'Apenas administradores mudam o e-mail do Google de alguém da equipe',
  master: 'Só o próprio master muda o e-mail do Google dele.',
  admin: 'Só o master muda o e-mail do Google de um administrador.',
  invalido: 'Informe um e-mail válido.',
  naoEncontrado: 'Usuário não encontrado'
} as const;

/** O mesmo formato que o banco confere (o check de emails_do_google.email). */
const FORMATO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** O problema do e-mail digitado, ou null. Vazio vale: volta ao e-mail de entrada. */
export function erroDoEmailDoGoogle(digitado: string): string | null {
  const email = normalizarEmail(digitado);
  if (!email) return null;
  return email.length > TAMANHO_EMAIL_DE_ACESSO || !FORMATO.test(email) ? RECUSA_DO_EMAIL_DO_GOOGLE.invalido : null;
}

/** De quem um administrador pode mudar o e-mail do Google, pelo papel da pessoa (a regra do nome, em equipe_definir_nome). */
const SO_QUEM_PODE: Record<Papel, (eu: Papel) => string | null> = {
  usuario: () => null,
  admin: eu => (eu === 'master' ? null : RECUSA_DO_EMAIL_DO_GOOGLE.admin),
  master: () => RECUSA_DO_EMAIL_DO_GOOGLE.master
};

/** Por que quem está logado não pode mudar o e-mail do Google de alguém, ou null se pode (o próprio, sempre). */
export function recusaDoEmailDoGoogle(alvo: { id: string; papel: Papel }, eu: { id: string; papel: Papel }): string | null {
  if (alvo.id === eu.id) return null;
  return eu.papel === 'usuario' ? RECUSA_DO_EMAIL_DO_GOOGLE.naoAdmin : SO_QUEM_PODE[alvo.papel](eu.papel);
}

/** O que gravar: o e-mail em minúsculas, ou nada (volta ao de entrada) quando vazio ou igual ao de entrada. */
export function emailDoGoogleParaGravar(digitado: string, entrada: string | null): string | null {
  const email = normalizarEmail(digitado);
  return !email || email === normalizarEmail(entrada ?? '') ? null : email;
}
