// Partes puras da conta reservada (#215), usadas pela função do servidor equipe-reservar-conta.
// Sem Deno e sem rede: dá para testar no app (app/src/regras/reservaDeConta.test.ts).

export type ResultadoDaReserva = 'reservada' | 'sem-permissao' | 'ja-na-equipe' | 'convite-pendente' | 'erro';
/** O que o banco responde antes de criar a conta (public.equipe_reserva_preparar). */
export interface PreparoDaReserva { resultado: 'pronto' | Exclude<ResultadoDaReserva, 'reservada' | 'erro'>; email: string | null; codigo: string | null }
export interface PassosDaReserva {
  preparar(pessoa: string): Promise<PreparoDaReserva | undefined>;
  /** Cria a conta bloqueada no login. false é um "não" certo do login: nada foi criado. */
  criarNoLogin(email: string, codigo: string): Promise<boolean>;
  concluir(email: string): Promise<void>;
  desistir(email: string): Promise<void>;
}

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Por quanto tempo o login fica bloqueado: 100 anos, porque o login não aceita um bloqueio sem fim. */
export const BLOQUEIO_DA_CONTA_RESERVADA = '876000h';

/** Confere o formato do pedido; quem pode, o banco decide. */
export function conferirPedidoDaReserva(corpo: unknown): { pessoa: string } | null {
  const { pessoa } = (corpo ?? {}) as { pessoa?: unknown };
  return typeof pessoa === 'string' && FORMATO_ID.test(pessoa) ? { pessoa } : null;
}

/**
 * O banco autoriza e cria o convite, o login cria a conta bloqueada e o banco marca o perfil. Se o login recusar, o convite é
 * apagado. Se o login falhar sem resposta certa, o convite também sai: uma conta criada já o usou, e continua sem acesso.
 */
export async function reservarConta({ pessoa }: { pessoa: string }, passos: PassosDaReserva): Promise<ResultadoDaReserva> {
  const preparo = await passos.preparar(pessoa);
  if (!preparo) return 'sem-permissao';
  if (preparo.resultado !== 'pronto') return preparo.resultado;
  if (!preparo.email || !preparo.codigo) return 'erro';
  const criada = await passos.criarNoLogin(preparo.email, preparo.codigo).catch(() => false);
  if (!criada) {
    await passos.desistir(preparo.email);
    return 'erro';
  }
  await passos.concluir(preparo.email);
  return 'reservada';
}
