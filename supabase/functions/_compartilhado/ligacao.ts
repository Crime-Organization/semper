// Partes puras da ligação com a conta Google (#164), usadas pelas funções do servidor google-conectar e google-retorno.
// Sem Deno e sem rede: dá para testar no app (app/src/regras/ligacaoGoogle.test.ts).

/** Permissões pedidas ao Google: quem é a conta (e-mail) e os contatos. A agenda (#166) entra depois, aos poucos. */
export const ESCOPOS_CONTATOS = ['openid', 'email', 'https://www.googleapis.com/auth/contacts'];
/** A permissão sem a qual a ligação não serve para nada (o Google deixa a pessoa desmarcar na tela de autorização). */
export const ESCOPO_OBRIGATORIO = 'https://www.googleapis.com/auth/contacts';
/** Páginas do SEMPER para onde a volta do Google pode levar, quando o servidor não tem a lista SITES_PERMITIDOS. */
export const SITES_PADRAO = ['https://semper.bragaferreira.adv.br', 'http://localhost:8090'];

/** Para onde o navegador vai pedir a autorização no Google. */
export function urlDeAutorizacao(clienteId: string, voltaDoGoogle: string, estado: string, escopos = ESCOPOS_CONTATOS) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: clienteId,
    redirect_uri: voltaDoGoogle,
    response_type: 'code',
    scope: escopos.join(' '),
    access_type: 'offline',          // para receber o token de renovação (o SEMPER trabalha sem a pessoa estar na tela)
    prompt: 'consent',               // pede o token de renovação de novo ao religar a conta
    include_granted_scopes: 'true',  // a agenda, no futuro, soma-se às permissões já dadas
    state: estado
  }).toString();
  return u.toString();
}

/** A lista de sites permitidos, a partir do texto "https://a.com, http://localhost:8090" (vazio: a lista padrão). */
export const lerSitesPermitidos = (texto?: string | null) => {
  const lista = String(texto ?? '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  return lista.length ? lista : SITES_PADRAO;
};

/** A página de volta é de um site do SEMPER (mesma origem, por inteiro); evita mandar a pessoa para um site estranho. */
export function sitePermitido(voltarPara: string | null | undefined, permitidos: string[]) {
  if (!voltarPara) return false;
  try { return permitidos.includes(new URL(voltarPara).origin); } catch { return false; }
}

/** Resultado da ligação, que a página de Configurações mostra num aviso. */
export type ResultadoLigacao = 'ligado' | 'recusado' | 'sem-permissao' | 'expirado' | 'erro';

/** A página de volta com o resultado no endereço (?google=ligado). */
export function comResultado(voltarPara: string, resultado: ResultadoLigacao) {
  const u = new URL(voltarPara);
  u.searchParams.set('google', resultado);
  return u.toString();
}

/** As permissões que o Google de fato deu (o campo "scope" da resposta, separado por espaços). */
export const escoposDados = (scope?: string | null) => String(scope ?? '').split(/\s+/).filter(Boolean);
