// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As agendas do escritório no Google Agenda (#166, parte 1), em supabase/functions/_compartilhado/: o plano (o que criar,
// compartilhar, renomear e retirar), a execução com o Google simulado e o adaptador da API.
import { describe, expect, it, vi } from 'vitest';
import {
  ACOES_POR_EXECUCAO, agendasDesejadas, DESCRICAO_DA_AGENDA, emailParaCompartilhar, falhaDaFila, FUSO_DAS_AGENDAS, NOME_DA_AGENDA, planejarAgendas, sincronizarAgendas,
  type AgendaGuardada, type EstadoDasAgendas, type MembroDaEquipe, type PassosDasAgendas, type PedidoDaFila
} from '../../../supabase/functions/_compartilhado/agendasGoogle';
import { apiDaAgenda, FalhaDaAgenda, PAPEL_DO_COMPARTILHAMENTO, tipoDoErroDaAgenda } from '../../../supabase/functions/_compartilhado/apiDaAgenda';
import { FalhaDoGoogle } from '../../../supabase/functions/_compartilhado/contatosGoogle';

const CONTA = 'contato@exemplo.com';
const membro = (perfil_id: string, campos: Partial<MembroDaEquipe> = {}): MembroDaEquipe =>
  ({ perfil_id, nome: perfil_id.toUpperCase(), email: `${perfil_id}@exemplo.com`, ativo: true, admin: false, ...campos });
const agenda = (campos: Partial<AgendaGuardada> & Pick<AgendaGuardada, 'id' | 'tipo'>): AgendaGuardada =>
  ({ perfil_id: null, sala_id: null, google_id: `${campos.id}@google`, nome: '', ...campos });
const estado = (campos: Partial<EstadoDasAgendas> = {}): EstadoDasAgendas =>
  ({ conta_email: CONTA, equipe: [], salas: [], agendas: [], compartilhamentos: [], ...campos });
/** Quem lê cada agenda desejada, por nome (para comparar sem depender da ordem dos campos). */
const leitoresPorNome = (e: EstadoDasAgendas) => Object.fromEntries(agendasDesejadas(e).map(d => [d.nome, d.leitores.map(l => l.email)]));
const resumo = (e: EstadoDasAgendas) => planejarAgendas(e).map(a => ({
  retirar: () => `retirar ${'compartilhamento' in a ? a.compartilhamento.email : ''}`,
  criar: () => `criar ${'agenda' in a && 'leitores' in a.agenda ? a.agenda.nome : ''}`,
  renomear: () => `renomear ${'nome' in a ? a.nome : ''}`,
  compartilhar: () => `compartilhar ${a.agenda.nome} com ${'leitor' in a ? a.leitor.email : ''}`
})[a.acao]());

