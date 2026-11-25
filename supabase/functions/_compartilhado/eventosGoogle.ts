// Os eventos nas agendas do escritório no Google Agenda (#166, parte 2), usados pela função do servidor google-agendas.
// O que vai para qual agenda, e como, é decidido aqui, por funções puras: o banco entrega o item como está
// (public.agendas_google_item), estas funções montam as cópias que devem existir (uma por agenda) e o plano compara com as
// cópias já gravadas no Google (public.agenda_google_eventos). Sem Deno: testado no app (app/src/regras/eventosGoogle.test.ts).
// Combinado com o dono (25/11/2026):
//   - compromisso: uma cópia na agenda do responsável e uma na de cada participante; também na Geral, se "Agenda geral"
//     está marcada, e na da sala, se tem sala. Arquivado, cancelado (coluna "Cancelado") ou excluído: sai de todas;
//   - tarefa e demanda com prazo: na data de entrega (com a hora, se houver; sem hora, o dia inteiro), na agenda do
//     responsável e de cada participante (colaborador, na demanda). O início não estica o evento. Concluída ou arquivada: sai;
//   - dia sem expediente e suspensão do "Feriados e prazos" do escritório: na Geral, o dia inteiro;
//   - parcela a receber: na agenda do advogado responsável pelo contrato, no vencimento. Recebida ou excluída: sai.
// Quem sai do item (um participante tirado, um responsável trocado) perde a cópia na agenda dele.
import type { AgendaGuardada } from './agendasGoogle.ts';
import type { EventoDoGoogle } from './apiDaAgenda.ts';
import { SITE } from './emailsDePrazo.ts';

/** Os itens que viram eventos (o mesmo check de agendas_google_fila.assunto no banco, além de 'agendas'). */
export type AssuntoDoEvento = 'compromisso' | 'tarefa' | 'demanda' | 'dia' | 'parcela';
export const ASSUNTOS_DOS_EVENTOS: AssuntoDoEvento[] = ['compromisso', 'tarefa', 'demanda', 'dia', 'parcela'];

/** O fuso dos eventos com hora: o relógio de Brasília (o mesmo FUSO_DAS_AGENDAS de agendasGoogle.ts). */
export const FUSO_DOS_EVENTOS = 'America/Sao_Paulo';
/**
 * Quanto dura o compromisso que tem hora de início e não tem hora de fim, em minutos: a mesma hora de privado.minutos_na_sala
 * (migração salas_do_escritorio), que conta assim a ocupação da sala.
 */
export const DURACAO_SEM_FIM = 60;
/** Quanto dura, na agenda, o prazo de tarefa ou demanda que tem hora, em minutos (o Google pede um fim depois do início). */
export const DURACAO_DO_PRAZO = 30;

// ---------------------------------------------------------------------
// Os itens, como o banco entrega (public.agendas_google_item). Datas "aaaa-mm-dd", horas "hh:mm".
// ---------------------------------------------------------------------

export interface CompromissoNaAgenda {
  id: string; titulo: string; data: string; hora: string | null; hora_fim: string | null; local: string | null;
  geral: boolean; responsavel_id: string; participantes: string[]; sala_id: string | null; sala_nome: string | null;
  clientes: string | null; processo_numero: string | null; arquivado: boolean; cancelado: boolean;
}
/** Tarefa ou demanda: os participantes da demanda são os colaboradores. */
export interface PrazoNaAgenda {
  id: string; titulo: string; prazo: string | null; prazo_hora: string | null; responsavel_id: string; participantes: string[];
  clientes: string | null; processo_numero: string | null; arquivado: boolean; concluido: boolean;
}
export interface DiaNaAgenda { id: string; data: string; motivo: string; tipo: TipoDoDia; orgao: string | null }
export type TipoDoDia = 'feriado' | 'suspensao' | 'suspensao_com_expediente';
/** O valor, em centavos; total: quantas parcelas o contrato tem (null se não diz). */
export interface ParcelaNaAgenda {
  id: string; contrato_id: string; contrato_codigo: string; numero: number; total: number | null; vencimento: string; valor: number;
  clientes: string | null; responsavel_id: string; recebida: boolean; excluida: boolean;
}
export interface ItensNaAgenda { compromisso: CompromissoNaAgenda; tarefa: PrazoNaAgenda; demanda: PrazoNaAgenda; dia: DiaNaAgenda; parcela: ParcelaNaAgenda }

