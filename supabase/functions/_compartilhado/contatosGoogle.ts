// Partes da sincronização das pessoas com o Google Contatos (#164), usadas pela função do servidor google-sincronizar.
// Sem Deno: a rede e o banco entram pelos "passos", e dá para testar no app com um fetch simulado
// (app/src/regras/sincronizacaoDeContatos.test.ts).
import { corresponder, MARCA_DO_SEMPER, telefoneNacional, type ContatoDaConta, type Correspondencia, type PessoaDoEscritorio } from './correspondenciaDeContatos.ts';

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
/** A marca do SEMPER no contato (o id da pessoa): a primeira sincronização (correspondenciaDeContatos.ts) a reconhece. */
export { MARCA_DO_SEMPER };

/** O telefone como o Google reconhece (+55 38 99999-9999), igual ao CSV de exportação (telefoneGoogle em app/src/regras/contatosGoogle.ts). */
export function telefoneNoGoogle(v: string) {
  const original = String(v || '').trim();
  if (original.startsWith('+') && !/^\+\s*55/.test(original)) return original;
  const d = telefoneNacional(original);
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

/**
 * O tamanho máximo do detalhe da falha guardado no banco (check length(...) <= 200 em contatos_google_fila.erro_detalhe e
 * privado.ligacoes.contatos_primeira_detalhe, nas migrações *_contatos_google*.sql): mudou aqui, muda a migração também.
 */
export const TAMANHO_DO_DETALHE_DO_ERRO = 200;

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
  try { r = await buscar(url, init); } catch (e) { throw new FalhaDoGoogle('temporario', `sem resposta: ${(e as Error).message}`.slice(0, TAMANHO_DO_DETALHE_DO_ERRO)); }
  return respostaDoGoogle<T>(r);
}

/** Um token de acesso novo, com o token de renovação (também para as agendas, #166). Recusa do Google (4xx) é autorização vencida ou retirada. */
export async function tokenDeAcesso(passos: Pick<PassosDaSincronizacao, 'tokenDeRenovacao' | 'buscar' | 'clienteId' | 'clienteSegredo'>, escritorio: string) {
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
      const detalhe = e instanceof FalhaDoGoogle ? e.detalhe : `erro: ${(e as Error).message}`.slice(0, TAMANHO_DO_DETALHE_DO_ERRO);
      await passos.falhou(p, falha, detalhe, esperaDaTentativa(p.tentativas));
      resultado.falhas++;
    }
  }
  return resultado;
}

// ---------------------------------------------------------------------
// A primeira sincronização (etapa 2): os contatos que já estão na conta
// ---------------------------------------------------------------------

/** Um escritório com a primeira sincronização por fazer, já reservado para esta execução (public.contatos_google_primeiras). */
export interface EscritorioDaPrimeira { escritorio_id: string; conta_email: string; tentativas: number }
/** Como terminou a primeira sincronização: contatos ligados a pessoas, contatos para conferir e pessoas que vão ganhar um contato novo. */
export interface ResultadoDaPrimeira { ligados: number; para_conferir: number; novos: number }

export interface PassosDaPrimeira extends Pick<PassosDaSincronizacao, 'tokenDeRenovacao' | 'buscar' | 'clienteId' | 'clienteSegredo'> {
  /** Os escritórios com a primeira sincronização por fazer agora (de um escritório, ou de todos com null), já reservados. */
  primeiras(escritorio: string | null): Promise<EscritorioDaPrimeira[]>;
  /** As pessoas do escritório (também as arquivadas), com o contato já ligado a cada uma nesta conta. */
  pessoasDoEscritorio(escritorio: string, conta: string): Promise<PessoaDoEscritorio[]>;
  /** Grava as ligações e a lista para conferir, marca a primeira como feita e põe na fila quem fica sem contato. */
  concluirPrimeira(e: EscritorioDaPrimeira, c: Correspondencia): Promise<ResultadoDaPrimeira>;
  primeiraFalhou(e: EscritorioDaPrimeira, falha: TipoDaFalhaDaPrimeira, detalhe: string, esperaEmSegundos: number): Promise<void>;
  /** A primeira sincronização do escritório ainda não terminou (falhou, espera a próxima tentativa ou outra execução a está fazendo). */
  primeiraPorFazer(escritorio: string): Promise<boolean>;
}

/**
 * Como a falha da primeira sincronização fica na ligação: as da fila e mais 'interno', o erro do próprio SEMPER (o banco
 * recusou ou não respondeu), que não é do Google e não se resolve esperando o Google voltar.
 */
export type TipoDaFalhaDaPrimeira = TipoDaFalha | 'interno';

