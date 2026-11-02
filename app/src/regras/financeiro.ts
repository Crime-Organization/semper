// A divisão de cada recebimento: quanto chega ao escritório, quanto fica com o responsável, quanto ele repassa e o que o
// escritório paga ao sócio que indicou. Tudo puro, sem tela nem banco. Os valores são em centavos (número inteiro), para a
// soma nunca perder um centavo; os percentuais são números como 4,5 ou 30. As regras foram confirmadas pelo escritório em
// 28/10 e 02/11/2026, com exemplos (veja financeiro.test.ts). Decisões de 02/11/2026:
// - com terceiro de qualquer percentual, o escritório fica fixo em 20% do líquido, e o responsável, com o resto;
// - abaixo da parte integral, o terceiro recebe sobre o que o cliente pagou menos o DAS e a taxa (a conta da planilha);
// - abaixo da parte integral, a taxa da máquina é do advogado;
// - em conta sem DAS (PF, ESPÉCIE), vale a mesma parte do contrato: são situações pontuais.
import { lerPercentual } from './contrato';

/** Quanto do que o cliente paga o advogado manda para a conta da empresa: um campo do contrato. */
export type ParteNaConta = 20 | 30 | 100;
export const PARTE_INTEGRAL: ParteNaConta = 100;
export const PARTES_NA_CONTA: ParteNaConta[] = [20, 30, PARTE_INTEGRAL];

/** Quanto do líquido fica com o escritório: 30% normalmente, 20% quando há indicador que não é sócio ou outro advogado no caso. */
export const PERCENTUAL_DO_ESCRITORIO = { normal: 30, reduzido: 20 };
/** O sócio que indicou recebe sempre 10% do que o cliente pagou, seja qual for a parte que chegou à conta da empresa. */
export const PERCENTUAL_DO_SOCIO_INDICADOR = 10;

/** Quem recebe uma parte pelas mãos do responsável: indicador que não é sócio ou outro advogado do caso. */
export interface ParteDeTerceiro { id: string; percentual: number }

export interface Recebimento {
  /** O que o cliente pagou. */
  valor: number;
  parteNaConta: ParteNaConta;
  /** A conta recolhe DAS (a da empresa). Nas outras, o líquido é o próprio valor. */
  contaComDas: boolean;
  /** O percentual do DAS no mês (veja dasDoMes). */
  aliquotaDas: number;
  /** A taxa da máquina de cartão, quando houve. */
  taxaMaquina: number;
  terceiros: ParteDeTerceiro[];
  /** O sócio que indicou o cliente: quem recebe do escritório, à parte. */
  socioIndicador: string | null;
}

export interface Divisao {
  /** O que entrou na conta. */
  naConta: number;
  /** O que o advogado já ficou direto, quando a parte na conta é menor que a integral. */
  ficouComOAdvogado: number;
  das: number;
  /** Na parte integral, sai da conta; abaixo dela, do que ficou com o advogado. */
  taxaMaquina: number;
  /** O que o cliente pagou, menos o DAS e a taxa: é o que se divide. */
  liquido: number;
  /** A parte do escritório, antes de pagar o sócio que indicou. */
  escritorio: number;
  /** O que o escritório manda ao responsável (a parte dele e a dos terceiros, que passam por ele). */
  responsavelRecebe: number;
  /** O que sobra com o responsável, depois de repassar aos terceiros. */
  responsavelFica: number;
  /** O que o responsável repassa a cada terceiro. */
  terceiros: { id: string; valor: number }[];
  /** O que o escritório paga ao sócio que indicou. */
  socioIndicador: { id: string; valor: number } | null;
  /** O que sobra para o escritório, depois de pagar o sócio que indicou. */
  escritorioFinal: number;
}

