// Referência de cada cliente no SEMPER (coluna "referencia"): a mesma entre execuções e entre downloads da planilha,
// para uma nova importação completar o cadastro em vez de duplicar. Puro.
import { nomeNorm } from './nomes';

/** Começo das referências dos clientes vindos do formulário do site. */
export const PREFIXO_DA_REFERENCIA = 'site-';

/** FNV-1a de 32 bits: a base e o primo do algoritmo. */
const FNV_BASE = 0x811c9dc5, FNV_PRIMO = 0x01000193;
/** O resumo sai em base 36 (algarismos e letras minúsculas): curto e legível. */
const BASE_DO_RESUMO = 36;

/** Resumo curto de um texto (hash FNV-1a de 32 bits dos bytes UTF-8, em base 36). Não é segredo: só um código estável. */
export function resumo(texto: string): string {
  let h = FNV_BASE;
  for (const byte of new TextEncoder().encode(texto)) h = Math.imul(h ^ byte, FNV_PRIMO) >>> 0;
  return h.toString(BASE_DO_RESUMO);
}

/** Um envio do formulário (uma linha da planilha). */
export interface EnvioDoSite {
  linha: number;
  /** Data e hora do envio em ISO, ou null se a célula está vazia ou ilegível. */
  iso: string | null;
  /** O mesmo instante em milissegundos (para ordenar). */
  ms: number | null;
  nome: string;
}

/** O que identifica um cliente quando nenhum envio tem data. */
export interface IdentidadeDoCliente {
  envios: EnvioDoSite[];
  nome: string;
  documento: string;
  telefone: string;
  email: string;
}

/** O envio mais antigo que tem data (empate: a menor linha), ou undefined. */
export const envioMaisAntigo = (envios: EnvioDoSite[]) =>
  envios.filter(e => e.ms !== null).sort((a, b) => (a.ms as number) - (b.ms as number) || a.linha - b.linha)[0];

/**
 * A referência do cliente, antes de tirar as repetidas: "site-" + resumo da data do envio mais antigo e do nome desse
 * envio. Sem data em nenhum envio: o nome e o documento (ou o primeiro telefone, o primeiro e-mail, a menor linha).
 */
export function referenciaBase(c: IdentidadeDoCliente): string {
  const antigo = envioMaisAntigo(c.envios);
  if (antigo) return PREFIXO_DA_REFERENCIA + resumo(`${antigo.iso}|${nomeNorm(antigo.nome)}`);
  const menorLinha = Math.min(...c.envios.map(e => e.linha));
  return PREFIXO_DA_REFERENCIA + resumo(`${nomeNorm(c.nome)}|${c.documento || c.telefone || c.email || `linha ${menorLinha}`}`);
}

/**
 * Referências sem repetição: a repetida ganha "-2", "-3"… pela ordem da menor linha de cada cliente (a primeira fica como
 * está). Devolve as referências na ordem recebida e quantas foram repetidas.
 */
export function semRepetir(clientes: { base: string; menorLinha: number }[]): { referencias: string[]; repetidas: number } {
  const ordem = clientes.map((c, i) => ({ ...c, i })).sort((a, b) => a.menorLinha - b.menorLinha || a.i - b.i);
  const vezes = new Map<string, number>(), referencias: string[] = clientes.map(c => c.base);
  let repetidas = 0;
  for (const { base, i } of ordem) {
    const n = (vezes.get(base) ?? 0) + 1;
    vezes.set(base, n);
    if (n > 1) repetidas++;
    referencias[i] = n > 1 ? `${base}-${n}` : base;
  }
  return { referencias, repetidas };
}
