// Texto com negrito, itálico e listas (#293): o texto já formatado, para ler, e a caixa de escrever com os botões B, I e lista
// e os atalhos Ctrl+B e Ctrl+I. As marcas são lidas em regras/formatacao.ts; aqui só há elementos do React, nunca HTML solto,
// então o que alguém escrever parecido com código de página aparece como texto.
import { Fragment, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { alternarLista, alternarMarca, blocosDoTexto, type Escolha, type Marca, type Pedaco } from '../../regras/formatacao';
import { Icone } from '../Icone';
import { estiloBotao } from './botao';

/** O elemento de cada destaque. */
const ELEMENTO: Record<Marca, 'strong' | 'em'> = { negrito: 'strong', italico: 'em' };
/** Os atalhos da caixa (com Ctrl, ou Cmd no Mac). */
const ATALHOS: Record<string, Marca> = { b: 'negrito', i: 'italico' };

function Pedacos({ pedacos }: { pedacos: Pedaco[] }) {
  return pedacos.map((p, i) => <Fragment key={i}>
    {p.marcas.reduceRight<ReactNode>((dentro, m) => { const E = ELEMENTO[m]; return <E>{dentro}</E>; }, p.texto)}
  </Fragment>);
}

/** O texto já formatado. As linhas comuns ficam como foram escritas, com as quebras; as que começam com "- " viram lista. */
export function TextoFormatado({ texto, className }: { texto: string; className?: string }) {
  return <div className={['texto-formatado', className].filter(Boolean).join(' ')}>
    {blocosDoTexto(texto).map((b, i) => b.tipo === 'lista'
      ? <ul key={i}>{b.linhas.map((l, j) => <li key={j}><Pedacos pedacos={l} /></li>)}</ul>
      : <p key={i}>{b.linhas.map((l, j) => <Fragment key={j}>{j > 0 && '\n'}<Pedacos pedacos={l} /></Fragment>)}</p>)}
  </div>;
}

type PropsCaixa = Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'ref'> & { valor: string; aoMudar: (texto: string) => void };

/**
 * A caixa de escrever com a barra B, I e lista. Fica dentro de <Campo>, com as props de propsDoCampo. Ctrl+B e Ctrl+I só valem
 * com o foco na caixa, e não deixam o navegador abrir os favoritos (Firefox).
 */
export function CaixaFormatada({ valor, aoMudar, onKeyDown, ...resto }: PropsCaixa) {
  const caixa = useRef<HTMLTextAreaElement>(null);
  function aplicar(fazer: (e: Escolha) => Escolha) {
    const el = caixa.current;
    if (!el) return;
    const r = fazer({ texto: valor, inicio: el.selectionStart, fim: el.selectionEnd });
    if (resto.maxLength && r.texto.length > resto.maxLength) return;   // a marca não cabe: nada muda
    aoMudar(r.texto);
    setTimeout(() => { el.focus(); el.setSelectionRange(r.inicio, r.fim); }, 0);
  }
  const marcar = (marca: Marca) => aplicar(e => alternarMarca(e, marca));
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
      <button type="button" className={botao} aria-label="Lista" title="Lista" onClick={() => aplicar(alternarLista)}><Icone nome="lista" tam={15} /></button>
    </div>
    <textarea ref={caixa} {...resto} value={valor} onChange={e => aoMudar(e.target.value)} onKeyDown={teclar} />
  </div>;
}
