// A visão das salas na Agenda (#438): todas as salas do escritório lado a lado, num dia, por horário, para ver de uma vez qual está
// livre. A ocupação é a mesma do cadastro de compromisso (#308, regras/sala.ts): o compromisso sem hora de fim ocupa 1 hora, e o sem
// hora, o dia inteiro. Quem não participa do compromisso vê só que a sala está ocupada, sem o título (o banco já manda sem ele).
// Tudo puro, sem tela nem banco: a tela (paginas/agenda/VisaoDasSalas.tsx) só desenha o que sai daqui.
import type { FiltroCompromissos, OcupacaoDaSala, OcupacaoNaSala, Sala } from '../dados/tipos';
import { CADASTRO_DE_COMPROMISSO } from './compromisso';
import { comoHora, minutosNaSala, MINUTOS_NA_HORA, MINUTOS_NO_DIA, MINUTOS_SEM_FIM } from './sala';

/**
 * A grade da visão, em minutos do dia: das 7h às 21h, em horários de meia em meia hora. Um compromisso que começa antes ou termina
 * depois estica a grade até ele (o dia inteiro não estica: ocupa a grade toda).
 */
export const GRADE_DAS_SALAS = { inicio: 7 * MINUTOS_NA_HORA, fim: 21 * MINUTOS_NA_HORA, passo: 30 } as const;

/** O que a visão diz do horário de quem não participa: só que a sala está ocupada. */
export const OCUPADO = 'Ocupado';

/** O que a visão diz quando não sobra sala para mostrar: o escritório não tem sala ativa. */
export const SEM_SALAS_ATIVAS = 'Nenhuma sala ativa para mostrar. As salas são cadastradas nas Configurações.';
/** Ou: há salas ativas, mas o filtro da agenda está numa sala desativada (o filtro também oferece as desativadas). */
export const SALA_DO_FILTRO_DESATIVADA = 'A sala escolhida no filtro está desativada. Tire o filtro de sala para ver as salas ativas.';
/** Por que a visão das salas ficou vazia: com o filtro de sala ligado, foi ele (a visão só aparece com alguma sala ativa). */
export const semSalasNaVisao = (filtroDeSala?: string) => filtroDeSala ? SALA_DO_FILTRO_DESATIVADA : SEM_SALAS_ATIVAS;

/** Os filtros da agenda que a visão das salas não usa (ela mostra toda a ocupação do dia), como a nota os chama. */
const FILTROS_FORA_DAS_SALAS: Record<'termo' | 'pessoa' | 'tipo' | 'etiqueta', string> = {
  termo: 'a busca', pessoa: 'o filtro de pessoa', tipo: 'o filtro de tipo', etiqueta: 'o filtro de etiqueta'
};
/**
 * A nota da visão das salas quando a agenda tem busca, pessoa, tipo ou etiqueta escolhidos: eles não valem ali (a sala está ocupada
 * por quem quer que seja). Sem nenhum deles, null.
 */
export function notaDosFiltrosNasSalas(filtro: Pick<FiltroCompromissos, keyof typeof FILTROS_FORA_DAS_SALAS>): string | null {
  const nomes = (Object.keys(FILTROS_FORA_DAS_SALAS) as (keyof typeof FILTROS_FORA_DAS_SALAS)[]).filter(k => filtro[k]?.trim()).map(k => FILTROS_FORA_DAS_SALAS[k]);
  if (!nomes.length) return null;
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
  return `A visão das salas mostra toda a ocupação do dia: ${lista} não ${nomes.length === 1 ? 'vale' : 'valem'} aqui.`;
}

/** Os horários da grade, do primeiro ao último, em minutos do dia: estica para caber os compromissos do dia. */
export function horariosDaGrade(ocupacoes: readonly Pick<OcupacaoDaSala, 'hora' | 'hora_fim'>[]): number[] {
  const { passo } = GRADE_DAS_SALAS;
  let inicio: number = GRADE_DAS_SALAS.inicio, fim: number = GRADE_DAS_SALAS.fim;
  for (const o of ocupacoes) {
    if (!o.hora) continue;
    const [i, f] = minutosNaSala(o.hora, o.hora_fim);
    inicio = Math.min(inicio, Math.floor(i / passo) * passo);
    fim = Math.max(fim, Math.min(Math.ceil(f / passo) * passo, MINUTOS_NO_DIA));
  }
  const horarios: number[] = [];
  for (let m = inicio; m < fim; m += passo) horarios.push(m);
  return horarios;
}

/**
 * Um pedaço da coluna de uma sala: um horário livre (sem ocupações), ou os horários seguidos que um compromisso ocupa (se dois
 * dividem um horário, ficam no mesmo pedaço). `linha` é o primeiro horário da grade, e `linhas`, quantos ele cobre.
 */
export interface FaixaDaSala { linha: number; linhas: number; inicio: number; fim: number; ocupacoes: OcupacaoDaSala[] }

