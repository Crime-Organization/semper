// Descrição de tarefas e demandas com negrito, itálico e listas (#293), com as marcas do Trello: **negrito** (ou __negrito__),
// *itálico* (ou _itálico_) e linhas que começam com "- " viram lista. O texto continua guardado como texto, com as marcas; esta
// regra só diz como mostrá-lo e como pôr ou tirar uma marca no trecho escolhido. A tela desenha os pedaços como elementos do
// React (nunca como HTML solto), então ninguém consegue esconder código numa descrição.

/** Os destaques de um trecho. */
export type Marca = 'negrito' | 'italico';

/** A marca que os botões e os atalhos põem no texto. */
export const MARCA_NO_TEXTO: Record<Marca, string> = { negrito: '**', italico: '*' };
/** O começo de uma linha de lista. */
export const ITEM_DE_LISTA = '- ';

/** Um pedaço da linha, com os destaques dele. */
export interface Pedaco { texto: string; marcas: Marca[] }
/** Um trecho do texto: linhas comuns (mostradas como foram escritas, com as quebras) ou os itens de uma lista. */
export interface Bloco { tipo: 'texto' | 'lista'; linhas: Pedaco[][] }

/** Quantos caracteres de uma sequência cada destaque usa: dois fecham um negrito, um fecha um itálico ("***" pode ser os dois). */
const MARCA_DO_PAR: Record<1 | 2, Marca> = { 1: 'italico', 2: 'negrito' };
/** Letra, número ou barra invertida: a marca colada a eles faz parte da palavra ("contrato_final_v2.pdf", "a*b*c"). */
const DA_PALAVRA = /[\p{L}\p{N}\\]/u;
const ESPACO = /\s/;
/** Cada sequência de "*" ou de "_" seguidos. */
const SEQUENCIA = /\*+|_+/g;

/** Uma sequência de marcas na linha e o que ela fez: quantos caracteres sobraram como texto, que destaques fechou e abriu. */
interface Sequencia { inicio: number; fim: number; ch: string; sobra: number; abre: boolean; fecha: boolean; fechaAqui: Marca[]; abreAqui: Marca[] }

/**
 * Os pedaços de uma linha, já com o negrito e o itálico (um dentro do outro também). Lê a linha uma vez só, sequência por
 * sequência, guardando as que podem abrir até uma que feche (sem isso, uma descrição longa com marcas soltas travava o cartão).
 * Só abre a sequência colada no começo de uma palavra (sem letra, número ou "\" antes, e sem espaço depois) e só fecha a colada
 * no fim de uma (sem espaço antes, e sem letra ou número depois). Marca aberta e nunca fechada fica como texto.
 */
export function pedacosDaLinha(linha: string): Pedaco[] {
  const sequencias: Sequencia[] = [...linha.matchAll(SEQUENCIA)].map(m => {
    const inicio = m.index, fim = inicio + m[0].length, antes = linha.charAt(inicio - 1), depois = linha.charAt(fim);
    return {
      inicio, fim, ch: m[0].charAt(0), sobra: m[0].length, fechaAqui: [], abreAqui: [],
      abre: depois !== '' && !ESPACO.test(depois) && !DA_PALAVRA.test(antes),
      fecha: antes !== '' && !ESPACO.test(antes) && !DA_PALAVRA.test(depois)
    };
  });
  const abertas: Sequencia[] = [];
  for (const s of sequencias) {
    for (let i = abertas.length - 1; s.fecha && s.sobra && i >= 0; i--) {
      const a = abertas[i];
      if (a.ch !== s.ch) continue;
      while (a.sobra && s.sobra) {
        const usa = a.sobra >= 2 && s.sobra >= 2 ? 2 : 1, marca = MARCA_DO_PAR[usa];
        a.sobra -= usa;
        s.sobra -= usa;
        a.abreAqui.unshift(marca);   // o par achado depois fica por fora
        s.fechaAqui.push(marca);
      }
      abertas.splice(a.sobra ? i + 1 : i);   // as que ficaram dentro do par não fecham mais
    }
    if (s.abre && s.sobra) abertas.push(s);
  }
  // Monta os pedaços: em cada sequência, primeiro fecha, depois o que sobrou como texto, depois abre.
  const pedacos: Pedaco[] = [], ativas: Marca[] = [];
  let texto = '', desde = 0;
  const soltar = () => { if (texto) pedacos.push({ texto, marcas: [...ativas] }); texto = ''; };
  for (const s of sequencias) {
    texto += linha.slice(desde, s.inicio);
    if (s.fechaAqui.length) soltar();
    for (const m of s.fechaAqui) ativas.splice(ativas.lastIndexOf(m), 1);
    texto += s.ch.repeat(s.sobra);
    if (s.abreAqui.length) soltar();
    ativas.push(...s.abreAqui);
    desde = s.fim;
  }
  texto += linha.slice(desde);
  soltar();
  return pedacos;
}

