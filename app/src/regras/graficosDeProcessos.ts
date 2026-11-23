// As contas dos números e dos gráficos do painel de Processos (#401). Tudo puro, sem tela nem banco. As datas são "aaaa-mm-dd".
//   - periodoDosGraficos: até onde os prazos olham (as próximas semanas) e desde quando o movimento conta (os últimos meses);
//   - prazosPorSemana: os vencidos e os prazos de cada uma das próximas semanas, a partir de hoje;
//   - movimentoPorMes: em cada mês, os andamentos lançados, os processos novos e os encerrados;
//   - ativosPorTipo e fasesDosProcessos: quantos processos estão ativos e em que coluna do quadro;
//   - painelDaPessoa: as listas do painel só com os processos de uma pessoa da equipe.
import type { Coluna, FaseNoPainel, GraficosDeProcessos, PainelDeProcessos, ProcessoNosGraficos, TipoProcesso } from '../dados/tipos';
import { somarMeses } from './campoData';
import { MESES } from './calendario';
import { FUSO_DA_AGENDA } from './compromisso';
import { daPessoa } from './filtroDoPainel';
import { MESES_DO_ANO } from './painelFinanceiro';
import { ITENS_POR_LISTA } from './painelProcessos';
import { somarDias } from './prazos';
import { TIPOS, TIPOS_PROCESSO } from './processo';

/** Quantas semanas à frente o gráfico de prazos mostra. */
export const SEMANAS_DE_PRAZOS = 4;
/** Quantos meses, contando o atual, o gráfico do movimento mostra. */
export const MESES_DO_MOVIMENTO = 12;
const DIAS_NA_SEMANA = 7;

/** As datas que os gráficos pedem ao banco: o primeiro dia do mês mais antigo do movimento e o último dia das semanas de prazos. */
export const periodoDosGraficos = (hoje: string) => ({
  desde: somarMeses(hoje.slice(0, 8) + '01', 1 - MESES_DO_MOVIMENTO),
  ate_prazos: somarDias(hoje, SEMANAS_DE_PRAZOS * DIAS_NA_SEMANA - 1)
});

/** "22/11" */
const diaEMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Uma barra do gráfico de prazos: os vencidos ou uma semana. nome: o do eixo; curto: o do eixo estreito; detalhe: o da dica. */
export interface BarraDePrazos { chave: string; nome: string; curto: string; detalhe: string; n: number; vencidos: boolean; de?: string; ate?: string }

/** Os vencidos e os prazos de cada uma das próximas semanas: a primeira vai de hoje aos próximos 6 dias. */
export function prazosPorSemana(prazos: readonly { final: string }[], hoje: string): BarraDePrazos[] {
  const vencidos = prazos.filter(z => z.final < hoje).length;
  const semanas = Array.from({ length: SEMANAS_DE_PRAZOS }, (_, i) => {
    const de = somarDias(hoje, i * DIAS_NA_SEMANA), ate = somarDias(de, DIAS_NA_SEMANA - 1);
    return { chave: 'semana-' + (i + 1), nome: `${diaEMes(de)} a ${diaEMes(ate)}`, curto: diaEMes(de), detalhe: `De ${diaEMes(de)} a ${diaEMes(ate)}`,
      n: prazos.filter(z => z.final >= de && z.final <= ate).length, vencidos: false, de, ate };
  });
  return [{ chave: 'vencidos', nome: 'Vencidos', curto: 'Vencidos', detalhe: 'Vencidos', n: vencidos, vencidos: true }, ...semanas];
}

/** Um mês do movimento. nome: o do eixo ("Nov"); detalhe: o da dica e da tabela ("novembro de 2026"). */
export interface MesDoMovimento { mes: string; nome: string; detalhe: string; andamentos: number; novos: number; encerrados: number }

/** O dia, no horário de Brasília, de um momento guardado pelo banco. */
const diaEmBrasilia = (momento: string) => new Date(momento).toLocaleDateString('en-CA', { timeZone: FUSO_DA_AGENDA });
/** Quando o processo chegou: a distribuição, ou o dia em que foi cadastrado. */
const chegada = (p: Pick<ProcessoNosGraficos, 'distribuicao' | 'criado_em'>) => p.distribuicao ?? diaEmBrasilia(p.criado_em);

/** Os nomes das colunas de encerrados (as colunas-marco "concluído") de cada quadro. */
export type ColunasDosQuadros = Partial<Record<TipoProcesso, readonly Pick<Coluna, 'id' | 'nome' | 'marco'>[]>>;
const encerradas = (colunas: ColunasDosQuadros, tipo: TipoProcesso) => (colunas[tipo] ?? []).filter(c => c.marco === 'concluido');

/**
 * O movimento de cada um dos últimos meses (o atual por último): os andamentos lançados, os processos que chegaram (pela
 * distribuição ou pelo cadastro) e os que foram para a coluna de encerrados (o processo que vai e volta conta uma vez no mês).
 */
