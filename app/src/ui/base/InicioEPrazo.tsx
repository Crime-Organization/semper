// O início e o prazo de tarefas e demandas no cartão (#422): no cartão, o resumo curto ("Início 20/11/2026 · Entrega 15/12/2030 às
// 14:00", com o sino do lembrete embaixo, quando marcado); quem pode alterar clica e muda os dois na janela das datas
// (DatasDoCartao), com o calendário, a hora e o lembrete. As conferências são as do cadastro, e o que se grava fica em
// regras/datasNoCartao.ts; tirar a entrega tira o prazo, a hora e o lembrete juntos.
import type { TipoDeAtalho } from '../../regras/atalhosDoCartao';
import { ROTULO_DO_INICIO, erroDaDataDeInicio } from '../../regras/dataDeInicio';
import {
  datasDoPrazo, datasDoPrazoAoGravar, errosDasDatasDoPrazo, lembreteDoPrazo, resumoDoInicioEPrazo, type CamposDoPrazo, type ErrosDosCampos,
  type InicioEPrazoGravados
} from '../../regras/datasNoCartao';
import { resumoDasDatas } from '../../regras/janelaDasDatas';
import { Icone } from '../Icone';
import { DatasDoCartao, ResumoDasDatas } from './JanelaDasDatas';

/** O tamanho do sino, ao lado do lembrete. */
const TAMANHO_DO_SINO = 14;
/** O nome das datas no cartão e o da janela. */
export const NOME_DAS_DATAS = 'Datas', MUDAR_AS_DATAS = 'Mudar as datas';

interface Props {
  /** O nome do prazo (ex.: "Prazo", "Prazo de entrega"): o nome do campo da entrega, na janela. */
  nomeDoPrazo: string;
  valor: InicioEPrazoGravados;
  /** As conferências do prazo, da hora e do lembrete, pelas regras do cadastro da tarefa ou da demanda. */
  conferirPrazo: (c: CamposDoPrazo) => ErrosDosCampos<keyof CamposDoPrazo>;
  /** Quem pode alterar recebe o início e o prazo novos, já conferidos. Sem isto, as datas só se leem. */
  aoSalvar?: (g: Required<InicioEPrazoGravados>) => unknown;
  /** A linha que as datas oferecem ao menu "Acrescentar ao cartão" (#399). */
  atalho?: TipoDeAtalho;
}

export function InicioEPrazo({ nomeDoPrazo, valor, conferirPrazo, aoSalvar, atalho }: Props) {
  const pedacos = resumoDoInicioEPrazo(valor);
  const marcado = !!valor.prazo && valor.lembrete !== null && valor.lembrete !== undefined, lembrete = lembreteDoPrazo(valor);
  const lido = <>
    <ResumoDasDatas pedacos={pedacos} />
    {marcado && <span className="dado-lembrete"><Icone nome="sino" tam={TAMANHO_DO_SINO} /><span className="sr">Lembrete: </span>{lembrete}</span>}
  </>;
  const resumo = resumoDasDatas(pedacos) + (marcado ? `, lembrete: ${lembrete!.toLowerCase()}` : '');
  return <DatasDoCartao nome={NOME_DAS_DATAS} titulo={MUDAR_AS_DATAS} resumo={resumo} lido={lido} atalho={atalho}
    inicio={{ rotulo: 'Início', nome: ROTULO_DO_INICIO }}
    entrega={{ rotulo: 'Entrega', nome: nomeDoPrazo, opcional: true, hora: { rotulo: `Hora do ${nomeDoPrazo.toLowerCase()}` }, lembrete: true }}
    inicial={() => datasDoPrazo(valor)} conferir={c => errosDasDatasDoPrazo(c, erroDaDataDeInicio, conferirPrazo)}
    aoSalvar={aoSalvar && (c => aoSalvar(datasDoPrazoAoGravar(c)))} />;
}
