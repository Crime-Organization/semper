// O editor ao vivo das anotações (#364): o texto continua sendo o mesmo Markdown guardado, mas aparece já formatado enquanto a
// pessoa escreve (títulos grandes, negrito, listas, caixinhas, citações, links). Desde a #368, como num editor de texto comum, a
// formatação fica desenhada sempre, também na linha e no trecho do cursor: os sinais (**, ##, "- ", "[", "](endereço)") nunca
// aparecem. O cursor pula por cima deles (posicaoDoCursor, soEscondido), o Backspace e o Delete apagam o que a pessoa vê sem
// desmanchar a formatação em volta (apagar), e o que ela digita colado a um sinal entra do lado que mantém a formatação
// (ondeEscrever). Digitar a sintaxe na mão ("- ", "# ", "**x**") continua valendo: quando ela se completa, vira formatação.
// Esta regra só diz o que fazer em cada linha e em cada trecho; a tela (ui/base/EditorAoVivo) transforma isso nas decorações e
// nos comandos do editor. A leitura das marcas é a mesma de regras/formatacao.ts, então o editor mostra exatamente o que o
// texto formatado mostra.
import {
  alternarMarca, CAIXINHA, comecoDaLinha, lerBloco, MARCA_NO_TEXTO, marcasNaLinha, paresDaMarca, POSICAO_DA_CAIXINHA, textoDosPedacos,
  type BlocoDo, type Escolha, type Intervalo, type Marca, type MarcaDoBotao, type NivelTitulo, type TipoBloco, type TrechoMarcado
} from './formatacao';

/** Como cada linha aparece no editor. "cerca" é a linha com ``` que abre ou fecha um bloco de código. */
export type TipoDaLinha = 'texto' | 'titulo' | 'lista' | 'tarefa' | 'numerada' | 'citacao' | 'cerca' | 'codigo' | 'divisoria' | 'tabela';

/** Uma linha do texto, já lida. As posições valem no texto todo. */
export interface LinhaAoVivo extends Intervalo {
  tipo: TipoDaLinha;
  /** O tamanho do começo de linha ("## ", "- ", "- [ ] ", "1. ", "> "), 0 se não há. */
  prefixo: number;
  nivel?: NivelTitulo;
  /** Na lista de tarefas, se a caixinha está marcada. */
  marcada?: boolean;
  /** Na lista de tarefas, o texto do item como a pessoa o lê, sem os sinais (o nome da caixinha, igual ao do texto formatado). */
  nome?: string;
  /** Os sinais do Markdown e os trechos destacados da linha (fora do começo de linha). */
  simbolos: Intervalo[];
  trechos: TrechoMarcado[];
}

/** Um trecho do texto trocado por outro: de "inicio" até antes de "fim" sai, e entra "texto". */
export interface Troca extends Intervalo { texto: string }

/**
 * O que o editor faz em cada lugar do texto: a classe da linha inteira; o sinal escondido; o trecho destacado (negrito, itálico,
 * código, link…); e o que toma o lugar de um começo de linha (a bolinha da lista, a caixinha que se marca, a linha divisória).
 * O começo escondido do título e da citação leva o que o leitor de tela diz no lugar dele ("leitura": "Título 2", "Citação"),
 * já que os olhos veem a formatação, e o leitor de tela não.
 */
export type Marcacao =
  | { tipo: 'linha'; inicio: number; classe: string }
  | { tipo: 'esconder'; inicio: number; fim: number; leitura?: string }
  | { tipo: 'destaque'; inicio: number; fim: number; marcas: Marca[]; link?: string }
  | { tipo: 'marcador'; inicio: number; fim: number }
  | { tipo: 'caixinha'; inicio: number; fim: number; marcada: boolean; troca: Troca; nome: string }
  | { tipo: 'divisoria'; inicio: number; fim: number };
export type TipoDaMarcacao = Marcacao['tipo'];
/** A marcação de um tipo. */
export type MarcacaoDo<T extends TipoDaMarcacao> = Extract<Marcacao, { tipo: T }>;

/** O que a linha de um bloco leva além das posições. */
type Parte = Pick<LinhaAoVivo, 'tipo' | 'prefixo' | 'nivel' | 'marcada' | 'nome'> & { comMarcas: boolean };

/** A linha de um bloco que ocupa uma linha só (título, item, citação), com o começo de linha dela. */
const deUmaLinha = (tipo: TipoDaLinha, extra: Partial<Parte> = {}) => (_b: unknown, linhas: string[], de: number): Parte[] =>
  [{ tipo, prefixo: comecoDaLinha(linhas[de]).length, comMarcas: true, ...extra }];

/**
 * As linhas de cada tipo de bloco (de "de" até antes de "ate"; "fechado" diz se o bloco de código tem a linha que fecha). No
 * código, a primeira linha e a que fecha são as cercas, e nada lá dentro vira marca; na tabela, as linhas ficam como estão.
 */
