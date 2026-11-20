// Qual banco o site usa e o que a tela avisa sobre isso (#74). Tudo puro. O endereço e a chave do banco não ficam no código: vêm das
// variáveis VITE_SUPABASE_URL e VITE_SUPABASE_CHAVE, de um arquivo app/.env.<modo> (o do site publicado é o app/.env.production).
// O vite.config.ts chama qualBanco ao ligar o servidor e ao compilar: se faltar a variável, nada sobe e o erro diz o que fazer.
export interface Banco { supabaseUrl: string; supabaseChave: string }
export interface VariaveisDoBanco { url?: string; chave?: string }
export interface AvisoDoBanco { tipo: 'info' | 'erro'; texto: string }

/** O modo do Vite que liga o site ao banco local do Docker (app/.env.docker). */
export const MODO_DO_BANCO_LOCAL = 'docker';
/** Os modos que não usam o Supabase: "npm run teste" (banco fictício) e os testes automáticos. */
const MODOS_SEM_BANCO = ['falso', 'test'];
/** O banco dos modos que não usam o Supabase: um endereço que não existe (o domínio .invalid nunca responde, RFC 2606), para que o
 *  supabase.ts, quando um teste o carrega com a rede simulada, tenha um endereço válido sem nunca alcançar um banco de verdade. */
export const BANCO_FICTICIO: Banco = { supabaseUrl: 'http://banco-ficticio.invalid', supabaseChave: 'chave-do-banco-ficticio' };
/** Modos que tiram o banco do arquivo de outro modo: o "npm run dev-producao" usa o mesmo banco do site publicado. */
const ARQUIVO_DE_OUTRO_MODO: Record<string, string> = { producao: 'production' };
/** Um endereço de banco começa assim (o local é http, a produção é https). */
const INICIO_DO_ENDERECO = /^https?:\/\//;

/** O modo cujo arquivo app/.env.<modo> guarda o banco deste modo. */
export const arquivoDoModo = (modo: string) => ARQUIVO_DE_OUTRO_MODO[modo] ?? modo;

/** O texto do erro quando falta o banco num modo que precisa dele. */
export function faltaOBanco(modo: string): string {
  return `O SEMPER não sabe qual banco usar no modo "${modo}": faltam VITE_SUPABASE_URL (um endereço começando com http) e VITE_SUPABASE_CHAVE `
    + `no arquivo app/.env.${arquivoDoModo(modo)}. Para desenvolver, use "npm run dev" (banco local do Docker) ou "npm run teste" (banco fictício).`;
}

/** O banco deste modo, a partir das variáveis do ambiente. Num modo que precisa de banco e não o tem, para com um erro claro, em vez de cair noutro banco. */
export function qualBanco(modo: string, variaveis: VariaveisDoBanco): Banco {
  if (MODOS_SEM_BANCO.includes(modo)) return BANCO_FICTICIO;
  const { url, chave } = variaveis;
  if (!url || !INICIO_DO_ENDERECO.test(url) || !chave) throw new Error(faltaOBanco(modo));
  return { supabaseUrl: url, supabaseChave: chave };
}

/** O aviso da faixa no alto da tela, só no computador de quem desenvolve. No site publicado, nada. */
export function avisoDoBanco(modo: string, noComputador: boolean): AvisoDoBanco | null {
  if (!noComputador || MODOS_SEM_BANCO.includes(modo)) return null;
  return modo === MODO_DO_BANCO_LOCAL
    ? { tipo: 'info', texto: 'Banco local do Docker: nada aqui toca na produção.' }
    : { tipo: 'erro', texto: 'Cuidado: você está no banco de produção. O que fizer aqui grava em dados reais.' };
}
