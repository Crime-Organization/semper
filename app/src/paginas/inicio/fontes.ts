// Onde o painel da página inicial (#319, #402) busca o que mostra: só as listagens que os módulos já têm, com o filtro do trabalho que
// o painel mostra (o de quem está logado, o da equipe toda ou o de uma pessoa, só para o administrador), e os números dos gráficos.
// Cada leitura acontece uma vez só, mesmo quando os números do alto, os gráficos e as listas a usam. O que entra em cada lista fica em
// regras/painelInicial.ts; as contas dos gráficos, em regras/graficosDoInicio.ts.
import { SD, type AnotacaoLista, type Coluna, type CompromissoLista, type GraficosDeTarefas, type Modulo, type PainelDeProcessos, type ParcelaDoEscritorio, type ProcessoLista, type ResumoPessoas, type TarefaLista } from '../../dados';
import type { AlcanceDoPainel } from '../../regras/filtroDoPainel';
import { desdeDoPainel } from '../../regras/graficosDoInicio';
import { painelDaPessoa } from '../../regras/graficosDeProcessos';
import { agendaDoDia, anotacoesRecentes, colunasEmAberto, DESDE_SEMPRE, DIAS_DO_PAINEL, emAndamentoPeloPrazo, ITENS_POR_BLOCO, parcelasDaSemana, prazosDoPainel, prazosDosProcessosCompletos, processosDoPainel, situacoesEmAberto, totalEmAberto,
  type BlocoDoPainel, type ContagemDaColuna, type PrazoDoPainel, type ProcessoDoPainel, type SituacaoComItens } from '../../regras/painelInicial';
import { SEM_SITUACAO_DEMANDA } from '../../regras/demanda';
import { somarDias } from '../../regras/prazos';
import { TIPOS as TIPOS_DE_PROCESSO } from '../../regras/processo';

/** Quantas anotações (as alteradas por último) o painel lê para achar as da pessoa. */
const ANOTACOES_LIDAS = 50;
/** Na contagem por coluna, basta o total: a listagem traz uma linha só. */
const SO_O_TOTAL = 1;

/** O que cada bloco recebe. */
export interface ResultadoDoBloco {
  /** completa: a leitura chegou ao fim (senão o número leva "+"). */
  prazos: { itens: PrazoDoPainel[]; completa: boolean };
  agenda: CompromissoLista[];
  tarefas: { itens: TarefaLista[]; total: number; colunas: Coluna[] };
  demandas: { situacoes: SituacaoComItens[]; total: number };
  processos: { itens: ProcessoDoPainel[]; total: number };
  /** completa: a leitura chegou ao fim (senão o número leva "+"). */
  anotacoes: { itens: AnotacaoLista[]; total: number; completa: boolean };
  parcelas: ParcelaDoEscritorio[];
  pessoas: ResumoPessoas;
}
export type FontesDosBlocos = { [B in BlocoDoPainel]: () => Promise<ResultadoDoBloco[B]> };
/** As fontes do painel: as dos blocos (as listas) e as dos gráficos. */
export interface FontesDoPainel extends FontesDosBlocos {
  /** As tarefas e o tempo dos gráficos, com as colunas do quadro das tarefas (para saber a situação de cada uma). */
  graficos: () => Promise<{ dados: GraficosDeTarefas; colunas: Coluna[] }>;
  /** As mensagens não lidas de quem está logado (a caixa é de cada um: não muda com o filtro). */
  mensagens: () => Promise<number>;
}

/** A mesma leitura para quem pedir de novo, enquanto as fontes valerem. */
function umaVez<T>(ler: () => Promise<T>) {
  let lida: Promise<T> | null = null;
  return () => lida ??= ler();
}
/** Quantos itens há em cada coluna (e fora do quadro), pela contagem da listagem de cada uma. */
const contarPorColuna = (colunas: Pick<Coluna, 'id'>[], contar: (etapa: string | null) => Promise<number>): Promise<ContagemDaColuna[]> =>
  Promise.all([...colunas.map(c => c.id), null].map(async etapa_id => ({ etapa_id, n: await contar(etapa_id) })));
const SEM_PAINEL: PainelDeProcessos = {
  prazos: [], total_vencidos: 0, total_a_vencer: 0, marcados: [], total_marcados: 0, intimacoes: [], total_intimacoes: 0, ultimos: [], parados: [], total_parados: 0, dias_parado: 0, fases: []
};
const SEM_GRAFICOS: GraficosDeTarefas = { tarefas: [], tempos: [] };

/**
 * As fontes do painel no dia de hoje, com o trabalho que ele mostra. Cada chamada nova (depois de uma mudança, ou com outro filtro)
 * lê tudo de novo.
 */