const LINHAS_DO_BLOCO: { [T in TipoBloco]: (b: BlocoDo<T>, linhas: string[], de: number, ate: number, fechado: boolean) => Parte[] } = {
  texto: () => [{ tipo: 'texto', prefixo: 0, comMarcas: true }],
  titulo: (b, linhas, de) => deUmaLinha('titulo', { nivel: b.nivel })(b, linhas, de),
  lista: deUmaLinha('lista'),
  tarefas: (b, linhas, de) => deUmaLinha('tarefa', { marcada: b.caixinhas[0]?.marcada, nome: textoDosPedacos(b.linhas[0] ?? []) })(b, linhas, de),
  numerada: deUmaLinha('numerada'),
  citacao: deUmaLinha('citacao'),
  codigo: (_b, _linhas, de, ate, fechado) => Array.from({ length: ate - de }, (_x, k): Parte => ({
    tipo: k === 0 || (fechado && k === ate - de - 1) ? 'cerca' : 'codigo', prefixo: 0, comMarcas: false
  })),
  divisoria: () => [{ tipo: 'divisoria', prefixo: 0, comMarcas: false }],
  tabela: (_b, _linhas, de, ate) => Array.from({ length: ate - de }, (): Parte => ({ tipo: 'tabela', prefixo: 0, comMarcas: false }))
};

/** As posições da linha passadas para o texto todo (a linha começa em "desde"). */
const noTexto = <T extends Intervalo>(x: T, desde: number): T => ({ ...x, inicio: x.inicio + desde, fim: x.fim + desde });

/**
 * O texto em linhas, como o editor as mostra: o tipo de cada uma (pela mesma leitura do texto formatado), o começo de linha e
 * os sinais e destaques de cada trecho. Não depende do cursor: o editor só a refaz quando o texto muda.
 */
export function linhasAoVivo(texto: string): LinhaAoVivo[] {
  const linhas = texto.split('\n'), inicios: number[] = [];
  let p = 0;
  for (const l of linhas) { inicios.push(p); p += l.length + 1; }
  const lidas: LinhaAoVivo[] = [];
  for (let i = 0; i < linhas.length;) {
    const { bloco, proxima } = lerBloco(linhas, i), ate = Math.min(proxima, linhas.length);
    const ler = LINHAS_DO_BLOCO[bloco.tipo] as (b: typeof bloco, l: string[], de: number, ate: number, fechado: boolean) => Parte[];
    ler(bloco, linhas, i, ate, proxima <= linhas.length && ate - i > 1).forEach(({ comMarcas, ...parte }, k) => {
      const n = i + k, inicio = inicios[n], desde = inicio + parte.prefixo;
      const marcas = comMarcas ? marcasNaLinha(linhas[n].slice(parte.prefixo)) : { simbolos: [], trechos: [] };
      lidas.push({
        ...parte, inicio, fim: inicio + linhas[n].length,
        simbolos: marcas.simbolos.map(s => noTexto(s, desde)), trechos: marcas.trechos.map(t => noTexto(t, desde))
      });
    });
    i = proxima;
  }
  return lidas;
}

/** O número da linha (a primeira é a 0) em que fica a posição. */
export function linhaDaPosicao(linhas: LinhaAoVivo[], posicao: number): number {
  let de = 0, ate = linhas.length - 1;
  while (de < ate) {
    const meio = (de + ate + 1) >> 1;
    if (linhas[meio].inicio <= posicao) de = meio;
    else ate = meio - 1;
  }
  return de;
}

/**
 * Como cada tipo de linha se comporta no editor: a classe dela (a tela põe o "ao-vivo-linha-" na frente); se o começo de linha
 * some ou vira um desenho (a bolinha, a caixinha), e então o cursor nunca para antes nem dentro dele; e se o resto da linha tem
 * sinais do Markdown (no código, na divisória e na tabela, não: lá o texto fica como está). A numerada mostra o "1. " escrito.
 */
interface ComoALinha { classe: (l: LinhaAoVivo) => string; comecoEscondido: boolean; comSinais: boolean }
const COMO_A_LINHA: Record<TipoDaLinha, ComoALinha> = {
  texto: { classe: () => 'texto', comecoEscondido: false, comSinais: true },
  titulo: { classe: l => `titulo-${l.nivel}`, comecoEscondido: true, comSinais: true },
  lista: { classe: () => 'lista', comecoEscondido: true, comSinais: true },
  tarefa: { classe: l => l.marcada ? 'tarefa marcada' : 'tarefa', comecoEscondido: true, comSinais: true },
  numerada: { classe: () => 'numerada', comecoEscondido: false, comSinais: true },
  citacao: { classe: () => 'citacao', comecoEscondido: true, comSinais: true },
  cerca: { classe: () => 'cerca', comecoEscondido: false, comSinais: false },
  codigo: { classe: () => 'codigo', comecoEscondido: false, comSinais: false },
  divisoria: { classe: () => 'divisoria', comecoEscondido: false, comSinais: false },
  tabela: { classe: () => 'tabela', comecoEscondido: false, comSinais: false }
};

