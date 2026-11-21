// O calendário pequeno dos campos de data (#357): o mês na tela (semanas começando no domingo, como nos calendários do Brasil),
// o andar pelo teclado, os limites (min e max), o que a pessoa escreve à mão e os dois jeitos de guardar a data que as telas usam
// ("dd/mm/aaaa" como digitado, nos cadastros, ou "aaaa-mm-dd", nos campos que eram o calendário do navegador). Tudo puro, sem tela.
// As datas entram e saem como "aaaa-mm-dd", e as contas são feitas em UTC (somarDias), sobre a data pura: o fuso do aparelho não muda o dia.
import { DIAS_NA_SEMANA } from './agenda';
export { numeroDoDia } from './agenda';
import { DIAS_DA_SEMANA, MESES, dataExiste, dataPorExtenso, diaDaSemana } from './calendario';
import { fmtData, lerData, MASCARAS } from './pessoa';
import { somarDias } from './prazos';

/** Quantas semanas o mês mostra: sempre seis, para o calendário não mudar de altura de um mês para outro. */
export const SEMANAS_NO_CALENDARIO = 6;
/** Os meses de um ano, para o Shift+PageUp e o Shift+PageDown, que pulam um ano. */
const MESES_NO_ANO = 12;

/** O cabeçalho das colunas, de domingo a sábado: a inicial na tela e o nome inteiro para o leitor de tela. */
export const DIAS_DO_CABECALHO = DIAS_DA_SEMANA.map(nome => ({ inicial: nome[0].toUpperCase(), nome }));

const partes = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const doUTC = (d: Date) => d.toISOString().slice(0, 10);

/** O primeiro dia do mês de uma data. */
export const primeiroDoMes = (iso: string) => `${iso.slice(0, 7)}-01`;
/** Mesmo dia, n meses depois (negativo: antes). O dia que não existe no outro mês vira o último dele (31/01 + 1 mês = 28/02). */
export function somarMeses(iso: string, n: number) {
  const [a, m, d] = partes(iso);
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate();
  return doUTC(new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo))));
}
/** As semanas do mês na tela: do domingo antes do dia 1 em diante, seis semanas de sete dias (com pedaços dos meses vizinhos). */
export function semanasDoMes(mes: string): string[][] {
  const primeiro = primeiroDoMes(mes), [a, m, d] = partes(primeiro);
  const inicio = somarDias(primeiro, -new Date(Date.UTC(a, m - 1, d)).getUTCDay());
  return Array.from({ length: SEMANAS_NO_CALENDARIO }, (_, s) =>
    Array.from({ length: DIAS_NA_SEMANA }, (_, i) => somarDias(inicio, s * DIAS_NA_SEMANA + i)));
}
/** O dia é do mês mostrado? (Os dos meses vizinhos aparecem mais apagados.) */
export const doMes = (dia: string, mes: string) => dia.slice(0, 7) === mes.slice(0, 7);

/** O primeiro e o último dia que se pode escolher ("aaaa-mm-dd"); sem um deles, não há limite desse lado. */
export interface LimitesDaData { min?: string; max?: string }
/** O dia pode ser escolhido? */
export const dentroDosLimites = (dia: string, { min, max }: LimitesDaData) => (!min || dia >= min) && (!max || dia <= max);
/** O dia mais perto dentro dos limites. */
export const limitarDia = (dia: string, { min, max }: LimitesDaData) => min && dia < min ? min : max && dia > max ? max : dia;

/** O mês inteiro está fora dos limites? (A seta para ele fica desligada.) */
export function mesForaDosLimites(mes: string, { min, max }: LimitesDaData) {
  const de = primeiroDoMes(mes), ate = somarDias(somarMeses(de, 1), -1);
  return (!!min && ate < min) || (!!max && de > max);
}

/**
 * O que cada tecla faz com o dia em foco no calendário, como no padrão de calendário da WAI-ARIA: as setas andam um dia ou uma
 * semana, Home e End vão ao começo e ao fim da semana, PageUp e PageDown andam um mês (com Shift, um ano).
 */
export const TECLAS_DO_CALENDARIO: Record<string, (dia: string, comShift: boolean) => string> = {
  ArrowLeft: dia => somarDias(dia, -1),
  ArrowRight: dia => somarDias(dia, 1),
  ArrowUp: dia => somarDias(dia, -DIAS_NA_SEMANA),
  ArrowDown: dia => somarDias(dia, DIAS_NA_SEMANA),
  Home: dia => somarDias(dia, -posicaoNaSemana(dia)),
  End: dia => somarDias(dia, DIAS_NA_SEMANA - 1 - posicaoNaSemana(dia)),
  PageUp: (dia, comShift) => somarMeses(dia, comShift ? -MESES_NO_ANO : -1),
  PageDown: (dia, comShift) => somarMeses(dia, comShift ? MESES_NO_ANO : 1)
};
/** Quantos dias o dia está depois do domingo da semana dele (0 a 6). */
function posicaoNaSemana(iso: string) {
  const [a, m, d] = partes(iso);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}
/** Para onde a tecla leva o foco, já dentro dos limites; null se a tecla não é do calendário. */
export function andarComTecla(dia: string, tecla: string, comShift: boolean, limites: LimitesDaData = {}): string | null {
  const andar = TECLAS_DO_CALENDARIO[tecla];
  return andar ? limitarDia(andar(dia, comShift), limites) : null;
}

/** O título do mês: "novembro de 2026". */
export const tituloDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
/** O nome do dia para o leitor de tela, com o dia da semana: "quarta-feira, 18 de novembro de 2026". */
export const nomeDoDia = (dia: string) => `${diaDaSemana(dia)}, ${dataPorExtenso(dia)}`;

