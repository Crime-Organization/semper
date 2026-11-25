// As agendas do escritório no Google Agenda (#166, parte 1: as agendas e os compartilhamentos), usadas pela função do
// servidor google-agendas. A conta Google do escritório é a dona de todas as agendas; o SEMPER cria "Agenda – <nome>" para
// cada pessoa ativa da equipe, a "Geral", uma por sala ativa e a "Administrativo", e as compartilha só para ver, por e-mail:
// cada pessoa vê a própria, a Geral e as das salas; os administradores, também a Administrativo. Quem sai da equipe (ou da
// administração) perde o compartilhamento; a agenda fica com o escritório, e reativar devolve.
// O que fazer é decidido por funções puras (agendasDesejadas, planejarAgendas); os pedidos ao Google ficam no adaptador
// (apiDaAgenda.ts) e o banco entra pelos "passos". Sem Deno: testado no app (app/src/regras/agendasGoogle.test.ts).
// Só no sentido SEMPER → Google: o que alguém mudar no Google (o nome da agenda, por exemplo) é desfeito na próxima vez.
import { apiDaAgenda, FalhaDaAgenda, TAMANHO_DO_DETALHE, type ApiDaAgenda, type TipoDoErroDaAgenda } from './apiDaAgenda.ts';
import { esperaDaTentativa, FalhaDoGoogle, tokenDeAcesso, type PassosDaSincronizacao, type TipoDaFalha } from './contatosGoogle.ts';

/** Os tipos de agenda do escritório (o mesmo check de agendas_google.tipo no banco). */
export type TipoDeAgenda = 'pessoa' | 'geral' | 'sala' | 'administrativo';
/** O fuso das agendas: o relógio de Brasília, o mesmo FUSO_DO_ESCRITORIO de app/src/regras/fuso.ts. */
export const FUSO_DAS_AGENDAS = 'America/Sao_Paulo';
/** A descrição de toda agenda criada pelo SEMPER (quem a vê no Google sabe onde mudar as coisas). */
export const DESCRICAO_DA_AGENDA = 'Agenda criada e mantida pelo SEMPER, só para ver. Mude tudo no SEMPER: o que for mudado aqui é desfeito na próxima sincronização.';

/** O nome de cada tipo de agenda no Google (decisão do dono: "Agenda – Fulano", "Geral", o nome da sala, "Administrativo"). */
export const NOME_DA_AGENDA: Record<TipoDeAgenda, (nome: string) => string> = {
  pessoa: nome => `Agenda – ${nome.trim()}`,
  geral: () => 'Geral',
  sala: nome => nome.trim(),
  administrativo: () => 'Administrativo'
};

// ---------------------------------------------------------------------
// O estado, como o banco entrega (public.agendas_google_estado)
// ---------------------------------------------------------------------

/** Alguém da equipe: o e-mail é o "e-mail do Google" (o de entrada, se a pessoa não informou outro); null se não há. */
export interface MembroDaEquipe { perfil_id: string; nome: string; email: string | null; ativo: boolean; admin: boolean }
export interface SalaDoEscritorio { sala_id: string; nome: string; ativa: boolean }
/** Uma agenda já criada no Google (id: o do SEMPER; google_id: o do Google). */
export interface AgendaGuardada { id: string; tipo: TipoDeAgenda; perfil_id: string | null; sala_id: string | null; google_id: string; nome: string }
/** Um compartilhamento feito: a regra é o id que o Google deu, guardado para retirar depois. */
export interface CompartilhamentoFeito { agenda_id: string; email: string; regra: string }
export interface EstadoDasAgendas {
  conta_email: string; equipe: MembroDaEquipe[]; salas: SalaDoEscritorio[]; agendas: AgendaGuardada[]; compartilhamentos: CompartilhamentoFeito[];
}

// ---------------------------------------------------------------------
// O que deve existir
// ---------------------------------------------------------------------

export interface Leitor { email: string; perfil_id: string | null }
/** Uma agenda como deve estar: o nome, com quem fica compartilhada e se deve ser criada (agenda de quem saiu não se cria). */
export interface AgendaDesejada { tipo: TipoDeAgenda; perfil_id: string | null; sala_id: string | null; nome: string; leitores: Leitor[]; criar: boolean }

/** A mesma agenda no SEMPER e no desejo: o tipo e de quem é (a pessoa ou a sala). */
export const chaveDaAgenda = (a: Pick<AgendaGuardada, 'tipo' | 'perfil_id' | 'sala_id'>) => `${a.tipo}:${a.perfil_id ?? a.sala_id ?? ''}`;