/** O começo de linha ("## ", "- ", "> "…), como trecho do texto. */
const prefixo = (l: LinhaAoVivo): Intervalo => ({ inicio: l.inicio, fim: l.inicio + l.prefixo });
/** A troca que marca ou desmarca a caixinha da linha: só o caractere entre os colchetes (como alternarItemDeTarefa). */
const trocaDaCaixinha = (l: LinhaAoVivo): Troca => {
  const onde = l.inicio + POSICAO_DA_CAIXINHA;
  return { inicio: onde, fim: onde + 1, texto: l.marcada ? CAIXINHA.vazia : CAIXINHA.marcada };
};

/** O que toma o lugar do começo de linha: o título e a citação o escondem, a lista vira bolinha, a tarefa vira caixinha… */
const NO_COMECO: Record<TipoDaLinha, (l: LinhaAoVivo) => Marcacao[]> = {
  texto: () => [],
  titulo: l => [{ tipo: 'esconder', ...prefixo(l), leitura: `Título ${l.nivel}` }],
  lista: l => [{ tipo: 'marcador', ...prefixo(l) }],
  tarefa: l => [{ tipo: 'caixinha', ...prefixo(l), marcada: !!l.marcada, troca: trocaDaCaixinha(l), nome: l.nome ?? '' }],
  numerada: () => [],
  citacao: l => [{ tipo: 'esconder', ...prefixo(l), leitura: 'Citação' }],
  cerca: () => [],
  codigo: () => [],
  divisoria: l => l.fim > l.inicio ? [{ tipo: 'divisoria', inicio: l.inicio, fim: l.fim }] : [],
  tabela: () => []
};
/**
 * O que o editor mostra em cada linha (só as que tocam "entre", se dado: a parte que está na tela). É o mesmo com o cursor em
 * qualquer lugar (#368): os destaques sempre, e os sinais sempre escondidos, ou trocados pela bolinha, pela caixinha, pela linha
 * divisória. Vem em ordem de posição.
 */
export function marcacoesAoVivo(linhas: LinhaAoVivo[], entre?: Intervalo): Marcacao[] {
  const marcacoes: Marcacao[] = [];
  for (const l of linhas) {
    if (entre && (l.fim < entre.inicio || l.inicio > entre.fim)) continue;
    marcacoes.push({ tipo: 'linha', inicio: l.inicio, classe: COMO_A_LINHA[l.tipo].classe(l) });
    marcacoes.push(...NO_COMECO[l.tipo](l));
    marcacoes.push(...l.simbolos.map((s): Marcacao => ({ tipo: 'esconder', inicio: s.inicio, fim: s.fim })));
    marcacoes.push(...l.trechos.map((t): Marcacao => ({ tipo: 'destaque', ...t })));
  }
  return marcacoes.sort((a, b) => a.inicio - b.inicio);
}

/** As marcações que tomam o lugar do texto (o escondem ou põem um desenho nele): o cursor pula por cima delas, inteiras. */
const TOMA_O_LUGAR: Record<TipoDaMarcacao, boolean> = {
  linha: false, esconder: true, destaque: false, marcador: true, caixinha: true, divisoria: true
};
export const tomaOLugar = (m: Marcacao) => TOMA_O_LUGAR[m.tipo];

/** Os trechos da linha que a pessoa não vê como letras: o começo de linha escondido (ou desenhado) e os sinais. Em ordem. */
export function escondidosDaLinha(l: LinhaAoVivo): Intervalo[] {
  return [...(COMO_A_LINHA[l.tipo].comecoEscondido && l.prefixo ? [prefixo(l)] : []), ...l.simbolos];
}

/** O texto de "desde" até antes de "ate", sem os trechos dados (que podem passar das pontas ou se cruzar). */
function semOsTrechos(texto: string, desde: number, ate: number, trechos: Intervalo[]): string {
  let r = '', p = desde;
  for (const t of [...trechos].sort((a, b) => a.inicio - b.inicio)) {
    if (t.fim <= p || t.inicio >= ate) continue;
    r += texto.slice(p, Math.max(p, t.inicio));
    p = t.fim;
  }
  return p < ate ? r + texto.slice(p, ate) : r;
}

/** Se a linha "nova" (lida sozinha) aparece como a pessoa espera: do mesmo tipo da linha "l", com estas letras à vista. */
function ficaComo(l: LinhaAoVivo, nova: string, letras: string): boolean {
  const [lida] = linhasAoVivo(nova);
  return lida.tipo === l.tipo && semOsTrechos(nova, 0, nova.length, escondidosDaLinha(lida)) === letras;
}

/**
 * As posições a que se chega pulando, um a um, os trechos escondidos colados a "posicao": para trás, os que acabam nela; para a
 * frente, os que começam nela. Na tela, todas ficam no mesmo lugar que "posicao".
 */
