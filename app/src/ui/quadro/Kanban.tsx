// Quadro kanban comum a todos os módulos, no modelo do Trello: as colunas ocupam a altura da tela
// e cada lista rola dentro da própria coluna. As colunas vêm de useColunas(); o módulo só diz como
// carregar, desenhar e mover os cartões. Cada coluna tem a sua ordem (manual, data ou nome), escolhida
// no menu da coluna. Com "arquivados", a última coluna é a fixa "Arquivados" (ui/quadro/arquivo.ts).
import { Fragment, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Coluna, Ordem, Pagina } from '../../dados';
import { cliquesQueAbrem } from '../abrirItem';
import { CampoComSugestoes } from '../CampoComSugestoes';
import { Icone } from '../Icone';
import { MenuFlutuante } from '../Menu';
import { falha } from '../avisos';
import { ORDENS, ORDENS_DO_QUADRO } from '../ordem';
import { TAMANHO_COLUNA } from '../../dados/limites';
import { MARCOS } from '../../regras/quadro';
import { normal } from '../../regras/texto';
import { ARQUIVADOS, ROTULO_ARQUIVADOS } from './arquivo';
import { ordemNoFim } from './posicao';
import { Carregando, estiloBotao } from '../base';
import { numero } from '../util';
import type { Quadro } from './useColunas';

export interface Movimento { de: string | null; para: string | null; ordem: number; ordemAnterior: number | null }

interface Props<T extends { id: string }> {
  quadro: Quadro;
  /** Cartões de uma coluna (null = "Sem etapa"), a partir de "deslocamento", na ordem escolhida para ela. */
  carregar: (colunaId: string | null, deslocamento: number, ordem: Ordem) => Promise<Pagina<T>>;
  /** Mude este valor para recarregar todas as colunas (filtros novos, dados que mudaram). */
  recarga: string | number;
  ordemDe: (item: T) => number | null;
  /** Conteúdo do cartão; "ordem" é a da coluna dele (para mostrar a data quando a ordem é por data). */
  cartao: (item: T, ordem: Ordem) => ReactNode;
  /** Endereço que abre o cartão do item: Ctrl+clique e a rodinha do mouse o abrem numa aba nova. */
  endereco: (item: T) => string;
  aoAbrir: (item: T) => void;
  aoMover: (item: T, m: Movimento) => Promise<void>;
  /** Botão "Adicionar" no pé de cada coluna. */
  aoAdicionar?: (colunaId: string | null) => void;
  /**
   * Itens arquivados, a partir de "deslocamento" (os mais recentes primeiro): com isto, o quadro mostra a coluna fixa
   * "Arquivados" no fim. Os movimentos que entram ou saem dela chegam a aoMover com ARQUIVADOS em "para" ou "de".
   */
  arquivados?: (deslocamento: number) => Promise<Pagina<T>>;
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
  const [menu, setMenu] = useState<{ c: Coluna | null; k: string; botao: HTMLElement } | null>(null);
  const [nova, setNova] = useState('');
  const [criando, setCriando] = useState(false);
  const campoNova = useRef<HTMLInputElement>(null);
  const idNova = useId();

