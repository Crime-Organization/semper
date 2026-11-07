// O painel do financeiro: o ano mês a mês, o extrato com filtros, a carteira de contratos e o arquivo para planilha. Tudo puro, sem
// tela nem banco. Valores em centavos; datas "aaaa-mm-dd"; meses "aaaa-mm".
import type { CategoriaDeLancamento, ContaFinanceira, Lancamento, ParcelaDoEscritorio, TipoDeLancamento } from '../dados/tipos';
import { centavosNoCampo, ehAjuste, nomeDaCategoria } from './caixa';
import { situacaoDaParcela } from './parcelas';
import { fmtData } from './pessoa';
import { normal } from './texto';

/** Os doze meses, como aparecem nos botões e no quadro do ano. */
export const MESES_DO_ANO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;
/** O mês "aaaa-mm" de cada posição do ano. */
export const mesDoAno = (ano: number, indice: number) => `${ano}-${String(indice + 1).padStart(2, '0')}`;

/** O repasse entre contas só troca o dinheiro de lugar, e o ajuste só iguala o saldo ao banco: nenhum dos dois é receita ou despesa. */
export const contaNoResultado = (l: Pick<Lancamento, 'categoria'>) => l.categoria !== 'transferencia' && !ehAjuste(l.categoria);

export interface MesDoPainel { mes: string; entradas: number; saidas: number; resultado: number; porCategoria: Partial<Record<CategoriaDeLancamento, number>> }
/** Cada mês do ano, só com o que é receita ou despesa, e o total do ano na mesma forma. */
export function resumoDoAno(lancamentos: Lancamento[], ano: number): { meses: MesDoPainel[]; total: MesDoPainel } {
  const vazio = (mes: string): MesDoPainel => ({ mes, entradas: 0, saidas: 0, resultado: 0, porCategoria: {} });
  const meses = MESES_DO_ANO.map((_, i) => vazio(mesDoAno(ano, i)));
  const total = vazio(String(ano));
  lancamentos.filter(l => l.data.startsWith(`${ano}-`) && contaNoResultado(l)).forEach(l => {
    const mes = meses[Number(l.data.slice(5, 7)) - 1];
    [mes, total].forEach(m => {
      if (l.tipo === 'entrada') m.entradas += l.valor; else m.saidas += l.valor;
      m.resultado = m.entradas - m.saidas;
      m.porCategoria[l.categoria] = (m.porCategoria[l.categoria] ?? 0) + l.valor;
    });
  });
  return { meses, total };
}

/** Os meses do ano que têm algum lançamento, para marcar os botões. */
export const mesesComLancamento = (lancamentos: Pick<Lancamento, 'data'>[], ano: number) =>
  new Set(lancamentos.filter(l => l.data.startsWith(`${ano}-`)).map(l => l.data.slice(0, 7)));

/** Uma linha do quadro do ano: o rótulo, o tom do número e de onde ele sai em cada mês. */
export interface LinhaDoQuadro { id: string; rotulo: string; tom: 'entrada' | 'saida' | 'resultado'; valor: (m: MesDoPainel) => number }
const porCategoria = (c: CategoriaDeLancamento, tom: 'entrada' | 'saida'): LinhaDoQuadro =>
  ({ id: c, rotulo: nomeDaCategoria(c), tom, valor: m => m.porCategoria[c] ?? 0 });
/** O que cada visão do quadro mostra. Uma visão nova é uma entrada nova aqui. */
export const VISOES_DO_QUADRO = {
  resumo: { rotulo: 'Resumo', linhas: [
    { id: 'entradas', rotulo: 'Entradas', tom: 'entrada', valor: m => m.entradas },
    { id: 'saidas', rotulo: 'Saídas', tom: 'saida', valor: m => m.saidas },
    { id: 'resultado', rotulo: 'Resultado do mês', tom: 'resultado', valor: m => m.resultado }
  ] },
  entradas: { rotulo: 'Entradas', linhas: [porCategoria('recebimento', 'entrada'), porCategoria('outra_entrada', 'entrada')] },
  saidas: { rotulo: 'Saídas', linhas: [porCategoria('despesa', 'saida'), porCategoria('das', 'saida'), porCategoria('repasse', 'saida'),
    porCategoria('indicacao', 'saida'), porCategoria('divisao_lucro', 'saida')] }
} satisfies Record<string, { rotulo: string; linhas: LinhaDoQuadro[] }>;
export type VisaoDoQuadro = keyof typeof VISOES_DO_QUADRO;

// ---------- o extrato ----------
export type FiltroDeTipo = 'todos' | TipoDeLancamento;
export interface FiltroDoExtrato { mes: string | null; tipo: FiltroDeTipo; categoria: CategoriaDeLancamento | ''; conta: string; busca: string }
export const FILTRO_VAZIO: FiltroDoExtrato = { mes: null, tipo: 'todos', categoria: '', conta: '', busca: '' };
/** Algum filtro além do mês está ligado? É quando aparece "Limpar". */
export const temFiltroLigado = (f: FiltroDoExtrato) => f.tipo !== 'todos' || !!f.categoria || !!f.conta || !!f.busca.trim();

