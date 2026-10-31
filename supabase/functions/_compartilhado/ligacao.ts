// Partes puras da ligação com a conta Google (#164), usadas pelas funções do servidor google-conectar, google-retorno e
// google-concluir. Sem Deno e sem rede: dá para testar no app (app/src/regras/ligacaoGoogle.test.ts).

/** Permissões pedidas ao Google: quem é a conta (e-mail) e os contatos. A agenda (#166) entra depois, aos poucos. */
export const ESCOPOS_CONTATOS = ['openid', 'email', 'https://www.googleapis.com/auth/contacts'];
/** A permissão sem a qual a ligação não serve para nada (o Google deixa a pessoa desmarcar na tela de autorização). */
export const ESCOPO_OBRIGATORIO = 'https://www.googleapis.com/auth/contacts';
/** O estado do pedido de ligação: 32 bytes aleatórios em hexadecimal. */
export const FORMATO_ESTADO = /^[0-9a-f]{64}$/;

/** Para onde o navegador vai pedir a autorização no Google (com o desafio do PKCE: o Google só aceita o código com o verificador). */
export function urlDeAutorizacao(clienteId: string, voltaDoGoogle: string, estado: string, desafio: string, escopos = ESCOPOS_CONTATOS) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: clienteId,
    redirect_uri: voltaDoGoogle,
    response_type: 'code',
    scope: escopos.join(' '),
    access_type: 'offline',          // para receber o token de renovação (o SEMPER trabalha sem a pessoa estar na tela)
    prompt: 'consent',               // pede o token de renovação de novo ao religar a conta
    include_granted_scopes: 'true',  // a agenda, no futuro, soma-se às permissões já dadas
    code_challenge: desafio,
    code_challenge_method: 'S256',
    state: estado
  }).toString();
  return u.toString();
}

/**
 * Os sites do SEMPER para onde a volta do Google pode levar, a partir do segredo SITES_PERMITIDOS do servidor
 * ("https://a.com, http://localhost:8090"). Sem o segredo, nenhum: a ligação não acontece, em vez de aceitar um site errado.
 */
export const lerSitesPermitidos = (texto?: string | null) =>
  String(texto ?? '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);

/** A página de volta é de um site do SEMPER (mesma origem, por inteiro); evita mandar a pessoa para um site estranho. */
export function sitePermitido(voltarPara: string | null | undefined, permitidos: string[]) {
  if (!voltarPara) return false;
  try { return permitidos.includes(new URL(voltarPara).origin); } catch { return false; }
}

/** Resultado da ligação, que a página de Configurações mostra num aviso. */
export type ResultadoLigacao = 'ligado' | 'recusado' | 'sem-permissao' | 'expirado' | 'erro';

/** A página de volta com o resultado no endereço (?google=recusado). */
export function comResultado(voltarPara: string, resultado: ResultadoLigacao) {
  const u = new URL(voltarPara);
  u.searchParams.set('google', resultado);
  return u.toString();
}

/**
 * A página de volta com o código do Google e o estado: a página, logada com quem pediu, conclui a ligação. Só o navegador
 * que voltou do Google tem o código, e só quem pediu consegue concluir; os dois juntos impedem ligar a conta de outra pessoa.
 */
export function comCodigo(voltarPara: string, estado: string, codigo: string) {
  const u = new URL(voltarPara);
  u.searchParams.set('google_estado', estado);
  u.searchParams.set('google_codigo', codigo);
  return u.toString();
}

/**
 * O nível da sessão ("aal1" só a senha, "aal2" com a verificação em duas etapas), lido do token que o login do Supabase
 * já conferiu (usuarioLogado). Token estranho conta como "aal1", o nível mais fraco.
 */
export function nivelDaSessao(autorizacao: string | null) {
  try {
    const carga = (autorizacao ?? '').replace(/^Bearer /, '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { aal } = JSON.parse(atob(carga)) as { aal?: unknown };
    return aal === 'aal2' ? 'aal2' : 'aal1';
  } catch { return 'aal1'; }
}

/** As permissões que o Google de fato deu (o campo "scope" da resposta, separado por espaços). */
export const escoposDados = (scope?: string | null) => String(scope ?? '').split(/\s+/).filter(Boolean);

/** Cabeçalhos para o navegador de um site do SEMPER chamar a função de conclusão (CORS); de outro site, nenhum. */
export function cabecalhosCors(origem: string | null, permitidos: string[]): Record<string, string> {
  if (!origem || !permitidos.includes(origem)) return {};
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    Vary: 'Origin'
  };
}
