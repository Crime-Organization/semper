// Itens ligados a um cadastro, cada um num quadrinho que abre o item ligado: os contratos no cartão da pessoa, as partes
// no cartão do contrato, os vínculos entre pessoas e, quando existirem, demandas, tarefas, processos... Peça comum:
// toda ligação entre partes do sistema aparece assim, em todos os módulos.
import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Nota, Selo } from './base';

export interface ItemLigado {
  id: string;
  /** Endereço que abre o item (ex.: /contratos/?id=...). */
  para?: string;
  /** Ou o que abre o item sem trocar de endereço (ex.: o cartão de outra pessoa, no cartão de uma pessoa). */
  aoAbrir?: () => void;
  /** Em cima, pequeno: o número do contrato, o código da pessoa, o tipo do vínculo... */
  codigo?: string;
  titulo: string;
  /** Embaixo: o papel no item e a situação dele (ex.: "Cliente · Em negociação", "Participante · 10%"). */
  detalhe?: string;
  /** Selo de arquivo (ex.: "Arquivado", "Arquivada"). */
  selo?: string;
  /** Botão ao lado do quadrinho (ex.: retirar o vínculo). */
  acao?: ReactNode;
}

function Quadrinho({ item: i }: { item: ItemLigado }) {
  const corpo = <>
    {(i.codigo || i.selo) && <span className="item-ligado-topo">{i.codigo && <span className="codigo">{i.codigo}</span>}{i.selo && <Selo tipo="arq">{i.selo}</Selo>}</span>}
    <b>{i.titulo}</b>
    {i.detalhe && <small>{i.detalhe}</small>}
  </>;
  if (i.para) return <Link className="item-ligado" to={i.para}>{corpo}</Link>;
  if (i.aoAbrir) return <button type="button" className="item-ligado" onClick={i.aoAbrir}>{corpo}</button>;
  return <div className="item-ligado">{corpo}</div>;
}

/** O atalho para criar um item já ligado a este cartão (ex.: "Nova demanda deste contrato"). */
export interface NovoLigado { para: string; rotulo: string }

/** Se quem está no cartão pode criar itens ligados a ele (#376). Fora de um cartão, pode: cada seção decide. */
const PodeCriar = createContext(true);

/**
 * Em volta do corpo do cartão (#376): com `pode={false}` (o cartão arquivado, ou quem só lê), nenhum atalho para criar ou ligar um
 * item aparece nas seções de dentro: nem o "+" nem a corrente do título (`<Recolhivel>`). Uma regra só, para nenhuma seção esquecer
 * o caso.
 */
export function CriarNoCartao({ pode, children }: { pode: boolean; children: ReactNode }) {
  return <PodeCriar.Provider value={pode}>{children}</PodeCriar.Provider>;
}

/** O atalho, se o cartão deixa criar (veja CriarNoCartao); senão, nada. */
export function useNovoNoCartao<T>(novo: T | undefined): T | undefined {
  return useContext(PodeCriar) ? novo : undefined;
}

/**
 * A lista de quadrinhos; sem itens, o texto de vazio. Os atalhos de ligar e de criar ficam só no título da seção (#427: a corrente
 * e o "+" do `<Recolhivel>`), e não ao lado da lista.
 */
export function ItensLigados({ itens, vazio, rotulo }: { itens: ItemLigado[]; vazio?: string; /** Nome da lista para o leitor de tela. */ rotulo?: string }) {
  if (!itens.length) return vazio ? <Nota>{vazio}</Nota> : null;
  return <ul className="itens-ligados" aria-label={rotulo}>{itens.map(i => <li key={i.id}><Quadrinho item={i} />{i.acao}</li>)}</ul>;
}

/**
 * Embaixo da lista de uma seção do cartão (#341): onde abre a busca de ligar um item que já existe, pedida pela corrente do título
 * (#427). A busca aberta ocupa a linha toda; fechada, a linha não ocupa espaço (o estilo esconde a linha vazia).
 */
export function AcoesDosLigados({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="ligados-acoes">{children}</div>;
}
