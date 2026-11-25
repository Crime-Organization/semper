// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A reunião do Google Meet do compromisso (#437), em supabase/functions/_compartilhado/reunioesGoogle.ts: a reunião que deve
// existir, os convidados, o link na resposta do Google, o plano e a execução com o Google simulado (junto com as cópias).
import { describe, expect, it, vi } from 'vitest';
import { sincronizarAgendas, type PassosDasAgendas, type PedidoDaFila } from '../../../supabase/functions/_compartilhado/agendasGoogle';
import { CONFIG_DA_GRAVACAO, MASCARA_DA_GRAVACAO } from '../../../supabase/functions/_compartilhado/apiDaAgenda';
import { copiasDoItem, LINHA_DO_MEET, type AgendaDoEvento, type CompromissoNaAgenda, type ItemDaFila } from '../../../supabase/functions/_compartilhado/eventosGoogle';
import {
  codigoDoMeet, convidadosDaReuniao, DESCRICAO_DA_REUNIAO, idDaReuniao, linkDaResposta, planejarReuniao, reuniaoDesejada, type ReuniaoGuardada
} from '../../../supabase/functions/_compartilhado/reunioesGoogle';
import { SITE } from '../../../supabase/functions/_compartilhado/emailsDePrazo';

const ESCRITORIO = 'e1', CONTA = 'contato@exemplo.com';
const ANA = 'a0000000-0000-0000-0000-000000000001';
const COMPROMISSO = '72000000-0000-0000-0000-000000000001';
const ID = 'r72000000000000000000000000000001';
const LINK = 'https://meet.google.com/abc-mnop-xyz';
const AGENDAS: AgendaDoEvento[] = [{ id: 'ag-ana', tipo: 'pessoa', perfil_id: ANA, sala_id: null, google_id: 'ag-ana@google' }];
const compromisso = (campos: Partial<CompromissoNaAgenda> = {}): CompromissoNaAgenda => ({
  id: COMPROMISSO, titulo: 'Reunião com o cliente', data: '2026-12-10', hora: '14:00', hora_fim: '15:30', local: null, geral: false,
  responsavel_id: ANA, participantes: [], sala_id: null, sala_nome: null, clientes: 'CLIENTE', processo_numero: '0001234-56.2026.8.26.0100',
  arquivado: false, cancelado: false, reuniao: true, convidados: ['ana@exemplo.com', 'cliente@exemplo.com'], ...campos
});
const guardada = (campos: Partial<ReuniaoGuardada> = {}): ReuniaoGuardada =>
  ({ evento_id: ID, link: LINK, espaco: null, gravacao: null, gravacao_detalhe: null, assinatura: null, ...campos });

