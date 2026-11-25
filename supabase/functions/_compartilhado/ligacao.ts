// Partes puras da ligação com a conta Google (#164), usadas pelas funções do servidor google-conectar, google-retorno e
// google-concluir. Sem Deno e sem rede: dá para testar no app (app/src/regras/ligacaoGoogle.test.ts).

/** Permissões pedidas ao Google: quem é a conta (e-mail) e os contatos. A agenda (#166) entra depois, aos poucos. */
export const ESCOPOS_CONTATOS = ['openid', 'email', 'https://www.googleapis.com/auth/contacts'];
/** A permissão sem a qual a ligação não serve para nada (o Google deixa a pessoa desmarcar na tela de autorização). */
export const ESCOPO_OBRIGATORIO = 'https://www.googleapis.com/auth/contacts';
/** O estado do pedido de ligação: 32 bytes aleatórios em hexadecimal. */
export const FORMATO_ESTADO = /^[0-9a-f]{64}$/;

/**
 * As permissões da agenda (#166), as mais estreitas que bastam: criar as agendas do SEMPER e escrever nelas
 * (calendar.app.created) e compartilhá-las (calendar.acls: sem ela o Google recusa o compartilhamento). São as mesmas que
 * privado.agenda_autorizada confere no banco (supabase/migrations/20261125102621_agendas_google.sql): mudou aqui, muda lá.
 */
export const ESCOPOS_DA_AGENDA = ['https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/calendar.acls'];
/** A conta Google deu as duas permissões da agenda. */
export const agendaAutorizada = (escopos: readonly string[] | null | undefined) => ESCOPOS_DA_AGENDA.every(e => (escopos ?? []).includes(e));

/**
 * Para que serve o pedido de ligação: ligar a conta (com os contatos), ou somar a agenda à conta já ligada (autorização aos
 * poucos: com include_granted_scopes, o token novo cobre os contatos e a agenda juntos, e os contatos não se desligam).
 */
export type FinalidadeDoPedido = 'contatos' | 'agendas';
/** O que cada pedido pede ao Google (o e-mail vai junto, para conferir de que conta é a autorização). */
export const ESCOPOS_DO_PEDIDO: Record<FinalidadeDoPedido, string[]> = {
  contatos: ESCOPOS_CONTATOS,
  agendas: ['openid', 'email', ...ESCOPOS_DA_AGENDA]
};

/**
 * Para onde o navegador vai pedir a autorização no Google (com o desafio do PKCE: o Google só aceita o código com o verificador).
 * Com a conta (ao somar a agenda), o Google já abre nela; a pessoa ainda pode escolher outra, e a conclusão recusa.
 */
export function urlDeAutorizacao(clienteId: string, voltaDoGoogle: string, estado: string, desafio: string, escopos = ESCOPOS_CONTATOS, conta?: string | null) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    ...(conta ? { login_hint: conta } : {}),
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

/**
 * Resultado da ligação, que a página de Configurações mostra num aviso. Os da agenda: 'agenda-ligada' (a permissão da agenda
 * somou-se à conta), 'sem-permissao-agenda' (faltou marcar a agenda na tela do Google) e 'outra-conta' (a pessoa entrou no
 * Google com outra conta; a conta do escritório não muda).
 */
export type ResultadoLigacao = 'ligado' | 'recusado' | 'sem-permissao' | 'expirado' | 'erro' | 'agenda-ligada' | 'sem-permissao-agenda' | 'outra-conta';

/** O que falta nas permissões que voltaram do Google, para cada finalidade do pedido; null: não falta nada. */
export const FALTA_NA_AUTORIZACAO: Record<FinalidadeDoPedido, (escopos: string[]) => ResultadoLigacao | null> = {
  contatos: escopos => (escopos.includes(ESCOPO_OBRIGATORIO) ? null : 'sem-permissao'),
  agendas: escopos => (agendaAutorizada(escopos) ? null : 'sem-permissao-agenda')
};
/** Ligar a conta pode trocar a conta do escritório; somar a agenda, não (vale só para a conta já ligada). */
const TROCA_A_CONTA: Record<FinalidadeDoPedido, boolean> = { contatos: true, agendas: false };
/** A conta que autorizou serve para o pedido: qualquer uma ao ligar; ao somar a agenda, só a que já está ligada. */
export const contaServe = (finalidade: FinalidadeDoPedido, email: string, contaLigada: string | null | undefined) =>
  TROCA_A_CONTA[finalidade] || email.trim().toLowerCase() === String(contaLigada ?? '').trim().toLowerCase();
/** O resultado de cada pedido quando dá certo. */
export const RESULTADO_DO_PEDIDO: Record<FinalidadeDoPedido, ResultadoLigacao> = { contatos: 'ligado', agendas: 'agenda-ligada' };

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
