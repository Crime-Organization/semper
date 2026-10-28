// Janelas de confirmação e de escolha. janela() devolve uma promessa com o valor escolhido (null ao fechar),
// então qualquer tela pergunta com: const ok = await confirmar('Título', 'Texto').
// A janela é um formulário: uma ação recebe os campos dela pelo name (FormData), sem precisar procurar no HTML.
import { useEffect, useRef, type ReactNode } from 'react';
import { criarLoja } from './loja';
import { estiloBotao } from './base/botao';

export interface AcaoJanela<T> {
  rotulo: string;
  /** Valor devolvido (null = desistiu); se for função, recebe os campos da janela pelo name e devolve o resultado. */
  valor: T | null | ((campos: FormData) => T | null);
  tipo?: 'pri' | 'perigo';
}
interface Pedido { id: number; titulo: string; corpo: ReactNode; acoes: AcaoJanela<unknown>[]; resolver: (v: unknown) => void }

const pedidos = criarLoja<Pedido[]>([]);
let seq = 0;

function fechar(id: number, valor: unknown) {
  const p = pedidos.ler().find(x => x.id === id);
  if (!p) return;
  pedidos.mudar(lista => lista.filter(x => x !== p));
  p.resolver(valor);
}

export function janela<T>({ titulo, corpo = null, acoes }: { titulo: string; corpo?: ReactNode; acoes?: AcaoJanela<T>[] }): Promise<T | null> {
  return new Promise(resolve => {
    pedidos.mudar(lista => [...lista, {
      id: ++seq, titulo, corpo, acoes: (acoes || [{ rotulo: 'Fechar', valor: null }]) as AcaoJanela<unknown>[],
      resolver: v => resolve(v as T | null)
    }]);
  });
}

export const confirmar = (titulo: string, texto: ReactNode, rotulo = 'Confirmar', perigo = false) =>
  janela<boolean>({ titulo, corpo: <p>{texto}</p>, acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo, valor: true, tipo: perigo ? 'perigo' : 'pri' }] });

/** Pede um texto (uma linha ou várias). Devolve o texto sem espaços nas pontas, ou null se cancelar. */
export function pedirTexto(titulo: string, valor = '', { multilinha = false, maximo = 60 } = {}) {
  return janela<string>({
    titulo,
    corpo: multilinha
      ? <textarea name="texto" className="campo" rows={6} defaultValue={valor} aria-label={titulo} />
      : <input name="texto" className="campo" maxLength={maximo} defaultValue={valor} aria-label={titulo} />,
    acoes: [{ rotulo: 'Cancelar', valor: null },
      { rotulo: 'Salvar', tipo: 'pri', valor: campos => String(campos.get('texto') ?? '').trim() }]
  });
}

function JanelaAberta({ p }: { p: Pedido }) {
  const veu = useRef<HTMLDivElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const idTitulo = 'jt' + p.id;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const el = veu.current!;
    const campo = el.querySelector<HTMLInputElement>('input, textarea, select');
    if (campo) { campo.focus(); campo.select?.(); }
    else (el.querySelector<HTMLElement>('.btn.pri') || el.querySelector<HTMLElement>('.btn'))?.focus();
    return () => { anterior?.focus?.(); };
  }, []);
  const escolher = (a: AcaoJanela<unknown>) =>
    fechar(p.id, typeof a.valor === 'function' ? (a.valor as (campos: FormData) => unknown)(new FormData(formulario.current!)) : a.valor);
  return <div className="veu-janela" ref={veu} onClick={e => { if (e.target === e.currentTarget) fechar(p.id, null); }}
    onKeyDown={e => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); veu.current?.querySelector<HTMLElement>('.btn.pri')?.click(); }
    }}>
    <form className="janela" ref={formulario} role="dialog" aria-modal="true" aria-labelledby={idTitulo} noValidate onSubmit={e => e.preventDefault()}>
      <h2 id={idTitulo}>{p.titulo}</h2>
      <div className="janela-corpo">{p.corpo}</div>
      <div className="janela-acoes">
        {p.acoes.map((a, i) => <button key={i} type="button" className={estiloBotao({ variante: a.tipo === 'pri' ? 'principal' : a.tipo })} onClick={() => escolher(a)}>{a.rotulo}</button>)}
      </div>
    </form>
  </div>;
}

/** Lugar das janelas (um só, na raiz do app). Esc fecha só a de cima. */
export function Janelas() {
  const lista = pedidos.usar();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const abertas = pedidos.ler();
      if (e.key !== 'Escape' || !abertas.length) return;
      e.stopPropagation();
      fechar(abertas[abertas.length - 1].id, null);
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, []);
  return <>{lista.map(p => <JanelaAberta key={p.id} p={p} />)}</>;
}
