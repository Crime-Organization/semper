// Atalhos de teclado das páginas de módulo (#86). Decisão do dono (20/11/2026): valem em todos os módulos com página de
// módulo: "/" leva à busca da página, "N" abre o "Novo" do módulo aberto e "?" mostra a lista dos atalhos.
// Nenhum atalho dispara enquanto a pessoa escreve (campo de texto, área de texto, editor, lista de escolha), com Ctrl, Alt
// ou Cmd apertado (esses são do navegador e dos atalhos de sempre, como o Ctrl+Z e o Ctrl+K), nem com algo aberto por
// cima da página (uma janela, o cartão, um menu, a busca geral): ali o N criaria outro item por trás do que está aberto, e
// o "/" levaria o cursor para a busca escondida atrás dele. Fechando o que está por cima, os atalhos voltam.
// Regras puras: a tela (ui/atalhos.tsx) diz que tecla veio e onde a pessoa está; aqui se decide o que fazer.

/** O que cada atalho da página faz. */
export type Atalho = 'buscar' | 'novo' | 'atalhos';

interface DefinicaoDoAtalho {
  /** A tecla, como o navegador a informa (em minúsculas: "N" e "n" valem igual). */
  tecla: string;
  /** Como a tecla aparece na dica e na lista. */
  nome: string;
}

/** A tabela dos atalhos da página de módulo. Atalho novo = uma entrada nova aqui (e o que ele faz, na página). */
export const ATALHOS: Record<Atalho, DefinicaoDoAtalho> = {
  buscar: { tecla: '/', nome: '/' },
  novo: { tecla: 'n', nome: 'N' },
  atalhos: { tecla: '?', nome: '?' }
};

const PELA_TECLA = new Map((Object.entries(ATALHOS) as [Atalho, DefinicaoDoAtalho][]).map(([atalho, d]) => [d.tecla, atalho]));

/** A tecla apertada, com o que o navegador conta dela. */
export interface TeclaApertada {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  /** A tecla segurada, repetindo sozinha. */
  repeat?: boolean;
  /** No meio de um acento ou de outra letra composta. */
  isComposing?: boolean;
}

/** Onde a pessoa está quando aperta a tecla. */
export interface OndeEsta {
  /** O foco está num lugar de escrever (campo de texto, área de texto, editor, lista de escolha). */
  escrevendo: boolean;
  /** Há algo aberto por cima da página: janela, cartão, menu ou a busca geral. */
  algoPorCima: boolean;
}

/** O atalho que a tecla pede, ou null quando ela é só uma letra (ou não é atalho nenhum). */
export function atalhoDaTecla(tecla: TeclaApertada, onde: OndeEsta): Atalho | null {
  if (tecla.ctrlKey || tecla.altKey || tecla.metaKey || tecla.repeat || tecla.isComposing) return null;
  if (onde.escrevendo || onde.algoPorCima) return null;
  return PELA_TECLA.get(tecla.key.toLowerCase()) ?? null;
}

/** Os tipos de input que não recebem texto: com o foco neles (marcar uma linha da tabela, por exemplo), os atalhos valem. */
const INPUTS_SEM_TEXTO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image']);
/** As etiquetas que sempre recebem o que se digita. */
const SEMPRE_DE_ESCREVER = new Set(['TEXTAREA', 'SELECT']);

/** O elemento com o foco, no que importa para saber se a pessoa está escrevendo. */
export interface ElementoComFoco { etiqueta: string; tipo?: string; editavel?: boolean }

/** O foco está num lugar onde a tecla é uma letra digitada (e não um atalho). */
export function ehLugarDeEscrever({ etiqueta, tipo, editavel }: ElementoComFoco) {
  if (editavel || SEMPRE_DE_ESCREVER.has(etiqueta.toUpperCase())) return true;
  return etiqueta.toUpperCase() === 'INPUT' && !INPUTS_SEM_TEXTO.has((tipo || 'text').toLowerCase());
}

/** A dica de um botão ou campo com o atalho dele, como "Nova pessoa (N)". */
export const dicaComAtalho = (texto: string, atalho: Atalho) => `${texto} (${ATALHOS[atalho].nome})`;

/** Uma linha da lista de atalhos: as teclas, na ordem em que se apertam, e o que fazem. */
export interface LinhaDeAtalho { teclas: string[]; oQueFaz: string }
/** Um grupo da lista de atalhos. */
export interface GrupoDeAtalhos { titulo: string; linhas: LinhaDeAtalho[] }

/** A tecla que acompanha as letras nos atalhos de sempre: Cmd (⌘) no Mac, Ctrl nos outros. */
const teclaDeComando = (mac: boolean) => mac ? '⌘' : 'Ctrl';

/**
 * A lista que o "?" mostra: primeiro os atalhos desta página (só os que ela tem: sem busca, sem "/"; sem "Novo", sem "N"),
 * depois os que valem em todo o SEMPER.
 */
export function listaDeAtalhos({ temBusca, novo, mac }: { temBusca: boolean; novo: string | null; mac: boolean }): GrupoDeAtalhos[] {
  const daPagina: LinhaDeAtalho[] = [
    ...(temBusca ? [{ teclas: [ATALHOS.buscar.nome], oQueFaz: 'Ir para a busca desta página' }] : []),
    ...(novo ? [{ teclas: [ATALHOS.novo.nome], oQueFaz: novo }] : []),
    { teclas: [ATALHOS.atalhos.nome], oQueFaz: 'Mostrar esta lista de atalhos' }
  ];
  const comando = teclaDeComando(mac);
  return [
    { titulo: 'Nesta página', linhas: daPagina },
    { titulo: 'Em todo o SEMPER', linhas: [
      { teclas: [comando, 'K'], oQueFaz: 'Buscar em todo o SEMPER' },
      { teclas: [comando, 'Z'], oQueFaz: 'Desfazer a última ação (arquivar, mover um cartão…)' },
      { teclas: ['Esc'], oQueFaz: 'Fechar a janela ou o cartão aberto' }
    ] }
  ];
}
