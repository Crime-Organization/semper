// LGPD: a pessoa excluída sai da cópia escondida dos recebimentos excluídos (#412). A mesma conta do gatilho
// privado.esquecer_pessoa_nos_excluidos (migração esquecer_pessoa_nos_recebimentos_excluidos), que o banco fictício usa.
// Limites (os mesmos do banco): um nome antigo de cliente que não está em item nenhum da cópia não é achado; no motivo de uma
// correção, só o nome escrito igual; e um pedaço cortado igual ao nome inteiro de outra pessoa da linha fica.

/** O que fica no lugar do nome de quem foi excluído, como no histórico dos contratos e dos processos. */
export const PESSOA_EXCLUIDA = 'pessoa excluída';

/** Onde o Financeiro escreve um nome: no começo, numa lista "A; B", depois de "Recebimento: ", "Repasse a " ou "Correção do recebimento de ". */
const ANTES = '(?<=^|; |: |Repasse a |Correção do recebimento de )';
/** O que vem depois do nome inteiro: a lista, ": ", " (código, parcela N)", " (código): " ou o sufixo cortado no fim do texto. */
const DEPOIS_DO_NOME = '(?=; |: | \\([^()]*, parcela [0-9]+\\)| \\([^()]*\\): | \\([^()]*$| ?$)';
/** Onde o Financeiro corta: antes de " (código, parcela N)" (a lista de clientes, em 200 letras) ou no fim (a descrição, em 300). */
const NO_CORTE = '(?= \\([^()]*, parcela [0-9]+\\)|$)';
/** Letras e números, em volta do nome no motivo da correção (texto livre). */
const LETRA = '0-9A-Za-zÀ-ÖØ-öø-ÿ';
/** A descrição de uma correção: até o código, e o motivo. */
const CORRECAO = /^(Correção do recebimento de [\s\S]*? \([^()]*\): )([\s\S]*)$/;

const letras = (t: string) => Array.from(t);
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Os textos como alternativas, os mais longos primeiro; '' quando não há texto. */
const alternativas = (textos: string[]) =>
  [...new Set(textos.filter(Boolean))].toSorted((a, b) => letras(b).length - letras(a).length || (a < b ? -1 : 1)).map(escapar).join('|');

/** Um dos nomes inteiro, onde o Financeiro o escreve. Outro nome que só começa igual ("Ana Lima Souza", ao esquecer "Ana Lima") não casa. */
export function nomeNoFinanceiro(nomes: string[]): RegExp {
  return new RegExp(`${ANTES}(?:${alternativas(nomes)})${DEPOIS_DO_NOME}`, 'g');
}

/** Um dos nomes inteiro no motivo da correção, entre o que não é letra; não quando é o começo do nome de outra pessoa da linha. */
export function nomeNoMotivo(nomes: string[], conhecidos: string[]): RegExp {
  const cada = [...new Set(nomes.filter(Boolean))].toSorted((a, b) => letras(b).length - letras(a).length).map(n => {
    const resto = alternativas(conhecidos.filter(c => c.startsWith(n) && c !== n).map(c => c.slice(n.length)));
    return escapar(n) + (resto ? `(?!${resto})` : '');
  });
  return new RegExp(`(?<![${LETRA}])(?:${cada.join('|')})(?![${LETRA}])`, 'g');
}

/** O pedaço de um dos nomes no ponto do corte, quando não é o nome inteiro de outra pessoa da linha; nulo se não sobra pedaço. */
export function pedacoDoNome(nomes: string[], conhecidos: string[]): RegExp | null {
  const pedacos = nomes.flatMap(n => letras(n).slice(1).map((_, i) => letras(n).slice(0, i + 1).join(''))).filter(p => !conhecidos.includes(p));
  return pedacos.length ? new RegExp(`${ANTES}(?:${alternativas(pedacos)})${NO_CORTE}`, 'g') : null;
}