/** A agenda, só com o que o plano dos eventos usa (criada_em: para um 404 numa agenda nova não contar como apagada). */
export type AgendaDoEvento = Pick<AgendaGuardada, 'id' | 'tipo' | 'perfil_id' | 'sala_id' | 'google_id' | 'criada_em'>;
/** Uma cópia já gravada no Google: em que agenda, com que id e com que conteúdo (a assinatura). */
export interface EventoGuardado { agenda_id: string; agenda_google_id: string; evento_id: string; assinatura: string }
/** Tudo o que o banco entrega para um pedido da fila: o item (null se foi excluído), as agendas da conta e as cópias gravadas. */
export interface ItemDaFila<A extends AssuntoDoEvento = AssuntoDoEvento> { item: ItensNaAgenda[A] | null; agendas: AgendaDoEvento[]; eventos: EventoGuardado[] }

/** Uma cópia que deve existir: a agenda, o evento como deve estar e a assinatura dele (para saber se mudou). */
export interface CopiaDesejada { agenda: AgendaDoEvento; evento: EventoDoGoogle & { id: string }; assinatura: string }

// ---------------------------------------------------------------------
// O id e a marca de cada evento
// ---------------------------------------------------------------------

/**
 * A letra de cada assunto no id do evento. O Google aceita no id só letras de "a" a "v" e números (base32hex), de 5 a 1024
 * caracteres; o resto é o uuid do item sem os hífens (só 0-9 e a-f). O id é o mesmo em todas as agendas (é único por agenda).
 */
const LETRA_DO_ASSUNTO: Record<AssuntoDoEvento, string> = { compromisso: 'c', tarefa: 't', demanda: 'd', dia: 'f', parcela: 'p' };
/** O id do evento, escolhido pelo SEMPER: o mesmo a cada tentativa, para nunca duplicar. */
export const idDoEvento = (assunto: AssuntoDoEvento, itemId: string) => LETRA_DO_ASSUNTO[assunto] + itemId.toLowerCase().replace(/[^0-9a-f]/g, '');

/** As chaves da marca do SEMPER no evento (extendedProperties.private; o Google descarta sem aviso chave com mais de 44 letras). */
export const MARCA_DO_ITEM = 'semper_item';
export const MARCA_DO_ESCRITORIO = 'semper_escritorio';

// ---------------------------------------------------------------------
// Datas e horas (puras, sem fuso: o Google lê a hora local com o timeZone)
// ---------------------------------------------------------------------

const MS_POR_MINUTO = 60_000;
/** "aaaa-mm-dd" + n dias. */
export function somarDiasNaData(data: string, n: number) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
/** "aaaa-mm-dd" e "hh:mm" + n minutos, em "aaaa-mm-ddThh:mm:00" (pode passar para o dia seguinte). */
export function somarMinutos(data: string, hora: string, n: number) {
  const [a, m, d] = data.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  return new Date(Date.UTC(a, m - 1, d, h, mi) + n * MS_POR_MINUTO).toISOString().slice(0, 16) + ':00';
}
const minutosDa = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * 60 + m; };

