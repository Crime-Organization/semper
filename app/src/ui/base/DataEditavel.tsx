// Data que se muda no próprio lugar do cartão (#357), no jeito do título e da descrição (#346): quem pode alterar clica na data e
// muda ali mesmo. Serve à data de início de tarefas e demandas e à assinatura do contrato; o nome dela (ex.: "Início") fica em
// cima, na faixa das datas do cartão (DadoDoGrupo, #361). Quem só lê vê a data comum.
// Desde a #395, é o mesmo formulário pequeno do prazo e da data do compromisso (DadoEditavel): o campo de data abre no painel da
// faixa, com Cancelar e Salvar; escolher o dia ou escrever só muda o rascunho, Enter ou Salvar gravam, Esc desfaz, sair do campo não
// grava nada, e a data errada fica marcada no próprio campo, com a mensagem embaixo dele. O calendário abre quando a pessoa pede.
import { fmtData } from '../../regras/pessoa';
import { isoDoTexto } from '../../regras/campoData';
import { CampoData } from './CampoData';
import { DadoEditavel } from './GrupoDeDatas';

interface Props {
  /** O nome inteiro, para o leitor de tela e o campo (ex.: "Data de início"). */
  nome: string;
  /** A data gravada (aaaa-mm-dd), ou nada (ainda não há; ex.: o contrato ainda não assinado). */
  valor: string | null;
  /** Como a data aparece quando não há nenhuma (ex.: "Ainda não"). */
  semData?: string;
  /** Quem pode alterar recebe a data nova (aaaa-mm-dd; null quando a data pode ser apagada), só quando ela mudou. Sem isto, só se lê. */
  aoSalvar?: (iso: string | null) => unknown;
  /** O que a data escrita (dd/mm/aaaa) confere antes de salvar ('' = está certa). */
  conferir: (texto: string) => string;
  /** Avisa o cartão da data mudada e ainda não salva (para perguntar antes de fechar). */
  aoMudarRascunho?: (rascunho: string | null) => void;
}

/** O rascunho do formulário: a data como a pessoa escreve (dd/mm/aaaa). */
interface CamposDaData { data: string }

export function DataEditavel({ nome, valor, semData = '', aoSalvar, conferir, aoMudarRascunho }: Props) {
  const mostrado = valor ? fmtData(valor) : semData;
  return <DadoEditavel<CamposDaData> nome={nome} titulo={`Mudar a ${nome.toLowerCase()}`} resumo={mostrado} lido={<b className="num">{mostrado}</b>}
    inicial={() => ({ data: valor ? fmtData(valor) : '' })} conferir={({ data }) => { const erro = conferir(data); return erro ? { data: erro } : {}; }}
    aoSalvar={aoSalvar && (({ data }) => aoSalvar(isoDoTexto(data)))} aoMudarRascunho={aoMudarRascunho}
    campos={({ rascunho, mudar, marcar }) => <CampoData aria-label={nome} {...marcar('data')} className="data-editavel-campo" valor={rascunho.data}
      aoMudar={data => mudar({ data })} />} />;
}
