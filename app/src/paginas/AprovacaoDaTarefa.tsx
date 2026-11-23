// A faixa da aprovação no cartão da tarefa (#313): enquanto a tarefa que precisa de aprovação espera na coluna de aprovação, a faixa
// diz de quem é a aprovação; para quem aprova (o solicitante ou um administrador), traz o Aprovar (ela vai para as concluídas) e o
// Devolver (pede o comentário, que fica no cartão, e ela volta para "Fazendo"). As regras ficam em regras/aprovacaoDaTarefa.ts; quem
// grava e confere de novo é o banco (public.tarefa_aprovar e public.tarefa_devolver).
import { SD, type Coluna, type Tarefa } from '../dados';
import { aprovaATarefa, AVISO_DA_APROVACAO, erroDaDevolucao, esperaAprovacao } from '../regras/aprovacaoDaTarefa';
import { avisar, falha } from '../ui/avisos';
import { Aviso } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { pedirTexto } from '../ui/janela';
import { ICONE_DA_FAIXA } from '../ui/TopoDoCartao';
import { useCtx } from '../ui/sessao';

/** O título da janela que pede o comentário da devolução. */
export const PERGUNTA_DA_DEVOLUCAO = 'O que precisa ser ajustado?';

interface Props {
  t: Pick<Tarefa, 'id' | 'etapa_id' | 'arquivado_em' | 'precisa_aprovacao' | 'solicitante_id'>;
  /** As colunas do quadro de tarefas (com a de aprovação). */
  colunas: Coluna[];
  /** O nome de alguém da equipe. */
  nomeDe: (id: string | null) => string;
  /** Depois de aprovar ou devolver: o cartão e a lista se releem. */
  aoMudar: () => unknown;
}

export function FaixaDaAprovacao({ t, colunas, nomeDe, aoMudar }: Props) {
  const ctx = useCtx();
  if (!esperaAprovacao(t, colunas)) return null;
  const aprova = aprovaATarefa(t, ctx.perfil);
  const de = t.solicitante_id ? nomeDe(t.solicitante_id) : 'um administrador';

  async function aprovar() {
    try {
      await SD.tarefaAprovar(t.id);
      // Sem Desfazer: o solicitante que só lê a tarefa não a moveria de volta (quem errou devolve ou reabre).
      avisar(AVISO_DA_APROVACAO.aprovada);
      await aoMudar();
    } catch (e) { falha(e); }
  }
  async function devolver() {
    const texto = await pedirTexto(PERGUNTA_DA_DEVOLUCAO, '', { multilinha: true });
    if (texto === null) return;
    const erro = erroDaDevolucao(texto);
    if (erro) { falha(new Error(erro)); return; }
    try {
      await SD.tarefaDevolver(t.id, texto);
      avisar(AVISO_DA_APROVACAO.devolvida);
      await aoMudar();
    } catch (e) { falha(e); }
  }

  return <Aviso tipo="info" className="faixa-da-aprovacao">
    <span>{aprova ? 'Esta tarefa espera a sua aprovação.' : <>Esta tarefa espera a aprovação de <b>{de}</b>.</>}</span>
    {aprova && <span className="faixa-da-aprovacao-botoes">
      <Botao pequeno variante="principal" ocupadoTexto="Aprovando…" onClick={aprovar}><Icone nome="check" tam={ICONE_DA_FAIXA} />Aprovar</Botao>
      <Botao pequeno ocupadoTexto="Devolvendo…" onClick={devolver}><Icone nome="voltar" tam={ICONE_DA_FAIXA} />Devolver</Botao>
    </span>}
  </Aviso>;
}
