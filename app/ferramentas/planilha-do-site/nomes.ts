// Nomes de pessoas: comparar dois nomes para saber se podem ser da mesma pessoa. Puro.
// Porte do script de limpeza usado nos dados reais (limpar.cjs): mudar estas regras muda quem é juntado com quem.

/** Sem acentos (o resto do texto fica como está). */
export const semAcento = (t: string | null | undefined) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Nome comparável: sem acento, em maiúsculas, só letras e números separados por um espaço. */
export const nomeNorm = (t: string | null | undefined) => semAcento(t).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/** Palavras que não contam na comparação de nomes. */
const PARTICULAS: ReadonlySet<string> = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'D']);
/** "Júnior", "Filho"… de um lado só separam pai e filho. */
const SUFIXOS: ReadonlySet<string> = new Set(['JUNIOR', 'JR', 'FILHO', 'FILHA', 'NETO', 'NETA', 'SOBRINHO', 'SOBRINHA', 'SEGUNDO', 'II', 'III']);
/** As palavras do nome, sem as partículas. */
export const tokens = (t: string | null | undefined) => nomeNorm(t).split(' ').filter(p => p && !PARTICULAS.has(p));
/** O nome sem partículas, para achar nomes iguais. */
export const chaveDoNome = (t: string | null | undefined) => tokens(t).join(' ');

/** Notas da semelhança: nomes iguais; um nome contido no outro; e a parte mínima de palavras em comum para valer algo. */
export const NOMES_IGUAIS = 3, NOME_CONTIDO = 2;
/** Palavras em comum (mínimo) e a proporção delas entre todas as palavras dos dois nomes (índice de Jaccard). */
const PALAVRAS_EM_COMUM = 2, PROPORCAO_MINIMA = 0.5;

/**
 * Quanto dois nomes parecem ser da mesma pessoa: 3 iguais (sem acento/caixa), 2 um contido no outro, 1,5 a 2 a maioria
 * das palavras em comum, 0 diferentes. O primeiro nome tem de ser o mesmo.
 */
export function semelhanca(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  if (A.join(' ') === B.join(' ')) return NOMES_IGUAIS;
  if (A[0] !== B[0]) return 0;
  const sA = new Set(A), sB = new Set(B);
  for (const s of SUFIXOS) if (sA.has(s) !== sB.has(s)) return 0;
  const [menor, maior] = A.length <= B.length ? [A, sB] : [B, sA];
  const comuns = menor.filter(t => maior.has(t)).length;
  if (comuns === menor.length && menor.length >= PALAVRAS_EM_COMUM) return NOME_CONTIDO;
  const proporcao = comuns / new Set([...A, ...B]).size;
  return comuns >= PALAVRAS_EM_COMUM && proporcao >= PROPORCAO_MINIMA ? 1 + proporcao : 0;
}