function passos(trechos: Intervalo[], posicao: number, paraTras: boolean): number[] {
  const colado = (p: number) => trechos.find(t => t.fim > t.inicio && (paraTras ? t.fim : t.inicio) === p);
  const r: number[] = [];
  for (let t = colado(posicao); t; t = colado(posicao)) {
    posicao = paraTras ? t.inicio : t.fim;
    r.push(posicao);
  }
  return r;
}
/** A posição depois de pular todos os trechos escondidos colados a "posicao", para trás ou para a frente. */
const pular = (trechos: Intervalo[], posicao: number, paraTras: boolean) => passos(trechos, posicao, paraTras).at(-1) ?? posicao;

/** O trecho sem os sinais escondidos que ficam nas pontas dele ("**a**" inteiro escolhido vira só o "a"). */
function semSinaisNasPontas(simbolos: Intervalo[], { inicio, fim }: Intervalo): Intervalo {
  for (;;) {
    const noComeco = simbolos.find(s => s.inicio === inicio && s.fim <= fim && s.fim > s.inicio);
    const noFim = simbolos.find(s => s.fim === fim && s.inicio >= inicio && s.fim > s.inicio);
    if (noComeco) inicio = noComeco.fim;
    else if (noFim) fim = noFim.inicio;
    else return { inicio, fim };
  }
}

/**
 * O trecho a apagar para tirar as letras de "de" até antes de "ate" sem que um sinal escondido apareça: o próprio trecho, se
 * der; senão, sem os sinais das pontas e, se a formatação ficaria vazia ("****", que viraria uma divisória) ou partida, com os
 * sinais em volta ("**a**" sem o "a" some inteiro; "**a** **b**" sem o espaço vira "**ab**"). Se nada disso der, o próprio trecho.
 */
function trechoAApagar(texto: string, l: LinhaAoVivo, de: number, ate: number): Intervalo {
  const letras = semOsTrechos(texto, l.inicio, l.fim, [...escondidosDaLinha(l), { inicio: de, fim: ate }]);
  const fica = (t: Intervalo) => ficaComo(l, texto.slice(l.inicio, t.inicio) + texto.slice(t.fim, l.fim), letras);
  if (fica({ inicio: de, fim: ate })) return { inicio: de, fim: ate };
  // Cada volta abraça mais um par de sinais (o trecho só cresce, dentro da linha): acaba quando não há mais sinais em volta.
  for (let t = semSinaisNasPontas(l.simbolos, { inicio: de, fim: ate }); ;) {
    if (fica(t)) return t;
    const antes = l.simbolos.find(s => s.inicio < t.inicio && s.fim >= t.inicio);
    const depois = l.simbolos.find(s => s.inicio <= t.fim && s.fim > t.fim);
    if (!antes || !depois) return { inicio: de, fim: ate };
    t = { inicio: antes.inicio, fim: depois.fim };
  }
}

/** Um emoji (ou outro caractere que ocupa duas posições): as duas metades saem juntas. */
const DUAS_METADES = /^[\uD800-\uDBFF][\uDC00-\uDFFF]$/;
/** Quantas posições tem a letra logo antes (ou logo depois) de "posicao". */
const tamanhoDaLetra = (texto: string, posicao: number, paraTras: boolean) =>
  DUAS_METADES.test(paraTras ? texto.slice(posicao - 2, posicao) : texto.slice(posicao, posicao + 2)) ? 2 : 1;

/** O texto sem o trecho, com o cursor no lugar dado (o começo do trecho, se nada for dito). */
const tirar = (texto: string, t: Intervalo, cursor = t.inicio): Escolha =>
  ({ texto: texto.slice(0, t.inicio) + texto.slice(t.fim), inicio: cursor, fim: cursor });

/** O Backspace com o cursor (sem trecho escolhido) na posição "p" da linha "l". */
function apagarAntes(texto: string, l: LinhaAoVivo, p: number): Escolha | null {
  const conteudo = l.inicio + l.prefixo;
  if (p <= l.inicio) return null;   // o Backspace de sempre: junta com a linha de cima
  const q = pular(l.simbolos, p, true);
  if (q < conteudo) return null;   // no meio de um começo de linha escrito ("1|. ")
  if (l.prefixo && q === conteudo) return tirar(texto, prefixo(l));   // no começo do texto da linha: tira a formatação dela
  if (q === l.inicio) return q ? tirar(texto, { inicio: q - 1, fim: q }) : { texto, inicio: p, fim: p };   // só sinais antes
  return tirar(texto, trechoAApagar(texto, l, q - tamanhoDaLetra(texto, q, true), q));
}

/** O Delete com o cursor (sem trecho escolhido) na posição "p" da linha "n". */
function apagarDepois(texto: string, linhas: LinhaAoVivo[], n: number, p: number): Escolha | null {
  const l = linhas[n], seguinte = linhas.at(n + 1);
  if (p < l.inicio + l.prefixo) return null;   // antes do começo de linha: o Delete de sempre, que o apaga inteiro
  const q = pular(l.simbolos, p, false);
  if (q < l.fim) {
    const t = trechoAApagar(texto, l, q, q + tamanhoDaLetra(texto, q, false));
    return tirar(texto, t, Math.min(p, t.inicio));
  }
  // No fim da linha: a de baixo vem para esta, só com o texto (sem o "- " ou o "## " dela, que apareceriam aqui no meio). Numa
  // linha vazia, só ela sai, e a de baixo sobe como é (o título continua título, o item continua com a bolinha).
  if (seguinte) return tirar(texto, { inicio: l.fim, fim: l.fim === l.inicio ? seguinte.inicio : seguinte.inicio + seguinte.prefixo }, p);
  return p === q ? null : { texto, inicio: p, fim: p };
}

