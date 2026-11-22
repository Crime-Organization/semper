// As contas dos números e dos gráficos do painel do Início (#402). Tudo puro, sem tela nem banco. As datas são "aaaa-mm-dd", no
// horário de Brasília.
//   - situacaoDaColuna e tarefasPorSituacao: as tarefas a fazer, fazendo, aguardando e as concluídas na semana;
//   - ritmoPorDia: em cada um dos últimos dias, as tarefas concluídas e o tempo registrado;
//   - prazosDoDia e detalheDaAgenda: os números do alto (prazos vencidos e de hoje, o próximo compromisso).
import type { Coluna, CompromissoLista, GraficosDeTarefas, TarefaNosGraficos } from '../dados/tipos';
import { hojeNaAgenda } from './agenda';
import { diaDaSemana, fmtDiaMes } from './calendario';
import { chaveDaColuna } from './colunasPadrao';
import { fmtHora } from './compromisso';
import { situacaoNoPainel, type SituacaoNoPainel } from './painelInicial';
import { somarDias } from './prazos';

// ---------- o período ----------
/** Os períodos do ritmo: os últimos 7 dias (o padrão) ou os últimos 30. */
export type PeriodoDoRitmo = 'semana' | 'mes';
export const DIAS_DO_RITMO: Record<PeriodoDoRitmo, number> = { semana: 7, mes: 30 };
export const PERIODOS_DO_RITMO = Object.keys(DIAS_DO_RITMO) as PeriodoDoRitmo[];
/** O período que a escolha guardada pede (uma escolha estragada volta para os 7 dias). */
export const periodoDoRitmo = (escolha: unknown): PeriodoDoRitmo => PERIODOS_DO_RITMO.includes(escolha as PeriodoDoRitmo) ? escolha as PeriodoDoRitmo : 'semana';
/** O primeiro dia de um período que termina hoje. */
const primeiroDia = (hoje: string, dias: number) => somarDias(hoje, 1 - dias);
/** Desde quando o painel lê as tarefas e o tempo: o primeiro dia do período mais longo do ritmo. */
export const desdeDoPainel = (hoje: string) => primeiroDia(hoje, Math.max(...Object.values(DIAS_DO_RITMO)));
/** O dia, no horário de Brasília, de um momento guardado pelo banco. */
export const diaDoMomento = (momento: string) => hojeNaAgenda(new Date(momento));

// ---------- as tarefas por situação ----------
export type SituacaoDaTarefa = 'a_fazer' | 'fazendo' | 'aguardando' | 'concluidas';
/** O nome de cada situação, na ordem da tela. As concluídas contam só as dos últimos 7 dias. */
export const SITUACOES_DAS_TAREFAS: Record<SituacaoDaTarefa, string> = {
  a_fazer: 'A fazer', fazendo: 'Fazendo', aguardando: 'Aguardando', concluidas: 'Concluídas na semana'
};
export const SITUACOES = Object.keys(SITUACOES_DAS_TAREFAS) as SituacaoDaTarefa[];
/** O começo do nome das colunas de espera ("Aguardando: retorno do cliente", #314), comparado sem acento nem sinais. */
const ESPERA = 'aguardando';
type ColunaComMarco = Pick<Coluna, 'id' | 'nome' | 'marco'>;
/**
 * A situação de uma coluna do quadro, pela primeira regra que serve (a ordem importa): fora do quadro (ou numa coluna que não existe
 * mais) e na primeira coluna (a coluna-marco "início") é a fazer; na coluna-marco das concluídas, concluída; nas colunas de espera,
 * aguardando; em qualquer outra coluna do escritório, fazendo.
 */
const REGRAS_DA_SITUACAO: readonly [SituacaoDaTarefa, (c: ColunaComMarco | undefined) => boolean][] = [
  ['a_fazer', c => !c || c.marco === 'inicio'],
  ['concluidas', c => c?.marco === 'concluido'],
  ['aguardando', c => !!c && chaveDaColuna(c.nome).startsWith(ESPERA)],
  ['fazendo', () => true]
];
export const situacaoDaColuna = (coluna: ColunaComMarco | undefined) => REGRAS_DA_SITUACAO.find(([, cabe]) => cabe(coluna))![0];

/** As tarefas concluídas num período (o primeiro e o último dia entram), pela data de conclusão. */
const concluidasEntre = (tarefas: readonly TarefaNosGraficos[], de: string, ate: string) =>
  tarefas.filter(t => t.concluida_em && diaDoMomento(t.concluida_em) >= de && diaDoMomento(t.concluida_em) <= ate);

/**
 * Quantas tarefas há em cada situação: as não arquivadas, pela coluna em que estão (as concluídas, não), e as concluídas nos últimos
 * 7 dias, pela data de conclusão (mesmo as arquivadas depois).
 */
