// Os números e os gráficos do painel do Financeiro (#403). Nada de conta nova: cada valor sai das regras que o Financeiro já usa
// (totaisDoExtrato, indicadoresRealizados, carteiraDeContratos, situacaoDaParcela) e aqui só se arruma por período. O que entra
// como receita continua sendo só o que já entrou (#268); o "a receber" fica à parte, com o nome dele. Tudo puro, sem tela nem
// banco. Valores em centavos; datas "aaaa-mm-dd"; períodos "aaaa-mm" (um mês) ou "aaaa" (o ano todo).
import type { Lancamento, ParcelaDoEscritorio, RecebimentoDoPeriodo } from '../dados/tipos';
import { fmtCentavos } from './caixa';
import { somarMeses } from './campoData';
import { fmtCompacto, indicadoresRealizados } from './graficosFinanceiros';
import { carteiraDeContratos, filtrarCarteira, MESES_DO_ANO, totaisDaCarteira, totaisDoExtrato } from './painelFinanceiro';
import { situacaoDaParcela } from './parcelas';
import { somarDias } from './prazos';

/** Quantos meses o gráfico de entradas e saídas mostra, terminando no mês escolhido. */
export const MESES_DO_GRAFICO = 12;
/** Quantas semanas à frente o gráfico do que falta receber mostra. */
export const SEMANAS_A_RECEBER = 6;
const DIAS_NA_SEMANA = 7;
/** Os nomes dos meses por extenso, para a dica e a tabela dos gráficos ("novembro de 2026"). */
const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;

const ehAno = (periodo: string) => periodo.length === 4;
const indiceDoMes = (mes: string) => Number(mes.slice(5, 7)) - 1;

/** O nome curto do período, como no alto da página: "Nov/2026" ou "2026". */
export const nomeDoPeriodo = (periodo: string) => ehAno(periodo) ? periodo : `${MESES_DO_ANO[indiceDoMes(periodo)]}/${periodo.slice(0, 4)}`;

/** O período de antes: o mês anterior (de janeiro, o dezembro do ano anterior) ou, para o ano todo, o ano anterior. */
export const periodoAnterior = (periodo: string) => ehAno(periodo) ? String(Number(periodo) - 1) : somarMeses(periodo + '-01', -1).slice(0, 7);

/** O primeiro e o último dia do período. */
export function diasDoPeriodo(periodo: string) {
  if (ehAno(periodo)) return { de: `${periodo}-01-01`, ate: `${periodo}-12-31` };
  return { de: periodo + '-01', ate: somarDias(somarMeses(periodo + '-01', 1), -1) };
}

/** Os meses do gráfico: os doze do ano, para o ano todo; para um mês, ele e os onze de antes (o mês escolhido por último). */
export function mesesDoGrafico(periodo: string): string[] {
  const ultimo = ehAno(periodo) ? periodo + '-12' : periodo;
  return Array.from({ length: MESES_DO_GRAFICO }, (_, i) => somarMeses(ultimo + '-01', i + 1 - MESES_DO_GRAFICO).slice(0, 7));
}

/** O mês no eixo e na dica: nome "Nov" (o ano só no janeiro e no primeiro, para não se perder); detalhe "novembro de 2026". */
const itemDoMes = (mes: string, primeiro: boolean) => {
  const i = indiceDoMes(mes), ano = mes.slice(0, 4);
  return { mes, nome: primeiro || i === 0 ? `${MESES_DO_ANO[i]}/${ano.slice(2)}` : MESES_DO_ANO[i], curto: MESES_DO_ANO[i].slice(0, 1), detalhe: `${MESES_POR_EXTENSO[i]} de ${ano}` };
};

