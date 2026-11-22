// Os gráficos do painel da página inicial (#402), com as peças do painel de Processos (ui/painel e ui/Graficos.tsx):
//   - as tarefas por situação (a fazer, fazendo, aguardando e as concluídas na semana), em barras deitadas que levam à lista;
//   - o ritmo: as tarefas concluídas e o tempo registrado em cada um dos últimos 7 dias (ou 30), em dois gráficos lado a lado,
//     porque são medidas diferentes e nunca dividem um eixo.
// As contas ficam em regras/graficosDoInicio.ts.
import { useState } from 'react';
import type { Coluna, GraficosDeTarefas } from '../../dados';
import { fmtDuracao } from '../../regras/cronometro';
import type { AlcanceDoPainel } from '../../regras/filtroDoPainel';
import {
  DIAS_DO_RITMO, periodoDoRitmo, PERIODOS_DO_RITMO, ritmoPorDia, ritmoVazio, SEGUNDOS_NA_HORA, SITUACOES, SITUACOES_DAS_TAREFAS, tarefasPorSituacao,
  type DiaDoRitmo, type PeriodoDoRitmo
} from '../../regras/graficosDoInicio';
import { noAlcance } from '../../regras/painelInicial';
import { Segmentos } from '../../ui/base';
import { BarrasDeitadas, BarrasPorMes, type Serie } from '../../ui/Graficos';
import { CartaoDoPainel } from '../../ui/painel/Painel';
import { lerPreferencia, salvarPreferencia } from '../../ui/preferencias';

/** A preferência que guarda o período do ritmo (7 ou 30 dias). */
const PREFERENCIA_DO_RITMO = 'inicio.ritmo';
/** O lugar da página aonde o número das tarefas leva. */
export const LUGAR_DAS_SITUACOES = 'inicio-situacoes';

const CONCLUIDAS: Serie = { chave: 'concluidas', nome: 'Tarefas concluídas', cor: 'var(--grafico-principal)' };
const HORAS: Serie = { chave: 'horas', nome: 'Tempo registrado', cor: 'var(--grafico-principal)' };
const contagem = (n: number) => n.toLocaleString('pt-BR');
/** O tempo da dica e da tabela, por extenso ("1 h 30 min"), e o do eixo, em horas ("1,5 h"). */
const tempo = (horas: number) => fmtDuracao(horas * SEGUNDOS_NA_HORA);
const horasNoEixo = (horas: number) => `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
const NOME_DO_PERIODO: Record<PeriodoDoRitmo, string> = { semana: `${DIAS_DO_RITMO.semana} dias`, mes: `${DIAS_DO_RITMO.mes} dias` };

interface Props { dados: GraficosDeTarefas; colunas: readonly Coluna[]; hoje: string; alcance: AlcanceDoPainel }

/** As tarefas em cada situação, cada linha levando às tarefas da pessoa. */
export function TarefasPorSituacao({ dados, colunas, hoje, alcance }: Props) {
  const situacoes = tarefasPorSituacao(dados.tarefas, colunas, hoje);
  const lista = noAlcance('/tarefas/', alcance);
  return <CartaoDoPainel titulo="Tarefas por situação" id={LUGAR_DAS_SITUACOES} largura="terco"
    nota={`As em aberto, pela coluna do quadro, e as concluídas nos últimos ${DIAS_DO_RITMO.semana} dias.`}>
    <BarrasDeitadas rotulo="Tarefas em cada situação" cor="var(--grafico-principal)"
      linhas={SITUACOES.map(s => ({ chave: s, nome: SITUACOES_DAS_TAREFAS[s], n: situacoes[s], para: lista }))} />
  </CartaoDoPainel>;
}

/** O ritmo de cada dia: as tarefas concluídas e o tempo registrado, nos últimos 7 dias ou nos últimos 30. */
export function Ritmo({ dados, hoje }: Pick<Props, 'dados' | 'hoje'>) {
  const [periodo, setPeriodo] = useState<PeriodoDoRitmo>(() => periodoDoRitmo(lerPreferencia<unknown>(PREFERENCIA_DO_RITMO, 'semana')));
  const escolher = (p: PeriodoDoRitmo) => { setPeriodo(p); salvarPreferencia(PREFERENCIA_DO_RITMO, p); };
  const dias = ritmoPorDia(dados, hoje, periodo);
  const poucos = periodo === 'semana';
  const quantos = DIAS_DO_RITMO[periodo];
  return <CartaoDoPainel titulo="Ritmo" largura="dois-tercos"
    acao={<Segmentos rotulo="Período do ritmo" atual={periodo} aoEscolher={escolher} opcoes={PERIODOS_DO_RITMO.map(p => ({ id: p, rotulo: NOME_DO_PERIODO[p] }))} />}
    nota={ritmoVazio(dias) ? `Nenhuma tarefa concluída nem tempo registrado nos últimos ${quantos} dias.` : `O que foi feito em cada um dos últimos ${quantos} dias.`}>
    <div className="painel-dupla">
      <section aria-labelledby="grafico-concluidas">
        <h3 className="painel-subtitulo" id="grafico-concluidas">Tarefas concluídas</h3>
        <BarrasPorMes<DiaDoRitmo> rotulo={`Tarefas concluídas em cada um dos últimos ${quantos} dias`} itens={dias} series={[CONCLUIDAS]}
          valor={d => d.concluidas} formatar={contagem} formatarCurto={contagem} rotulos={poucos} escalaInteira tabelaVisivel />
      </section>
      <section aria-labelledby="grafico-tempo">
        <h3 className="painel-subtitulo" id="grafico-tempo">Tempo registrado</h3>
        <BarrasPorMes<DiaDoRitmo> rotulo={`Tempo registrado nas tarefas em cada um dos últimos ${quantos} dias`} itens={dias} series={[HORAS]}
          valor={d => d.horas} formatar={tempo} formatarCurto={horasNoEixo} escalaInteira tabelaVisivel />
      </section>
    </div>
  </CartaoDoPainel>;
}
