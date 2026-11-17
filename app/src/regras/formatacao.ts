// Descrição de tarefas e demandas com negrito, itálico e listas (#293), com as marcas do Trello: **negrito** (ou __negrito__),
// *itálico* (ou _itálico_) e linhas que começam com "- " viram lista. O texto continua guardado como texto, com as marcas; esta
// regra só diz como mostrá-lo e como pôr ou tirar uma marca no trecho escolhido. A tela desenha os pedaços como elementos do
// React (nunca como HTML solto), então ninguém consegue esconder código numa descrição.

/** Os destaques de um trecho. */
export type Marca = 'negrito' | 'italico';

/**
 * Como achar cada marca numa linha. Só vale na borda de palavra: antes da marca não pode haver letra nem número, e depois do
 * fechamento também não (assim "contrato_final_v2.pdf" e "joao_silva@exemplo.com" ficam como estão). Logo depois da abertura e
 * logo antes do fechamento não pode haver espaço, nem outra marca seguida de espaço ("5 * 3 * 2" e "** a **" também ficam).
 * Marca aberta e nunca fechada fica como texto.
 */
const ACHAR: Record<Marca, RegExp> = {
  negrito: /(?<![\p{L}\p{N}\\])(\*\*|__)(?!\s|[*_]\s)(.+?)(?<!\s|\s[*_])\1(?![\p{L}\p{N}*_])/u,
  italico: /(?<![\p{L}\p{N}\\])([*_])(?!\s|[*_]\s)(.+?)(?<!\s|\s[*_])\1(?![\p{L}\p{N}*_])/u
};
/** Na mesma posição, o negrito vale antes do itálico ("**a**" é negrito, e não itálico de "*a*"). */
const PRIMEIRO: Marca[] = ['negrito', 'italico'];

/** A marca que os botões e os atalhos põem no texto. */
export const MARCA_NO_TEXTO: Record<Marca, string> = { negrito: '**', italico: '*' };
/** O começo de uma linha de lista. */
export const ITEM_DE_LISTA = '- ';

/** Um pedaço da linha, com os destaques dele. */
export interface Pedaco { texto: string; marcas: Marca[] }
/** Um trecho do texto: linhas comuns (mostradas como foram escritas, com as quebras) ou os itens de uma lista. */
export interface Bloco { tipo: 'texto' | 'lista'; linhas: Pedaco[][] }

/** Os pedaços de uma linha, já com o negrito e o itálico (um dentro do outro também). */
export function pedacosDaLinha(linha: string, marcas: Marca[] = []): Pedaco[] {
  let achado: { marca: Marca; m: RegExpExecArray } | null = null;
  for (const marca of PRIMEIRO) {
    if (marcas.includes(marca)) continue;
    const m = ACHAR[marca].exec(linha);
    if (m && (!achado || m.index < achado.m.index)) achado = { marca, m };
  }
  if (!achado) return linha ? [{ texto: linha, marcas }] : [];
  const { marca, m } = achado;
  return [
    ...(m.index ? [{ texto: linha.slice(0, m.index), marcas }] : []),
    ...pedacosDaLinha(m[2], [...marcas, marca]),
    ...pedacosDaLinha(linha.slice(m.index + m[0].length), marcas)
  ];
}

/** O texto em blocos: as linhas que começam com "- " seguidas viram uma lista; as outras ficam como foram escritas. */
export function blocosDoTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const linha of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const tipo = linha.startsWith(ITEM_DE_LISTA) ? 'lista' : 'texto';
    if (blocos.at(-1)?.tipo !== tipo) blocos.push({ tipo, linhas: [] });
    blocos.at(-1)!.linhas.push(pedacosDaLinha(tipo === 'lista' ? linha.slice(ITEM_DE_LISTA.length) : linha));
  }
  // Uma linha em branco logo antes ou logo depois de uma lista só separa: a lista já tem o seu espaço.
  blocos.forEach((b, i) => {
    if (b.tipo !== 'texto') return;
    if (blocos[i - 1]?.tipo === 'lista' && !b.linhas[0]?.length) b.linhas.shift();
    if (blocos[i + 1]?.tipo === 'lista' && !b.linhas.at(-1)?.length) b.linhas.pop();
  });
  return blocos.filter(b => b.linhas.length);
}

/** O texto da caixa e o trecho escolhido nela, antes e depois de um botão ou atalho. */
export interface Escolha { texto: string; inicio: number; fim: number }

/**
 * Põe a marca em volta do trecho escolhido, ou a tira se ele já está marcado (por fora ou por dentro da escolha). Sem trecho
 * escolhido, põe as duas marcas e deixa o cursor entre elas, para a pessoa escrever.
 */
export function alternarMarca({ texto, inicio, fim }: Escolha, marca: Marca): Escolha {
  const m = MARCA_NO_TEXTO[marca], t = m.length, escolhido = texto.slice(inicio, fim);
  // O itálico ("*") não confunde com o negrito ("**") ao redor: só conta se a marca for exatamente a dele.
  const so = (antes: string, depois: string) => marca === 'negrito' || (antes !== '*' && depois !== '*');
  if (texto.slice(inicio - t, inicio) === m && texto.slice(fim, fim + t) === m && so(texto.charAt(inicio - t - 1), texto.charAt(fim + t)))
    return { texto: texto.slice(0, inicio - t) + escolhido + texto.slice(fim + t), inicio: inicio - t, fim: fim - t };
  if (escolhido.length > 2 * t && escolhido.startsWith(m) && escolhido.endsWith(m) && so(escolhido.charAt(t), escolhido.charAt(escolhido.length - t - 1)))
    return { texto: texto.slice(0, inicio) + escolhido.slice(t, -t) + texto.slice(fim), inicio, fim: fim - 2 * t };
  return { texto: texto.slice(0, inicio) + m + escolhido + m + texto.slice(fim), inicio: inicio + t, fim: fim + t };
}

/** Põe "- " no começo de cada linha do trecho escolhido, ou tira de todas se todas já são da lista. */
export function alternarLista({ texto, inicio, fim }: Escolha): Escolha {
  const de = texto.lastIndexOf('\n', inicio - 1) + 1, quebra = texto.indexOf('\n', Math.max(fim - 1, inicio)), ate = quebra < 0 ? texto.length : quebra;
  const linhas = texto.slice(de, ate).split('\n'), todas = linhas.every(l => l.startsWith(ITEM_DE_LISTA));
  const novas = linhas.map(l => todas ? l.slice(ITEM_DE_LISTA.length) : l.startsWith(ITEM_DE_LISTA) ? l : ITEM_DE_LISTA + l).join('\n');
  const passo = todas ? -ITEM_DE_LISTA.length : ITEM_DE_LISTA.length;
  return { texto: texto.slice(0, de) + novas + texto.slice(ate), inicio: Math.max(de, inicio + passo), fim: de + novas.length };
}
