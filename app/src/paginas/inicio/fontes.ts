// Onde cada bloco do painel da página inicial (#319) busca o que mostra: só as listagens que os módulos já têm, com o filtro de
// quem está logado (responsável ou participante). Cada bloco carrega por conta própria; o painel de Processos, que dá os prazos
// dos processos e as audiências, é lido uma vez só para os dois blocos que o usam. O que entra em cada bloco fica em regras/painelInicial.ts.
import { SD, type AnotacaoLista, type Coluna, type CompromissoLista, type Modulo, type PainelDeProcessos, type ParcelaDoEscritorio, type ProcessoLista, type ResumoPessoas, type TarefaLista } from '../../dados';
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
export type FontesDoPainel = { [B in BlocoDoPainel]: () => Promise<ResultadoDoBloco[B]> };

/** A mesma leitura para quem pedir de novo, enquanto as fontes valerem. */
function umaVez<T>(ler: () => Promise<T>) {
  let lida: Promise<T> | null = null;
  return () => lida ??= ler();
}
/** Quantos itens há em cada coluna (e fora do quadro), pela contagem da listagem de cada uma. */
const contarPorColuna = (colunas: Pick<Coluna, 'id'>[], contar: (etapa: string | null) => Promise<number>): Promise<ContagemDaColuna[]> =>
  Promise.all([...colunas.map(c => c.id), null].map(async etapa_id => ({ etapa_id, n: await contar(etapa_id) })));
const SEM_PAINEL: Pick<PainelDeProcessos, 'prazos' | 'total_vencidos' | 'total_a_vencer' | 'marcados'> = { prazos: [], total_vencidos: 0, total_a_vencer: 0, marcados: [] };

/** As fontes do painel de quem está logado, no dia de hoje. Cada chamada nova (depois de uma mudança) lê tudo de novo. */
export function fontesDoPainel(eu: string, hoje: string, modulos: Partial<Record<Modulo, boolean>> = {}): FontesDoPainel {
  const fimDaSemana = somarDias(hoje, DIAS_DO_PAINEL);
  const painelDeProcessos = umaVez(() => modulos.processos ? SD.processosPainel({ hoje, meus: true }) : Promise.resolve(SEM_PAINEL));
  return {
    async prazos() {
      const [vencidos, daSemana, painel] = await Promise.all([
        SD.prazosDoPeriodo(DESDE_SEMPRE, somarDias(hoje, -1), { pessoa: eu }), SD.prazosDoPeriodo(hoje, fimDaSemana, { pessoa: eu }), painelDeProcessos()
      ]);
      return { itens: prazosDoPainel([...vencidos, ...daSemana], painel.prazos, hoje, modulos), completa: prazosDosProcessosCompletos(painel, hoje) };
    },
    agenda: async () => agendaDoDia(await SD.compromissosDoPeriodo(hoje, hoje), eu, hoje),
    async tarefas() {
      // Cada coluna em aberto (e a de fora do quadro) dá as primeiras pelo prazo e quantas tem: a coluna das concluídas nem é lida.
      const colunas = await SD.colunasListar('tarefas');
      const porColuna = await Promise.all([...colunasEmAberto(colunas).map(c => c.id), null]
        .map(etapa => SD.tarefasDaEtapa(etapa, { pessoa: eu, situacao: 'ativas', ordem: 'prazo' }, 0, ITENS_POR_BLOCO)));
      return { itens: emAndamentoPeloPrazo(porColuna.map(l => l.linhas)), total: totalEmAberto(porColuna.map(l => ({ n: l.total }))), colunas };
    },
    async demandas() {
      const colunas = colunasEmAberto(await SD.colunasListar('demandas'));
      const contagens = await contarPorColuna(colunas, async etapa => (await SD.demandasDaEtapa(etapa, { pessoa: eu, situacao: 'ativas' }, 0, SO_O_TOTAL)).total);
      const situacoes = situacoesEmAberto(colunas, contagens, SEM_SITUACAO_DEMANDA);
      return { situacoes, total: totalEmAberto(situacoes) };
    },
    async processos() {
      const [listas, painel] = await Promise.all([
        Promise.all(TIPOS_DE_PROCESSO.map(tipo => SD.processosListar({ tipo, pessoa: eu, situacao: 'ativos', ordem: 'recentes', porPagina: ITENS_POR_BLOCO }))),
        painelDeProcessos()
      ]);
      const recentes: ProcessoLista[] = listas.flatMap(l => l.linhas).toSorted((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
      return { itens: processosDoPainel(recentes, painel.prazos, painel.marcados), total: listas.reduce((soma, l) => soma + l.total, 0) };
    },
    async anotacoes() {
      const lidas = await SD.anotacoesListar({ situacao: 'ativas', ordem: 'recentes', porPagina: ANOTACOES_LIDAS });
      const minhas = anotacoesRecentes(lidas.linhas, eu);
      return { itens: minhas.slice(0, ITENS_POR_BLOCO), total: minhas.length, completa: lidas.total <= lidas.linhas.length };
    },
    parcelas: async () => parcelasDaSemana(await SD.parcelasDoPeriodo(hoje, fimDaSemana, hoje), hoje),
    pessoas: () => SD.pessoasResumo()
  };
}
