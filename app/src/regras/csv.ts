// CSV: ler e escrever planilhas em texto (o formato que o Excel e o Google abrem e salvam).
// Regras puras: sem tela, sem banco.

export type SeparadorCSV = ',' | ';';

const BOM = '\uFEFF';
const FIM_DE_LINHA = '\r\n';

// Célula que precisa ir entre aspas: tem aspas, o separador ou quebra de linha, ou começa/termina com espaço.
const PRECISA_DE_ASPAS: Record<SeparadorCSV, RegExp> = {
  ',': /[",\r\n]|^\s|\s$/,
  ';': /[";\r\n]|^\s|\s$/
};

// Um campo por vez: entre aspas ("" vale uma aspa; aspas sem fechar vão até o fim do arquivo) ou sem aspas,
// seguido do separador, de uma quebra de linha (\r\n, \n ou \r) ou do fim do texto.
const CAMPO: Record<SeparadorCSV, RegExp> = {
  ',': /(?:"((?:[^"]|"")*)(?:"|$)(?=,|\r|\n|$)|([^,\r\n]*))(,|\r\n|\n|\r|$)/y,
  ';': /(?:"((?:[^"]|"")*)(?:"|$)(?=;|\r|\n|$)|([^;\r\n]*))(;|\r\n|\n|\r|$)/y
};

// O primeiro "," ou ";" fora de aspas na primeira linha. A aspa que fecha não pode vir seguida de outra, o (?!"):
// sem isso, "a""b" poderia ser uma célula ou duas, e uma 1ª linha sem separador faria a busca testar todas as
// divisões (o tempo dobra a cada "" e a aba trava).
const PRIMEIRO_SEPARADOR = /^(?:"(?:[^"]|"")*"(?!")|[^"\r\n,;])*([,;])/;
// Sem separador na primeira linha, o arquivo tem uma coluna só: qualquer separador serve.
const SEPARADOR_PADRAO: SeparadorCSV = ',';

export interface OpcoesLerCSV {
  /** Mantém as linhas totalmente vazias (inclusive ";;;"), para quem precisa do número de cada linha na planilha. */
  manterVazias?: boolean;
}

/** A linha não tem nenhuma célula preenchida (só vazias ou espaços). */
export const linhaVazia = (linha: string[]) => linha.every(c => c.trim() === '');

/** Lê CSV: tira o BOM; \r\n ou \n; "" dentro de aspas; quebra de linha dentro de aspas; separador ";" ou ","
 *  (o que aparecer primeiro fora de aspas na 1ª linha). Linhas totalmente vazias saem, a não ser com manterVazias. */
export function lerCSV(texto: string, { manterVazias = false }: OpcoesLerCSV = {}): string[][] {
  const t = texto.startsWith(BOM) ? texto.slice(BOM.length) : texto;
  const separador = (t.match(PRIMEIRO_SEPARADOR)?.[1] as SeparadorCSV | undefined) ?? SEPARADOR_PADRAO;
  const campo = new RegExp(CAMPO[separador]);
  const linhas: string[][] = [];
  let linha: string[] = [];
  for (let m = campo.exec(t); m; m = campo.exec(t)) {
    const [, entreAspas, semAspas, fim] = m;
    linha.push(entreAspas === undefined ? semAspas : entreAspas.replace(/""/g, '"'));
    if (fim === separador) continue;
    linhas.push(linha);
    linha = [];
    if (fim === '') break;
  }
  return manterVazias ? linhas : linhas.filter(l => !linhaVazia(l));
}

/** Uma célula pronta para o CSV: entre aspas (com "" no lugar de ") só quando precisa. */
export const celulaCSV = (v: string, separador: SeparadorCSV = ','): string =>
  PRECISA_DE_ASPAS[separador].test(v) ? `"${v.replace(/"/g, '""')}"` : v;

// Começo de célula que o Excel, o LibreOffice ou o Google Planilhas leriam como fórmula (injeção de fórmula).
const COMECO_DE_FORMULA = /^[=+\-@\t\r]/;
// O apóstrofo na frente faz a planilha mostrar o texto como texto, sem calcular.
const PREFIXO_DE_TEXTO = "'";
/** O apóstrofo que protegerFormulas pôs na frente de um começo de fórmula: quem lê o arquivo de volta o tira. */
export const PROTECAO_DE_FORMULA = /^'(?=[=+\-@\t\r])/;

/** Células que ficam sem proteção: as colunas listadas (pelo índice, a partir de 0) ou as que o predicado aceitar,
 *  pela coluna e pelo valor (assim só o telefone "+55 …" de verdade fica sem apóstrofo, não qualquer texto da coluna). */
export type ColunasIsentas = readonly number[] | ((coluna: number, valor: string) => boolean);

export interface OpcoesEscreverCSV {
  separador?: SeparadorCSV;
  /** Começa o arquivo com o BOM, para o Excel reconhecer UTF-8 (acentos). */
  bom?: boolean;
  /** Põe ' na frente das células que começam com = + - @ tab ou \r, para a planilha não as rodar como fórmula.
   *  `true` protege todas as colunas; `{ exceto }` deixa de fora as colunas listadas (ou as que o predicado aceitar). */
  protegerFormulas?: boolean | { exceto: ColunasIsentas };
}

function celulaProtegida(protegerFormulas: boolean | { exceto: ColunasIsentas }): (coluna: number, valor: string) => boolean {
  if (typeof protegerFormulas === 'boolean') return () => protegerFormulas;
  const { exceto } = protegerFormulas;
  return typeof exceto === 'function' ? (coluna, valor) => !exceto(coluna, valor) : coluna => !exceto.includes(coluna);
}

const semFormula = (v: string) => COMECO_DE_FORMULA.test(v) ? PREFIXO_DE_TEXTO + v : v;

/** Linhas → texto CSV, cada linha terminada em \r\n. Por padrão no modelo do SEMPER: ";" e BOM. */
export function escreverCSV(linhas: string[][], { separador = ';', bom = true, protegerFormulas = false }: OpcoesEscreverCSV = {}): string {
  const proteger = celulaProtegida(protegerFormulas);
  const corpo = linhas.map(l => l.map((v, i) => celulaCSV(proteger(i, v) ? semFormula(v) : v, separador)).join(separador) + FIM_DE_LINHA).join('');
  return (bom ? BOM : '') + corpo;
}

/** Bytes do arquivo → texto: UTF-8; se não for UTF-8 válido, windows-1252 (o Excel no Windows). Sem BOM. */
export function decodificarTexto(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