/** O texto em blocos: as linhas que começam com "- " seguidas viram uma lista; as outras ficam como foram escritas. */
export function blocosDoTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const linha of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const tipo = linha.startsWith(ITEM_DE_LISTA) ? 'lista' : 'texto', pedacos = pedacosDaLinha(tipo === 'lista' ? linha.slice(ITEM_DE_LISTA.length) : linha);
    const ultimo = blocos.at(-1);
    if (ultimo?.tipo === tipo) ultimo.linhas.push(pedacos);
    else blocos.push({ tipo, linhas: [pedacos] });
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

/** Uma linha em três partes: os espaços do começo, o miolo e os espaços do fim (a marca vai só em volta do miolo). */
function bordas(linha: string) {
  const miolo = linha.trim(), antes = miolo ? linha.slice(0, linha.length - linha.trimStart().length) : linha;
  return { antes, miolo, depois: linha.slice(antes.length + miolo.length) };
}

/**
 * Põe a marca em volta do trecho escolhido, ou a tira se ele já está marcado (por fora ou por dentro da escolha). Os espaços
 * das pontas ficam fora da marca, e um trecho de várias linhas ganha a marca em cada linha (a marca vale numa linha só). Sem
 * trecho escolhido, põe as duas marcas e deixa o cursor entre elas, para a pessoa escrever. O itálico conta os asteriscos
 * seguidos: um número ímpar ("*" ou "***") tem itálico; o negrito, dois ou mais.
 */
export function alternarMarca({ texto, inicio, fim }: Escolha, marca: Marca): Escolha {
  const m = MARCA_NO_TEXTO[marca], t = m.length, ch = m.charAt(0), escolhido = texto.slice(inicio, fim);
  const tem = (n: number) => marca === 'negrito' ? n >= 2 : n % 2 === 1;
  const seguidos = (s: string, de: number, passo: 1 | -1) => { let n = 0; while (s.charAt(de + n * passo) === ch) n++; return n; };
  if (tem(seguidos(texto, inicio - 1, -1)) && tem(seguidos(texto, fim, 1)))
    return { texto: texto.slice(0, inicio - t) + escolhido + texto.slice(fim + t), inicio: inicio - t, fim: fim - t };
  const naFrente = seguidos(escolhido, 0, 1), atras = seguidos(escolhido, escolhido.length - 1, -1);
  if (naFrente + atras < escolhido.length && tem(naFrente) && tem(atras))
    return { texto: texto.slice(0, inicio) + escolhido.slice(t, -t) + texto.slice(fim), inicio, fim: fim - 2 * t };
  if (escolhido.includes('\n')) {
    const novo = escolhido.split('\n').map(l => { const b = bordas(l); return b.miolo ? b.antes + m + b.miolo + m + b.depois : l; }).join('\n');
    return { texto: texto.slice(0, inicio) + novo + texto.slice(fim), inicio, fim: inicio + novo.length };
  }
  const b = bordas(escolhido), comeco = inicio + b.antes.length + t;
  return { texto: texto.slice(0, inicio) + b.antes + m + b.miolo + m + b.depois + texto.slice(fim), inicio: comeco, fim: comeco + b.miolo.length };
}

/** Põe "- " no começo de cada linha do trecho escolhido, ou tira de todas se todas já são da lista. Sem trecho, o cursor fica onde estava. */
export function alternarLista({ texto, inicio, fim }: Escolha): Escolha {
  const de = inicio ? texto.lastIndexOf('\n', inicio - 1) + 1 : 0, quebra = texto.indexOf('\n', Math.max(fim - 1, inicio)), ate = quebra < 0 ? texto.length : quebra;
  const linhas = texto.slice(de, ate).split('\n'), todas = linhas.every(l => l.startsWith(ITEM_DE_LISTA));
  const novas = linhas.map(l => todas ? l.slice(ITEM_DE_LISTA.length) : l.startsWith(ITEM_DE_LISTA) ? l : ITEM_DE_LISTA + l).join('\n');
  const passo = todas ? -ITEM_DE_LISTA.length : ITEM_DE_LISTA.length, cursor = Math.max(de, inicio + passo);
  return { texto: texto.slice(0, de) + novas + texto.slice(ate), inicio: cursor, fim: inicio === fim ? cursor : de + novas.length };
}