describe('As agendas que devem existir', () => {
  it('dada uma equipe com um administrador, uma pessoa e uma sala, então cada pessoa vê a própria, a Geral e a sala; só o administrador vê a Administrativo', () => {
    // Dado
    const e = estado({ equipe: [membro('ana', { nome: 'Ana Lima', admin: true }), membro('beto', { nome: 'Beto Souza' })], salas: [{ sala_id: 's1', nome: 'Sala 1', ativa: true }] });
    // Quando / Então
    expect(leitoresPorNome(e)).toEqual({
      Geral: ['ana@exemplo.com', 'beto@exemplo.com'],
      Administrativo: ['ana@exemplo.com'],
      'Sala 1': ['ana@exemplo.com', 'beto@exemplo.com'],
      'Agenda – Ana Lima': ['ana@exemplo.com'],
      'Agenda – Beto Souza': ['beto@exemplo.com']
    });
  });

  it('dada uma pessoa desativada e uma sala desativada sem agenda, então nenhuma agenda delas é criada', () => {
    // Dado
    const e = estado({ equipe: [membro('ana'), membro('caio', { ativo: false })], salas: [{ sala_id: 's1', nome: 'Sala velha', ativa: false }] });
    // Quando / Então
    expect(Object.keys(leitoresPorNome(e))).toEqual(['Geral', 'Administrativo', 'Agenda – ANA']);
  });

  it('dada uma pessoa desativada que já tem agenda, então a agenda continua, sem ninguém para ver; e ela sai da Geral', () => {
    // Dado
    const e = estado({ equipe: [membro('caio', { ativo: false })], agendas: [agenda({ id: 'a1', tipo: 'pessoa', perfil_id: 'caio', nome: 'Agenda – CAIO' })] });
    // Quando
    const desejadas = agendasDesejadas(e);
    // Então
    expect(desejadas.find(d => d.perfil_id === 'caio')).toMatchObject({ leitores: [], criar: false });
    expect(desejadas.find(d => d.tipo === 'geral')?.leitores).toEqual([]);
  });

  it.each([
    ['o próprio e-mail da conta do escritório (ela já é a dona)', CONTA, null],
    ['um e-mail em maiúsculas e com espaços', ' Ana@Exemplo.COM ', 'ana@exemplo.com'],
    ['nada', null, null],
    ['um texto sem arroba', 'ana', null]
  ])('quando o e-mail do Google é %s, então o compartilhamento vai para %s', (_caso, email, esperado) => {
    // Quando / Então
    expect(emailParaCompartilhar(email, CONTA)).toBe(esperado);
  });

  it('dadas duas pessoas com o mesmo e-mail do Google, então a Geral é compartilhada uma vez só com ele', () => {
    // Dado
    const e = estado({ equipe: [membro('ana', { email: 'mesmo@exemplo.com' }), membro('beto', { email: 'MESMO@exemplo.com' })] });
    // Quando / Então
    expect(leitoresPorNome(e).Geral).toEqual(['mesmo@exemplo.com']);
  });

  it('quando os nomes são montados, então seguem o combinado com o dono', () => {
    // Quando / Então
    expect([NOME_DA_AGENDA.pessoa(' Ana Lima '), NOME_DA_AGENDA.geral(''), NOME_DA_AGENDA.sala(' Sala 2 '), NOME_DA_AGENDA.administrativo('')])
      .toEqual(['Agenda – Ana Lima', 'Geral', 'Sala 2', 'Administrativo']);
  });
});