type Quando = Pick<EventoDoGoogle, 'start' | 'end'>;
/** O dia inteiro: o fim, no Google, é o dia seguinte (exclusivo). */
const diaInteiro = (data: string): Quando => ({ start: { date: data }, end: { date: somarDiasNaData(data, 1) } });
/** Com hora: início e fim no relógio de Brasília. */
const comHora = (data: string, hora: string, minutos: number): Quando => ({
  start: { dateTime: somarMinutos(data, hora, 0), timeZone: FUSO_DOS_EVENTOS },
  end: { dateTime: somarMinutos(data, hora, Math.max(minutos, 1)), timeZone: FUSO_DOS_EVENTOS }
});
/** Quanto o compromisso dura: até a hora de fim, ou DURACAO_SEM_FIM sem ela. */
const duracaoDoCompromisso = (c: Pick<CompromissoNaAgenda, 'hora' | 'hora_fim'>) =>
  c.hora && c.hora_fim && minutosDa(c.hora_fim) > minutosDa(c.hora) ? minutosDa(c.hora_fim) - minutosDa(c.hora) : DURACAO_SEM_FIM;

// ---------------------------------------------------------------------
// O texto do evento
// ---------------------------------------------------------------------

/** O endereço do item no SEMPER (o mesmo SITE dos links dos e-mails de prazo). */
const LINK_DO_ITEM: { [A in AssuntoDoEvento]: (i: ItensNaAgenda[A]) => string } = {
  compromisso: i => `${SITE}/agenda/?id=${encodeURIComponent(i.id)}`,
  tarefa: i => `${SITE}/tarefas/?id=${encodeURIComponent(i.id)}`,
  demanda: i => `${SITE}/demandas/?id=${encodeURIComponent(i.id)}`,
  dia: () => `${SITE}/calendario/`,
  parcela: i => `${SITE}/contratos/?id=${encodeURIComponent(i.contrato_id)}`
};
/** O link no fim da descrição. */
export const LINHA_DO_LINK = (link: string) => `Abrir no SEMPER: ${link}`;
/** A última linha de toda descrição: onde mudar o evento. */
export const AVISO_DO_EVENTO = 'Criado pelo SEMPER, só para ver: mude no SEMPER (o que for mudado aqui é desfeito).';

const dataEmTexto = (iso: string) => iso.split('-').reverse().join('/');
const dinheiro = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const limpo = (t: string | null | undefined) => (t ?? '').trim();
/** As linhas que existem, uma por linha, e uma em branco antes do link. */
const descricao = (linhas: (string | false | null | undefined)[], link: string) =>
  [...linhas.filter((l): l is string => !!l), '', LINHA_DO_LINK(link), AVISO_DO_EVENTO].join('\n');
const clientesEProcesso = (i: { clientes: string | null; processo_numero: string | null }) =>
  [limpo(i.clientes) && `Clientes: ${limpo(i.clientes)}`, limpo(i.processo_numero) && `Processo: ${limpo(i.processo_numero)}`];

/** O nome de cada tipo de dia sem expediente (os mesmos de TIPOS_SEM_EXPEDIENTE, em app/src/regras/prazos.ts). */
export const NOME_DO_TIPO_DO_DIA: Record<TipoDoDia, string> = {
  feriado: 'Feriado', suspensao: 'Suspensão sem expediente', suspensao_com_expediente: 'Suspensão de prazos com expediente'
};
/** O nome da parcela, como no Início ("Parcela 2/10"), com o contrato. */
export const nomeDaParcelaNaAgenda = (p: Pick<ParcelaNaAgenda, 'numero' | 'total' | 'contrato_codigo'>) =>
  `Parcela ${p.numero}${p.total ? '/' + p.total : ''} · ${p.contrato_codigo}`;