const FORMATO_DO_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** O e-mail para compartilhar: minúsculo e válido, e nunca a própria conta do escritório (ela já é a dona). */
export function emailParaCompartilhar(email: string | null | undefined, conta: string) {
  const e = String(email ?? '').trim().toLowerCase();
  return FORMATO_DO_EMAIL.test(e) && e !== conta.trim().toLowerCase() ? e : null;
}
const unicos = (leitores: Leitor[]) => leitores.filter((l, i) => leitores.findIndex(o => o.email === l.email) === i);

/**
 * As agendas como devem estar: a Geral (todos), a Administrativo (os administradores), uma por sala ativa (todos) e uma por
 * pessoa ativa (só ela). Sala desativada e pessoa desativada que já têm agenda continuam nela, mas sem compartilhamento.
 */
export function agendasDesejadas(e: EstadoDasAgendas): AgendaDesejada[] {
  const leitor = (m: MembroDaEquipe): Leitor[] => {
    const email = emailParaCompartilhar(m.email, e.conta_email);
    return email ? [{ email, perfil_id: m.perfil_id }] : [];
  };
  const ativos = e.equipe.filter(m => m.ativo);
  const todos = unicos(ativos.flatMap(leitor));
  const existe = new Set(e.agendas.map(chaveDaAgenda));
  const geral: AgendaDesejada = { tipo: 'geral', perfil_id: null, sala_id: null, nome: NOME_DA_AGENDA.geral(''), leitores: todos, criar: true };
  const administrativo: AgendaDesejada = {
    tipo: 'administrativo', perfil_id: null, sala_id: null, nome: NOME_DA_AGENDA.administrativo(''), leitores: unicos(ativos.filter(m => m.admin).flatMap(leitor)), criar: true
  };
  const salas = e.salas.filter(s => s.ativa || existe.has(chaveDaAgenda({ tipo: 'sala', perfil_id: null, sala_id: s.sala_id })))
    .map((s): AgendaDesejada => ({ tipo: 'sala', perfil_id: null, sala_id: s.sala_id, nome: NOME_DA_AGENDA.sala(s.nome), leitores: s.ativa ? todos : [], criar: s.ativa }));
  const pessoas = e.equipe.filter(m => m.ativo || existe.has(chaveDaAgenda({ tipo: 'pessoa', perfil_id: m.perfil_id, sala_id: null })))
    .map((m): AgendaDesejada => ({ tipo: 'pessoa', perfil_id: m.perfil_id, sala_id: null, nome: NOME_DA_AGENDA.pessoa(m.nome), leitores: m.ativo ? leitor(m) : [], criar: m.ativo }));
  return [geral, administrativo, ...salas, ...pessoas];
}

// ---------------------------------------------------------------------
// O que fazer
// ---------------------------------------------------------------------

export type AcaoNasAgendas =
  | { acao: 'retirar'; agenda: AgendaGuardada; compartilhamento: CompartilhamentoFeito }
  | { acao: 'criar'; agenda: AgendaDesejada }
  | { acao: 'renomear'; agenda: AgendaGuardada; nome: string }
  | { acao: 'compartilhar'; agenda: AgendaGuardada; leitor: Leitor };
export type TipoDaAcao = AcaoNasAgendas['acao'];

/**
 * O que falta fazer no Google para as agendas ficarem como devem, na ordem: primeiro retirar (quem saiu perde o acesso
 * antes de tudo), depois criar, renomear e compartilhar. Vazio: está tudo em dia.
 */
export function planejarAgendas(e: EstadoDasAgendas): AcaoNasAgendas[] {
  const desejadas = agendasDesejadas(e);
  const porChave = new Map(e.agendas.map(a => [chaveDaAgenda(a), a]));
  const leitores = new Map(desejadas.map(d => [chaveDaAgenda(d), new Set(d.leitores.map(l => l.email))]));
  const retirar = e.compartilhamentos.flatMap((c): AcaoNasAgendas[] => {
    const agenda = e.agendas.find(a => a.id === c.agenda_id);
    return agenda && !leitores.get(chaveDaAgenda(agenda))?.has(c.email) ? [{ acao: 'retirar', agenda, compartilhamento: c }] : [];
  });
  const criar = desejadas.filter(d => d.criar && !porChave.has(chaveDaAgenda(d))).map((agenda): AcaoNasAgendas => ({ acao: 'criar', agenda }));
  const existentes = desejadas.flatMap(d => {
    const agenda = porChave.get(chaveDaAgenda(d));
    return agenda ? [{ d, agenda }] : [];
  });
  const renomear = existentes.filter(({ d, agenda }) => agenda.nome !== d.nome).map(({ d, agenda }): AcaoNasAgendas => ({ acao: 'renomear', agenda, nome: d.nome }));
  const compartilhar = existentes.flatMap(({ d, agenda }) => d.leitores
    .filter(l => !e.compartilhamentos.some(c => c.agenda_id === agenda.id && c.email === l.email))
    .map((leitor): AcaoNasAgendas => ({ acao: 'compartilhar', agenda, leitor })));
  return [...retirar, ...criar, ...renomear, ...compartilhar];
}