/**
 * O começo de um trecho escolhido, como a pessoa o vê: o trecho que pega o começo escondido da linha (a bolinha, o "## ", o
 * "> ", a caixinha), como o que se escolhe com Shift+Home ou com o clique triplo, começa depois dele. Assim, apagar ou colar por
 * cima do texto todo do item mantém o item, como nos editores comuns.
 */
const comecoVisivel = (l: LinhaAoVivo, p: number) =>
  COMO_A_LINHA[l.tipo].comecoEscondido && p < l.inicio + l.prefixo ? l.inicio + l.prefixo : p;

/**
 * O Backspace ("paraTras") e o Delete no editor ao vivo, que apagam o que a pessoa vê, sem desmanchar a formatação em volta:
 * - no começo do texto de um item de lista, de uma tarefa, de um título ou de uma citação, o Backspace tira a formatação da linha
 *   (o "- ", o "## ", o "> " saem), como nos editores comuns;
 * - a letra colada a um sinal escondido sai sem ele (o Backspace logo depois de "**RG**" apaga o "G", e não os "**");
 * - a formatação que fica sem letras sai inteira ("**G**" sem o "G" não vira "****"), e a que ficaria partida se junta;
 * - o trecho escolhido que pega o começo escondido da linha apaga só o texto: o item fica, vazio (comecoVisivel);
 * - o Delete no fim da linha traz a de baixo sem o começo de linha dela (numa linha vazia, a de baixo sobe como é).
 * Devolve null quando é o Backspace ou o Delete de sempre (fora das linhas com sinais, num trecho de várias linhas…).
 */
export function apagar(linhas: LinhaAoVivo[], { texto, inicio, fim }: Escolha, paraTras: boolean): Escolha | null {
  if (!linhas.length || inicio > fim) return null;
  const n = linhaDaPosicao(linhas, inicio), l = linhas[n];
  if (fim > l.fim || !COMO_A_LINHA[l.tipo].comSinais) return null;
  if (inicio < fim) {
    const de = comecoVisivel(l, inicio);
    return de < fim ? tirar(texto, trechoAApagar(texto, l, de, fim)) : null;   // só o começo escolhido: o de sempre, que o tira
  }
  return paraTras ? apagarAntes(texto, l, inicio) : apagarDepois(texto, linhas, n, inicio);
}

/**
 * O que a pessoa digita ou cola por cima de um trecho escolhido numa linha só: o trecho sai como no Backspace (apagar, sem levar
 * o começo escondido da linha nem deixar sinal à mostra), e o novo entra onde a formatação se mantém (ondeEscrever). Colar um
 * link novo por cima do texto todo de um item mantém a bolinha. Devolve null quando é a troca de sempre (várias linhas, código,
 * um texto com quebra de linha).
 */
export function escreverNoEscolhido(linhas: LinhaAoVivo[], escolha: Escolha, inserido: string): Escolha | null {
  if (!linhas.length || inserido.includes('\n') || escolha.inicio >= escolha.fim) return null;
  const sem = apagar(linhas, escolha, true);
  if (!sem) return null;
  const p = ondeEscrever(linhasAoVivo(sem.texto), sem.texto, sem.inicio, inserido), cursor = p + inserido.length;
  return { texto: sem.texto.slice(0, p) + inserido + sem.texto.slice(p), inicio: cursor, fim: cursor };
}

/**
 * Onde entra o que a pessoa digita ou cola na "posicao". Colado a um sinal escondido, o mesmo lugar da tela tem mais de uma
 * posição no texto (antes e depois do "**"): entra na que mantém a formatação como a pessoa a vê. O "s" digitado logo depois de
 * "**contrato**" entra antes dos "**" ("**contrato**s" desmancharia o negrito, e os sinais apareceriam); a letra digitada antes
 * da bolinha de um item entra depois do "- ". Se nenhuma mantiver (a pessoa está escrevendo a sintaxe na mão, como o último "*"
 * de "**x**"), entra onde está o cursor.
 */
export function ondeEscrever(linhas: LinhaAoVivo[], texto: string, posicao: number, inserido: string): number {
  if (!linhas.length || inserido.includes('\n')) return posicao;
  const l = linhas[linhaDaPosicao(linhas, posicao)];
  if (!COMO_A_LINHA[l.tipo].comSinais || posicao > l.fim) return posicao;
  const escondidos = escondidosDaLinha(l);
  const letras = semOsTrechos(texto, l.inicio, posicao, escondidos) + inserido + semOsTrechos(texto, posicao, l.fim, escondidos);
  const fica = (p: number) => ficaComo(l, texto.slice(l.inicio, p) + inserido + texto.slice(p, l.fim), letras);
  return [posicao, ...passos(escondidos, posicao, true), ...passos(escondidos, posicao, false)].find(fica) ?? posicao;
}

