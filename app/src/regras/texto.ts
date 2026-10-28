// Texto comparável: sem acentos, sem espaços nas pontas, em minúsculas ("  José " e "jose" ficam iguais).
// Serve à busca, a nomes repetidos (colunas, tipos de vínculo) e às duas camadas de dados.
export const normal = (t: unknown) => String(t || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
