// O prazo com a hora e o lembrete (#299) e a data de início (#357), nos cadastros de tarefa e de demanda. O prazo e a hora ficam
// num campo só (<CampoDataHora>, com o calendário pequeno da #357) e o lembrete no botão com o sino logo ao lado (<BotaoDoLembrete>).
// As opções, os textos e as conferências ficam em regras/lembrete.ts.
import type { Lembrete } from '../dados';
import { errosJuntos } from '../regras/campoData';
import { ROTULO_DO_INICIO } from '../regras/dataDeInicio';
import { BotaoDoLembrete, Campo, CampoData, CampoDataHora, propsDoCampo } from '../ui/base';

/** A dica do prazo: a data e a hora são opcionais, e o sino marca o lembrete, depois do prazo (sem ele, o sino fica desligado). */
const DICA_DO_PRAZO = 'Opcional, e a hora também (no horário de Brasília; sem ela, o prazo vale o dia). Com o prazo, o sino marca um lembrete.';

interface PropsDoPrazo {
  rotulo: string;
  prazo: string;
  hora: string;
  lembrete: Lembrete | null;
  /** Os erros de cada parte: todos aparecem embaixo do campo (errosJuntos), e cada parte com erro fica marcada. */
  erros: { prazo?: string; hora?: string; lembrete?: string };
  aoMudar: (campos: { prazo?: string; hora?: string; lembrete?: Lembrete | null }) => void;
}

/** O prazo (dd/mm/aaaa) e a hora, opcionais, num campo só, com o botão do lembrete ao lado. */
export function CampoDoPrazo({ rotulo, prazo, hora, lembrete, erros, aoMudar }: PropsDoPrazo) {
  const erro = errosJuntos(erros.prazo, erros.hora, erros.lembrete);
  const props = propsDoCampo('prazo', { dica: true, erro });
  return <Campo rotulo={rotulo} para="prazo" erro={erro} dica={DICA_DO_PRAZO}>
    <CampoDataHora {...props} aria-invalid={erros.prazo ? true : undefined} valor={prazo} aoMudar={p => aoMudar({ prazo: p })}
      hora={hora} aoMudarHora={h => aoMudar({ hora: h })} horaComErro={!!erros.hora}
      junto={<BotaoDoLembrete valor={lembrete} prazo={prazo} comErro={!!erros.lembrete} aria-describedby={props['aria-describedby']}
        aoMudar={l => aoMudar({ lembrete: l })} />} />
  </Campo>;
}

/** A data de início (#357), no lápis do cartão: começa no dia da criação e pode mudar (não fica vazia). */
export function CampoDoInicio({ valor, erro, aoMudar }: { valor: string; erro?: string; aoMudar: (inicio: string) => void }) {
  return <Campo rotulo={ROTULO_DO_INICIO} para="inicio" obrigatorio erro={erro} dica="Começa no dia em que o cartão foi criado. Mude se o trabalho começa em outro dia.">
    <CampoData {...propsDoCampo('inicio', { dica: true, erro })} valor={valor} aoMudar={aoMudar} />
  </Campo>;
}
