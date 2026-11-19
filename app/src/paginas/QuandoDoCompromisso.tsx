// A data e o horário do compromisso no grupo das datas do cartão (#361): "10/11/2026 · 14:30 às 16:00". Quem muda o compromisso
// clica e muda ali mesmo: a data abre com o calendário pequeno (#357), com a hora logo abaixo dele, e ao lado ficam a hora e o fim.
// A hora de fora tem um nome só dela ("Hora do compromisso"), para não se confundir com a do calendário (veja PrazoEditavel).
// As conferências são as do cadastro do compromisso (a hora é obrigatória na audiência, na perícia e na reunião), em
// regras/datasNoCartao.ts.
import type { Compromisso } from '../dados';
import { quandoDoCompromisso } from '../regras/compromisso';
import { camposDoQuando, errosDoQuando, quandoAoGravar, type QuandoGravado } from '../regras/datasNoCartao';
import { CampoData, DadoEditavel } from '../ui/base';

interface Props {
  c: Pick<Compromisso, 'tipo' | 'data' | 'hora' | 'hora_fim'>;
  /** Quem muda o compromisso recebe a data e o horário novos, já conferidos. Sem isto, só se lê. */
  aoSalvar?: (q: QuandoGravado) => unknown;
  /** Avisa o cartão da data e do horário mudados e ainda não salvos (para perguntar antes de fechar). */
  aoMudarRascunho?: (rascunho: string | null) => void;
}

export function QuandoDoCompromisso({ c, aoSalvar, aoMudarRascunho }: Props) {
  const quando = quandoDoCompromisso(c);
  return <DadoEditavel nome="Data e horário" titulo="Mudar a data e o horário" resumo={quando} lido={<b className="num">{quando}</b>}
    inicial={() => camposDoQuando(c)} conferir={q => errosDoQuando(c.tipo, q)} aoSalvar={aoSalvar && (q => aoSalvar(quandoAoGravar(q)))}
    aoMudarRascunho={aoMudarRascunho} campos={({ rascunho, mudar, marcar }) => <>
      <CampoData aria-label="Data" className="data-editavel-campo" {...marcar('data')} valor={rascunho.data} abrirAoAparecer
        aoMudar={data => mudar({ data })} hora={{ valor: rascunho.hora, aoMudar: hora => mudar({ hora }) }} />
      <label className="dado-editavel-legenda">Hora
        <input type="time" aria-label="Hora do compromisso" className="data-editavel-campo dado-editavel-hora" {...marcar('hora')} value={rascunho.hora}
          onChange={e => mudar({ hora: e.target.value })} />
      </label>
      <label className="dado-editavel-legenda">Até
        <input type="time" className="data-editavel-campo dado-editavel-hora" {...marcar('horaFim')} value={rascunho.horaFim} onChange={e => mudar({ horaFim: e.target.value })} />
      </label>
    </>} />;
}