describe('A reunião que o compromisso deve ter', () => {
  it('dado o compromisso com "Criar link do Google Meet", então a reunião tem o id do SEMPER, o horário, os convidados e nada da ficha na descrição', () => {
    // Quando
    const d = reuniaoDesejada(compromisso({ sala_nome: 'Sala 1' }), ESCRITORIO, CONTA)!;
    // Então
    expect(d.evento).toMatchObject({
      id: ID, summary: 'Reunião com o cliente', location: 'Sala 1', status: 'confirmed', description: DESCRICAO_DA_REUNIAO,
      start: { dateTime: '2026-12-10T14:00:00', timeZone: 'America/Sao_Paulo' }, end: { dateTime: '2026-12-10T15:30:00', timeZone: 'America/Sao_Paulo' },
      attendees: [{ email: 'ana@exemplo.com' }, { email: 'cliente@exemplo.com' }],
      extendedProperties: { private: { semper_item: `reuniao:${COMPROMISSO}`, semper_escritorio: ESCRITORIO } }
    });
    expect(d.evento.description).not.toContain(SITE);
    expect(d.evento.description).not.toContain('CLIENTE');
    expect(d.evento.description).not.toContain('0001234');
    expect(d.evento).not.toHaveProperty('conferenceData');
  });

  it.each([
    ['sem a opção', { reuniao: false }],
    ['do banco antes da #437 (sem o campo)', { reuniao: undefined }],
    ['arquivado', { arquivado: true }],
    ['cancelado', { cancelado: true }]
  ] as const)('dado o compromisso %s, então não deve haver reunião', (_caso, campos) => {
    // Quando / Então
    expect(reuniaoDesejada(compromisso(campos), ESCRITORIO, CONTA)).toBeNull();
  });

  it('dado o compromisso excluído, então não deve haver reunião', () => {
    // Quando / Então
    expect(reuniaoDesejada(null, ESCRITORIO, CONTA)).toBeNull();
  });

  it('quando os convidados são montados, então não se repetem, não incluem a conta do escritório (a organizadora) e ficam em ordem', () => {
    // Quando / Então
    expect(convidadosDaReuniao([' Beto@Exemplo.com', 'ana@exemplo.com', 'beto@exemplo.com', 'CONTATO@exemplo.com', '', null], CONTA))
      .toEqual(['ana@exemplo.com', 'beto@exemplo.com']);
  });

  it('dado o compromisso mudado de hora, então a assinatura muda; com os mesmos dados, fica a mesma', () => {
    // Quando / Então
    const antes = reuniaoDesejada(compromisso(), ESCRITORIO, CONTA)!.assinatura;
    expect(reuniaoDesejada(compromisso(), ESCRITORIO, CONTA)!.assinatura).toBe(antes);
    expect(reuniaoDesejada(compromisso({ hora: '15:00', hora_fim: null }), ESCRITORIO, CONTA)!.assinatura).not.toBe(antes);
    expect(idDaReuniao(COMPROMISSO)).toBe(ID);
  });
});