/** Os lançamentos que passam nos filtros, do mais novo para o mais antigo. A busca olha a descrição e a categoria, sem acento. */
export function filtrarExtrato(lancamentos: Lancamento[], f: FiltroDoExtrato): Lancamento[] {
  const termo = normal(f.busca);
  return lancamentos.filter(l => (!f.mes || l.data.startsWith(f.mes)) && (f.tipo === 'todos' || l.tipo === f.tipo)
    && (!f.categoria || l.categoria === f.categoria) && (!f.conta || l.conta_id === f.conta)
    && (!termo || normal(`${l.descricao} ${nomeDaCategoria(l.categoria)}`).includes(termo)))
    .toSorted((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
}

/** Os números do topo para o que está na tela: entradas e saídas sem os repasses entre contas e sem os ajustes. */
export function totaisDoExtrato(lancamentos: Lancamento[]) {
  const somar = (tipo: TipoDeLancamento) => lancamentos.filter(l => l.tipo === tipo && contaNoResultado(l)).reduce((s, l) => s + l.valor, 0);
  const entradas = somar('entrada'), saidas = somar('saida');
  return { entradas, saidas, resultado: entradas - saidas, quantos: lancamentos.length };
}

/** O extrato para abrir no Excel ou no Google Planilhas: separado por ponto e vírgula, vírgula nos centavos e BOM para os acentos. */
export function planilhaDoExtrato(lancamentos: Lancamento[], contas: Pick<ContaFinanceira, 'id' | 'nome'>[]) {
  const nomeDaConta = new Map(contas.map(c => [c.id, c.nome]));
  const celula = (v: string) => /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const linhas = lancamentos.map(l => [fmtData(l.data), nomeDaConta.get(l.conta_id) ?? '', l.descricao, nomeDaCategoria(l.categoria),
    l.tipo === 'entrada' ? 'Entrada' : 'Saída', centavosNoCampo(l.valor)].map(celula).join(';'));
  return '﻿' + ['Data;Conta;Descrição;Categoria;Tipo;Valor', ...linhas].join('\r\n');
}

// ---------- a carteira de contratos ----------
export type SituacaoNaCarteira = 'atrasado' | 'em_dia' | 'quitado';
export const SITUACOES_NA_CARTEIRA: Record<SituacaoNaCarteira, { nome: string; selo: 'erro' | 'pend' | 'ok' }> = {
  atrasado: { nome: 'Com atraso', selo: 'erro' }, em_dia: { nome: 'Em dia', selo: 'pend' }, quitado: { nome: 'Quitado', selo: 'ok' }
};
export interface ContratoNaCarteira {
  contratoId: string; codigo: string; cliente: string; responsavelId: string | null;
  parcelas: number; recebidas: number; total: number; recebido: number; falta: number; atrasado: number;
  /** A parcela que se recebe agora: a atrasada mais antiga ou, sem atraso, a próxima a vencer. */
  proxima: ParcelaDoEscritorio | null;
  situacao: SituacaoNaCarteira;
}
/** Cada contrato com o que já entrou e o que falta, pelas parcelas. Os com atraso vêm primeiro; depois, quem vence antes. */
export function carteiraDeContratos(parcelas: ParcelaDoEscritorio[], hoje: string): ContratoNaCarteira[] {
  const porContrato = new Map<string, ParcelaDoEscritorio[]>();
  parcelas.forEach(p => porContrato.set(p.contrato_id, [...(porContrato.get(p.contrato_id) ?? []), p]));
  return [...porContrato.values()].map((lista): ContratoNaCarteira => {
    const p0 = lista[0];
    const c: ContratoNaCarteira = { contratoId: p0.contrato_id, codigo: p0.contrato_codigo, cliente: p0.cliente_nome, responsavelId: p0.responsavel_id,
      parcelas: lista.length, recebidas: 0, total: 0, recebido: 0, falta: 0, atrasado: 0, proxima: null, situacao: 'quitado' };
    lista.toSorted((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero).forEach(p => {
      const situacao = situacaoDaParcela(p, hoje);
      if (situacao === 'recebida') { c.recebidas += 1; c.recebido += p.recebido ?? p.valor; c.total += p.recebido ?? p.valor; return; }
      c.total += p.valor; c.falta += p.valor;
      if (situacao === 'atrasada') c.atrasado += p.valor;
      c.proxima ??= p;
    });
    c.situacao = c.atrasado ? 'atrasado' : c.falta ? 'em_dia' : 'quitado';
    return c;
  }).toSorted((a, b) => ORDEM_NA_CARTEIRA[a.situacao] - ORDEM_NA_CARTEIRA[b.situacao]
    || (a.proxima?.vencimento ?? '').localeCompare(b.proxima?.vencimento ?? '') || a.codigo.localeCompare(b.codigo));
}
const ORDEM_NA_CARTEIRA: Record<SituacaoNaCarteira, number> = { atrasado: 0, em_dia: 1, quitado: 2 };

export interface FiltroDaCarteira { situacao: SituacaoNaCarteira | ''; busca: string }
/** A busca olha o código do contrato e o nome do cliente, sem acento. */
export function filtrarCarteira(lista: ContratoNaCarteira[], f: FiltroDaCarteira) {
  const termo = normal(f.busca);
  return lista.filter(c => (!f.situacao || c.situacao === f.situacao) && (!termo || normal(`${c.codigo} ${c.cliente}`).includes(termo)));
}
export function totaisDaCarteira(lista: ContratoNaCarteira[]) {
  return lista.reduce((t, c) => ({ total: t.total + c.total, recebido: t.recebido + c.recebido, falta: t.falta + c.falta, atrasado: t.atrasado + c.atrasado }),
    { total: 0, recebido: 0, falta: 0, atrasado: 0 });
}

// ---------- o lançamento rápido ----------
/** O que se lança na aba Lançar. O recebimento de cliente sai daqui: ele só entra pela parcela, para não contar duas vezes. */
export const CATEGORIAS_DO_LANCAR: Record<TipoDeLancamento, CategoriaDeLancamento[]> = {
  entrada: ['outra_entrada', 'ajuste_a_mais'],
  saida: ['despesa', 'das', 'repasse', 'indicacao', 'ajuste_a_menos']
};
