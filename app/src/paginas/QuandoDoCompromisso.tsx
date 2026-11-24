// A data e o horário do compromisso no cartão (#361): "10/11/2026 · 14:30 às 16:00". Quem muda o compromisso clica e muda na janela
// das datas (#422, DatasDoCartao), a mesma dos outros cartões: o calendário, a data e a hora, o fim ("até") embaixo da hora e,
// nos tipos que se repetem, a repetição numa lista (#431): o compromisso que ainda não se repete passa a se repetir dali (toda
// semana, todo mês ou todo ano, sem data para terminar, como no cadastro); o que já se repete mostra como, sem mudar ali. As
// conferências são as do cadastro do compromisso (a hora é obrigatória na audiência, na perícia e na reunião), em
// regras/datasNoCartao.ts. Quem muda o compromisso também abre a janela pelo menu "Acrescentar ao cartão".
import type { Compromisso, FrequenciaRepeticao } from '../dados';
import { quandoDoCompromisso, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { datasDoQuando, errosDasDatasDoQuando, quandoAoGravar, quandoDasDatas, type QuandoGravado } from '../regras/datasNoCartao';
import type { CamposDasDatas } from '../regras/janelaDasDatas';
import { descreverRepeticao, FREQUENCIAS, FREQUENCIAS_DA_REPETICAO } from '../regras/repeticao';
import { DatasDoCartao, type RepeticaoDaJanela } from '../ui/base';

/** As escolhas da lista da repetição, depois do "Nunca": as do cadastro ("Toda semana", "Todo mês", "Todo ano"). */
const OPCOES_DA_REPETICAO = FREQUENCIAS_DA_REPETICAO.map(f => ({ valor: f, nome: FREQUENCIAS[f].nome }));
/** Por que a repetição já criada não muda na janela. */
const NOTA_DA_REPETICAO_FIXA = 'As datas seguintes já estão na agenda. Para parar, arquive esta e as seguintes.';

interface Props {
  c: Pick<Compromisso, 'tipo' | 'data' | 'hora' | 'hora_fim' | 'repeticao'>;
  /** Quem muda o compromisso recebe a data e o horário novos, já conferidos (só quando mudaram). Sem isto, só se lê. */
  aoSalvar?: (q: QuandoGravado) => unknown;
  /** O compromisso que ainda não se repete passa a se repetir (#431): a frequência escolhida na lista. Sem isto, a lista não aparece. */
  aoRepetir?: (frequencia: FrequenciaRepeticao) => unknown;
}

export function QuandoDoCompromisso({ c, aoSalvar, aoRepetir }: Props) {
  const quando = quandoDoCompromisso(c);
  const repeticao: RepeticaoDaJanela | undefined = !TIPOS_COMPROMISSO[c.tipo].repete ? undefined
    : c.repeticao ? { opcoes: [], fixa: { nome: descreverRepeticao(c.repeticao), nota: NOTA_DA_REPETICAO_FIXA } }
      : aoRepetir ? { opcoes: OPCOES_DA_REPETICAO } : undefined;
  /** Grava a data e o horário, se mudaram, e depois a repetição, se foi escolhida: as datas seguintes contam da data nova. */
  async function salvar(d: CamposDasDatas) {
    const antes = datasDoQuando(c), frequencia = FREQUENCIAS_DA_REPETICAO.find(f => f === d.repetir);
    if (aoSalvar && (d.entrega !== antes.entrega || d.hora !== antes.hora || d.horaFim !== antes.horaFim)) await aoSalvar(quandoAoGravar(quandoDasDatas(d)));
    if (aoRepetir && frequencia) await aoRepetir(frequencia);
  }
  return <DatasDoCartao nome="Data e horário" titulo="Mudar a data e o horário" resumo={quando} lido={<b className="num">{quando}</b>} atalho="datas"
    entrega={{ rotulo: 'Data', nome: 'Data', hora: { rotulo: 'Hora do compromisso', obrigatoria: TIPOS_COMPROMISSO[c.tipo].exigeHora }, ate: true }}
    repeticao={repeticao} inicial={() => datasDoQuando(c)} conferir={d => errosDasDatasDoQuando(c.tipo, d)}
    aoSalvar={aoSalvar && salvar} />;
}