// ---------------------------------------------------------------------
// A fila e a execução
// ---------------------------------------------------------------------

/**
 * O que a fila pede (o mesmo check de agendas_google_fila.assunto no banco). 'agendas': arrumar as agendas e os
 * compartilhamentos do escritório inteiro. A parte 2 da #166 soma os eventos (compromisso, tarefa…), um por item.
 */
export type AssuntoDaFila = 'agendas';
/** Um pedido da fila, como o banco entrega (public.agendas_google_pendentes), já reservado para esta execução. */
export interface PedidoDaFila { id: string; escritorio_id: string; assunto: AssuntoDaFila; item_id: string | null; versao: number; tentativas: number; conta_email: string }

export interface PassosDasAgendas extends Pick<PassosDaSincronizacao, 'tokenDeRenovacao' | 'buscar' | 'clienteId' | 'clienteSegredo'> {
  /** Os pedidos a fazer agora (de um escritório, ou de todos com null), já reservados. */
  pendentes(escritorio: string | null, limite: number): Promise<PedidoDaFila[]>;
  /** A equipe, as salas, as agendas já criadas na conta ligada e os compartilhamentos feitos. */
  estado(escritorio: string): Promise<EstadoDasAgendas>;
  /** Guarda a agenda criada no Google; devolve o id dela no SEMPER. */
  agendaCriada(p: PedidoDaFila, agenda: AgendaDesejada, googleId: string): Promise<string>;
  agendaRenomeada(agendaId: string, nome: string): Promise<void>;
  /** A agenda foi apagada no Google: esquece-a (e os compartilhamentos dela), para ser criada de novo. */
  agendaSumiu(agendaId: string): Promise<void>;
  compartilhada(agendaId: string, leitor: Leitor, regra: string): Promise<void>;
  retirada(agendaId: string, email: string): Promise<void>;
  /** Terminou (restam: faltou tempo nesta execução e o pedido volta para a próxima, sem contar como falha). */
  concluir(p: PedidoDaFila, restam: boolean): Promise<void>;
  falhou(p: PedidoDaFila, falha: TipoDaFalha, detalhe: string, esperaEmSegundos: number): Promise<void>;
}

/** Quantos pedidos uma execução pega, e quantas ações no Google ela faz no máximo (umas 40 levam bem menos de um minuto). */
export const PEDIDOS_POR_EXECUCAO = 10;
export const ACOES_POR_EXECUCAO = 40;

export type Contagem = Record<TipoDaAcao, number>;
export const CONTAGEM_ZERADA: Contagem = { retirar: 0, criar: 0, renomear: 0, compartilhar: 0 };
export interface ResultadoDasAgendas { feitas: Contagem; falhas: number; restam: boolean }

interface Execucao { passos: PassosDasAgendas; api: ApiDaAgenda; pedido: PedidoDaFila; feitas: Contagem; orcamento: { restante: number } }
type Fazer = { [K in TipoDaAcao]: (x: Execucao, e: EstadoDasAgendas, a: Extract<AcaoNasAgendas, { acao: K }>) => Promise<EstadoDasAgendas> };

const sumiu = (e: unknown) => e instanceof FalhaDaAgenda && e.tipo === 'sumiu';
/** A agenda não existe mais no Google: o SEMPER a esquece, e o próximo plano a cria de novo (se ainda deve existir). */
async function semAgenda(x: Execucao, e: EstadoDasAgendas, agenda: AgendaGuardada): Promise<EstadoDasAgendas> {
  await x.passos.agendaSumiu(agenda.id);
  return { ...e, agendas: e.agendas.filter(a => a.id !== agenda.id), compartilhamentos: e.compartilhamentos.filter(c => c.agenda_id !== agenda.id) };
}

/** Cada ação: o pedido ao Google, o registro no banco e o estado depois dela. */
const FAZER: Fazer = {
  async retirar(x, e, { agenda, compartilhamento: c }) {
    // Já retirado no Google (ou a agenda apagada): o acesso já não existe, e basta esquecer.
    try { await x.api.retirar(agenda.google_id, c.regra); } catch (err) { if (!sumiu(err)) throw err; }
    await x.passos.retirada(c.agenda_id, c.email);
    return { ...e, compartilhamentos: e.compartilhamentos.filter(o => !(o.agenda_id === c.agenda_id && o.email === c.email)) };
  },
  async criar(x, e, { agenda: d }) {
    const googleId = await x.api.criarAgenda({ summary: d.nome, description: DESCRICAO_DA_AGENDA, timeZone: FUSO_DAS_AGENDAS });
    const id = await x.passos.agendaCriada(x.pedido, d, googleId);
    return { ...e, agendas: [...e.agendas, { id, tipo: d.tipo, perfil_id: d.perfil_id, sala_id: d.sala_id, google_id: googleId, nome: d.nome }] };
  },
  async renomear(x, e, { agenda, nome }) {
    try { await x.api.mudarAgenda(agenda.google_id, { summary: nome }); } catch (err) { if (sumiu(err)) return semAgenda(x, e, agenda); throw err; }
    await x.passos.agendaRenomeada(agenda.id, nome);
    return { ...e, agendas: e.agendas.map(a => (a.id === agenda.id ? { ...a, nome } : a)) };
  },
  async compartilhar(x, e, { agenda, leitor }) {
    let regra: string;
    try { regra = await x.api.compartilhar(agenda.google_id, leitor.email); } catch (err) { if (sumiu(err)) return semAgenda(x, e, agenda); throw err; }
    await x.passos.compartilhada(agenda.id, leitor, regra);
    return { ...e, compartilhamentos: [...e.compartilhamentos, { agenda_id: agenda.id, email: leitor.email, regra }] };
  }
};

