// O topo dos cartões de item (#382, pedido do dono de 19/11: "simples igual o das anotações"), igual em demanda, tarefa,
// processo, compromisso, contrato, pessoa e na própria anotação (a aberta e a nova): no alto, à esquerda o tipo, o código e os
// selos do item (na anotação, o caminho da pasta); à direita a equipe em bolinhas (com os grupos e o "+"), e, junto dos botões da
// janela (NoTopoDoCartao), o ícone de etiqueta (abre a escolha), o "+" redondo "Acrescentar ao cartão" (#399: o menu com o que o
// cartão tem e o que se acrescenta), o lápis (verde) e o menu ⋯ (as ações a mais, Arquivar ou Desarquivar e, no arquivado e para
// quem pode, Excluir). O ⋯ fica sempre por último. O "+" fica logo depois da etiqueta: os dois
// acrescentam ao cartão, o lápis muda o que já está nele e o ⋯ tem o resto; e a etiqueta fica entre ele e o "+" tracejado da equipe,
// e os dois "+" nunca se encostam. Logo abaixo da linha de cima, a linha da
// Situação (SituacaoDoCartao, #397: o rótulo, o menu largo e, na tarefa e na demanda, o ✓ Concluir; em edição, ela some); depois,
// os selos das etiquetas (sem etiquetas, a linha some); depois, o título, que o cartão põe (a ordem da cabeça toda está em
// CabecaDoCartao). Em edição (o lápis aberto), no lugar dos botões fica "Modo de edição", a equipe some (o formulário tem os
// campos dela) e os selos ficam sem o x. Os botões da janela (abrir ao lado / no centro e o X) não são do topo: no centro largo,
// ficam no alto da coluna da direita (PainelCartao, #397); ao lado, na janela estreita e no celular, por cima da linha de cima.
// Como fica no lugar (veja .cartao-topo em estilo.css): o começo da esquerda (o tipo; na anotação, o caminho) fica sempre no canto
// de cima, à esquerda; a direita, no canto de cima, à direita; o resto da esquerda (o código e os selos) corre entre os dois e
// embaixo, como um texto. No centro largo, com os botões do cartão nela, a direita vem antes no código e nunca sai do canto; ao
// lado, com os botões na linha dos da janela, ela vem logo depois do tipo, e a equipe fica na linha dele e dos botões sempre que
// cabe, como na anotação.
// O desenho é um só (MoldeDoTopo); TopoDoCartao lê as etiquetas gravadas do item e põe o lápis e o ⋯ dos seis cartões.
// A faixa do item arquivado (FaixaDoArquivado), no corpo do cartão, diz onde está o Excluir e traz o Desarquivar à vista: é o que
// se faz ao abrir um arquivado (também está no ⋯). Desarquivado por ela, o foco vai para o ⋯ (a faixa some com o botão).
// O que cada módulo diz (o nome do ⋯, "a tarefa", a faixa) vem de regras/topoDoCartao.ts.
import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { AcrescentarAoCartao } from './AcrescentarAoCartao';
import type { Etiqueta } from '../dados';
import { faixaDoArquivado, TOPO_DO_CARTAO, type ModuloDoTopo } from '../regras/topoDoCartao';
import { LapisDoCartao, MenuDoCartao, ModoDeEdicao, NoTopoDoCartao, type AcaoDoTopo } from './AcoesDoCartao';
import { Botao } from './Botoes';
import { BotaoDasEtiquetas, SelosDasEtiquetas, useEtiquetasDoCartao } from './Etiquetas';
import { Icone, ICONE_DO_TOPO } from './Icone';
import { BotoesNoPainel } from './PainelCartao';

/** O nome do ícone de etiqueta do topo (e a dica dele): diz o que ele faz, e não se confunde com os selos ("Etiquetas"). */
export const ESCOLHER_ETIQUETAS = 'Escolher etiquetas';
/** O nome da linha dos selos das etiquetas, para o leitor de tela. */
export const SELOS_DAS_ETIQUETAS = 'Etiquetas';
/** O tamanho do ícone do Desarquivar da faixa (o dos botões pequenos). */
const ICONE_DA_FAIXA = 15;

interface PropsDoMolde {
  /** O começo da esquerda, sempre no canto de cima: o tipo do item; na anotação, o caminho da pasta. */
  inicio: ReactNode;
  /** O resto da esquerda: o código e os selos do item (prazo, órgão, "Arquivada"…). */
  esquerda?: ReactNode;
  /** À direita, antes dos botões: a equipe em bolinhas (EquipeNoTopo, EquipeDoContratoNoTopo; na pessoa, EquipeDaPessoaNoTopo). */
  equipe?: ReactNode;
  /** As etiquetas do item: as gravadas (useEtiquetasDoCartao) ou, na anotação nova, as escolhidas na tela. */
  etiquetas: { ids: string[]; marcar: (e: Etiqueta, marcada: boolean) => void };
  /** Quem muda as etiquetas: o ícone e o x dos selos. */
  mudaEtiquetas: boolean;
  /** Uma etiqueta mudou de cor ou de texto: a lista da página relê. */
  aoMudarEtiquetas?: () => void;
  /** Em edição: "Modo de edição" no lugar dos botões, sem a equipe, e os selos sem o x. */
  editando?: boolean;
  /** Depois do ícone de etiqueta, junto dos botões da janela: o lápis e o ⋯. */
  botoes?: ReactNode;
  /** Logo abaixo da linha de cima, numa linha própria: a Situação do cartão (SituacaoDoCartao, #397). Some em edição. */
  situacao?: ReactNode;
}

