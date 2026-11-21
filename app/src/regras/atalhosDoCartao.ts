// Os botões rápidos do cartão (#351, a linha de botões da imagem do Trello): o que se acrescenta num cartão (as datas, um checklist,
// uma anotação, uma ligação), numa linha logo abaixo das datas, que abre cada coisa ali mesmo. Cada cartão mostra só os que tem:
// quem oferece o atalho é a própria seção (o "+" do título, #390) ou o dado que se muda no lugar (o prazo), e o cartão arquivado ou só
// para ler não oferece nenhum. Aqui fica o que não depende da tela: os tipos, o nome de cada botão e a ordem deles na linha.

/** Os tipos de atalho, um botão cada. */
export type TipoDeAtalho = 'datas' | 'checklist' | 'anotacao' | 'ligacao';

/** O nome de cada botão, curto, como na linha do Trello. O que ele faz por inteiro ("Adicionar checklist") vai na dica. */
export const ROTULO_DO_ATALHO: Record<TipoDeAtalho, string> = {
  datas: 'Datas',
  checklist: 'Checklist',
  anotacao: 'Anotação',
  ligacao: 'Ligação'
};

/** A ordem dos botões na linha: a das coisas no cartão (as datas, logo acima; os checklists, a primeira seção; as anotações, na coluna). */
export const ORDEM_DOS_ATALHOS: readonly TipoDeAtalho[] = ['datas', 'checklist', 'anotacao', 'ligacao'];

/** O nome da linha dos botões, para o leitor de tela. */
export const NOME_DA_LINHA_DE_ATALHOS = 'Acrescentar ao cartão';

/** Os tipos oferecidos, cada um uma vez, na ordem da linha (quem oferece o mesmo tipo duas vezes ganha um botão só). */
export function atalhosNaOrdem(oferecidos: Iterable<TipoDeAtalho>): TipoDeAtalho[] {
  const tem = new Set(oferecidos);
  return ORDEM_DOS_ATALHOS.filter(t => tem.has(t));
}
