// Janelas de confirmação e de escolha. janela() devolve uma promessa com o valor escolhido (null ao fechar),
// então qualquer tela pergunta com: const ok = await confirmar('Título', 'Texto').
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

export interface AcaoJanela<T> {
  rotulo: string;
  /** Valor devolvido; se for função, recebe a janela e devolve o resultado (ex.: ler um campo). */
  valor: T | ((janela: HTMLElement) => T);
  tipo?: 'pri' | 'perigo';
}
interface Pedido { id: number; titulo: string; corpo: ReactNode; acoes: AcaoJanela<unknown>[]; resolver: (v: unknown) => void }

let pedidos: Pedido[] = [];
let seq = 0;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach(f => f());
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

function fechar(id: number, valor: unknown) {
  const p = pedidos.find(x => x.id === id);
  if (!p) return;
  pedidos = pedidos.filter(x => x !== p);
  emitir();
  p.resolver(valor);
}

export function janela<T>({ titulo, corpo = null, acoes }: { titulo: string; corpo?: ReactNode; acoes?: AcaoJanela<T>[] }): Promise<T | null> {
  return new Promise(resolve => {
    pedidos = [...pedidos, {
      id: ++seq, titulo, corpo, acoes: (acoes || [{ rotulo: 'Fechar', valor: null }]) as AcaoJanela<unknown>[],
      resolver: v => resolve(v as T | null)
    }];
    emitir();
  });
}

export const confirmar = (titulo: string, texto: ReactNode, rotulo = 'Confirmar', perigo = false) =>
  janela<boolean>({ titulo, corpo: <p>{texto}</p>, acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo, valor: true, tipo: perigo ? 'perigo' : 'pri' }] });

/** Pede um texto (uma linha ou várias). Devolve o texto sem espaços nas pontas, ou null se cancelar. */
export function pedirTexto(titulo: string, valor = '', { multilinha = false, maximo = 60 } = {}) {
  return janela<string>({
    titulo,
    corpo: multilinha
      ? <textarea className="campo" rows={6} defaultValue={valor} aria-label={titulo} />
      : <input className="campo" maxLength={maximo} defaultValue={valor} aria-label={titulo} />,
    acoes: [{ rotulo: 'Cancelar', valor: null as unknown as string },
      { rotulo: 'Salvar', tipo: 'pri', valor: j => (j.querySelector('input, textarea') as HTMLInputElement).value.trim() }]
  });
}

function JanelaAberta({ p }: { p: Pedido }) {
  const veu = useRef<HTMLDivElement>(null);
  const idTitulo = 'jt' + p.id;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const el = veu.current!;
    const campo = el.querySelector<HTMLInputElement>('input, textarea, select');
    if (campo) { campo.focus(); campo.select?.(); }
    else (el.querySelector<HTMLElement>('.btn.pri') || el.querySelector<HTMLElement>('.btn'))?.focus();
    return () => { anterior?.focus?.(); };
  }, []);
  const escolher = (a: AcaoJanela<unknown>) => fechar(p.id, typeof a.valor === 'function' ? (a.valor as (j: HTMLElement) => unknown)(veu.current!) : a.valor);
  return <div className="veu-janela" ref={veu} onClick={e => { if (e.target === e.currentTarget) fechar(p.id, null); }}
    onKeyDown={e => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); veu.current?.querySelector<HTMLElement>('.btn.pri')?.click(); }
    }}>
    <div className="janela" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{p.titulo}</h2>
      <div className="janela-corpo">{p.corpo}</div>
      <div className="janela-acoes">
        {p.acoes.map((a, i) => <button key={i} type="button" className={'btn' + (a.tipo ? ' ' + a.tipo : '')} onClick={() => escolher(a)}>{a.rotulo}</button>)}
      </div>
    </div>
  </div>;
}

/** Lugar das janelas (um só, na raiz do app). Esc fecha só a de cima. */
export function Janelas() {
  const lista = useSyncExternalStore(assinar, () => pedidos);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !pedidos.length) return;
      e.stopPropagation();
      fechar(pedidos[pedidos.length - 1].id, null);
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, []);
  return <>{lista.map(p => <JanelaAberta key={p.id} p={p} />)}</>;
}