describe('O plano', () => {
  it('dado um escritório sem nenhuma agenda, quando o plano é feito, então primeiro cria todas (nada a compartilhar ainda)', () => {
    // Dado
    const e = estado({ equipe: [membro('ana', { admin: true })] });
    // Quando / Então
    expect(resumo(e)).toEqual(['criar Geral', 'criar Administrativo', 'criar Agenda – ANA']);
  });

  it('dadas as agendas criadas, quando o plano é feito, então compartilha cada uma com quem deve ver', () => {
    // Dado
    const e = estado({ equipe: [membro('ana', { admin: true })], agendas: [
      agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }), agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' }),
      agenda({ id: 'p', tipo: 'pessoa', perfil_id: 'ana', nome: 'Agenda – ANA' })] });
    // Quando / Então
    expect(resumo(e)).toEqual(['compartilhar Geral com ana@exemplo.com', 'compartilhar Administrativo com ana@exemplo.com', 'compartilhar Agenda – ANA com ana@exemplo.com']);
  });

  it('dada uma pessoa desativada com compartilhamentos, quando o plano é feito, então retira todos antes de qualquer outra coisa', () => {
    // Dado
    const e = estado({
      equipe: [membro('caio', { ativo: false }), membro('ana')],
      agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }), agenda({ id: 'p', tipo: 'pessoa', perfil_id: 'caio', nome: 'Agenda – CAIO' })],
      compartilhamentos: [{ agenda_id: 'g', email: 'caio@exemplo.com', regra: 'r1' }, { agenda_id: 'p', email: 'caio@exemplo.com', regra: 'r2' }]
    });
    // Quando
    const plano = resumo(e);
    // Então
    expect(plano.slice(0, 2)).toEqual(['retirar caio@exemplo.com', 'retirar caio@exemplo.com']);
    expect(plano).not.toContain('criar Agenda – CAIO');
  });

  it('dado alguém que deixou de ser administrador, quando o plano é feito, então só a Administrativo é retirada dele', () => {
    // Dado
    const e = estado({
      equipe: [membro('ana', { admin: false })],
      agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }), agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' }),
        agenda({ id: 'p', tipo: 'pessoa', perfil_id: 'ana', nome: 'Agenda – ANA' })],
      compartilhamentos: [{ agenda_id: 'g', email: 'ana@exemplo.com', regra: 'r1' }, { agenda_id: 'adm', email: 'ana@exemplo.com', regra: 'r2' },
        { agenda_id: 'p', email: 'ana@exemplo.com', regra: 'r3' }]
    });
    // Quando
    const plano = planejarAgendas(e);
    // Então
    expect(plano).toHaveLength(1);
    expect(plano[0]).toMatchObject({ acao: 'retirar', agenda: { id: 'adm' }, compartilhamento: { regra: 'r2' } });
  });

  it('dado um e-mail do Google trocado, quando o plano é feito, então retira o antigo e compartilha com o novo', () => {
    // Dado
    const e = estado({ equipe: [membro('ana', { email: 'novo@exemplo.com' })], agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }),
      agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' }), agenda({ id: 'p', tipo: 'pessoa', perfil_id: 'ana', nome: 'Agenda – ANA' })],
      compartilhamentos: [{ agenda_id: 'g', email: 'ana@exemplo.com', regra: 'r1' }, { agenda_id: 'p', email: 'ana@exemplo.com', regra: 'r2' }] });
    // Quando / Então
    expect(resumo(e)).toEqual(['retirar ana@exemplo.com', 'retirar ana@exemplo.com', 'compartilhar Geral com novo@exemplo.com', 'compartilhar Agenda – ANA com novo@exemplo.com']);
  });

  it('dado o nome de alguém (ou de uma sala) mudado no SEMPER, ou a agenda renomeada no Google, quando o plano é feito, então o nome volta a ser o do SEMPER', () => {
    // Dado
    const e = estado({ salas: [{ sala_id: 's1', nome: 'Sala Azul', ativa: true }], agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }),
      agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' }), agenda({ id: 's', tipo: 'sala', sala_id: 's1', nome: 'Sala 1' })] });
    // Quando / Então
    expect(resumo(e)).toEqual(['renomear Sala Azul']);
  });

  it('dado tudo em dia, quando o plano é feito, então não há nada a fazer', () => {
    // Dado
    const e = estado({ equipe: [membro('ana', { admin: true })],
      agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }), agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' }), agenda({ id: 'p', tipo: 'pessoa', perfil_id: 'ana', nome: 'Agenda – ANA' })],
      compartilhamentos: ['g', 'adm', 'p'].map(agenda_id => ({ agenda_id, email: 'ana@exemplo.com', regra: 'r-' + agenda_id })) });
    // Quando / Então
    expect(planejarAgendas(e)).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// O Google simulado
// ---------------------------------------------------------------------
interface Pedido { url: string; metodo: string; corpo: string; autorizacao: string | null }
const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const erroDaAgenda = (status: number, motivo: string) => resposta(status, { error: { code: status, errors: [{ reason: motivo }] } });
let criadas = 0;
const PADRAO = (p: Pedido): Response => {
  if (p.url.startsWith('https://oauth2.googleapis.com/token')) return resposta(200, { access_token: 'acesso-' + new URLSearchParams(p.corpo).get('refresh_token') });
  if (p.metodo === 'POST' && p.url.endsWith('/calendars')) return resposta(200, { id: `nova${++criadas}@group.calendar.google.com` });
  if (p.metodo === 'POST' && p.url.includes('/acl')) return resposta(200, { id: 'user:' + (JSON.parse(p.corpo) as { scope: { value: string } }).scope.value });
  if (p.metodo === 'DELETE') return resposta(204);
  return resposta(200, {});
};
function google(responder: (p: Pedido, padrao: typeof PADRAO) => Response | Promise<Response> = (p, padrao) => padrao(p)) {
  const pedidos: Pedido[] = [];
  const buscar = vi.fn(async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const p: Pedido = { url: String(entrada), metodo: init.method ?? 'GET', corpo: String(init.body ?? ''), autorizacao: new Headers(init.headers).get('Authorization') };
    pedidos.push(p);
    return responder(p, PADRAO);
  }) as unknown as typeof fetch;
  return { buscar, pedidos, daAgenda: () => pedidos.filter(p => p.url.startsWith('https://www.googleapis.com/calendar/v3')) };
}

