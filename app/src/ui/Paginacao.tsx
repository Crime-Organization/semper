// Pé da tabela de um módulo: "Mostrando 1–50 de 120" e os botões Anterior e Próxima.
import { estiloBotao } from './base';
import { numero } from './util';

interface Props {
  /** Página atual, a partir de 0. */
  pagina: number;
  porPagina: number;
  /** Quantos itens a página atual mostra. */
  naPagina: number;
  total: number;
  aoPaginar: (pagina: number) => void;
}

export function Paginacao({ pagina, porPagina, naPagina, total, aoPaginar }: Props) {
  const de = pagina * porPagina + 1, ate = pagina * porPagina + naPagina;
  return <div className="paginacao" style={{ marginTop: 12 }}>
    <span>Mostrando {numero(de)}–{numero(ate)} de {numero(total)}</span>
    <span style={{ display: 'flex', gap: 8 }}>
      <button type="button" className={estiloBotao({ forma: 'mini' })} disabled={pagina === 0} onClick={() => aoPaginar(pagina - 1)}>Anterior</button>
      <button type="button" className={estiloBotao({ forma: 'mini' })} disabled={ate >= total} onClick={() => aoPaginar(pagina + 1)}>Próxima</button>
    </span>
  </div>;
}
