// Texto com negrito, itálico, listas (#293), títulos e links (#303): o texto já formatado, para ler, e a caixa de escrever com
// os botões B, I, cabeçalho, lista e link e os atalhos Ctrl+B e Ctrl+I. As marcas são lidas em regras/formatacao.ts; aqui só há
// elementos do React, nunca HTML solto, então o que alguém escrever parecido com código de página aparece como texto, e o
// endereço de um link só sai de linkPermitido (http, https e mailto).
import { Fragment, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import {
  TAMANHO_DO_ENDERECO, alternarLista, alternarMarca, alternarTitulo, blocosDoTexto, linkPermitido, porLink, tirarLink,
  type Bloco, type Escolha, type Marca, type NivelTitulo, type Pedaco, type TipoBloco
} from '../../regras/formatacao';
import { avisar } from '../avisos';
import { Icone } from '../Icone';
import { pedirTexto } from '../janela';
import { estiloBotao } from './botao';

/** O elemento de cada destaque. */
const ELEMENTO: Record<Marca, 'strong' | 'em'> = { negrito: 'strong', italico: 'em' };
/** Os atalhos da caixa (com Ctrl, ou Cmd no Mac). */
const ATALHOS: Record<string, Marca> = { b: 'negrito', i: 'italico' };
/**
 * O elemento de cada nível de título. Começa no h3: o cartão já usa h2 no nome do item e h3 nas seções, e um "#" escrito
 * no texto não pode virar o título da página.
 */
const ELEMENTO_DO_TITULO: Record<NivelTitulo, 'h3' | 'h4' | 'h5'> = { 1: 'h3', 2: 'h4', 3: 'h5' };
/** O começo do endereço que abre o programa de e-mail: esse link não abre aba nova. */
const DE_EMAIL = 'mailto:';

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

/** Como cada tipo de bloco aparece. */
const BLOCO: { [T in TipoBloco]: (b: Extract<Bloco, { tipo: T }>) => ReactNode } = {
  texto: b => <p><Linhas b={b} /></p>,
  lista: b => <ul>{b.linhas.map((l, j) => <li key={j}><Pedacos pedacos={l} /></li>)}</ul>,
  titulo: b => { const H = ELEMENTO_DO_TITULO[b.nivel]; return <H><Linhas b={b} /></H>; }
};
const desenhar = (b: Bloco) => (BLOCO[b.tipo] as (b: Bloco) => ReactNode)(b);

/**
 * O texto já formatado. As linhas comuns ficam como foram escritas, com as quebras; as que começam com "- " viram lista, as
 * que começam com "#", "##" ou "###" e um espaço viram títulos, e [texto](endereço) vira link.
 */
export function TextoFormatado({ texto, className }: { texto: string; className?: string }) {
  return <div className={['texto-formatado', className].filter(Boolean).join(' ')}>
    {blocosDoTexto(texto).map((b, i) => <Fragment key={i}>{desenhar(b)}</Fragment>)}
  </div>;
}

/** Escreve na caixa com o foco, pelo navegador (entra no histórico do Ctrl+Z). Diz se conseguiu. */
function digitar(texto: string) {
  try { return document.execCommand('insertText', false, texto); } catch { return false; }
}

type PropsCaixa =Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'ref'> & { valor: string; aoMudar: (texto: string) => void };

/**
 * A caixa de escrever com a barra B, I, cabeçalho, lista e link. Fica dentro de <Campo>, com as props de propsDoCampo. Ctrl+B e
 * Ctrl+I só valem com o foco na caixa, e não deixam o navegador abrir os favoritos (Firefox).
 */
export function CaixaFormatada({ valor, aoMudar, onKeyDown, ...resto }: PropsCaixa) {
  const caixa = useRef<HTMLTextAreaElement>(null);
  const escolhaAtual = (): Escolha | null => {
    const el = caixa.current;
    return el && { texto: valor, inicio: el.selectionStart, fim: el.selectionEnd };
  };
  /**
   * Troca o texto da caixa pelo resultado do botão, a partir da escolha dada (ou da que está na caixa agora). Diz se trocou: se o
   * resultado passa do tamanho da caixa, nada muda (B, I, cabeçalho e lista ficam calados; o Link avisa, porque a pessoa escreveu
   * um endereço).
   */
  function aplicar(fazer: (e: Escolha) => Escolha, escolha = escolhaAtual()): boolean {
    const el = caixa.current;
    if (!el || !escolha) return false;
    const r = fazer(escolha);
    if (resto.maxLength && r.texto.length > resto.maxLength) return false;   // a marca não cabe: nada muda
    // O texto novo entra pelo próprio navegador, como se fosse digitado: assim Ctrl+Z desfaz a marca e não perde o que veio antes.
    // Onde o navegador não deixa (ou nos testes), entra pelo estado, como as outras caixas.
    el.focus();
    el.setSelectionRange(0, el.value.length);
    if (!digitar(r.texto)) aoMudar(r.texto);
    setTimeout(() => { el.focus(); el.setSelectionRange(r.inicio, r.fim); }, 0);
    return true;
  }
  const marcar = (marca: Marca) => aplicar(e => alternarMarca(e, marca));
  /** Sobre um link, tira o link; fora dele, pede o endereço (a escolha fica guardada enquanto a janela está aberta). */
  async function link() {
    const escolha = escolhaAtual();
    if (!escolha) return;
    const semLink = tirarLink(escolha);
    if (semLink) { aplicar(() => semLink, escolha); return; }
    const escrito = await pedirTexto('Endereço do link', 'https://', { maximo: TAMANHO_DO_ENDERECO });
    if (escrito === null) { caixa.current?.focus(); return; }
    const endereco = linkPermitido(escrito);
    if (!endereco) {
      avisar('Esse endereço não vira link. Use um endereço completo, começando com https://, http:// ou mailto:.', 'erro');
      caixa.current?.focus();
      return;
    }
    const comLink = porLink(escolha, endereco);
    if (!comLink) avisar('Esse trecho não vira link: ele tem colchetes ou pega parte de um link já escrito. Escolha outro trecho.', 'erro');
    else if (!aplicar(() => comLink, escolha)) avisar(`O link não cabe: o texto passaria do limite de ${resto.maxLength} caracteres.`, 'erro');
    caixa.current?.focus();
  }
  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    const marca = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey ? ATALHOS[e.key.toLowerCase()] : undefined;
    if (marca) { e.preventDefault(); marcar(marca); }
    onKeyDown?.(e);
  }
  const botao = estiloBotao({ forma: 'mini' }, 'caixa-formatada-botao');
  return <div className="caixa-formatada">
    <div className="caixa-formatada-barra" role="toolbar" aria-label="Formatação do texto" aria-controls={resto.id}>
      <button type="button" className={botao} aria-label="Negrito (Ctrl+B)" title="Negrito (Ctrl+B)" onClick={() => marcar('negrito')}><b aria-hidden="true">B</b></button>
      <button type="button" className={botao} aria-label="Itálico (Ctrl+I)" title="Itálico (Ctrl+I)" onClick={() => marcar('italico')}><i aria-hidden="true">I</i></button>
      <button type="button" className={botao} aria-label="Cabeçalho" title="Cabeçalho" onClick={() => aplicar(alternarTitulo)}><Icone nome="texto" tam={15} /></button>
      <button type="button" className={botao} aria-label="Lista" title="Lista" onClick={() => aplicar(alternarLista)}><Icone nome="lista" tam={15} /></button>
      <button type="button" className={botao} aria-label="Link" title="Link" onClick={() => void link()}><Icone nome="vinculo" tam={15} /></button>
    </div>
    <textarea ref={caixa} {...resto} value={valor} onChange={e => aoMudar(e.target.value)} onKeyDown={teclar} />
  </div>;
}
