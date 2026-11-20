// A "Situação" do cartão (processo, demanda, tarefa, contrato, compromisso; na pessoa, a "Etapa do atendimento"), desde a #351 num
// menu compacto no topo do cartão, como a lista do cartão do Trello: uma pílula com o ícone do quadro, o nome da coluna e a seta, sem
// título nem linha própria (o nome, "Situação", vai na dica e no rótulo do menu, para o leitor de tela). O cartão a põe no topo
// (MoldeDoTopo, `situacao`), depois do código e dos selos; em edição (o lápis aberto), ela some, como antes. Ao lado da pílula
// fica o que vai com ela (`acao`, como o Concluir e o Reabrir da tarefa).
// O "Expandir tudo" das seções, que ficava na linha da Situação (#389), foi para a linha dos botões rápidos (AtalhosDoCartao), no
// mesmo eixo das setas e do X (#381).
import type { ReactNode } from 'react';
import { Icone } from '../Icone';

/** O tamanho dos ícones dentro da pílula (o do quadro, à esquerda, e a seta, à direita). */
const ICONE_DA_PILULA = 13;

interface Props {
  /** O nome da Situação, na dica da pílula (padrão: "Situação"; na pessoa, "Etapa do atendimento"). */
  titulo?: string;
  /** O menu da situação (ex.: MenuDeSituacao), com o nome dele para o leitor de tela. */
  children: ReactNode;
  /** O que fica ao lado da pílula (ex.: o Concluir da tarefa). */
  acao?: ReactNode;
}

export function SituacaoDoCartao({ titulo = 'Situação', children, acao }: Props) {
  return <span className="cartao-situacao">
    <span className="situacao-compacta" title={titulo}>
      <Icone nome="kanban" tam={ICONE_DA_PILULA} />
      {children}
      <span className="situacao-seta" aria-hidden="true"><Icone nome="abaixo" tam={ICONE_DA_PILULA} /></span>
    </span>
    {acao}
  </span>;
}
