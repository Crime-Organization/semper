// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os eventos nas agendas do escritório no Google Agenda (#166, parte 2), em supabase/functions/_compartilhado/: o que vai
// para qual agenda, como fica cada evento, o plano (gravar e apagar) e a execução com o Google simulado.
import { describe, expect, it, vi } from 'vitest';
import { sincronizarAgendas, type PassosDasAgendas, type PedidoDaFila } from '../../../supabase/functions/_compartilhado/agendasGoogle';
import {
  AVISO_DO_EVENTO, copiasDoItem, corpoParaMudar, DURACAO_DO_PRAZO, DURACAO_SEM_FIM, FUSO_DOS_EVENTOS, idDoEvento, MARCA_DO_ESCRITORIO, MARCA_DO_ITEM, planejarEventos,
  somarDiasNaData, somarMinutos, type AgendaDoEvento, type CompromissoNaAgenda, type DiaNaAgenda, type EventoGuardado, type ItemDaFila, type ParcelaNaAgenda,
  type PrazoNaAgenda
} from '../../../supabase/functions/_compartilhado/eventosGoogle';
import { SITE } from '../../../supabase/functions/_compartilhado/emailsDePrazo';

const ESCRITORIO = 'e1';
const ANA = 'a0000000-0000-0000-0000-000000000001', BETO = 'a0000000-0000-0000-0000-000000000002', CAIO = 'a0000000-0000-0000-0000-000000000003';
const SALA = '5a000000-0000-0000-0000-000000000001';
const agenda = (id: string, campos: Partial<AgendaDoEvento> = {}): AgendaDoEvento => ({ id, tipo: 'pessoa', perfil_id: null, sala_id: null, google_id: `${id}@google`, ...campos });
const AGENDAS: AgendaDoEvento[] = [
  agenda('ag-ana', { perfil_id: ANA }), agenda('ag-beto', { perfil_id: BETO }), agenda('ag-geral', { tipo: 'geral' }),
  agenda('ag-sala', { tipo: 'sala', sala_id: SALA }), agenda('ag-adm', { tipo: 'administrativo' })
];
const compromisso = (campos: Partial<CompromissoNaAgenda> = {}): CompromissoNaAgenda => ({
  id: '72000000-0000-0000-0000-000000000001', titulo: 'Reunião com o cliente', data: '2026-12-10', hora: '14:00', hora_fim: '15:30', local: null, geral: false,
  responsavel_id: ANA, participantes: [], sala_id: null, sala_nome: null, clientes: null, processo_numero: null, arquivado: false, cancelado: false, ...campos
});
const prazo = (campos: Partial<PrazoNaAgenda> = {}): PrazoNaAgenda => ({
  id: '70000000-0000-0000-0000-000000000001', titulo: 'Petição inicial', prazo: '2026-12-10', prazo_hora: null, responsavel_id: ANA, participantes: [],
  clientes: null, processo_numero: null, arquivado: false, concluido: false, ...campos
});
const dia = (campos: Partial<DiaNaAgenda> = {}): DiaNaAgenda => ({ id: 'f0000000-0000-0000-0000-000000000001', data: '2026-12-08', motivo: 'Feriado municipal', tipo: 'feriado', orgao: null, ...campos });
const parcela = (campos: Partial<ParcelaNaAgenda> = {}): ParcelaNaAgenda => ({
  id: 'd0000000-0000-0000-0000-000000000001', contrato_id: 'c0000000-0000-0000-0000-000000000001', contrato_codigo: 'AA11-0001-2030', numero: 2, total: 10,
  vencimento: '2026-12-15', valor: 150050, clientes: 'CLIENTE', responsavel_id: BETO, recebida: false, excluida: false, ...campos
});
const agendasDas = (copias: ReturnType<typeof copiasDoItem>) => copias.map(c => c.agenda.id);