/** A coluna de uma sala na grade: cada horário livre é um pedaço só dele; os ocupados pelo mesmo compromisso se juntam. */
export function faixasDaSala(ocupacoes: readonly OcupacaoDaSala[], horarios: readonly number[]): FaixaDaSala[] {
  const { passo } = GRADE_DAS_SALAS;
  const faixas: FaixaDaSala[] = [];
  horarios.forEach((inicio, linha) => {
    const fim = inicio + passo;
    const aqui = ocupacoes.filter(o => { const [i, f] = minutosNaSala(o.hora, o.hora_fim); return i < fim && inicio < f; });
    const anterior = faixas.at(-1);
    if (aqui.length && anterior?.ocupacoes.some(o => aqui.some(a => a.id === o.id))) {
      anterior.linhas++;
      anterior.fim = fim;
      anterior.ocupacoes.push(...aqui.filter(a => !anterior.ocupacoes.some(o => o.id === a.id)));
      return;
    }
    faixas.push({ linha, linhas: 1, inicio, fim, ocupacoes: aqui });
  });
  return faixas;
}

/** A ocupação de todas as salas, separada por sala (a sala sem nada no dia fica de fora). */
export function ocupacoesPorSala(lista: readonly OcupacaoNaSala[]): Record<string, OcupacaoDaSala[]> {
  const porSala: Record<string, OcupacaoDaSala[]> = {};
  for (const { sala_id, ...o } of lista) (porSala[sala_id] ??= []).push(o);
  return porSala;
}

/** As salas da visão: as ativas (onde dá para marcar), por nome; filtrando a agenda por uma sala, só ela. */
export const salasDaVisao = (salas: readonly Sala[], filtro?: string) =>
  salas.filter(s => s.ativa && (!filtro || s.id === filtro)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/** O que o horário ocupado mostra: o título, de quem vê o compromisso; de quem não participa, só "Ocupado". */
export const rotuloDaOcupacao = (o: Pick<OcupacaoDaSala, 'titulo'>) => o.titulo?.trim() || OCUPADO;

// ---------- marcar num horário livre ----------
/** Os parâmetros do endereço do cadastro de compromisso aberto num horário livre: a sala, a data (aaaa-mm-dd) e as horas (hh:mm). */
export const PARAMETROS_DO_HORARIO = { sala: 'sala', data: 'data', hora: 'hora', ate: 'ate' } as const;

/**
 * Até quando o compromisso marcado no horário livre pode ir sem bater no próximo: se o próximo compromisso da sala começa antes de
 * 1 hora (o tempo de quem não tem hora de fim), ele termina ali; senão, null (fica sem hora de fim, como no cadastro comum).
 */
export function fimAntesDoProximo(inicio: number, ocupacoes: readonly Pick<OcupacaoDaSala, 'hora' | 'hora_fim'>[]): number | null {
  const proximo = Math.min(...ocupacoes.filter(o => o.hora).map(o => minutosNaSala(o.hora, o.hora_fim)[0]).filter(i => i > inicio));
  return proximo < inicio + MINUTOS_SEM_FIM ? proximo : null;
}

/** O endereço do cadastro de compromisso já com a sala, a data e a hora do horário livre (e o fim, se o próximo vem logo). */
export function enderecoParaMarcar(salaId: string, data: string, inicio: number, ocupacoes: readonly Pick<OcupacaoDaSala, 'hora' | 'hora_fim'>[]) {
  const p = new URLSearchParams({ [PARAMETROS_DO_HORARIO.sala]: salaId, [PARAMETROS_DO_HORARIO.data]: data, [PARAMETROS_DO_HORARIO.hora]: comoHora(inicio) });
  const fim = fimAntesDoProximo(inicio, ocupacoes);
  if (fim !== null) p.set(PARAMETROS_DO_HORARIO.ate, comoHora(fim));
  return `${CADASTRO_DE_COMPROMISSO}?${p}`;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
/** dd/mm/aaaa, como o campo Data do cadastro. */
const comoNoCampo = (iso: string) => iso.split('-').reverse().join('/');

/**
 * A data e as horas que o cadastro de compromisso recebe do endereço (o horário livre da visão das salas): só as que estão no formato
 * certo; o resto fica vazio, como no cadastro comum.
 */
export function horarioDoEndereco(params: URLSearchParams): { data?: string; hora?: string; horaFim?: string } {
  const data = params.get(PARAMETROS_DO_HORARIO.data) ?? '', hora = params.get(PARAMETROS_DO_HORARIO.hora) ?? '', ate = params.get(PARAMETROS_DO_HORARIO.ate) ?? '';
  const campos: { data?: string; hora?: string; horaFim?: string } = {};
  if (DATA_ISO.test(data)) campos.data = comoNoCampo(data);
  if (HORA.test(hora)) {
    campos.hora = hora;
    if (HORA.test(ate) && ate > hora) campos.horaFim = ate;
  }
  return campos;
}

/** A sala que o cadastro recebe do endereço: só se ela é uma das salas ativas do escritório; senão, nenhuma. */
export const salaDoEndereco = (params: URLSearchParams, salas: readonly Sala[]) => {
  const id = params.get(PARAMETROS_DO_HORARIO.sala);
  return salas.find(s => s.id === id && s.ativa)?.id ?? '';
};

/** Como o horário livre se apresenta a quem não vê a grade (o leitor de tela): o que o clique faz. */
export const marcarNoHorario = (sala: string, inicio: number) => `Marcar em ${sala} às ${comoHora(inicio)}`;
/** O horário do pedaço ocupado, por extenso: "14:00 às 15:00". */
export const horarioDaFaixa = (o: Pick<OcupacaoDaSala, 'hora' | 'hora_fim'>) => {
  if (!o.hora) return 'O dia inteiro';
  const [i, f] = minutosNaSala(o.hora, o.hora_fim);
  return `${comoHora(i)} às ${comoHora(f)}`;
};
