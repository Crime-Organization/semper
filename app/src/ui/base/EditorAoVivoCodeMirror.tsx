// O miolo do editor ao vivo (veja EditorAoVivo.tsx): o CodeMirror com as marcações de regras/aoVivo.ts. Este arquivo só é baixado
// quando um editor aparece na tela. A regra diz o que esconder e o que destacar em cada linha; aqui isso vira as decorações do
// CodeMirror (uma tabela, DECORACAO, por tipo de marcação). Desde a #368, a formatação fica desenhada sempre, também na linha do
// cursor: os sinais escondidos são "atômicos" (o cursor pula por cima deles), e as setas, o Backspace, o Delete, o Enter e o que
// se digita seguem as regras de aoVivo.ts, para nada desmanchar a formatação que a pessoa vê. A barra e os atalhos Ctrl+B e
// Ctrl+I são os mesmos da CaixaFormatada (barraDeFormatacao), com as mesmas regras; com o cursor parado, o B e o I ligam ou
// desligam a marca para o que se digitar (marcarNoCursor), sem "****" à mostra. Cada mudança entra no histórico do editor
// (Ctrl+Z desfaz).
import { Annotation, EditorSelection, EditorState, Prec, StateEffect, StateField, Transaction, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder as dica, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { history, historyKeymap, standardKeymap } from '@codemirror/commands';
import { useEffect, useRef } from 'react';
import {
  acompanharValor, apagar, caberNoLimite, continuarLista, diferenca, escreverComMarca, escreverNoEscolhido, formatacaoTirada, linhaDaPosicao,
  linhasAoVivo, marcacoesAoVivo, marcarNoCursor, ondeEscrever, posicaoDoCursor, quebrasComuns, soEscondido, tomaOLugar,
  type LinhaAoVivo, type Marcacao, type MarcacaoDo, type MarcaPendente, type TipoDaMarcacao, type Troca
} from '../../regras/aoVivo';
import { comecoDaLinha, type Escolha, type Marca, type MarcaDoBotao } from '../../regras/formatacao';
import type { PropsDoMiolo } from './EditorAoVivo';
import { ATALHOS, barraDeFormatacao, DE_EMAIL, ITEM_SEM_TEXTO } from './TextoFormatado';

/** O prefixo das classes dos trechos e dos desenhos (as cores e os tamanhos ficam em estilo.css). */
const CLASSE = 'ao-vivo-';
/** O prefixo das classes de cada tipo de linha. */
const CLASSE_DA_LINHA = 'ao-vivo-linha-';
/** A mudança que veio de fora (o texto gravado trocou): não volta a quem usa nem entra no Ctrl+Z. */
const deFora = Annotation.define<boolean>();

/** O que o leitor de tela diz no lugar da bolinha (o "- " escondido), já que ela só se vê. */
const LEITURA_DA_BOLINHA = 'Item da lista';

/** Um desenho sem texto que o leitor de tela lê pelo nome (o texto da tela fica como está, sem letras a mais). */
function comNome(s: HTMLElement, nome: string) {
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', nome);
  return s;
}

/** A bolinha que toma o lugar do "- " da lista. */
class Bolinha extends WidgetType {
  eq() { return true; }
  toDOM() {
    const s = document.createElement('span');
    s.className = CLASSE + 'marcador';
    return comNome(s, LEITURA_DA_BOLINHA);
  }
}

/** O começo escondido do título ou da citação: não se vê, mas o leitor de tela diz o que a linha é ("Título 2", "Citação"). */
class Leitura extends WidgetType {
  constructor(readonly nome: string) { super(); }
  eq(outra: Leitura) { return outra.nome === this.nome; }
  toDOM() { return comNome(document.createElement('span'), this.nome); }
}

/** A linha que toma o lugar do "---" (o leitor de tela a diz como uma divisória). */
class Divisoria extends WidgetType {
  eq() { return true; }
  toDOM() {
    const s = document.createElement('span');
    s.className = CLASSE + 'divisoria-linha';
    s.setAttribute('role', 'separator');
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
    // O clique do mouse marca já ao apertar o botão, sem levar o cursor para a caixinha (ele fica onde a pessoa escrevia); o Ctrl+Z desmarca.
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
  esconder: m => Decoration.replace(m.leitura ? { widget: new Leitura(m.leitura) } : {}).range(m.inicio, m.fim),
  destaque: m => Decoration.mark({
    class: classesDoDestaque(m.marcas, m.link),
    attributes: m.link ? { 'data-endereco': m.link, title: 'Ctrl+clique para abrir o link' } : undefined
  }).range(m.inicio, m.fim),
  marcador: m => Decoration.replace({ widget: new Bolinha() }).range(m.inicio, m.fim),
  // O nome da caixinha é o texto do item como a pessoa o lê, sem os sinais (o mesmo do texto formatado).
  caixinha: m => Decoration.replace({ widget: new Caixinha(m.marcada, m.troca, m.nome) }).range(m.inicio, m.fim),
  divisoria: m => Decoration.replace({ widget: new Divisoria() }).range(m.inicio, m.fim)
};
const decoracao = (m: Marcacao) => (DECORACAO[m.tipo] as (m: Marcacao) => Range<Decoration>)(m);

/** As linhas lidas do texto (regras/aoVivo.ts), refeitas só quando ele muda: o desenho, as teclas e a escrita leem daqui. */
const linhasDoTexto = StateField.define<LinhaAoVivo[]>({
  create: s => linhasAoVivo(s.doc.toString()),
  update: (linhas, tr) => tr.docChanged ? linhasAoVivo(tr.newDoc.toString()) : linhas
});

/** O desenho da parte do texto que está na tela, e o que dele toma o lugar do texto (o cursor pula isso inteiro). */
function desenhar(view: EditorView): { decorations: DecorationSet; inteiras: DecorationSet } {
  const marcacoes = marcacoesAoVivo(view.state.field(linhasDoTexto), { inicio: view.viewport.from, fim: view.viewport.to });
  return { decorations: Decoration.set(marcacoes.map(decoracao), true), inteiras: Decoration.set(marcacoes.filter(tomaOLugar).map(decoracao), true) };
}

/**
 * As decorações, refeitas quando o texto muda ou a tela rola (o cursor não muda nada: a formatação é a mesma em todo lugar). Os
 * sinais escondidos, a bolinha, a caixinha e a divisória são atômicos: as setas e a escolha com o mouse nunca param dentro deles.
 */
const aoVivo = ViewPlugin.fromClass(class {
  desenho: ReturnType<typeof desenhar>;
  constructor(view: EditorView) { this.desenho = desenhar(view); }
  update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.desenho = desenhar(u.view); }
}, {
  decorations: v => v.desenho.decorations,
  provide: p => EditorView.atomicRanges.of(view => view.plugin(p)?.desenho.inteiras ?? Decoration.none)
});

/**
 * O cursor nunca para antes do começo escondido de uma linha (o "## " do título, a bolinha do item): vai para o começo do texto
 * dela (regras/aoVivo.ts, posicaoDoCursor). Assim, o que a pessoa digita ali entra no item, e não antes do "- ".
 */
const cursorNoTexto = EditorState.transactionFilter.of(tr => {
  if (!tr.selection) return tr;
  const doc = tr.newDoc;
  const noComeco = tr.selection.ranges.some(r => r.empty && doc.lineAt(r.head).from === r.head && comecoDaLinha(doc.lineAt(r.head).text) !== '');
  if (!noComeco) return tr;
  const linhas = tr.state.field(linhasDoTexto);
  const escolha = EditorSelection.create(tr.selection.ranges.map(r => r.empty ? EditorSelection.cursor(posicaoDoCursor(linhas, r.head)) : r), tr.selection.mainIndex);
  return escolha.eq(tr.selection) ? tr : [tr, { selection: escolha, sequential: true }];
});

/** Liga, desliga ou esquece a marca pendente (regras/aoVivo.ts, marcarNoCursor). */
const porPendente = StateEffect.define<MarcaPendente | null>();
/**
 * A marca que o botão B ou I (ou o Ctrl+B, Ctrl+I) ligou ou desligou com o cursor parado: vale para o que a pessoa digitar ali.
 * Some quando o cursor vai para outro lugar ou o texto muda de outro jeito.
 */
const marcaPendente = StateField.define<MarcaPendente | null>({
  create: () => null,
  update: (pendente, tr) => {
    const dada = tr.effects.find(e => e.is(porPendente));
    if (dada) return dada.value as MarcaPendente | null;
    if (!pendente || tr.docChanged) return null;
    const cursor = tr.newSelection.main;   // o foco que volta ao editor pode repor o cursor no mesmo lugar: aí a marca fica
    return tr.selection && (!cursor.empty || cursor.head !== pendente.posicao) ? null : pendente;
  }
});

/** Os eventos de quem digita ou cola (a escrita com o teclado do celular, que vai compondo a palavra, fica como está). */
const ESCRITA = new Set(['input.type', 'input.paste']);

/** A troca (o texto e o cursor dados por uma regra) que entra no lugar do que a pessoa digitou, com o mesmo evento. */
function trocaDaEscrita(antes: string, r: Escolha, evento: string, efeitos: StateEffect<unknown>[] = []) {
  const d = diferenca(antes, r.texto);
  return { changes: { from: d.inicio, to: d.fim, insert: d.texto }, selection: { anchor: r.inicio }, effects: efeitos, scrollIntoView: true, userEvent: evento };
}

/**
 * O que a pessoa digita ou cola entra do lado que mantém a formatação (regras/aoVivo.ts): colado a um sinal escondido, o "s"
 * logo depois de um negrito entra nele, e não depois dos "**", que apareceriam (ondeEscrever); com a marca pendente do B, entra
 * com ela, ou sem ela (escreverComMarca); por cima de um trecho escolhido, o item fica com a bolinha (escreverNoEscolhido).
 */
const escreverNoLugar = EditorState.transactionFilter.of(tr => {
  const evento = tr.annotation(Transaction.userEvent);
  if (!tr.docChanged || !evento || !ESCRITA.has(evento)) return tr;
  const trocas: Troca[] = [];
  tr.changes.iterChanges((de, ate, _a, _b, texto) => trocas.push({ inicio: de, fim: ate, texto: texto.toString() }));
  if (trocas.length !== 1) return tr;
  const { inicio, fim, texto } = trocas[0], linhas = tr.startState.field(linhasDoTexto), antes = tr.startState.doc.toString();
  if (fim > inicio) {
    const r = escreverNoEscolhido(linhas, { texto: antes, inicio, fim }, texto);
    return r ? trocaDaEscrita(antes, r, evento) : tr;
  }
  // A marca pendente vale no lugar em que foi ligada (o mesmo da tela: um sinal escondido no meio não conta).
  const pendente = tr.startState.field(marcaPendente);
  if (pendente && (pendente.posicao === inicio || soEscondido(linhas, Math.min(inicio, pendente.posicao), Math.max(inicio, pendente.posicao)))) {
    const r = escreverComMarca(linhas, antes, pendente, texto);
    return trocaDaEscrita(antes, r.escolha, evento, [porPendente.of(r.pendente)]);
  }
  const onde = ondeEscrever(linhas, antes, inicio, texto);
  if (onde === inicio) return tr;
  return { changes: { from: onde, insert: texto }, selection: { anchor: onde + texto.length }, scrollIntoView: true, userEvent: evento };
});

/** Troca o texto do editor pelo resultado de uma regra (só o trecho que mudou), com o trecho escolhido que ela diz. */
function aplicar(view: EditorView, r: Escolha, evento = 'input') {
  const d = diferenca(view.state.doc.toString(), r.texto);
  view.dispatch({ changes: { from: d.inicio, to: d.fim, insert: d.texto }, selection: { anchor: r.inicio, head: r.fim }, scrollIntoView: true, userEvent: evento });
}

/** A escolha do editor como a regra a lê, ou null com mais de um cursor (aí vale o comando de sempre). */
function escolhaDe(view: EditorView): Escolha | null {
  const s = view.state.selection;
  return s.ranges.length > 1 ? null : { texto: view.state.doc.toString(), inicio: s.main.from, fim: s.main.to };
}

/** O tipo da linha em que está o cursor. */
const tipoNoCursor = (view: EditorView) => {
  const linhas = view.state.field(linhasDoTexto);
  return linhas[linhaDaPosicao(linhas, view.state.selection.main.head)].tipo;
};

/**
 * Aplica o resultado de uma tecla (o Backspace, o Delete, o Enter) e, se a linha do cursor perdeu a formatação (a bolinha, o
 * título), avisa o leitor de tela (regras/aoVivo.ts, formatacaoTirada): quem não vê a bolinha sumir fica sabendo.
 */
function aplicarAvisando(view: EditorView, r: Escolha, evento?: string) {
  const antes = tipoNoCursor(view);
  aplicar(view, r, evento);
  const aviso = formatacaoTirada(antes, tipoNoCursor(view));
  if (aviso) view.dispatch({ effects: EditorView.announce.of(aviso) });
}

/** O Enter que continua a lista e o do começo do título (regras/aoVivo.ts). Nos outros lugares, o Enter de sempre. */
function enterNaLista(view: EditorView): boolean {
  const e = escolhaDe(view);
  if (!e) return false;
  const linhas = view.state.field(linhasDoTexto), r = continuarLista(linhas[linhaDaPosicao(linhas, view.state.selection.main.head)], e);
  if (!r) return false;
  aplicarAvisando(view, r);
  return true;
}

/**
 * O Backspace ("paraTras") e o Delete que apagam o que a pessoa vê, sem desmanchar a formatação (regras/aoVivo.ts, apagar): no
 * começo de um item, de um título ou de uma citação, o Backspace tira a formatação da linha. Fora disso, os de sempre.
 */
const apagarAoVivo = (paraTras: boolean, evento: string) => (view: EditorView): boolean => {
  const e = escolhaDe(view), r = e && apagar(view.state.field(linhasDoTexto), e, paraTras);
  if (!e || !r) return false;
  aplicarAvisando(view, r, e.inicio < e.fim ? 'delete.selection' : evento);
  return true;
};

/**
 * O B ou o I com o cursor parado (regras/aoVivo.ts, marcarNoCursor): troca o texto já (a palavra ganha a marca, o trecho a perde)
 * ou guarda a marca para o que a pessoa digitar ali, sem pôr "****" no texto. Diz se fez.
 */
function marcarComOCursor(view: EditorView, marca: MarcaDoBotao, maximo?: number): boolean {
  const s = view.state.selection;
  if (s.ranges.length > 1) return false;
  view.focus();
  const r = marcarNoCursor(view.state.field(linhasDoTexto), view.state.doc.toString(), s.main.head, marca);
  if ('troca' in r) {
    if (maximo && r.troca.texto.length > maximo) return false;   // a marca não cabe: nada muda, como na barra
    aplicar(view, r.troca);
    return true;
  }
  view.dispatch({ selection: { anchor: r.pendente.posicao }, effects: porPendente.of(r.pendente), userEvent: 'select' });
  return true;
}

/**
 * As setas para os lados andam letra a letra como a pessoa vê: um sinal escondido (ou o começo escondido da linha) não é uma
 * parada que não se vê; a seta segue até a próxima letra (regras/aoVivo.ts, soEscondido). Com um trecho escolhido, as de sempre.
 */
const andar = (paraFrente: boolean) => (view: EditorView): boolean => {
  const s = view.state.selection;
  if (s.ranges.length > 1 || !s.main.empty) return false;
  const linhas = view.state.field(linhasDoTexto);
  let atual = s.main, proximo = view.moveByChar(atual, paraFrente);
  while (proximo.head !== atual.head && soEscondido(linhas, Math.min(atual.head, proximo.head), Math.max(atual.head, proximo.head))) {
    atual = proximo;
    proximo = view.moveByChar(atual, paraFrente);
  }
  if (proximo.head === s.main.head) return false;
  view.dispatch({ selection: EditorSelection.create([proximo]), scrollIntoView: true, userEvent: 'select' });
  return true;
};

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
    focar: () => vista.current?.focus(),
    marcarNoCursor: marca => !!vista.current && marcarComOCursor(vista.current, marca, maximo)
  });
  /** O que muda a cada desenho, para o editor (criado uma vez) chamar sempre o de agora. */
  const agora = useRef({ aoMudar, marcar, valor });
  agora.current = { aoMudar, marcar, valor };

  useEffect(() => {
    if (!lugar.current) return;
    const extensoes: Extension[] = [
      history(),
      linhasDoTexto,
      marcaPendente,
      Prec.highest(keymap.of([
        // Os mesmos atalhos da caixa de texto comum (a tabela ATALHOS do TextoFormatado): Ctrl+B, Ctrl+I…
        ...Object.entries(ATALHOS).map(([tecla, marca]) => ({ key: 'Mod-' + tecla, run: () => (agora.current.marcar(marca), true) })),
        { key: 'Enter', run: enterNaLista },
        { key: 'Backspace', run: apagarAoVivo(true, 'delete.backward') },
        { key: 'Delete', run: apagarAoVivo(false, 'delete.forward') },
        { key: 'ArrowLeft', run: andar(false) },
        { key: 'ArrowRight', run: andar(true) }
      ])),
      keymap.of([...standardKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': rotulo, 'aria-multiline': 'true', spellcheck: 'true', ...(id ? { id } : {}) }),
      aoVivo,
      cursorNoTexto,
      escreverNoLugar,
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
