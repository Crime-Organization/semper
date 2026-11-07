// As contas dos gráficos do Financeiro (sem tela, sem banco). Valores em centavos.
//   - mesesDoCaixa / mesesRecebidos: as entradas e as saídas de cada mês do ano.
//   - segregarContratos: os contratos separados por categoria, responsável ou ano de assinatura, com o contratado,
//     o recebido e o que falta (como as colunas VALOR DO CONTRATO, PAGO e EM ABERTO da planilha de Contratos).
import type { ContratoDaCarteira, Lancamento, ParcelaDoEscritorio } from '../dados/tipos';
import { paraCentavos } from './caixa';
import { CATEGORIAS } from './contrato';
import { contaNoResultado, MESES_DO_ANO, mesDoAno } from './painelFinanceiro';

export interface Mes { mes: string; nome: string; entradas: number; saidas: number }
const mesesVazios = (ano: number): Mes[] => MESES_DO_ANO.map((nome, i) => ({ mes: mesDoAno(ano, i), nome, entradas: 0, saidas: 0 }));

/** As entradas e as saídas do caixa em cada mês do ano (sem os repasses entre contas e sem os ajustes). */
export function mesesDoCaixa(lancamentos: Pick<Lancamento, 'data' | 'tipo' | 'valor' | 'categoria'>[], ano: number): Mes[] {
  const meses = mesesVazios(ano);
  for (const l of lancamentos) {
    const m = meses.find(x => l.data.startsWith(x.mes));
    if (!m || !contaNoResultado(l as Lancamento)) continue;
    if (l.tipo === 'entrada') m.entradas += l.valor; else m.saidas += l.valor;
  }
  return meses;
}

/** O que foi recebido das parcelas em cada mês do ano; com "responsavel", só os contratos dele. */
export function mesesRecebidos(parcelas: ParcelaDoEscritorio[], ano: number, responsavel = ''): Mes[] {
  const meses = mesesVazios(ano);
  for (const p of parcelas) {
    if (!p.recebida_em || (responsavel && p.responsavel_id !== responsavel)) continue;
    const m = meses.find(x => p.recebida_em!.startsWith(x.mes));
    if (m) m.entradas += p.recebido ?? p.valor;
  }
  return meses;
}

export type SepararPor = 'categoria' | 'responsavel' | 'ano';
export interface Grupo { chave: string; rotulo: string; contratos: number; contratado: number; recebido: number; emAberto: number }
type NomeDe = (perfilId: string) => string;
/** Por onde separar: a chave de cada contrato e o nome que aparece. Um jeito novo de separar é uma linha nova aqui. */
export const SEPARAR: Record<SepararPor, { nome: string; chave: (k: ContratoDaCarteira) => string; rotulo: (chave: string, nomeDe: NomeDe) => string }> = {
  categoria: { nome: 'Por categoria', chave: k => k.categoria, rotulo: c => CATEGORIAS[c as keyof typeof CATEGORIAS] ?? c },
  responsavel: { nome: 'Por responsável', chave: k => k.responsavel_id, rotulo: (c, nomeDe) => nomeDe(c) },
  ano: { nome: 'Por ano de assinatura', chave: k => k.assinado_em?.slice(0, 4) ?? '', rotulo: c => c || 'Sem data' }
};

/**
 * Os contratos separados num jeito, do maior contratado para o menor (tudo em centavos; o valor e os descontos do
 * contrato vêm em reais e são convertidos aqui). O contratado é o valor do contrato menos os
 * descontos (sem valor, vale a soma das parcelas), e nunca menos do que já foi recebido (o contrato de êxito costuma ter
 * valor zero); o recebido, a soma das parcelas recebidas; o que falta, a diferença. Com "responsavel", só os contratos dele.
 */
export function segregarContratos(contratos: ContratoDaCarteira[], parcelas: ParcelaDoEscritorio[], por: SepararPor, nomeDe: NomeDe, responsavel = ''): Grupo[] {
  const recebido = new Map<string, number>(), somaDasParcelas = new Map<string, number>();
  for (const p of parcelas) {
    somaDasParcelas.set(p.contrato_id, (somaDasParcelas.get(p.contrato_id) ?? 0) + p.valor);
    if (p.recebida_em) recebido.set(p.contrato_id, (recebido.get(p.contrato_id) ?? 0) + (p.recebido ?? p.valor));
  }
  const grupos = new Map<string, Grupo>();
  for (const k of contratos) {
    if (responsavel && k.responsavel_id !== responsavel) continue;
    const chave = SEPARAR[por].chave(k);
    const g = grupos.get(chave) ?? { chave, rotulo: SEPARAR[por].rotulo(chave, nomeDe), contratos: 0, contratado: 0, recebido: 0, emAberto: 0 };
    const pago = recebido.get(k.id) ?? 0;
    const valor = k.valor === null ? somaDasParcelas.get(k.id) ?? 0 : paraCentavos(k.valor);
    const contratado = Math.max(pago, valor - paraCentavos(k.descontos ?? 0));
    g.contratos++;
    g.contratado += contratado;
    g.recebido += pago;
    g.emAberto += Math.max(0, contratado - pago);
    grupos.set(chave, g);
  }
  return [...grupos.values()].toSorted((a, b) => b.contratado - a.contratado || a.rotulo.localeCompare(b.rotulo));
}

/** O maior valor de uma lista (para a escala do gráfico), nunca zero. */
export const maiorDaEscala = (valores: number[]) => Math.max(1, ...valores);

const COMPACTO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
/** Valor curto para os eixos e rótulos dos gráficos ("R$ 12,5 mil"). */
export const fmtCompacto = (centavos: number) => COMPACTO.format(centavos / 100);
