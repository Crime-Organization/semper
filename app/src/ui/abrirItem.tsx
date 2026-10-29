// Abrir um item da lista (linha da tabela, cartão do quadro) como se abre um link num site comum: o clique abre o
// cartão aqui mesmo; Ctrl+clique (Cmd+clique no Mac) e o clique da rodinha abrem o endereço do cartão numa aba nova.
// Peça comum: toda lista de módulo (Pessoas, Contratos, Início...) abre os seus itens por aqui.
import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

/** Botão da rodinha do mouse, em MouseEvent.button. */
const BOTAO_DO_MEIO = 1;
/** O que, dentro do item, tem clique próprio: a caixa de seleção, um botão, um link para outro lugar. */
const CONTROLES = 'a[href], button, input, select, textarea, label';

/** O clique pede uma aba nova? Como num link: Ctrl apertado (Windows, Linux) ou Cmd (Mac). */
export const pedeNovaAba = (e: Pick<MouseEvent, 'ctrlKey' | 'metaKey'>) => e.ctrlKey || e.metaKey;

/**
 * Abre o endereço numa aba nova. Sem "noopener" de propósito: assim o navegador leva para a aba nova uma cópia da
 * sessão desta aba (sessionStorage), onde o banco fictício do modo de teste guarda os dados.
 */
function abrirEmNovaAba(para: string) {
  window.open(para, '_blank');
}

/** O clique foi num controle de dentro do item (que não seja o link do próprio item)? Esse controle cuida dele. */
function noControle(e: MouseEvent<HTMLElement>, para: string) {
  const el = (e.target as Element).closest(CONTROLES);
  return !!el && e.currentTarget.contains(el) && el.getAttribute('href') !== para;
}

/** Cliques de um elemento que abre um item, para espalhar nele: <article {...cliquesQueAbrem(para, aoAbrir)}>. */
export function cliquesQueAbrem(para: string, aoAbrir: () => void) {
  return {
    onClick(e: MouseEvent<HTMLElement>) {
      if (noControle(e, para)) return;
      e.preventDefault();   // o link com o nome do item não navega sozinho: abre por aqui, como o resto da linha
      if (pedeNovaAba(e)) abrirEmNovaAba(para);
      else aoAbrir();
    },
    onAuxClick(e: MouseEvent<HTMLElement>) {
      if (e.button !== BOTAO_DO_MEIO || noControle(e, para)) return;
      e.preventDefault();
      abrirEmNovaAba(para);
    },
    // Sem isto, no Windows o clique da rodinha liga a rolagem automática da página em vez de abrir o item.
    onMouseDown(e: MouseEvent<HTMLElement>) {
      if (e.button === BOTAO_DO_MEIO && !noControle(e, para)) e.preventDefault();
    }
  };
}

const EnderecoDaLinha = createContext('');

interface PropsLinha {
  /** Endereço que abre o item (ex.: /pessoas/?id=...): é o que vai para a aba nova. */
  para: string;
  /** O que o clique comum faz (ex.: abrir o cartão ao lado). Sem ele, o clique vai ao endereço. */
  aoAbrir?: () => void;
  /** Linha selecionada pela caixa de seleção. */
  marcada?: boolean;
  children: ReactNode;
}

/** Linha de tabela que abre um item. Ponha o nome do item em <NomeDaLinha>. */
export function LinhaQueAbre({ para, aoAbrir, marcada, children }: PropsLinha) {
  const navegar = useNavigate();
  return <EnderecoDaLinha.Provider value={para}>
    <tr className={'clicavel' + (marcada ? ' marcada' : '')} {...cliquesQueAbrem(para, aoAbrir ?? (() => navegar(para)))}>{children}</tr>
  </EnderecoDaLinha.Provider>;
}

/** Nome do item na linha, como link de verdade: o botão direito oferece "Abrir link em nova aba" e o Tab chega nele. */
export function NomeDaLinha({ children }: { children: ReactNode }) {
  return <a className="nome" href={useContext(EnderecoDaLinha)}>{children}</a>;
}
