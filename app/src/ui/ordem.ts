// Ordem das listas de qualquer módulo: as opções, a escolha guardada de cada usuário e a data que
// acompanha a ordem escolhida. Na tabela, o <PaginaModulo> mostra o controle "Ordenar"; no quadro,
// cada coluna tem a sua ordem, escolhida no menu da coluna (useColunas). Tarefas e demandas têm também
// as ordens pelo prazo (ORDENS_COM_PRAZO, #291) e pela data de início (ORDENS_COM_INICIO, #357); os outros módulos ficam só com as de sempre.
import { useState } from 'react';
import type { Ordem, OrdemComPrazo } from '../dados';
import type { Visao } from './PaginaModulo';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { fmtData } from '../regras/pessoa';
import { dataCurta, relativo } from './util';

/** O nome de cada ordem, no controle "Ordenar", no menu da coluna e no topo dela. */
export const ORDENS: Record<OrdemComPrazo, string> = {
  manual: 'Ordem manual',
  novos: 'Mais novos primeiro',
  antigos: 'Mais antigos primeiro',
  recentes: 'Atualizados recentemente',
  nome: 'Nome (A–Z)',
  nome_desc: 'Nome (Z–A)',
  prazo: 'Prazo (o mais próximo primeiro)',
  prazo_desc: 'Prazo (o mais distante primeiro)',
  inicio: 'Início (o que começou antes primeiro)',
  inicio_desc: 'Início (o que começa depois primeiro)'
};
/** As ordens a mais de tarefas e demandas, na tabela e em cada coluna do quadro (#291). */
export const ORDENS_COM_PRAZO: OrdemComPrazo[] = ['prazo', 'prazo_desc'];
/** As ordens pela data de início de tarefas e demandas (#357), também na tabela e em cada coluna do quadro. */
export const ORDENS_COM_INICIO: OrdemComPrazo[] = ['inicio', 'inicio_desc'];
// A ordem manual (arrastando os cartões) só existe no quadro.
type VisaoComOrdem = Exclude<Visao, 'agenda'>;
const OPCOES: Record<VisaoComOrdem, Ordem[]> = {
  kanban: ['manual', 'novos', 'antigos', 'recentes', 'nome', 'nome_desc'],
  tabela: ['nome', 'nome_desc', 'novos', 'antigos', 'recentes']
};
/** Opções de cada coluna do quadro (a manual, de arrastar, só existe no quadro). */
export const ORDENS_DO_QUADRO: Ordem[] = OPCOES.kanban;
const PADRAO: Record<VisaoComOrdem, Ordem> = { kanban: 'manual', tabela: 'nome' };

/** A ordem escolhida e as opções do módulo. "aoMudar" é método para aceitar a ordenação de um módulo com menos opções. */
export interface Ordenacao<O extends OrdemComPrazo = Ordem> { valor: O; opcoes: O[]; aoMudar(o: O): void }

/**
 * Ordem escolhida em cada visualização do módulo (quadro e tabela têm a sua), guardada no perfil. "extras" são as opções a mais
 * do módulo (as do prazo, em tarefas e demandas). Uma ordem guardada que o módulo não tem volta para a padrão.
 */
export function useOrdem<O extends OrdemComPrazo = Ordem>(modulo: string, visao: VisaoComOrdem, extras: O[] = []): Ordenacao<O> {
  const chave = (v: VisaoComOrdem) => `${modulo}.ordem.${v}`;
  const opcoesDe = (v: VisaoComOrdem) => [...OPCOES[v], ...extras] as O[];
  const ler = (v: VisaoComOrdem) => { const o = lerPreferencia<O>(chave(v), PADRAO[v] as O); return opcoesDe(v).includes(o) ? o : PADRAO[v] as O; };
  const [ordens, setOrdens] = useState(() => ({ kanban: ler('kanban'), tabela: ler('tabela') }));
  return {
    valor: ordens[visao],
    opcoes: opcoesDe(visao),
    aoMudar: o => { setOrdens(x => ({ ...x, [visao]: o })); salvarPreferencia(chave(visao), o); }
  };
}

/** As datas que podem acompanhar a ordem: a do cadastro, a da última atualização e a de início (#357). */
type DataDaOrdem = 'cadastro' | 'atualizacao' | 'inicio';
/** O item com as datas que a ordem pode mostrar. */
export interface ComDatas { criado_em?: string | null; atualizado_em?: string | null; data_inicio?: string | null }
/** Cada data: o nome no cartão do quadro, o nome da coluna na tabela e como ela aparece. */
const DATAS: Record<DataDaOrdem, { rotulo: string; coluna: string; valor: (item: ComDatas) => string }> = {
  cadastro: { rotulo: 'Cadastro', coluna: 'Criada', valor: item => dataCurta(item.criado_em) },
  atualizacao: { rotulo: 'Atualização', coluna: 'Atualizada', valor: item => item.atualizado_em ? relativo(item.atualizado_em) : '' },
  inicio: { rotulo: 'Início', coluna: 'Início', valor: item => fmtData(item.data_inicio) }
};
/** A data que cada ordem mostra no cartão do quadro (null: nenhuma). */
const DATA_NO_CARTAO: Record<OrdemComPrazo, DataDaOrdem | null> = {
  manual: null, nome: null, nome_desc: null, prazo: null, prazo_desc: null,
  novos: 'cadastro', antigos: 'cadastro', recentes: 'atualizacao', inicio: 'inicio', inicio_desc: 'inicio'
};

/** Data que acompanha a ordem escolhida, para mostrar no cartão: "Cadastro: 12/10/2026", "Atualização: há 2 h" ou "Início: 25/11/2026". */
export function dataDaOrdem(ordem: OrdemComPrazo, item: ComDatas) {
  const qual = DATA_NO_CARTAO[ordem], valor = qual ? DATAS[qual].valor(item) : '';
  return qual && valor ? `${DATAS[qual].rotulo}: ${valor}` : '';
}
/** A última coluna da tabela de tarefas e demandas: a data da ordem escolhida; nas que não têm data, a última atualização. */
export function colunaDaOrdem(ordem: OrdemComPrazo) {
  const d = DATAS[DATA_NO_CARTAO[ordem] ?? 'atualizacao'];
  return { titulo: d.coluna, valor: d.valor };
}