/** O desenho do topo, igual em todos os cartões com etiquetas (veja o comentário do arquivo). */
export function MoldeDoTopo({ inicio, esquerda, equipe, etiquetas, mudaEtiquetas, aoMudarEtiquetas, editando = false, botoes, situacao }: PropsDoMolde) {
  const muda = mudaEtiquetas && !editando;
  // Os botões do cartão vão para a linha dos botões da janela (ao lado, na janela estreita): o tipo vem antes, e a equipe flutua
  // logo depois dele (na linha dele, se couber). No centro largo, os botões ficam aqui: a direita vem antes, no canto de cima.
  const botoesNaJanela = !!useContext(BotoesNoPainel);
  const direita = <div key="direita" className="cartao-topo-direita">
    {!editando && equipe}
    <NoTopoDoCartao>
      {editando ? <ModoDeEdicao /> : <>
        {muda && <BotaoDasEtiquetas ids={etiquetas.ids} aoMarcar={etiquetas.marcar} aoMudar={aoMudarEtiquetas} rotulo={ESCOLHER_ETIQUETAS} className="cartao-botao" comDica>
          <Icone nome="etiqueta" tam={ICONE_DO_TOPO} />
        </BotaoDasEtiquetas>}
        <AcrescentarAoCartao />
        {botoes}
      </>}
    </NoTopoDoCartao>
  </div>;
  const noComeco = <div key="inicio" className="cartao-topo-inicio">{inicio}</div>;
  return <>
    <div className="cartao-topo">
      {/* Com as chaves, trocar a ordem (a janela foi para o centro ou para o lado) só move as caixas: a equipe não recomeça. */}
      {botoesNaJanela ? [noComeco, direita] : [direita, noComeco]}
      <div className="cartao-topo-esquerda">{esquerda}</div>
    </div>
    {!editando && situacao}
    <SelosDasEtiquetas ids={etiquetas.ids} rotulo={SELOS_DAS_ETIQUETAS} aoTirar={muda ? e => etiquetas.marcar(e, false) : undefined} />
  </>;
}

interface Props {
  modulo: ModuloDoTopo;
  id: string;
  /** O começo da esquerda, sempre no canto de cima: o tipo do item. */
  inicio: ReactNode;
  /** O resto da esquerda: o código e os selos do item (prazo, órgão, "Arquivada"…). */
  esquerda?: ReactNode;
  /** A equipe em bolinhas (EquipeNoTopo, EquipeDoContratoNoTopo; na pessoa, os responsáveis: EquipeDaPessoaNoTopo). */
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
  /** A Situação do cartão, numa linha própria logo abaixo da linha de cima (#397). Some em edição. */
  situacao?: ReactNode;
  /** As ações a mais no ⋯, antes de Arquivar (na pessoa, "Convidar para a equipe", #327). */
  extras?: AcaoDoTopo[];
}

export function TopoDoCartao({ modulo, id, inicio, esquerda, equipe, arquivado, editando = false, mudaEtiquetas, aoMudarEtiquetas, aoArquivar, aoExcluir, lapis, situacao, extras }: Props) {
  const etiquetas = useEtiquetasDoCartao(modulo, id);
  const textos = TOPO_DO_CARTAO[modulo];
  const menu = useFocoAoDesarquivar(arquivado);
  return <MoldeDoTopo inicio={inicio} esquerda={esquerda} equipe={equipe} etiquetas={etiquetas} mudaEtiquetas={mudaEtiquetas} aoMudarEtiquetas={aoMudarEtiquetas}
    editando={editando} situacao={situacao} botoes={<>
      {lapis && !arquivado && <LapisDoCartao rotulo={lapis.rotulo} aoEditar={lapis.aoEditar} />}
      <MenuDoCartao rotulo={textos.menu} arquivado={arquivado} aoArquivar={aoArquivar} refDoBotao={menu} extras={extras}
        excluir={aoExcluir ? { oQue: textos.oQue, aoConfirmar: aoExcluir } : undefined} />
    </>} />;
}

/**
 * O item voltou do arquivo e o foco ficou sem lugar (o Desarquivar da faixa sumiu com ela): o foco vai para o ⋯, onde está o
 * Arquivar de novo, e quem usa o teclado não volta ao começo da página. Devolve o ref para o ⋯.
 */
export function useFocoAoDesarquivar(arquivado: boolean) {
  const menu = useRef<HTMLButtonElement>(null);
  const estava = useRef(arquivado);
  useEffect(() => {
    const semFoco = !document.activeElement || document.activeElement === document.body;
    if (estava.current && !arquivado && semFoco) menu.current?.focus();
    estava.current = arquivado;
  }, [arquivado]);
  return menu;
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
