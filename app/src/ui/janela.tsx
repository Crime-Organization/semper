// Janelas de confirmação e de escolha. janela() devolve uma promessa com o valor escolhido (null ao fechar),
// então qualquer tela pergunta com: const ok = await confirmar('Título', 'Texto').
// A janela é um formulário: uma ação recebe os campos dela pelo name (FormData), sem precisar procurar no HTML.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Campo, Nota } from './base';
import { CampoData } from './base/CampoData';
import { criarLoja } from './loja';
import { estiloBotao } from './base/botao';

export interface AcaoJanela<T> {
  rotulo: string;
  /** Valor devolvido (null = desistiu); se for função, recebe os campos da janela pelo name e devolve o resultado. */
  valor: T | null | ((campos: FormData) => T | null);
  tipo?: 'pri' | 'perigo';
}
/** O corpo da janela: o conteúdo, ou uma função que o monta e recebe como responder sem os botões (ex.: a busca de escolher uma
 *  demanda, em que escolher um achado já fecha a janela com ele). */
type CorpoDaJanela<T> = ReactNode | ((responder: (valor: T) => void) => ReactNode);
interface Pedido { id: number; titulo: string; corpo: CorpoDaJanela<unknown>; acoes: AcaoJanela<unknown>[]; larga: boolean; resolver: (v: unknown) => void }

const pedidos = criarLoja<Pedido[]>([]);
let seq = 0;

function fechar(id: number, valor: unknown) {
  const p = pedidos.ler().find(x => x.id === id);
  if (!p) return;
  pedidos.mudar(lista => lista.filter(x => x !== p));
  p.resolver(valor);
}

/**
 * Abre uma janela e espera a escolha. Com "larga" (um texto para ler, como as Novidades), ela fica mais larga e só o corpo
 * rola: o título e os botões continuam à vista. O corpo pode ser uma função, que recebe como responder sem os botões.
 */
export function janela<T>({ titulo, corpo = null, acoes, larga = false }: { titulo: string; corpo?: CorpoDaJanela<T>; acoes?: AcaoJanela<T>[]; larga?: boolean }): Promise<T | null> {
  return new Promise(resolve => {
    pedidos.mudar(lista => [...lista, {
      id: ++seq, titulo, corpo: corpo as CorpoDaJanela<unknown>, larga, acoes: (acoes || [{ rotulo: 'Fechar', valor: null }]) as AcaoJanela<unknown>[],
      resolver: v => resolve(v as T | null)
    }]);
  });
}

/** Há uma janela aberta por cima de tudo (uma pergunta à espera de resposta). */
export const haJanelaAberta = () => pedidos.ler().length > 0;

export const confirmar = (titulo: string, texto: ReactNode, rotulo = 'Confirmar', perigo = false) =>
  janela<boolean>({ titulo, corpo: <p>{texto}</p>, acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo, valor: true, tipo: perigo ? 'perigo' : 'pri' }] });

/** Pede um texto (uma linha ou várias). Devolve o texto sem espaços nas pontas, ou null se cancelar. */
/** Com `nota`, uma explicação curta embaixo do campo (um exemplo, o que acontece com o texto); `acao` é o nome do botão que confirma. */
export function pedirTexto(titulo: string, valor = '', { multilinha = false, maximo = 60, nota, acao = 'Salvar' }: { multilinha?: boolean; maximo?: number; nota?: ReactNode; acao?: string } = {}) {
  const campo = multilinha
    ? <textarea name="texto" className="campo" rows={6} defaultValue={valor} aria-label={titulo} />
    : <input name="texto" className="campo" maxLength={maximo} defaultValue={valor} aria-label={titulo} aria-describedby={nota ? NOTA_DO_TEXTO : undefined} />;
  return janela<string>({
    titulo,
    corpo: nota ? <>{campo}<Nota id={NOTA_DO_TEXTO}>{nota}</Nota></> : campo,
    acoes: [{ rotulo: 'Cancelar', valor: null },
      { rotulo: acao, tipo: 'pri', valor: campos => String(campos.get('texto') ?? '').trim() }]
  });
}
/** O id da nota de pedirTexto (só uma janela dessas fica aberta por vez). */
const NOTA_DO_TEXTO = 'janela-nota-do-texto';

