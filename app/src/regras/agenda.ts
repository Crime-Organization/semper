// A visão por data da agenda: o dia de hoje no horário de Brasília, os períodos (dia, semana e mês), o caminhar entre eles
// e os itens de cada dia. Tudo puro, sem tela nem banco. As datas entram e saem como "aaaa-mm-dd", e as contas são feitas em
// UTC (somarDias), sobre a data pura: assim o fuso do aparelho não muda o dia.
import type { CompromissoLista, PrazoNaAgenda } from '../dados/tipos';
import { diaDaSemana, MESES } from './calendario';
import { FUSO_DA_AGENDA, nomeDoCompromisso } from './compromisso';
import { fmtData } from './pessoa';
import { DIAS_NA_SEMANA, somarDias } from './prazos';

/** O formato que dá "aaaa-mm-dd" no Intl. */
const FORMATO_ISO = 'en-CA';
/** Hoje no horário de Brasília, em qualquer aparelho. */
export const hojeNaAgenda = (agora = new Date()) => new Intl.DateTimeFormat(FORMATO_ISO, { timeZone: FUSO_DA_AGENDA }).format(agora);
/** A hora agora no horário de Brasília, "hh:mm" (como fmtHora escreve a hora de um compromisso). */
export const horaNaAgenda = (agora = new Date()) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DA_AGENDA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora);

// Os dias numa semana ficam em regras/prazos.ts, que não depende da agenda (a repetição dos compromissos também os usa).
export { DIAS_NA_SEMANA };
/** Dias da semana até a segunda-feira (a semana começa na segunda, como em Meu tempo). */
const DESDE_A_SEGUNDA = [6, 0, 1, 2, 3, 4, 5];
const paraData = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const inicioDaSemana = (iso: string) => somarDias(iso, -DESDE_A_SEGUNDA[paraData(iso).getUTCDay()]);
const primeiroDoMes = (iso: string, meses = 0) => { const d = paraData(iso); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1)).toISOString().slice(0, 10); };
const nomeDoMes = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

/** Um dia só: o período, o caminhar e o título do Dia (e da visão das salas). */
const UM_DIA = {
  periodo: (data: string) => ({ de: data, ate: data }),
  andar: (data: string, passos: number) => somarDias(data, passos),
  titulo: (data: string) => `${diaDaSemana(data)}, ${fmtData(data)}`
};

export type VisaoDeData = 'dia' | 'semana' | 'mes' | 'salas';
export interface PeriodoDaAgenda { de: string; ate: string }
/**
 * O que cada visão faz com a data em que a pessoa está: o período que ela mostra (primeiro e último dia entram), o
 * caminhar para o período seguinte ou anterior e o título. O mês mostra semanas inteiras: começa na segunda e termina no domingo.
 */
export const VISOES_DE_DATA: Record<VisaoDeData, {
  nome: string; periodo: (data: string) => PeriodoDaAgenda; andar: (data: string, passos: number) => string; titulo: (data: string) => string;
  /** Só aparece com salas ativas no escritório. */
  precisaDeSalas?: boolean;
}> = {
  dia: { nome: 'Dia', ...UM_DIA },
  semana: {
    nome: 'Semana',
    periodo: data => { const de = inicioDaSemana(data); return { de, ate: somarDias(de, DIAS_NA_SEMANA - 1) }; },
    andar: (data, passos) => somarDias(data, passos * DIAS_NA_SEMANA),
    titulo: data => { const de = inicioDaSemana(data); return `${fmtData(de)} a ${fmtData(somarDias(de, DIAS_NA_SEMANA - 1))}`; }
  },
  mes: {
    nome: 'Mês',
    periodo: data => ({ de: inicioDaSemana(primeiroDoMes(data)), ate: somarDias(inicioDaSemana(somarDias(primeiroDoMes(data, 1), -1)), DIAS_NA_SEMANA - 1) }),
    andar: (data, passos) => primeiroDoMes(data, passos),
    titulo: nomeDoMes
  },
  // Todas as salas do escritório lado a lado, num dia, por horário (#438): anda de dia em dia, como o Dia.
  salas: { nome: 'Salas', ...UM_DIA, precisaDeSalas: true }
};
export const VISOES = Object.keys(VISOES_DE_DATA) as VisaoDeData[];
/** As visões que a agenda oferece: a das salas, só com salas ativas no escritório. */
export const visoesDaAgenda = (temSalas: boolean) => VISOES.filter(v => temSalas || !VISOES_DE_DATA[v].precisaDeSalas);

/** Todos os dias de um período, na ordem. */
export function diasDoPeriodo({ de, ate }: PeriodoDaAgenda) {
  const dias: string[] = [];
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) dias.push(dia);
  return dias;
}
/** O dia pertence ao mês da data em que a pessoa está? (A grade do mês mostra pedaços dos meses vizinhos.) */
export const noMesmoMes = (dia: string, data: string) => dia.slice(0, 7) === data.slice(0, 7);
/** O número do dia, sem o zero à esquerda: "2026-11-05" → "5". */
export const numeroDoDia = (dia: string) => String(Number(dia.slice(8, 10)));

/** O que abre cada prazo e como ele se apresenta. */
export const ORIGENS_DE_PRAZO: Record<PrazoNaAgenda['origem'], { nome: string; endereco: string }> = {
  demandas: { nome: 'Prazo da demanda', endereco: '/demandas/?id=' },
  tarefas: { nome: 'Prazo da tarefa', endereco: '/tarefas/?id=' }
};

/** Um item da agenda: um compromisso (abre o cartão dele aqui) ou o prazo de uma demanda ou tarefa (abre no módulo dela). */
export interface ItemDaAgenda {
  chave: string;
  dia: string;
  /** hh:mm:ss; sem hora, o item vem primeiro no dia. */
  hora: string | null;
  titulo: string;
  compromisso?: CompromissoLista;
  prazo?: PrazoNaAgenda;
}
const horaParaOrdem = (i: ItemDaAgenda) => i.hora ?? '';
/** Compromissos e prazos numa lista só, por dia e hora (o prazo com hora entra na hora dele; sem hora, no começo do dia). */
export const itensDaAgenda = (compromissos: CompromissoLista[], prazos: PrazoNaAgenda[]): ItemDaAgenda[] => [
  ...compromissos.map(c => ({ chave: 'compromisso-' + c.id, dia: c.data, hora: c.hora, titulo: nomeDoCompromisso(c), compromisso: c })),
  ...prazos.map(p => ({ chave: `${p.origem}-${p.id}`, dia: p.prazo, hora: p.hora, titulo: p.titulo, prazo: p }))
].sort((a, b) => a.dia.localeCompare(b.dia) || horaParaOrdem(a).localeCompare(horaParaOrdem(b)) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
/** Os itens de um dia, na ordem da lista. */
export const itensDoDia = (itens: ItemDaAgenda[], dia: string) => itens.filter(i => i.dia === dia);
