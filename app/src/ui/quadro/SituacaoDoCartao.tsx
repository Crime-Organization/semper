// A "Situação" do cartão (processo, demanda, tarefa, contrato, compromisso; na pessoa, a "Etapa do atendimento"). Desde a #397
// (pedido do dono de 20/11), numa linha própria, logo abaixo da linha de cima do cartão (MoldeDoTopo, `situacao`): à esquerda o
// rótulo pequeno com o ícone do quadro ("SITUAÇÃO", como os títulos das seções), depois o menu, largo, ocupando o espaço, e, à
// direita, o que vai com ela (`acao`: só onde existe concluir, a tarefa e a demanda, o botão redondo ✓, ConcluirNaSituacao).
// O rótulo é só para ver: o menu tem o nome dele ("Situação da tarefa"…) para o leitor de tela. Em edição (o lápis aberto), a
// linha some, como antes. Substitui o menu compacto na linha de cima (#351) e a Situação ao lado do "Expandir tudo" (#389): o
// "Expandir tudo" fica sozinho, acima da primeira seção (#394).
import type { CSSProperties, ReactNode } from 'react';
import { Icone, ICONE_DO_TITULO_DE_SECAO } from '../Icone';

/** O tamanho da seta do menu. O estilo o recebe daqui (--situacao-icone), para a folga do texto do menu acompanhar a seta. */
const ICONE_DA_SITUACAO = 13;
const TAMANHO_DO_ICONE_NO_ESTILO = { '--situacao-icone': ICONE_DA_SITUACAO + 'px' } as CSSProperties;

interface Props {
  /** O nome da linha, no rótulo à esquerda (padrão: "Situação"; na pessoa, "Etapa do atendimento"). */
  titulo?: string;
  /** O menu da situação (ex.: MenuDeSituacao), com o nome dele para o leitor de tela. */
  children: ReactNode;
  /** O que fica à direita do menu (o Concluir da tarefa e da demanda, ConcluirNaSituacao). */
  acao?: ReactNode;
}

export function SituacaoDoCartao({ titulo = 'Situação', children, acao }: Props) {
  return <div className="cartao-situacao" style={TAMANHO_DO_ICONE_NO_ESTILO}>
    <span className="cartao-situacao-rotulo" aria-hidden="true"><Icone nome="kanban" tam={ICONE_DO_TITULO_DE_SECAO} />{titulo}</span>
    {/* O menu e o que vai com ele andam juntos: sem lugar ao lado do rótulo, descem juntos para a linha de baixo. */}
    <span className="cartao-situacao-controles">
      <span className="situacao-menu">
        {children}
        <span className="situacao-seta" aria-hidden="true"><Icone nome="abaixo" tam={ICONE_DA_SITUACAO} /></span>
      </span>
      {acao}
    </span>
  </div>;
}