export interface MesDoCaixaNoGrafico { mes: string; nome: string; curto: string; detalhe: string; entradas: number; saidas: number; resultado: number }
/** As entradas, as saídas e o resultado de cada mês do gráfico, com a mesma conta do alto da página (sem repasses entre contas e sem ajustes). */
export const caixaPorMes = (lancamentos: Lancamento[], meses: string[]): MesDoCaixaNoGrafico[] =>
  meses.map((mes, i) => {
    const t = totaisDoExtrato(lancamentos.filter(l => l.data.startsWith(mes)));
    return { ...itemDoMes(mes, i === 0), entradas: t.entradas, saidas: t.saidas, resultado: t.resultado };
  });

export interface MesDaReceita { mes: string; nome: string; curto: string; detalhe: string; bruta: number; liquida: number }
/** A receita bruta e a líquida de cada mês do gráfico (de um responsável ou, vazio, de todos), com a conta dos indicadores. */
export const receitaPorMes = (parcelas: ParcelaDoEscritorio[], recebimentos: RecebimentoDoPeriodo[], meses: string[], responsavel = ''): MesDaReceita[] =>
  meses.map((mes, i) => {
    const r = indicadoresRealizados(parcelas, recebimentos, [], mes, responsavel);
    return { ...itemDoMes(mes, i === 0), bruta: r.bruta, liquida: r.liquida };
  });

/** De quem são as parcelas: um responsável ou, vazio, todos. */
const doResponsavel = (responsavel: string) => (p: Pick<ParcelaDoEscritorio, 'responsavel_id'>) => !responsavel || p.responsavel_id === responsavel;

export interface AReceber { valor: number; parcelas: number; atrasado: number }
/**
 * O que falta receber das parcelas que vencem no período (o valor de cada parcela ainda não recebida, como na carteira) e, disso,
 * quanto já passou do vencimento.
 */
export function aReceberNoPeriodo(parcelas: ParcelaDoEscritorio[], periodo: string, hoje: string, responsavel = ''): AReceber {
  const dele = doResponsavel(responsavel);
  const abertas = parcelas.filter(p => p.vencimento.startsWith(periodo) && dele(p) && situacaoDaParcela(p, hoje) !== 'recebida');
  return {
    valor: abertas.reduce((s, p) => s + p.valor, 0), parcelas: abertas.length,
    atrasado: abertas.filter(p => situacaoDaParcela(p, hoje) === 'atrasada').reduce((s, p) => s + p.valor, 0)
  };
}

/** O que está em atraso hoje, em todos os contratos (a mesma conta da aba Direitos), e quantos contratos têm atraso. */
export function emAtraso(parcelas: ParcelaDoEscritorio[], hoje: string, responsavel = '') {
  const comAtraso = filtrarCarteira(carteiraDeContratos(parcelas, hoje), { situacao: 'atrasado', busca: '', responsavel });
  return { valor: totaisDaCarteira(comAtraso).atrasado, contratos: comAtraso.length };
}

/** "22/11" */
const diaEMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Uma barra do gráfico do que falta receber: as atrasadas ou uma semana. */
export interface SemanaAReceber { chave: string; nome: string; curto: string; detalhe: string; valor: number; parcelas: number; atrasadas: boolean }
/** O que falta receber: as parcelas atrasadas (todas) e as de cada uma das próximas semanas, a primeira de hoje aos próximos 6 dias. */
export function aReceberPorSemana(parcelas: ParcelaDoEscritorio[], hoje: string, responsavel = ''): SemanaAReceber[] {
  const dele = doResponsavel(responsavel);
  const abertas = parcelas.filter(p => dele(p) && situacaoDaParcela(p, hoje) !== 'recebida');
  /** O valor e quantas parcelas; o "detalhe" (a dica e a tabela) leva quantas são. */
  const somar = (lista: ParcelaDoEscritorio[], quando: string) => ({
    valor: lista.reduce((s, p) => s + p.valor, 0), parcelas: lista.length, detalhe: `${quando} · ${lista.length} ${lista.length === 1 ? 'parcela' : 'parcelas'}`
  });
  const atrasadas = { chave: 'atrasadas', nome: 'Atrasadas', curto: 'Atras.', atrasadas: true, ...somar(abertas.filter(p => p.vencimento < hoje), 'Atrasadas') };
  const semanas = Array.from({ length: SEMANAS_A_RECEBER }, (_, i) => {
    const de = somarDias(hoje, i * DIAS_NA_SEMANA), ate = somarDias(de, DIAS_NA_SEMANA - 1);
    return { chave: 'semana-' + (i + 1), nome: diaEMes(de), curto: diaEMes(de).slice(0, 2), atrasadas: false,
      ...somar(abertas.filter(p => p.vencimento >= de && p.vencimento <= ate), `De ${diaEMes(de)} a ${diaEMes(ate)}`) };
  });
  return [atrasadas, ...semanas];
}