const pedidoDaFila = (campos: Partial<PedidoDaFila> = {}): PedidoDaFila =>
  ({ id: 'f1', escritorio_id: 'e1', assunto: 'agendas', item_id: null, versao: 1, tentativas: 1, conta_email: CONTA, ...campos });

/** O banco simulado: guarda o estado como o banco guardaria, a partir do que os passos registram. */
function passos(inicial: EstadoDasAgendas, fila: PedidoDaFila[], buscar: typeof fetch) {
  const banco = structuredClone(inicial);
  let ids = 0;
  const p = {
    pendentes: vi.fn<PassosDasAgendas['pendentes']>(async () => fila),
    estado: vi.fn<PassosDasAgendas['estado']>(async () => structuredClone(banco)),
    agendaCriada: vi.fn<PassosDasAgendas['agendaCriada']>(async (_p, a, google_id) => {
      const id = `sem${++ids}`;
      banco.agendas.push({ id, tipo: a.tipo, perfil_id: a.perfil_id, sala_id: a.sala_id, google_id, nome: a.nome });
      return id;
    }),
    agendaRenomeada: vi.fn<PassosDasAgendas['agendaRenomeada']>(async (id, nome) => { banco.agendas.find(a => a.id === id)!.nome = nome; }),
    agendaSumiu: vi.fn<PassosDasAgendas['agendaSumiu']>(async id => {
      banco.agendas = banco.agendas.filter(a => a.id !== id); banco.compartilhamentos = banco.compartilhamentos.filter(c => c.agenda_id !== id);
    }),
    compartilhada: vi.fn<PassosDasAgendas['compartilhada']>(async (agenda_id, l, regra) => { banco.compartilhamentos.push({ agenda_id, email: l.email, regra }); }),
    retirada: vi.fn<PassosDasAgendas['retirada']>(async (id, email) => { banco.compartilhamentos = banco.compartilhamentos.filter(c => !(c.agenda_id === id && c.email === email)); }),
    concluir: vi.fn<PassosDasAgendas['concluir']>(async () => {}),
    falhou: vi.fn<PassosDasAgendas['falhou']>(async () => {}),
    tokenDeRenovacao: vi.fn<PassosDasAgendas['tokenDeRenovacao']>(async e => `renovacao-${e}`),
    buscar, clienteId: 'cliente', clienteSegredo: 'segredo'
  };
  return { passos: p, banco };
}

