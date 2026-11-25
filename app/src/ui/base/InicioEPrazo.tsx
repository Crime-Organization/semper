// O início e o prazo de tarefas e demandas no cartão (#422): no cartão da demanda, o resumo curto ("Início 20/11/2026 · Entrega
// 15/12/2030 às 14:00", com o sino do lembrete embaixo, quando marcado); quem pode alterar clica e muda os dois na janela das datas
// (DatasDoCartao), com o calendário, a hora e o lembrete. As conferências são as do cadastro, e o que se grava fica em
// regras/datasNoCartao.ts; tirar a entrega tira o prazo, a hora e o lembrete juntos.
// A configuração da janela (os nomes, o início, a entrega com a hora e o lembrete, o rascunho e a conferência) fica em
// janelaDoInicioEPrazo, num lugar só: o cartão da tarefa (#442) abre a mesma janela pela folhinha do prazo (PrazoNaFolhinha).
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
/** O nome da entrega em cima do campo, na janela (#431: "Data de início" e "Data de entrega", como no modelo). */
const ROTULO_DA_ENTREGA = 'Data de entrega';

/** O que a janela do início e do prazo precisa saber do cartão. */
export interface DoInicioEPrazo {
  /** O nome do prazo (ex.: "Prazo", "Prazo de entrega"): o nome do campo da entrega, na janela. */
  nomeDoPrazo: string;
  valor: InicioEPrazoGravados;
  /** As conferências do prazo, da hora e do lembrete, pelas regras do cadastro da tarefa ou da demanda. */
  conferirPrazo: (c: CamposDoPrazo) => ErrosDosCampos<keyof CamposDoPrazo>;
  /** Quem pode alterar recebe o início e o prazo novos, já conferidos. Sem isto, as datas só se leem. */
  aoSalvar?: (g: Required<InicioEPrazoGravados>) => unknown;
}

/**
 * As props da janela das datas (DatasDoCartao) para o início e o prazo, sem o que aparece no cartão (o "lido"): o nome, o título,
 * o resumo por extenso (para o leitor de tela), o início, a entrega com a hora e o lembrete, o rascunho, a conferência e o salvar.
 */
export function janelaDoInicioEPrazo({ nomeDoPrazo, valor, conferirPrazo, aoSalvar }: DoInicioEPrazo) {
  const marcado = !!valor.prazo && valor.lembrete !== null && valor.lembrete !== undefined;
  return {
    nome: NOME_DAS_DATAS, titulo: MUDAR_AS_DATAS,
    resumo: resumoDasDatas(resumoDoInicioEPrazo(valor)) + (marcado ? `, lembrete: ${lembreteDoPrazo(valor)!.toLowerCase()}` : ''),
    inicio: { rotulo: ROTULO_DO_INICIO, nome: ROTULO_DO_INICIO },
    entrega: { rotulo: ROTULO_DA_ENTREGA, nome: nomeDoPrazo, opcional: true, hora: { rotulo: `Hora do ${nomeDoPrazo.toLowerCase()}` }, lembrete: true },
    inicial: () => datasDoPrazo(valor),
    conferir: (c: Parameters<typeof errosDasDatasDoPrazo>[0]) => errosDasDatasDoPrazo(c, erroDaDataDeInicio, conferirPrazo),
    aoSalvar: aoSalvar && ((c: Parameters<typeof datasDoPrazoAoGravar>[0]) => aoSalvar(datasDoPrazoAoGravar(c)))
  };
}

interface Props extends DoInicioEPrazo {
  /** A linha que as datas oferecem ao menu "Acrescentar ao cartão" (#399). */
  atalho?: TipoDeAtalho;
}

export function InicioEPrazo({ atalho, ...datas }: Props) {
  const { valor } = datas;
  const marcado = !!valor.prazo && valor.lembrete !== null && valor.lembrete !== undefined, lembrete = lembreteDoPrazo(valor);
  const lido = <>
    <ResumoDasDatas pedacos={resumoDoInicioEPrazo(valor)} />
    {marcado && <span className="dado-lembrete"><Icone nome="sino" tam={TAMANHO_DO_SINO} /><span className="sr">Lembrete: </span>{lembrete}</span>}
  </>;
  return <DatasDoCartao {...janelaDoInicioEPrazo(datas)} lido={lido} atalho={atalho} />;
}