/**
 * Arruma as agendas do escritório, uma ação de cada vez: depois de cada uma, o plano é refeito com o estado novo (o que
 * acabou de ser criado já é compartilhado na mesma execução). Devolve se ainda restou o que fazer quando o orçamento acabou.
 */
async function arrumarAgendas(x: Execucao) {
  let estado = await x.passos.estado(x.pedido.escritorio_id);
  for (;;) {
    const [acao] = planejarAgendas(estado);
    if (!acao) return false;
    if (x.orcamento.restante <= 0) return true;
    x.orcamento.restante--;
    estado = await (FAZER[acao.acao] as (x: Execucao, e: EstadoDasAgendas, a: AcaoNasAgendas) => Promise<EstadoDasAgendas>)(x, estado, acao);
    x.feitas[acao.acao]++;
  }
}

/** O que fazer com cada assunto da fila (a parte 2 da #166 soma os eventos aqui). Devolve se restou o que fazer. */
const PROCESSAR: Record<AssuntoDaFila, (x: Execucao) => Promise<boolean>> = { agendas: arrumarAgendas };

/** Como cada erro do Google fica na fila ('sumiu' e 'repetido' que sobram das recuperações contam como recusa). */
const FALHA_DA_FILA: Record<TipoDoErroDaAgenda, TipoDaFalha> = {
  autorizacao: 'autorizacao', temporario: 'temporario', recusado: 'recusado', sumiu: 'recusado', repetido: 'recusado'
};
/** A falha para a fila: do Google Agenda, da renovação do token (contatosGoogle.ts) ou do próprio SEMPER (o banco: temporária). */
export function falhaDaFila(e: unknown): { falha: TipoDaFalha; detalhe: string } {
  if (e instanceof FalhaDaAgenda) return { falha: FALHA_DA_FILA[e.tipo], detalhe: e.detalhe };
  if (e instanceof FalhaDoGoogle) return { falha: e.tipo === 'autorizacao' ? 'autorizacao' : 'temporario', detalhe: e.detalhe };
  return { falha: 'temporario', detalhe: `erro: ${(e as Error)?.message ?? e}`.slice(0, TAMANHO_DO_DETALHE) };
}

/**
 * Uma execução da função do servidor: pega os pedidos da fila (de um escritório, ou de todos), renova o acesso de cada
 * escritório uma vez e faz cada pedido. Uma falha não para os outros pedidos: ela fica na fila com a espera da tentativa
 * (o que já foi feito antes dela fica guardado). O orçamento de ações vale para a execução inteira.
 */
export async function sincronizarAgendas(passos: PassosDasAgendas, escritorio: string | null, acoes = ACOES_POR_EXECUCAO): Promise<ResultadoDasAgendas> {
  const pedidos = await passos.pendentes(escritorio, PEDIDOS_POR_EXECUCAO);
  const acessos = new Map<string, Promise<string>>();
  const resultado: ResultadoDasAgendas = { feitas: { ...CONTAGEM_ZERADA }, falhas: 0, restam: false };
  const orcamento = { restante: acoes };
  for (const pedido of pedidos) {
    try {
      if (!acessos.has(pedido.escritorio_id)) acessos.set(pedido.escritorio_id, tokenDeAcesso(passos, pedido.escritorio_id));
      const api = apiDaAgenda(passos.buscar, await acessos.get(pedido.escritorio_id)!);
      const restam = await PROCESSAR[pedido.assunto]({ passos, api, pedido, feitas: resultado.feitas, orcamento });
      await passos.concluir(pedido, restam);
      resultado.restam ||= restam;
    } catch (e) {
      const { falha, detalhe } = falhaDaFila(e);
      await passos.falhou(pedido, falha, detalhe, esperaDaTentativa(pedido.tentativas));
      resultado.falhas++;
    }
  }
  return resultado;
}
