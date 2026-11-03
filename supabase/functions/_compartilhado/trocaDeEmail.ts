// Partes puras da troca de e-mail pelo administrador (#222), usadas pela função do servidor equipe-trocar-email.
// Sem Deno e sem rede: dá para testar no app (app/src/regras/trocaDeEmail.test.ts).

export type ResultadoDaTroca = 'trocado' | 'sem-permissao' | 'so-o-master' | 'email-invalido' | 'email-em-uso' | 'convite-pendente' | 'erro';
/** O que o banco responde antes da troca (public.equipe_email_preparar). */
export interface Preparo { resultado: 'pronto' | Exclude<ResultadoDaTroca, 'trocado' | 'erro'>; registro: number | null }
/** Como o login respondeu: 'recusado' é um "não" certo (nada mudou). */
export type RespostaDoLogin = 'trocado' | 'email-em-uso' | 'recusado';
export interface PassosDaTroca {
  preparar(perfil: string, email: string): Promise<Preparo | undefined>;
  trocarNoLogin(perfil: string, email: string): Promise<RespostaDoLogin>;
  marcarFalha(registro: number): Promise<void>;
}

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** O maior e-mail que o login aceita (TAMANHO_EMAIL_DE_ACESSO em app/src/dados/limites.ts). */
const TAMANHO_EMAIL = 254;

/** Confere o formato do pedido; quem pode e qual e-mail vale, o banco decide. */
export function conferirPedido(corpo: unknown): { perfil: string; email: string } | null {
  const { perfil, email } = (corpo ?? {}) as { perfil?: unknown; email?: unknown };
  if (typeof perfil !== 'string' || !FORMATO_ID.test(perfil) || typeof email !== 'string' || !email || email.length > TAMANHO_EMAIL) return null;
  return { perfil, email: email.trim().toLowerCase() };
}

/**
 * O banco autoriza e registra, o login troca. Se o login recusar, o registro passa a dizer que não houve troca. Se o login
 * falhar sem resposta certa (ele lança um erro), o registro fica como está: a troca pode ter acontecido, e é melhor sobrar
 * um registro do que faltar.
 */
export async function trocarEmailDaEquipe({ perfil, email }: { perfil: string; email: string }, passos: PassosDaTroca): Promise<ResultadoDaTroca> {
  const preparo = await passos.preparar(perfil, email);
  if (!preparo) return 'sem-permissao';
  if (preparo.resultado !== 'pronto') return preparo.resultado;
  if (preparo.registro === null) return 'erro';
  const resposta = await passos.trocarNoLogin(perfil, email);
  if (resposta === 'trocado') return 'trocado';
  await passos.marcarFalha(preparo.registro);
  return resposta === 'email-em-uso' ? 'email-em-uso' : 'erro';
}
