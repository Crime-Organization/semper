// Contas das seções dos cartões (o número ao lado do título de cada seção que recolhe).

/** Um campo conta como preenchido quando tem algo além do traço de "vazio". */
const preenchido = (v: unknown) => v !== null && v !== undefined && v !== false && String(v).trim() !== '' && String(v).trim() !== '—';

/** Quantos campos de uma seção de dados estão preenchidos (ex.: "Dados do cadastro" com 12 de 27). */
export const quantosPreenchidos = (valores: unknown[]) => valores.filter(preenchido).length;
