// Itens ligados a um cadastro, cada um num quadrinho que abre o item ligado: os contratos no cartão da pessoa, as partes
// no cartão do contrato, os vínculos entre pessoas e, quando existirem, demandas, tarefas, processos... Peça comum:
// toda ligação entre partes do sistema aparece assim, em todos os módulos.
import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BotaoLink, Nota, Selo } from './base';
import { Icone } from './Icone';

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
 * Em volta do corpo do cartão (#376): com `pode={false}` (o cartão arquivado, ou quem só lê), nenhum atalho para criar um item
 * ligado aparece nas seções de dentro: nem o "+" do título (`<Recolhivel>`), nem o "+ Novo …" de baixo (`<AcoesDosLigados>`),
 * nem o "+" ao lado da lista (`<ItensLigados>`). Uma regra só, para nenhuma seção esquecer o caso.
 */
export function CriarNoCartao({ pode, children }: { pode: boolean; children: ReactNode }) {
  return <PodeCriar.Provider value={pode}>{children}</PodeCriar.Provider>;
}

/** O atalho, se o cartão deixa criar (veja CriarNoCartao); senão, nada. */
export function useNovoNoCartao(novo: NovoLigado | undefined): NovoLigado | undefined {
  return useContext(PodeCriar) ? novo : undefined;
}

/**
 * A lista de quadrinhos. Com "novo": se há itens, só um "+" redondo à direita da lista (o nome do atalho fica na dica e
 * para o leitor de tela); se não há, o texto de vazio à esquerda e o botão com o nome à direita, na mesma linha.
 */
export function ItensLigados({ itens, vazio, novo: pedido, rotulo }: { itens: ItemLigado[]; vazio?: string; novo?: NovoLigado; /** Nome da lista para o leitor de tela. */ rotulo?: string }) {
  const novo = useNovoNoCartao(pedido);
  if (!itens.length) {
    if (!novo) return vazio ? <Nota>{vazio}</Nota> : null;
    return <div className="ligados-vazio">
      {vazio && <Nota>{vazio}</Nota>}
      <BotaoLink forma="mini" to={novo.para}><Icone nome="mais" tam={13} /> {novo.rotulo}</BotaoLink>
    </div>;
  }
  const lista = <ul className="itens-ligados" aria-label={rotulo}>{itens.map(i => <li key={i.id}><Quadrinho item={i} />{i.acao}</li>)}</ul>;
  if (!novo) return lista;
  return <div className="ligados-com-novo">
    {lista}
    <BotaoLink forma="mini" className="ligados-novo" to={novo.para} aria-label={novo.rotulo} title={novo.rotulo}><Icone nome="mais" tam={16} /></BotaoLink>
  </div>;
}

/**
 * Embaixo da lista de uma seção do cartão (#341): os botões de ligar um item que já existe e, ao lado, o atalho para criar um novo já
 * ligado, como nos processos do contrato e da demanda. A busca aberta ocupa a linha toda.
 */
export function AcoesDosLigados({ children, novo: pedido }: { children?: ReactNode; novo?: NovoLigado }) {
  const novo = useNovoNoCartao(pedido);
  // Sem nada para mostrar (o cartão arquivado, onde a seção só tinha o "+ Novo …"), nem o espaço da linha fica.
  if (!children && !novo) return null;
  return <div className="ligados-acoes">
    {children}
    {novo && <BotaoLink forma="mini" to={novo.para}><Icone nome="mais" tam={13} /> {novo.rotulo}</BotaoLink>}
  </div>;
}
