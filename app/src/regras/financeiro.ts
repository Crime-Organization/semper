// A divisão de cada recebimento: quanto chega ao escritório, quanto fica com o responsável, quanto ele repassa e o que o
// escritório paga ao sócio que indicou. Tudo puro, sem tela nem banco. Os valores são em centavos (número inteiro), para a
// soma nunca perder um centavo; os percentuais são números como 4,5 ou 30. As regras foram confirmadas pelo escritório em
// 28/10 e 02/11/2026, com exemplos (veja financeiro.test.ts).

/** Quanto do que o cliente paga o advogado manda para a conta da empresa: um campo do contrato. */
export type ParteNaConta = 20 | 30 | 100;
export const PARTE_INTEGRAL: ParteNaConta = 100;

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
  taxaMaquina: number;
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

/** Centavos de um percentual, arredondando o meio para cima. O percentual vira inteiro antes da conta, para 4,35 não virar 4,3499…. */
const CASAS_DO_PERCENTUAL = 100;
const TODO = 100 * CASAS_DO_PERCENTUAL;
const parte = (centavos: number, percentual: number) => Math.round(centavos * Math.round(percentual * CASAS_DO_PERCENTUAL) / TODO);

/** O que há de errado no recebimento, ou null se dá para dividir. */
export function erroDoRecebimento(r: Recebimento): string | null {
  const inteiroPositivo = (v: number) => Number.isInteger(v) && v >= 0;
  if (!inteiroPositivo(r.valor) || r.valor === 0) return 'Informe o valor recebido.';
  if (!inteiroPositivo(r.taxaMaquina)) return 'A taxa da máquina precisa ser um valor em reais.';
  if (r.taxaMaquina > r.valor) return 'A taxa da máquina não pode ser maior que o valor recebido.';
  if (!(r.aliquotaDas >= 0 && r.aliquotaDas <= 100)) return 'O DAS precisa ser um percentual de 0 a 100.';
  if (r.terceiros.some(t => !(t.percentual > 0 && t.percentual <= 100))) return 'O percentual de cada pessoa precisa ser de 0 a 100.';
  const somaDosTerceiros = r.terceiros.reduce((s, t) => s + t.percentual, 0);
  if (somaDosTerceiros + PERCENTUAL_DO_ESCRITORIO.reduzido > 100) return 'A soma dos percentuais passa do que há para dividir.';
  if (r.parteNaConta !== PARTE_INTEGRAL) {
    // Abaixo da parte integral, os repasses saem do que ficou com o advogado.
    const ficou = r.valor - parte(r.valor, r.parteNaConta) - (r.contaComDas ? r.taxaMaquina : 0);
    const repasses = r.terceiros.reduce((s, t) => s + parte(r.valor, t.percentual), 0);
    if (repasses > ficou) return 'Os repasses passam do que ficou com o advogado.';
  }
  return null;
}

/** Com a parte integral na conta, o líquido se divide: o escritório fica com o percentual dele, cada terceiro com o seu, e o resto é do responsável. */
function dividirOLiquido(r: Recebimento, liquido: number) {
  const percentual = r.terceiros.length ? PERCENTUAL_DO_ESCRITORIO.reduzido : PERCENTUAL_DO_ESCRITORIO.normal;
  const escritorio = parte(liquido, percentual);
  const terceiros = r.terceiros.map(t => ({ id: t.id, valor: parte(liquido, t.percentual) }));
  return { escritorio, terceiros, responsavelRecebe: liquido - escritorio };
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
    // É dele a taxa da máquina e, do que ficou com ele, os repasses, calculados sobre o que o cliente pagou.
    const ficou = r.valor - naConta - taxaMaquina;
    const terceiros = r.terceiros.map(t => ({ id: t.id, valor: parte(r.valor, t.percentual) }));
    const repassado = terceiros.reduce((s, t) => s + t.valor, 0);
    const escritorio = naConta - das;
    return {
      naConta, ficouComOAdvogado: ficou, das, taxaMaquina, liquido: escritorio, escritorio, responsavelRecebe: 0, responsavelFica: ficou - repassado, terceiros, socioIndicador,
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
/** O percentual do DAS a partir de um mês ("aaaa-mm"). Ele muda de mês a mês, e os meses já fechados não mudam. */
export interface AliquotaDoMes { mes: string; aliquota: number }

/** O DAS de um mês: o lançado para ele ou, sem isso, o do último mês lançado antes. null se não há nenhum até aquele mês. */
export function dasDoMes(lista: AliquotaDoMes[], mes: string): number | null {
  const anteriores = lista.filter(a => a.mes <= mes).toSorted((a, b) => b.mes.localeCompare(a.mes));
  return anteriores[0]?.aliquota ?? null;
}

/** O que há de errado no DAS lançado, ou null. */
export function erroDoDas(a: AliquotaDoMes): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(a.mes)) return 'Escolha o mês.';
  if (!(a.aliquota >= 0 && a.aliquota <= 100)) return 'O DAS precisa ser um percentual de 0 a 100.';
  return null;
}
