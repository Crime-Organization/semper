// O menu "Acrescentar ao cartão" (#399, que substituiu a linha de botões rápidos da #351): uma bolinha só, no topo do cartão, que
// abre um menu com cada coisa que aquele cartão pode ter (as datas, os checklists, as anotações, as ligações), quantas já existem
// e duas ações: ver (vai até a coisa no cartão e a abre) e acrescentar (o mesmo formulário ou menu do "+" da seção). Quem oferece
// cada coisa é a própria seção (o "+" do título, #390) ou o dado que se muda no lugar (o prazo); o cartão arquivado ou só para ler
// oferece só o ver. Aqui fica o que não depende da tela: os tipos, o nome de cada um no menu, a ordem e o nome do que se ouve.

/** Os tipos de coisa do cartão, uma linha do menu cada. */
export type TipoDeAtalho = 'datas' | 'checklist' | 'anotacao' | 'ligacao';

/** O nome de cada coisa no menu, no plural, como o cartão a mostra (a seção "Checklists", "Anotações"). */
export const NOME_NO_MENU: Record<TipoDeAtalho, string> = {
  datas: 'Datas',
  checklist: 'Checklists',
  anotacao: 'Anotações',
  ligacao: 'Ligações'
};

/** A ordem das linhas do menu: a das coisas no cartão (as datas, no alto; os checklists, a primeira seção; as anotações, na coluna). */
export const ORDEM_DOS_ATALHOS: readonly TipoDeAtalho[] = ['datas', 'checklist', 'anotacao', 'ligacao'];

/** O nome da bolinha e do menu dela (na dica e para o leitor de tela). */
export const NOME_DO_MENU_DE_ATALHOS = 'Acrescentar ao cartão';

/** O que o menu precisa saber de cada coisa oferecida: o tipo e, quando ela conta, quantas há. */
export interface CoisaOferecida { tipo: TipoDeAtalho; quantidade?: number }

/**
 * As linhas do menu: uma por tipo, na ordem de sempre. Quando o mesmo tipo é oferecido duas vezes (o prazo e a seção de prazos), fica
 * a seção, que tem a contagem; sem ela, a primeira oferecida.
 */
export function coisasDoMenu<T extends CoisaOferecida>(oferecidas: readonly T[]): T[] {
  return ORDEM_DOS_ATALHOS.flatMap(tipo => {
    const doTipo = oferecidas.filter(c => c.tipo === tipo);
    const escolhida = doTipo.find(c => c.quantidade !== undefined) ?? doTipo[0];
    return escolhida ? [escolhida] : [];
  });
}

/** O nome que se ouve do "ver" de uma linha: "Ver checklists (2)"; sem contagem (as datas do prazo), "Ver datas". */
export function nomeDoVer({ tipo, quantidade }: CoisaOferecida) {
  const nome = `Ver ${NOME_NO_MENU[tipo].toLowerCase()}`;
  return quantidade === undefined ? nome : `${nome} (${quantidade})`;
}