describe('A execução, com o Google simulado', () => {
  it('dado um escritório sem agendas, quando a fila é feita, então cria as agendas (no fuso de Brasília) e já as compartilha na mesma execução', async () => {
    // Dado
    const g = google();
    const { passos: p, banco } = passos(estado({ equipe: [membro('ana', { admin: true }), membro('beto')] }), [pedidoDaFila()], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r).toEqual({ feitas: { criar: 4, renomear: 0, compartilhar: 5, retirar: 0 }, falhas: 0, restam: false });
    expect(banco.agendas.map(a => a.nome).toSorted()).toEqual(['Administrativo', 'Agenda – ANA', 'Agenda – BETO', 'Geral']);
    expect(planejarAgendas(banco)).toEqual([]);
    const criacao = g.daAgenda().find(x => x.metodo === 'POST' && x.url.endsWith('/calendars'))!;
    expect(JSON.parse(criacao.corpo)).toEqual({ summary: 'Geral', description: DESCRICAO_DA_AGENDA, timeZone: FUSO_DAS_AGENDAS });
    expect(criacao.autorizacao).toBe('Bearer acesso-renovacao-e1');
    expect(p.concluir).toHaveBeenCalledWith(pedidoDaFila(), false);
  });

  it('quando compartilha, então é só para ver, por e-mail, com o aviso do Google, e o id da agenda vai codificado no endereço', async () => {
    // Dado
    const g = google();
    const e = estado({ equipe: [membro('ana')], agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral', google_id: 'abc#x@group.calendar.google.com' })] });
    const { passos: p } = passos(e, [pedidoDaFila()], g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    const acl = g.daAgenda().find(x => x.url.includes('/acl'))!;
    expect(acl.url).toBe('https://www.googleapis.com/calendar/v3/calendars/abc%23x%40group.calendar.google.com/acl?sendNotifications=true');
    expect(JSON.parse(acl.corpo)).toEqual({ role: PAPEL_DO_COMPARTILHAMENTO, scope: { type: 'user', value: 'ana@exemplo.com' } });
    expect(PAPEL_DO_COMPARTILHAMENTO).toBe('reader');
  });

  it('dada uma pessoa desativada, quando a fila é feita, então o compartilhamento é retirado pela regra guardada; já retirado no Google, só é esquecido', async () => {
    // Dado
    const g = google((x, padrao) => (x.metodo === 'DELETE' && x.url.endsWith('/r2') ? erroDaAgenda(404, 'notFound') : padrao(x)));
    const e = estado({ equipe: [membro('caio', { ativo: false })], agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral' }), agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' }),
      agenda({ id: 'p', tipo: 'pessoa', perfil_id: 'caio', nome: 'Agenda – CAIO' })],
      compartilhamentos: [{ agenda_id: 'g', email: 'caio@exemplo.com', regra: 'r1' }, { agenda_id: 'p', email: 'caio@exemplo.com', regra: 'r2' }] });
    const { passos: p, banco } = passos(e, [pedidoDaFila()], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r.feitas.retirar).toBe(2);
    expect(g.daAgenda().filter(x => x.metodo === 'DELETE').map(x => x.url.split('/acl/')[1])).toEqual(['r1', 'r2']);
    expect(banco.compartilhamentos).toEqual([]);
    expect(banco.agendas).toHaveLength(3);
  });

  it('dada uma agenda apagada no Google, quando vai ser compartilhada, então o SEMPER a esquece e cria outra na mesma execução', async () => {
    // Dado
    const g = google((x, padrao) => (x.url.includes('/calendars/velha%40google/acl') ? erroDaAgenda(404, 'notFound') : padrao(x)));
    const e = estado({ equipe: [membro('ana')], agendas: [agenda({ id: 'g', tipo: 'geral', nome: 'Geral', google_id: 'velha@google' }),
      agenda({ id: 'adm', tipo: 'administrativo', nome: 'Administrativo' })] });
    const { passos: p, banco } = passos(e, [pedidoDaFila()], g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(p.agendaSumiu).toHaveBeenCalledWith('g');
    expect(banco.agendas.find(a => a.tipo === 'geral')?.google_id).toMatch(/@group\.calendar\.google\.com$/);
    expect(planejarAgendas(banco)).toEqual([]);
  });

  it('dado mais trabalho que o orçamento da execução, quando a fila é feita, então para no limite e o pedido volta para a próxima', async () => {
    // Dado
    const g = google();
    const equipe = Array.from({ length: 30 }, (_, i) => membro('p' + i));
    const { passos: p } = passos(estado({ equipe }), [pedidoDaFila()], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(Object.values(r.feitas).reduce((a, b) => a + b, 0)).toBe(ACOES_POR_EXECUCAO);
    expect(r.restam).toBe(true);
    expect(p.concluir).toHaveBeenCalledWith(pedidoDaFila(), true);
  });

  it('dado o Google fora do ar no meio, quando a fila é feita, então o que já foi feito fica guardado e o pedido espera a próxima tentativa', async () => {
    // Dado
    let vezes = 0;
    const g = google((x, padrao) => (x.metodo === 'POST' && x.url.endsWith('/calendars') && ++vezes === 2 ? erroDaAgenda(503, 'backendError') : padrao(x)));
    const { passos: p, banco } = passos(estado({ equipe: [membro('ana')] }), [pedidoDaFila({ tentativas: 2 })], g.buscar);
    // Quando
    const r = await sincronizarAgendas(p, null);
    // Então
    expect(r).toMatchObject({ falhas: 1, feitas: { criar: 1 } });
    expect(banco.agendas).toHaveLength(1);
    expect(p.falhou).toHaveBeenCalledWith(pedidoDaFila({ tentativas: 2 }), 'temporario', '503 backendError', 5 * 60);
    expect(p.concluir).not.toHaveBeenCalled();
  });

  it('dada a autorização retirada no Google, quando o token é renovado, então a falha é de autorização e nada vai à agenda', async () => {
    // Dado
    const g = google((x, padrao) => (x.url.startsWith('https://oauth2') ? resposta(400, { error: 'invalid_grant' }) : padrao(x)));
    const { passos: p } = passos(estado({ equipe: [membro('ana')] }), [pedidoDaFila()], g.buscar);
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(p.falhou).toHaveBeenCalledWith(pedidoDaFila(), 'autorizacao', expect.stringContaining('renovação'), 60);
    expect(g.daAgenda()).toEqual([]);
  });

  it('dados pedidos de dois escritórios, quando a fila é feita, então cada um usa o token da própria conta', async () => {
    // Dado
    const g = google();
    const { passos: p } = passos(estado(), [pedidoDaFila({ id: 'f1', escritorio_id: 'e1' }), pedidoDaFila({ id: 'f2', escritorio_id: 'e2' })], g.buscar);
    p.estado.mockImplementation(async () => estado());   // cada escritório começa sem agendas
    // Quando
    await sincronizarAgendas(p, null);
    // Então
    expect(new Set(g.daAgenda().map(x => x.autorizacao))).toEqual(new Set(['Bearer acesso-renovacao-e1', 'Bearer acesso-renovacao-e2']));
  });
});

describe('O adaptador da API do Google Agenda', () => {
  it.each([
    [403, 'rateLimitExceeded', 'temporario'], [403, 'userRateLimitExceeded', 'temporario'], [429, null, 'temporario'], [403, 'quotaExceeded', 'temporario'],
    [403, 'insufficientPermissions', 'autorizacao'], [401, null, 'autorizacao'], [403, null, 'autorizacao'],
    [404, 'notFound', 'sumiu'], [410, 'deleted', 'sumiu'], [409, 'duplicate', 'repetido'], [500, null, 'temporario'], [400, 'invalid', 'recusado']
  ])('quando o Google responde %i com o motivo %s, então o erro é "%s"', (status, motivo, tipo) => {
    // Quando / Então
    expect(tipoDoErroDaAgenda(status, motivo)).toBe(tipo);
  });

  it('dado um evento apagado que já não existe no Google, quando o SEMPER o apaga, então dá certo (pronto para a parte 2)', async () => {
    // Dado
    const g = google(() => erroDaAgenda(410, 'deleted'));
    // Quando / Então
    await expect(apiDaAgenda(g.buscar, 'acesso').apagarEvento('agenda@google', 'evento1')).resolves.toBeUndefined();
    expect(g.pedidos[0]).toMatchObject({ metodo: 'DELETE', url: 'https://www.googleapis.com/calendar/v3/calendars/agenda%40google/events/evento1' });
  });

  it('dado um evento com o id já usado, quando o SEMPER o cria, então a falha diz que é repetido (para a parte 2 mudar em vez de criar)', async () => {
    // Dado
    const g = google(() => erroDaAgenda(409, 'duplicate'));
    // Quando / Então
    await expect(apiDaAgenda(g.buscar, 'acesso').criarEvento('a', { id: 'abc123', summary: 'X', start: { date: '2026-12-10' }, end: { date: '2026-12-11' } }))
      .rejects.toMatchObject({ tipo: 'repetido' });
  });

  it('dada a rede caída, quando o SEMPER pede algo ao Google, então a falha é temporária', async () => {
    // Dado
    const buscar = vi.fn(async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    // Quando / Então
    await expect(apiDaAgenda(buscar, 'acesso').criarAgenda({ summary: 'Geral' })).rejects.toMatchObject({ tipo: 'temporario' });
  });

  it.each([
    ['da agenda', new FalhaDaAgenda('sumiu', '404 notFound'), { falha: 'recusado', detalhe: '404 notFound' }],
    ['da renovação do token', new FalhaDoGoogle('autorizacao', 'renovação: 400'), { falha: 'autorizacao', detalhe: 'renovação: 400' }],
    ['do próprio SEMPER (o banco)', new Error('O banco recusou x (500).'), { falha: 'temporario', detalhe: 'erro: O banco recusou x (500).' }]
  ])('quando a falha é %s, então ela vai para a fila assim', (_caso, erro, esperado) => {
    // Quando / Então
    expect(falhaDaFila(erro)).toEqual(esperado);
  });
});