/** Os percentuais têm até duas casas. Viram inteiros antes da conta, para 4,35 não virar 4,3499…. */
const CASAS_DO_PERCENTUAL = 100;
const TODO = 100 * CASAS_DO_PERCENTUAL;
const emInteiro = (percentual: number) => Math.round(percentual * CASAS_DO_PERCENTUAL);
/** Tolerância da conferência das casas: o computador guarda 4,35 como 4,3499…. */
const FOLGA = 1e-9;
const temAteDuasCasas = (percentual: number) => Math.abs(percentual * CASAS_DO_PERCENTUAL - emInteiro(percentual)) < FOLGA;
/** Centavos de um percentual, arredondando o meio para cima. */
const parte = (centavos: number, percentual: number) => Math.round(centavos * emInteiro(percentual) / TODO);

/** O que há de errado no recebimento, ou null se dá para dividir. */
export function erroDoRecebimento(r: Recebimento): string | null {
  const inteiroPositivo = (v: number) => Number.isInteger(v) && v >= 0;
  if (!inteiroPositivo(r.valor) || r.valor === 0) return 'Informe o valor recebido.';
  if (!inteiroPositivo(r.taxaMaquina)) return 'A taxa da máquina precisa ser um valor em reais.';
  if (r.taxaMaquina > r.valor) return 'A taxa da máquina não pode ser maior que o valor recebido.';
  if (!PARTES_NA_CONTA.includes(r.parteNaConta)) return 'Escolha quanto vai para a conta da empresa: 20%, 30% ou 100%.';
  if (erroDoPercentualDoDas(r.aliquotaDas)) return erroDoPercentualDoDas(r.aliquotaDas);
  if (r.terceiros.some(t => !(t.percentual > 0 && t.percentual <= 100 && temAteDuasCasas(t.percentual) && emInteiro(t.percentual) > 0))) return 'O percentual de cada pessoa precisa ser de 0 a 100, com até duas casas.';
  const somaDosTerceiros = r.terceiros.reduce((s, t) => s + emInteiro(t.percentual), 0);
  if (somaDosTerceiros + emInteiro(PERCENTUAL_DO_ESCRITORIO.reduzido) > TODO) return 'A soma dos percentuais passa do que há para dividir.';
  const integral = r.parteNaConta === PARTE_INTEGRAL;
  const naConta = integral ? r.valor : parte(r.valor, r.parteNaConta);
  const taxa = r.contaComDas ? r.taxaMaquina : 0;
  if (integral) return taxa + (r.contaComDas ? parte(naConta, r.aliquotaDas) : 0) > naConta ? 'A taxa da máquina e o DAS passam do que entrou na conta.' : null;
  // Abaixo da parte integral, a taxa e os repasses saem do que ficou com o advogado.
  const ficou = r.valor - naConta - taxa;
  if (ficou < 0) return 'A taxa da máquina passa do que ficou com o advogado.';
  const das = r.contaComDas ? parte(naConta, r.aliquotaDas) : 0;
  const repasses = r.terceiros.reduce((s, t) => s + parte(r.valor - das - taxa, t.percentual), 0);
  return repasses > ficou ? 'Os repasses passam do que ficou com o advogado.' : null;
}

/** Com a parte integral na conta, o líquido se divide: o escritório fica com o percentual dele, cada terceiro com o seu, e o resto é do responsável. */
function dividirOLiquido(r: Recebimento, liquido: number) {
  const percentual = r.terceiros.length ? PERCENTUAL_DO_ESCRITORIO.reduzido : PERCENTUAL_DO_ESCRITORIO.normal;
  const escritorio = parte(liquido, percentual);
  const terceiros = r.terceiros.map(t => ({ id: t.id, valor: parte(liquido, t.percentual) }));
  const responsavelRecebe = liquido - escritorio;
  // Com tudo dividido entre os terceiros, o arredondamento pode pedir centavos a mais: saem do último, e nunca ficam negativos.
  const excesso = terceiros.reduce((s, t) => s + t.valor, 0) - responsavelRecebe;
  if (excesso > 0) terceiros[terceiros.length - 1].valor -= excesso;
  return { escritorio, terceiros, responsavelRecebe };
}

