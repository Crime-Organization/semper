// O prazo com o calendário (#357), a hora do prazo e o lembrete (#286) e a data de início (#357), juntos nos cadastros de tarefa e de demanda (e na edição no cartão, que usa o
// mesmo formulário). As opções, os textos e as conferências ficam em regras/lembrete.ts.
import type { Lembrete } from '../dados';
import { DICA_DO_LEMBRETE, LEMBRETES, lerLembrete, OPCOES_DE_LEMBRETE, SEM_LEMBRETE } from '../regras/lembrete';
import { ROTULO_DO_INICIO } from '../regras/dataDeInicio';
import { Campo, CampoData, propsDoCampo } from '../ui/base';

/** A hora do prazo, opcional, no relógio de Brasília. */
export function CampoDaHora({ valor, erro, aoMudar }: { valor: string; erro?: string; aoMudar: (hora: string) => void }) {
  return <Campo rotulo="Hora" para="hora" erro={erro} dica="Opcional. No horário de Brasília. Sem hora, o prazo vale o dia.">
    <input type="time" {...propsDoCampo('hora', { dica: true, erro })} value={valor} onChange={e => aoMudar(e.target.value)} />
  </Campo>;
}

/** Quanto antes do prazo chega o lembrete, ou nenhum. */
export function CampoDoLembrete({ valor, erro, aoMudar }: { valor: Lembrete | null; erro?: string; aoMudar: (lembrete: Lembrete | null) => void }) {
  return <Campo rotulo="Lembrete" para="lembrete" erro={erro} dica={DICA_DO_LEMBRETE}>
    <select {...propsDoCampo('lembrete', { dica: true, erro })} value={valor ?? ''} onChange={e => aoMudar(lerLembrete(e.target.value))}>
      <option value="">{SEM_LEMBRETE}</option>
      {OPCOES_DE_LEMBRETE.map(l => <option key={l} value={l}>{LEMBRETES[l].nome}</option>)}
    </select>
  </Campo>;
}

/**
 * O prazo (dd/mm/aaaa), opcional, com o calendário pequeno (#357): a hora do prazo fica logo abaixo do calendário, e é a mesma do
 * campo "Hora" (mudar num muda no outro).
 */
export function CampoDoPrazo({ rotulo, valor, erro, hora, aoMudar, aoMudarHora }: {
  rotulo: string; valor: string; erro?: string; hora: string; aoMudar: (prazo: string) => void; aoMudarHora: (hora: string) => void;
}) {
  return <Campo rotulo={rotulo} para="prazo" erro={erro} dica="Opcional. O prazo aparece na agenda.">
    <CampoData {...propsDoCampo('prazo', { dica: true, erro })} valor={valor} aoMudar={aoMudar} hora={{ valor: hora, aoMudar: aoMudarHora }} />
  </Campo>;
}

/** A data de início (#357), no lápis do cartão: começa no dia da criação e pode mudar (não fica vazia). */
export function CampoDoInicio({ valor, erro, aoMudar }: { valor: string; erro?: string; aoMudar: (inicio: string) => void }) {
  return <Campo rotulo={ROTULO_DO_INICIO} para="inicio" obrigatorio erro={erro} dica="Começa no dia em que o cartão foi criado. Mude se o trabalho começa em outro dia.">
    <CampoData {...propsDoCampo('inicio', { dica: true, erro })} valor={valor} aoMudar={aoMudar} />
  </Campo>;
}
