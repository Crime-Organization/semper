// Quadro kanban comum a todos os módulos, no modelo do Trello: as colunas ocupam a altura da tela
// e cada lista rola dentro da própria coluna. As colunas vêm de useColunas(); o módulo só diz como
// carregar, desenhar e mover os cartões.
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Coluna, Pagina } from '../../dados';
import { Icone } from '../Icone';
import { falha } from '../avisos';
import { normal, numero } from '../util';
import type { Quadro } from './useColunas';

export interface Movimento { de: string | null; para: string | null; ordem: number; ordemAnterior: number | null }

interface Props<T extends { id: string }> {
  quadro: Quadro;
  /** Cartões de uma coluna (null = "Sem etapa"), a partir de "deslocamento". */
  carregar: (colunaId: string | null, deslocamento: number) => Promise<Pagina<T>>;
  /** Mude este valor para recarregar todas as colunas (filtros novos, dados que mudaram). */
  recarga: string | number;
  ordemDe: (item: T) => number | null;
  cartao: (item: T) => ReactNode;
  aoAbrir: (item: T) => void;
  aoMover: (item: T, m: Movimento) => Promise<void>;
  /** Botão "Adicionar" no pé de cada coluna. */
  aoAdicionar?: (colunaId: string | null) => void;
}

interface Lista<T> { itens: T[]; total: number; erro?: string }
const chave = (id: string | null) => id || 'sem';