/** O id do campo de escolha da janela de escolherNaJanela (só uma janela dessas fica aberta por vez). */
const ESCOLHA = 'janela-escolha';
/** Uma opção de escolherNaJanela: o valor devolvido e o nome que a pessoa lê. */
export interface OpcaoDaJanela { valor: string; nome: string }
/**
 * Pede para escolher uma opção numa lista (um select com rótulo), como "Mover para pasta" e "Mover para grupo". Devolve o
 * valor escolhido, ou null se a pessoa desistiu. "acao" é o nome do botão que confirma (de início, "Mover").
 */
export function escolherNaJanela({ titulo, rotulo, opcoes, atual, acao = 'Mover' }: { titulo: string; rotulo: string; opcoes: OpcaoDaJanela[]; atual: string; acao?: string }) {
  return janela<string>({
    titulo,
    corpo: <Campo rotulo={rotulo} para={ESCOLHA}>
      <select id={ESCOLHA} name="escolha" className="campo" defaultValue={atual}>
        {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
      </select>
    </Campo>,
    acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: acao, tipo: 'pri', valor: campos => String(campos.get('escolha') ?? atual) }]
  });
}

/** A data da janela de pedirData: o campo de data de sempre (com o calendário pequeno, #357), que avisa cada mudança. */
function DataDaJanela({ titulo, inicial, aoMudar }: { titulo: string; inicial: string; aoMudar: (texto: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return <CampoData className="campo" aria-label={titulo} valor={valor} aoMudar={v => { setValor(v); aoMudar(v); }} />;
}
/**
 * Pede uma data (dd/mm/aaaa, como digitada) com o calendário pequeno (#357). Devolve o texto sem espaços nas pontas (vazio, se a
 * pessoa apagou), ou null se cancelar. Quem pede confere a data (lerData).
 */
export function pedirData(titulo: string, valor = '') {
  const escrito = { texto: valor };
  return janela<string>({
    titulo,
    corpo: <DataDaJanela titulo={titulo} inicial={valor} aoMudar={texto => { escrito.texto = texto; }} />,
    acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar', tipo: 'pri', valor: () => escrito.texto.trim() }]
  });
}
function JanelaAberta({ p }: { p: Pedido }) {
  const veu = useRef<HTMLDivElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const idTitulo = 'jt' + p.id;
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const el = veu.current!;
    // A janela larga é um texto para ler (as Novidades, a ajuda da tela): o foco vai ao botão, e não a um campo do meio do texto,
    // que faria o corpo rolar e esconder o começo (como a caixa de desligar os atalhos, no pé da ajuda).
    const campo = p.larga ? null : el.querySelector<HTMLInputElement>('input, textarea, select');
    if (campo) { campo.focus(); campo.select?.(); }
    else (el.querySelector<HTMLElement>('.btn.pri') || el.querySelector<HTMLElement>('.btn'))?.focus();
    return () => { anterior?.focus?.(); };
  }, [p.larga]);
  const escolher = (a: AcaoJanela<unknown>) =>
    fechar(p.id, typeof a.valor === 'function' ? (a.valor as (campos: FormData) => unknown)(new FormData(formulario.current!)) : a.valor);
  return <div className="veu-janela" ref={veu} onClick={e => { if (e.target === e.currentTarget) fechar(p.id, null); }}
    onKeyDown={e => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); veu.current?.querySelector<HTMLElement>('.btn.pri')?.click(); }
    }}>
    <form className={p.larga ? 'janela larga' : 'janela'} ref={formulario} role="dialog" aria-modal="true" aria-labelledby={idTitulo} noValidate onSubmit={e => e.preventDefault()}>
      <h2 id={idTitulo}>{p.titulo}</h2>
      <div className="janela-corpo">{typeof p.corpo === 'function' ? p.corpo(v => fechar(p.id, v)) : p.corpo}</div>
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
