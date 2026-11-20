// Qual banco o site usa e o que a tela avisa sobre isso (#74). Tudo puro. O endereço e a chave do banco não ficam no código: vêm das
// variáveis VITE_SUPABASE_URL e VITE_SUPABASE_CHAVE, de um arquivo app/.env.<modo> (o do site publicado é o app/.env.production).
// O vite.config.ts chama qualBanco ao ligar o servidor e ao compilar: se faltar a variável, nada sobe e o erro diz o que fazer.
// Na compilação, ele também põe esse endereço no connect-src do app/public/.htaccess (politicaComOBanco).
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

/** Cada variável do banco, como o erro a chama, e se ela está certa. O erro lista só as que faltam ou estão erradas. */
const VARIAVEIS_DO_BANCO: { nome: string; certa: (v: VariaveisDoBanco) => boolean }[] = [
  { nome: 'VITE_SUPABASE_URL (um endereço começando com http)', certa: v => !!v.url && INICIO_DO_ENDERECO.test(v.url) },
  { nome: 'VITE_SUPABASE_CHAVE', certa: v => !!v.chave }
];
const variaveisQueFaltam = (v: VariaveisDoBanco) => VARIAVEIS_DO_BANCO.filter(x => !x.certa(v)).map(x => x.nome);

/** O texto do erro quando falta o banco num modo que precisa dele: diz só as variáveis que faltam ou estão erradas. */
export function faltaOBanco(modo: string, variaveis: VariaveisDoBanco): string {
  const faltam = variaveisQueFaltam(variaveis);
  const oQue = faltam.length > 1 ? 'faltam ou estão erradas as variáveis' : 'falta ou está errada a variável';
  return `O SEMPER não sabe qual banco usar no modo "${modo}": ${oQue} ${faltam.join(' e ')} `
    + `no arquivo app/.env.${arquivoDoModo(modo)}. Para desenvolver, use "npm run dev" (banco local do Docker) ou "npm run teste" (banco fictício).`;
}

/** O banco deste modo, a partir das variáveis do ambiente. Num modo que precisa de banco e não o tem, para com um erro claro, em vez de cair noutro banco. */
export function qualBanco(modo: string, variaveis: VariaveisDoBanco): Banco {
  if (MODOS_SEM_BANCO.includes(modo)) return BANCO_FICTICIO;
  if (variaveisQueFaltam(variaveis).length) throw new Error(faltaOBanco(modo, variaveis));
  const { url = '', chave = '' } = variaveis;
  return { supabaseUrl: url, supabaseChave: chave };
}

/** Se o site está no computador de quem desenvolve e ligado a um banco de verdade (a produção, no "npm run dev-producao", ou o
 *  banco local do Docker, que pode ter uma cópia dos dados reais). Aí nada pode sair do SEMPER para serviços de fora, como a
 *  planilha antiga (PROVISORIO-219): o envio criaria linha, contato e cartão de verdade. O site publicado e o banco fictício, não. */
export const bancoDeVerdadeNoComputador = (modo: string, noComputador: boolean) => noComputador && !MODOS_SEM_BANCO.includes(modo);

/** A marca, em app/public/.htaccess, que a compilação troca pelo endereço do banco no connect-src da política de conteúdo. */
export const MARCA_DO_BANCO_NA_POLITICA = '__ENDERECO_DO_BANCO__';

/** O .htaccess com o endereço do banco desta compilação no lugar da marca, para o navegador deixar o site falar com ele.
 *  Sem a marca, para com erro: um site publicado sem o banco liberado não consegue nem entrar. */
export function politicaComOBanco(htaccess: string, banco: Banco): string {
  if (!htaccess.includes(MARCA_DO_BANCO_NA_POLITICA)) {
    throw new Error(`O app/public/.htaccess perdeu a marca ${MARCA_DO_BANCO_NA_POLITICA} no connect-src: sem ela, o site publicado não consegue falar com o banco.`);
  }
  return htaccess.replaceAll(MARCA_DO_BANCO_NA_POLITICA, new URL(banco.supabaseUrl).origin);
}

/** O aviso da faixa no alto da tela, só no computador de quem desenvolve. No site publicado, nada. */
export function avisoDoBanco(modo: string, noComputador: boolean): AvisoDoBanco | null {
  if (!bancoDeVerdadeNoComputador(modo, noComputador)) return null;
  return modo === MODO_DO_BANCO_LOCAL
    ? { tipo: 'info', texto: 'Banco local do Docker: nada aqui toca na produção.' }
    : { tipo: 'erro', texto: 'Cuidado: você está no banco de produção. O que fizer aqui grava em dados reais.' };
}
