// O editor ao vivo das anotações (#364), como o do Obsidian: o texto continua sendo o mesmo Markdown guardado, mas aparece já
// formatado enquanto a pessoa escreve (títulos grandes, negrito, listas, caixinhas, citações, links), e os sinais (**, ##, "- ",
// "[", "](endereço)") ficam escondidos, aparecendo só na linha onde está o cursor, para editar. Esta regra só diz o que fazer em
// cada linha e em cada trecho; a tela (ui/base/EditorAoVivo) transforma isso nas decorações do editor. A leitura das marcas é a
// mesma de regras/formatacao.ts, então o editor mostra exatamente o que o texto formatado mostra.
import {
  CAIXINHA, comecoDaLinha, lerBloco, marcasNaLinha, POSICAO_DA_CAIXINHA, textoDosPedacos,
  type BlocoDo, type Escolha, type Intervalo, type Marca, type NivelTitulo, type TipoBloco, type TrechoMarcado
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
 * O que o editor faz em cada lugar do texto: a classe da linha inteira; o sinal à mostra (apagado, na linha do cursor) ou
 * escondido; o trecho destacado (negrito, itálico, código, link…); e o que toma o lugar de um começo de linha fora do cursor
 * (a bolinha da lista, a caixinha que se marca, a linha divisória).
 */
export type Marcacao =
  | { tipo: 'linha'; inicio: number; classe: string }
  | { tipo: 'simbolo'; inicio: number; fim: number }
  | { tipo: 'esconder'; inicio: number; fim: number }
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
function linhaEm(linhas: LinhaAoVivo[], posicao: number): number {
  let de = 0, ate = linhas.length - 1;
  while (de < ate) {
    const meio = (de + ate + 1) >> 1;
    if (linhas[meio].inicio <= posicao) de = meio;
    else ate = meio - 1;
  }
  return de;
}

/** As linhas que as escolhas (o cursor, ou os trechos escolhidos) tocam: nelas, os sinais aparecem para editar. */
export function linhasDoCursor(linhas: LinhaAoVivo[], escolhas: Intervalo[]): Set<number> {
  const com = new Set<number>();
  if (!linhas.length) return com;
  for (const e of escolhas) for (let n = linhaEm(linhas, e.inicio), ate = linhaEm(linhas, e.fim); n <= ate; n++) com.add(n);
  return com;
}

/** A classe de cada tipo de linha (a tela põe o "ao-vivo-" na frente). */
const CLASSE_DA_LINHA: Record<TipoDaLinha, (l: LinhaAoVivo) => string> = {
  texto: () => 'texto',
  titulo: l => `titulo-${l.nivel}`,
  lista: () => 'lista',
  tarefa: l => l.marcada ? 'tarefa marcada' : 'tarefa',
  numerada: () => 'numerada',
  citacao: () => 'citacao',
  cerca: () => 'cerca',
  codigo: () => 'codigo',
  divisoria: () => 'divisoria',
  tabela: () => 'tabela'
};

/** O começo de linha ("## ", "- ", "> "…), como trecho do texto. */
const prefixo = (l: LinhaAoVivo): Intervalo => ({ inicio: l.inicio, fim: l.inicio + l.prefixo });
/** A troca que marca ou desmarca a caixinha da linha: só o caractere entre os colchetes (como alternarItemDeTarefa). */
const trocaDaCaixinha = (l: LinhaAoVivo): Troca => {
  const onde = l.inicio + POSICAO_DA_CAIXINHA;
  return { inicio: onde, fim: onde + 1, texto: l.marcada ? CAIXINHA.vazia : CAIXINHA.marcada };
};

/** O que toma o lugar do começo de linha fora da linha do cursor: o título e a citação o escondem, a lista vira bolinha… */
const FORA_DO_CURSOR: Record<TipoDaLinha, (l: LinhaAoVivo) => Marcacao[]> = {
  texto: () => [],
  titulo: l => [{ tipo: 'esconder', ...prefixo(l) }],
  lista: l => [{ tipo: 'marcador', ...prefixo(l) }],
  tarefa: l => [{ tipo: 'caixinha', ...prefixo(l), marcada: !!l.marcada, troca: trocaDaCaixinha(l), nome: l.nome ?? '' }],
  numerada: () => [],
  citacao: l => [{ tipo: 'esconder', ...prefixo(l) }],
  cerca: () => [],
  codigo: () => [],
  divisoria: l => l.fim > l.inicio ? [{ tipo: 'divisoria', inicio: l.inicio, fim: l.fim }] : [],
  tabela: () => []
};
/** Na linha do cursor, os começos que ficam escondidos fora dela aparecem, apagados, para editar. */
const NO_CURSOR: Record<TipoDaLinha, (l: LinhaAoVivo) => Marcacao[]> = {
  ...FORA_DO_CURSOR,
  titulo: l => [{ tipo: 'simbolo', ...prefixo(l) }],
  lista: l => [{ tipo: 'simbolo', ...prefixo(l) }],
  tarefa: l => [{ tipo: 'simbolo', ...prefixo(l) }],
  citacao: l => [{ tipo: 'simbolo', ...prefixo(l) }],
  divisoria: l => l.fim > l.inicio ? [{ tipo: 'simbolo', inicio: l.inicio, fim: l.fim }] : []
};

/**
 * O que o editor mostra em cada linha (só as que tocam "entre", se dado: a parte que está na tela), conforme o cursor: os
 * destaques sempre; os sinais à mostra, apagados, nas linhas do cursor, e escondidos (ou trocados pela bolinha, pela caixinha,
 * pela linha divisória) nas outras. Vem em ordem de posição.
 */
export function marcacoesAoVivo(linhas: LinhaAoVivo[], comCursor: Set<number>, entre?: Intervalo): Marcacao[] {
  const marcacoes: Marcacao[] = [];
  linhas.forEach((l, n) => {
    if (entre && (l.fim < entre.inicio || l.inicio > entre.fim)) return;
    const cursor = comCursor.has(n);
    marcacoes.push({ tipo: 'linha', inicio: l.inicio, classe: CLASSE_DA_LINHA[l.tipo](l) });
    marcacoes.push(...(cursor ? NO_CURSOR : FORA_DO_CURSOR)[l.tipo](l));
    marcacoes.push(...l.simbolos.map((s): Marcacao => ({ tipo: cursor ? 'simbolo' : 'esconder', inicio: s.inicio, fim: s.fim })));
    marcacoes.push(...l.trechos.map((t): Marcacao => ({ tipo: 'destaque', ...t })));
  });
  return marcacoes.sort((a, b) => a.inicio - b.inicio);
}

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
 * seguinte começa no lugar dele. Fora das listas, com um trecho que sai do item ou com o cursor no meio do começo de linha,
 * devolve null (o Enter de sempre).
 */
export function continuarLista(linha: LinhaAoVivo, { texto, inicio, fim }: Escolha): Escolha | null {
  const proximo = PROXIMO_ITEM[linha.tipo];
  if (!proximo || inicio > fim || inicio < linha.inicio + linha.prefixo || fim > linha.fim) return null;
  if (linha.fim === linha.inicio + linha.prefixo)
    return { texto: texto.slice(0, linha.inicio) + texto.slice(linha.fim), inicio: linha.inicio, fim: linha.inicio };
  const novo = '\n' + proximo(texto.slice(linha.inicio, linha.inicio + linha.prefixo)), cursor = inicio + novo.length;
  return { texto: texto.slice(0, inicio) + novo + texto.slice(fim), inicio: cursor, fim: cursor };
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
