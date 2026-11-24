// Uma data só do cartão, que pode ficar vazia (a assinatura do contrato, #357): no cartão, a data ("02/02/2026", ou o texto de
// quando não há); quem pode alterar clica e muda na janela das datas (#422, DatasDoCartao), com o calendário, a caixa de marcar e
// Salvar e Remover, como as datas da tarefa. Quem só lê vê a data comum.
import { isoDoTexto } from '../../regras/campoData';
import { datasDeUmaData, umaDataDasDatas } from '../../regras/datasNoCartao';
import { fmtData } from '../../regras/pessoa';
import { DatasDoCartao } from './JanelaDasDatas';

interface Props {
  /** O nome inteiro, para o leitor de tela e o campo (ex.: "Data da assinatura"). */
  nome: string;
  /** O nome curto, em cima do campo, na janela (ex.: "Assinado em"). */
  rotulo: string;
  /** A data gravada (aaaa-mm-dd), ou nada (ainda não há; ex.: o contrato ainda não assinado). */
  valor: string | null;
  /** Como a data aparece quando não há nenhuma (ex.: "Ainda não"). */
  semData?: string;
  /** Quem pode alterar recebe a data nova (aaaa-mm-dd; null quando foi tirada), só quando ela mudou. Sem isto, só se lê. */
  aoSalvar?: (iso: string | null) => unknown;
  /** O que a data escrita (dd/mm/aaaa) confere antes de salvar ('' = está certa). */
  conferir: (texto: string) => string;
}

export function DataEditavel({ nome, rotulo, valor, semData = '', aoSalvar, conferir }: Props) {
  const mostrado = valor ? fmtData(valor) : semData;
  return <DatasDoCartao nome={nome} titulo={`Mudar a ${nome.toLowerCase()}`} resumo={mostrado} lido={<b className="num">{mostrado}</b>}
    entrega={{ rotulo, nome, opcional: true }} inicial={() => datasDeUmaData(valor)}
    conferir={c => { const erro = conferir(umaDataDasDatas(c)); return erro ? { entrega: erro } : {}; }}
    aoSalvar={aoSalvar && (c => aoSalvar(isoDoTexto(umaDataDasDatas(c))))} />;
}