describe('Em quais agendas cada item fica', () => {
  it('dado um compromisso com um participante, da Agenda geral e com sala, então há uma cópia na agenda de cada um, na Geral e na da sala', () => {
    // Dado
    const c = compromisso({ participantes: [BETO], geral: true, sala_id: SALA, sala_nome: 'Sala 1' });
    // Quando / Então
    expect(agendasDas(copiasDoItem('compromisso', c, AGENDAS, ESCRITORIO))).toEqual(['ag-ana', 'ag-beto', 'ag-geral', 'ag-sala']);
  });

  it('dado um compromisso sem Agenda geral e sem sala, então fica só nas agendas da equipe dele (nunca na Administrativo)', () => {
    // Quando / Então
    expect(agendasDas(copiasDoItem('compromisso', compromisso(), AGENDAS, ESCRITORIO))).toEqual(['ag-ana']);
  });

  it.each([
    ['arquivado', { arquivado: true }], ['cancelado (na coluna "Cancelado")', { cancelado: true }]
  ])('dado um compromisso %s, então não fica em agenda nenhuma', (_caso, campos) => {
    // Quando / Então
    expect(copiasDoItem('compromisso', compromisso({ participantes: [BETO], geral: true, ...campos }), AGENDAS, ESCRITORIO)).toEqual([]);
  });

  it('dado o compromisso excluído (o banco não o acha mais), então não fica em agenda nenhuma', () => {
    // Quando / Então
    expect(copiasDoItem('compromisso', null, AGENDAS, ESCRITORIO)).toEqual([]);
  });

  it('dado alguém que é responsável e também está entre os participantes, então a agenda dele tem uma cópia só', () => {
    // Quando / Então
    expect(agendasDas(copiasDoItem('compromisso', compromisso({ participantes: [ANA, BETO] }), AGENDAS, ESCRITORIO))).toEqual(['ag-ana', 'ag-beto']);
  });

  it('dado um participante que ainda não tem agenda no Google, então a cópia dele espera a agenda nascer (o banco põe o item na fila de novo)', () => {
    // Quando / Então
    expect(agendasDas(copiasDoItem('compromisso', compromisso({ participantes: [CAIO] }), AGENDAS, ESCRITORIO))).toEqual(['ag-ana']);
  });

  it.each([
    ['tarefa', 'tarefa'], ['demanda', 'demanda']
  ] as const)('dada uma %s com prazo e um participante, então fica na agenda do responsável e do participante', (_caso, assunto) => {
    // Quando / Então
    expect(agendasDas(copiasDoItem(assunto, prazo({ participantes: [BETO] }), AGENDAS, ESCRITORIO))).toEqual(['ag-ana', 'ag-beto']);
  });

  it.each([
    ['sem prazo', { prazo: null }], ['concluída', { concluido: true }], ['arquivada', { arquivado: true }]
  ])('dada uma tarefa %s, então ela sai das agendas', (_caso, campos) => {
    // Quando / Então
    expect(copiasDoItem('tarefa', prazo({ participantes: [BETO], ...campos }), AGENDAS, ESCRITORIO)).toEqual([]);
  });

  it('dado um dia sem expediente do escritório, então fica na Geral', () => {
    // Quando / Então
    expect(agendasDas(copiasDoItem('dia', dia(), AGENDAS, ESCRITORIO))).toEqual(['ag-geral']);
  });

  it('dada uma parcela a receber, então fica na agenda do advogado responsável pelo contrato (não na Administrativo)', () => {
    // Quando / Então
    expect(agendasDas(copiasDoItem('parcela', parcela(), AGENDAS, ESCRITORIO))).toEqual(['ag-beto']);
  });

  it.each([
    ['recebida', { recebida: true }], ['excluída', { excluida: true }]
  ])('dada uma parcela %s, então ela sai da agenda', (_caso, campos) => {
    // Quando / Então
    expect(copiasDoItem('parcela', parcela(campos), AGENDAS, ESCRITORIO)).toEqual([]);
  });
});

