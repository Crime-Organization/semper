// O adaptador fino da API do Google Agenda (Calendar API v3), usado pela função do servidor google-agendas (#166). Só faz
// os pedidos HTTP e traduz os erros do Google; o que criar, compartilhar ou retirar é decidido em agendasGoogle.ts (puro).
// Sem Deno: o fetch entra de fora, e os testes passam um simulado (app/src/regras/agendasGoogle.test.ts).
// Referência: https://developers.google.com/workspace/calendar/api/v3/reference (calendars, acl, events). Para o Google Meet
// (#437, reunioesGoogle.ts): a reunião na agenda principal da conta e a Meet REST API v2
// (https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces).

/**
 * Como o erro do Google é tratado: autorização vencida ou sem a permissão da agenda, Google fora (ou ocupado, ou com a cota
 * gasta), dados recusados, o que foi pedido não existe no Google ('sumiu': o evento, a regra ou a própria agenda; o 404 não
 * diz qual, e logo depois de criar uma agenda o Google ainda pode responder 404 enquanto a espalha, por isso só a
 * conferência da agenda, em agendasGoogle.ts, diz que ela foi apagada) ou já existe (o id escolhido pelo SEMPER já foi usado).
 */
export type TipoDoErroDaAgenda = 'autorizacao' | 'temporario' | 'recusado' | 'sumiu' | 'repetido';

/**
 * O tamanho máximo do detalhe da falha guardado no banco (check length(erro_detalhe) <= 200 em agendas_google_fila, na
 * migração 20261125102621_agendas_google.sql): mudou aqui, muda a migração também.
 */
export const TAMANHO_DO_DETALHE = 200;

export class FalhaDaAgenda extends Error {
  constructor(readonly tipo: TipoDoErroDaAgenda, readonly detalhe: string) { super(detalhe); }
}

/**
 * O motivo que o Google manda no erro (error.errors[0].reason) diz mais que o número. Só a falta de permissão e o login
 * recusado (e o 401) são de autorização, que para a fila do escritório até a agenda ser autorizada de novo; a cota (do
 * minuto ou do dia) é temporária; o resto do 403 (o Workspace que não deixa compartilhar com contas de fora, por exemplo)
 * é recusa daquele pedido só.
 */
const POR_MOTIVO: Record<string, TipoDoErroDaAgenda> = {
  rateLimitExceeded: 'temporario', userRateLimitExceeded: 'temporario', quotaExceeded: 'temporario', dailyLimitExceeded: 'temporario',
  backendError: 'temporario', insufficientPermissions: 'autorizacao', authError: 'autorizacao', forbiddenForNonOrganizer: 'recusado',
  notFound: 'sumiu', deleted: 'sumiu', duplicate: 'repetido'
};
const POR_STATUS: Record<number, TipoDoErroDaAgenda> = {
  401: 'autorizacao', 403: 'recusado', 404: 'sumiu', 408: 'temporario', 409: 'repetido', 410: 'sumiu', 429: 'temporario'
};
/** A partir deste número, o erro é do Google (fora do ar ou com problema), não do pedido. */
const ERRO_DO_SERVIDOR = 500;

/** O tipo do erro a partir da resposta do Google: pelo motivo; sem motivo conhecido, pelo número (5xx é do Google; o resto, recusa). */
export function tipoDoErroDaAgenda(status: number, motivo?: string | null): TipoDoErroDaAgenda {
  return (motivo && POR_MOTIVO[motivo]) || POR_STATUS[status] || (status >= ERRO_DO_SERVIDOR ? 'temporario' : 'recusado');
}

/** Resposta sem corpo (o DELETE do Google responde 204). */
const SEM_CORPO = 204;

async function pedir<T>(buscar: typeof fetch, url: string, init: RequestInit): Promise<T> {
  let r: Response;
  try { r = await buscar(url, init); } catch (e) {
    throw new FalhaDaAgenda('temporario', `sem resposta: ${(e as Error).message}`.slice(0, TAMANHO_DO_DETALHE));
  }
  if (r.ok) return (r.status === SEM_CORPO ? undefined : await r.json().catch(() => undefined)) as T;
  const corpo = await r.json().catch(() => ({})) as { error?: { errors?: { reason?: string }[]; status?: string } };
  const motivo = corpo.error?.errors?.[0]?.reason ?? null;
  throw new FalhaDaAgenda(tipoDoErroDaAgenda(r.status, motivo), `${r.status} ${motivo ?? corpo.error?.status ?? ''}`.trim().slice(0, TAMANHO_DO_DETALHE));
}

const AGENDA = 'https://www.googleapis.com/calendar/v3';
const daAgenda = (id: string) => `${AGENDA}/calendars/${encodeURIComponent(id)}`;

