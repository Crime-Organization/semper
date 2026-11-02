// As parcelas do contrato e o que acontece ao receber: quando nascem, como aparecem, os formulários e quem entra na divisão. Tudo puro,
// sem tela nem banco. Os valores são em centavos; as datas, "aaaa-mm-dd". Decisões do escritório de 02/11/2026:
// - as parcelas nascem quando o contrato chega à coluna de assinado, todo mês no mesmo dia (ou no último, no mês mais curto);
// - quota litis, sucumbência, pro bono e contrato sem valor não geram: lançam-se à mão;
// - o "desconto" do contrato não entra na conta (como em valorParcela);
// - ao receber, o valor pode ser ajustado, e a parcela conta como recebida, sem sobra automática;
// - quem é sócio sai de uma lista com datas, e vale quem era sócio na data do recebimento.
import type { CategoriaHonorario, Coluna, Contrato, Parcela, ParaReceber, ParticipanteGravado, RecebimentoGravado, Socio, TerceiroDoRecebimento } from '../dados/tipos';
import { VALOR_MAXIMO_DO_LANCAMENTO } from '../dados/limites';
import { anoAceito, dataExiste } from './calendario';
import { centavosNoCampo, fmtCentavos, paraCentavos } from './caixa';
import { lerDinheiro } from './contrato';
import { dasDoMes, dividirRecebimento, erroDoRecebimento, type Divisao, type Recebimento } from './financeiro';
import { fmtData } from './pessoa';

/** Cada categoria de honorário: gera parcelas sozinha ao ser assinado? Êxito e sucumbência dependem do resultado do caso. */
export const GERA_PARCELAS: Record<CategoriaHonorario, boolean> = { pro_labore: true, adiantamento_despesas: true, quota_litis: false, sucumbencia: false, pro_bono: false };

/** Só gera com a primeira data nesta faixa (o banco confere a mesma). */
const PRIMEIRA_DATA = { de: '2000-01-01', ate: '2100-12-31' };

/** A data alguns meses depois, no mesmo dia. No mês mais curto, cai no último dia, e o dia volta no mês seguinte. */
export function somarMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export interface ParcelaNova { vencimento: string; valor: number }
type CamposDasParcelas = Pick<Contrato, 'categoria' | 'valor' | 'entrada' | 'parcelas' | 'primeiro_pagamento' | 'assinado_em'>;

/** As parcelas de um contrato. A entrada é a primeira, o resto se divide nas seguintes, e o que sobra da divisão vai na última: a soma é
 *  sempre o valor do contrato. Sem primeiro pagamento, começa na assinatura; sem assinatura, hoje. */
export function parcelasDoContrato(k: CamposDasParcelas, hoje: string): ParcelaNova[] {
  const total = paraCentavos(k.valor ?? 0);
  if (!GERA_PARCELAS[k.categoria] || total <= 0) return [];
  const primeiro = k.primeiro_pagamento ?? k.assinado_em ?? hoje;
  if (primeiro < PRIMEIRA_DATA.de || primeiro > PRIMEIRA_DATA.ate) return [];
  const entrada = Math.min(paraCentavos(k.entrada ?? 0), total), resto = total - entrada, n = Math.max(k.parcelas ?? 1, 1);
  // Com entrada e uma parcela só, o resto ainda precisa de uma parcela para somar o valor do contrato.
  const partes = Math.min(entrada > 0 ? (resto > 0 ? Math.max(n - 1, 1) : 0) : n, resto);
  const base = partes > 0 ? Math.floor(resto / partes) : 0;
  const valores = [...(entrada > 0 ? [entrada] : []), ...Array.from({ length: partes }, (_, i) => i === partes - 1 ? resto - base * (partes - 1) : base)];
  return valores.map((valor, i) => ({ vencimento: somarMeses(primeiro, i), valor }));
}

/** O contrato já passou da assinatura: tem a data dela, ou está na coluna de assinado ou numa depois dela. */
export function chegouAoAssinado(colunas: Pick<Coluna, 'id' | 'ordem' | 'marco'>[], etapaId: string | null, assinadoEm: string | null) {
  if (assinadoEm) return true;
  const marco = colunas.find(c => c.marco === 'assinado'), atual = colunas.find(c => c.id === etapaId);
  return !!marco && !!atual && atual.ordem >= marco.ordem;
}

