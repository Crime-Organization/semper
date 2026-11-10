// A hora do prazo e o lembrete (#286), junto do prazo nos cadastros de tarefa e de demanda (e na edição no cartão, que usa o
// mesmo formulário). As opções, os textos e as conferências ficam em regras/lembrete.ts.
import type { Lembrete } from '../dados';
import { DICA_DO_LEMBRETE, LEMBRETES, lerLembrete, OPCOES_DE_LEMBRETE, SEM_LEMBRETE } from '../regras/lembrete';
import { Campo, propsDoCampo } from '../ui/base';

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