/**
 * Onde o cursor fica quando vai para "posicao": antes do começo escondido de uma linha (o "## " do título, a bolinha do item),
 * ele vai para o começo do texto dela. Assim a pessoa nunca escreve antes do "- " sem ver (o que desmancharia a lista).
 */
export function posicaoDoCursor(linhas: LinhaAoVivo[], posicao: number): number {
  if (!linhas.length) return posicao;
  const l = linhas[linhaDaPosicao(linhas, posicao)];
  return posicao === l.inicio && l.prefixo && COMO_A_LINHA[l.tipo].comecoEscondido ? l.inicio + l.prefixo : posicao;
}

/**
 * Se de "de" até antes de "ate" só há o que a pessoa não vê como letra (sinais, o começo escondido da linha): andar por cima
 * disso não muda nada na tela, então a seta segue até a próxima letra, sem parada que não se vê.
 */
export function soEscondido(linhas: LinhaAoVivo[], de: number, ate: number): boolean {
  if (!linhas.length || ate <= de) return false;
  const l = linhas[linhaDaPosicao(linhas, de)];
  if (ate > l.fim) return false;
  let p = de;
  for (const t of escondidosDaLinha(l)) if (t.inicio <= p && t.fim > p) p = t.fim;
  return p >= ate;
}

/**
 * A marca (negrito, itálico) que a pessoa ligou ou desligou com o cursor parado, sem trecho escolhido: ela vale para o que for
 * digitado em "posicao". Assim o botão não põe no texto um "****" vazio, que apareceria como sinais (ou como uma divisória, numa
 * linha vazia) enquanto a pessoa não escreve.
 */
export interface MarcaPendente { posicao: number; marca: MarcaDoBotao; ligar: boolean }

/** O que o botão de uma marca faz com o cursor parado: troca o texto já ("troca") ou espera o que a pessoa digitar ("pendente"). */
export type MarcaNoCursor = { troca: Escolha } | { pendente: MarcaPendente };

/** Uma letra ou um algarismo (o que forma uma palavra). */
const LETRA = /[\p{L}\p{N}]/u;

/** O par de sinais da marca (os "**" que abrem e fecham) que tem a posição dentro dele ou colada a ele, na linha "l". */
function parEmVolta(texto: string, l: LinhaAoVivo, posicao: number, marca: MarcaDoBotao) {
  const desde = l.inicio + l.prefixo;
  return paresDaMarca(texto.slice(desde, l.fim), marca)
    .map(p => ({ abre: noTexto(p.abre, desde), fecha: noTexto(p.fecha, desde) }))
    .find(p => posicao >= p.abre.inicio && posicao <= p.fecha.fim);
}

/** A palavra em que o cursor está no meio (letras dos dois lados), ou null. */
function palavraEmVolta(texto: string, l: LinhaAoVivo, posicao: number): Intervalo | null {
  const letra = (p: number) => p >= l.inicio + l.prefixo && p < l.fim && LETRA.test(texto.charAt(p));
  if (!letra(posicao - 1) || !letra(posicao)) return null;
  let inicio = posicao, fim = posicao;
  while (letra(inicio - 1)) inicio--;
  while (letra(fim)) fim++;
  return { inicio, fim };
}

/**
 * O botão de uma marca (B, I, ou Ctrl+B, Ctrl+I) com o cursor parado no editor ao vivo, como nos editores comuns:
 * - colado ao fim (ou ao começo) de um trecho com a marca, desliga: o cursor vai para fora dos sinais, e o que se digitar ali
 *   fica sem a marca ("**RG**" e B e " hoje" dá "**RG** hoje", sem "****" a mais);
 * - no meio de um trecho com a marca, tira a marca dele;
 * - no meio de uma palavra sem a marca, põe a marca na palavra;
 * - nos outros lugares (uma linha vazia, depois de um espaço), liga: o que se digitar ali entra com a marca (escreverComMarca).
 * Nas linhas sem sinais (código, tabela), põe os sinais como na caixa de texto comum (alternarMarca).
 */
export function marcarNoCursor(linhas: LinhaAoVivo[], texto: string, posicao: number, marca: MarcaDoBotao): MarcaNoCursor {
  const l = linhas.at(linhaDaPosicao(linhas, posicao));
  if (!l || !COMO_A_LINHA[l.tipo].comSinais || posicao > l.fim) return { troca: alternarMarca({ texto, inicio: posicao, fim: posicao }, marca) };
  const par = parEmVolta(texto, l, posicao, marca);
  if (par && posicao >= par.fecha.inicio) return { pendente: { posicao: par.fecha.fim, marca, ligar: false } };
  if (par && posicao <= par.abre.fim) return { pendente: { posicao: par.abre.inicio, marca, ligar: false } };
  if (par) {
    const cursor = posicao - (par.abre.fim - par.abre.inicio);
    return { troca: { texto: semOsTrechos(texto, 0, texto.length, [par.abre, par.fecha]), inicio: cursor, fim: cursor } };
  }
  const palavra = palavraEmVolta(texto, l, posicao);
  if (!palavra) return { pendente: { posicao, marca, ligar: true } };
  const marcada = alternarMarca({ texto, ...palavra }, marca), cursor = posicao + MARCA_NO_TEXTO[marca].length;
  return { troca: { texto: marcada.texto, inicio: cursor, fim: cursor } };
}

