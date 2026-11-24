// A data e o horário do compromisso no cartão (#361): "10/11/2026 · 14:30 às 16:00". Quem muda o compromisso clica e muda na janela
// das datas (#422, DatasDoCartao), a mesma dos outros cartões: o calendário, a data, a hora e o fim ("Até"), e, no compromisso que
// se repete, como ele se repete (só para ler). As conferências são as do cadastro do compromisso (a hora é obrigatória na
// audiência, na perícia e na reunião), em regras/datasNoCartao.ts. Quem muda o compromisso também abre a janela pelo menu
// "Acrescentar ao cartão".
import type { Compromisso } from '../dados';
import { quandoDoCompromisso, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { datasDoQuando, errosDasDatasDoQuando, quandoAoGravar, quandoDasDatas, type QuandoGravado } from '../regras/datasNoCartao';
import { descreverRepeticao } from '../regras/repeticao';
import { DatasDoCartao } from '../ui/base';

interface Props {
  c: Pick<Compromisso, 'tipo' | 'data' | 'hora' | 'hora_fim' | 'repeticao'>;
  /** Quem muda o compromisso recebe a data e o horário novos, já conferidos. Sem isto, só se lê. */
  aoSalvar?: (q: QuandoGravado) => unknown;
}

export function QuandoDoCompromisso({ c, aoSalvar }: Props) {
  const quando = quandoDoCompromisso(c);
  return <DatasDoCartao nome="Data e horário" titulo="Mudar a data e o horário" resumo={quando} lido={<b className="num">{quando}</b>} atalho="datas"
    entrega={{ rotulo: 'Data', nome: 'Data', hora: { rotulo: 'Hora do compromisso', obrigatoria: TIPOS_COMPROMISSO[c.tipo].exigeHora }, ate: true }}
    repeticao={c.repeticao ? descreverRepeticao(c.repeticao) : undefined}
    inicial={() => datasDoQuando(c)} conferir={d => errosDasDatasDoQuando(c.tipo, d)}
    aoSalvar={aoSalvar && (d => aoSalvar(quandoAoGravar(quandoDasDatas(d))))} />;
}
