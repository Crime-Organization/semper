// Demandas relacionadas (#310): uma demanda ligada a outra, nos dois sentidos, numa linha só (como a tabela
// public.demandas_relacionadas, supabase/migrations/20261122125913_demandas_relacionadas.sql). Regras puras, sem tela e sem banco.

/** A ligação como o banco a guarda: as duas demandas em ordem (a menor primeiro), com o número de cada uma. */
export interface LinhaDaRelacao<T> {
  demanda_a: string; demanda_b: string; codigo_a: string; codigo_b: string;
  /** Cada demanda, quando quem lê pode vê-la; null, quando não pode (só o número aparece). */
  a: T | null; b: T | null;
}
/** A outra demanda de uma ligação, vista do cartão de uma delas: o id e o número sempre; o conteúdo, só para quem pode vê-la. */
export interface OutraDaRelacao<T> { id: string; codigo: string; demanda: T | null }

/** A recusa de relacionar a demanda a ela mesma (a regra demandas_relacionadas_em_ordem do banco). */
export const MESMA_DEMANDA = 'Uma demanda não se relaciona com ela mesma.';
/** O texto no lugar do título, para quem não pode abrir a demanda relacionada. */
export const RELACIONADA_SEM_ACESSO = 'Demanda relacionada';
/** O detalhe, embaixo, para quem não pode abrir a demanda relacionada. */
export const DETALHE_SEM_ACESSO = 'Você não tem acesso a esta demanda';

/** As duas demandas na ordem em que o banco guarda a ligação (a menor primeiro): o mesmo par nos dois sentidos dá a mesma linha. */
export const parDaRelacao = (uma: string, outra: string): [string, string] => uma < outra ? [uma, outra] : [outra, uma];

/** A outra ponta da ligação, vista do cartão da demanda `demandaId`. */
export function outraDaRelacao<T>(l: LinhaDaRelacao<T>, demandaId: string): OutraDaRelacao<T> {
  return l.demanda_a === demandaId ? { id: l.demanda_b, codigo: l.codigo_b, demanda: l.b } : { id: l.demanda_a, codigo: l.codigo_a, demanda: l.a };
}

/** O que a busca de "Ligar demanda existente" deixa de fora: a própria demanda e as que já estão relacionadas a ela. */
export const foraDaBuscaDeRelacionadas = (demandaId: string, relacionadas: readonly { id: string }[]) => [demandaId, ...relacionadas.map(r => r.id)];

/**
 * Depois de desfazer a ligação, o Desfazer no pé da tela a refaz? Refazer pede as duas ativas e quem está nelas: sem ver a outra,
 * ou com ela arquivada, o religar seria recusado, e o aviso sai sem o botão.
 */
export const refazALigacao = (outra: OutraDaRelacao<{ arquivado_em: string | null }>) => !!outra.demanda && !outra.demanda.arquivado_em;
