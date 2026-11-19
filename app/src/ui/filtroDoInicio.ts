// O filtro "Início" das páginas de Tarefas e de Demandas (#357), no painel "Filtros" da página de módulo, como o de etiqueta
// (filtroDeEtiqueta). Os períodos e os dias de cada um ficam em regras/dataDeInicio.ts; aqui, só o filtro na tela. A página guarda só o
// período e tira os dias dele (limitesDoPeriodo) na hora de listar, a partir do hoje daquele momento.
import { PERIODOS, PERIODOS_DO_INICIO, type PeriodoDoInicio } from '../regras/dataDeInicio';
import type { Filtro } from './PaginaModulo';

/** O filtro "Início": qualquer data, começa hoje, já começou, ainda vai começar, nos últimos dias. */
export const filtroDoInicio = (periodo: PeriodoDoInicio, aoMudar: (periodo: PeriodoDoInicio) => void): Filtro => ({
  id: 'inicio', rotulo: 'Início', valor: periodo, aoMudar: v => aoMudar(v as PeriodoDoInicio),
  opcoes: PERIODOS.map(p => [p, PERIODOS_DO_INICIO[p].rotulo] as [string, string])
});
