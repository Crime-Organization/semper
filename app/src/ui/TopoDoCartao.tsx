// O topo dos cartões de item (#382, pedido do dono de 19/11: "simples igual o das anotações"), igual em demanda, tarefa,
// processo, compromisso, contrato e pessoa: numa linha só, à esquerda o tipo, o código e os selos do item; à direita a equipe em
// bolinhas (com os grupos e o "+"), e, junto dos botões da janela (NoTopoDoCartao), o ícone de etiqueta (abre a escolha), o lápis
// (verde) e o menu ⋯ (Arquivar ou Desarquivar e, no arquivado e para quem pode, Excluir). O ⋯ fica sempre por último, encostado
// no formato e no X, como na anotação. Logo abaixo, os selos das etiquetas (sem etiquetas, a linha some); depois, o título, que o
// cartão põe. Em edição (o lápis aberto), no lugar dos botões fica "Modo de edição", a equipe some (o formulário tem os campos
// dela) e os selos ficam sem o x.
// A faixa do item arquivado (FaixaDoArquivado), no corpo do cartão, diz onde está o Excluir e traz o Desarquivar à vista: é o que
// se faz ao abrir um arquivado (também está no ⋯).
// O que cada módulo diz (o nome do ⋯, "a tarefa", a faixa) vem de regras/topoDoCartao.ts.
import type { ReactNode } from 'react';
import { faixaDoArquivado, TOPO_DO_CARTAO, type ModuloDoTopo } from '../regras/topoDoCartao';
import { LapisDoCartao, MenuDoCartao, ModoDeEdicao, NoTopoDoCartao } from './AcoesDoCartao';
import { Botao } from './Botoes';
import { BotaoDasEtiquetas, SelosDasEtiquetas, useEtiquetasDoCartao } from './Etiquetas';
import { Icone, ICONE_DO_TOPO } from './Icone';

/** O nome do ícone de etiqueta do topo (e a dica dele): diz o que ele faz, e não se confunde com os selos ("Etiquetas"). */
export const ESCOLHER_ETIQUETAS = 'Escolher etiquetas';
/** O nome da linha dos selos das etiquetas, para o leitor de tela. */
export const SELOS_DAS_ETIQUETAS = 'Etiquetas';
/** O tamanho do ícone do Desarquivar da faixa (o dos botões pequenos). */
const ICONE_DA_FAIXA = 15;

interface Props {
  modulo: ModuloDoTopo;
  id: string;
  /** À esquerda: o tipo, o código e os selos do item (prazo, órgão, "Arquivada"…). */
  esquerda: ReactNode;
  /** A equipe em bolinhas (EquipeNoTopo, EquipeDoContratoNoTopo). Sem isto (a pessoa), nada. */
  equipe?: ReactNode;
  arquivado: boolean;
  /** Em edição: "Modo de edição" no lugar dos botões, sem a equipe, e os selos sem o x. */
  editando?: boolean;
  /** Quem muda as etiquetas (as mesmas regras de antes, da seção "Etiquetas"): o ícone e o x dos selos. */
  mudaEtiquetas: boolean;
  /** Uma etiqueta mudou de cor ou de texto: a lista da página relê. */
  aoMudarEtiquetas?: () => void;
  /** Arquivar e Desarquivar, no ⋯, para quem altera o cartão. */
  aoArquivar?: () => unknown;
  /** Excluir, no ⋯ do arquivado, para quem pode (pergunta antes). */
  aoExcluir?: () => unknown;
  /** O lápis (só com o item ativo): o nome ("Editar", "Editar sem os valores") e o que faz. */
  lapis?: { rotulo: string; aoEditar: () => void };
}

export function TopoDoCartao({ modulo, id, esquerda, equipe, arquivado, editando = false, mudaEtiquetas, aoMudarEtiquetas, aoArquivar, aoExcluir, lapis }: Props) {
  const etiquetas = useEtiquetasDoCartao(modulo, id);
  const textos = TOPO_DO_CARTAO[modulo];
  const muda = mudaEtiquetas && !editando;
  return <>
    <div className="cartao-topo">
      <div className="cartao-topo-esquerda">{esquerda}</div>
      <div className="cartao-topo-direita">
        {!editando && equipe}
        <NoTopoDoCartao>
          {editando ? <ModoDeEdicao /> : <>
            {muda && <BotaoDasEtiquetas ids={etiquetas.ids} aoMarcar={etiquetas.marcar} aoMudar={aoMudarEtiquetas} rotulo={ESCOLHER_ETIQUETAS} className="cartao-botao" comDica>
              <Icone nome="etiqueta" tam={ICONE_DO_TOPO} />
            </BotaoDasEtiquetas>}
            {lapis && !arquivado && <LapisDoCartao rotulo={lapis.rotulo} aoEditar={lapis.aoEditar} />}
            <MenuDoCartao rotulo={textos.menu} arquivado={arquivado} aoArquivar={aoArquivar}
              excluir={aoExcluir ? { oQue: textos.oQue, aoConfirmar: aoExcluir } : undefined} />
          </>}
        </NoTopoDoCartao>
      </div>
    </div>
    <SelosDasEtiquetas ids={etiquetas.ids} rotulo={SELOS_DAS_ETIQUETAS} aoTirar={muda ? e => etiquetas.marcar(e, false) : undefined} />
  </>;
}

interface PropsDaFaixa {
  modulo: ModuloDoTopo;
  /** Quem abre pode excluir o item (pelo ⋯): a faixa diz onde; senão, diz quem pode. */
  podeExcluir: boolean;
  /** Para quem altera o cartão: o Desarquivar à vista, na própria faixa. */
  aoDesarquivar?: () => unknown;
}

/** A faixa tracejada do item arquivado, logo abaixo do topo: o que vale para ele e, para quem altera, o Desarquivar. */
export function FaixaDoArquivado({ modulo, podeExcluir, aoDesarquivar }: PropsDaFaixa) {
  return <div className="cartao-arquivada">
    <span>{faixaDoArquivado(modulo, podeExcluir)}</span>
    {aoDesarquivar && <Botao pequeno ocupadoTexto="Desarquivando…" onClick={aoDesarquivar}><Icone nome="arquivoAberto" tam={ICONE_DA_FAIXA} />Desarquivar</Botao>}
  </div>;
}
