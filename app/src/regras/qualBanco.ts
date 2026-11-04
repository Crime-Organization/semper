// Qual banco o site usa e o que a tela avisa sobre isso (#74). Tudo puro. A produção é o padrão: só o modo do "npm run dev" troca de banco, então
// o site publicado nunca sai dela.
export interface Banco { supabaseUrl: string; supabaseChave: string }
export interface BancoLocal { url?: string; chave?: string }
export interface AvisoDoBanco { tipo: 'info' | 'erro'; texto: string }

/** O modo do Vite que liga o site ao banco local do Docker (app/.env.docker). */
export const MODO_DO_BANCO_LOCAL = 'docker';
/** Os modos que não usam o Supabase de produção: "npm run teste" (banco fictício) e os testes automáticos. */
const MODOS_SEM_PRODUCAO = ['falso', 'test'];

export function qualBanco(modo: string, producao: Banco, local: BancoLocal): Banco {
  return modo === MODO_DO_BANCO_LOCAL && local.url && local.chave ? { supabaseUrl: local.url, supabaseChave: local.chave } : producao;
}

/** O aviso da faixa no alto da tela, só no computador de quem desenvolve. No site publicado, nada. */
export function avisoDoBanco(modo: string, noComputador: boolean): AvisoDoBanco | null {
  if (!noComputador || MODOS_SEM_PRODUCAO.includes(modo)) return null;
  return modo === MODO_DO_BANCO_LOCAL
    ? { tipo: 'info', texto: 'Banco local do Docker: nada aqui toca na produção.' }
    : { tipo: 'erro', texto: 'Cuidado: você está no banco de produção. O que fizer aqui grava em dados reais.' };
}
