// As contas dos indicadores e gráficos do Financeiro (sem tela, sem banco), só com o que já entrou (#268): nada de valor
// a receber, contratado ou em aberto, para ninguém tomar projeção por dinheiro em caixa. Valores em centavos.
//   - mesesDoCaixa: as entradas e as saídas do caixa em cada mês do ano (o escritório todo);
//   - mesesRealizados: a receita bruta e a líquida de cada mês (de um advogado ou de todos);
//   - indicadoresRealizados: receita bruta, líquida, contratos assinados e os repasses (escritório, indicadores,
//     participantes) de um período;
//   - receitaPorObjeto: quanto cada objeto/demanda rendeu no período.
// A receita bruta vem das parcelas recebidas (inclui o histórico importado das planilhas); a líquida e os repasses vêm
// dos recebimentos do SEMPER, que guardam a divisão (o histórico importado não tem a divisão).
import type { ContratoDaCarteira, Lancamento, ParcelaDoEscritorio, RecebimentoDoPeriodo } from '../dados/tipos';
import { contaNoResultado, MESES_DO_ANO, mesDoAno } from './painelFinanceiro';
import { receitasDoRecebimento } from './recebimento';

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

/** De quem são os números: um responsável (o perfil) ou, vazio, o escritório todo. */
const doResponsavel = (responsavel: string) => (id: string | null) => !responsavel || id === responsavel;
const noPeriodo = (data: string | null, periodo: string) => !!data && data.startsWith(periodo);

export interface MesRealizado { mes: string; nome: string; bruta: number; liquida: number }
/** A receita bruta (o que os clientes pagaram) e a líquida (o que ficou com o responsável) de cada mês do ano. */
export function mesesRealizados(parcelas: ParcelaDoEscritorio[], recebimentos: RecebimentoDoPeriodo[], ano: number, responsavel = ''): MesRealizado[] {
  const meses = MESES_DO_ANO.map((nome, i) => ({ mes: mesDoAno(ano, i), nome, bruta: 0, liquida: 0 }));
  const dele = doResponsavel(responsavel);
  for (const p of parcelas) {
    if (!p.recebida_em || !dele(p.responsavel_id)) continue;
    const m = meses.find(x => p.recebida_em!.startsWith(x.mes));
    if (m) m.bruta += p.recebido ?? p.valor;
  }
  for (const r of recebimentos) {
    if (!dele(r.responsavel_id)) continue;
    const m = meses.find(x => r.data.startsWith(x.mes));
    if (m) m.liquida += r.responsavel_fica;
  }
  return meses;
}

export interface Realizado {
  bruta: number; liquida: number; contratosAssinados: number; escritorio: number; indicadores: number; participantes: number;
  /** Há receita do histórico importado no período: ela entra na bruta, mas não tem a divisão (líquida e repasses). */
  temHistoricoSemDivisao: boolean;
}
/** Os números de um período ("2026-11" ou "2026"), de um responsável ou do escritório todo. */
export function indicadoresRealizados(parcelas: ParcelaDoEscritorio[], recebimentos: RecebimentoDoPeriodo[], contratos: Pick<ContratoDaCarteira, 'responsavel_id' | 'assinado_em'>[], periodo: string, responsavel = ''): Realizado {
  const dele = doResponsavel(responsavel);
  const recebidas = parcelas.filter(p => noPeriodo(p.recebida_em, periodo) && dele(p.responsavel_id));
  const doPeriodo = recebimentos.filter(r => noPeriodo(r.data, periodo) && dele(r.responsavel_id));
  const r = doPeriodo.map(receitasDoRecebimento);
  const somar = (c: keyof ReturnType<typeof receitasDoRecebimento>) => r.reduce((s, x) => s + x[c], 0);
  return {
    bruta: recebidas.reduce((s, p) => s + (p.recebido ?? p.valor), 0),
    liquida: somar('liquidaDoResponsavel'),
    contratosAssinados: contratos.filter(k => noPeriodo(k.assinado_em, periodo) && dele(k.responsavel_id)).length,
    escritorio: somar('escritorio'), indicadores: somar('indicadores'), participantes: somar('participantes'),
    temHistoricoSemDivisao: recebidas.some(p => !p.recebimento_id)
  };
}

export interface ReceitaDoObjeto { objeto: string; bruta: number; liquida: number; contratos: number }
/**
 * Quanto cada objeto/demanda rendeu no período: a bruta (das parcelas recebidas) e a líquida do responsável (dos
 * recebimentos do SEMPER). Num contrato com mais de um objeto, o valor se divide igualmente entre os objetos dele (o
 * recebimento é do contrato, não de uma demanda). Do maior para o menor.
 */
export function receitaPorObjeto(parcelas: ParcelaDoEscritorio[], recebimentos: RecebimentoDoPeriodo[], contratos: Pick<ContratoDaCarteira, 'id' | 'objetos'>[], periodo: string, responsavel = ''): ReceitaDoObjeto[] {
  const dele = doResponsavel(responsavel);
  const objetosDe = new Map(contratos.map(k => [k.id, k.objetos.length ? k.objetos : ['Sem objeto']]));
  const por = new Map<string, ReceitaDoObjeto & { ids: Set<string> }>();
  const somar = (contratoId: string, campo: 'bruta' | 'liquida', valor: number) => {
    const objetos = objetosDe.get(contratoId) ?? ['Sem objeto'];
    const parte = Math.round(valor / objetos.length);
    for (const o of objetos) {
      const chave = o.trim().toLocaleUpperCase('pt-BR');
      const x = por.get(chave) ?? { objeto: o.trim(), bruta: 0, liquida: 0, contratos: 0, ids: new Set<string>() };
      x[campo] += parte; x.ids.add(contratoId); x.contratos = x.ids.size;
      por.set(chave, x);
    }
  };
  for (const p of parcelas) if (noPeriodo(p.recebida_em, periodo) && dele(p.responsavel_id)) somar(p.contrato_id, 'bruta', p.recebido ?? p.valor);
  for (const r of recebimentos) if (noPeriodo(r.data, periodo) && dele(r.responsavel_id)) somar(r.contrato_id, 'liquida', r.responsavel_fica);
  return [...por.values()].map(({ ids: _ids, ...x }) => x).toSorted((a, b) => b.bruta - a.bruta || a.objeto.localeCompare(b.objeto));
}

/** O maior valor de uma lista (para a escala do gráfico), nunca zero. */
export const maiorDaEscala = (valores: number[]) => Math.max(1, ...valores);

const COMPACTO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
/** Valor curto para os eixos e rótulos dos gráficos ("R$ 12,5 mil"). */
export const fmtCompacto = (centavos: number) => COMPACTO.format(centavos / 100);