/** O evento de cada assunto, sem o id e a marca: título, quando, local e descrição. */
const EVENTO_DO_ITEM: { [A in AssuntoDoEvento]: (i: ItensNaAgenda[A]) => Omit<EventoDoGoogle, 'id' | 'extendedProperties' | 'status'> } = {
  compromisso: c => {
    const local = limpo(c.local) || limpo(c.sala_nome);
    return {
      summary: limpo(c.titulo),
      ...(c.hora ? comHora(c.data, c.hora, duracaoDoCompromisso(c)) : diaInteiro(c.data)),
      ...(local ? { location: local } : {}),
      description: descricao([limpo(c.sala_nome) && `Sala: ${limpo(c.sala_nome)}`, limpo(c.local) && `Local ou link: ${limpo(c.local)}`, ...clientesEProcesso(c)], LINK_DO_ITEM.compromisso(c))
    };
  },
  tarefa: t => prazoNaAgenda(t, 'Prazo da tarefa', LINK_DO_ITEM.tarefa(t)),
  demanda: d => prazoNaAgenda(d, 'Prazo da demanda', LINK_DO_ITEM.demanda(d)),
  dia: d => ({
    summary: limpo(d.motivo) || NOME_DO_TIPO_DO_DIA[d.tipo],
    ...diaInteiro(d.data),
    description: descricao([NOME_DO_TIPO_DO_DIA[d.tipo], limpo(d.orgao) ? `Só no órgão: ${limpo(d.orgao)}` : 'Em todos os órgãos'], LINK_DO_ITEM.dia(d))
  }),
  parcela: p => ({
    summary: `${nomeDaParcelaNaAgenda(p)} · ${dinheiro(p.valor)}`,
    ...diaInteiro(p.vencimento),
    description: descricao([`Parcela a receber, vence em ${dataEmTexto(p.vencimento)}`, `Valor: ${dinheiro(p.valor)}`, `Contrato: ${p.contrato_codigo}`,
      limpo(p.clientes) && `Clientes: ${limpo(p.clientes)}`], LINK_DO_ITEM.parcela(p))
  })
};
function prazoNaAgenda(i: PrazoNaAgenda, oQue: string, link: string) {
  const prazo = i.prazo!;
  return {
    summary: limpo(i.titulo),
    ...(i.prazo_hora ? comHora(prazo, i.prazo_hora, DURACAO_DO_PRAZO) : diaInteiro(prazo)),
    description: descricao([`${oQue}: ${dataEmTexto(prazo)}${i.prazo_hora ? ` às ${i.prazo_hora}` : ''}`, ...clientesEProcesso(i)], link)
  };
}

// ---------------------------------------------------------------------
// Em quais agendas
// ---------------------------------------------------------------------

/** Onde a cópia vai: a agenda de uma pessoa da equipe, a Geral ou a de uma sala. */
type Destino = { tipo: 'pessoa'; perfil_id: string } | { tipo: 'geral' } | { tipo: 'sala'; sala_id: string };
const pessoas = (ids: (string | null | undefined)[]): Destino[] => ids.filter((id): id is string => !!id).map(perfil_id => ({ tipo: 'pessoa', perfil_id }));

/**
 * As agendas de cada assunto, ou nenhuma quando o item não vai (ou não vai mais) para o Google: o compromisso arquivado ou
 * cancelado; a tarefa ou demanda sem prazo, concluída ou arquivada; a parcela recebida ou excluída.
 */
const DESTINOS: { [A in AssuntoDoEvento]: (i: ItensNaAgenda[A]) => Destino[] } = {
  compromisso: c => (c.arquivado || c.cancelado ? [] : [
    ...pessoas([c.responsavel_id, ...c.participantes]),
    ...(c.geral ? [{ tipo: 'geral' } as const] : []),
    ...(c.sala_id ? [{ tipo: 'sala', sala_id: c.sala_id } as const] : [])
  ]),
  tarefa: t => (!t.prazo || t.arquivado || t.concluido ? [] : pessoas([t.responsavel_id, ...t.participantes])),
  demanda: d => (!d.prazo || d.arquivado || d.concluido ? [] : pessoas([d.responsavel_id, ...d.participantes])),
  dia: () => [{ tipo: 'geral' }],
  parcela: p => (p.recebida || p.excluida ? [] : pessoas([p.responsavel_id]))
};
const ACHAR_AGENDA: { [T in Destino['tipo']]: (d: Extract<Destino, { tipo: T }>, a: AgendaDoEvento) => boolean } = {
  pessoa: (d, a) => a.tipo === 'pessoa' && a.perfil_id === d.perfil_id,
  geral: (_d, a) => a.tipo === 'geral',
  sala: (d, a) => a.tipo === 'sala' && a.sala_id === d.sala_id
};
const agendaDo = (d: Destino, agendas: AgendaDoEvento[]) =>
  agendas.find(a => (ACHAR_AGENDA[d.tipo] as (d: Destino, a: AgendaDoEvento) => boolean)(d, a));

