// A data e o horário do compromisso no grupo das datas do cartão (#361): "10/11/2026 · 14:30 às 16:00". Quem muda o compromisso
// clica e muda ali mesmo, com a peça do cadastro (#299): a data e a hora num campo só (<CampoDataHora>, com o calendário pequeno da
// #357, que abre quando a pessoa pede), em tamanho de cartão, e o fim ("Até") logo ao lado. A hora tem um nome só dela ("Hora do compromisso").
// As conferências são as do cadastro do compromisso (a hora é obrigatória na audiência, na perícia e na reunião), em
// regras/datasNoCartao.ts. Quem muda o compromisso também abre o formulário pelo botão rápido "Datas" do cartão (#351).
import type { Compromisso } from '../dados';
import { quandoDoCompromisso, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { camposDoQuando, errosDoQuando, quandoAoGravar, type QuandoGravado } from '../regras/datasNoCartao';
import { CampoDataHora, DadoEditavel } from '../ui/base';

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
    aoMudarRascunho={aoMudarRascunho} atalho="datas" campos={({ rascunho, mudar, marcar }) => {
      const daHora = marcar('hora');
      return <CampoDataHora discreto aria-label="Data" {...marcar('data')} valor={rascunho.data} aoMudar={data => mudar({ data })}
        hora={rascunho.hora} aoMudarHora={hora => mudar({ hora })} rotuloDaHora="Hora do compromisso" horaObrigatoria={TIPOS_COMPROMISSO[c.tipo].exigeHora}
        horaComErro={!!daHora['aria-invalid']} descricaoDaHora={daHora['aria-describedby']}
        junto={<label className="dado-editavel-legenda">Até
          <input type="time" className="data-editavel-campo dado-editavel-hora" {...marcar('horaFim')} value={rascunho.horaFim} onChange={e => mudar({ horaFim: e.target.value })} />
        </label>} />;
    }} />;
}
