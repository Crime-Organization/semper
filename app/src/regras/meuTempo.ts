// Regras de "Meu tempo trabalhado": os períodos (esta semana, este mês, o mês passado ou um intervalo escolhido), em
// datas do calendário, e o total. Tudo puro, sem tela nem banco. As datas vão no formato AAAA-MM-DD.
import type { TempoNaTarefaDoPeriodo } from '../dados/tipos';
import { fmtData } from './pessoa';

export type Periodo = 'semana' | 'mes' | 'mes_passado' | 'intervalo';
/** Como cada período aparece para a pessoa. */
export const PERIODOS: Record<Periodo, string> = { semana: 'Esta semana', mes: 'Este mês', mes_passado: 'Mês passado', intervalo: 'Escolher as datas' };

/** Um período em datas: "de" é o primeiro dia; "ate", o dia seguinte ao último (não entra). */
export interface Intervalo { de: string; ate: string }

const DIA_EM_MS = 24 * 60 * 60 * 1000;
/** Dias da semana até a segunda-feira (a semana começa na segunda). */
const DESDE_A_SEGUNDA = [6, 0, 1, 2, 3, 4, 5];

// As contas de calendário são feitas em UTC, sobre a data pura: assim não dependem do fuso nem do horário de verão.
const lerDia = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const escreverDia = (dia: Date) => dia.toISOString().slice(0, 10);
const somarDias = (iso: string, dias: number) => escreverDia(new Date(lerDia(iso).getTime() + dias * DIA_EM_MS));
const primeiroDoMes = (iso: string, meses = 0) => { const d = lerDia(iso); return escreverDia(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1))); };
const diaValido = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && escreverDia(lerDia(iso)) === iso;

/** Os períodos prontos, a partir de hoje. */
const PRONTOS: Record<Exclude<Periodo, 'intervalo'>, (hoje: string) => Intervalo> = {
  semana: hoje => { const de = somarDias(hoje, -DESDE_A_SEGUNDA[lerDia(hoje).getUTCDay()]); return { de, ate: somarDias(de, 7) }; },
  mes: hoje => ({ de: primeiroDoMes(hoje), ate: primeiroDoMes(hoje, 1) }),
  mes_passado: hoje => ({ de: primeiroDoMes(hoje, -1), ate: primeiroDoMes(hoje) })
};

/**
 * O intervalo do período escolhido. No "intervalo", vale o que a pessoa escolheu (o último dia entra). Devolve a
 * mensagem de erro se as datas do intervalo faltarem, forem inválidas ou estiverem trocadas.
 */
export function intervaloDoPeriodo(periodo: Periodo, hoje: string, escolhido: { de: string; ate: string } = { de: '', ate: '' }): Intervalo | string {
  if (periodo !== 'intervalo') return PRONTOS[periodo](hoje);
  if (!escolhido.de || !escolhido.ate) return 'Escolha o primeiro e o último dia.';
  if (!diaValido(escolhido.de) || !diaValido(escolhido.ate)) return 'Confira as datas.';
  if (escolhido.de > escolhido.ate) return 'O primeiro dia vem antes do último.';
  return { de: escolhido.de, ate: somarDias(escolhido.ate, 1) };
}

/** O período por extenso, com o último dia que entra: "de 01/11/2026 a 07/11/2026" (ou "em 05/11/2026", se for um dia). */
export function periodoPorExtenso({ de, ate }: Intervalo) {
  const ultimo = somarDias(ate, -1);
  return ultimo === de ? `em ${fmtData(de)}` : `de ${fmtData(de)} a ${fmtData(ultimo)}`;
}

/** O total do período: a soma do tempo das tarefas. */
export const totalDoPeriodo = (linhas: Pick<TempoNaTarefaDoPeriodo, 'segundos'>[]) => linhas.reduce((s, l) => s + l.segundos, 0);

/** A meia-noite de uma data no fuso do aparelho, como instante (para o banco comparar com o início de cada período). */
export const inicioDoDia = (iso: string) => new Date(`${iso}T00:00:00`).toISOString();