/** Data colada no formato do banco ou de uma planilha (aaaa-mm-dd). */
const DATA_ISO = /^\s*(\d{4}-\d{2}-\d{2})\s*$/;
/**
 * O que fica no campo enquanto a pessoa escreve: a máscara dd/mm/aaaa de sempre (MASCARAS.data). A data colada como aaaa-mm-dd
 * (de uma planilha ou de outro sistema) vira dd/mm/aaaa, em vez de os números se misturarem.
 */
export const textoDaDataDigitada = (texto: string) => {
  const iso = texto.match(DATA_ISO)?.[1];
  return iso && dataExiste(iso) ? fmtData(iso) : MASCARAS.data(texto);
};
/** A data escrita (dd/mm/aaaa, pelas regras de lerData) como "aaaa-mm-dd"; null se vazia, pela metade ou inexistente. */
export function isoDoTexto(texto: string): string | null {
  try { return lerData(texto); } catch { return null; }
}

/** Como a tela guarda a data do campo: "texto", dd/mm/aaaa como digitado (os cadastros conferem depois, com lerData); "iso", aaaa-mm-dd. */
export type FormatoDaData = 'texto' | 'iso';
interface ComoGuarda {
  /** O valor guardado como "aaaa-mm-dd", ou null se ele ainda não é uma data inteira. */
  paraIso: (valor: string) => string | null;
  /** A data escolhida no calendário, como a tela guarda. */
  doIso: (iso: string) => string;
  /** O que a tela guarda quando a pessoa escreve (o campo mostra o texto como ela escreveu). */
  doTexto: (texto: string) => string;
  /** O que o campo mostra para o valor guardado. */
  paraTexto: (valor: string) => string;
}
export const FORMATOS_DA_DATA: Record<FormatoDaData, ComoGuarda> = {
  texto: { paraIso: isoDoTexto, doIso: fmtData, doTexto: texto => texto, paraTexto: valor => valor },
  // Pela metade, a data ainda não vale: a tela recebe vazio, como o calendário do navegador fazia.
  iso: { paraIso: valor => dataExiste(valor) ? valor : null, doIso: iso => iso, doTexto: texto => isoDoTexto(texto) ?? '', paraTexto: valor => dataExiste(valor) ? fmtData(valor) : '' }
};

/** O mês que o calendário mostra ao abrir: o da data escolhida; sem ela, o de hoje (dentro dos limites). */
export const mesAoAbrir = (escolhido: string | null, hoje: string, limites: LimitesDaData = {}) => primeiroDoMes(escolhido ?? limitarDia(hoje, limites));
/** O dia que recebe o foco ao entrar no calendário: o escolhido, se está no mês mostrado; senão hoje, se está; senão o dia 1 (dentro dos limites). */
export function diaEmFoco(mes: string, escolhido: string | null, hoje: string, limites: LimitesDaData = {}) {
  const candidato = escolhido && doMes(escolhido, mes) ? escolhido : doMes(hoje, mes) ? hoje : primeiroDoMes(mes);
  return limitarDia(candidato, limites);
}

/** A mensagem termina com ponto (ou outra pontuação final)? */
const FIM_DE_FRASE = /[.!?]$/;
/**
 * O erro do campo de data e hora (#299), que mostra um só para as partes dele (a data, a hora, o lembrete): todas as mensagens, cada
 * uma uma vez. Uma só fica como veio; mais de uma vira frases seguidas, com ponto. Sem nenhuma, undefined (o campo sem erro).
 */
export function errosJuntos(...erros: (string | null | undefined)[]): string | undefined {
  const mensagens = [...new Set(erros.filter((e): e is string => !!e))];
  if (mensagens.length < 2) return mensagens[0];
  return mensagens.map(m => FIM_DE_FRASE.test(m) ? m : m + '.').join(' ');
}

/** De que lado do campo o calendário flutuante abre e, quando não cabe inteiro em nenhum, até que altura ele vai (e rola por dentro). */
export interface LadoDoCalendario { lado: 'abaixo' | 'acima'; alturaMaxima?: number }
/**
 * O lado do calendário flutuante (#395), pela altura dele e pelo espaço livre embaixo e em cima do campo, já sem as margens da tela:
 * embaixo, se cabe; senão em cima, se cabe; senão no lado com mais espaço, só até onde ele vai, para nada ficar fora da tela (a
 * janela baixa do notebook). Antes disso, quem abre tenta rolar a página para ele caber embaixo.
 */
export function ladoDoCalendario(altura: number, espacoAbaixo: number, espacoAcima: number): LadoDoCalendario {
  if (altura <= espacoAbaixo) return { lado: 'abaixo' };
  if (altura <= espacoAcima) return { lado: 'acima' };
  return espacoAbaixo >= espacoAcima ? { lado: 'abaixo', alturaMaxima: Math.max(0, espacoAbaixo) } : { lado: 'acima', alturaMaxima: Math.max(0, espacoAcima) };
}

/** Quantas letras tem a data inteira, escrita no campo (dd/mm/aaaa). */
const DATA_INTEIRA = 'dd/mm/aaaa'.length;
/**
 * O erro de uma data escrita inteira no campo que guarda aaaa-mm-dd (#395): esse campo só passa a data certa à tela, e a errada
 * chegaria como vazia ("Informe a data"). Com isto, o campo diz o que está errado ("Data inexistente."). Vazia, pela metade (a
 * pessoa ainda está escrevendo) ou certa, nada.
 */
export function erroDaDataEscrita(texto: string): string {
  if (texto.trim().length < DATA_INTEIRA) return '';
  try { lerData(texto); return ''; } catch (e) { return (e as Error).message; }
}
