// LGPD: a pessoa excluída sai da cópia escondida dos recebimentos excluídos (#412). A mesma conta do gatilho
// privado.esquecer_pessoa_nos_excluidos (migração esquecer_pessoa_nos_recebimentos_excluidos), que o banco fictício usa.

/** O que fica no lugar do nome de quem foi excluído, como no histórico dos contratos e dos processos. */
export const PESSOA_EXCLUIDA = 'pessoa excluída';

/**
 * O nome inteiro, onde o Financeiro o escreve: sozinho, numa lista de clientes ("A; B"), depois de "Recebimento: " ou de
 * "Repasse a ", antes de " (código, parcela N)". Outro nome que só começa igual ("Ana Lima Souza", ao esquecer "Ana Lima") não casa.
 */
export function nomeNoFinanceiro(nome: string): RegExp {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<=^|; |: |Repasse a )${escapado}(?=; | \\([^()]*, parcela [0-9]+\\)|: |$)`, 'g');
}

type Pessoa = { id: string; nome: string };
type Tipo = 'texto' | 'lista' | 'objeto' | 'outro';
const tipoDe = (v: unknown): Tipo =>
  typeof v === 'string' ? 'texto' : Array.isArray(v) ? 'lista' : v !== null && typeof v === 'object' ? 'objeto' : 'outro';

/** O item que aponta para a pessoa pelo código (id ou pessoa_id): o nome dele sai, mesmo um nome antigo. */
const apontaPara = (o: Record<string, unknown>, p: Pessoa) => o.id === p.id || o.pessoa_id === p.id;

const ESQUECER: Record<Tipo, (v: unknown, p: Pessoa, padrao: RegExp) => unknown> = {
  texto: (v, _p, padrao) => (v as string).replace(padrao, PESSOA_EXCLUIDA),
  lista: (v, p, padrao) => (v as unknown[]).map(x => esquecer(x, p, padrao)),
  objeto: (v, p, padrao) => {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.entries(o).map(([k, x]) =>
      [k, k === 'nome' && apontaPara(o, p) ? PESSOA_EXCLUIDA : esquecer(x, p, padrao)]));
  },
  outro: v => v
};
const esquecer = (v: unknown, p: Pessoa, padrao: RegExp): unknown => ESQUECER[tipoDe(v)](v, p, padrao);

/**
 * A cópia (ou a linha inteira da cópia) sem a pessoa: o nome dela em todo texto e o "nome" de cada item que aponta para ela.
 * Valores, datas, contas, códigos e ids ficam como estão.
 */
export function semAPessoa<T>(copia: T, pessoa: Pessoa): T {
  return esquecer(copia, pessoa, nomeNoFinanceiro(pessoa.nome)) as T;
}
