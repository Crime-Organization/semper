// Ordem das listas de qualquer módulo: as opções, a escolha guardada de cada usuário e a data que
// acompanha a ordem escolhida. Na tabela, o <PaginaModulo> mostra o controle "Ordenar"; no quadro,
// cada coluna tem a sua ordem, escolhida no menu da coluna (useColunas). Tarefas e demandas têm também
// as ordens pelo prazo (ORDENS_COM_PRAZO, #291); os outros módulos ficam só com as de sempre.
import { useState } from 'react';
import type { Ordem, OrdemComPrazo } from '../dados';
import type { Visao } from './PaginaModulo';
import { lerPreferencia, salvarPreferencia } from './preferencias';
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
  prazo_desc: 'Prazo (o mais distante primeiro)'
};
/** As ordens a mais de tarefas e demandas, na tabela e em cada coluna do quadro (#291). */
export const ORDENS_COM_PRAZO: OrdemComPrazo[] = ['prazo', 'prazo_desc'];
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

/** Data que acompanha a ordem escolhida, para mostrar no cartão: "Cadastro: 12/10/2026" ou "Atualização: há 2 h". */
export function dataDaOrdem(ordem: OrdemComPrazo, item: { criado_em?: string | null; atualizado_em?: string | null }) {
  if ((ordem === 'novos' || ordem === 'antigos') && item.criado_em) return `Cadastro: ${dataCurta(item.criado_em)}`;
  if (ordem === 'recentes' && item.atualizado_em) return `Atualização: ${relativo(item.atualizado_em)}`;
  return '';
}