export function tarefasPorSituacao(tarefas: readonly TarefaNosGraficos[], colunas: readonly ColunaComMarco[], hoje: string): Record<SituacaoDaTarefa, number> {
  const contagem: Record<SituacaoDaTarefa, number> = { a_fazer: 0, fazendo: 0, aguardando: 0, concluidas: 0 };
  for (const t of tarefas.filter(x => !x.arquivado_em)) {
    const situacao = situacaoDaColuna(colunas.find(c => c.id === t.etapa_id));
    if (situacao !== 'concluidas') contagem[situacao]++;
  }
  contagem.concluidas = concluidasEntre(tarefas, primeiroDia(hoje, DIAS_DO_RITMO.semana), hoje).length;
  return contagem;
}
/** As tarefas em aberto (a fazer, fazendo e aguardando), o número do alto. */
export const tarefasEmAberto = (s: Record<SituacaoDaTarefa, number>) => s.a_fazer + s.fazendo + s.aguardando;

// ---------- o ritmo ----------
/** Um dia do ritmo. nome: o do eixo; curto: o do eixo estreito (vazio: sem nome, para não amontoar); detalhe: o da dica e da tabela. */
export interface DiaDoRitmo { dia: string; nome: string; curto: string; detalhe: string; concluidas: number; horas: number }
/** Quantos segundos tem uma hora (o tempo vem em segundos; o gráfico, em horas). */
export const SEGUNDOS_NA_HORA = 3600;
/** No período longo, o nome do eixo estreito aparece a cada 7 dias, contados de hoje para trás. */
const NOME_A_CADA = 7;
/** "seg", "ter"... (as três primeiras letras do dia da semana) */
const diaCurto = (dia: string) => diaDaSemana(dia).slice(0, 3);
/** O nome de cada dia no eixo, em cada período: os dias da semana nos 7 dias; a data nos 30. */
const NOMES_DO_DIA: Record<PeriodoDoRitmo, (dia: string, i: number, quantos: number) => Pick<DiaDoRitmo, 'nome' | 'curto'>> = {
  semana: dia => ({ nome: diaCurto(dia).replace(/^./, l => l.toUpperCase()), curto: dia.slice(8, 10) }),
  mes: (dia, i, quantos) => ({ nome: fmtDiaMes(dia), curto: (quantos - 1 - i) % NOME_A_CADA ? '' : dia.slice(8, 10) })
};

/**
 * O ritmo de cada um dos últimos dias (hoje por último): as tarefas concluídas (pela data de conclusão) e o tempo registrado, em horas
 * (cada período conta no dia em que começou; o ajuste, no dia em que foi feito; um dia nunca fica negativo).
 */
export function ritmoPorDia(dados: GraficosDeTarefas, hoje: string, periodo: PeriodoDoRitmo): DiaDoRitmo[] {
  const quantos = DIAS_DO_RITMO[periodo];
  return Array.from({ length: quantos }, (_, i) => {
    const dia = somarDias(hoje, i + 1 - quantos);
    const segundos = dados.tempos.filter(r => diaDoMomento(r.inicio) === dia).reduce((s, r) => s + r.segundos, 0);
    return {
      dia, ...NOMES_DO_DIA[periodo](dia, i, quantos),
      detalhe: `${dia === hoje ? 'hoje' : diaDaSemana(dia)}, ${fmtDiaMes(dia)}`,
      concluidas: concluidasEntre(dados.tarefas, dia, dia).length,
      horas: Math.max(0, segundos) / SEGUNDOS_NA_HORA
    };
  });
}
/** Se o ritmo do período ficou sem nada (o gráfico mostra a linha de base e uma nota). */
export const ritmoVazio = (dias: readonly Pick<DiaDoRitmo, 'concluidas' | 'horas'>[]) => dias.every(d => !d.concluidas && !d.horas);

// ---------- os números do alto ----------
/** Quantos prazos estão em atraso, quantos são de hoje e quantos são dos próximos dias. */
export function prazosDoDia(prazos: readonly { data: string }[], hoje: string): Record<SituacaoNoPainel, number> {
  const contagem: Record<SituacaoNoPainel, number> = { vencidos: 0, hoje: 0, semana: 0 };
  for (const p of prazos) { const s = situacaoNoPainel(p.data, hoje); if (s) contagem[s]++; }
  return contagem;
}

/**
 * A linha de apoio do número dos compromissos de hoje, pela primeira regra que serve: sem nenhum, a agenda está livre; com um ainda
 * por vir, a hora do próximo; com os de hora marcada já passados, nenhum mais; senão, só os que valem o dia todo.
 */
export function detalheDaAgenda(compromissos: readonly Pick<CompromissoLista, 'hora'>[], agora: string): string {
  const proximo = compromissos.filter(c => c.hora && fmtHora(c.hora) >= agora).map(c => fmtHora(c.hora)).toSorted()[0];
  const regras: readonly [boolean, () => string][] = [
    [!compromissos.length, () => 'agenda livre'],
    [!!proximo, () => `o próximo às ${proximo}`],
    [compromissos.some(c => c.hora), () => 'nenhum mais hoje'],
    [true, () => 'valem o dia todo']
  ];
  return regras.find(([vale]) => vale)![1]();
}
