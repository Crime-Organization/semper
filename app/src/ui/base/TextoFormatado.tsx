// Texto com negrito, itálico, listas (#293), títulos e links (#303) e, desde a #344, o Markdown comum: listas de tarefas
// (caixinhas), listas numeradas, citações, tachado, código, linha divisória e tabelas. Aqui ficam o texto já formatado, para ler,
// e a caixa de escrever com a barra de botões e os atalhos Ctrl+B e Ctrl+I. As marcas são lidas em regras/formatacao.ts; aqui só
// há elementos do React, nunca HTML solto, então o que alguém escrever parecido com código de página aparece como texto, e o
// endereço de um link só sai de linkPermitido (http, https e mailto).
import { Fragment, useRef, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import {
  TAMANHO_DO_ENDERECO, alternarCodigo, alternarInicioDeLinha, alternarItemDeTarefa, alternarLista, alternarMarca, alternarTitulo,
  blocosDoTexto, linkPermitido, porLink, textoDosPedacos as textoDaLinha, tirarLink,
  type Bloco, type BlocoDo, type Escolha, type Marca, type MarcaDoBotao, type NivelTitulo, type Pedaco, type TipoBloco
} from '../../regras/formatacao';
import { avisar } from '../avisos';
import { Icone, type NomeIcone } from '../Icone';
import { pedirTexto } from '../janela';
import { estiloBotao } from './botao';

/** O elemento de cada destaque. */
const ELEMENTO: Record<Marca, 'strong' | 'em' | 'del' | 'code'> = { negrito: 'strong', italico: 'em', tachado: 'del', codigo: 'code' };
/** Os atalhos da caixa (com Ctrl, ou Cmd no Mac): a tecla e a marca. O editor ao vivo monta os dele com esta mesma tabela. */
export const ATALHOS: Record<string, MarcaDoBotao> = { b: 'negrito', i: 'italico' };
/**
 * O elemento de cada nível de título. Começa no h3: o cartão já usa h2 no nome do item e h3 nas seções, e um "#" escrito
 * no texto não pode virar o título da página.
 */
const ELEMENTO_DO_TITULO: Record<NivelTitulo, 'h3' | 'h4' | 'h5'> = { 1: 'h3', 2: 'h4', 3: 'h5' };
/** O começo do endereço que abre o programa de e-mail: esse link não abre aba nova. */
export const DE_EMAIL = 'mailto:';
/** O nome da caixinha de um item da lista de tarefas sem texto (aqui e no editor ao vivo). */
export const ITEM_SEM_TEXTO = 'Item sem texto';

function Marcas({ p }: { p: Pedaco }) {
  return p.marcas.reduceRight<ReactNode>((dentro, m) => { const E = ELEMENTO[m]; return <E>{dentro}</E>; }, p.texto);
}

/** Um link: abre em aba nova, sem dar à página aberta acesso a esta; o de e-mail abre o programa de e-mail. */
function Link({ href, children }: { href: string; children: ReactNode }) {
  const abaNova = href.startsWith(DE_EMAIL) ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  // O clique no link não abre o item em volta (cartão do quadro, linha da tabela).
  return <a href={href} {...abaNova} onClick={e => e.stopPropagation()}>{children}</a>;
}

/** Os pedaços de uma linha. Os pedaços seguidos com o mesmo link ficam num link só, com os destaques por dentro. */
function Pedacos({ pedacos }: { pedacos: Pedaco[] }) {
  const grupos: Pedaco[][] = [];
  for (const p of pedacos) {
    const ultimo = grupos.at(-1);
    if (ultimo && p.link && ultimo[0].link === p.link) ultimo.push(p);
    else grupos.push([p]);
  }
  return grupos.map((g, i) => <Fragment key={i}>
    {g[0].link ? <Link href={g[0].link}>{g.map((p, j) => <Marcas key={j} p={p} />)}</Link> : <Marcas p={g[0]} />}
  </Fragment>);
}

/** As linhas comuns, como foram escritas: uma quebra entre elas (o pre-wrap do estilo mantém as quebras). */
const Linhas = ({ b }: { b: Bloco }) => b.linhas.map((l, j) => <Fragment key={j}>{j > 0 && '\n'}<Pedacos pedacos={l} /></Fragment>);

/** A tabela: as células vêm em sequência, uma por coluna em cada linha, e a primeira linha é o cabeçalho. */
function Tabela({ b }: { b: BlocoDo<'tabela'> }) {
  const n = b.colunas.length, linhas: Pedaco[][][] = [];
  for (let i = 0; i < b.linhas.length; i += n) linhas.push(b.linhas.slice(i, i + n));
  const [cabecalho, ...corpo] = linhas;
  const celula = (E: 'th' | 'td') => (c: Pedaco[], k: number) =>
    <E key={k} data-alinhamento={b.colunas[k] ?? undefined}><Pedacos pedacos={c} /></E>;
  // A tabela larga rola de lado dentro da sua caixa, sem alargar o cartão.
  return <div className="texto-formatado-tabela">
    <table>
      <thead><tr>{cabecalho.map(celula('th'))}</tr></thead>
      {corpo.length > 0 && <tbody>{corpo.map((l, j) => <tr key={j}>{l.map(celula('td'))}</tr>)}</tbody>}
    </table>
  </div>;
}

/** O que o desenho de um bloco recebe além dele: como marcar a caixinha de uma linha do texto (sem isso, as caixinhas só se veem). */
interface Desenho { marcar?: (linha: number) => void }

/** Como cada tipo de bloco aparece. */
const BLOCO: { [T in TipoBloco]: (b: BlocoDo<T>, d: Desenho) => ReactNode } = {
  texto: b => <p><Linhas b={b} /></p>,
  lista: b => <ul>{b.linhas.map((l, j) => <li key={j}><Pedacos pedacos={l} /></li>)}</ul>,
  tarefas: (b, { marcar }) => <ul className="texto-formatado-tarefas">{b.linhas.map((l, j) => {
    const c = b.caixinhas[j];
    return <li key={j}>
      {/* O clique na caixinha não abre o item em volta, como o do link. */}
      <input type="checkbox" checked={c.marcada} disabled={!marcar} aria-label={textoDaLinha(l) || ITEM_SEM_TEXTO}
        onChange={() => marcar?.(c.linha)} onClick={e => e.stopPropagation()} />
      <span><Pedacos pedacos={l} /></span>
    </li>;
  })}</ul>,
  numerada: b => <ol start={b.inicio}>{b.linhas.map((l, j) => <li key={j}><Pedacos pedacos={l} /></li>)}</ol>,
  citacao: b => <blockquote><Linhas b={b} /></blockquote>,
  titulo: b => { const H = ELEMENTO_DO_TITULO[b.nivel]; return <H><Linhas b={b} /></H>; },
  codigo: b => <pre><code>{b.linhas.map(textoDaLinha).join('\n')}</code></pre>,
  divisoria: () => <hr />,
  tabela: b => <Tabela b={b} />
};
const desenhar = (b: Bloco, d: Desenho) => (BLOCO[b.tipo] as (b: Bloco, d: Desenho) => ReactNode)(b, d);

interface PropsTexto {
  texto: string;
  className?: string;
  /**
   * Quem pode mudar o texto marca e desmarca as caixinhas da lista de tarefas: recebe o texto novo, com a caixinha trocada.
   * Sem isso, as caixinhas aparecem marcadas ou não, mas desabilitadas.
   */
  aoMarcar?: (texto: string) => void;
}

/**
 * O texto já formatado. As linhas comuns ficam como foram escritas, com as quebras; as que começam com "- " viram lista ("- [ ] "
 * e "- [x] ", caixinhas), "1. " lista numerada, "> " citação, "#", "##" ou "###" e um espaço viram títulos, o que fica entre
 * linhas com ``` é código, "---" é uma linha divisória, as linhas com "|" sobre um "|---|" são uma tabela, e [texto](endereço)
 * vira link.
 */
export function TextoFormatado({ texto, className, aoMarcar }: PropsTexto) {
  const desenho: Desenho = { marcar: aoMarcar && (linha => aoMarcar(alternarItemDeTarefa(texto, linha))) };
  return <div className={['texto-formatado', className].filter(Boolean).join(' ')}>
    {blocosDoTexto(texto).map((b, i) => <Fragment key={i}>{desenhar(b, desenho)}</Fragment>)}
  </div>;
}

/** Escreve na caixa com o foco, pelo navegador (entra no histórico do Ctrl+Z). Diz se conseguiu. */
function digitar(texto: string) {
  try { return document.execCommand('insertText', false, texto); } catch { return false; }
}

/** Os botões com ícone da barra, na ordem em que aparecem entre o Itálico e o Link. */
const BOTOES: { rotulo: string; icone: NomeIcone; fazer: (e: Escolha) => Escolha }[] = [
  { rotulo: 'Cabeçalho', icone: 'texto', fazer: alternarTitulo },
  { rotulo: 'Lista', icone: 'lista', fazer: alternarLista },
  { rotulo: 'Lista numerada', icone: 'numerada', fazer: e => alternarInicioDeLinha(e, 'numerada') },
  { rotulo: 'Lista de tarefas', icone: 'caixinha', fazer: e => alternarInicioDeLinha(e, 'tarefa') },
  { rotulo: 'Citação', icone: 'citacao', fazer: e => alternarInicioDeLinha(e, 'citacao') },
  { rotulo: 'Código', icone: 'codigo', fazer: alternarCodigo }
];
/** O tamanho dos ícones da barra. */
const TAMANHO_DO_ICONE = 15;
/**
 * Na caixa estreita (o celular, #374), os botões com o alvo do dedo inteiro (o --alvo-de-toque) não cabem numa linha: a barra vira
 * duas linhas equilibradas (a de cima com um botão a mais, se a conta não fecha), e nenhum botão fica sozinho embaixo.
 */
const LINHAS_NA_CAIXA_ESTREITA = 2;
/** Quantos botões vão em cada linha da barra na caixa estreita (a --botoes-por-linha do estilo.css), para tantos botões. */
const porLinha = (botoes: number) => ({ '--botoes-por-linha': Math.ceil(botoes / LINHAS_NA_CAIXA_ESTREITA) }) as CSSProperties;

/** O que a barra de formatação precisa da caixa onde se escreve (a caixa de texto comum ou o editor ao vivo). */
export interface AlvoDaFormatacao {
  /** O id da caixa: a barra diz ao leitor de tela que a controla. */
  id?: string;
  /** O tamanho máximo do texto: o botão cujo resultado passaria dele não muda nada. */
  maximo?: number;
  /** O texto e o trecho escolhido agora (null se a caixa ainda não está na tela). */
  escolha: () => Escolha | null;
  /** Põe na caixa o resultado de um botão, com o trecho escolhido, de modo que o Ctrl+Z o desfaça. */
  trocar: (r: Escolha) => void;
  focar: () => void;
  /**
   * O botão de marca (B, I) com o cursor parado, sem trecho escolhido, quando a caixa sabe fazê-lo do seu jeito (o editor ao
   * vivo liga a marca para o que se digitar, sem pôr "****" à mostra, #368). Diz se fez. Sem isso, valem os sinais com o cursor
   * entre eles (alternarMarca).
   */
  marcarNoCursor?: (marca: MarcaDoBotao) => boolean;
  /**
   * A barra só se mostra, no lugar da barra do editor (a descrição lida e o editor que ainda chega, #433): os botões ficam fora do
   * Tab e do leitor de tela, que abrem o texto com Enter nele e encontram a barra de verdade no editor.
   */
  soParaVer?: boolean;
}

/**
 * A barra B, I, cabeçalho, listas (comum, numerada e de tarefas), citação, código e link, com as regras de regras/formatacao.ts,
 * para a caixa dada. Devolve a barra e o "marcar" (para os atalhos Ctrl+B e Ctrl+I de quem a usa).
 */
export function barraDeFormatacao(alvo: AlvoDaFormatacao) {
  /**
   * Aplica o botão à escolha dada (ou à que está na caixa agora). Diz se trocou: se o resultado passa do tamanho da caixa, nada
   * muda (os botões de marca e de começo de linha ficam calados; o Link avisa, porque a pessoa escreveu um endereço).
   */
  function aplicar(fazer: (e: Escolha) => Escolha, escolha = alvo.escolha()): boolean {
    if (!escolha) return false;
    const r = fazer(escolha);
    if (alvo.maximo && r.texto.length > alvo.maximo) return false;   // a marca não cabe: nada muda
    alvo.trocar(r);
    return true;
  }
  function marcar(marca: MarcaDoBotao): boolean {
    const escolha = alvo.escolha();
    if (escolha && escolha.inicio === escolha.fim && alvo.marcarNoCursor) return alvo.marcarNoCursor(marca);
    return aplicar(e => alternarMarca(e, marca), escolha);
  }
  /** Sobre um link, tira o link; fora dele, pede o endereço (a escolha fica guardada enquanto a janela está aberta). */
  async function link() {
    const escolha = alvo.escolha();
    if (!escolha) return;
    const semLink = tirarLink(escolha);
    if (semLink) { aplicar(() => semLink, escolha); return; }
    const escrito = await pedirTexto('Endereço do link', 'https://', { maximo: TAMANHO_DO_ENDERECO });
    if (escrito === null) { alvo.focar(); return; }
    const endereco = linkPermitido(escrito);
    if (!endereco) {
      avisar('Esse endereço não vira link. Use um endereço completo, começando com https://, http:// ou mailto:.', 'erro');
      alvo.focar();
      return;
    }
    const comLink = porLink(escolha, endereco);
    if (!comLink) avisar('Esse trecho não vira link: ele tem colchetes ou pega parte de um link já escrito. Escolha outro trecho.', 'erro');
    else if (!aplicar(() => comLink, escolha)) avisar(`O link não cabe: o texto passaria do limite de ${alvo.maximo} caracteres.`, 'erro');
    alvo.focar();
  }
  /** Cada botão da barra: o nome (o mesmo do leitor de tela e da dica), o desenho e o que ele faz. */
  const itens: { rotulo: string; desenho: ReactNode; fazer: () => unknown }[] = [
    { rotulo: 'Negrito (Ctrl+B)', desenho: <b aria-hidden="true">B</b>, fazer: () => marcar('negrito') },
    { rotulo: 'Itálico (Ctrl+I)', desenho: <i aria-hidden="true">I</i>, fazer: () => marcar('italico') },
    ...BOTOES.map(({ rotulo, icone, fazer }) => ({ rotulo, desenho: <Icone nome={icone} tam={TAMANHO_DO_ICONE} />, fazer: () => aplicar(fazer) })),
    { rotulo: 'Link', desenho: <Icone nome="vinculo" tam={TAMANHO_DO_ICONE} />, fazer: () => void link() }
  ];
  /** Faz o que o botão com esse nome faz (a descrição lida passa ao editor o botão que a pessoa apertou nela, #433). */
  const apertar = (rotulo: string) => { itens.find(i => i.rotulo === rotulo)?.fazer(); };
  const botao = estiloBotao({ forma: 'mini' }, 'caixa-formatada-botao');
  const barra = <div className="caixa-formatada-barra" role="toolbar" aria-label="Formatação do texto" style={porLinha(itens.length)}
    {...alvo.soParaVer ? { 'aria-hidden': true } : { 'aria-controls': alvo.id }}>
    {itens.map(({ rotulo, desenho, fazer }) =>
      <button key={rotulo} type="button" className={botao} aria-label={rotulo} title={rotulo} tabIndex={alvo.soParaVer ? -1 : undefined} onClick={() => void fazer()}>{desenho}</button>)}
  </div>;
  return { barra, marcar, apertar };
}

/** A marca do atalho (Ctrl+B, Ctrl+I, ou Cmd no Mac), ou undefined se a tecla não é um atalho da barra. */
const marcaDoAtalho = (e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }) =>
  (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey ? ATALHOS[e.key.toLowerCase()] : undefined;

type PropsCaixa =Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'ref'> & { valor: string; aoMudar: (texto: string) => void };

/**
 * A caixa de escrever com a barra de formatação (barraDeFormatacao). Fica dentro de <Campo>, com as props de propsDoCampo.
 * Ctrl+B e Ctrl+I só valem com o foco na caixa, e não deixam o navegador abrir os favoritos (Firefox).
 */
export function CaixaFormatada({ valor, aoMudar, onKeyDown, ...resto }: PropsCaixa) {
  const caixa = useRef<HTMLTextAreaElement>(null);
  const { barra, marcar } = barraDeFormatacao({
    id: resto.id,
    maximo: resto.maxLength,
    escolha: () => {
      const el = caixa.current;
      return el && { texto: valor, inicio: el.selectionStart, fim: el.selectionEnd };
    },
    trocar: r => {
      const el = caixa.current;
      if (!el) return;
      // O texto novo entra pelo próprio navegador, como se fosse digitado: assim Ctrl+Z desfaz a marca e não perde o que veio antes.
      // Onde o navegador não deixa (ou nos testes), entra pelo estado, como as outras caixas.
      el.focus();
      el.setSelectionRange(0, el.value.length);
      const escolher = () => { el.focus(); el.setSelectionRange(r.inicio, r.fim); };
      // Pelo navegador, o texto já está na caixa: a escolha volta na hora. Se esperasse, apagaria um trecho que a pessoa escolhesse
      // logo em seguida. Pelo estado, ela só volta depois que o React desenha o texto novo.
      if (digitar(r.texto)) escolher();
      else { aoMudar(r.texto); setTimeout(escolher, 0); }
    },
    focar: () => caixa.current?.focus()
  });
  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    const marca = marcaDoAtalho(e);
    if (marca) { e.preventDefault(); marcar(marca); }
    onKeyDown?.(e);
  }
  return <div className="caixa-formatada">
    {barra}
    <textarea ref={caixa} {...resto} value={valor} onChange={e => aoMudar(e.target.value)} onKeyDown={teclar} />
  </div>;
}