// ---------- como a parcela aparece ----------
export type SituacaoDaParcela = 'recebida' | 'atrasada' | 'a_receber';
export const SITUACOES_DA_PARCELA: Record<SituacaoDaParcela, { nome: string; selo: 'ok' | 'erro' | 'pend' }> = {
  recebida: { nome: 'Recebida', selo: 'ok' }, atrasada: { nome: 'Atrasada', selo: 'erro' }, a_receber: { nome: 'A receber', selo: 'pend' }
};
/** Vencer hoje ainda não é atraso. */
export const situacaoDaParcela = (p: Pick<Parcela, 'recebimento_id' | 'vencimento'>, hoje: string): SituacaoDaParcela =>
  p.recebimento_id ? 'recebida' : p.vencimento < hoje ? 'atrasada' : 'a_receber';

/** O total de cada situação. */
export function resumoDasParcelas(lista: Pick<Parcela, 'recebimento_id' | 'vencimento' | 'valor' | 'recebido'>[], hoje: string): Record<SituacaoDaParcela, number> {
  const soma: Record<SituacaoDaParcela, number> = { recebida: 0, atrasada: 0, a_receber: 0 };
  lista.forEach(p => { soma[situacaoDaParcela(p, hoje)] += p.recebimento_id ? p.recebido ?? p.valor : p.valor; });
  return soma;
}

/** A soma das parcelas é a do contrato? Ajustar à mão pode deixar diferente: é só um aviso. */
export function avisoDaSoma(lista: Pick<Parcela, 'valor'>[], valorDoContrato: number | null): string | null {
  if (!valorDoContrato || !lista.length) return null;
  const soma = lista.reduce((s, p) => s + p.valor, 0), contrato = paraCentavos(valorDoContrato);
  return soma === contrato ? null : `As parcelas somam ${fmtCentavos(soma)}, e o contrato é de ${fmtCentavos(contrato)}.`;
}

// ---------- formulários ----------
const dataBoa = (iso: string) => dataExiste(iso) && anoAceito(iso);
/** O valor digitado, em centavos. Vazio vale `vazio` (null: é erro), e o texto de erro já vem pronto para o campo. */
function lerCentavos(texto: string, vazio: number | null): { centavos: number } | { erro: string } {
  let reais: number | null;
  try { reais = lerDinheiro(texto); } catch (e) { return { erro: (e as Error).message }; }
  if (!reais) return vazio === null ? { erro: 'Informe o valor.' } : { centavos: vazio };
  const centavos = paraCentavos(reais);
  return centavos > VALOR_MAXIMO_DO_LANCAMENTO ? { erro: 'Esse valor é grande demais. Confira.' } : { centavos };
}

export interface FormDaParcela { vencimento: string; valor: string }
export const parcelaNova = (hoje: string): FormDaParcela => ({ vencimento: hoje, valor: '' });
export const formDaParcela = (p: Pick<Parcela, 'vencimento' | 'valor'>): FormDaParcela => ({ vencimento: p.vencimento, valor: centavosNoCampo(p.valor) });
export function errosDaParcela(f: FormDaParcela): Partial<Record<keyof FormDaParcela, string>> {
  const valor = lerCentavos(f.valor, null);
  return { ...(dataBoa(f.vencimento) ? {} : { vencimento: 'Informe uma data válida.' }), ...('erro' in valor ? { valor: valor.erro } : {}) };
}
export function dadosDaParcela(f: FormDaParcela): ParcelaNova {
  const valor = lerCentavos(f.valor, null);
  if ('erro' in valor) throw new Error(valor.erro);
  return { vencimento: f.vencimento, valor: valor.centavos };
}

export interface FormDoRecebimento { data: string; valor: string; contaId: string; taxa: string }
/** Vem com o valor da parcela e a conta que recolhe DAS, que é onde o dinheiro costuma entrar. */
export const recebimentoNovo = (p: Pick<Parcela, 'valor'>, hoje: string, contas: ParaReceber['contas']): FormDoRecebimento =>
  ({ data: hoje, valor: centavosNoCampo(p.valor), contaId: (contas.find(c => c.tem_das) ?? contas[0])?.id ?? '', taxa: '' });