describe('O link na resposta do Google', () => {
  it.each([
    ['o ponto de entrada por vídeo', { conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+1' }, { entryPointType: 'video', uri: LINK }] } }, { estado: 'pronto', link: LINK }],
    ['só o hangoutLink', { hangoutLink: LINK }, { estado: 'pronto', link: LINK }],
    ['o pedido ainda pendente', { conferenceData: { createRequest: { status: { statusCode: 'pending' } } } }, { estado: 'esperando' }],
    ['o pedido que falhou', { conferenceData: { createRequest: { status: { statusCode: 'failure' } } } }, { estado: 'falhou' }],
    ['nada sobre a conferência', {}, { estado: 'falhou' }]
  ])('dada a resposta com %s, então o link fica %o', (_caso, r, esperado) => {
    // Quando / Então
    expect(linkDaResposta(r)).toEqual(esperado);
  });

  it.each([
    [LINK, 'abc-mnop-xyz'], [`${LINK}?authuser=0`, 'abc-mnop-xyz'], ['https://exemplo.com/abc', null], [null, null]
  ])('dado o link %s, então o código da reunião é %s', (link, codigo) => {
    // Quando / Então
    expect(codigoDoMeet(link)).toBe(codigo);
  });
});

describe('O plano da reunião', () => {
  const d = reuniaoDesejada(compromisso(), ESCRITORIO, CONTA)!;
  it.each([
    ['sem as permissões do Meet', d, null, false, null],
    ['sem reunião e sem a opção', null, null, true, null],
    ['a reunião que não deve mais existir', null, guardada(), true, 'cancelar'],
    ['a reunião que falta', d, null, true, 'criar'],
    ['o link ainda sendo criado', d, guardada({ link: null, assinatura: d.assinatura }), true, 'conferir'],
    ['o convite que mudou', d, guardada({ assinatura: 'antiga' }), true, 'mudar'],
    ['a gravação ainda não ligada', d, guardada({ assinatura: d.assinatura }), true, 'gravar'],
    ['tudo em dia (gravação ligada)', d, guardada({ assinatura: d.assinatura, gravacao: 'ligada' }), true, null],
    ['tudo em dia (gravação recusada)', d, guardada({ assinatura: d.assinatura, gravacao: 'recusada' }), true, null]
  ] as const)('dado %s, então o próximo passo é %s', (_caso, desejada, g, meet, acao) => {
    // Quando / Então
    expect(planejarReuniao(desejada, g, meet)).toBe(acao);
  });
});

describe('O link nas cópias das agendas', () => {
  it('dado o link criado, então a descrição de cada cópia o traz; sem ele, a cópia fica como era', () => {
    // Quando
    const [com] = copiasDoItem('compromisso', compromisso({ reuniao_link: LINK }), AGENDAS, ESCRITORIO);
    const [sem] = copiasDoItem('compromisso', compromisso({ reuniao: undefined, convidados: undefined }), AGENDAS, ESCRITORIO);
    const [semNada] = copiasDoItem('compromisso', compromisso({ reuniao: false, convidados: [], reuniao_link: null }), AGENDAS, ESCRITORIO);
    // Então
    expect(com.evento.description).toContain(LINHA_DO_MEET(LINK));
    expect(sem.evento.description).not.toContain('Google Meet');
    expect(semNada.assinatura).toBe(sem.assinatura);
  });
});

// ---------------------------------------------------------------------
// A execução, com o Google e o banco simulados
// ---------------------------------------------------------------------
interface Pedido { url: string; metodo: string; corpo: string }
const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const comLink = (link = LINK) => ({ id: ID, status: 'confirmed', conferenceData: { entryPoints: [{ entryPointType: 'video', uri: link }] } });
const PRINCIPAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const PADRAO = (p: Pedido): Response => {
  if (p.url.startsWith('https://oauth2.googleapis.com/token')) return resposta(200, { access_token: 'acesso' });
  if (p.url.startsWith(PRINCIPAL) && p.metodo !== 'DELETE') return resposta(200, comLink());
  if (p.url.startsWith('https://meet.googleapis.com/v2/spaces/abc-mnop-xyz')) return resposta(200, { name: 'spaces/espaco1' });
  if (p.metodo === 'POST' && p.url.endsWith('/events')) return resposta(200, { id: (JSON.parse(p.corpo) as { id: string }).id });
  if (p.metodo === 'DELETE') return resposta(204);
  return resposta(200, {});
};
function google(responder: (p: Pedido) => Response | null = () => null) {
  const pedidos: Pedido[] = [];
  const buscar = vi.fn(async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const p: Pedido = { url: String(entrada), metodo: init.method ?? 'GET', corpo: String(init.body ?? '') };
    pedidos.push(p);
    return responder(p) ?? PADRAO(p);
  }) as unknown as typeof fetch;
  const daReuniao = () => pedidos.filter(p => p.url.startsWith(PRINCIPAL) || p.url.startsWith('https://meet.googleapis.com'));
  return {
    buscar, pedidos,
    reuniao: () => daReuniao().map(p => `${p.metodo} ${p.url.replace(PRINCIPAL, 'principal').replace('https://meet.googleapis.com/v2', 'meet')}`),
    corpo: (i: number) => JSON.parse(daReuniao()[i].corpo) as Record<string, unknown>,
    copias: () => pedidos.filter(p => p.url.includes('/calendars/ag-ana%40google/events'))
  };
}
const pedidoDaFila = (campos: Partial<PedidoDaFila> = {}): PedidoDaFila =>
  ({ id: 'f1', escritorio_id: ESCRITORIO, assunto: 'compromisso', item_id: COMPROMISSO, versao: 1, tentativas: 1, conta_email: CONTA, ...campos });

/** O banco simulado: o compromisso, a reunião guardada e se a conta deu as permissões do Meet. */
function passos(item: ItemDaFila['item'], antes: ReuniaoGuardada | null, buscar: typeof fetch, meet = true) {
  const banco = { reuniao: antes };
  let pedidos = 0;
  const p = {
    pendentes: vi.fn(async () => [pedidoDaFila()]),
    estado: vi.fn(async () => ({ conta_email: CONTA, equipe: [], salas: [], agendas: [], compartilhamentos: [] })),
    agendaCriada: vi.fn(async () => 'nova'), agendaRenomeada: vi.fn(async () => {}), agendaSumiu: vi.fn(async () => {}),
    compartilhada: vi.fn(async () => {}), compartilhamentoRecusado: vi.fn(async () => {}), retirada: vi.fn(async () => {}),
    concluir: vi.fn(async () => {}), falhou: vi.fn(async () => {}),
    item: vi.fn(async () => structuredClone({ item, agendas: AGENDAS, eventos: [], reuniao: banco.reuniao, meet })),
    eventoGravado: vi.fn(async () => {}), eventoApagado: vi.fn(async () => {}),
    reuniaoGravada: vi.fn(async (_p: PedidoDaFila, r: ReuniaoGuardada) => { banco.reuniao = r; }),
    reuniaoCancelada: vi.fn(async () => { banco.reuniao = null; }),
    novoPedido: () => `pedido-${++pedidos}`,
    tokenDeRenovacao: vi.fn(async () => 'renovacao'), buscar, clienteId: 'cliente', clienteSegredo: 'segredo'
  } satisfies PassosDasAgendas;
  return { passos: p, banco };
}

describe('A execução da reunião, com o Google simulado', () => {
  it('dado o compromisso com a opção marcada, quando a fila é feita, então a conta do escritório cria a reunião com os convites, liga a gravação e as cópias levam o link', async () => {
    // Dado
    const g = google();
    const { passos: p, banco } = passos(compromisso(), null, g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r).toMatchObject({ falhas: 0, restam: false, feitas: { reuniao: 1, gravar_evento: 1 } });
    expect(g.reuniao()).toEqual([
      'POST principal?conferenceDataVersion=1&sendUpdates=all',
      'GET meet/spaces/abc-mnop-xyz',
      `PATCH meet/spaces/espaco1?updateMask=${encodeURIComponent(MASCARA_DA_GRAVACAO)}`
    ]);
    expect(g.corpo(0)).toMatchObject({
      id: ID, attendees: [{ email: 'ana@exemplo.com' }, { email: 'cliente@exemplo.com' }],
      conferenceData: { createRequest: { requestId: 'pedido-1', conferenceSolutionKey: { type: 'hangoutsMeet' } } }
    });
    expect(g.corpo(2)).toEqual(CONFIG_DA_GRAVACAO);
    expect(banco.reuniao).toMatchObject({ evento_id: ID, link: LINK, espaco: 'spaces/espaco1', gravacao: 'ligada' });
    expect(g.copias()[0].corpo).toContain(LINHA_DO_MEET(LINK));
    expect(p.concluir).toHaveBeenCalledWith(pedidoDaFila(), false);
  });

  it('dado o Google ainda criando o link, quando a fila é feita, então a reunião fica guardada sem link, as cópias vão e o pedido volta para a próxima vez', async () => {
    // Dado
    const g = google(x => (x.url.startsWith(PRINCIPAL) ? resposta(200, { id: ID, conferenceData: { createRequest: { status: { statusCode: 'pending' } } } }) : null));
    const { passos: p, banco } = passos(compromisso(), null, g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r).toMatchObject({ falhas: 0, restam: true });
    expect(banco.reuniao).toMatchObject({ evento_id: ID, link: null });
    expect(g.copias()).toHaveLength(1);
    expect(p.concluir).toHaveBeenCalledWith(pedidoDaFila(), true);
  });

  it('dado o link que ainda estava sendo criado, quando a fila roda de novo, então o link é lido do Google e guardado', async () => {
    // Dado
    const d = reuniaoDesejada(compromisso(), ESCRITORIO, CONTA)!;
    const g = google();
    const { passos: p, banco } = passos(compromisso(), guardada({ link: null, assinatura: d.assinatura }), g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(g.reuniao()[0]).toBe(`GET principal/${ID}`);
    expect(banco.reuniao?.link).toBe(LINK);
  });

  it('dado o compromisso mudado de hora, quando a fila é feita, então o convite é atualizado sem pedir outro link (o link continua o mesmo)', async () => {
    // Dado
    const g = google();
    const { passos: p, banco } = passos(compromisso({ hora: '16:00', hora_fim: null }), guardada({ assinatura: 'antiga', gravacao: 'ligada' }), g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(g.reuniao()).toEqual([`PATCH principal/${ID}?conferenceDataVersion=1&sendUpdates=all`]);
    expect(g.corpo(0)).not.toHaveProperty('conferenceData');
    expect(g.corpo(0)).toMatchObject({ start: { dateTime: '2026-12-10T16:00:00' }, attendees: [{ email: 'ana@exemplo.com' }, { email: 'cliente@exemplo.com' }] });
    expect(banco.reuniao).toMatchObject({ link: LINK, gravacao: 'ligada', assinatura: reuniaoDesejada(compromisso({ hora: '16:00', hora_fim: null }), ESCRITORIO, CONTA)!.assinatura });
    expect(r.feitas.reuniao).toBe(1);
  });

  it.each([
    ['arquivado', compromisso({ arquivado: true })],
    ['cancelado', compromisso({ cancelado: true })],
    ['com a opção desmarcada', compromisso({ reuniao: false })],
    ['excluído', null]
  ])('dado o compromisso %s com reunião no Google, quando a fila é feita, então a reunião é cancelada (com aviso aos convidados) e esquecida', async (_caso, item) => {
    // Dado
    const g = google();
    const { passos: p, banco } = passos(item, guardada({ gravacao: 'ligada' }), g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(g.reuniao()).toEqual([`DELETE principal/${ID}?sendUpdates=all`]);
    expect(banco.reuniao).toBeNull();
    expect(r).toMatchObject({ falhas: 0, feitas: { reuniao: 1 } });
  });

  it('dado o Google que não deixa ligar a gravação (a edição do Workspace), quando a fila é feita, então a reunião fica sem ela, guardada como recusada, sem falha', async () => {
    // Dado
    const g = google(x => (x.url.startsWith('https://meet.googleapis.com') && x.metodo === 'PATCH' ? resposta(403, { error: { code: 403, status: 'PERMISSION_DENIED' } }) : null));
    const { passos: p, banco } = passos(compromisso(), null, g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r.falhas).toBe(0);
    expect(banco.reuniao).toMatchObject({ link: LINK, gravacao: 'recusada', gravacao_detalhe: '403 PERMISSION_DENIED' });
  });

  it('dada a reunião criada antes, cancelada e marcada de novo (o id já existe no Google), quando a fila é feita, então ela volta com um link novo', async () => {
    // Dado
    const novo = 'https://meet.google.com/xyz-abcd-efg';
    const g = google(x => {
      if (x.metodo === 'POST' && x.url.startsWith(PRINCIPAL)) return resposta(409, { error: { code: 409, errors: [{ reason: 'duplicate' }] } });
      if (x.metodo === 'GET' && x.url.startsWith(PRINCIPAL)) return resposta(200, { id: ID, status: 'cancelled' });
      if (x.metodo === 'PATCH' && x.url.startsWith(PRINCIPAL)) return resposta(200, comLink(novo));
      return null;
    });
    const { passos: p, banco } = passos(compromisso(), null, g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(g.reuniao().slice(0, 3)).toEqual(['POST principal?conferenceDataVersion=1&sendUpdates=all', `GET principal/${ID}`,
      `PATCH principal/${ID}?conferenceDataVersion=1&sendUpdates=all`]);
    expect(g.corpo(2)).toMatchObject({ status: 'confirmed', conferenceData: { createRequest: { requestId: 'pedido-2' } } });
    expect(banco.reuniao?.link).toBe(novo);
  });

  it('dado o Google que não consegue criar o link, quando a fila é feita, então a reunião fica guardada sem link e o pedido falha como recusado', async () => {
    // Dado
    const g = google(x => (x.url.startsWith(PRINCIPAL) ? resposta(200, { id: ID, conferenceData: { createRequest: { status: { statusCode: 'failure' } } } }) : null));
    const { passos: p, banco } = passos(compromisso(), null, g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r.falhas).toBe(1);
    expect(p.falhou).toHaveBeenCalledWith(pedidoDaFila(), 'recusado', 'o Google não criou o link do Meet', expect.any(Number));
    expect(banco.reuniao).toMatchObject({ evento_id: ID, link: null });
  });

  it('dada a conta sem as permissões do Meet, quando a fila é feita, então nada vai à agenda principal e as cópias vão sem link', async () => {
    // Dado
    const g = google();
    const { passos: p } = passos(compromisso(), null, g.buscar, false);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(g.reuniao()).toEqual([]);
    expect(g.copias()[0].corpo).not.toContain('Google Meet');
  });
});
