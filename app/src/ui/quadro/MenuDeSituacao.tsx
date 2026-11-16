// O menu "Situação" do cartão (tarefa, demanda, contrato, processo, compromisso): as colunas do quadro na ordem da tela,
// com o nome do grupo na frente quando a coluna está num grupo (#302). Todo cartão com quadro usa esta peça.
import type { Quadro } from './useColunas';

interface Props {
  /** O nome do menu para quem usa leitor de tela, ex.: "Situação da tarefa". */
  rotulo: string;
  quadro: Pick<Quadro, 'situacoes'>;
  /** A coluna em que o cartão está (null: sem situação). */
  valor: string | null;
  /** O texto da opção sem coluna, ex.: "Sem situação". */
  semSituacao: string;
  desabilitado?: boolean;
  /** Recebe a coluna escolhida ('' para sem situação). */
  aoMudar: (etapa: string) => void;
}

export function MenuDeSituacao({ rotulo, quadro, valor, semSituacao, desabilitado, aoMudar }: Props) {
  return <select aria-label={rotulo} disabled={desabilitado} value={valor || ''} onChange={e => aoMudar(e.target.value)}>
    <option value="">{semSituacao}</option>
    {quadro.situacoes.map(({ coluna, rotulo: nome }) =>
      <option key={coluna.id} value={coluna.id}>{nome}{coluna.oculta ? ' (oculta para você)' : ''}</option>)}
  </select>;
}