/** Se a linha "nova" (lida sozinha) tem o trecho [de, ate) com a marca. */
function comAMarca(nova: string, de: number, ate: number, marca: MarcaDoBotao): boolean {
  const [lida] = linhasAoVivo(nova);
  return lida.trechos.some(t => t.marcas.includes(marca) && t.inicio <= de && t.fim >= ate);
}

/**
 * O que a pessoa digita com uma marca pendente (marcarNoCursor). Ligada, o que entra fica entre os sinais ("**hoje**"), com o
 * cursor antes dos que fecham, para o resto da palavra entrar junto; desligada, entra fora dos sinais. Se assim a linha não fica
 * como a pessoa espera (um espaço não fica em negrito; uma letra colada a outra não abre a marca), entra como entraria sem a
 * marca (ondeEscrever), e a marca ligada continua esperando depois do que entrou. Devolve o texto novo, com o cursor, e a marca
 * que continua pendente (ou null).
 */
export function escreverComMarca(linhas: LinhaAoVivo[], texto: string, pendente: MarcaPendente, inserido: string): { escolha: Escolha; pendente: MarcaPendente | null } {
  const p = pendente.posicao, l = linhas.at(linhaDaPosicao(linhas, p));
  const comum = (onde: number, fica: MarcaPendente | null) =>
    ({ escolha: { texto: texto.slice(0, onde) + inserido + texto.slice(onde), inicio: onde + inserido.length, fim: onde + inserido.length }, pendente: fica });
  if (!l || inserido.includes('\n')) return comum(p, null);
  const escondidos = escondidosDaLinha(l);
  const letras = semOsTrechos(texto, l.inicio, p, escondidos) + inserido + semOsTrechos(texto, p, l.fim, escondidos);
  const m = pendente.ligar ? MARCA_NO_TEXTO[pendente.marca] : '';
  const nova = texto.slice(l.inicio, p) + m + inserido + m + texto.slice(p, l.fim), de = p - l.inicio + m.length;
  if (ficaComo(l, nova, letras) && comAMarca(nova, de, de + inserido.length, pendente.marca) === pendente.ligar) {
    const cursor = p + m.length + inserido.length;
    return { escolha: { texto: texto.slice(0, l.inicio) + nova + texto.slice(l.fim), inicio: cursor, fim: cursor }, pendente: null };
  }
  const onde = ondeEscrever(linhas, texto, p, inserido);
  return comum(onde, pendente.ligar ? { ...pendente, posicao: onde + inserido.length } : null);
}

/** O que o leitor de tela diz quando uma linha perde a formatação (o Backspace no começo do item, o Enter no item vazio). */
const FORMATACAO_TIRADA: Partial<Record<TipoDaLinha, string>> = {
  lista: 'Item de lista tirado', tarefa: 'Caixinha tirada', numerada: 'Número tirado', titulo: 'Título tirado', citacao: 'Citação tirada'
};
/**
 * O aviso para o leitor de tela quando a linha do cursor era de um tipo (lista, título…) e virou texto comum: quem não vê a
 * bolinha sumir fica sabendo. Null se nada foi tirado.
 */
export const formatacaoTirada = (antes: TipoDaLinha, depois: TipoDaLinha): string | null =>
  depois === 'texto' && antes !== depois ? FORMATACAO_TIRADA[antes] ?? null : null;

/**
 * A menor troca que leva de um texto ao outro (o que muda entre o começo e o fim iguais). O editor aplica só ela: o resto do texto
 * e o que já estava desenhado ficam como estão, e o Ctrl+Z desfaz só isso.
 */
export function diferenca(antes: string, depois: string): Troca {
  let comeco = 0;
  const menor = Math.min(antes.length, depois.length);
  while (comeco < menor && antes.charCodeAt(comeco) === depois.charCodeAt(comeco)) comeco++;
  let fim = 0;
  while (fim < menor - comeco && antes.charCodeAt(antes.length - 1 - fim) === depois.charCodeAt(depois.length - 1 - fim)) fim++;
  return { inicio: comeco, fim: antes.length - fim, texto: depois.slice(comeco, depois.length - fim) };
}

/** O começo da próxima linha de cada tipo de lista, a partir do começo da linha atual: a numerada conta mais um. */
const PROXIMO_ITEM: Partial<Record<TipoDaLinha, (comeco: string) => string>> = {
  lista: () => '- ',
  tarefa: () => '- [ ] ',
  numerada: comeco => comeco.replace(/^\d+/, n => String(Number(n) + 1)),
  citacao: () => '> '
};