export function Kanban<T extends { id: string }>(props: Props<T>) {
  const { quadro } = props;
  const p = useRef(props);
  p.current = props;
  const [listas, setListas] = useState<Record<string, Lista<T>>>({});
  const listasRef = useRef(listas);
  listasRef.current = listas;
  const geracao = useRef<Record<string, number>>({});
  const ordens = useRef<Record<string, number>>({});   // ordem dos cartões movidos desde a última carga
  const ordemDe = (it: T) => ordens.current[it.id] ?? p.current.ordemDe(it);

  const elQuadro = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ item: T; de: string | null } | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ k: string; antes: string | null } | null>(null);
  const alvoRef = useRef(alvo);
  alvoRef.current = alvo;
  const colArrasto = useRef<Coluna | null>(null);
  const [colArrastada, setColArrastada] = useState<string | null>(null);
  const [antesDeCol, setAntesDeCol] = useState<string | null>(null);   // id da coluna ou "fim"
  const antesDeColRef = useRef(antesDeCol);
  antesDeColRef.current = antesDeCol;
  const [menu, setMenu] = useState<{ c: Coluna; botao: HTMLElement } | null>(null);
  const [nova, setNova] = useState('');
  const [criando, setCriando] = useState(false);
  const campoNova = useRef<HTMLInputElement>(null);
  const idNova = useId(), idSugestoes = useId();

  const visiveis = quadro.colunas.filter(c => !c.oculta);
  const ocultas = quadro.colunas.filter(c => c.oculta);

  // A altura vem só do layout (estilo.css, "com-quadro"): o quadro preenche o que sobra da tela.
  useEffect(() => {
    document.body.classList.add('com-quadro');
    return () => document.body.classList.remove('com-quadro');
  }, []);

  const carregar = useCallback(async (id: string | null, mais = false) => {
    const k = chave(id);
    const g = mais ? geracao.current[k] : (geracao.current[k] = (geracao.current[k] || 0) + 1);
    const atual = listasRef.current[k];
    try {
      const { linhas, total } = await p.current.carregar(id, mais && atual ? atual.itens.length : 0);
      if (geracao.current[k] !== g) return;   // chegou depois de uma recarga mais nova
      if (!mais) linhas.forEach(l => { delete ordens.current[l.id]; });
      setListas(l => ({ ...l, [k]: { itens: mais ? [...(l[k]?.itens || []), ...linhas] : linhas, total } }));
    } catch (e) {
      if (geracao.current[k] !== g) return;
      setListas(l => ({ ...l, [k]: { itens: [], total: 0, erro: (e as Error).message } }));
    }
  }, []);

  // Recarrega tudo quando entram ou saem colunas (criar, ocultar, excluir) ou quando a tela pede.
  const idsVisiveis = visiveis.map(c => c.id).sort().join(',');
  useEffect(() => {
    if (!quadro.pronto) return;
    carregar(null);
    idsVisiveis.split(',').filter(Boolean).forEach(id => carregar(id));
  }, [quadro.pronto, idsVisiveis, props.recarga, carregar]);

  function rolarBordas(x: number) {
    const q = elQuadro.current;
    if (!q) return;
    const r = q.getBoundingClientRect();
    if (x < r.left + 60) q.scrollLeft -= 18;
    else if (x > r.right - 60) q.scrollLeft += 18;
  }

  // ---------- arrastar cartões ----------
  // Cartão antes do qual o arrastado vai entrar (null = no fim da lista).
  function posicao(lista: HTMLElement, y: number) {
    const el = [...lista.querySelectorAll<HTMLElement>('.kcartao:not(.arrastando)')]
      .find(c => y < c.getBoundingClientRect().top + c.offsetHeight / 2);
    return el?.dataset.item ?? null;
  }

  async function soltar(para: string | null) {
    const a = arrasto.current;
    if (!a) return;
    const { item, de } = a;
    const kDe = chave(de), kPara = chave(para);
    const antesId = alvoRef.current?.k === kPara ? alvoRef.current.antes : null;
    setAlvo(null);
    const origem = listasRef.current[kDe], destino = listasRef.current[kPara];
    if (!origem || !destino) return;
    const semItem = origem.itens.filter(x => x.id !== item.id);
    const base = kDe === kPara ? semItem : destino.itens;
    const i = antesId ? base.findIndex(x => x.id === antesId) : -1;
    const lugar = i < 0 ? base.length : i;
    const ant = base[lugar - 1], prox = base[lugar];
    const oa = ant ? ordemDe(ant) : null, op = prox ? ordemDe(prox) : null;
    const numeros = base.map(ordemDe).filter((n): n is number => typeof n === 'number');
    const ordem = oa != null && op != null ? (oa + op) / 2 : oa != null ? oa + 1 : op != null ? op - 1
      : (numeros.length ? Math.max(...numeros) : 0) + 1;
    const ordemAnterior = ordemDe(item);
    const novaLista = [...base.slice(0, lugar), item, ...base.slice(lugar)];
    ordens.current[item.id] = ordem;
    setListas(l => kDe === kPara
      ? { ...l, [kDe]: { ...l[kDe], itens: novaLista } }
      : { ...l, [kDe]: { ...l[kDe], itens: semItem, total: l[kDe].total - 1 }, [kPara]: { ...l[kPara], itens: novaLista, total: l[kPara].total + 1 } });
    try { await p.current.aoMover(item, { de, para, ordem, ordemAnterior }); }
    catch (e) { falha(e); carregar(de); carregar(para); }
  }

  // ---------- arrastar colunas ----------
  // Primeira coluna (das que podem ser movidas) cujo meio está à direita do ponteiro.
  function colunaDepoisDe(x: number) {
    const els = [...elQuadro.current!.querySelectorAll<HTMLElement>('.coluna[data-coluna]:not(.sem-etapa):not(.arrastando-col)')];
    return els.find(el => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2; })?.dataset.coluna ?? 'fim';
  }

  async function criarColuna() {
    const nome = nova.trim().replace(/\s+/g, ' ');
    if (!nome) { campoNova.current?.focus(); return; }
    setCriando(true);
    const ok = await quadro.criar(nome);
    setCriando(false);
    if (ok) {
      setNova('');
      requestAnimationFrame(() => { const q = elQuadro.current; if (q) q.scrollLeft = q.scrollWidth; });
    }
  }

  function coluna(c: Coluna | null) {
    const id = c ? c.id : null, k = chave(id), nome = c ? c.nome : quadro.rotuloSemEtapa;
    const l = listas[k];
    const aqui = alvo?.k === k;
    const reordena = !!c && quadro.podeReordenar;
    return <section className={'coluna' + (c ? '' : ' sem-etapa') + (c && colArrastada === c.id ? ' arrastando-col' : '')} data-coluna={k}>
      <header className="coluna-topo" draggable={reordena || undefined} title={reordena ? 'Arraste para mudar a ordem das colunas' : undefined}
        onDragStart={reordena ? e => {
          if (arrasto.current) return;
          colArrasto.current = c;
          setColArrastada(c!.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', 'coluna:' + c!.id);
        } : undefined}
        onDragEnd={reordena ? () => { colArrasto.current = null; setColArrastada(null); setAntesDeCol(null); } : undefined}>
        <h3 title={nome}>{nome}</h3><span className="coluna-n">{l ? numero(l.total) : '…'}</span>
        {c && <button type="button" className="coluna-menu" aria-label={`Opções da coluna ${nome}`}
          onClick={e => { e.stopPropagation(); const botao = e.currentTarget; setMenu(m => m?.c.id === c.id ? null : { c, botao }); }}>
          <Icone nome="pontos" tam={16} />
        </button>}
      </header>
      <div className="coluna-lista" role="list" aria-label={nome}
        onDragOver={e => {
          if (!arrasto.current) return;
          e.preventDefault();
          const antes = posicao(e.currentTarget, e.clientY);
          if (alvoRef.current?.k !== k || alvoRef.current.antes !== antes) setAlvo({ k, antes });
          rolarBordas(e.clientX);
        }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && alvoRef.current?.k === k) setAlvo(null); }}
        onDrop={e => { e.preventDefault(); if (arrasto.current) soltar(id); }}>
        {!l ? <p className="coluna-vazia">Carregando…</p>
          : l.erro ? <p className="coluna-vazia erro">{l.erro}</p>
          : !l.itens.length && !aqui ? <p className="coluna-vazia">Nenhum item.</p> : null}
        {l?.itens.map(it => <Fragment key={it.id}>
          {aqui && alvo.antes === it.id && <div className="kmarcador" />}
          <article className={'kcartao' + (arrastando === it.id ? ' arrastando' : '')} role="listitem" tabIndex={0} draggable data-item={it.id}
            onClick={() => p.current.aoAbrir(it)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.current.aoAbrir(it); } }}
            onDragStart={e => {
              arrasto.current = { item: it, de: id };
              setArrastando(it.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', it.id);
            }}
            onDragEnd={() => { arrasto.current = null; setArrastando(null); setAlvo(null); }}>
            {props.cartao(it)}
          </article>
        </Fragment>)}
        {aqui && alvo.antes === null && <div className="kmarcador" />}
      </div>
      <footer className="coluna-pe">
        {l && l.itens.length < l.total && <button type="button" className="coluna-carregar" onClick={() => carregar(id, true)}>
          Carregar mais ({numero(l.total - l.itens.length)})
        </button>}
        {props.aoAdicionar && <button type="button" className="coluna-add" onClick={() => props.aoAdicionar!(id)}><Icone nome="mais" tam={15} /> Adicionar</button>}
      </footer>
    </section>;
  }

  if (!quadro.pronto) return <div className="area-quadro"><p className="carregando">Carregando…</p></div>;

  const existentes = new Set(quadro.colunas.map(c => normal(c.nome)));
  return <div className="area-quadro">
    <div className="quadro" role="region" aria-label="Quadro" ref={elQuadro}
      onDragOver={e => {
        if (!colArrasto.current) return;
        e.preventDefault();
        const antes = colunaDepoisDe(e.clientX);
        if (antes !== antesDeColRef.current) setAntesDeCol(antes);
        rolarBordas(e.clientX);
      }}
      onDrop={e => {
        const c = colArrasto.current;
        if (!c) return;
        e.preventDefault();
        const antes = antesDeColRef.current;
        setAntesDeCol(null);
        quadro.posicionar(c, antes && antes !== 'fim' ? quadro.colunas.find(x => x.id === antes) || null : null);
      }}>
      <Fragment key="sem">{coluna(null)}</Fragment>
      {visiveis.map(c => <Fragment key={c.id}>
        {antesDeCol === c.id && <div className="kmarcador-col" />}
        {coluna(c)}
      </Fragment>)}
      {antesDeCol === 'fim' && <div className="kmarcador-col" />}
      <section className="coluna nova-coluna">
        <form className="nova-form" autoComplete="off" onSubmit={e => { e.preventDefault(); criarColuna(); }}>
          <label className="rotulo-caps" htmlFor={idNova}>Nova coluna</label>
          <input id={idNova} ref={campoNova} list={idSugestoes} maxLength={60} placeholder="Nome da coluna" value={nova} onChange={e => setNova(e.target.value)} />
          <datalist id={idSugestoes}>
            {ocultas.map(c => <option key={c.id} value={c.nome}>oculta</option>)}
            {quadro.sugestoes.filter(s => !existentes.has(normal(s))).map(s => <option key={s} value={s} />)}
          </datalist>
          <button type="submit" className="btn pri btn-sm" disabled={criando}>Criar coluna</button>
        </form>
        {ocultas.length > 0 && <div className="ocultas">
          <p className="rotulo-caps">Ocultas para você</p>
          {ocultas.map(c => <button key={c.id} type="button" className="chip-oculta" title="Mostrar de novo" onClick={() => quadro.ocultar(c, false)}>
            <Icone nome="olho" tam={14} /> {c.nome}
          </button>)}
        </div>}
      </section>
    </div>
    {menu && <MenuColuna c={menu.c} botao={menu.botao} quadro={quadro} aoFechar={() => setMenu(null)} />}
  </div>;
}