/** Os campos de uma agenda secundária que o SEMPER escreve (calendars.insert e calendars.patch). */
export interface DadosDaAgenda { summary: string; description?: string; timeZone?: string }
/**
 * Um evento, no formato do Google (só o que o SEMPER escreve; os campos são montados em eventosGoogle.ts). O status
 * 'confirmed' devolve à agenda o evento que o SEMPER apagou antes (o Google guarda o apagado como cancelado, com o mesmo id).
 */
export interface EventoDoGoogle {
  id?: string; summary: string; description?: string; location?: string; status?: 'confirmed';
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/**
 * O que a conferência da agenda no Google diz: ela existe; sumiu (o Google diz que não existe); ou incerto (outra falha:
 * não dá para dizer, e nada deve ser esquecido).
 */
export type ConferenciaDaAgenda = 'existe' | 'sumiu' | 'incerto';

/** O papel do compartilhamento: só ver (decisão do dono: tudo se muda no SEMPER). */
export const PAPEL_DO_COMPARTILHAMENTO = 'reader';

/** A agenda principal da conta do escritório, onde fica a reunião do Meet (#437): a conta é a organizadora. */
const REUNIOES = `${AGENDA}/calendars/primary/events`;
/** A Meet REST API (v2), para ligar a gravação e a transcrição automáticas. */
const MEET = 'https://meet.googleapis.com/v2';
/**
 * Os campos que o patch do espaço muda: a gravação e a transcrição automáticas (Space.config.artifactConfig). A documentação
 * do Google mostra os campos, mas não um exemplo de máscara para eles: o caminho é o dos nomes dos campos (testar com a conta
 * de verdade, veja docs/plataforma/agendas-google.md).
 */
export const MASCARA_DA_GRAVACAO = 'config.artifactConfig.recordingConfig.autoRecordingGeneration,config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration';
export const CONFIG_DA_GRAVACAO = {
  config: { artifactConfig: { recordingConfig: { autoRecordingGeneration: 'ON' }, transcriptionConfig: { autoTranscriptionGeneration: 'ON' } } }
};

/** A reunião, no formato do Google: o evento, com os convidados e, ao criar, o pedido do link do Meet. */
export interface EventoDaReuniao extends EventoDoGoogle {
  attendees: { email: string }[];
  conferenceData?: { createRequest: { requestId: string; conferenceSolutionKey: { type: 'hangoutsMeet' } } };
}
/** O que o Google devolve da reunião: o estado do pedido do link ('pending', 'success' ou 'failure') e os pontos de entrada. */
export interface RespostaDaReuniao {
  id?: string; status?: string; hangoutLink?: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
}

/** Os pedidos à API do Google Agenda, com o token de acesso da conta do escritório. */
export function apiDaAgenda(buscar: typeof fetch, acesso: string) {
  const cabecalhos = { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' };
  const com = (method: string, corpo?: unknown): RequestInit => ({ method, headers: cabecalhos, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });
  return {
    /** Cria uma agenda secundária na conta (a conta vira a dona); devolve o id dela no Google. */
    async criarAgenda(dados: DadosDaAgenda) {
      const { id } = await pedir<{ id?: string }>(buscar, `${AGENDA}/calendars`, com('POST', dados));
      if (!id) throw new FalhaDaAgenda('temporario', 'o Google não devolveu a agenda');
      return id;
    },
    /** Apaga uma agenda criada pelo SEMPER (calendars.delete; a permissão calendar.app.created cobre as que o SEMPER criou). */
    apagarAgenda: (id: string) => pedir<unknown>(buscar, daAgenda(id), com('DELETE')).then(() => undefined),
    /** Confere se a agenda ainda existe no Google (calendars.get), antes de o SEMPER esquecê-la. */
    async conferirAgenda(id: string): Promise<ConferenciaDaAgenda> {
      try { await pedir<unknown>(buscar, daAgenda(id), com('GET')); return 'existe'; } catch (e) {
        return e instanceof FalhaDaAgenda && e.tipo === 'sumiu' ? 'sumiu' : 'incerto';
      }
    },
    /** Muda o nome (e o que mais vier) da agenda. */
    mudarAgenda: (id: string, dados: Partial<DadosDaAgenda>) => pedir<unknown>(buscar, daAgenda(id), com('PATCH', dados)).then(() => undefined),
    /** Compartilha a agenda só para ver com um e-mail (o Google manda o convite por e-mail); devolve o id da regra, para retirar depois. */
    async compartilhar(id: string, email: string) {
      const { id: regra } = await pedir<{ id?: string }>(buscar, `${daAgenda(id)}/acl?sendNotifications=true`,
        com('POST', { role: PAPEL_DO_COMPARTILHAMENTO, scope: { type: 'user', value: email } }));
      if (!regra) throw new FalhaDaAgenda('temporario', 'o Google não devolveu o compartilhamento');
      return regra;
    },
    /** Retira um compartilhamento pela regra guardada. */
    retirar: (id: string, regra: string) => pedir<unknown>(buscar, `${daAgenda(id)}/acl/${encodeURIComponent(regra)}`, com('DELETE')).then(() => undefined),
    // ---- Eventos (#166, parte 2: eventosGoogle.ts) ----
    /** Cria um evento com o id escolhido pelo SEMPER; devolve o id. Id repetido: FalhaDaAgenda 'repetido' (então, mudarEvento). */
    async criarEvento(agenda: string, evento: EventoDoGoogle) {
      const { id } = await pedir<{ id?: string }>(buscar, `${daAgenda(agenda)}/events`, com('POST', evento));
      if (!id) throw new FalhaDaAgenda('temporario', 'o Google não devolveu o evento');
      return id;
    },
    /** Muda um evento (só os campos enviados mudam; o que vai como null, o Google apaga). */
    mudarEvento: (agenda: string, eventoId: string, evento: Partial<EventoDoGoogle> | Record<string, unknown>) =>
      pedir<unknown>(buscar, `${daAgenda(agenda)}/events/${encodeURIComponent(eventoId)}`, com('PATCH', evento)).then(() => undefined),
    /** Apaga um evento; o que já não existe no Google conta como apagado. */
    async apagarEvento(agenda: string, eventoId: string) {
      try { await pedir<unknown>(buscar, `${daAgenda(agenda)}/events/${encodeURIComponent(eventoId)}`, com('DELETE')); } catch (e) {
        if (!(e instanceof FalhaDaAgenda && e.tipo === 'sumiu')) throw e;
      }
    },
    // ---- A reunião do Google Meet (#437: reunioesGoogle.ts) ----
    // Na agenda principal da conta do escritório (a organizadora, que manda os convites pelo e-mail dela), com a permissão
    // calendar.events.owned. sendUpdates=all: cada convidado recebe o convite, a mudança e o cancelamento por e-mail.
    /**
     * Cria a reunião com o id escolhido pelo SEMPER e pede o link do Meet (conferenceDataVersion=1: sem ele, o Google ignora o
     * pedido do link). Devolve o evento como o Google o gravou (o link pode ainda estar sendo criado).
     */
    criarReuniao: (evento: EventoDaReuniao) =>
      pedir<RespostaDaReuniao>(buscar, `${REUNIOES}?conferenceDataVersion=1&sendUpdates=all`, com('POST', evento)),
    /** A reunião como está no Google (para ler o link que ainda estava sendo criado). */
    lerReuniao: (eventoId: string) => pedir<RespostaDaReuniao>(buscar, `${REUNIOES}/${encodeURIComponent(eventoId)}`, com('GET')),
    /**
     * Muda a reunião (data, hora, título, convidados): o Google manda o convite atualizado a cada convidado. Sem o pedido do
     * link no corpo, o link do Meet fica o mesmo (só os campos enviados mudam); com ele, conferenceDataVersion=1.
     */
    mudarReuniao: (eventoId: string, corpo: Record<string, unknown>) =>
      pedir<RespostaDaReuniao>(buscar, `${REUNIOES}/${encodeURIComponent(eventoId)}?conferenceDataVersion=1&sendUpdates=all`, com('PATCH', corpo)),
    /** Cancela a reunião (cada convidado recebe o cancelamento); a que já não existe no Google conta como cancelada. */
    async cancelarReuniao(eventoId: string) {
      try { await pedir<unknown>(buscar, `${REUNIOES}/${encodeURIComponent(eventoId)}?sendUpdates=all`, com('DELETE')); } catch (e) {
        if (!(e instanceof FalhaDaAgenda && e.tipo === 'sumiu')) throw e;
      }
    },
    /**
     * O espaço do Meet pelo código da reunião (spaces.get da Meet REST API aceita o código no lugar do id): devolve o nome
     * do espaço ("spaces/…"), o único que o patch aceita.
     */
    async espacoDoMeet(codigo: string) {
      const { name } = await pedir<{ name?: string }>(buscar, `${MEET}/spaces/${encodeURIComponent(codigo)}`, com('GET'));
      if (!name) throw new FalhaDaAgenda('temporario', 'o Google não devolveu o espaço do Meet');
      return name;
    },
    /**
     * Liga a gravação e a transcrição automáticas do espaço (spaces.patch, só o organizador consegue): elas começam sozinhas
     * quando entra na reunião alguém que pode gravar.
     */
    ligarGravacao: (espaco: string) => pedir<unknown>(buscar, `${MEET}/${espaco}?updateMask=${encodeURIComponent(MASCARA_DA_GRAVACAO)}`,
      com('PATCH', CONFIG_DA_GRAVACAO)).then(() => undefined)
  };
}
export type ApiDaAgenda = ReturnType<typeof apiDaAgenda>;