/** A taxa só conta em conta com DAS: nas outras, o campo nem aparece. */
export function errosDoFormDeRecebimento(f: FormDoRecebimento, contaComDas: boolean): Partial<Record<keyof FormDoRecebimento, string>> {
  const valor = lerCentavos(f.valor, null), taxa = contaComDas ? lerCentavos(f.taxa, 0) : { centavos: 0 };
  return {
    ...(dataBoa(f.data) ? {} : { data: 'Informe uma data válida.' }),
    ...('erro' in valor ? { valor: valor.erro } : {}),
    ...(f.contaId ? {} : { contaId: 'Escolha a conta.' }),
    ...('erro' in taxa ? { taxa: taxa.erro } : {})
  };
}

/** O que o banco recebe: em conta sem DAS, não há taxa de máquina. */
export function dadosDoRecebimento(f: FormDoRecebimento, contaComDas: boolean): { data: string; valor: number; contaId: string; taxa: number } {
  const valor = lerCentavos(f.valor, null), taxa = contaComDas ? lerCentavos(f.taxa, 0) : { centavos: 0 };
  if ('erro' in valor) throw new Error(valor.erro);
  if ('erro' in taxa) throw new Error(taxa.erro);
  return { data: f.data, valor: valor.centavos, contaId: f.contaId, taxa: taxa.centavos };
}

/** A divisão que o banco vai fazer, para mostrar antes de salvar. O banco refaz a mesma conta. Com campo por preencher, o erro vem vazio: o aviso fica no campo. */
export function previaDoRecebimento(f: FormDoRecebimento, prep: ParaReceber): { divisao: Divisao; aliquota: number; aviso: string | null } | { erro: string } {
  const conta = prep.contas.find(c => c.id === f.contaId);
  if (!conta || Object.keys(errosDoFormDeRecebimento(f, conta.tem_das)).length) return { erro: '' };
  const das = dasDoMes(prep.das, f.data.slice(0, 7));
  if (conta.tem_das && !das) return { erro: 'Nenhum DAS lançado até este mês. Peça a um administrador para lançar.' };
  const dados = dadosDoRecebimento(f, conta.tem_das);
  const r: Recebimento = {
    valor: dados.valor, parteNaConta: prep.parte_na_conta, contaComDas: conta.tem_das, aliquotaDas: conta.tem_das ? das!.aliquota : 0, taxaMaquina: dados.taxa,
    terceiros: prep.terceiros.map(t => ({ id: t.id, percentual: t.percentual })), socioIndicador: prep.socio_indicador?.id ?? null, responsavelSocio: prep.responsavel_socio
  };
  const erro = erroDoRecebimento(r);
  if (erro) return { erro };
  return { divisao: dividirRecebimento(r), aliquota: r.aliquotaDas, aviso: conta.tem_das ? das!.aviso : null };
}

// ---------- como a divisão aparece ----------
export interface LinhaDaDivisao { rotulo: string; valor: number }
type NomeDe = (id: string) => string;
/** As linhas da divisão: o que entrou, o que saiu e quanto fica com cada um. O que é zero não aparece. */
export function linhasDaDivisao(d: Divisao, aliquota: number, nomeDe: NomeDe, responsavelSocio: boolean): LinhaDaDivisao[] {
  const todas: LinhaDaDivisao[] = [
    { rotulo: 'Entra na conta', valor: d.naConta },
    { rotulo: 'Fica direto com o advogado', valor: d.ficouComOAdvogado },
    { rotulo: `DAS (${aliquota.toLocaleString('pt-BR')}%)`, valor: d.das },
    { rotulo: 'Taxa da máquina', valor: d.taxaMaquina },
    { rotulo: 'Escritório', valor: d.escritorio },
    { rotulo: responsavelSocio ? 'O escritório manda ao responsável, para repassar' : 'O escritório manda ao responsável', valor: d.responsavelRecebe },
    ...d.terceiros.map(t => ({ rotulo: `O responsável repassa a ${nomeDe(t.id)}`, valor: t.valor })),
    { rotulo: 'Fica com o responsável', valor: d.responsavelFica },
    ...(d.socioIndicador ? [{ rotulo: `O escritório paga a ${nomeDe(d.socioIndicador.id)}, sócio que indicou`, valor: d.socioIndicador.valor }] : []),
    ...(d.socioIndicador ? [{ rotulo: 'Sobra no escritório', valor: d.escritorioFinal }] : []),
    { rotulo: 'Conta para o lucro do sócio responsável', valor: d.contribuicaoDoSocio }
  ];
  return todas.filter(l => l.valor !== 0);
}

