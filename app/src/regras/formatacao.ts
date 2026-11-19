// Descrição de tarefas e demandas com negrito, itálico e listas (#293), com as marcas do Trello: **negrito** (ou __negrito__),
// *itálico* (ou _itálico_) e linhas que começam com "- " viram lista. Desde a #303 também há títulos ("# ", "## " e "### " no
// começo da linha) e links ([texto](https://…)), só para endereços http, https e mailto. O texto continua guardado como texto,
// com as marcas; esta regra só diz como mostrá-lo e como pôr ou tirar uma marca no trecho escolhido. A tela desenha os pedaços
// como elementos do React (nunca como HTML solto), então ninguém consegue esconder código numa descrição.
// Desde a #344, o Markdown comum: listas de tarefas ("- [ ] " e "- [x] ", que se marcam clicando), listas numeradas ("1. "),
// citações ("> "), tachado (~~assim~~), código (`assim`, e blocos entre linhas com ```), linha divisória ("---" ou "***") e
// tabelas simples (cabeçalho com "|", a linha "|---|" e as linhas de dados). O código fica literal: nada nele vira marca.

/** Os destaques de um trecho. O código em linha (`assim`) também é um destaque: o texto dele vem literal. */
export type Marca = 'negrito' | 'italico' | 'tachado' | 'codigo';
/** Os destaques que os botões e os atalhos põem e tiram (o tachado a pessoa escreve). */
export type MarcaDoBotao = Exclude<Marca, 'tachado'>;

/** A marca que os botões e os atalhos põem no texto. */
export const MARCA_NO_TEXTO: Record<MarcaDoBotao, string> = { negrito: '**', italico: '*', codigo: '`' };
/**
 * Quantos caracteres seguidos já são a marca, para o botão tirá-la em vez de pôr outra: o itálico conta os asteriscos seguidos
 * (um número ímpar, "*" ou "***", tem itálico); o negrito, dois ou mais; o código, uma crase só.
 */
