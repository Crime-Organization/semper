// Descrição de tarefas e demandas com negrito, itálico e listas (#293), com as marcas do Trello: **negrito** (ou __negrito__),
// *itálico* (ou _itálico_) e linhas que começam com "- " viram lista. Desde a #303 também há títulos ("# ", "## " e "### " no
// começo da linha) e links ([texto](https://…)), só para endereços http, https e mailto. O texto continua guardado como texto,
// com as marcas; esta regra só diz como mostrá-lo e como pôr ou tirar uma marca no trecho escolhido. A tela desenha os pedaços
// como elementos do React (nunca como HTML solto), então ninguém consegue esconder código numa descrição.

/** Os destaques de um trecho. */
export type Marca = 'negrito' | 'italico';

/** A marca que os botões e os atalhos põem no texto. */
export const MARCA_NO_TEXTO: Record<Marca, string> = { negrito: '**', italico: '*' };
/** O começo de uma linha de lista. */
export const ITEM_DE_LISTA = '- ';
/** O começo de linha que cada botão põe: a lista e o título do meio ("#" e "###" a pessoa escreve). */
export const INICIO_NO_TEXTO = { lista: ITEM_DE_LISTA, titulo: '## ' } as const;
export type InicioDeLinha = keyof typeof INICIO_NO_TEXTO;
/** O maior endereço aceito num link (o que os navegadores abrem sem problema). */
export const TAMANHO_DO_ENDERECO = 2048;

/** Um pedaço da linha, com os destaques dele e, se estiver num link, o endereço já conferido. */
export interface Pedaco { texto: string; marcas: Marca[]; link?: string }
/** O nível de um título: "#" é 1, "##" é 2, "###" é 3. */
export type NivelTitulo = 1 | 2 | 3;
/** Um trecho do texto: linhas comuns (mostradas como foram escritas, com as quebras), os itens de uma lista ou um título. */
export type Bloco =
  | { tipo: 'texto'; linhas: Pedaco[][] }
  | { tipo: 'lista'; linhas: Pedaco[][] }
  | { tipo: 'titulo'; nivel: NivelTitulo; linhas: Pedaco[][] };
export type TipoBloco = Bloco['tipo'];

/** Os únicos endereços que viram link; o resto fica como texto. */
const PROTOCOLO_PERMITIDO = new Set(['http:', 'https:', 'mailto:']);

/** O endereço como ele vai no texto: parênteses viram %28 e %29, que dizem o mesmo e não fecham o link antes da hora. */
const enderecoNoTexto = (endereco: string) => endereco.replace(/\(/g, '%28').replace(/\)/g, '%29');

/**
 * O endereço pronto para o link, ou null se ele não puder virar link: só endereços completos (com "https://", "http://" ou
 * "mailto:"), nunca "javascript:", "data:" ou um endereço pela metade ("/pagina", "www.site.com"). Devolve o endereço como o
 * navegador o entende (new URL), já como ele vai no texto (parênteses codificados), e só ele vai para o href. O tamanho e os
 * espaços são conferidos nesse endereço final, e não no escrito: o navegador codifica os acentos (um "ç" vira "%C3%A7") e
 * deixa os espaços de um "mailto:", e o que passasse do limite ou tivesse espaço seria gravado mas nunca lido como link.
 */
export function linkPermitido(endereco: string): string | null {
  if (endereco.length > TAMANHO_DO_ENDERECO) return null;
  try {
    const u = new URL(endereco), final = enderecoNoTexto(u.href);
    const cabe = final.length <= TAMANHO_DO_ENDERECO && !ESPACO.test(final);
    return PROTOCOLO_PERMITIDO.has(u.protocol) && cabe ? final : null;
  } catch { return null; }
}