describe('Como fica cada evento', () => {
  it('dado um compromisso com hora de início e de fim, então o evento vai no relógio de Brasília, com o local, a sala, os clientes, o processo e o link', () => {
    // Dado
    const c = compromisso({ local: 'https://meet.example/abc', sala_id: SALA, sala_nome: 'Sala 1', clientes: 'CLIENTE, OUTRO', processo_numero: '0001234-56.2026.8.13.0001' });
    // Quando
    const [{ evento }] = copiasDoItem('compromisso', c, AGENDAS, ESCRITORIO);
    // Então
    expect(evento).toMatchObject({
      id: 'c72000000000000000000000000000001', summary: 'Reunião com o cliente', location: 'https://meet.example/abc', status: 'confirmed',
      start: { dateTime: '2026-12-10T14:00:00', timeZone: FUSO_DOS_EVENTOS }, end: { dateTime: '2026-12-10T15:30:00', timeZone: FUSO_DOS_EVENTOS },
      extendedProperties: { private: { [MARCA_DO_ITEM]: `compromisso:${c.id}`, [MARCA_DO_ESCRITORIO]: ESCRITORIO } }
    });
    expect(evento.description!.split('\n')).toEqual([
      'Sala: Sala 1', 'Local ou link: https://meet.example/abc', 'Clientes: CLIENTE, OUTRO', 'Processo: 0001234-56.2026.8.13.0001', '',
      `Abrir no SEMPER: ${SITE}/agenda/?id=${c.id}`, AVISO_DO_EVENTO
    ]);
  });

  it('dado um compromisso só com a hora de início, então dura o mesmo que a sala conta (uma hora)', () => {
    // Quando
    const [{ evento }] = copiasDoItem('compromisso', compromisso({ hora_fim: null }), AGENDAS, ESCRITORIO);
    // Então
    expect(DURACAO_SEM_FIM).toBe(60);
    expect(evento.end).toEqual({ dateTime: '2026-12-10T15:00:00', timeZone: FUSO_DOS_EVENTOS });
  });

  it('dado um compromisso sem hora, com sala e sem local, então é do dia inteiro (o fim é o dia seguinte) e o local é a sala', () => {
    // Quando
    const [{ evento }] = copiasDoItem('compromisso', compromisso({ hora: null, hora_fim: null, sala_id: SALA, sala_nome: 'Sala 1' }), AGENDAS, ESCRITORIO);
    // Então
    expect(evento).toMatchObject({ start: { date: '2026-12-10' }, end: { date: '2026-12-11' }, location: 'Sala 1' });
  });

  it('dada uma tarefa sem hora no prazo, então o evento é o dia inteiro da entrega, com o prazo, os clientes e o link na descrição', () => {
    // Quando
    const [{ evento }] = copiasDoItem('tarefa', prazo({ clientes: 'CLIENTE', processo_numero: '123' }), AGENDAS, ESCRITORIO);
    // Então
    expect(evento).toMatchObject({ id: 't70000000000000000000000000000001', summary: 'Petição inicial', start: { date: '2026-12-10' }, end: { date: '2026-12-11' } });
    expect(evento).not.toHaveProperty('location');
    expect(evento.description!.split('\n')).toEqual(['Prazo da tarefa: 10/12/2026', 'Clientes: CLIENTE', 'Processo: 123', '',
      `Abrir no SEMPER: ${SITE}/tarefas/?id=70000000-0000-0000-0000-000000000001`, AVISO_DO_EVENTO]);
  });

  it('dada uma demanda com hora no prazo, então o evento começa na hora da entrega e dura o tempo combinado', () => {
    // Quando
    const [{ evento }] = copiasDoItem('demanda', prazo({ prazo_hora: '23:45' }), AGENDAS, ESCRITORIO);
    // Então
    expect(DURACAO_DO_PRAZO).toBe(30);
    expect(evento).toMatchObject({
      id: 'd70000000000000000000000000000001', start: { dateTime: '2026-12-10T23:45:00', timeZone: FUSO_DOS_EVENTOS },
      end: { dateTime: '2026-12-11T00:15:00', timeZone: FUSO_DOS_EVENTOS }
    });
    expect(evento.description).toContain('Prazo da demanda: 10/12/2026 às 23:45');
    expect(evento.description).toContain(`${SITE}/demandas/?id=`);
  });

  it('dado um dia de suspensão de um órgão, então o evento diz o tipo e o órgão, e leva ao calendário', () => {
    // Quando
    const [{ evento }] = copiasDoItem('dia', dia({ tipo: 'suspensao_com_expediente', motivo: 'Portaria 12', orgao: 'TJMG' }), AGENDAS, ESCRITORIO);
    // Então
    expect(evento).toMatchObject({ id: 'ff0000000000000000000000000000001', summary: 'Portaria 12', start: { date: '2026-12-08' }, end: { date: '2026-12-09' } });
    expect(evento.description!.split('\n').slice(0, 2)).toEqual(['Suspensão de prazos com expediente', 'Só no órgão: TJMG']);
    expect(evento.description).toContain(`Abrir no SEMPER: ${SITE}/calendario/`);
  });

  it('dada uma parcela, então o evento é o dia do vencimento, com o número, o contrato, o valor e o link para o contrato', () => {
    // Quando
    const [{ evento }] = copiasDoItem('parcela', parcela(), AGENDAS, ESCRITORIO);
    // Então
    expect(evento.summary).toBe('Parcela 2/10 · AA11-0001-2030 · R$ 1.500,50');
    expect(evento).toMatchObject({ start: { date: '2026-12-15' }, end: { date: '2026-12-16' } });
    expect(evento.description).toContain('Valor: R$ 1.500,50');
    expect(evento.description).toContain('Clientes: CLIENTE');
    expect(evento.description).toContain(`${SITE}/contratos/?id=c0000000-0000-0000-0000-000000000001`);
  });

  it('dados os ids de cada assunto, então só usam o que o Google aceita (a-v e 0-9, de 5 a 1024) e são sempre os mesmos', () => {
    // Quando
    const ids = (['compromisso', 'tarefa', 'demanda', 'dia', 'parcela'] as const).map(a => idDoEvento(a, 'ABCDEF12-0000-0000-0000-000000000009'));
    // Então
    ids.forEach(id => expect(id).toMatch(/^[a-v0-9]{5,1024}$/));
    expect(new Set(ids).size).toBe(5);
    expect(idDoEvento('tarefa', 'ABCDEF12-0000-0000-0000-000000000009')).toBe(ids[1]);
  });

  it('quando as datas passam do fim do mês ou do ano, então as contas acertam', () => {
    // Quando / Então
    expect(somarDiasNaData('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDiasNaData('2028-02-28', 1)).toBe('2028-02-29');
    expect(somarMinutos('2026-12-31', '23:30', 60)).toBe('2027-01-01T00:30:00');
  });

  it('dado um item que mudou num campo que vai ao Google, então a assinatura muda; sem mudança, fica igual', () => {
    // Quando
    const [a] = copiasDoItem('tarefa', prazo(), AGENDAS, ESCRITORIO);
    const [b] = copiasDoItem('tarefa', prazo(), AGENDAS, ESCRITORIO);
    const [c] = copiasDoItem('tarefa', prazo({ titulo: 'Contestação' }), AGENDAS, ESCRITORIO);
    // Então
    expect(a.assinatura).toBe(b.assinatura);
    expect(a.assinatura).not.toBe(c.assinatura);
    expect(a.assinatura.length).toBeLessThanOrEqual(64);
  });

  it('dado um evento que deixou de ter hora e de ter local, quando ele é mudado no Google, então o que saiu vai como null (o Google apaga)', () => {
    // Quando
    const [{ evento }] = copiasDoItem('tarefa', prazo(), AGENDAS, ESCRITORIO);
    // Então
    expect(corpoParaMudar(evento)).toMatchObject({
      location: null, start: { date: '2026-12-10', dateTime: null, timeZone: null }, end: { date: '2026-12-11', dateTime: null, timeZone: null }
    });
  });
});

describe('O plano dos eventos', () => {
  const guardado = (agenda_id: string, assinatura: string, evento_id = 't70000000000000000000000000000001'): EventoGuardado =>
    ({ agenda_id, agenda_google_id: `${agenda_id}@google`, evento_id, assinatura });

  it('dada uma tarefa nova, quando o plano é feito, então grava uma cópia em cada agenda', () => {
    // Quando
    const plano = planejarEventos(copiasDoItem('tarefa', prazo({ participantes: [BETO] }), AGENDAS, ESCRITORIO), []);
    // Então
    expect(plano.map(a => (a.acao === 'gravar' ? `gravar ${a.copia.agenda.id} ${a.existe}` : 'apagar'))).toEqual(['gravar ag-ana false', 'gravar ag-beto false']);
  });

  it('dado alguém que saiu da tarefa, quando o plano é feito, então a cópia dele sai primeiro e a do outro, igual, fica como está', () => {
    // Dado
    const copias = copiasDoItem('tarefa', prazo(), AGENDAS, ESCRITORIO);
    // Quando
    const plano = planejarEventos(copias, [guardado('ag-ana', copias[0].assinatura), guardado('ag-beto', copias[0].assinatura)]);
    // Então
    expect(plano).toEqual([{ acao: 'apagar', guardado: guardado('ag-beto', copias[0].assinatura) }]);
  });

  it('dada a tarefa que mudou de prazo, quando o plano é feito, então a cópia já gravada é mudada', () => {
    // Quando
    const plano = planejarEventos(copiasDoItem('tarefa', prazo({ prazo: '2026-12-20' }), AGENDAS, ESCRITORIO), [guardado('ag-ana', 'antiga')]);
    // Então
    expect(plano).toMatchObject([{ acao: 'gravar', existe: true, copia: { agenda: { id: 'ag-ana' } } }]);
  });

  it('dada a tarefa concluída, quando o plano é feito, então todas as cópias saem', () => {
    // Quando
    const plano = planejarEventos(copiasDoItem('tarefa', prazo({ concluido: true }), AGENDAS, ESCRITORIO), [guardado('ag-ana', 'x'), guardado('ag-beto', 'x')]);
    // Então
    expect(plano.map(a => a.acao)).toEqual(['apagar', 'apagar']);
  });
});

// ---------------------------------------------------------------------
// A execução, com o Google e o banco simulados
// ---------------------------------------------------------------------
interface Pedido { url: string; metodo: string; corpo: string }
const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const erroDaAgenda = (status: number, motivo: string) => resposta(status, { error: { code: status, errors: [{ reason: motivo }] } });
const PADRAO = (p: Pedido): Response => {
  if (p.url.startsWith('https://oauth2.googleapis.com/token')) return resposta(200, { access_token: 'acesso' });
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
  return { buscar, eventos: () => pedidos.filter(p => p.url.includes('/events')).map(p => `${p.metodo} ${decodeURIComponent(p.url.split('/calendars/')[1])}`) };
}
const pedidoDaFila = (campos: Partial<PedidoDaFila> = {}): PedidoDaFila =>
  ({ id: 'f1', escritorio_id: ESCRITORIO, assunto: 'tarefa', item_id: '70000000-0000-0000-0000-000000000001', versao: 1, tentativas: 1, conta_email: 'contato@exemplo.com', ...campos });

/** O banco simulado: o item, as agendas e as cópias gravadas, guardadas como o banco guardaria. */
function passos(item: ItemDaFila['item'], eventos: EventoGuardado[], buscar: typeof fetch, fila = [pedidoDaFila()]) {
  const banco = { agendas: [...AGENDAS], eventos: [...eventos] };
  const p = {
    pendentes: vi.fn(async () => fila),
    estado: vi.fn(async () => ({ conta_email: 'contato@exemplo.com', equipe: [], salas: [], agendas: [], compartilhamentos: [] })),
    agendaCriada: vi.fn(async () => 'nova'), agendaRenomeada: vi.fn(async () => {}),
    agendaSumiu: vi.fn(async (id: string) => { banco.agendas = banco.agendas.filter(a => a.id !== id); banco.eventos = banco.eventos.filter(e => e.agenda_id !== id); }),
    compartilhada: vi.fn(async () => {}), compartilhamentoRecusado: vi.fn(async () => {}), retirada: vi.fn(async () => {}),
    concluir: vi.fn(async () => {}), falhou: vi.fn(async () => {}),
    item: vi.fn(async () => structuredClone({ item, agendas: banco.agendas, eventos: banco.eventos })),
    eventoGravado: vi.fn(async (_p: PedidoDaFila, agenda_id: string, evento_id: string, assinatura: string) => {
      banco.eventos = [...banco.eventos.filter(e => !(e.agenda_id === agenda_id && e.evento_id === evento_id)),
        { agenda_id, agenda_google_id: banco.agendas.find(a => a.id === agenda_id)!.google_id, evento_id, assinatura }];
    }),
    eventoApagado: vi.fn(async (agenda_id: string, evento_id: string) => { banco.eventos = banco.eventos.filter(e => !(e.agenda_id === agenda_id && e.evento_id === evento_id)); }),
    tokenDeRenovacao: vi.fn(async () => 'renovacao'), buscar, clienteId: 'cliente', clienteSegredo: 'segredo'
  } satisfies PassosDasAgendas;
  return { passos: p, banco };
}
const ID = 't70000000000000000000000000000001';

describe('A execução dos eventos, com o Google simulado', () => {
  it('dada uma tarefa nova com um participante, quando a fila é feita, então cria uma cópia em cada agenda, com o id do SEMPER, e guarda as duas', async () => {
    // Dado
    const g = google();
    const { passos: p, banco } = passos(prazo({ participantes: [BETO] }), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r.feitas).toMatchObject({ gravar_evento: 2, apagar_evento: 0 });
    expect(g.eventos()).toEqual(['POST ag-ana@google/events', 'POST ag-beto@google/events']);
    expect(banco.eventos.map(e => `${e.agenda_id} ${e.evento_id}`)).toEqual([`ag-ana ${ID}`, `ag-beto ${ID}`]);
    expect(p.concluir).toHaveBeenCalledWith(pedidoDaFila(), false);
  });

  it('dada a mesma tarefa já em dia, quando a fila roda de novo, então nada vai ao Google', async () => {
    // Dado
    const [copia] = copiasDoItem('tarefa', prazo(), AGENDAS, ESCRITORIO);
    const g = google();
    const { passos: p } = passos(prazo(), [{ agenda_id: 'ag-ana', agenda_google_id: 'ag-ana@google', evento_id: ID, assinatura: copia.assinatura }], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(g.eventos()).toEqual([]);
    expect(r.feitas).toMatchObject({ gravar_evento: 0, apagar_evento: 0 });
  });

  it('dado o Beto tirado da tarefa e o prazo mudado, quando a fila é feita, então a cópia dele sai e a da Ana é mudada, com o que saiu como null', async () => {
    // Dado
    const g = google();
    const antigos: EventoGuardado[] = ['ag-ana', 'ag-beto'].map(agenda_id => ({ agenda_id, agenda_google_id: `${agenda_id}@google`, evento_id: ID, assinatura: 'antiga' }));
    const { passos: p, banco } = passos(prazo({ prazo: '2026-12-20' }), antigos, g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(g.eventos()).toEqual([`DELETE ag-beto@google/events/${ID}`, `PATCH ag-ana@google/events/${ID}`]);
    expect(banco.eventos.map(e => e.agenda_id)).toEqual(['ag-ana']);
  });

  it('dada uma cópia que o Google já tem (uma tentativa anterior chegou lá, ou ela foi apagada antes), quando é criada, então é mudada no lugar (sem duplicar)', async () => {
    // Dado
    const g = google(x => (x.metodo === 'POST' && x.url.endsWith('/events') ? erroDaAgenda(409, 'duplicate') : null));
    const { passos: p, banco } = passos(prazo(), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(g.eventos()).toEqual(['POST ag-ana@google/events', `PATCH ag-ana@google/events/${ID}`]);
    expect(r.feitas.gravar_evento).toBe(1);
    expect(banco.eventos).toHaveLength(1);
  });

  it('dada uma cópia apagada à mão no Google que some de vez, quando o item muda, então ela é criada de novo', async () => {
    // Dado
    const g = google(x => (x.metodo === 'PATCH' ? erroDaAgenda(404, 'notFound') : null));
    const { passos: p } = passos(prazo(), [{ agenda_id: 'ag-ana', agenda_google_id: 'ag-ana@google', evento_id: ID, assinatura: 'antiga' }], g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(g.eventos()).toEqual([`PATCH ag-ana@google/events/${ID}`, 'POST ag-ana@google/events']);
  });

  it('dada a agenda apagada no Google (conferida: ela também não existe lá), quando a cópia vai ser criada, então o SEMPER esquece a agenda (para criá-la de novo) e o pedido termina', async () => {
    // Dado
    const g = google(x => (x.url.includes('/events') || x.metodo === 'GET' ? erroDaAgenda(404, 'notFound') : null));
    const { passos: p } = passos(prazo(), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(p.agendaSumiu).toHaveBeenCalledWith('ag-ana');
    expect(p.eventoGravado).not.toHaveBeenCalled();
    expect(r).toMatchObject({ falhas: 0, feitas: { gravar_evento: 0 } });
  });

  it('dado um 404 do evento com a agenda ainda no Google (a conferência responde), quando a cópia vai ser criada, então a agenda não é esquecida e o pedido espera a próxima tentativa', async () => {
    // Dado
    const g = google(x => (x.url.includes('/events') ? erroDaAgenda(404, 'notFound') : null));
    const { passos: p } = passos(prazo(), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(p.agendaSumiu).not.toHaveBeenCalled();
    expect(r.falhas).toBe(1);
    expect(p.falhou).toHaveBeenCalledWith(pedidoDaFila(), 'temporario', expect.stringContaining('a agenda continua no Google'), 60);
  });

  it('dado o id já usado (409) e o evento que some ao ser mudado (404), quando a cópia é gravada, então a falha é do evento: a agenda nem é conferida nem esquecida', async () => {
    // Dado
    const g = google(x => (x.metodo === 'POST' && x.url.endsWith('/events') ? erroDaAgenda(409, 'duplicate') : x.metodo === 'PATCH' ? erroDaAgenda(404, 'notFound') : null));
    const { passos: p } = passos(prazo(), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(p.agendaSumiu).not.toHaveBeenCalled();
    expect(vi.mocked(g.buscar).mock.calls.some(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(false);
    expect(r.falhas).toBe(1);
    expect(p.falhou).toHaveBeenCalledWith(pedidoDaFila(), 'temporario', expect.stringContaining(`o evento ${ID}`), 60);
  });

  it('dada uma agenda criada há poucos minutos que ainda responde 404, quando a cópia vai ser criada, então ela não é esquecida (o Google ainda a espalha)', async () => {
    // Dado
    const agora = Date.parse('2026-11-25T12:00:00Z');
    const g = google(x => (x.url.includes('/events') || x.metodo === 'GET' ? erroDaAgenda(404, 'notFound') : null));
    const { passos: p, banco } = passos(prazo(), [], g.buscar);
    banco.agendas = banco.agendas.map(a => ({ ...a, criada_em: '2026-11-25T11:58:00Z' }));
    // Quando
    const r = await sincronizarAgendas(p, null, undefined, agora);
    // Então
    expect(p.agendaSumiu).not.toHaveBeenCalled();
    expect(r.falhas).toBe(1);
  });

  it('dado o compromisso excluído no SEMPER, quando a fila é feita, então todas as cópias saem do Google (a que já não existia lá também conta como tirada)', async () => {
    // Dado
    const g = google(x => (x.url.includes('ag-sala') ? erroDaAgenda(410, 'deleted') : null));
    const idC = 'c72000000000000000000000000000001';
    const antigos: EventoGuardado[] = ['ag-ana', 'ag-sala'].map(agenda_id => ({ agenda_id, agenda_google_id: `${agenda_id}@google`, evento_id: idC, assinatura: 'x' }));
    const { passos: p, banco } = passos(null, antigos, g.buscar, [pedidoDaFila({ assunto: 'compromisso', item_id: '72000000-0000-0000-0000-000000000001' })]);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r.feitas.apagar_evento).toBe(2);
    expect(banco.eventos).toEqual([]);
  });

  it('dado o Google fora do ar, quando a fila é feita, então o pedido espera a próxima tentativa e nada é guardado como feito', async () => {
    // Dado
    const g = google(x => (x.url.includes('/events') ? erroDaAgenda(503, 'backendError') : null));
    const { passos: p } = passos(prazo(), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r.falhas).toBe(1);
    expect(p.falhou).toHaveBeenCalledWith(pedidoDaFila(), 'temporario', '503 backendError', 60);
    expect(p.eventoGravado).not.toHaveBeenCalled();
  });

  it('dado mais cópias que o orçamento, quando a fila é feita, então para no limite e o pedido volta para a próxima (com o que já foi gravado)', async () => {
    // Dado
    const g = google();
    const { passos: p, banco } = passos(prazo({ participantes: [BETO] }), [], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null, 1);
    // Então
    expect(r).toMatchObject({ restam: true, feitas: { gravar_evento: 1 } });
    expect(p.concluir).toHaveBeenCalledWith(pedidoDaFila(), true);
    expect(banco.eventos).toHaveLength(1);
  });
});
