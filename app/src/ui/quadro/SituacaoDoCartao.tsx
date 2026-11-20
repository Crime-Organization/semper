// A "Situação" no cabeçalho do cartão (processo, demanda, tarefa, contrato, compromisso; na pessoa, a "Etapa do atendimento"): o
// título e, numa linha só, o menu (com o que vai ao lado dele, como o Concluir da tarefa) e, à direita, o botão "Expandir tudo"
// das seções do cartão, no eixo das setas delas e do X (#381, #389). Sem a Situação (a anotação, o cartão em edição), o botão
// continua acima da primeira seção.
import type { ReactNode } from 'react';
import { Icone } from '../Icone';
import { LugarDoExpandirTudo } from '../Recolhivel';

interface Props {
  /** O título acima do menu (padrão: "Situação"). */
  titulo?: string;
  /** O menu da situação (ex.: MenuDeSituacao) e o que fica ao lado dele. */
  children: ReactNode;
}

export function SituacaoDoCartao({ titulo = 'Situação', children }: Props) {
  return <section className="bloco campos cartao-situacao">
    <h3><Icone nome="kanban" tam={14} />{titulo}</h3>
    <div className="situacao-linha">{children}<LugarDoExpandirTudo /></div>
  </section>;
}