export function movimentoPorMes(dados: GraficosDeProcessos, hoje: string, colunas: ColunasDosQuadros): MesDoMovimento[] {
  const { desde } = periodoDosGraficos(hoje);
  const meses: MesDoMovimento[] = Array.from({ length: MESES_DO_MOVIMENTO }, (_, i) => {
    const mes = somarMeses(desde, i).slice(0, 7), indice = Number(mes.slice(5, 7)) - 1;
    return { mes, nome: MESES_DO_ANO[indice], detalhe: `${MESES[indice]} de ${mes.slice(0, 4)}`, andamentos: 0, novos: 0, encerrados: 0 };
  });
  const doMes = (dia: string) => dia <= hoje ? meses.find(m => dia.startsWith(m.mes)) : undefined;
  for (const a of dados.andamentos) { const m = doMes(a.data); if (m) m.andamentos++; }
  for (const p of dados.processos) { const m = doMes(chegada(p)); if (m) m.novos++; }
  const tipoDe = new Map(dados.processos.map(p => [p.id, p.tipo]));
  const contados = new Set<string>();
  for (const x of dados.mudancas) {
    const tipo = tipoDe.get(x.processo_id);
    const nomes = tipo ? encerradas(colunas, tipo).map(c => c.nome) : [];
    const m = doMes(diaEmBrasilia(x.em));
    if (!m || !x.para || !nomes.includes(x.para) || (x.de && nomes.includes(x.de)) || contados.has(m.mes + x.processo_id)) continue;
    contados.add(m.mes + x.processo_id);
    m.encerrados++;
  }
  return meses;
}

/** Os processos ativos de cada tipo: não arquivados e fora da coluna de encerrados. */
export function ativosPorTipo(processos: readonly ProcessoNosGraficos[], colunas: ColunasDosQuadros): Record<TipoProcesso, number> {
  return Object.fromEntries(TIPOS.map(t => {
    const fim = new Set(encerradas(colunas, t).map(c => c.id));
    return [t, processos.filter(p => p.tipo === t && !p.arquivado_em && !(p.etapa_id && fim.has(p.etapa_id))).length];
  })) as Record<TipoProcesso, number>;
}

/** Todos os processos ativos, somados os de cada tipo (o número do alto). */
export const totalDeAtivos = (ativos: Record<TipoProcesso, number>) => TIPOS.reduce((soma, t) => soma + ativos[t], 0);

/** Quantos processos não arquivados há em cada coluna de cada quadro (como as fases do painel, para fasesDoTipo). */
export function fasesDosProcessos(processos: readonly ProcessoNosGraficos[]): FaseNoPainel[] {
  const fases = new Map<string, FaseNoPainel>();
  for (const p of processos.filter(x => !x.arquivado_em)) {
    const chave = p.tipo + '/' + p.etapa_id;
    fases.set(chave, { tipo: p.tipo, etapa_id: p.etapa_id, n: (fases.get(chave)?.n ?? 0) + 1 });
  }
  return [...fases.values()];
}

/**
 * As listas do painel só com os processos de uma pessoa da equipe (o banco só sabe separar os de quem está logado). As listas da
 * equipe vêm cortadas em ITENS_POR_LISTA: se alguma veio cortada, "incompleto" avisa que a da pessoa pode ter ficado sem parte.
 */
export function painelDaPessoa(painel: PainelDeProcessos, pessoa: string, hoje: string): { painel: PainelDeProcessos; incompleto: boolean } {
  const dela = <T extends { processo: Parameters<typeof daPessoa>[0] }>(lista: T[]) => lista.filter(x => daPessoa(x.processo, pessoa));
  const prazos = dela(painel.prazos), marcados = dela(painel.marcados), intimacoes = dela(painel.intimacoes), parados = dela(painel.parados);
  const incompleto = [painel.total_vencidos, painel.total_a_vencer, painel.total_marcados, painel.total_intimacoes, painel.total_parados].some(n => n > ITENS_POR_LISTA);
  return {
    incompleto,
    painel: {
      ...painel, prazos, marcados, intimacoes, parados, ultimos: dela(painel.ultimos),
      total_vencidos: prazos.filter(z => z.final < hoje).length, total_a_vencer: prazos.filter(z => z.final >= hoje).length,
      total_marcados: marcados.length, total_intimacoes: intimacoes.length, total_parados: parados.length,
      // As fases da pessoa vêm dos gráficos (fasesDosProcessos), que o banco já separa por ela.
      fases: []
    }
  };
}

/** Os processos ativos de um tipo, por extenso, no número do alto ("1 judicial", "18 judiciais"). */
const NOME_NO_NUMERO: Record<TipoProcesso, [um: string, varios: string]> = {
  judicial: ['judicial', 'judiciais'], administrativo: ['administrativo', 'administrativos']
};
export const ativosPorExtenso = (tipo: TipoProcesso, n: number) => `${n.toLocaleString('pt-BR')} ${NOME_NO_NUMERO[tipo][n === 1 ? 0 : 1]}`;

/** A lista dos processos de um tipo, só com os da pessoa (null: todos). Abre em tabela, como as fases (enderecoDaFase). */
export const enderecoDoTipo = (tipo: TipoProcesso, pessoa: string | null) => `${TIPOS_PROCESSO[tipo].caminho}${pessoa ? `?pessoa=${pessoa}` : ''}`;