/** Quantos caracteres de uma sequência cada destaque usa: dois fecham um negrito, um fecha um itálico ("***" pode ser os dois). */
const MARCA_DO_PAR: Record<1 | 2, Marca> = { 1: 'italico', 2: 'negrito' };
/** Letra, número ou barra invertida: a marca colada a eles faz parte da palavra ("contrato_final_v2.pdf", "a*b*c"). */
const DA_PALAVRA = /[\p{L}\p{N}\\]/u;
const ESPACO = /\s/;
/**
 * Cada sinal da linha: uma sequência de "*" ou de "_" seguidos, um "[" ou um "](endereço)". O "](endereço)" é lido inteiro,
 * então um "*" ou um "_" no endereço nunca vira marca; o endereço para no espaço e nos parênteses.
 */
const SINAL = /\*+|_+|\[|\]\(([^()\s]*)\)/g;

/** Uma sequência de marcas na linha e o que ela fez: quantos caracteres sobraram como texto, que destaques fechou e abriu. */
interface Sequencia { tipo: 'marca'; inicio: number; fim: number; ch: string; sobra: number; abre: boolean; fecha: boolean; fechaAqui: Marca[]; abreAqui: Marca[] }
/** Um "[" (sem endereço) ou um "](endereço)". Os dois de um par que vira link guardam o endereço já conferido. */
interface Colchete { tipo: 'colchete'; inicio: number; fim: number; endereco?: string; link?: string }
type Sinal = Sequencia | Colchete;

function lerSinal(linha: string, m: RegExpMatchArray): Sinal {
  const inicio = m.index ?? 0, fim = inicio + m[0].length, ch = m[0].charAt(0);
  if (ch === '[' || ch === ']') return { tipo: 'colchete', inicio, fim, endereco: m[1] };
  const antes = linha.charAt(inicio - 1), depois = linha.charAt(fim);
  return {
    tipo: 'marca', inicio, fim, ch, sobra: m[0].length, fechaAqui: [], abreAqui: [],
    abre: depois !== '' && !ESPACO.test(depois) && !DA_PALAVRA.test(antes),
    fecha: antes !== '' && !ESPACO.test(antes) && !DA_PALAVRA.test(depois)
  };
}

/** Um link de verdade da linha: o "[" e o "](endereço)" que se juntaram. */
interface ParDeLink { abre: Colchete; fecha: Colchete }

/**
 * Junta cada "](endereço)" ao "[" aberto mais recente da linha, se o endereço for permitido. Um "[" novo antes do fim toma o
 * lugar do anterior (que fica como texto): link dentro de link não vale, vale o de dentro. "\[" fica como texto.
 */
function acharLinks(linha: string, sinais: Sinal[]): ParDeLink[] {
  const pares: ParDeLink[] = [];
  let aberto: Colchete | undefined;
  for (const s of sinais) {
    if (s.tipo !== 'colchete') continue;
    if (s.endereco === undefined) { if (linha.charAt(s.inicio - 1) !== '\\') aberto = s; continue; }
    const link = aberto && linkPermitido(s.endereco);
    if (aberto && link) { aberto.link = link; s.link = link; pares.push({ abre: aberto, fecha: s }); }
    aberto = undefined;
  }
  return pares;
}

const sinaisDaLinha = (linha: string) => [...linha.matchAll(SINAL)].map(m => lerSinal(linha, m));

/** Onde fica, na linha, um link de verdade: do "[" até depois do ")" e, dentro, o texto dele. */
interface LinkNaLinha { inicio: number; fim: number; textoInicio: number; textoFim: number }

/** Os links da linha exatamente como a leitura os vê (o botão Link usa isto, para nunca discordar do que aparece). */
function linksDaLinha(linha: string): LinkNaLinha[] {
  return acharLinks(linha, sinaisDaLinha(linha))
    .map(({ abre, fecha }) => ({ inicio: abre.inicio, fim: fecha.fim, textoInicio: abre.fim, textoFim: fecha.inicio }));
}

