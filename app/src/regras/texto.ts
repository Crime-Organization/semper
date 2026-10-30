// Texto comparável: sem acentos, sem espaços nas pontas, em minúsculas ("  José " e "jose" ficam iguais).
// Serve à busca, a nomes repetidos (colunas, tipos de vínculo) e às duas camadas de dados.
export const normal = (t: unknown) => String(t || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * As sugestões que combinam com o texto digitado, sem acento nem maiúscula fazer diferença: primeiro as que começam por
 * ele, depois as que o contêm. A que já é igual ao texto não aparece (já está escrita).
 */
export function sugestoesQueCombinam<T extends { valor: string }>(texto: string, sugestoes: T[], limite: number): T[] {
  const t = normal(texto), comeca: T[] = [], contem: T[] = [];
  for (const s of sugestoes) {
    const v = normal(s.valor);
    if (v === t || !v.includes(t)) continue;
    (v.startsWith(t) ? comeca : contem).push(s);
  }
  return [...comeca, ...contem].slice(0, limite);
}