/**
 * O Enter numa lista, como no Obsidian: no fim de um item, a linha nova já vem com o começo da lista ("- ", "- [ ] ", o número
 * seguinte, "> "); num item vazio, o começo sai e a lista acaba. Com um trecho escolhido dentro do item, o trecho sai e o item
 * seguinte começa no lugar dele. No título, veja enterNoTitulo. Fora das listas, com um trecho que sai do item ou com o cursor
 * no meio do começo de linha, devolve null (o Enter de sempre).
 */
export function continuarLista(linha: LinhaAoVivo, escolha: Escolha): Escolha | null {
  const { texto, inicio, fim } = escolha;
  if (linha.tipo === 'titulo') return enterNoTitulo(linha, escolha);
  const proximo = PROXIMO_ITEM[linha.tipo];
  if (!proximo || inicio > fim || inicio < linha.inicio + linha.prefixo || fim > linha.fim) return null;
  if (linha.fim === linha.inicio + linha.prefixo)
    return { texto: texto.slice(0, linha.inicio) + texto.slice(linha.fim), inicio: linha.inicio, fim: linha.inicio };
  const novo = '\n' + proximo(texto.slice(linha.inicio, linha.inicio + linha.prefixo)), cursor = inicio + novo.length;
  return { texto: texto.slice(0, inicio) + novo + texto.slice(fim), inicio: cursor, fim: cursor };
}

/**
 * O Enter com o cursor no começo do texto de um título (#368: o "## " está escondido, e o cursor nunca fica antes dele): a linha
 * nova entra em cima, e o título fica como está; num título vazio, o "## " sai, como num item de lista vazio. Nos outros lugares
 * do título, devolve null (o Enter de sempre: o que vem depois do cursor desce como texto comum).
 */
function enterNoTitulo(linha: LinhaAoVivo, { texto, inicio, fim }: Escolha): Escolha | null {
  const conteudo = linha.inicio + linha.prefixo;
  if (inicio !== conteudo || fim !== conteudo) return null;
  if (linha.fim === conteudo) return tirar(texto, { inicio: linha.inicio, fim: linha.fim });
  return { texto: texto.slice(0, linha.inicio) + '\n' + texto.slice(linha.inicio), inicio: inicio + 1, fim: inicio + 1 };
}

/**
 * O texto com as quebras de linha do Windows ("\r\n", e o "\r" sozinho) trocadas pela comum ("\n"), como o editor guarda (e
 * como a caixa de texto do navegador já fazia). Um texto gravado com "\r\n" (vindo de uma importação, por exemplo) abre igual,
 * sem linha a mais, e na primeira mudança é gravado com "\n".
 */
export const quebrasComuns = (texto: string) => texto.replace(/\r\n?/g, '\n');

/** O que o editor faz com o texto que recebe de quem o usa: a troca a aplicar (null: nada) e os textos que ainda esperam a volta. */
export interface Acompanhar { troca: Troca | null; enviados: string[] }

/**
 * O texto que quem usa o editor passa a ele ("valor") pode ser a volta, atrasada, do que o próprio editor mandou (o React desenha
 * depois que a pessoa já digitou outra letra), ou uma mudança de fora (o texto lido de novo, um Desfazer). Só a de fora entra no
 * editor: a volta atrasada desfaria a letra nova e levaria o cursor para trás dela. "enviados" são os textos que o editor mandou
 * e ainda não voltaram; "atual", o que está nele agora.
 */
export function acompanharValor(atual: string, valor: string, enviados: string[]): Acompanhar {
  const externo = quebrasComuns(valor);
  if (externo === atual) return { troca: null, enviados: [] };
  const volta = enviados.indexOf(valor);
  if (volta >= 0) return { troca: null, enviados: enviados.slice(volta + 1) };
  return { troca: diferenca(atual, externo), enviados: [] };
}

/** A metade de cima de um caractere que ocupa duas posições (um emoji, por exemplo): o corte não pode separá-la da outra. */
const METADE_DE_CIMA = /[\uD800-\uDBFF]$/;

/**
 * A troca de um texto com "tamanho" caracteres, cortada para o texto não passar de "maximo", como a caixa de texto do navegador
 * fazia: o que cabe entra (um trecho colado comprido entra até o limite), o resto fica de fora. A troca que diminui o texto, ou
 * que não o deixa maior que antes, entra inteira. Se nada do que entraria cabe, devolve null (nada muda).
 */
export function caberNoLimite(troca: Troca, tamanho: number, maximo: number): Troca | null {
  const depois = tamanho - (troca.fim - troca.inicio) + troca.texto.length;
  if (depois <= maximo || depois <= tamanho) return troca;
  const cabe = Math.max(0, Math.max(maximo, tamanho) - (tamanho - (troca.fim - troca.inicio)));
  const texto = troca.texto.slice(0, cabe).replace(METADE_DE_CIMA, '');
  return texto || troca.fim > troca.inicio ? { ...troca, texto } : null;
}
