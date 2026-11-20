// Os responsáveis da pessoa no topo do cartão (#387): vários, todos iguais, sem um principal. As palavras das bolinhas e dos
// avisos ficam aqui, numa tabela por tipo de mudança (pôr ou tirar), e a tela só as mostra. A pessoa é vista pelo escritório
// todo: tirar alguém dos responsáveis não o tira do cartão, e por isso não há a pergunta antes de sair dos outros cartões.

/** O papel de cada um, na dica e no nome da bolinha: "Ana Souza · Responsável". */
export const PAPEL_NA_PESSOA = 'Responsável';
/** O nome da bolinha com "+" (e da busca que ela abre). */
export const POR_RESPONSAVEL = 'Pôr responsável';

/** O que muda nos responsáveis pelo topo do cartão. */
export type MudancaNosResponsaveis = 'por' | 'tirar';

/** O aviso no pé da tela depois de cada mudança (com o Desfazer) e o nome dela na pilha do desfazer. */
export const AVISO_NOS_RESPONSAVEIS: Record<MudancaNosResponsaveis, { texto: (nome: string) => string; oQue: string }> = {
  por: { texto: nome => `${nome} agora é responsável.`, oQue: 'inclusão do responsável' },
  tirar: { texto: nome => `${nome} saiu dos responsáveis.`, oQue: 'retirada do responsável' }
};

/**
 * O que a bolinha de um responsável diz (o clique o tira): "Tirar Ana Souza dos responsáveis"; na própria bolinha de quem está
 * logado, "Deixar de ser responsável (Ana Souza)".
 */
export function tirarDosResponsaveis(p: { id: string; nome: string }, eu: string): string {
  return p.id === eu ? `Deixar de ser responsável (${p.nome})` : `Tirar ${p.nome} dos responsáveis`;
}
