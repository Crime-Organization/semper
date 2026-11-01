// Número único do processo judicial, no padrão do CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO.
//   NNNNNNN  sequencial do processo no ano, na origem
//   DD       dígito verificador (módulo 97)
//   AAAA     ano de ajuizamento
//   J        segmento da Justiça (8 = estadual, 4 = federal…)
//   TR       tribunal dentro do segmento (13 = MG na Justiça estadual, 06 = TRF da 6ª Região…)
//   OOOO     unidade de origem (comarca, seção ou subseção)
// Tudo puro: conferir, formatar, separar as partes e sugerir o órgão de tramitação.
import { dig } from './pessoa';

/** Quantos algarismos tem o número completo. */
export const DIGITOS_DO_CNJ = 20;
/** Base do dígito verificador (ISO 7064, módulo 97). */
const MODULO = 97;

/** As partes do número, como texto (com os zeros à esquerda). */
export interface PartesCNJ {
  sequencial: string;
  digito: string;
  ano: string;
  segmento: string;
  tribunal: string;
  origem: string;
}

/** Separa as partes de um número com os 20 algarismos (com ou sem pontuação). Null se não tiver 20 algarismos. */
export function partesDoCNJ(numero: string | null | undefined): PartesCNJ | null {
  const d = dig(numero);
  if (d.length !== DIGITOS_DO_CNJ) return null;
  return { sequencial: d.slice(0, 7), digito: d.slice(7, 9), ano: d.slice(9, 13), segmento: d.slice(13, 14), tribunal: d.slice(14, 16), origem: d.slice(16, 20) };
}

/** Resto da divisão por 97 de um número escrito em texto (grande demais para Number). */
function resto97(algarismos: string) {
  let r = 0;
  for (const c of algarismos) r = (r * 10 + Number(c)) % MODULO;
  return r;
}

/** O dígito verificador certo para as outras partes (dois algarismos). */
export function digitoDoCNJ(p: Omit<PartesCNJ, 'digito'>) {
  const dv = MODULO + 1 - resto97(p.sequencial + p.ano + p.segmento + p.tribunal + p.origem + '00');
  return String(dv).padStart(2, '0');
}

/** O número tem 20 algarismos e o dígito verificador confere. */
export function cnjValido(numero: string | null | undefined) {
  const p = partesDoCNJ(numero);
  return !!p && p.digito === digitoDoCNJ(p);
}

/** NNNNNNN-DD.AAAA.J.TR.OOOO; o texto como veio se não tiver 20 algarismos. */
export function fmtCNJ(numero: string | null | undefined) {
  const p = partesDoCNJ(numero);
  return p ? `${p.sequencial}-${p.digito}.${p.ano}.${p.segmento}.${p.tribunal}.${p.origem}` : String(numero ?? '');
}

/** Pontua enquanto se digita: só algarismos, até 20, com os separadores nos lugares. */
export function mascaraCNJ(texto: string) {
  const d = dig(texto).slice(0, DIGITOS_DO_CNJ);
  const cortes: [number, string][] = [[7, '-'], [9, '.'], [13, '.'], [14, '.'], [16, '.']];
  let saida = '';
  for (let i = 0; i < d.length; i++) {
    const corte = cortes.find(([pos]) => pos === i);
    if (corte) saida += corte[1];
    saida += d[i];
  }
  return saida;
}

/** O que há de errado no número digitado, ou null se estiver certo. */
export function erroDoCNJ(numero: string | null | undefined): string | null {
  const d = dig(numero);
  if (d.length !== DIGITOS_DO_CNJ) return `O número do processo tem ${DIGITOS_DO_CNJ} algarismos (NNNNNNN-DD.AAAA.J.TR.OOOO).`;
  return cnjValido(d) ? null : 'O dígito verificador não confere: confira o número do processo.';
}

// ---------- órgão de tramitação ----------
/** Os segmentos da Justiça (o algarismo J). */
export const SEGMENTOS: Record<string, string> = {
  1: 'Supremo Tribunal Federal', 2: 'Conselho Nacional de Justiça', 3: 'Superior Tribunal de Justiça', 4: 'Justiça Federal',
  5: 'Justiça do Trabalho', 6: 'Justiça Eleitoral', 7: 'Justiça Militar da União', 8: 'Justiça Estadual', 9: 'Justiça Militar Estadual'
};

/** Os estados na ordem dos códigos TR da Justiça estadual e eleitoral (01 = AC … 27 = TO). */
const UFS_DO_CNJ = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS',
  'RO', 'RR', 'SC', 'SE', 'SP', 'TO'];
const ufDoTribunal = (tr: string) => UFS_DO_CNJ[Number(tr) - 1] ?? null;
/** Código TR que, nos segmentos com tribunal superior, é o próprio tribunal superior. */
const TRIBUNAL_SUPERIOR = '00';

/** Sigla do tribunal pelo segmento e pelo TR. Uma entrada por segmento; null quando o código não existe. */
const SIGLA_POR_SEGMENTO: Record<string, (tr: string) => string | null> = {
  1: () => 'STF',
  2: () => 'CNJ',
  3: () => 'STJ',
  4: tr => Number(tr) >= 1 && Number(tr) <= 6 ? `TRF${Number(tr)}` : null,
  5: tr => tr === TRIBUNAL_SUPERIOR ? 'TST' : Number(tr) >= 1 && Number(tr) <= 24 ? `TRT${Number(tr)}` : null,
  6: tr => tr === TRIBUNAL_SUPERIOR ? 'TSE' : ufDoTribunal(tr) ? `TRE-${ufDoTribunal(tr)}` : null,
  7: () => 'STM',
  8: tr => ufDoTribunal(tr) === 'DF' ? 'TJDFT' : ufDoTribunal(tr) ? `TJ${ufDoTribunal(tr)}` : null,
  9: tr => ['MG', 'RS', 'SP'].includes(ufDoTribunal(tr) ?? '') ? `TJM${ufDoTribunal(tr)}` : null
};

/** O órgão de tramitação que o número indica (ex.: "TJMG", "TRF6"), para sugerir no cadastro. Null se não der para saber. */
export function orgaoDoCNJ(numero: string | null | undefined): string | null {
  const p = partesDoCNJ(numero);
  return p ? SIGLA_POR_SEGMENTO[p.segmento]?.(p.tribunal) ?? null : null;
}