/** O recebimento gravado no mesmo formato da prévia, para mostrar do mesmo jeito. */
export function divisaoGravada(r: RecebimentoGravado): Divisao {
  return {
    naConta: r.na_conta, ficouComOAdvogado: r.ficou_com_advogado, das: r.das, taxaMaquina: r.taxa_maquina, liquido: r.liquido, escritorio: r.escritorio, responsavelRecebe: r.responsavel_recebe,
    responsavelFica: r.responsavel_fica, terceiros: r.terceiros.map(t => ({ id: t.id, valor: t.valor })), socioIndicador: r.socio_indicador && { id: r.socio_indicador.id, valor: r.socio_indicador.valor }, escritorioFinal: r.escritorio_final, contribuicaoDoSocio: r.contribuicao_socio
  };
}

export const nomesDoRecebimento = (r: Pick<RecebimentoGravado, 'terceiros' | 'socio_indicador'>) =>
  new Map([...r.terceiros, ...(r.socio_indicador ? [r.socio_indicador] : [])].map(x => [x.id, x.nome]));

// ---------- sócios ----------
export interface FormDoSocio { desde: string; ate: string }
export function errosDoSocio(f: FormDoSocio): Partial<Record<keyof FormDoSocio, string>> {
  if (!dataBoa(f.desde)) return { desde: 'Informe desde quando.' };
  if (f.ate && !dataBoa(f.ate)) return { ate: 'Informe uma data válida, ou deixe em branco.' };
  return f.ate && f.ate < f.desde ? { ate: 'A saída não pode ser antes da entrada.' } : {};
}
export const dadosDoSocio = (f: FormDoSocio) => ({ desde: f.desde, ate: f.ate || null });
export const periodoDoSocio = (s: Pick<Socio, 'desde' | 'ate'>) => `desde ${fmtData(s.desde)}${s.ate ? ` até ${fmtData(s.ate)}` : ''}`;

type Periodo = Pick<Socio, 'pessoa_id' | 'desde' | 'ate'>;
export const eraSocio = (lista: Periodo[], pessoaId: string | null | undefined, data: string) =>
  !!pessoaId && lista.some(s => s.pessoa_id === pessoaId && s.desde <= data && (!s.ate || s.ate >= data));
/** Dois períodos da mesma pessoa não podem se cruzar. */
export const cruzaOutroPeriodo = (lista: (Periodo & { id: string })[], novo: Periodo & { id?: string }) =>
  lista.some(s => s.id !== novo.id && s.pessoa_id === novo.pessoa_id && s.desde <= (novo.ate ?? '9999-12-31') && (s.ate ?? '9999-12-31') >= novo.desde);

/** Quem entra na divisão de um contrato numa data, como no banco (privado.partes_do_recebimento): os participantes e o indicador que
 *  têm percentual são terceiros; o indicador que era sócio recebe os 10% do escritório, à parte. */
export function partesDoRecebimento(k: { participantes: ParticipanteGravado[]; indicador_id: string | null; indicador_percentual: number | null }, socios: Periodo[],
  pessoaDoResponsavel: string | null | undefined, data: string, nomeDe: NomeDe): Pick<ParaReceber, 'terceiros' | 'socio_indicador' | 'responsavel_socio'> {
  const indicadorSocio = eraSocio(socios, k.indicador_id, data);
  const terceiros: TerceiroDoRecebimento[] = k.participantes.filter(p => (p.percentual ?? 0) > 0).map(p => ({ id: p.pessoa_id, nome: nomeDe(p.pessoa_id), percentual: p.percentual! }));
  if (k.indicador_id && !indicadorSocio && (k.indicador_percentual ?? 0) > 0) terceiros.push({ id: k.indicador_id, nome: nomeDe(k.indicador_id), percentual: k.indicador_percentual! });
  return {
    terceiros, socio_indicador: indicadorSocio ? { id: k.indicador_id!, nome: nomeDe(k.indicador_id!) } : null, responsavel_socio: eraSocio(socios, pessoaDoResponsavel, data)
  };
}
