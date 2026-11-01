// Pares de clientes que podem ser a mesma pessoa: a lista para decidir (para-decidir.csv) e as decisões lidas de volta.
// Puro: recebe as linhas já lidas do CSV e devolve o que juntar. Ler e gravar o arquivo fica em ler.ts.
import { linhaVazia } from '../../src/regras/csv';
import { normal } from '../../src/regras/texto';

/** sim = mesma pessoa (juntar); nao = pessoas diferentes (ficam separadas). */
export type Decisao = 'sim' | 'nao';
/** Decisões por par (chaveDoPar das duas referências). */
export type Decisoes = Map<string, Decisao>;

/** Um lado do par: o cliente como estava antes de juntar pela decisão (a referência é a chave da decisão). */
export interface LadoDoPar { referencia: string; nome: string; linhas: number[] }
export interface Par {
  caso: string;
  a: LadoDoPar;
  b: LadoDoPar;
  /** O que o conversor fez com o par. */
  feito: string;
  decisao: Decisao | null;
}

/** O par pelas referências dos dois lados, na mesma ordem dos dois jeitos (A-B e B-A são o mesmo par). */
export const chaveDoPar = (a: string, b: string) => [a, b].sort().join('|');

/** O cabeçalho de para-decidir.csv. */
export const COLUNAS_PARA_DECIDIR = ['Caso', 'Referência A', 'Nome A', 'Linhas A', 'Referência B', 'Nome B', 'Linhas B',
  'O que foi feito', 'Sua decisão (mesma pessoa? sim/não)'] as const;
/** Como cada decisão volta escrita no arquivo regravado. */
const TEXTO_DA_DECISAO: Record<Decisao, string> = { sim: 'sim', nao: 'não' };
/** O que se aceita na coluna da decisão (comparado com normal(): sem acento nem maiúscula). Vazio = sem decisão. */
const DECISAO_POR_TEXTO = new Map<string, Decisao>([
  ['sim', 'sim'], ['s', 'sim'], ['x', 'sim'], ['mesma', 'sim'],
  ['nao', 'nao'], ['n', 'nao']
]);

/** Os pares -> linhas de para-decidir.csv (cabeçalho e um par por linha), com a decisão já dada, se houver. */
export function linhasParaDecidir(pares: Par[]): string[][] {
  return [[...COLUNAS_PARA_DECIDIR], ...pares.map(p => [
    p.caso, p.a.referencia, p.a.nome, p.a.linhas.join(', '), p.b.referencia, p.b.nome, p.b.linhas.join(', '), p.feito,
    p.decisao ? TEXTO_DA_DECISAO[p.decisao] : ''
  ])];
}

/** Acha a coluna pelo começo do nome (sem acento nem maiúscula). */
const coluna = (cabecalho: string[], comeco: string) => cabecalho.findIndex(c => normal(c).startsWith(normal(comeco)));

/**
 * As decisões de para-decidir.csv (já lido, com as linhas vazias, para o número de cada linha bater com a planilha).
 * Lança Error em português, com o número da linha, se a decisão não é sim nem não; sem repetir o texto da célula.
 */
export function lerDecisoes(tabela: string[][]): Decisoes {
  const linhas = tabela.map((celulas, i) => ({ celulas, numero: i + 1 })).filter(l => !linhaVazia(l.celulas));
  const [cabecalho, ...dados] = linhas;
  const [a, b, decisao] = [COLUNAS_PARA_DECIDIR[1], COLUNAS_PARA_DECIDIR[4], 'Sua decisão'].map(c => coluna(cabecalho?.celulas ?? [], c));
  if (a < 0 || b < 0 || decisao < 0) {
    throw new Error('O arquivo de decisões não é o para-decidir.csv do conversor: faltam as colunas "Referência A", "Referência B" ou "Sua decisão".');
  }
  const decisoes: Decisoes = new Map();
  for (const { celulas, numero } of dados) {
    const texto = normal(celulas[decisao]);
    if (!texto) continue;
    const valor = DECISAO_POR_TEXTO.get(texto);
    if (!valor) throw new Error(`Linha ${numero} do arquivo de decisões: a decisão não é "sim" nem "não". Escreva sim (mesma pessoa) ou não (pessoas diferentes), ou deixe vazia.`);
    const [refA, refB] = [celulas[a], celulas[b]].map(r => (r ?? '').trim());
    if (refA && refB) decisoes.set(chaveDoPar(refA, refB), valor);
  }
  return decisoes;
}

/** O que as decisões fazem com os pares desta execução. */
export interface DecisoesAplicadas {
  /** A decisão de cada par (na mesma ordem), ou null se não há. */
  porPar: (Decisao | null)[];
  /** Decisões que acharam o seu par. */
  aplicadas: number;
  /** Decisões de pares que não existem mais (a planilha mudou): ignoradas. */
  ignoradas: number;
}

/** Liga cada par à sua decisão, pelas referências dos dois lados. */
export function aplicarDecisoes(pares: { a: string; b: string }[], decisoes: Decisoes): DecisoesAplicadas {
  const chaves = pares.map(p => chaveDoPar(p.a, p.b));
  const existentes = new Set(chaves);
  const porPar = chaves.map(k => decisoes.get(k) ?? null);
  const aplicadas = [...decisoes.keys()].filter(k => existentes.has(k)).length;
  return { porPar, aplicadas, ignoradas: decisoes.size - aplicadas };
}