// ---------------------------------------------------------------------
// As cópias que devem existir e o plano
// ---------------------------------------------------------------------

/** Uma assinatura curta do conteúdo do evento (53 bits, em hexadecimal): mudou o evento, muda a assinatura. */
export function assinaturaDoEvento(evento: EventoDoGoogle) {
  const texto = JSON.stringify(evento);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * As cópias que o item deve ter: uma por agenda (sem repetir a agenda de quem é responsável e participante ao mesmo tempo).
 * Só nas agendas que já existem: a que ainda vai ser criada recebe o item quando nascer (o banco o põe na fila de novo).
 */
export function copiasDoItem<A extends AssuntoDoEvento>(assunto: A, item: ItensNaAgenda[A] | null, agendas: AgendaDoEvento[], escritorioId: string): CopiaDesejada[] {
  if (!item) return [];
  const destinos = (DESTINOS[assunto] as (i: ItensNaAgenda[A]) => Destino[])(item);
  const alvos = destinos.map(d => agendaDo(d, agendas)).filter((a, i, todas): a is AgendaDoEvento => !!a && todas.findIndex(o => o?.id === a.id) === i);
  if (!alvos.length) return [];
  const evento: EventoDoGoogle & { id: string } = {
    id: idDoEvento(assunto, item.id),
    ...(EVENTO_DO_ITEM[assunto] as (i: ItensNaAgenda[A]) => EventoDoGoogle)(item),
    status: 'confirmed',
    extendedProperties: { private: { [MARCA_DO_ITEM]: `${assunto}:${item.id}`, [MARCA_DO_ESCRITORIO]: escritorioId } }
  };
  const assinatura = assinaturaDoEvento(evento);
  return alvos.map(agenda => ({ agenda, evento, assinatura }));
}

export type AcaoNoEvento =
  | { acao: 'apagar'; guardado: EventoGuardado }
  | { acao: 'gravar'; copia: CopiaDesejada; existe: boolean };

/**
 * O que fazer no Google para as cópias do item ficarem como devem: primeiro apagar as que não devem mais existir (quem saiu
 * do item perde a cópia antes de tudo), depois gravar as novas e as que mudaram. A cópia igual à gravada fica como está.
 */
export function planejarEventos(desejadas: CopiaDesejada[], guardados: EventoGuardado[]): AcaoNoEvento[] {
  const desejada = (g: EventoGuardado) => desejadas.find(d => d.agenda.id === g.agenda_id && d.evento.id === g.evento_id);
  const apagar = guardados.filter(g => !desejada(g)).map((guardado): AcaoNoEvento => ({ acao: 'apagar', guardado }));
  const gravar = desejadas.flatMap((copia): AcaoNoEvento[] => {
    const g = guardados.find(x => x.agenda_id === copia.agenda.id && x.evento_id === copia.evento.id);
    return g?.assinatura === copia.assinatura ? [] : [{ acao: 'gravar', copia, existe: !!g }];
  });
  return [...apagar, ...gravar];
}

/**
 * O corpo para mudar um evento que já existe (events.patch): o que o SEMPER não usa mais vai como null, para o Google
 * apagar (um compromisso que ganhou hora deixa de ser do dia inteiro; o local tirado sai). O resto do evento fica.
 */
export function corpoParaMudar(evento: EventoDoGoogle): Record<string, unknown> {
  const vazio = { date: null, dateTime: null, timeZone: null };
  return { ...evento, location: evento.location ?? null, start: { ...vazio, ...evento.start }, end: { ...vazio, ...evento.end } };
}
