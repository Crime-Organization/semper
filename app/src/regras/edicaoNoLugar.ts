// O título e a descrição dos cartões mudados no próprio lugar (#346), no jeito da anotação (#339): quem altera o cartão clica
// no título ou na descrição e muda ali mesmo. Aqui, o que o cartão confere antes de gravar (as mesmas regras do cadastro), o que
// ele grava, se há o que perder ao sair, e o que o lápis de um item já existente deixa de mostrar e de gravar. Tudo puro.

/** Os campos que se mudam no próprio lugar do cartão: o lápis do item já existente não os mostra nem os grava. */
export const CAMPOS_NO_LUGAR = ['titulo', 'descricao'] as const;
export type CampoNoLugar = typeof CAMPOS_NO_LUGAR[number];

/** O que está aberto para editar no cartão (null ou ausente: fora da edição). */
export type RascunhosNoLugar = Partial<Record<CampoNoLugar, string | null>>;
/** Como o título e a descrição estão gravados (o processo e o compromisso não têm descrição; o título deles pode faltar). */
export interface GravadoNoLugar { titulo: string | null; descricao?: string | null }

/**
 * Há edição por salvar no cartão? Só quando um rascunho aberto ficou diferente do que está gravado: abrir e não mudar nada não
 * conta (o título sem os espaços das pontas, como ele é gravado; a descrição como está, como a caixa a compara).
 */
export function edicaoNoLugarPorSalvar(gravado: GravadoNoLugar, r: RascunhosNoLugar): boolean {
  return (r.titulo != null && r.titulo.trim() !== (gravado.titulo ?? '').trim())
    || (r.descricao != null && r.descricao !== (gravado.descricao ?? ''));
}

/**
 * O erro de um campo mudado no próprio lugar ('' = está certo), pelas mesmas regras do cadastro: valida o cadastro vazio (do
 * mesmo tipo do item, quando o tipo muda a regra) só com este campo preenchido, e fica com o erro dele.
 */
export function erroNoLugar<C extends object>(
  validar: (c: C) => Partial<Record<keyof C, string>>, vazio: C, campo: keyof C & CampoNoLugar, valor: string
): string {
  return validar({ ...vazio, [campo]: valor })[campo] ?? '';
}

/** A descrição como vai para o banco: sem os espaços das pontas, e vazia vira nada (como no cadastro). */
export const descricaoAoGravar = (texto: string) => texto.trim() || null;
/** O título que pode faltar (processo, compromisso): vazio vira nada, e o cartão volta a mostrar o nome de sempre. */
export const tituloOpcionalAoGravar = (titulo: string) => titulo.trim() || null;

/** O que o lápis de um item já existente grava: tudo, menos o título e a descrição, que o cartão já muda no próprio lugar. */
export function semOsCamposDoLugar<D extends object>(dados: D): Omit<D, CampoNoLugar> {
  return Object.fromEntries(Object.entries(dados).filter(([campo]) => !(CAMPOS_NO_LUGAR as readonly string[]).includes(campo))) as Omit<D, CampoNoLugar>;
}