const TEM_A_MARCA: Record<MarcaDoBotao, (seguidos: number) => boolean> = {
  negrito: n => n >= 2, italico: n => n % 2 === 1, codigo: n => n === 1
};
/** O começo de uma linha de lista. */
export const ITEM_DE_LISTA = '- ';
/** O começo de uma linha da lista de tarefas: a caixinha vazia ("- [ ]") ou marcada ("- [x]" ou "- [X]"), e um espaço ou o fim. */
const ITEM_DE_TAREFA = /^- \[([ xX])\](?: |$)/;
/** Onde fica, na linha da tarefa, o caractere entre os colchetes (" " ou "x"). */
export const POSICAO_DA_CAIXINHA = 3;
/** O que fica entre os colchetes da caixinha marcada e da vazia. */
export const CAIXINHA: Record<'marcada' | 'vazia', string> = { marcada: 'x', vazia: ' ' };
/** A linha que abre e fecha o bloco de código que o botão Código põe. */
const CERCA_DE_CODIGO = '```';
/** A linha que abre um bloco de código: três crases ou mais e, se quiser, o nome da linguagem (sem crases). */
const ABRE_CODIGO = /^(`{3,})[^`]*$/;
/** A linha que fecha: só crases (pelo menos tantas quanto as que abriram) e espaços. */
const FECHA_CODIGO = /^(`{3,})\s*$/;
/**
 * O começo de linha que cada botão põe e como reconhecê-lo: a lista, a de tarefas (com a caixinha vazia), a numerada (numera as
 * linhas escolhidas: 1., 2., 3.), a citação e o título do meio ("#" e "###" a pessoa escreve). Com "mantem", a linha que já tem
 * esse começo fica como está quando o botão o põe nas outras (a tarefa já marcada continua marcada); a numerada não mantém:
 * ela renumera todas as linhas escolhidas.
 */
export const INICIO_NO_TEXTO = {
  lista: { tem: /^- (?!\[[ xX]\](?: |$))/, poe: () => ITEM_DE_LISTA, mantem: true },
  tarefa: { tem: ITEM_DE_TAREFA, poe: () => '- [ ] ', mantem: true },
  numerada: { tem: /^\d{1,9}[.)] /, poe: (i: number) => `${i + 1}. `, mantem: false },
  citacao: { tem: /^> |^>$/, poe: () => '> ', mantem: true },
  titulo: { tem: /^## /, poe: () => '## ', mantem: true }
} satisfies Record<string, { tem: RegExp; poe: (i: number) => string; mantem: boolean }>;
export type InicioDeLinha = keyof typeof INICIO_NO_TEXTO;
/** O maior endereço aceito num link (o que os navegadores abrem sem problema). */
export const TAMANHO_DO_ENDERECO = 2048;

/** Um pedaço da linha, com os destaques dele e, se estiver num link, o endereço já conferido. */
export interface Pedaco { texto: string; marcas: Marca[]; link?: string }
/** O nível de um título: "#" é 1, "##" é 2, "###" é 3. */
export type NivelTitulo = 1 | 2 | 3;
/** A caixinha de um item da lista de tarefas: se está marcada e em que linha do texto ela fica (a primeira é a 0), para marcá-la. */
export interface Caixinha { marcada: boolean; linha: number }
/** Como o texto de uma coluna da tabela se alinha (":---" à esquerda, ":---:" no centro, "---:" à direita; "---" fica o padrão). */
export type Alinhamento = 'esquerda' | 'centro' | 'direita' | null;
/**
 * Um trecho do texto. Todos têm as linhas, cada uma com os seus pedaços: no texto comum, mostradas como foram escritas, com as
 * quebras; na lista, na de tarefas (uma caixinha por linha) e na numerada (que começa no número "inicio"), os itens; na citação,
 * as linhas dela; no título, a linha dele; no código, as linhas literais (um pedaço sem destaque, ou nenhum na linha vazia); na
 * divisória, nenhuma. Na tabela, as linhas são as células, da esquerda para a direita e de cima para baixo (as primeiras são o
 * cabeçalho): cada linha da tabela tem uma célula por coluna.
 */
export type Bloco =
  | { tipo: 'texto'; linhas: Pedaco[][] }
  | { tipo: 'lista'; linhas: Pedaco[][] }
  | { tipo: 'tarefas'; caixinhas: Caixinha[]; linhas: Pedaco[][] }
  | { tipo: 'numerada'; inicio: number; linhas: Pedaco[][] }
  | { tipo: 'citacao'; linhas: Pedaco[][] }
  | { tipo: 'titulo'; nivel: NivelTitulo; linhas: Pedaco[][] }
  | { tipo: 'codigo'; linhas: Pedaco[][] }
  | { tipo: 'divisoria'; linhas: Pedaco[][] }
  | { tipo: 'tabela'; colunas: Alinhamento[]; linhas: Pedaco[][] };
export type TipoBloco = Bloco['tipo'];
/** O bloco de um tipo. */
export type BlocoDo<T extends TipoBloco> = Extract<Bloco, { tipo: T }>;

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

/**
 * Quantos caracteres de uma sequência cada destaque usa: com "*" e "_", dois fecham um negrito e um fecha um itálico ("***"
 * pode ser os dois); com "~", só dois, que fecham um tachado.
 */
const MARCA_DO_PAR: Record<string, Partial<Record<1 | 2, Marca>>> = {
  '*': { 1: 'italico', 2: 'negrito' }, _: { 1: 'italico', 2: 'negrito' }, '~': { 2: 'tachado' }
};
/** As sequências que podem abrir ou fechar um destaque: de "*" e "_", qualquer uma; de "~", só a de dois ("~~"). */
const SEQUENCIA_VALE: Record<string, (tamanho: number) => boolean> = { '*': () => true, _: () => true, '~': n => n === 2 };
/** Letra, número ou barra invertida: a marca colada a eles faz parte da palavra ("contrato_final_v2.pdf", "a*b*c"). */
const DA_PALAVRA = /[\p{L}\p{N}\\]/u;
const ESPACO = /\s/;
/**
 * Cada sinal da linha: uma sequência de "*", de "_", de "~" ou de crases seguidos, um "[" ou um "](endereço)". O "](endereço)"
 * é lido inteiro, então um "*" ou um "_" no endereço nunca vira marca; o endereço para no espaço e nos parênteses.
 *
 * Um endereço escrito solto no texto ("https://…" ou "http://…", colado de uma página, #368) também é lido inteiro e fica como
 * texto: os "_", "*" e "~" dele ("Cap_1_-_Livro_IG.pdf") nunca viram itálico nem negrito. Ele começa fora de uma palavra e para
 * no espaço, nos "<", ">", crases e colchetes; a pontuação do fim ("." "," ")" "*" "_"…) fica fora dele, para "**https://a.b**"
 * continuar em negrito e "(veja https://a.b)." fechar o parêntese.
 */
const SINAL = /\*+|_+|~+|`+|\[|\]\(([^()\s]*)\)|(?<![\p{L}\p{N}])(https?:\/\/[^\s<>`[\]]*[^\s<>`[\]*_~.,:;!?'")])/gu;

/** Uma sequência de marcas na linha e o que ela fez: quantos caracteres sobraram como texto, que destaques fechou e abriu. */
interface Sequencia { tipo: 'marca'; inicio: number; fim: number; ch: string; sobra: number; abre: boolean; fecha: boolean; fechaAqui: Marca[]; abreAqui: Marca[] }
/** Um "[" (sem endereço) ou um "](endereço)". Os dois de um par que vira link guardam o endereço já conferido. */
interface Colchete { tipo: 'colchete'; inicio: number; fim: number; endereco?: string; link?: string }
/** Uma sequência de crases, que abre ou fecha um código com outra do mesmo tamanho. */
interface Crase { tipo: 'crase'; inicio: number; fim: number }
/** Um código em linha, das crases que abrem às que fecham, com o texto de dentro, literal. */
interface Codigo { tipo: 'codigo'; inicio: number; fim: number; texto: string; crases: number }
type Sinal = Sequencia | Colchete | Codigo;

/** Como ler cada sinal pelo primeiro caractere; o que não está aqui é uma sequência de marcas. */
const LER_SINAL: Record<string, (inicio: number, fim: number, m: RegExpMatchArray) => Colchete | Crase> = {
  '[': (inicio, fim) => ({ tipo: 'colchete', inicio, fim }),
  ']': (inicio, fim, m) => ({ tipo: 'colchete', inicio, fim, endereco: m[1] }),
  '`': (inicio, fim) => ({ tipo: 'crase', inicio, fim })
};

function lerSinal(linha: string, m: RegExpMatchArray): Sequencia | Colchete | Crase {
  const inicio = m.index ?? 0, fim = inicio + m[0].length, ch = m[0].charAt(0), ler = LER_SINAL[ch];
  if (ler) return ler(inicio, fim, m);
  const antes = linha.charAt(inicio - 1), depois = linha.charAt(fim), vale = SEQUENCIA_VALE[ch](m[0].length);
  return {
    tipo: 'marca', inicio, fim, ch, sobra: m[0].length, fechaAqui: [], abreAqui: [],
    abre: vale && depois !== '' && !ESPACO.test(depois) && !DA_PALAVRA.test(antes),
    fecha: vale && antes !== '' && !ESPACO.test(antes) && !DA_PALAVRA.test(depois)
  };
}

/** O texto de um código em linha: sai um espaço de cada ponta se há nas duas (para escrever "`` `a` ``"), menos se é só espaço. */
function textoDoCodigo(dentro: string) {
  const tira = dentro.length >= 2 && dentro.startsWith(' ') && dentro.endsWith(' ') && dentro.trim() !== '';
  return tira ? dentro.slice(1, -1) : dentro;
}

/**
 * Junta cada sequência de crases à próxima do mesmo tamanho: o que fica entre elas vira um código, e os sinais lá dentro deixam
 * de valer (nada no código vira marca nem link). Crase sem par fica como texto. Lê a linha uma vez só: para cada tamanho, guarda
 * onde estão as sequências e só anda para a frente nelas.
 */
function juntarCrases(linha: string, lidos: (Sequencia | Colchete | Crase)[]): Sinal[] {
  const porTamanho = new Map<number, { onde: number[]; proxima: number }>();
  lidos.forEach((s, i) => {
    if (s.tipo !== 'crase') return;
    const n = s.fim - s.inicio, lista = porTamanho.get(n) ?? { onde: [], proxima: 0 };
    lista.onde.push(i);
    porTamanho.set(n, lista);
  });
  const sinais: Sinal[] = [];
  for (let i = 0; i < lidos.length; i++) {
    const s = lidos[i];
    if (s.tipo !== 'crase') { sinais.push(s); continue; }
    const lista = porTamanho.get(s.fim - s.inicio);
    if (!lista) continue;
    while (lista.proxima < lista.onde.length && lista.onde[lista.proxima] <= i) lista.proxima++;
    const j = lista.onde.at(lista.proxima);
    if (j === undefined) continue;   // sem par: as crases ficam como texto
    sinais.push({ tipo: 'codigo', inicio: s.inicio, fim: lidos[j].fim, texto: textoDoCodigo(linha.slice(s.fim, lidos[j].inicio)), crases: s.fim - s.inicio });
    i = j;
  }
  return sinais;
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

/** Os sinais da linha, com as crases juntadas. O endereço solto (o grupo 2 de SINAL) não é sinal: só não deixa ler marcas nele. */
const sinaisDaLinha = (linha: string) =>
  juntarCrases(linha, [...linha.matchAll(SINAL)].filter(m => m[2] === undefined).map(m => lerSinal(linha, m)));

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
  const sinais = marcasDaLinha(linha);
  // Monta os pedaços: em cada sequência, primeiro fecha, depois o que sobrou como texto, depois abre. O começo e o fim de um
  // link cortam o pedaço; um link sem texto ("[](u)") mostra o endereço, para não sumir.
  const pedacos: Pedaco[] = [], ativas: Marca[] = [];
  let texto = '', desde = 0, link: string | undefined, antesDoLink = 0;
  const soltar = () => { if (texto) pedacos.push(link ? { texto, marcas: [...ativas], link } : { texto, marcas: [...ativas] }); texto = ''; };
  for (const s of sinais) {
    texto += linha.slice(desde, s.inicio);
    desde = s.fim;
    if (s.tipo === 'codigo') {
      soltar();
      pedacos.push(link ? { texto: s.texto, marcas: [...ativas, 'codigo'], link } : { texto: s.texto, marcas: [...ativas, 'codigo'] });
      continue;
    }
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

/** O texto de uma linha lida, sem os sinais nem os destaques, como a pessoa o lê (o nome de uma caixinha, por exemplo). */
export const textoDosPedacos = (pedacos: Pedaco[]) => pedacos.map(p => p.texto).join('');

/** Um trecho de uma linha, da posição "inicio" até antes de "fim". */
export interface Intervalo { inicio: number; fim: number }
/** Um trecho da linha com destaques ou num link (o endereço já conferido). */
export interface TrechoMarcado extends Intervalo { marcas: Marca[]; link?: string }
/** Onde ficam, numa linha, os sinais do Markdown ("**", "`", "[", "](endereço)") e os trechos destacados. */
export interface MarcasNaLinha { simbolos: Intervalo[]; trechos: TrechoMarcado[] }
/** Quantos caracteres cada destaque escrito com sinais repetidos usa no texto. */
const TAMANHO_DA_MARCA: Record<Exclude<Marca, 'codigo'>, number> = { negrito: 2, italico: 1, tachado: 2 };
const tamanhoDasMarcas = (marcas: Marca[]) => marcas.reduce((n, m) => n + TAMANHO_DA_MARCA[m as Exclude<Marca, 'codigo'>], 0);

/**
 * A mesma leitura de pedacosDaLinha, com as posições: onde ficam os sinais do Markdown (que o editor ao vivo sempre esconde,
 * também na linha do cursor, #368) e os trechos com destaque ou link. Os sinais que sobram como texto ("2 * 3", um "[" sem par) não entram. Um
 * link sem texto ("[](u)") fica escrito inteiro, como link, para não sumir.
 */
export function marcasNaLinha(linha: string): MarcasNaLinha {
  const simbolos: Intervalo[] = [], trechos: TrechoMarcado[] = [], ativas: Marca[] = [];
  let desde = 0, link: string | undefined, abreLink: Intervalo | undefined;
  const destacar = (inicio: number, fim: number, marcas = ativas) => {
    if (fim > inicio && (marcas.length || link)) trechos.push(link ? { inicio, fim, marcas: [...marcas], link } : { inicio, fim, marcas: [...marcas] });
  };
  for (const s of marcasDaLinha(linha)) {
    destacar(desde, s.inicio);
    desde = s.fim;
    if (s.tipo === 'codigo') {
      simbolos.push({ inicio: s.inicio, fim: s.inicio + s.crases }, { inicio: s.fim - s.crases, fim: s.fim });
      destacar(s.inicio + s.crases, s.fim - s.crases, [...ativas, 'codigo']);
      continue;
    }
    if (s.tipo === 'colchete') {
      if (!s.link) { destacar(s.inicio, s.fim); continue; }
      if (s.endereco === undefined) { link = s.link; abreLink = { inicio: s.inicio, fim: s.fim }; continue; }
      if (abreLink && abreLink.fim === s.inicio) destacar(abreLink.inicio, s.fim);   // sem texto: o link fica escrito
      else if (abreLink) simbolos.push(abreLink, { inicio: s.inicio, fim: s.fim });
      link = undefined;
      abreLink = undefined;
      continue;
    }
    const fecha = tamanhoDasMarcas(s.fechaAqui), abre = tamanhoDasMarcas(s.abreAqui);
    if (fecha) simbolos.push({ inicio: s.inicio, fim: s.inicio + fecha });
    for (const m of s.fechaAqui) ativas.splice(ativas.lastIndexOf(m), 1);
    destacar(s.inicio + fecha, s.fim - abre);
    if (abre) simbolos.push({ inicio: s.fim - abre, fim: s.fim });
    ativas.push(...s.abreAqui);
  }
  destacar(desde, linha.length);
  return { simbolos: simbolos.sort((a, b) => a.inicio - b.inicio), trechos };
}

/**
 * Os sinais da linha já lidos: os links achados e, em cada sequência de marcas, os destaques que ela fecha e abre e quantos
 * caracteres sobram como texto (veja pedacosDaLinha). Os pedaços para ler e as marcas do editor ao vivo saem daqui, então os
 * dois nunca discordam.
 */
function marcasDaLinha(linha: string): Sinal[] {
  const sinais = sinaisDaLinha(linha);
  acharLinks(linha, sinais);
  const abertas: Sequencia[] = [];
  let barreira = 0;   // dentro de um link, só as marcas abertas a partir daqui podem fechar
  for (const s of sinais) {
    if (s.tipo === 'codigo') continue;   // o código fica entre as marcas, sem mudá-las: "**`a`**" é um código em negrito
    if (s.tipo === 'colchete') {
      if (s.link && s.endereco === undefined) barreira = abertas.length;
      else if (s.link) { abertas.splice(barreira); barreira = 0; }   // as abertas no link e não fechadas lá ficam como texto
      continue;
    }
    for (let i = abertas.length - 1; s.fecha && s.sobra && i >= barreira; i--) {
      const a = abertas[i];
      if (a.ch !== s.ch) continue;
      while (a.sobra && s.sobra) {
        const usa = a.sobra >= 2 && s.sobra >= 2 ? 2 : 1, marca = MARCA_DO_PAR[s.ch][usa];
        if (!marca) break;
        a.sobra -= usa;
        s.sobra -= usa;
        a.abreAqui.unshift(marca);   // o par achado depois fica por fora
        s.fechaAqui.push(marca);
      }
      abertas.splice(a.sobra ? i + 1 : i);   // as que ficaram dentro do par não fecham mais
    }
    if (s.abre && s.sobra) abertas.push(s);
  }
  return sinais;
}

/**
 * O começo de linha de cada bloco de uma linha só (a linha vira um título, um item ou uma linha da citação), com o bloco que ela
 * forma, já com os pedaços do resto da linha. Vale o primeiro que servir. "#### x", "#tag" e ">50%" ficam como texto.
 */
const INICIO_DO_BLOCO: { inicio: RegExp; bloco: (m: RegExpExecArray, linhas: Pedaco[][], linha: number) => Bloco }[] = [
  { inicio: /^(#{1,3}) /, bloco: (m, linhas) => ({ tipo: 'titulo', nivel: m[1].length as NivelTitulo, linhas }) },
  { inicio: ITEM_DE_TAREFA, bloco: (m, linhas, linha) => ({ tipo: 'tarefas', caixinhas: [{ marcada: m[1] !== CAIXINHA.vazia, linha }], linhas }) },
  { inicio: /^- /, bloco: (_m, linhas) => ({ tipo: 'lista', linhas }) },   // ITEM_DE_LISTA
  { inicio: /^(\d{1,9})[.)] /, bloco: (m, linhas) => ({ tipo: 'numerada', inicio: Number(m[1]), linhas }) },
  { inicio: /^> |^>$/, bloco: (_m, linhas) => ({ tipo: 'citacao', linhas }) }
];

/** O começo de linha que põe a linha num bloco ("" no texto comum, e nas linhas de código, divisória e tabela). */
export function comecoDaLinha(linha: string): string {
  for (const { inicio } of INICIO_DO_BLOCO) {
    const m = inicio.exec(linha);
    if (m) return m[0];
  }
  return '';
}

/** Um bloco lido e a linha logo depois dele. */
export interface Lido { bloco: Bloco; proxima: number }
/** Quem lê um bloco a partir da linha i, ou null se o bloco não começa ali. */
type Leitor = (linhas: string[], i: number) => Lido | null;

/** A linha divisória: três ou mais "-", "*" ou "_", sozinhos na linha. */
const DIVISORIA = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
/** Uma célula da linha que separa o cabeçalho da tabela: traços, com ":" na ponta do lado para onde o texto se alinha. */
const CELULA_SEPARADORA = /^(:?)-+(:?)$/;
/** O alinhamento de cada célula separadora, pelos ":" das pontas. */
const ALINHAMENTO: Record<string, Alinhamento> = { '-': null, ':-': 'esquerda', '-:': 'direita', ':-:': 'centro' };
/** O "|" que separa as células ("\|" é uma barra dentro da célula). */
const SEPARA_CELULAS = /(?<!\\)\|/;

/** As células de uma linha da tabela: o "|" separa, os das pontas são opcionais, e "\|" é uma barra dentro da célula. */
function celulas(linha: string): string[] {
  const miolo = linha.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return miolo.split(SEPARA_CELULAS).map(c => c.trim().replace(/\\\|/g, '|'));
}

/** O bloco de código: da linha com ``` até a que fecha (sem ela, até o fim do texto). O que fica dentro é literal. */
const lerCodigo: Leitor = (linhas, i) => {
  const abre = ABRE_CODIGO.exec(linhas[i]);
  if (!abre) return null;
  const dentro: Pedaco[][] = [];
  let j = i + 1;
  for (; j < linhas.length; j++) {
    const fecha = FECHA_CODIGO.exec(linhas[j]);
    if (fecha && fecha[1].length >= abre[1].length) break;
    dentro.push(linhas[j] ? [{ texto: linhas[j], marcas: [] }] : []);
  }
  return { bloco: { tipo: 'codigo', linhas: dentro }, proxima: j + 1 };
};

const lerDivisoria: Leitor = (linhas, i) => DIVISORIA.test(linhas[i]) ? { bloco: { tipo: 'divisoria', linhas: [] }, proxima: i + 1 } : null;

/** Uma linha que começa um título, um item ou uma linha da citação. */
const lerInicioDeLinha: Leitor = (linhas, i) => {
  for (const { inicio, bloco } of INICIO_DO_BLOCO) {
    const m = inicio.exec(linhas[i]);
    if (m) return { bloco: bloco(m, [pedacosDaLinha(linhas[i].slice(m[0].length))], i), proxima: i + 1 };
  }
  return null;
};

/**
 * A tabela: a linha do cabeçalho, com "|", a linha que separa (|---|:---:|), com uma célula para cada uma do cabeçalho, e as
 * linhas de dados que vêm logo depois, com "|". Uma linha de dados com células a menos fica com elas vazias; a mais, sem elas.
 */
const lerTabela: Leitor = (linhas, i) => {
  const separadora = linhas[i + 1];
  if (!linhas[i].includes('|') || separadora === undefined || !separadora.includes('|')) return null;
  const cabecalho = celulas(linhas[i]), colunas: Alinhamento[] = [];
  for (const c of celulas(separadora)) {
    const m = CELULA_SEPARADORA.exec(c);
    if (!m) return null;
    colunas.push(ALINHAMENTO[m[1] + '-' + m[2]]);
  }
  if (colunas.length !== cabecalho.length) return null;
  const todas = cabecalho.map(pedacosDaLinha);
  let j = i + 2;
  for (; j < linhas.length && linhas[j].trim() && linhas[j].includes('|'); j++) {
    const lidas = celulas(linhas[j]);
    colunas.forEach((_c, k) => todas.push(pedacosDaLinha(lidas[k] ?? '')));
  }
  return { bloco: { tipo: 'tabela', colunas, linhas: todas }, proxima: j };
};

/** Quem lê cada bloco, na ordem em que se tenta; a linha que nenhum lê é texto comum. */
const LEITORES: Leitor[] = [lerCodigo, lerDivisoria, lerInicioDeLinha, lerTabela];

/** O bloco que começa na linha i (a primeira é a 0) e a linha logo depois dele, como a leitura do texto o vê. */
export function lerBloco(linhas: string[], i: number): Lido {
  for (const ler of LEITORES) {
    const lido = ler(linhas, i);
    if (lido) return lido;
  }
  return { bloco: { tipo: 'texto', linhas: [pedacosDaLinha(linhas[i])] }, proxima: i + 1 };
}

const juntarLinhas = (ultimo: { linhas: Pedaco[][] }, novo: { linhas: Pedaco[][] }) => { ultimo.linhas.push(...novo.linhas); };
/**
 * Como um bloco recebe o seguinte do mesmo tipo: as linhas seguidas de texto, de uma lista ou de uma citação viram um bloco só
 * (a numerada fica com o número da primeira; a de tarefas leva as caixinhas junto). Os outros (null) ficam separados: cada
 * linha é um título, e dois códigos, divisórias ou tabelas seguidos são dois.
 */
const JUNTA: { [T in TipoBloco]: ((ultimo: BlocoDo<T>, novo: BlocoDo<T>) => void) | null } = {
  texto: juntarLinhas, lista: juntarLinhas, numerada: juntarLinhas, citacao: juntarLinhas,
  tarefas: (ultimo, novo) => { juntarLinhas(ultimo, novo); ultimo.caixinhas.push(...novo.caixinhas); },
  titulo: null, codigo: null, divisoria: null, tabela: null
};

/**
 * O texto em blocos: as linhas que começam com "- " seguidas viram uma lista ("- [ ] " e "- [x] ", uma lista de tarefas; "1. ",
 * uma numerada), as que começam com "> ", uma citação, as que começam com "# ", "## " ou "### " viram títulos (um por linha),
 * o que fica entre linhas com ``` é código, "---" sozinho é uma divisória, as linhas com "|" sobre uma linha "|---|" são uma
 * tabela, e as outras ficam como foram escritas. Cada linha é lida uma vez só.
 */
export function blocosDoTexto(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n'), blocos: Bloco[] = [];
  for (let i = 0; i < linhas.length;) {
    const { bloco, proxima } = lerBloco(linhas, i), ultimo = blocos.at(-1);
    const juntar = JUNTA[bloco.tipo] as ((ultimo: Bloco, novo: Bloco) => void) | null;
    if (ultimo?.tipo === bloco.tipo && juntar) juntar(ultimo, bloco);
    else blocos.push(bloco);
    i = proxima;
  }
  // Uma linha em branco logo antes ou logo depois de um bloco que não é texto (lista, título, código…) só separa: ele já tem o
  // seu espaço.
  const especial = (b: Bloco | undefined) => !!b && b.tipo !== 'texto';
  blocos.forEach((b, i) => {
    if (b.tipo !== 'texto') return;
    if (especial(blocos[i - 1]) && !b.linhas[0]?.length) b.linhas.shift();
    if (especial(blocos[i + 1]) && !b.linhas.at(-1)?.length) b.linhas.pop();
  });
  return blocos.filter(b => b.tipo !== 'texto' || b.linhas.length);
}

/**
 * Marca ou desmarca a caixinha da lista de tarefas que está na linha dada do texto (a primeira é a 0), trocando só o caractere
 * entre os colchetes: o resto do texto fica igual, até as quebras de linha. Se ali não há uma caixinha (como a leitura a vê:
 * dentro de um código, por exemplo, não há), devolve o texto como está.
 */
export function alternarItemDeTarefa(texto: string, linha: number): string {
  const caixinha = blocosDoTexto(texto).some(b => b.tipo === 'tarefas' && b.caixinhas.some(c => c.linha === linha));
  if (!caixinha) return texto;
  const quebra = /\r\n?|\n/g;
  let de = 0;
  for (let n = 0; n < linha; n++) {
    const m = quebra.exec(texto);
    if (m) de = m.index + m[0].length;
  }
  const onde = de + POSICAO_DA_CAIXINHA, vira = texto.charAt(onde) === CAIXINHA.vazia ? CAIXINHA.marcada : CAIXINHA.vazia;
  return texto.slice(0, onde) + vira + texto.slice(onde + 1);
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
 * das pontas ficam fora da marca, e um trecho de várias linhas ganha a marca em cada linha (veja alternarMarcaEmLinhas). Sem
 * trecho escolhido, põe as duas marcas e deixa o cursor entre elas, para a pessoa escrever. Se o trecho já tem a marca, conta
 * os caracteres seguidos dela (TEM_A_MARCA).
 */
export function alternarMarca({ texto, inicio, fim }: Escolha, marca: MarcaDoBotao): Escolha {
  const m = MARCA_NO_TEXTO[marca], t = m.length, ch = m.charAt(0), escolhido = texto.slice(inicio, fim), tem = TEM_A_MARCA[marca];
  if (escolhido.includes('\n')) return alternarMarcaEmLinhas({ texto, inicio, fim }, marca);
  const seguidos = (s: string, de: number, passo: 1 | -1) => { let n = 0; while (s.charAt(de + n * passo) === ch) n++; return n; };
  if (tem(seguidos(texto, inicio - 1, -1)) && tem(seguidos(texto, fim, 1)))
    return { texto: texto.slice(0, inicio - t) + escolhido + texto.slice(fim + t), inicio: inicio - t, fim: fim - t };
  const naFrente = seguidos(escolhido, 0, 1), atras = seguidos(escolhido, escolhido.length - 1, -1);
  if (naFrente + atras < escolhido.length && tem(naFrente) && tem(atras))
    return { texto: texto.slice(0, inicio) + escolhido.slice(t, -t) + texto.slice(fim), inicio, fim: fim - 2 * t };
  const b = bordas(escolhido), comeco = inicio + b.antes.length + t;
  return { texto: texto.slice(0, inicio) + b.antes + m + b.miolo + m + b.depois + texto.slice(fim), inicio: comeco, fim: comeco + b.miolo.length };
}

/** Os sinais que abrem e fecham um mesmo destaque numa linha (os "**" de um negrito, por exemplo). */
export interface ParDeSinais { abre: Intervalo; fecha: Intervalo }

/**
 * Onde abre e onde fecha cada trecho da linha com a marca dada, pela mesma leitura que a mostra (marcasDaLinha): só os sinais
 * que viraram marca, nunca os que sobram como texto. Em cada sequência, os sinais que fecham vêm primeiro e os que abrem, no fim.
 */
export function paresDaMarca(linha: string, marca: MarcaDoBotao): ParDeSinais[] {
  const pares: ParDeSinais[] = [], abertas: { marca: Marca; onde: Intervalo }[] = [];
  for (const s of marcasDaLinha(linha)) {
    if (s.tipo === 'codigo') {
      if (marca === 'codigo') pares.push({ abre: { inicio: s.inicio, fim: s.inicio + s.crases }, fecha: { inicio: s.fim - s.crases, fim: s.fim } });
      continue;
    }
    if (s.tipo === 'colchete') continue;
    let p = s.inicio;
    for (const m of s.fechaAqui) {
      const fecha = { inicio: p, fim: p + tamanhoDasMarcas([m]) }, i = abertas.map(a => a.marca).lastIndexOf(m);
      p = fecha.fim;
      const [aberta] = i >= 0 ? abertas.splice(i, 1) : [];
      if (aberta && m === marca) pares.push({ abre: aberta.onde, fecha });
    }
    let q = s.fim - tamanhoDasMarcas(s.abreAqui);
    for (const m of s.abreAqui) {
      const onde = { inicio: q, fim: q + tamanhoDasMarcas([m]) };
      abertas.push({ marca: m, onde });
      q = onde.fim;
    }
  }
  return pares;
}

/** Se a posição fica no intervalo. */
const dentro = (p: number, i: Intervalo) => p >= i.inicio && p < i.fim;

/**
 * Se o pedaço [a, b) da linha já está todo com a marca: cada letra dele (sem contar os espaços nem os sinais do Markdown) fica
 * dentro de um trecho marcado. Pedaço sem letra nenhuma devolve null (não conta).
 */
function todoMarcado(linha: string, a: number, b: number, pares: ParDeSinais[]): boolean | null {
  const sinais = marcasNaLinha(linha).simbolos;
  let letras = 0;
  for (let p = a; p < b; p++) {
    if (ESPACO.test(linha.charAt(p)) || sinais.some(s => dentro(p, s))) continue;
    letras++;
    if (!pares.some(par => p >= par.abre.fim && p < par.fecha.inicio)) return false;
  }
  return letras ? true : null;
}

/**
 * Põe (ou tira) a marca no pedaço [a, b) da linha. Um trecho com a mesma marca que só em parte cai no pedaço entra inteiro, e
 * os sinais dela que ficam lá dentro saem: assim nunca sobram "****" encaixados. Ao tirar, o que estava marcado fora do pedaço
 * continua marcado. Devolve a linha nova e onde ficou o trecho mexido.
 */
function marcarPedaco(linha: string, a: number, b: number, marca: MarcaDoBotao, pares: ParDeSinais[], por: boolean) {
  const m = MARCA_NO_TEXTO[marca];
  let de = a, ate = b, cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const p of pares) {
      if (p.abre.inicio >= ate || p.fecha.fim <= de || (p.abre.inicio >= de && p.fecha.fim <= ate)) continue;
      de = Math.min(de, p.abre.inicio);
      ate = Math.max(ate, p.fecha.fim);
      cresceu = true;
    }
  }
  const sinais = pares.filter(p => p.abre.inicio >= de && p.fecha.fim <= ate).flatMap(p => [p.abre, p.fecha]);
  const limpo = (x: number, y: number) => {
    let fica = '';
    for (let k = x; k < y; k++) if (!sinais.some(s => dentro(k, s))) fica += linha.charAt(k);
    return fica;
  };
  const envolver = (trecho: string) => { const e = bordas(trecho); return e.miolo ? e.antes + m + e.miolo + m + e.depois : trecho; };
  const novo = por ? envolver(limpo(de, ate)) : envolver(limpo(de, a)) + limpo(a, b) + envolver(limpo(b, ate));
  return { linha: linha.slice(0, de) + novo + linha.slice(ate), de, ate: de + novo.length };
}

/**
 * A marca num trecho de várias linhas (a marca vale numa linha só): cada linha ganha a sua, em volta do pedaço escolhido dela,
 * sem o começo de linha ("- ", "## "…). Se todos os pedaços já estão com a marca, ela sai de todos; senão, todos ficam com ela,
 * e o que já estava marcado é juntado, sem sinais sobrando. O trecho mexido continua escolhido.
 */
function alternarMarcaEmLinhas({ texto, inicio, fim }: Escolha, marca: MarcaDoBotao): Escolha {
  const { de, ate } = linhasDaEscolha(texto, inicio, fim);
  let desde = de;
  const linhas = texto.slice(de, ate).split('\n').map(l => {
    const comeco = comecoDaLinha(l).length, resto = l.slice(comeco), pares = paresDaMarca(resto, marca);
    const a = Math.min(Math.max(inicio - desde - comeco, 0), resto.length), b = Math.min(Math.max(fim - desde - comeco, 0), resto.length);
    desde += l.length + 1;
    return { comeco: l.slice(0, comeco), resto, a, b, pares, marcado: b > a ? todoMarcado(resto, a, b, pares) : null };
  });
  const comLetras = linhas.filter(l => l.marcado !== null);
  if (!comLetras.length) return { texto, inicio, fim };
  const por = comLetras.some(l => !l.marcado);
  let novo = '', escolhaDe = -1, escolhaAte = -1;
  linhas.forEach((l, n) => {
    if (n) novo += '\n';
    if (l.marcado === null) { novo += l.comeco + l.resto; return; }
    const r = marcarPedaco(l.resto, l.a, l.b, marca, l.pares, por), base = de + novo.length + l.comeco.length;
    if (escolhaDe < 0) escolhaDe = base + r.de;
    escolhaAte = base + r.ate;
    novo += l.comeco + r.linha;
  });
  return { texto: texto.slice(0, de) + novo + texto.slice(ate), inicio: escolhaDe, fim: escolhaAte };
}

/** Onde começam e terminam (sem a quebra) as linhas que a escolha toca, inteiras. */
function linhasDaEscolha(texto: string, inicio: number, fim: number) {
  const de = inicio ? texto.lastIndexOf('\n', inicio - 1) + 1 : 0, quebra = texto.indexOf('\n', Math.max(fim - 1, inicio));
  return { de, ate: quebra < 0 ? texto.length : quebra };
}

/**
 * Põe o começo de linha do botão (INICIO_NO_TEXTO) em cada linha do trecho escolhido, ou tira de todas se todas já o têm. Os
 * começos não se somam: um item de lista que vira título perde o "- ", e um "# " vira "## ". Ao pôr, a linha que já tem o
 * começo do botão fica como está (menos na numerada, veja "mantem" em INICIO_NO_TEXTO). Sem trecho, o cursor fica onde estava
 * (anda junto com o texto).
 */
export function alternarInicioDeLinha({ texto, inicio, fim }: Escolha, tipo: InicioDeLinha): Escolha {
  const { tem, poe, mantem } = INICIO_NO_TEXTO[tipo], { de, ate } = linhasDaEscolha(texto, inicio, fim);
  const linhas = texto.slice(de, ate).split('\n'), todas = linhas.every(l => tem.test(l));
  const novo = (l: string, i: number) => todas ? '' : mantem && tem.test(l) ? comecoDaLinha(l) : poe(i);
  const novas = linhas.map((l, i) => novo(l, i) + l.slice(comecoDaLinha(l).length)).join('\n');
  const antigo = comecoDaLinha(linhas[0]).length, primeiro = novo(linhas[0], 0).length;
  const cursor = de + Math.max(primeiro, inicio - de - antigo + primeiro);
  return { texto: texto.slice(0, de) + novas + texto.slice(ate), inicio: cursor, fim: inicio === fim ? cursor : de + novas.length };
}

/** O número da linha do texto (a primeira é a 0) em que está a posição. */
const numeroDaLinha = (texto: string, posicao: number) => texto.slice(0, posicao).split('\n').length - 1;

/**
 * Diz se, na leitura do texto (a mesma que o mostra), um bloco de código abre na linha "abre" e fecha exatamente na linha
 * "fecha". Assim o ``` que fecha um bloco anterior nunca é tomado pela cerca que abre outro.
 */
function codigoEntre(texto: string, abre: number, fecha: number): boolean {
  const linhas = texto.split('\n');
  let i = 0;
  while (i < abre) i = lerBloco(linhas, i).proxima;
  const lido = i === abre ? lerCodigo(linhas, abre) : null;
  return !!lido && lido.proxima === fecha + 1;
}

/**
 * Faz das linhas do trecho escolhido um bloco de código (uma linha ``` antes e outra depois), ou tira as cercas se o trecho é
 * todo o miolo de um bloco de código, ou se ele é um bloco inteiro, com as cercas. O que fica dentro continua escolhido.
 */
export function alternarBlocoDeCodigo({ texto, inicio, fim }: Escolha): Escolha {
  const { de, ate } = linhasDaEscolha(texto, inicio, fim), linhas = texto.slice(de, ate).split('\n'), primeira = numeroDaLinha(texto, de);
  const antes = de > 0 ? linhaEm(texto, de - 1) : undefined, depois = ate < texto.length ? linhaEm(texto, ate + 1) : undefined;
  if (antes && depois && codigoEntre(texto, primeira - 1, primeira + linhas.length)) {
    const miolo = texto.slice(de, ate);
    return { texto: texto.slice(0, antes.de) + miolo + texto.slice(depois.ate), inicio: antes.de, fim: antes.de + miolo.length };
  }
  const cercado = linhas.length >= 2 && codigoEntre(texto, primeira, primeira + linhas.length - 1);
  const miolo = (cercado ? linhas.slice(1, -1) : linhas).join('\n');
  const novo = cercado ? miolo : CERCA_DE_CODIGO + '\n' + miolo + '\n' + CERCA_DE_CODIGO;
  const comeco = cercado ? de : de + CERCA_DE_CODIGO.length + 1;
  return { texto: texto.slice(0, de) + novo + texto.slice(ate), inicio: comeco, fim: comeco + miolo.length };
}
/** O botão Código: num trecho de várias linhas, o bloco de código; numa linha só (ou sem trecho), o código em linha (`assim`). */
export const alternarCodigo = (e: Escolha) => e.texto.slice(e.inicio, e.fim).includes('\n') ? alternarBlocoDeCodigo(e) : alternarMarca(e, 'codigo');

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