/**
 * Os pedaços de uma linha, já com o negrito e o itálico (um dentro do outro também) e os links. Lê a linha uma vez só, sinal
 * por sinal, guardando as marcas que podem abrir até uma que feche (sem isso, uma descrição longa com marcas soltas travava o
 * cartão). Só abre a sequência colada no começo de uma palavra (sem letra, número ou "\" antes, e sem espaço depois) e só fecha
 * a colada no fim de uma (sem espaço antes, e sem letra ou número depois). Marca aberta e nunca fechada fica como texto.
 * O texto do link é uma barreira: marca aberta fora dele não fecha dentro, e marca aberta dentro e não fechada lá fica como
 * texto. Assim "**[a](u)**" é um link em negrito e "[**a** b](u)" é um link com uma palavra em negrito, mas nunca um negrito
 * começa dentro do link e termina fora. "[" ou "](endereço)" sem par, ou com endereço não permitido, ficam como texto.
 */
export function pedacosDaLinha(linha: string): Pedaco[] {
  const sinais = sinaisDaLinha(linha);
  acharLinks(linha, sinais);
  const abertas: Sequencia[] = [];
  let barreira = 0;   // dentro de um link, só as marcas abertas a partir daqui podem fechar
  for (const s of sinais) {
    if (s.tipo === 'colchete') {
      if (s.link && s.endereco === undefined) barreira = abertas.length;
      else if (s.link) { abertas.splice(barreira); barreira = 0; }   // as abertas no link e não fechadas lá ficam como texto
      continue;
    }
    for (let i = abertas.length - 1; s.fecha && s.sobra && i >= barreira; i--) {
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
  // Monta os pedaços: em cada sequência, primeiro fecha, depois o que sobrou como texto, depois abre. O começo e o fim de um
  // link cortam o pedaço; um link sem texto ("[](u)") mostra o endereço, para não sumir.
  const pedacos: Pedaco[] = [], ativas: Marca[] = [];
  let texto = '', desde = 0, link: string | undefined, antesDoLink = 0;
  const soltar = () => { if (texto) pedacos.push(link ? { texto, marcas: [...ativas], link } : { texto, marcas: [...ativas] }); texto = ''; };
  for (const s of sinais) {
    texto += linha.slice(desde, s.inicio);
    desde = s.fim;
    if (s.tipo === 'colchete') {
      if (!s.link) { texto += linha.slice(s.inicio, s.fim); continue; }
      soltar();
      if (s.endereco === undefined) { link = s.link; antesDoLink = pedacos.length; continue; }
      if (pedacos.length === antesDoLink) pedacos.push({ texto: s.link, marcas: [...ativas], link });
      link = undefined;
      continue;
    }
    if (s.fechaAqui.length) soltar();
    for (const m of s.fechaAqui) ativas.splice(ativas.lastIndexOf(m), 1);
    texto += s.ch.repeat(s.sobra);
    if (s.abreAqui.length) soltar();
    ativas.push(...s.abreAqui);
  }
  texto += linha.slice(desde);
  soltar();
  return pedacos;
}

/** O começo de linha de cada bloco; vale o primeiro que servir, e sem nenhum a linha é texto. "#### x" e "#tag" ficam como texto. */
const INICIO_DO_BLOCO: { inicio: RegExp; bloco: (m: RegExpExecArray) => Bloco }[] = [
  { inicio: /^(#{1,3}) /, bloco: m => ({ tipo: 'titulo', nivel: m[1].length as NivelTitulo, linhas: [] }) },
  { inicio: /^- /, bloco: () => ({ tipo: 'lista', linhas: [] }) }   // ITEM_DE_LISTA
];
/** Linhas seguidas do mesmo tipo viram um bloco só? O título não: cada linha é um título. */
const JUNTA_LINHAS: Record<TipoBloco, boolean> = { texto: true, lista: true, titulo: false };

/** O bloco a que a linha pertence (ainda sem as linhas) e o começo de linha que a pôs nele ("" no texto comum). */
function inicioDaLinha(linha: string): { bloco: Bloco; inicio: string } {
  for (const { inicio, bloco } of INICIO_DO_BLOCO) {
    const m = inicio.exec(linha);
    if (m) return { bloco: bloco(m), inicio: m[0] };
  }
  return { bloco: { tipo: 'texto', linhas: [] }, inicio: '' };
}

/**
 * O texto em blocos: as linhas que começam com "- " seguidas viram uma lista, as que começam com "# ", "## " ou "### " viram
 * títulos (um por linha), e as outras ficam como foram escritas.
 */
export function blocosDoTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  for (const linha of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const { bloco, inicio } = inicioDaLinha(linha), pedacos = pedacosDaLinha(linha.slice(inicio.length));
    const ultimo = blocos.at(-1);
    if (ultimo?.tipo === bloco.tipo && JUNTA_LINHAS[bloco.tipo]) ultimo.linhas.push(pedacos);
    else blocos.push({ ...bloco, linhas: [pedacos] });
  }
  // Uma linha em branco logo antes ou logo depois de uma lista ou de um título só separa: eles já têm o seu espaço.
  const especial = (b: Bloco | undefined) => !!b && b.tipo !== 'texto';
  blocos.forEach((b, i) => {
    if (b.tipo !== 'texto') return;
    if (especial(blocos[i - 1]) && !b.linhas[0]?.length) b.linhas.shift();
    if (especial(blocos[i + 1]) && !b.linhas.at(-1)?.length) b.linhas.pop();
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

/**
 * Põe o começo de linha do botão (INICIO_NO_TEXTO) em cada linha do trecho escolhido, ou tira de todas se todas já o têm. Os
 * começos não se somam: um item de lista que vira título perde o "- ", e um "# " vira "## ". Sem trecho, o cursor fica onde
 * estava (anda junto com o texto).
 */
export function alternarInicioDeLinha({ texto, inicio, fim }: Escolha, tipo: InicioDeLinha): Escolha {
  const p = INICIO_NO_TEXTO[tipo];
  const de = inicio ? texto.lastIndexOf('\n', inicio - 1) + 1 : 0, quebra = texto.indexOf('\n', Math.max(fim - 1, inicio)), ate = quebra < 0 ? texto.length : quebra;
  const linhas = texto.slice(de, ate).split('\n'), todas = linhas.every(l => l.startsWith(p)), novo = todas ? '' : p;
  const novas = linhas.map(l => novo + l.slice(inicioDaLinha(l).inicio.length)).join('\n');
  const antigo = inicioDaLinha(linhas[0]).inicio.length, cursor = de + Math.max(novo.length, inicio - de - antigo + novo.length);
  return { texto: texto.slice(0, de) + novas + texto.slice(ate), inicio: cursor, fim: inicio === fim ? cursor : de + novas.length };
}

/** Põe "- " no começo de cada linha do trecho escolhido, ou tira de todas se todas já são da lista. */
export const alternarLista = (e: Escolha) => alternarInicioDeLinha(e, 'lista');
/** Faz de cada linha do trecho escolhido um título ("## "), ou volta a texto se todas já são esse título. */
export const alternarTitulo = (e: Escolha) => alternarInicioDeLinha(e, 'titulo');

/** O começo e o fim (sem a quebra) da linha em que está a posição. */
function linhaEm(texto: string, posicao: number) {
  const de = posicao ? texto.lastIndexOf('\n', posicao - 1) + 1 : 0, quebra = texto.indexOf('\n', posicao);
  return { de, ate: quebra < 0 ? texto.length : quebra };
}

/** A escolha está sobre o link? O cursor sozinho precisa estar dentro dele (não colado nas pontas); um trecho, contido nele. */
const sobreOLink = (l: LinkNaLinha, inicio: number, fim: number) =>
  inicio >= l.inicio && fim <= l.fim && (inicio !== fim || (inicio > l.inicio && fim < l.fim));

/**
 * Tira o link em volta do trecho escolhido (ou do cursor), deixando só o texto dele, escolhido. Vale com a escolha em qualquer
 * parte do link: no texto (que continua escolhido como estava), no endereço ou na marcação toda (aí o texto do link fica
 * escolhido). Devolve null se ali não há link: só conta o que a leitura mostra como link.
 */
export function tirarLink({ texto, inicio, fim }: Escolha): Escolha | null {
  const { de, ate } = linhaEm(texto, inicio);
  if (fim > ate) return null;
  const l = linksDaLinha(texto.slice(de, ate)).find(k => sobreOLink(k, inicio - de, fim - de));
  if (!l) return null;
  const comeco = de + l.inicio, dentro = texto.slice(de + l.textoInicio, de + l.textoFim);
  const noTexto = inicio - de >= l.textoInicio && fim - de <= l.textoFim;
  return {
    texto: texto.slice(0, comeco) + dentro + texto.slice(de + l.fim),
    inicio: noTexto ? inicio - 1 : comeco, fim: noTexto ? fim - 1 : comeco + dentro.length
  };
}

/** Os links de verdade das linhas que vão da posição inicio à fim, com as posições no texto todo. */
function linksEntre(texto: string, inicio: number, fim: number): LinkNaLinha[] {
  const links: LinkNaLinha[] = [];
  for (let de = linhaEm(texto, inicio).de; de <= fim;) {
    const { ate } = linhaEm(texto, de);
    for (const l of linksDaLinha(texto.slice(de, ate)))
      links.push({ inicio: de + l.inicio, fim: de + l.fim, textoInicio: de + l.textoInicio, textoFim: de + l.textoFim });
    de = ate + 1;
  }
  return links;
}

/**
 * Põe o link (endereço já conferido por linkPermitido) em volta do trecho escolhido, com os espaços das pontas fora, e o trecho
 * continua escolhido. Um trecho de várias linhas ganha um link em cada linha (o link vale numa linha só). Sem trecho, escreve o
 * endereço como texto do link e o deixa escolhido, para a pessoa escrever por cima. Devolve null (e o texto fica como está)
 * quando o link não seria lido como foi posto: o trecho pega parte de um link já escrito, tem colchetes, ou vem logo depois
 * de uma "\" (que faria do "[" texto). Para não discordar da leitura, confere no texto novo que cada link posto é lido inteiro.
 */
export function porLink({ texto, inicio, fim }: Escolha, endereco: string): Escolha | null {
  if (linksEntre(texto, inicio, fim).some(l => inicio < l.fim && fim > l.inicio)) return null;
  const fecho = '](' + enderecoNoTexto(endereco) + ')', escolhido = texto.slice(inicio, fim);
  /** Onde cada link posto deve aparecer no texto novo. */
  const postos: { inicio: number; fim: number }[] = [];
  const montar = (de: number, { antes, miolo, depois }: { antes: string; miolo: string; depois: string }) => {
    const link = '[' + miolo + fecho;
    postos.push({ inicio: de + antes.length, fim: de + antes.length + link.length });
    return antes + link + depois;
  };
  let r: Escolha;
  if (escolhido.includes('\n')) {
    const partes: string[] = [];
    let de = inicio;
    for (const l of escolhido.split('\n')) {
      const b = bordas(l), parte = b.miolo ? montar(de, b) : l;
      partes.push(parte);
      de += parte.length + 1;
    }
    const novo = partes.join('\n');
    r = { texto: texto.slice(0, inicio) + novo + texto.slice(fim), inicio, fim: inicio + novo.length };
  } else {
    const b = bordas(escolhido), miolo = b.miolo || endereco, comeco = inicio + b.antes.length + 1;
    r = { texto: texto.slice(0, inicio) + montar(inicio, { ...b, miolo }) + texto.slice(fim), inicio: comeco, fim: comeco + miolo.length };
  }
  const lidos = linksEntre(r.texto, inicio, inicio + (r.texto.length - texto.length) + (fim - inicio));
  return postos.every(p => lidos.some(l => l.inicio === p.inicio && l.fim === p.fim)) ? r : null;
}
