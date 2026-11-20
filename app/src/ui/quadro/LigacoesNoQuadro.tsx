// O código do cartão no quadro e as ligações dele (#300): em vez de "demanda D3A1F09C · contrato MA96-0001-2026", o ícone de
// cada tipo (os do menu, de ui/Icone) seguido só do código. O ícone e o código formam uma imagem com nome ("Demanda D3A1F09C"),
// que é também a dica ao passar o mouse. Peça comum: todo quadro que mostra ligações na miniatura do cartão usa esta. Na tabela,
// as ligações continuam por extenso (ligacoesPorExtenso, em regras/ligacoesDoItem).
import { ligacoesComCodigo, nomeDaLigacao, type LigacaoDoItem, type ModuloLigado } from '../../regras/ligacoesDoItem';
import { Icone, type NomeIcone } from '../Icone';

/** O ícone de cada tipo de ligação: o mesmo do módulo no menu. Módulo novo = uma entrada nova. */
export const ICONE_DA_LIGACAO: Record<ModuloLigado, NomeIcone> = {
  pessoas: 'pessoas',
  contratos: 'contratos',
  demandas: 'demandas',
  tarefas: 'tarefas',
  processos: 'processos',
  compromissos: 'calendario',
  anotacoes: 'documentos'
};

/** Tamanho do ícone da ligação, em px: um pouco maior que a letra do código (12px), para o desenho não sumir. */
const TAMANHO_DO_ICONE = 14;

export function LigacoesNoQuadro({ codigo, ligacoes }: { /** O código do próprio cartão, antes das ligações. */ codigo?: string | null; ligacoes: readonly LigacaoDoItem[] }) {
  const existentes = ligacoesComCodigo(ligacoes);
  if (!codigo && !existentes.length) return null;
  return <span className="codigo codigo-no-quadro">
    {codigo && <span>{codigo}</span>}
    {existentes.map(l => {
      const nome = nomeDaLigacao(l);
      return <span key={l.modulo} className="ligacao-no-quadro" role="img" aria-label={nome} title={nome}>
        <Icone nome={ICONE_DA_LIGACAO[l.modulo]} tam={TAMANHO_DO_ICONE} />{l.codigo}
      </span>;
    })}
  </span>;
}
