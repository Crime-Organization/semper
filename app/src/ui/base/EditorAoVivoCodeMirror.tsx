// O miolo do editor ao vivo (veja EditorAoVivo.tsx): o CodeMirror com as marcações de regras/aoVivo.ts. Este arquivo só é baixado
// quando um editor aparece na tela. A regra diz o que esconder e o que destacar em cada linha conforme o cursor; aqui isso vira
// as decorações do CodeMirror (uma tabela, DECORACAO, por tipo de marcação). A barra e os atalhos Ctrl+B e Ctrl+I são os mesmos da
// CaixaFormatada (barraDeFormatacao), com as mesmas regras, e cada mudança entra no histórico do editor (Ctrl+Z desfaz).
import { Annotation, EditorState, Prec, StateEffect, Transaction, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder as dica, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { history, historyKeymap, standardKeymap } from '@codemirror/commands';
import { useEffect, useRef } from 'react';
import {
  acompanharValor, caberNoLimite, continuarLista, diferenca, linhasAoVivo, linhasDoCursor, marcacoesAoVivo, quebrasComuns,
  type LinhaAoVivo, type MarcacaoDo, type TipoDaMarcacao, type Troca
} from '../../regras/aoVivo';
import type { Escolha, Marca } from '../../regras/formatacao';
import { ESPERA_DO_CLIQUE_DUPLO } from '../tempos';
import type { PropsDoMiolo } from './EditorAoVivo';
import { ATALHOS, barraDeFormatacao, DE_EMAIL, ITEM_SEM_TEXTO } from './TextoFormatado';

/** O prefixo das classes dos trechos e dos desenhos (as cores e os tamanhos ficam em estilo.css). */
const CLASSE = 'ao-vivo-';
/** O prefixo das classes de cada tipo de linha. */
const CLASSE_DA_LINHA = 'ao-vivo-linha-';
/** A mudança que veio de fora (o texto gravado trocou): não volta a quem usa nem entra no Ctrl+Z. */
const deFora = Annotation.define<boolean>();

/** A bolinha que toma o lugar do "- " da lista, fora da linha do cursor. */
class Bolinha extends WidgetType {
  eq() { return true; }
  toDOM() {
    const s = document.createElement('span');
    s.className = CLASSE + 'marcador';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
}

/** A linha que toma o lugar do "---", fora da linha do cursor. */
class Divisoria extends WidgetType {
  eq() { return true; }
  toDOM() {
    const s = document.createElement('span');
    s.className = CLASSE + 'divisoria-linha';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
}

/** O "detail" do clique que não veio do mouse (o Espaço com a caixinha em foco, ou o leitor de tela): o mouse conta os cliques, de 1 em diante. */
const CLIQUE_SEM_MOUSE = 0;

/**
 * A caixinha da lista de tarefas, que se marca com um clique: troca só o " " ou o "x" entre os colchetes (como no texto formatado).
 * Pelo teclado (o Espaço com ela em foco) ou pelo leitor de tela, que só mandam o "click", ela se marca do mesmo jeito.
 */
class Caixinha extends WidgetType {
  constructor(readonly marcada: boolean, readonly troca: Troca, readonly nome: string) { super(); }
  eq(outra: Caixinha) { return outra.marcada === this.marcada && outra.troca.inicio === this.troca.inicio && outra.nome === this.nome; }
  toDOM(view: EditorView) {
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.checked = this.marcada;
    c.className = CLASSE + 'caixinha';
    c.setAttribute('aria-label', this.nome || ITEM_SEM_TEXTO);
    const marcar = () => view.dispatch({ changes: { from: this.troca.inicio, to: this.troca.fim, insert: this.troca.texto }, userEvent: 'input.caixinha' });
    // O clique do mouse marca já ao apertar o botão, sem levar o cursor para a linha (que mostraria os sinais); o Ctrl+Z desmarca.
    c.addEventListener('mousedown', e => { e.preventDefault(); marcar(); });
    // Quem muda a caixinha é o texto, desenhado de novo; o "click" só marca quando não veio do mouse (que já marcou no mousedown).
    c.addEventListener('click', e => {
      e.preventDefault();
      if (e.detail === CLIQUE_SEM_MOUSE) marcar();
    });
    return c;
  }
  ignoreEvent() { return true; }
}

/** As classes de um trecho destacado (negrito, itálico, tachado, código, link). */
const classesDoDestaque = (marcas: Marca[], link?: string) => [...marcas, ...(link ? ['link'] : [])].map(m => CLASSE + m).join(' ');

/** A decoração de cada tipo de marcação da regra. */
const DECORACAO: { [T in TipoDaMarcacao]: (m: MarcacaoDo<T>) => Range<Decoration> } = {
  linha: m => Decoration.line({ class: m.classe.split(' ').map(c => CLASSE_DA_LINHA + c).join(' ') }).range(m.inicio),
  simbolo: m => Decoration.mark({ class: CLASSE + 'simbolo' }).range(m.inicio, m.fim),
  esconder: m => Decoration.replace({}).range(m.inicio, m.fim),
  destaque: m => Decoration.mark({
    class: classesDoDestaque(m.marcas, m.link),
    attributes: m.link ? { 'data-endereco': m.link, title: 'Ctrl+clique para abrir o link' } : undefined
  }).range(m.inicio, m.fim),
  marcador: m => Decoration.replace({ widget: new Bolinha() }).range(m.inicio, m.fim),
  // O nome da caixinha é o texto do item como a pessoa o lê, sem os sinais (o mesmo do texto formatado).
  caixinha: m => Decoration.replace({ widget: new Caixinha(m.marcada, m.troca, m.nome) }).range(m.inicio, m.fim),
  divisoria: m => Decoration.replace({ widget: new Divisoria() }).range(m.inicio, m.fim)
};

/** As linhas em que estão o cursor e os trechos escolhidos. Sem o foco no editor, nenhuma. */
function linhasComCursor(view: EditorView, linhas: LinhaAoVivo[]): Set<number> {
  const escolhas = view.state.selection.ranges.map(r => ({ inicio: r.from, fim: r.to }));
  return view.hasFocus ? linhasDoCursor(linhas, escolhas) : new Set<number>();
}

/** As decorações da parte do texto que está na tela: as linhas "comCursor" mostram os sinais. */
function desenhar(view: EditorView, linhas: LinhaAoVivo[], comCursor: Set<number>): DecorationSet {
  const marcacoes = marcacoesAoVivo(linhas, comCursor, { inicio: view.viewport.from, fim: view.viewport.to });
  return Decoration.set(marcacoes.map(m => (DECORACAO[m.tipo] as (m: typeof marcacoes[number]) => Range<Decoration>)(m)), true);
}

/** O gesto do mouse acabou: os sinais da linha do cursor podem aparecer. */
const gestoAcabou = StateEffect.define<null>();
/** O botão principal do mouse (o esquerdo). */
const BOTAO_PRINCIPAL = 0;

/**
 * As linhas lidas (refeitas só quando o texto muda) e as decorações (refeitas também quando o cursor anda).
 *
 * Mostrar os sinais de uma linha empurra o texto dela ("**", a bolinha que vira "- ", o endereço do link). Se isso acontecesse
 * no primeiro clique, o segundo clique de um clique duplo, ou o resto de um arrasto, cairia noutro lugar do texto, e a palavra
 * escolhida (e o negrito) seria a vizinha, ou os próprios "**". Por isso, durante um gesto do mouse (do botão apertado até
 * ESPERA_DO_CLIQUE_DUPLO depois de soltá-lo), as linhas com os sinais à mostra ficam as de antes; a escolha é feita sobre o
 * texto que a pessoa vê, e só depois os sinais aparecem. Digitar, uma tecla ou um botão da barra acabam o gesto na hora.
 */
const aoVivo = ViewPlugin.fromClass(class {
  linhas: LinhaAoVivo[];
  decorations: DecorationSet;
  /** As linhas que mostram os sinais agora. */
  comCursor = new Set<number>();
  noGesto = false;
  espera: ReturnType<typeof setTimeout> | undefined;
  soltou: (() => void) | undefined;
  constructor(readonly view: EditorView) {
    this.linhas = linhasAoVivo(view.state.doc.toString());
    this.decorations = this.redesenhar();
  }
  update(u: ViewUpdate) {
    if (u.docChanged) {
      this.linhas = linhasAoVivo(u.state.doc.toString());
      this.noGesto = false;
    }
    const acabou = u.transactions.some(t => t.effects.some(e => e.is(gestoAcabou)));
    if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged || acabou) this.decorations = this.redesenhar();
  }
  redesenhar() {
    if (!this.noGesto) this.comCursor = linhasComCursor(this.view, this.linhas);
    return desenhar(this.view, this.linhas, this.comCursor);
  }
  /** O botão do mouse desceu: começa (ou continua, no segundo clique) o gesto; ele acaba um pouco depois de o botão subir. */
  comecarGesto() {
    clearTimeout(this.espera);
    this.noGesto = true;
    if (this.soltou) return;
    const janela = this.view.dom.ownerDocument.defaultView;
    const soltou = () => {
      janela?.removeEventListener('mouseup', soltou);
      this.soltou = undefined;
      this.espera = setTimeout(() => this.acabarGesto(), ESPERA_DO_CLIQUE_DUPLO);
    };
    this.soltou = soltou;
    janela?.addEventListener('mouseup', soltou);
  }
  acabarGesto() {
    clearTimeout(this.espera);
    if (!this.noGesto) return;
    this.noGesto = false;
    this.view.dispatch({ effects: gestoAcabou.of(null) });
  }
  destroy() {
    clearTimeout(this.espera);
    if (this.soltou) this.view.dom.ownerDocument.defaultView?.removeEventListener('mouseup', this.soltou);
  }
}, {
  decorations: v => v.decorations,
  // Observadores: veem o evento mesmo quando outro (o atalho, a seta) o trata.
  eventObservers: {
    mousedown(e) { if (e.button === BOTAO_PRINCIPAL) this.comecarGesto(); },
    keydown() { if (!this.soltou) this.acabarGesto(); }
  }
});

/** Troca o texto do editor pelo resultado de uma regra (só o trecho que mudou), com o trecho escolhido que ela diz. */
function aplicar(view: EditorView, r: Escolha) {
  const d = diferenca(view.state.doc.toString(), r.texto);
  view.dispatch({ changes: { from: d.inicio, to: d.fim, insert: d.texto }, selection: { anchor: r.inicio, head: r.fim }, scrollIntoView: true, userEvent: 'input' });
}

/** O Enter que continua a lista (regras/aoVivo.ts). Fora dela, o Enter de sempre. */
function enterNaLista(view: EditorView): boolean {
  const linhas = view.plugin(aoVivo)?.linhas, s = view.state.selection.main;
  const linha = linhas?.[view.state.doc.lineAt(s.head).number - 1];
  const r = linha && continuarLista(linha, { texto: view.state.doc.toString(), inicio: s.from, fim: s.to });
  if (!r) return false;
  aplicar(view, r);
  return true;
}

/** Abre o link: o de e-mail no programa de e-mail; os outros em aba nova, sem dar à página aberta acesso a esta. */
function abrirLink(endereco: string) {
  if (endereco.startsWith(DE_EMAIL)) window.location.assign(endereco);
  else window.open(endereco, '_blank', 'noopener,noreferrer');
}

/** Ctrl+clique (ou Cmd+clique) num link abre o link; o clique simples põe o cursor nele, para editar. */
const cliqueNoLink = EditorView.domEventHandlers({
  mousedown: e => {
    const link = (e.ctrlKey || e.metaKey) && e.target instanceof Element ? e.target.closest('[data-endereco]') : null;
    const endereco = link?.getAttribute('data-endereco');
    if (!endereco) return false;
    e.preventDefault();
    abrirLink(endereco);
    return true;
  }
});

/**
 * O que passaria do tamanho máximo fica de fora, como na caixa de texto do navegador: um trecho colado comprido entra até o
 * limite (regras/aoVivo.ts, caberNoLimite); o que diminui o texto sempre entra. Uma mudança em vários lugares de uma vez que
 * não cabe não entra.
 */
const limite = (maximo: number) => EditorState.transactionFilter.of(tr => {
  if (!tr.docChanged || tr.annotation(deFora) || tr.newDoc.length <= maximo || tr.newDoc.length <= tr.startState.doc.length) return tr;
  const trocas: Troca[] = [];
  tr.changes.iterChanges((de, ate, _a, _b, texto) => trocas.push({ inicio: de, fim: ate, texto: texto.toString() }));
  const cabe = trocas.length === 1 ? caberNoLimite(trocas[0], tr.startState.doc.length, maximo) : null;
  if (!cabe) return [];
  const cursor = cabe.inicio + cabe.texto.length;
  return {
    changes: { from: cabe.inicio, to: cabe.fim, insert: cabe.texto }, selection: { anchor: cursor },
    scrollIntoView: tr.scrollIntoView, userEvent: tr.annotation(Transaction.userEvent)
  };
});

export default function EditorAoVivoCodeMirror({ id, rotulo, valor, aoMudar, maximo, placeholder, className, focarAoChegar }: PropsDoMiolo) {
  const lugar = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  /** Os textos que o editor mandou a quem o usa e que ainda não voltaram em "valor" (veja acompanharValor). */
  const enviados = useRef<string[]>([]);
  const { barra, marcar } = barraDeFormatacao({
    id, maximo,
    escolha: () => {
      const v = vista.current, s = v?.state.selection.main;
      return v && s ? { texto: v.state.doc.toString(), inicio: s.from, fim: s.to } : null;
    },
    trocar: r => { const v = vista.current; if (v) { v.focus(); aplicar(v, r); } },
    focar: () => vista.current?.focus()
  });
  /** O que muda a cada desenho, para o editor (criado uma vez) chamar sempre o de agora. */
  const agora = useRef({ aoMudar, marcar, valor });
  agora.current = { aoMudar, marcar, valor };

  useEffect(() => {
    if (!lugar.current) return;
    const extensoes: Extension[] = [
      history(),
      Prec.highest(keymap.of([
        // Os mesmos atalhos da caixa de texto comum (a tabela ATALHOS do TextoFormatado): Ctrl+B, Ctrl+I…
        ...Object.entries(ATALHOS).map(([tecla, marca]) => ({ key: 'Mod-' + tecla, run: () => (agora.current.marcar(marca), true) })),
        { key: 'Enter', run: enterNaLista }
      ])),
      keymap.of([...standardKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': rotulo, 'aria-multiline': 'true', spellcheck: 'true', ...(id ? { id } : {}) }),
      aoVivo,
      cliqueNoLink,
      EditorView.updateListener.of(u => {
        if (!u.docChanged || u.transactions.some(t => t.annotation(deFora))) return;
        const texto = u.state.doc.toString();
        enviados.current.push(texto);
        agora.current.aoMudar(texto);
      }),
      ...(placeholder ? [dica(placeholder)] : []),
      ...(maximo ? [limite(maximo)] : [])
    ];
    // O editor guarda as quebras de linha como "\n": um texto gravado com "\r\n" abre igual, sem linha a mais (quebrasComuns).
    const doc = quebrasComuns(agora.current.valor);
    const view = new EditorView({ parent: lugar.current, state: EditorState.create({ doc, extensions: extensoes }) });
    vista.current = view;
    enviados.current = [];
    // A pessoa pediu o texto (Enter no título) enquanto o editor ainda chegava: o cursor vai para ele, se ela não foi para outro lugar.
    if (focarAoChegar?.current && (!document.activeElement || document.activeElement === document.body)) view.focus();
    if (focarAoChegar) focarAoChegar.current = false;
    return () => { view.destroy(); vista.current = null; };
  }, [id, rotulo, placeholder, maximo, focarAoChegar]);

  // O texto mudou fora daqui (lido de novo, o texto de outra pessoa escolhido no conflito, um Desfazer): o editor acompanha. A volta,
  // atrasada, do que o próprio editor mandou não entra (desfaria a letra que a pessoa acabou de digitar).
  useEffect(() => {
    const v = vista.current;
    if (!v) return;
    const { troca, enviados: restantes } = acompanharValor(v.state.doc.toString(), valor, enviados.current);
    enviados.current = restantes;
    if (troca) v.dispatch({
      changes: { from: troca.inicio, to: troca.fim, insert: troca.texto }, annotations: [deFora.of(true), Transaction.addToHistory.of(false)]
    });
  }, [valor]);

  return <div className={['caixa-formatada', 'editor-ao-vivo', className].filter(Boolean).join(' ')}>
    {barra}
    <div ref={lugar} className="editor-ao-vivo-lugar" />
  </div>;
}
