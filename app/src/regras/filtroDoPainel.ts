// O filtro dos painéis (Processos e, depois, Início e Financeiro): de quem é o trabalho que o painel mostra (#401). Quem não é
// administrador vê sempre o próprio trabalho; o administrador escolhe entre o dele, o da equipe toda ou o de uma pessoa da
// equipe, e a escolha fica lembrada nas preferências. Puro, sem tela nem banco.
import type { Membro } from '../dados/tipos';

/** O trabalho de quem está logado (o padrão de todos). */
export const MEU_TRABALHO = 'eu';
/** O trabalho de todos que quem está logado vê. */
export const EQUIPE_TODA = 'equipe';

/** De quem é o painel: de quem está logado, da equipe toda ou de uma pessoa da equipe (o perfil dela). */
export type AlcanceDoPainel = { tipo: 'eu'; pessoa: string } | { tipo: 'equipe'; pessoa: null } | { tipo: 'pessoa'; pessoa: string };

/** Quem entra na lista do filtro: o resto da equipe, sem quem saiu nem quem está desligado, em ordem de nome. */
export const pessoasDoFiltro = (equipe: readonly Membro[], eu: string) =>
  equipe.filter(m => m.id !== eu && !m.excluido && m.ativo !== false).toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/**
 * O alcance de uma escolha guardada. Quem não é administrador fica sempre com o próprio trabalho; uma escolha que não serve mais
 * (a pessoa saiu da equipe, ou a preferência veio estragada) volta para o próprio trabalho.
 */
export function alcanceDoPainel(escolha: unknown, { ehAdmin, eu, equipe }: { ehAdmin: boolean; eu: string; equipe: readonly Membro[] }): AlcanceDoPainel {
  if (!ehAdmin || escolha === MEU_TRABALHO || escolha === eu) return { tipo: 'eu', pessoa: eu };
  if (escolha === EQUIPE_TODA) return { tipo: 'equipe', pessoa: null };
  return typeof escolha === 'string' && pessoasDoFiltro(equipe, eu).some(m => m.id === escolha) ? { tipo: 'pessoa', pessoa: escolha } : { tipo: 'eu', pessoa: eu };
}

/** A escolha que fica guardada para um alcance: "eu", "equipe" ou o perfil da pessoa. */
export const escolhaDoAlcance = (a: AlcanceDoPainel) => a.tipo === 'pessoa' ? a.pessoa : a.tipo === 'eu' ? MEU_TRABALHO : EQUIPE_TODA;

/** A frase de quem é o trabalho mostrado, embaixo do título do painel. */
export const FRASE_DO_ALCANCE: Record<AlcanceDoPainel['tipo'], (nome: string) => string> = {
  eu: () => 'O seu trabalho: o que é seu e aquilo de que você participa.',
  equipe: () => 'O trabalho da equipe toda.',
  pessoa: nome => `O trabalho de ${nome}.`
};

/** O item é do trabalho da pessoa: ela é a responsável ou está na equipe dele. */
export const daPessoa = (item: { responsavel_id: string | null; colaboradores?: readonly string[] | null }, pessoa: string) =>
  item.responsavel_id === pessoa || !!item.colaboradores?.includes(pessoa);