  const visiveis = quadro.colunas.filter(c => !c.oculta);
  const ocultas = quadro.colunas.filter(c => c.oculta);
  // Fora da ordem manual, o cartão ainda muda de coluna, mas entra no lugar que a ordem da coluna
  // define, e não dá para mudar a posição dentro dela.
  const manualEm = (id: string | null) => id !== ARQUIVADOS && p.current.quadro.ordemDe(id) === 'manual';

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
      const deslocamento = mais && atual ? atual.itens.length : 0;
      const { linhas, total } = id === ARQUIVADOS ? await p.current.arquivados!(deslocamento)
        : await p.current.carregar(id, deslocamento, p.current.quadro.ordemDe(id));
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
    void carregar(null);
    idsVisiveis.split(',').filter(Boolean).forEach(id => carregar(id));
    if (p.current.arquivados) void carregar(ARQUIVADOS);
  }, [quadro.pronto, idsVisiveis, props.recarga, carregar]);

  // Coluna que mudou de ordem é relida sozinha.
  const ordensVistas = useRef<Record<string, Ordem>>({});
  useEffect(() => {
    if (!quadro.pronto) return;
    for (const id of [null, ...visiveis.map(c => c.id)]) {
      const k = chave(id), o = quadro.ordemDe(id);
      if (ordensVistas.current[k] && ordensVistas.current[k] !== o) void carregar(id);
      ordensVistas.current[k] = o;
    }
  });

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
    // O arrastar termina aqui: ao mudar de coluna, o cartão de origem sai da tela e o aviso de fim
    // do navegador (dragend) não chega mais; sem isto, o cartão ficaria marcado como "arrastando".
    arrasto.current = null;
    setArrastando(null);
    setAlvo(null);
    const origem = listasRef.current[kDe], destino = listasRef.current[kPara];
    if (!origem || !destino) return;
    const semItem = origem.itens.filter(x => x.id !== item.id);
    if (!manualEm(para)) {
      if (kDe === kPara) return;
      // Vai para o fim da ordem manual; na tela, entra onde a ordem escolhida mandar (a coluna é relida).
      const ordemAnterior = ordemDe(item), ordem = ordemNoFim();
      ordens.current[item.id] = ordem;
      setListas(l => ({ ...l, [kDe]: { ...l[kDe], itens: semItem, total: l[kDe].total - 1 }, [kPara]: { ...l[kPara], itens: [item, ...l[kPara].itens], total: l[kPara].total + 1 } }));
      try { await p.current.aoMover(item, { de, para, ordem, ordemAnterior }); void carregar(para); }
      catch (e) { falha(e); void carregar(de); void carregar(para); }
      return;
    }
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
    catch (e) { falha(e); void carregar(de); void carregar(para); }
  }

  // ---------- arrastar colunas ----------
  // Primeira coluna (das que podem ser movidas) cujo meio está à direita do ponteiro.
  function colunaDepoisDe(x: number) {
    const els = [...elQuadro.current!.querySelectorAll<HTMLElement>('.coluna[data-coluna]:not(.sem-etapa):not(.coluna-arquivados):not(.arrastando-col)')];
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

  // A coluna Arquivados é fixa: não se move, não tem menu nem "Adicionar", e mostra os mais recentes primeiro.
  function coluna(c: Coluna | null, arquivo = false) {
    const id = arquivo ? ARQUIVADOS : c ? c.id : null, k = chave(id), nome = arquivo ? ROTULO_ARQUIVADOS : c ? c.nome : quadro.rotuloSemEtapa;
    const l = listas[k];
    const aqui = alvo?.k === k;
    const reordena = !!c && quadro.podeReordenar;
    const ordem: Ordem = arquivo ? 'recentes' : quadro.ordemDe(id), manual = ordem === 'manual';
    const marcador = aqui && manual;
    const marco = c?.marco ? MARCOS[c.marco] : null;
    return <section className={'coluna' + (arquivo ? ' coluna-arquivados' : c ? '' : ' sem-etapa') + (marco ? ' coluna-marco' : '') + (c && colArrastada === c.id ? ' arrastando-col' : '') + (aqui && !manual ? ' recebendo' : '')} data-coluna={k}>
      <header className="coluna-topo" draggable={reordena || undefined} title={reordena ? 'Arraste para mudar a ordem das colunas' : undefined}
        onDragStart={reordena ? e => {
          if (arrasto.current) return;
          colArrasto.current = c;
          setColArrastada(c!.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', 'coluna:' + c!.id);
        } : undefined}
        onDragEnd={reordena ? () => { colArrasto.current = null; setColArrastada(null); setAntesDeCol(null); } : undefined}>
        <h3 title={marco ? `${nome}: ${marco.explicacao}` : nome}>{nome}</h3>
        {marco && <span className="coluna-marco-selo" title={marco.explicacao} aria-label={`Coluna-marco: ${marco.rotulo}`}><Icone nome="check" tam={13} /></span>}
        {arquivo && <span className="coluna-marco-selo" title="Arraste um cartão para cá para arquivar; arraste daqui para outra coluna para desarquivar." aria-hidden="true"><Icone nome="arquivo" tam={13} /></span>}
        <span className="coluna-n">{l ? numero(l.total) : '…'}</span>
        {!arquivo && <button type="button" className="coluna-menu" aria-label={`Opções da coluna ${nome}`}
          onClick={e => { e.stopPropagation(); const botao = e.currentTarget; setMenu(m => m?.k === k ? null : { c, k, botao }); }}>
          <Icone nome="pontos" tam={16} />
        </button>}
      </header>
      {!manual && !arquivo && <p className="coluna-ordem" title="Ordem desta lista (muda no menu da coluna)">{ORDENS[ordem]}</p>}
      <div className="coluna-lista" role="list" aria-label={nome}
        onDragOver={e => {
          if (!arrasto.current) return;
          if (!manual && chave(arrasto.current.de) === k) return;
          e.preventDefault();
          const antes = manual ? posicao(e.currentTarget, e.clientY) : null;
          if (alvoRef.current?.k !== k || alvoRef.current.antes !== antes) setAlvo({ k, antes });
          rolarBordas(e.clientX);
        }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && alvoRef.current?.k === k) setAlvo(null); }}
        onDrop={e => { e.preventDefault(); if (arrasto.current) void soltar(id); }}>
        {!l ? <p className="coluna-vazia">Carregando…</p>
          : l.erro ? <p className="coluna-vazia erro">{l.erro}</p>
          : !l.itens.length && !marcador ? <p className="coluna-vazia">Nenhum item.</p> : null}
        {l?.itens.map(it => <Fragment key={it.id}>
          {marcador && alvo.antes === it.id && <div className="kmarcador" />}
          <article className={'kcartao' + (arrastando === it.id ? ' arrastando' : '')} role="listitem" tabIndex={0} draggable data-item={it.id}
            {...cliquesQueAbrem(props.endereco(it), () => p.current.aoAbrir(it))}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.current.aoAbrir(it); } }}
            onDragStart={e => {
              arrasto.current = { item: it, de: id };
              setArrastando(it.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', it.id);
            }}
            onDragEnd={() => { arrasto.current = null; setArrastando(null); setAlvo(null); }}>
            {props.cartao(it, ordem)}
          </article>
        </Fragment>)}
        {marcador && alvo.antes === null && <div className="kmarcador" />}
      </div>
      <footer className="coluna-pe">
        {l && l.itens.length < l.total && <button type="button" className="coluna-carregar" onClick={() => carregar(id, true)}>
          Carregar mais ({numero(l.total - l.itens.length)})
        </button>}
        {props.aoAdicionar && !arquivo && <button type="button" className="coluna-add" onClick={() => props.aoAdicionar!(id)}><Icone nome="mais" tam={15} /> Adicionar</button>}
      </footer>
    </section>;
  }

  if (!quadro.pronto) return <div className="area-quadro"><Carregando /></div>;

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
        colArrasto.current = null;
        setColArrastada(null);
        setAntesDeCol(null);
        void quadro.posicionar(c, antes && antes !== 'fim' ? quadro.colunas.find(x => x.id === antes) || null : null);
      }}>
      <Fragment key="sem">{coluna(null)}</Fragment>
      {visiveis.map(c => <Fragment key={c.id}>
        {antesDeCol === c.id && <div className="kmarcador-col" />}
        {coluna(c)}
      </Fragment>)}
      {antesDeCol === 'fim' && <div className="kmarcador-col" />}
      {props.arquivados && <Fragment key="arquivados">{coluna(null, true)}</Fragment>}
      <section className="coluna nova-coluna">
        <form className="nova-form" autoComplete="off" onSubmit={e => { e.preventDefault(); void criarColuna(); }}>
          <label className="rotulo-caps" htmlFor={idNova}>Nova coluna</label>
          <CampoComSugestoes id={idNova} ref={campoNova} maxLength={TAMANHO_COLUNA} placeholder="Nome da coluna" valor={nova} aoMudar={setNova}
            sugestoes={[...ocultas.map(c => ({ valor: c.nome, detalhe: 'oculta' })), ...quadro.sugestoes.filter(s => !existentes.has(normal(s))).map(valor => ({ valor }))]} />
          <button type="submit" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={criando}>Criar coluna</button>
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
function MenuColuna({ c, botao, quadro, aoFechar }: { c: Coluna | null; botao: HTMLElement; quadro: Quadro; aoFechar: () => void }) {
  const visiveis = quadro.colunas.filter(x => !x.oculta), i = c ? visiveis.findIndex(x => x.id === c.id) : -1;
  const agir = (fn: () => unknown) => () => { aoFechar(); fn(); };
  const atual = quadro.ordemDe(c ? c.id : null);
  return <MenuFlutuante botao={botao} aoFechar={aoFechar}>
    <p className="rotulo-caps kmenu-titulo">Ordenar esta lista</p>
    {ORDENS_DO_QUADRO.map(o => <button key={o} type="button" role="menuitemradio" aria-checked={o === atual}
      onClick={agir(() => quadro.ordenar(c ? c.id : null, o))}>
      <span className="kmenu-marca">{o === atual && <Icone nome="check" tam={15} />}</span>{ORDENS[o]}
    </button>)}
    {c && <>
    <hr className="kmenu-divisoria" />
    {c.marco && <p className="kmenu-nota">{MARCOS[c.marco].explicacao}</p>}
    {quadro.podeReordenar && i > 0 && <button type="button" role="menuitem" onClick={agir(() => quadro.mover(c, -1))}><Icone nome="voltar" tam={15} /> Mover para a esquerda</button>}
    {quadro.podeReordenar && i < visiveis.length - 1 && <button type="button" role="menuitem" onClick={agir(() => quadro.mover(c, 1))}><Icone nome="seta" tam={15} /> Mover para a direita</button>}
    <button type="button" role="menuitem" onClick={agir(() => quadro.ocultar(c, true))}><Icone nome="oculto" tam={15} /> Ocultar para mim</button>
    {quadro.podeRenomear(c) && <button type="button" role="menuitem" onClick={agir(() => quadro.renomear(c))}><Icone nome="editar" tam={15} /> Renomear</button>}
    {quadro.podeExcluir(c) && <button type="button" role="menuitem" className="perigo" onClick={agir(() => quadro.excluir(c))}><Icone nome="lixeira" tam={15} /> Excluir coluna</button>}
    </>}
  </MenuFlutuante>;
}