/**
 * O dia (de fora) até onde vai o saldo do período: o dia seguinte ao fim dele, mas nunca depois de amanhã (o saldo de um período
 * que ainda não acabou é o de hoje).
 */
export function corteDoSaldo(periodo: string, hoje: string) {
  const depoisDoFim = somarDias(diasDoPeriodo(periodo).ate, 1), amanha = somarDias(hoje, 1);
  return depoisDoFim < amanha ? depoisDoFim : amanha;
}

/**
 * O saldo de uma conta antes de um dia, a partir do saldo dela antes de outro dia, mais cedo ("base", como o banco o dá), e dos
 * lançamentos entre os dois: a mesma soma do caixa de cada mês (todos os lançamentos, até repasses e ajustes, mudam o saldo).
 */
export function saldoAntesDe(dia: string, base: { dia: string; saldo: number }, lancamentos: Pick<Lancamento, 'data' | 'tipo' | 'valor'>[]) {
  return lancamentos.filter(l => l.data >= base.dia && l.data < dia).reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : -l.valor), base.saldo);
}

/** O que o painel compara: mais é bom (entradas, receita), mais é ruim (saídas) ou nem um nem outro (o que falta receber). */
export type SentidoDoNumero = 'mais-e-bom' | 'mais-e-ruim' | 'neutro';
/** A cor da comparação: quando sobe e quando desce, em cada sentido. */
const TOM_DA_VARIACAO: Record<SentidoDoNumero, Record<'sobe' | 'desce', 'bom' | 'erro' | 'neutro'>> = {
  'mais-e-bom': { sobe: 'bom', desce: 'erro' },
  'mais-e-ruim': { sobe: 'erro', desce: 'bom' },
  neutro: { sobe: 'neutro', desce: 'neutro' }
};
/** Abaixo de mil reais, a diferença vai com os centavos ("R$ 782,60"); daí para cima, curta ("R$ 3,8 mil"). */
const MIL_REAIS = 100000;
const diferenca = (centavos: number) => centavos < MIL_REAIS ? fmtCentavos(centavos) : fmtCompacto(centavos);
export interface Comparacao { texto: string; seta: 'sobe' | 'desce' | 'igual'; tom: 'bom' | 'erro' | 'neutro' }
/** A comparação com o período anterior, em reais ("R$ 1,2 mil a mais que em Out/2026"), com a seta e a cor que o sentido dá. */
export function comparar(atual: number, anterior: number, periodoDeAntes: string, sentido: SentidoDoNumero): Comparacao {
  const quando = nomeDoPeriodo(periodoDeAntes);
  if (atual === anterior) return { texto: `igual a ${quando}`, seta: 'igual', tom: 'neutro' };
  const seta = atual > anterior ? 'sobe' : 'desce';
  return { texto: `${diferenca(Math.abs(atual - anterior))} a ${seta === 'sobe' ? 'mais' : 'menos'} que em ${quando}`, seta, tom: TOM_DA_VARIACAO[sentido][seta] };
}

/** Os números do alto, de um período: o caixa do escritório todo. */
export function numerosDoCaixa(lancamentos: Lancamento[], periodo: string) {
  return totaisDoExtrato(lancamentos.filter(l => l.data.startsWith(periodo)));
}
