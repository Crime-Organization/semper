// O caixa do escritório: as categorias de cada lançamento, a conferência dos formulários e o saldo de cada dia. Tudo puro, sem tela
// nem banco. Os valores são em centavos (número inteiro) e aparecem em reais; as datas são "aaaa-mm-dd", e os meses, "aaaa-mm".
import type { CategoriaDeLancamento, ContaFinanceira, DadosConta, DadosLancamento, Lancamento, TipoDeLancamento } from '../dados/tipos';
import { TAMANHO_FINANCEIRO, VALOR_MAXIMO_DO_LANCAMENTO } from '../dados/limites';
import { anoAceito, dataExiste } from './calendario';
import { dinheiroNoCampo, fmtDinheiro, lerDinheiro } from './contrato';
import { fmtData } from './pessoa';
import { somarDias } from './prazos';

/** Reais em centavos, sem perder um centavo por causa do computador. */
export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const fmtCentavos = (centavos: number) => fmtDinheiro(centavos / 100);
export const centavosNoCampo = (centavos: number) => dinheiroNoCampo(centavos / 100);

/** Cada categoria: o nome e o tipo a que serve. A transferência é à parte: tem uma ponta de cada tipo, e o sistema a cria. */
export const CATEGORIAS: Record<Exclude<CategoriaDeLancamento, 'transferencia'>, { nome: string; tipo: TipoDeLancamento }> = {
  recebimento: { nome: 'Recebimento de cliente', tipo: 'entrada' },
  outra_entrada: { nome: 'Outra entrada', tipo: 'entrada' },
  despesa: { nome: 'Despesa', tipo: 'saida' },
  das: { nome: 'DAS', tipo: 'saida' },
  repasse: { nome: 'Repasse a advogado', tipo: 'saida' },
  indicacao: { nome: 'Indicação', tipo: 'saida' },
  divisao_lucro: { nome: 'Divisão de lucro', tipo: 'saida' }
};
export const nomeDaCategoria = (c: CategoriaDeLancamento) => c === 'transferencia' ? 'Repasse entre contas' : CATEGORIAS[c].nome;
export const CATEGORIAS_EM_ORDEM = Object.keys(CATEGORIAS) as (keyof typeof CATEGORIAS)[];

const dataBoa = (iso: string) => dataExiste(iso) && anoAceito(iso);
/** O valor digitado, em centavos; ou o que há de errado com ele. */
function lerValor(texto: string): { centavos: number } | { erro: string } {
  let reais: number | null;
  try { reais = lerDinheiro(texto); } catch (e) { return { erro: (e as Error).message }; }
  if (!reais) return { erro: 'Informe o valor.' };
  const centavos = paraCentavos(reais);
  return centavos > VALOR_MAXIMO_DO_LANCAMENTO ? { erro: 'Esse valor é grande demais. Confira.' } : { centavos };
}

// ---------- lançamento ----------
export interface FormDoLancamento { contaId: string; data: string; categoria: keyof typeof CATEGORIAS; valor: string; descricao: string }
export const lancamentoNovo = (contaId: string, hoje: string): FormDoLancamento => ({ contaId, data: hoje, categoria: 'recebimento', valor: '', descricao: '' });
export const formDoLancamento = (l: Lancamento): FormDoLancamento => ({ contaId: l.conta_id, data: l.data, categoria: l.categoria as keyof typeof CATEGORIAS, valor: centavosNoCampo(l.valor), descricao: l.descricao });

type ErrosDoLancamento = Partial<Record<'contaId' | 'data' | 'valor' | 'descricao', string>>;
function errosComuns(f: { data: string; valor: string; descricao: string }, conta: Pick<ContaFinanceira, 'saldo_inicial_em'> | undefined): ErrosDoLancamento {
  const erros: ErrosDoLancamento = {};
  if (!dataBoa(f.data)) erros.data = 'Informe uma data válida.';
  else if (conta && f.data < conta.saldo_inicial_em) erros.data = `A conta começa em ${fmtData(conta.saldo_inicial_em)}, com o saldo inicial.`;
  const valor = lerValor(f.valor);
  if ('erro' in valor) erros.valor = valor.erro;
  if (!f.descricao.trim()) erros.descricao = 'Diga do que se trata.';
  else if (f.descricao.trim().length > TAMANHO_FINANCEIRO.descricao) erros.descricao = `Use até ${TAMANHO_FINANCEIRO.descricao} caracteres.`;
  return erros;
}
export function errosDoLancamento(f: FormDoLancamento, conta: Pick<ContaFinanceira, 'saldo_inicial_em'> | undefined): ErrosDoLancamento {
  return { ...errosComuns(f, conta), ...(f.contaId ? {} : { contaId: 'Escolha a conta.' }) };
}
export function dadosDoLancamento(f: FormDoLancamento): DadosLancamento {
  const valor = lerValor(f.valor);
  if ('erro' in valor) throw new Error(valor.erro);
  return { conta_id: f.contaId, data: f.data, tipo: CATEGORIAS[f.categoria].tipo, categoria: f.categoria, valor: valor.centavos, descricao: f.descricao.trim() };
}

