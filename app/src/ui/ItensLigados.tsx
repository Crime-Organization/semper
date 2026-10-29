// Itens de outros módulos ligados a um cadastro: no cartão da pessoa, os contratos dela (e, quando existirem, as
// demandas, tarefas, processos...). Cada item é um link que abre o item no módulo dele. Peça comum: todo módulo
// novo mostra os seus itens no cartão da pessoa com ela.
import { Link } from 'react-router';
import { Nota, Selo } from './base';

export interface ItemLigado {
  id: string;
  /** Endereço que abre o item (ex.: /contratos/?id=...). */
  para: string;
  codigo: string;
  titulo: string;
  /** O papel da pessoa no item e a situação dele (ex.: "Cliente · Em negociação"). */
  detalhe: string;
  arquivado?: boolean;
}

export function ItensLigados({ itens, vazio }: { itens: ItemLigado[]; vazio: string }) {
  if (!itens.length) return <Nota>{vazio}</Nota>;
  return <ul className="itens-ligados">{itens.map(i => <li key={i.id}>
    <Link to={i.para}>
      <span className="item-ligado-topo"><span className="codigo">{i.codigo}</span>{i.arquivado && <Selo tipo="arq">Arquivado</Selo>}</span>
      <b>{i.titulo}</b>
      <small>{i.detalhe}</small>
    </Link>
  </li>)}</ul>;
}