export function fontesDoPainel(alcance: AlcanceDoPainel, hoje: string, modulos: Partial<Record<Modulo, boolean>> = {}): FontesDoPainel {
  const fimDaSemana = somarDias(hoje, DIAS_DO_PAINEL);
  // pessoa: o filtro das listagens (sem ele, tudo o que quem está logado vê).
  const pessoa = alcance.pessoa;
  const filtro = pessoa ? { pessoa } : {};
  // O banco separa os processos de quem está logado; os de outra pessoa saem dos da equipe (painelDaPessoa).
  const painelDeProcessos = umaVez(async () => {
    if (!modulos.processos) return SEM_PAINEL;
    const painel = await SD.processosPainel({ hoje, meus: alcance.tipo === 'eu' });
    return alcance.tipo === 'pessoa' ? painelDaPessoa(painel, alcance.pessoa, hoje).painel : painel;
  });
  const colunasDasTarefas = umaVez(() => SD.colunasListar('tarefas'));
  const demandas = umaVez(async () => {
    if (!modulos.demandas) return { situacoes: [], total: 0 };
    const colunas = colunasEmAberto(await SD.colunasListar('demandas'));
    const contagens = await contarPorColuna(colunas, async etapa => (await SD.demandasDaEtapa(etapa, { ...filtro, situacao: 'ativas' }, 0, SO_O_TOTAL)).total);
    const situacoes = situacoesEmAberto(colunas, contagens, SEM_SITUACAO_DEMANDA);
    return { situacoes, total: totalEmAberto(situacoes) };
  });
  return {
    prazos: umaVez(async () => {
      const [vencidos, daSemana, painel] = await Promise.all([
        SD.prazosDoPeriodo(DESDE_SEMPRE, somarDias(hoje, -1), filtro), SD.prazosDoPeriodo(hoje, fimDaSemana, filtro), painelDeProcessos()
      ]);
      return { itens: prazosDoPainel([...vencidos, ...daSemana], painel.prazos, hoje, modulos), completa: prazosDosProcessosCompletos(painel, hoje) };
    }),
    agenda: umaVez(async () => modulos.compromissos ? agendaDoDia(await SD.compromissosDoPeriodo(hoje, hoje), pessoa, hoje) : []),
    tarefas: umaVez(async () => {
      // Cada coluna em aberto (e a de fora do quadro) dá as primeiras pelo prazo e quantas tem: a coluna das concluídas nem é lida.
      const colunas = await colunasDasTarefas();
      const porColuna = await Promise.all([...colunasEmAberto(colunas).map(c => c.id), null]
        .map(etapa => SD.tarefasDaEtapa(etapa, { ...filtro, situacao: 'ativas', ordem: 'prazo' }, 0, ITENS_POR_BLOCO)));
      return { itens: emAndamentoPeloPrazo(porColuna.map(l => l.linhas)), total: totalEmAberto(porColuna.map(l => ({ n: l.total }))), colunas };
    }),
    demandas,
    processos: umaVez(async () => {
      const [listas, painel] = await Promise.all([
        Promise.all(TIPOS_DE_PROCESSO.map(tipo => SD.processosListar({ tipo, ...filtro, situacao: 'ativos', ordem: 'recentes', porPagina: ITENS_POR_BLOCO }))),
        painelDeProcessos()
      ]);
      const recentes: ProcessoLista[] = listas.flatMap(l => l.linhas).toSorted((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
      return { itens: processosDoPainel(recentes, painel.prazos, painel.marcados), total: listas.reduce((soma, l) => soma + l.total, 0) };
    }),
    anotacoes: umaVez(async () => {
      const lidas = await SD.anotacoesListar({ situacao: 'ativas', ordem: 'recentes', porPagina: ANOTACOES_LIDAS });
      const dela = anotacoesRecentes(lidas.linhas, pessoa);
      return { itens: dela.slice(0, ITENS_POR_BLOCO), total: dela.length, completa: lidas.total <= lidas.linhas.length };
    }),
    parcelas: umaVez(async () => parcelasDaSemana(await SD.parcelasDoPeriodo(hoje, fimDaSemana, hoje), hoje)),
    pessoas: umaVez(() => SD.pessoasResumo()),
    graficos: umaVez(async () => {
      if (!modulos.tarefas) return { dados: SEM_GRAFICOS, colunas: [] };
      const [dados, colunas] = await Promise.all([SD.tarefasGraficos({ desde: desdeDoPainel(hoje), pessoa }), colunasDasTarefas()]);
      return { dados, colunas };
    }),
    mensagens: umaVez(() => SD.mensagensNaoLidas())
  };
}