// ---------- menu da coluna ----------
function MenuColuna({ c, botao, quadro, aoFechar }: { c: Coluna; botao: HTMLElement; quadro: Quadro; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: 0 });
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useLayoutEffect(() => {
    const r = botao.getBoundingClientRect(), m = ref.current!;
    setPos({ top: r.bottom + window.scrollY + 6, left: Math.min(r.left + window.scrollX, window.innerWidth - m.offsetWidth - 12) });
    m.querySelector('button')?.focus();
  }, [botao]);
  useEffect(() => {
    const fora = () => fechar.current();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { fechar.current(); botao.focus(); } };
    const t = setTimeout(() => document.addEventListener('click', fora), 0);
    document.addEventListener('keydown', tecla);
    return () => { clearTimeout(t); document.removeEventListener('click', fora); document.removeEventListener('keydown', tecla); };
  }, [botao]);
  const visiveis = quadro.colunas.filter(x => !x.oculta), i = visiveis.findIndex(x => x.id === c.id);
  const agir = (fn: () => unknown) => () => { fechar.current(); fn(); };
  return createPortal(<div className="kmenu" role="menu" ref={ref} style={pos}>
    {quadro.podeReordenar && i > 0 && <button type="button" role="menuitem" onClick={agir(() => quadro.mover(c, -1))}><Icone nome="voltar" tam={15} /> Mover para a esquerda</button>}
    {quadro.podeReordenar && i < visiveis.length - 1 && <button type="button" role="menuitem" onClick={agir(() => quadro.mover(c, 1))}><Icone nome="seta" tam={15} /> Mover para a direita</button>}
    <button type="button" role="menuitem" onClick={agir(() => quadro.ocultar(c, true))}><Icone nome="oculto" tam={15} /> Ocultar para mim</button>
    {quadro.podeRenomear(c) && <button type="button" role="menuitem" onClick={agir(() => quadro.renomear(c))}><Icone nome="editar" tam={15} /> Renomear</button>}
    {quadro.podeExcluir(c) && <button type="button" role="menuitem" className="perigo" onClick={agir(() => quadro.excluir(c))}><Icone nome="lixeira" tam={15} /> Excluir coluna</button>}
  </div>, document.body);
}