/** Os campos lidos de cada contato da conta: só o que a correspondência usa. */
const CAMPOS_DA_LEITURA = 'names,phoneNumbers,emailAddresses,birthdays,clientData,metadata';
/** Quantos contatos vêm em cada página da lista (o máximo que o Google aceita). */
export const CONTATOS_POR_PAGINA = 1000;
/** Quantas páginas a leitura aceita (100 mil contatos): passou disso, algo está errado, e a leitura para em vez de girar sem fim. */
export const PAGINAS_NO_MAXIMO = 100;

/** Todos os contatos da conta, página por página (people.connections.list). */
export async function lerContatosDaConta(buscar: typeof fetch, acesso: string): Promise<ContatoDaConta[]> {
  const contatos: ContatoDaConta[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < PAGINAS_NO_MAXIMO; i++) {
    const url = `${PESSOAS}/people/me/connections?personFields=${CAMPOS_DA_LEITURA}&pageSize=${CONTATOS_POR_PAGINA}`
      + (pagina ? `&pageToken=${encodeURIComponent(pagina)}` : '');
    const r = await pedir<{ connections?: ContatoDaConta[]; nextPageToken?: string }>(buscar, url, { method: 'GET', headers: { Authorization: `Bearer ${acesso}` } });
    contatos.push(...(r.connections ?? []));
    if (!r.nextPageToken) return contatos;
    pagina = r.nextPageToken;
  }
  throw new FalhaDoGoogle('recusado', `mais de ${PAGINAS_NO_MAXIMO * CONTATOS_POR_PAGINA} contatos na conta`);
}

/**
 * A primeira sincronização de um escritório: lê os contatos que já estão na conta Google, compara com as pessoas do
 * escritório (correspondenciaDeContatos.ts) e grava o resultado. Nada é escrito no Google aqui. Se falhar, nada é
 * gravado: a primeira fica por fazer e é tentada de novo com a espera da tentativa. Devolve null se falhou.
 */
export async function primeiraSincronizacao(passos: PassosDaPrimeira, e: EscritorioDaPrimeira): Promise<ResultadoDaPrimeira | null> {
  try {
    const acesso = await tokenDeAcesso(passos, e.escritorio_id);
    const contatos = await lerContatosDaConta(passos.buscar, acesso);
    const pessoas = await passos.pessoasDoEscritorio(e.escritorio_id, e.conta_email);
    return await passos.concluirPrimeira(e, corresponder(contatos, pessoas));
  } catch (err) {
    const falha: TipoDaFalhaDaPrimeira = err instanceof FalhaDoGoogle ? FALHA_DA_FILA[err.tipo] : 'interno';
    const detalhe = err instanceof FalhaDoGoogle ? err.detalhe : `erro: ${(err as Error).message}`.slice(0, TAMANHO_DO_DETALHE_DO_ERRO);
    await passos.primeiraFalhou(e, falha, detalhe, esperaDaTentativa(e.tentativas));
    return null;
  }
}

export interface ResultadoCompleto extends ResultadoDaSincronizacao {
  /** Só quando a primeira sincronização terminou nesta execução. */
  primeira?: ResultadoDaPrimeira;
  /**
   * Só no "Sincronizar agora" (de um escritório): a primeira sincronização dele não terminou nesta execução (falhou, espera a
   * próxima tentativa ou outra execução a está fazendo). A fila dele não andou, e a tela não pode dizer que está tudo em dia.
   */
  primeira_por_fazer?: true;
}

/**
 * Uma execução da função do servidor: primeiro as primeiras sincronizações por fazer (enquanto a do escritório não termina,
 * a fila dele espera: é o que impede criar cópias dos contatos que já estão no Google); depois, a fila.
 */
export async function sincronizarTudo(passos: PassosDaSincronizacao & PassosDaPrimeira, escritorio: string | null): Promise<ResultadoCompleto> {
  let primeira: ResultadoDaPrimeira | undefined;
  for (const e of await passos.primeiras(escritorio)) {
    const r = await primeiraSincronizacao(passos, e);
    if (r) primeira = { ligados: (primeira?.ligados ?? 0) + r.ligados, para_conferir: (primeira?.para_conferir ?? 0) + r.para_conferir, novos: (primeira?.novos ?? 0) + r.novos };
  }
  const fila = await sincronizarContatos(passos, escritorio);
  if (primeira) return { ...fila, primeira };
  // Pedido de um escritório (o "Sincronizar agora") sem a primeira terminada agora: confere se ela ainda falta.
  if (escritorio && await passos.primeiraPorFazer(escritorio)) return { ...fila, primeira_por_fazer: true };
  return fila;
}
