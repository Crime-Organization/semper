// Partes da sincronização das pessoas com o Google Contatos (#164), usadas pela função do servidor google-sincronizar.
// Sem Deno: a rede e o banco entram pelos "passos", e dá para testar no app com um fetch simulado
// (app/src/regras/sincronizacaoDeContatos.test.ts).

/** Uma pessoa na fila, como o banco entrega (public.contatos_google_pendentes). `recurso` e `etag`: o contato já ligado a ela nessa conta. */
export interface PessoaNaFila {
  pessoa_id: string; versao: number; tentativas: number; escritorio_id: string; conta_email: string;
  recurso: string | null; etag: string | null;
  tipo: 'pf' | 'pj' | 'contato'; nome: string; telefones: string[] | null; emails: string[] | null; nascimento: string | null; abertura: string | null;
}

/** O contato no formato da People API do Google (só os campos que o SEMPER cuida). */
export interface ContatoGoogle {
  names: { givenName: string }[];
  phoneNumbers: { value: string; type?: string }[];
  emailAddresses: { value: string }[];
  birthdays: { date: { year: number; month: number; day: number } }[];
  clientData: { key: string; value: string }[];
}

/** Os campos que o SEMPER escreve no contato: ao atualizar, só eles mudam (o resto do contato, no Google, fica como está). */
export const CAMPOS_DO_CONTATO = 'names,phoneNumbers,emailAddresses,birthdays,clientData';
/** A marca do SEMPER no contato (o id da pessoa), para a etapa 2 achar os contatos que já são de alguém. */
export const MARCA_DO_SEMPER = 'semper_pessoa';

