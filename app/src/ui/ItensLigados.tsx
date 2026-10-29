// Itens ligados a um cadastro, cada um num quadrinho que abre o item ligado: os contratos no cartão da pessoa, as partes
// no cartão do contrato, os vínculos entre pessoas e, quando existirem, demandas, tarefas, processos... Peça comum:
// toda ligação entre partes do sistema aparece assim, em todos os módulos.
import type { ReactNode } from 'react';
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

export function ItensLigados({ itens, vazio }: { itens: ItemLigado[]; vazio?: string }) {
  if (!itens.length) return vazio ? <Nota>{vazio}</Nota> : null;
  return <ul className="itens-ligados">{itens.map(i => <li key={i.id}><Quadrinho item={i} />{i.acao}</li>)}</ul>;
}
