// Ordem das listas (quadro e tabela) de qualquer módulo: as opções, a escolha guardada de cada usuário
// e a data que acompanha a ordem escolhida. O <PaginaModulo> mostra o controle "Ordenar".
import { useState } from 'react';
import type { Ordem } from '../dados';
import type { Visao } from './PaginaModulo';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { dataCurta, relativo } from './util';

export const ORDENS: Record<Ordem, string> = {
  manual: 'Ordem manual',
  novos: 'Mais novos primeiro',
  antigos: 'Mais antigos primeiro',
  recentes: 'Atualizados recentemente',
  nome: 'Nome (A–Z)',
  nome_desc: 'Nome (Z–A)'
};
// A ordem manual (arrastando os cartões) só existe no quadro.
const OPCOES: Record<Visao, Ordem[]> = {
  kanban: ['manual', 'novos', 'antigos', 'recentes', 'nome', 'nome_desc'],
  tabela: ['nome', 'nome_desc', 'novos', 'antigos', 'recentes']
};
const PADRAO: Record<Visao, Ordem> = { kanban: 'manual', tabela: 'nome' };

export interface Ordenacao { valor: Ordem; opcoes: Ordem[]; aoMudar: (o: Ordem) => void }

/** Ordem escolhida em cada visualização do módulo (quadro e tabela têm a sua), guardada no perfil. */
export function useOrdem(modulo: string, visao: Visao): Ordenacao {
  const chave = (v: Visao) => `${modulo}.ordem.${v}`;
  const ler = (v: Visao) => { const o = lerPreferencia<Ordem>(chave(v), PADRAO[v]); return OPCOES[v].includes(o) ? o : PADRAO[v]; };
  const [ordens, setOrdens] = useState(() => ({ kanban: ler('kanban'), tabela: ler('tabela') }));
  return {
    valor: ordens[visao],
    opcoes: OPCOES[visao],
    aoMudar: o => { setOrdens(x => ({ ...x, [visao]: o })); salvarPreferencia(chave(visao), o); }
  };
}

/** Data que acompanha a ordem escolhida, para mostrar no cartão: "Cadastro: 12/10/2026" ou "Atualização: há 2 h". */
export function dataDaOrdem(ordem: Ordem, item: { criado_em?: string | null; atualizado_em?: string | null }) {
  if ((ordem === 'novos' || ordem === 'antigos') && item.criado_em) return `Cadastro: ${dataCurta(item.criado_em)}`;
  if (ordem === 'recentes' && item.atualizado_em) return `Atualização: ${relativo(item.atualizado_em)}`;
  return '';
}