/** Divide o recebimento. Lança erro se ele não servir (veja erroDoRecebimento). */
export function dividirRecebimento(r: Recebimento): Divisao {
  const erro = erroDoRecebimento(r);
  if (erro) throw new Error(erro);
  const integral = r.parteNaConta === PARTE_INTEGRAL;
  const naConta = integral ? r.valor : parte(r.valor, r.parteNaConta);
  const das = r.contaComDas ? parte(naConta, r.aliquotaDas) : 0;
  const taxaMaquina = r.contaComDas ? r.taxaMaquina : 0;
  const socioIndicador = r.socioIndicador ? { id: r.socioIndicador, valor: parte(r.valor, PERCENTUAL_DO_SOCIO_INDICADOR) } : null;

  if (!integral) {
    // Abaixo da parte integral, o que chega à conta fica com o escritório, que paga o DAS; o advogado já ficou com o resto.
    // É dele a taxa da máquina e, do que ficou com ele, saem os repasses.
    const ficou = r.valor - naConta - taxaMaquina;
    const liquido = r.valor - das - taxaMaquina;
    const terceiros = r.terceiros.map(t => ({ id: t.id, valor: parte(liquido, t.percentual) }));
    const repassado = terceiros.reduce((s, t) => s + t.valor, 0);
    const escritorio = naConta - das;
    return {
      naConta, ficouComOAdvogado: ficou, das, taxaMaquina, liquido, escritorio, responsavelRecebe: 0, responsavelFica: ficou - repassado, terceiros, socioIndicador,
      escritorioFinal: escritorio - (socioIndicador?.valor ?? 0)
    };
  }

  const liquido = naConta - das - taxaMaquina;
  const { escritorio, terceiros, responsavelRecebe } = dividirOLiquido(r, liquido);
  return {
    naConta, ficouComOAdvogado: 0, das, taxaMaquina, liquido, escritorio, responsavelRecebe, responsavelFica: responsavelRecebe - terceiros.reduce((s, t) => s + t.valor, 0), terceiros, socioIndicador,
    escritorioFinal: escritorio - (socioIndicador?.valor ?? 0)
  };
}

// ---------- DAS ----------
/** O percentual do DAS de um mês ("aaaa-mm"). Ele muda de mês a mês. Cada recebimento guarda o percentual que usou: corrigir o DAS depois não muda o que já foi recebido. */
export interface AliquotaDoMes { mes: string; aliquota: number }

const erroDoPercentualDoDas = (aliquota: number) =>
  aliquota >= 0 && aliquota <= 100 && temAteDuasCasas(aliquota) ? null : 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.';

/** O DAS de um mês: o lançado para ele ou, sem isso, o do último mês lançado antes, com aviso de que ninguém lançou o do mês.
 *  null se não há nenhum até aquele mês. */
export function dasDoMes(lista: AliquotaDoMes[], mes: string): { aliquota: number; aviso: string | null } | null {
  const ultimo = lista.filter(a => a.mes <= mes).toSorted((a, b) => b.mes.localeCompare(a.mes))[0];
  if (!ultimo) return null;
  return { aliquota: ultimo.aliquota, aviso: ultimo.mes === mes ? null : `O DAS deste mês ainda não foi lançado. Está valendo o de ${ultimo.mes.slice(5)}/${ultimo.mes.slice(0, 4)}.` };
}

/** O percentual digitado, ou o que há de errado com ele. */
export function lerAliquota(texto: string): { aliquota: number } | { erro: string } {
  if (!texto.trim()) return { erro: 'Informe o percentual.' };
  try {
    const aliquota = lerPercentual(texto);
    return aliquota === null ? { erro: 'Informe o percentual.' } : { aliquota };
  } catch { return { erro: 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.' }; }
}

/** O que há de errado no DAS lançado, ou null. */
export function erroDoDas(a: AliquotaDoMes): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(a.mes)) return 'Escolha o mês.';
  return erroDoPercentualDoDas(a.aliquota);
}