const so = (v: string) => v.replace(/\D/g, '');
/** O número sem o 55 do Brasil e sem o 0 antes do DDD, com o 9 nos celulares antigos de 8 dígitos (como celularCompleto em app/src/regras/pessoa.ts). */
function nacional(v: string) {
  const digitos = so(v);
  let d = (digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (d === digitos && (d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 && /[6-9]/.test(d[2]) ? d.slice(0, 2) + '9' + d.slice(2) : d;
}

/** O telefone como o Google reconhece (+55 38 99999-9999), igual ao CSV de exportação (telefoneGoogle em app/src/regras/contatosGoogle.ts). */
export function telefoneNoGoogle(v: string) {
  const original = String(v || '').trim();
  if (original.startsWith('+') && !/^\+\s*55/.test(original)) return original;
  const d = nacional(original);
  if (d.length === 11 && d[2] === '9') return `+55 ${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10 && /[2-5]/.test(d[2])) return `+55 ${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  return original;
}
const ehCelular = (t: string) => /^\+55 \d{2} 9\d{4}-\d{4}$/.test(t);

/** "aaaa-mm-dd" no formato de data do Google; outra coisa, nada. */
function dataNoGoogle(iso: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

/**
 * A pessoa como contato do Google: o nome em maiúsculas, os telefones e os e-mails (sem repetidos) e o aniversário
 * (nascimento; para empresa, a abertura). Sem a qualificação nem outro dado do cadastro.
 */
export function contatoDaPessoa(p: PessoaNaFila): ContatoGoogle {
  const telefones = [...new Set((p.telefones ?? []).map(telefoneNoGoogle).filter(Boolean))];
  const emails = [...new Set((p.emails ?? []).map(e => e.trim().toLowerCase()).filter(Boolean))];
  const aniversario = dataNoGoogle(p.tipo === 'pj' ? p.abertura : p.nascimento);
  return {
    names: [{ givenName: p.nome.trim().toLocaleUpperCase('pt-BR') }],
    phoneNumbers: telefones.map(value => (ehCelular(value) ? { value, type: 'mobile' } : { value })),
    emailAddresses: emails.map(value => ({ value })),
    birthdays: aniversario ? [{ date: aniversario }] : [],
    clientData: [{ key: MARCA_DO_SEMPER, value: p.pessoa_id }]
  };
}

// ---------------------------------------------------------------------
// Falhas e esperas
// ---------------------------------------------------------------------

/** Como a falha fica na fila: autorização vencida ou retirada, Google fora (ou ocupado), ou dados recusados. */
export type TipoDaFalha = 'autorizacao' | 'temporario' | 'recusado';
/** Mais dois casos que a função resolve sozinha: o contato sumiu no Google (cria outro) ou o etag ficou velho (relê). */
type TipoDoErro = TipoDaFalha | 'sumiu' | 'etag';

export class FalhaDoGoogle extends Error {
  constructor(readonly tipo: TipoDoErro, readonly detalhe: string) { super(detalhe); }
}

/** A situação que o Google manda no erro ("status" da resposta) diz mais que o número. */
const POR_SITUACAO: Record<string, TipoDoErro> = {
  FAILED_PRECONDITION: 'etag', NOT_FOUND: 'sumiu', RESOURCE_EXHAUSTED: 'temporario', UNAVAILABLE: 'temporario',
  UNAUTHENTICATED: 'autorizacao', PERMISSION_DENIED: 'autorizacao'
};
const POR_STATUS: Record<number, TipoDoErro> = { 401: 'autorizacao', 403: 'autorizacao', 404: 'sumiu', 408: 'temporario', 429: 'temporario' };
/** A partir deste número, o erro é do Google (fora do ar ou com problema), não do pedido. */
const ERRO_DO_SERVIDOR = 500;

/** O tipo do erro a partir da resposta do Google. Sem situação conhecida: pelo número; 5xx é do Google, o resto é recusa. */
export function tipoDoErro(status: number, situacao?: string | null): TipoDoErro {
  return (situacao && POR_SITUACAO[situacao]) || POR_STATUS[status] || (status >= ERRO_DO_SERVIDOR ? 'temporario' : 'recusado');
}

const MINUTO = 60, HORA = 60 * MINUTO;
/** Quanto esperar (em segundos) depois de cada tentativa falha: cresce até um dia e fica nele, sem desistir. */
export const ESPERAS_DAS_TENTATIVAS = [MINUTO, 5 * MINUTO, 30 * MINUTO, 2 * HORA, 6 * HORA, 24 * HORA];
export const esperaDaTentativa = (tentativa: number) =>
  ESPERAS_DAS_TENTATIVAS[Math.min(Math.max(tentativa, 1), ESPERAS_DAS_TENTATIVAS.length) - 1];

// ---------------------------------------------------------------------
// A sincronização
// ---------------------------------------------------------------------

/** Quantas pessoas uma execução leva ao Google, uma de cada vez (o Google pede pedidos em sequência para a mesma conta). */
export const PESSOAS_POR_EXECUCAO = 25;

export interface PassosDaSincronizacao {
  /** As pessoas a sincronizar agora (de um escritório, ou de todos com null), já reservadas para esta execução. */
  pendentes(escritorio: string | null, limite: number): Promise<PessoaNaFila[]>;
  /** O token de renovação da conta ligada ao escritório (do cofre), ou null. */
  tokenDeRenovacao(escritorio: string): Promise<string | null>;
  concluir(p: PessoaNaFila, recurso: string, etag: string | null): Promise<void>;
  falhou(p: PessoaNaFila, falha: TipoDaFalha, detalhe: string, esperaEmSegundos: number): Promise<void>;
  /** O fetch (o de verdade no servidor; um simulado nos testes). */
  buscar: typeof fetch;
  clienteId: string;
  clienteSegredo: string;
}

export interface ResultadoDaSincronizacao { sincronizados: number; falhas: number }

const TOKEN = 'https://oauth2.googleapis.com/token';
const PESSOAS = 'https://people.googleapis.com/v1';

/** Lê a resposta do Google; se não deu certo, lança a falha com o tipo e um detalhe curto (sem dado de ninguém). */
async function respostaDoGoogle<T>(r: Response): Promise<T> {
  if (r.ok) return await r.json() as T;
  const corpo = await r.json().catch(() => ({})) as { error?: { status?: string } | string };
  const situacao = typeof corpo.error === 'object' ? corpo.error?.status ?? null : corpo.error ?? null;
  throw new FalhaDoGoogle(tipoDoErro(r.status, situacao), `${r.status} ${situacao ?? ''}`.trim());
}

/** Faz o pedido; sem resposta (rede, Google fora), a falha é temporária. */
async function pedir<T>(buscar: typeof fetch, url: string, init: RequestInit): Promise<T> {
  let r: Response;
  try { r = await buscar(url, init); } catch (e) { throw new FalhaDoGoogle('temporario', `sem resposta: ${(e as Error).message}`.slice(0, 200)); }
  return respostaDoGoogle<T>(r);
}

/** Um token de acesso novo, com o token de renovação. Recusa do Google (4xx) é autorização vencida ou retirada. */
async function tokenDeAcesso(passos: PassosDaSincronizacao, escritorio: string) {
  const renovacao = await passos.tokenDeRenovacao(escritorio);
  if (!renovacao) throw new FalhaDoGoogle('autorizacao', 'sem token de renovação');
  try {
    const { access_token } = await pedir<{ access_token?: string }>(passos.buscar, TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: renovacao, client_id: passos.clienteId, client_secret: passos.clienteSegredo })
    });
    if (!access_token) throw new FalhaDoGoogle('temporario', 'o Google não mandou o token de acesso');
    return access_token;
  } catch (e) {
    if (e instanceof FalhaDoGoogle && e.tipo !== 'temporario') throw new FalhaDoGoogle('autorizacao', `renovação: ${e.detalhe}`);
    throw e;
  }
}

interface ContatoGravado { resourceName?: string; etag?: string }

/** Cria, atualiza ou relê o contato na People API, com o token de acesso. */
function apiDeContatos(buscar: typeof fetch, acesso: string) {
  const cabecalhos = { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' };
  return {
    criar: (contato: ContatoGoogle) =>
      pedir<ContatoGravado>(buscar, `${PESSOAS}/people:createContact?personFields=metadata`, { method: 'POST', headers: cabecalhos, body: JSON.stringify(contato) }),
    atualizar: (recurso: string, etag: string | null, contato: ContatoGoogle) =>
      pedir<ContatoGravado>(buscar, `${PESSOAS}/${recurso}:updateContact?updatePersonFields=${CAMPOS_DO_CONTATO}&personFields=metadata`,
        { method: 'PATCH', headers: cabecalhos, body: JSON.stringify({ ...contato, resourceName: recurso, etag }) }),
    ler: (recurso: string) => pedir<ContatoGravado>(buscar, `${PESSOAS}/${recurso}?personFields=metadata`, { method: 'GET', headers: cabecalhos })
  };
}
type ApiDeContatos = ReturnType<typeof apiDeContatos>;

/** O que fazer quando a atualização falha de um jeito que a função resolve sozinha. */
const AO_FALHAR_A_ATUALIZACAO: Partial<Record<TipoDoErro, (api: ApiDeContatos, recurso: string, contato: ContatoGoogle) => Promise<ContatoGravado>>> = {
  // Alguém mexeu no contato pelo Google: relê o etag e atualiza de novo (os campos do SEMPER valem).
  etag: async (api, recurso, contato) => {
    const atual = await api.ler(recurso);
    return api.atualizar(recurso, atual.etag ?? null, contato);
  },
  // O contato foi apagado no Google: cria outro e a ligação passa a ser com ele.
  sumiu: (api, _recurso, contato) => api.criar(contato)
};

/** Leva uma pessoa ao Google: atualiza o contato ligado a ela, ou cria um (nunca dois para a mesma pessoa na mesma conta). */
async function enviar(api: ApiDeContatos, p: PessoaNaFila) {
  const contato = contatoDaPessoa(p);
  if (!p.recurso) return api.criar(contato);
  try {
    return await api.atualizar(p.recurso, p.etag, contato);
  } catch (e) {
    const recuperar = e instanceof FalhaDoGoogle ? AO_FALHAR_A_ATUALIZACAO[e.tipo] : undefined;
    if (!recuperar) throw e;
    try { return await recuperar(api, p.recurso, contato); } catch (e2) {
      // Sumiu na releitura do etag: cria.
      if (e2 instanceof FalhaDoGoogle && e2.tipo === 'sumiu') return api.criar(contato);
      throw e2;
    }
  }
}

/** Erros que sobram depois das recuperações viram falhas da fila ('sumiu' e 'etag' que se repetem contam como recusa). */
const FALHA_DA_FILA: Record<TipoDoErro, TipoDaFalha> = {
  autorizacao: 'autorizacao', temporario: 'temporario', recusado: 'recusado', sumiu: 'recusado', etag: 'recusado'
};

/**
 * Esvazia a fila (de um escritório, ou de todos): para cada pessoa, cria ou atualiza o contato na conta Google do
 * escritório DELA (um token de acesso por escritório, renovado no começo) e guarda a ligação. Uma falha não para as
 * outras pessoas: ela fica na fila com a espera da tentativa. O cadastro no SEMPER nunca é tocado.
 */
export async function sincronizarContatos(passos: PassosDaSincronizacao, escritorio: string | null, limite = PESSOAS_POR_EXECUCAO): Promise<ResultadoDaSincronizacao> {
  const pessoas = await passos.pendentes(escritorio, limite);
  const acessos = new Map<string, Promise<string>>();
  const resultado: ResultadoDaSincronizacao = { sincronizados: 0, falhas: 0 };
  for (const p of pessoas) {
    try {
      if (!acessos.has(p.escritorio_id)) acessos.set(p.escritorio_id, tokenDeAcesso(passos, p.escritorio_id));
      const gravado = await enviar(apiDeContatos(passos.buscar, await acessos.get(p.escritorio_id)!), p);
      if (!gravado.resourceName) throw new FalhaDoGoogle('temporario', 'o Google não devolveu o contato');
      await passos.concluir(p, gravado.resourceName, gravado.etag ?? null);
      resultado.sincronizados++;
    } catch (e) {
      const falha = e instanceof FalhaDoGoogle ? FALHA_DA_FILA[e.tipo] : 'temporario';
      const detalhe = e instanceof FalhaDoGoogle ? e.detalhe : `erro: ${(e as Error).message}`.slice(0, 200);
      await passos.falhou(p, falha, detalhe, esperaDaTentativa(p.tentativas));
      resultado.falhas++;
    }
  }
  return resultado;
}