type Pessoa = { id: string; nome: string };
type Padroes = { nome: RegExp; motivo: RegExp; pedaco: RegExp | null };
type Tipo = 'texto' | 'lista' | 'objeto' | 'outro';
const tipoDe = (v: unknown): Tipo =>
  typeof v === 'string' ? 'texto' : Array.isArray(v) ? 'lista' : v !== null && typeof v === 'object' ? 'objeto' : 'outro';

/** O item que aponta para a pessoa pelo código (id ou pessoa_id): o nome dele sai, mesmo um nome antigo. */
const apontaPara = (o: Record<string, unknown>, id: string) => o.id === id || o.pessoa_id === id;

/** Uma descrição do Financeiro: o nome inteiro, o nome no motivo da correção e o pedaço cortado. */
function descricaoSem(t: string, p: Padroes): string {
  const nome = t.replace(p.nome, PESSOA_EXCLUIDA);
  const correcao = CORRECAO.exec(nome);
  const motivo = correcao ? correcao[1] + correcao[2].replace(p.motivo, PESSOA_EXCLUIDA) : nome;
  return p.pedaco ? motivo.replace(p.pedaco, PESSOA_EXCLUIDA) : motivo;
}

const ESQUECER: Record<Tipo, (v: unknown, id: string, p: Padroes, chave?: string) => unknown> = {
  texto: (v, _id, p, chave) => chave === 'descricao' ? descricaoSem(v as string, p) : (v as string).replace(p.nome, PESSOA_EXCLUIDA),
  lista: (v, id, p) => (v as unknown[]).map(x => esquecer(x, id, p)),
  objeto: (v, id, p) => {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, k === 'nome' && apontaPara(o, id) ? PESSOA_EXCLUIDA : esquecer(x, id, p, k)]));
  },
  outro: v => v
};
const esquecer = (v: unknown, id: string, p: Padroes, chave?: string): unknown => ESQUECER[tipoDe(v)](v, id, p, chave);

/** Os valores de "nome" na cópia: dos itens que apontam para a pessoa (id) ou de todos. */
const NOMES: Record<Tipo, (v: unknown, id?: string) => string[]> = {
  texto: () => [],
  lista: (v, id) => (v as unknown[]).flatMap(x => nomesNaCopia(x, id)),
  objeto: (v, id) => {
    const o = v as Record<string, unknown>;
    const proprio = typeof o.nome === 'string' && (id === undefined || apontaPara(o, id)) ? [o.nome] : [];
    return [...proprio, ...Object.values(o).flatMap(x => nomesNaCopia(x, id))];
  },
  outro: () => []
};
const nomesNaCopia = (v: unknown, id?: string): string[] => NOMES[tipoDe(v)](v, id);

/** Uma linha da cópia escondida: a lista de clientes e a cópia das linhas do Financeiro. */
export type LinhaDaCopia = { cliente_nome?: string | null; copia?: unknown };

/**
 * As linhas da cópia (de um escritório) sem a pessoa: os nomes dela (o atual e os antigos, dos itens que apontam para ela) em
 * cliente_nome e em todo texto, e o "nome" de cada item que aponta para ela. Valores, datas, contas, códigos e ids ficam como estão.
 */
export function semAPessoaNasCopias<T extends LinhaDaCopia>(linhas: T[], pessoa: Pessoa): T[] {
  const nomes = [...new Set([pessoa.nome, ...linhas.flatMap(l => nomesNaCopia(l.copia, pessoa.id))])].filter(Boolean);
  const nome = nomeNoFinanceiro(nomes);
  return linhas.map(l => {
    const conhecidos = [...(l.cliente_nome ?? '').split('; '), ...nomesNaCopia(l.copia)].filter(c => c && !nomes.includes(c));
    const padroes = { nome, motivo: nomeNoMotivo(nomes, conhecidos), pedaco: pedacoDoNome(nomes, conhecidos) };
    return { ...l, ...(typeof l.cliente_nome === 'string' ? { cliente_nome: l.cliente_nome.replace(nome, PESSOA_EXCLUIDA) } : {}),
      copia: esquecer(l.copia, pessoa.id, padroes) } as T;
  });
}