// ---------- transferência ----------
export interface FormDaTransferencia { de: string; para: string; data: string; valor: string; descricao: string }
/** O repasse de quando a empresa paga o que a conta dela não pode pagar: não é lucro. */
export const DESCRICAO_DO_REPASSE = 'Repasse da PJ para a PF';
export const transferenciaNova = (de: string, para: string, hoje: string): FormDaTransferencia => ({ de, para, data: hoje, valor: '', descricao: DESCRICAO_DO_REPASSE });
export function errosDaTransferencia(f: FormDaTransferencia, contas: Pick<ContaFinanceira, 'id' | 'saldo_inicial_em'>[]) {
  const achar = (id: string) => contas.find(c => c.id === id);
  const inicioMaisTarde = [achar(f.de), achar(f.para)].filter(c => !!c).map(c => c.saldo_inicial_em).toSorted().at(-1);
  const erros: ErrosDoLancamento & { para?: string } = errosComuns(f, inicioMaisTarde ? { saldo_inicial_em: inicioMaisTarde } : undefined);
  if (!f.de || !f.para) erros.para = 'Escolha as duas contas.';
  else if (f.de === f.para) erros.para = 'Escolha duas contas diferentes.';
  return erros;
}
export function dadosDaTransferencia(f: FormDaTransferencia) {
  const valor = lerValor(f.valor);
  if ('erro' in valor) throw new Error(valor.erro);
  return { de: f.de, para: f.para, data: f.data, valor: valor.centavos, descricao: f.descricao.trim() };
}

// ---------- conta ----------
export interface FormDaConta { nome: string; temDas: boolean; saldoInicial: string; saldoInicialEm: string }
export const contaNova = (hoje: string): FormDaConta => ({ nome: '', temDas: false, saldoInicial: '0,00', saldoInicialEm: hoje });
/** O saldo inicial pode ser negativo (conta que começou no vermelho). */
function lerSaldo(texto: string): { centavos: number } | { erro: string } {
  const t = texto.trim(), negativo = t.startsWith('-');
  try {
    const reais = lerDinheiro(negativo ? t.slice(1) : t);
    if (reais === null) return { erro: 'Informe o saldo inicial.' };
    return { centavos: (negativo ? -1 : 1) * paraCentavos(reais) };
  } catch (e) { return { erro: (e as Error).message }; }
}
export function errosDaConta(f: FormDaConta, existentes: Pick<ContaFinanceira, 'id' | 'nome'>[], normal: (t: string) => string, id?: string) {
  const erros: Partial<Record<'nome' | 'saldoInicial' | 'saldoInicialEm', string>> = {};
  if (!f.nome.trim()) erros.nome = 'Dê um nome à conta.';
  else if (f.nome.trim().length > TAMANHO_FINANCEIRO.nomeDaConta) erros.nome = `Use até ${TAMANHO_FINANCEIRO.nomeDaConta} caracteres.`;
  else if (existentes.some(c => c.id !== id && normal(c.nome) === normal(f.nome))) erros.nome = 'Já existe uma conta com esse nome.';
  const saldo = lerSaldo(f.saldoInicial);
  if ('erro' in saldo) erros.saldoInicial = saldo.erro;
  if (!dataBoa(f.saldoInicialEm)) erros.saldoInicialEm = 'Informe uma data válida.';
  return erros;
}
export function dadosDaConta(f: FormDaConta): DadosConta {
  const saldo = lerSaldo(f.saldoInicial);
  if ('erro' in saldo) throw new Error(saldo.erro);
  return { nome: f.nome.trim(), tem_das: f.temDas, saldo_inicial: saldo.centavos, saldo_inicial_em: f.saldoInicialEm };
}

// ---------- o mês ----------
/** O mês de uma data. */
export const mesDe = (iso: string) => iso.slice(0, 7);
/** O primeiro e o último dia do mês. */
export function diasDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const seguinte = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  return { de: `${mes}-01`, ate: somarDias(seguinte, -1) };
}
export const mesValido = (mes: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);

export interface LinhaDoCaixa { lancamento: Lancamento; saldo: number; fimDoDia: boolean }
export interface MesDoCaixa { linhas: LinhaDoCaixa[]; saldoAnterior: number; entradas: number; saidas: number; saldoFinal: number }

/** Os lançamentos do mês em ordem, cada um com o saldo depois dele, marcando o último de cada dia: é o saldo a comparar com o banco. */
export function mesDoCaixa(lancamentos: Lancamento[], saldoAnterior: number): MesDoCaixa {
  const ordem = lancamentos.toSorted((a, b) => a.data.localeCompare(b.data) || a.criado_em.localeCompare(b.criado_em));
  let saldo = saldoAnterior, entradas = 0, saidas = 0;
  const linhas = ordem.map((l, i): LinhaDoCaixa => {
    if (l.tipo === 'entrada') { saldo += l.valor; entradas += l.valor; } else { saldo -= l.valor; saidas += l.valor; }
    return { lancamento: l, saldo, fimDoDia: ordem[i + 1]?.data !== l.data };
  });
  return { linhas, saldoAnterior, entradas, saidas, saldoFinal: saldo };
}

/** Os nomes de cada campo no histórico do lançamento. */
export const CAMPOS_DO_LANCAMENTO: Record<string, string> = { conta: 'Conta', data: 'Data', tipo: 'Tipo', categoria: 'Categoria', valor: 'Valor', descricao: 'Descrição', excluido_em: 'Exclusão' };
const FORMATOS: Record<string, (v: unknown) => string> = {
  valor: v => fmtCentavos(Number(v)),
  data: v => fmtData(String(v)),
  tipo: v => v === 'entrada' ? 'Entrada' : 'Saída',
  categoria: v => nomeDaCategoria(v as CategoriaDeLancamento),
  excluido_em: () => 'Excluído'
};
export const valorNoHistorico = (campo: string, v: unknown) => v === null || v === undefined ? '—' : (FORMATOS[campo] ?? String)(v);
