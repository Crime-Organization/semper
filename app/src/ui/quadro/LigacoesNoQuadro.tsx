// O código do cartão no quadro e as ligações dele (#300): em vez de "demanda D3A1F09C · contrato MA96-0001-2026", o ícone de
// cada tipo (os do menu, ICONE_DO_MODULO de ui/Icone) seguido só do código. O ícone e o código formam uma imagem com nome
// ("Demanda D3A1F09C"), que é também a dica da casa (propsDaDica) ao passar o mouse. Peça comum: todo quadro que mostra ligações
// na miniatura do cartão usa esta. Na tabela, as ligações continuam por extenso (ligacoesPorExtenso, em regras/ligacoesDoItem).
// Como as pílulas dos grupos no quadro, a ligação é só para ver, sem foco (o cartão do quadro é clicável e se arrasta): no toque e
// no teclado, a pessoa abre o cartão, que mostra cada ligação por extenso.
import { ligacoesComCodigo, nomeDaLigacao, type LigacaoDoItem } from '../../regras/ligacoesDoItem';
import { propsDaDica } from '../base';
import { Icone, ICONE_DO_MODULO, ICONE_NO_QUADRO } from '../Icone';

export function LigacoesNoQuadro({ codigo, ligacoes }: { /** O código do próprio cartão, antes das ligações. */ codigo?: string | null; ligacoes: readonly LigacaoDoItem[] }) {
  const existentes = ligacoesComCodigo(ligacoes);
  if (!codigo && !existentes.length) return null;
  return <span className="codigo codigo-no-quadro">
    {codigo && <span>{codigo}</span>}
    {existentes.map(l => {
      const nome = nomeDaLigacao(l);
      return <span key={l.modulo} className="ligacao-no-quadro" role="img" aria-label={nome} {...propsDaDica(nome)}>
        <Icone nome={ICONE_DO_MODULO[l.modulo]} tam={ICONE_NO_QUADRO} />{l.codigo}
      </span>;
    })}
  </span>;
}
