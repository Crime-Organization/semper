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

/** Palavras mínimas (sem as partículas) para o nome sozinho identificar alguém: "João" não identifica ninguém. */
const PALAVRAS_DO_NOME_COMPLETO = 2;
/** Quantos erros de digitação cada tamanho de nome aceita (letras do menor nome, sem espaços). Nome curto não aceita
 *  nenhum: "Ana Lima" e "Ana Lina" podem ser duas pessoas. */
const ERROS_POR_TAMANHO = [{ letras: 22, erros: 2 }, { letras: 12, erros: 1 }];
const ERROS_MAXIMOS = Math.max(...ERROS_POR_TAMANHO.map(x => x.erros));

/** Quantas letras trocadas, faltando, sobrando ou invertidas separam dois textos (para de contar quando passa do limite). */
function errosEntre(a: string, b: string, limite: number): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let antes2: number[] = [], antes = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const troca = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(antes[j] + 1, atual[j - 1] + 1, antes[j - 1] + troca);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) atual[j] = Math.min(atual[j], antes2[j - 2] + 1);
    }
    if (Math.min(...atual) > limite) return limite + 1;
    [antes2, antes] = [antes, atual];
  }
  return antes[b.length];
}

/** O que importa de um nome para compará-lo: as letras sem espaços, os números e os sufixos ("Júnior", "Filho"…). */
interface NomeComparavel { palavras: number; letras: string; numeros: string; sufixos: string }
function comparavel(nome: string): NomeComparavel {
  const t = tokens(nome);
  return { palavras: t.length, letras: t.join(''), numeros: t.join(' ').replace(/\D+/g, ' ').trim(), sufixos: t.filter(p => SUFIXOS.has(p)).join(' ') };
}
function mesmoComparavel(a: NomeComparavel, b: NomeComparavel) {
  if (a.palavras < PALAVRAS_DO_NOME_COMPLETO || b.palavras < PALAVRAS_DO_NOME_COMPLETO) return false;
  if (a.letras === b.letras) return true;
  if (a.numeros !== b.numeros || a.sufixos !== b.sufixos) return false;
  const tamanho = Math.min(a.letras.length, b.letras.length);
  const aceitos = ERROS_POR_TAMANHO.find(x => tamanho >= x.letras)?.erros ?? 0;
  return aceitos > 0 && errosEntre(a.letras, b.letras, aceitos) <= aceitos;
}
/** O mesmo nome completo: sem contar acento, pontuação e partículas, e aceitando erros de digitação nos nomes longos. */
export const mesmoNome = (a: string, b: string) => mesmoComparavel(comparavel(a), comparavel(b));

/** Índice para achar, numa lista de nomes, as posições dos que são o mesmo nome (sem comparar cada um com todos). */
export function indiceDeNomes(nomes: string[]): (nome: string) => number[] {
  const porTamanho = new Map<number, { i: number; c: NomeComparavel }[]>();
  nomes.forEach((nome, i) => {
    const c = comparavel(nome);
    const lista = porTamanho.get(c.letras.length);
    if (lista) lista.push({ i, c }); else porTamanho.set(c.letras.length, [{ i, c }]);
  });
  return nome => {
    const c = comparavel(nome), achados: number[] = [];
    for (let n = c.letras.length - ERROS_MAXIMOS; n <= c.letras.length + ERROS_MAXIMOS; n++) {
      for (const outro of porTamanho.get(n) ?? []) if (mesmoComparavel(c, outro.c)) achados.push(outro.i);
    }
    return achados;
  };
}
