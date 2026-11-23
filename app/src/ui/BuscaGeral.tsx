// Busca geral (#321): uma janela por cima de qualquer página, no padrão "paleta de comandos", que busca em todos os módulos que a
// pessoa vê de uma vez. Abre pelo botão "Buscar" do menu e pelo atalho Ctrl+K (Cmd+K no Mac); a busca de cada página continua
// como é. É um combobox com a lista de resultados (padrão ARIA): o foco fica no campo, as setas andam pelos resultados, Enter
// abre o cartão (Ctrl+Enter, numa aba nova) e Esc fecha e devolve o foco a quem a abriu.
// As regras (ler o termo, o que mostrar, a ordem e os filtros) ficam em regras/buscaGeral.ts; onde buscar, em ui/fontesDaBuscaGeral.ts.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ANUNCIO_DA_BUSCA, atalhoDaBusca, buscaPronta, enderecoDaLinha, FILTROS_PADRAO, gruposDosModulos, GRUPOS_DA_BUSCA, ehAtalhoDaBusca, LEITURA_DO_TERMO, lerTermo,
  linhaDaOpcao, MODULOS_DA_BUSCA, montarGrupos, opcoesDosGrupos, pelaLinha, PERIODOS_DA_BUSCA, proximaOpcao, situacaoDaBusca, textoDoVerTodos, trechoQueCombina,
  type FiltroDeModulo, type FiltrosDaBusca, type GrupoDaBusca, type GrupoMostrado, type LinhaDaBusca, type ModuloDaBusca, type OpcaoDaBusca, type PeriodoDaBusca,
  type ItemSemAcesso, type PorTipoDaLinha, type SituacaoDaBusca, type TermoDaBusca
} from '../regras/buscaGeral';
import { estadoDoItemSemAcesso, ITEM_SEM_ACESSO } from '../regras/pedidoDeParticipacao';
import { abrirEmNovaAba, cliquesQueAbrem, pedeNovaAba } from './abrirItem';
import { avisar, falha } from './avisos';
import { Botao } from './Botoes';
import { Aviso, Carregando, estiloBotao, Nota, Segmentos, Tecla, Vazio } from './base';
import { abrirBuscaGeral, alternarPedido, buscaGeralAberta, buscarEmTudo, fecharBuscaGeral, type AlternarPedido, type BuscarEmTudo, type ResultadoDaBuscaGeral } from './fontesDaBuscaGeral';
import { Icone, ICONE_DO_MODULO, type NomeIcone } from './Icone';
import { haJanelaAberta } from './janela';
import { travarRolagem } from './rolagem';
import { ehMac, useAtrasado } from './util';
import './BuscaGeral.css';

/** O ícone de cada grupo: o mesmo do módulo no menu (ICONE_DO_MODULO); os grupos de processos (um por tipo), o dos processos. */
const ICONE_DO_GRUPO: Record<GrupoDaBusca, NomeIcone> = {
  ...ICONE_DO_MODULO, judiciais: ICONE_DO_MODULO.processos, administrativos: ICONE_DO_MODULO.processos
};

/**
 * O atalho Ctrl+K (Cmd+K no Mac), em qualquer página: abre a busca; com ela aberta, volta ao campo e seleciona o que está escrito.
 * Com uma janela de pergunta aberta (confirmar, pedir um texto), o atalho espera a resposta. Um menu aberto (os filtros, o "⋯")
 * fecha antes de a busca abrir (abrirBuscaGeral).
 */
function useAtalhoDaBusca() {
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (!ehAtalhoDaBusca(e) || haJanelaAberta()) return;
      e.preventDefault();
      if (!buscaGeralAberta.ler()) { abrirBuscaGeral(); return; }
      document.querySelector<HTMLInputElement>('[data-busca-geral]')?.select();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
}

/** O botão "Buscar" do menu lateral, com o atalho à vista. No celular, só com a lupa, na barra do topo. */
export function BotaoBuscaGeral({ soIcone = false }: { soIcone?: boolean }) {
  const atalho = atalhoDaBusca(ehMac());
  return <button type="button" className={soIcone ? 'busca-geral-lupa' : 'busca-geral-botao'} aria-label="Buscar em todo o SEMPER" aria-keyshortcuts="Control+K Meta+K"
    title={`Buscar em todo o SEMPER (${atalho})`} onClick={e => { e.stopPropagation(); abrirBuscaGeral(); }}>
    <Icone nome="buscar" tam={soIcone ? 18 : 16} />
    {!soIcone && <><span>Buscar</span><Tecla aria-hidden="true">{atalho}</Tecla></>}
  </button>;
}

/**
 * A busca no alto do painel da página inicial (#319): um botão grande com cara de campo, que abre a mesma janela do botão do menu
 * e do Ctrl+K. Não se digita nele: a busca é a da janela.
 */
export function CampoDaBuscaGeral() {
  const atalho = atalhoDaBusca(ehMac());
  return <button type="button" className="busca-do-painel" aria-label="Buscar em todo o SEMPER" aria-keyshortcuts="Control+K Meta+K"
    onClick={e => { e.stopPropagation(); abrirBuscaGeral(); }}>
    <Icone nome="buscar" tam={18} />
    <span>Buscar pessoa, processo, contrato, tarefa…</span>
    <Tecla aria-hidden="true">{atalho}</Tecla>
  </button>;
}

interface Props {
  /** Os módulos em que buscar: os que o escritório tem ligados (modulosLigados, em regras/buscaGeral.ts). */
  modulos: readonly ModuloDaBusca[];
  /** Onde buscar; os testes trocam pela resposta que quiserem. */
  buscar?: BuscarEmTudo;
  /** Pedir para participar de um item, ou cancelar o pedido (#363); os testes trocam. */
  alternar?: AlternarPedido;
  /** O instante do filtro de data; os testes fixam. */
  agora?: () => Date;
}

/** O lugar da busca geral (um só, na casca do app): o atalho vale sempre, e a janela aparece quando aberta. */
export function BuscaGeral(props: Props) {
  const aberta = buscaGeralAberta.usar();
  useAtalhoDaBusca();
  return aberta ? <JanelaDaBusca {...props} /> : null;
}

function JanelaDaBusca({ modulos, buscar = buscarEmTudo, alternar = alternarPedido, agora = () => new Date() }: Props) {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const atrasado = useAtrasado(texto);
  const [filtros, setFiltros] = useState<FiltrosDaBusca>(FILTROS_PADRAO);
  /** A última resposta: o termo, o que veio e quando chegou (o filtro de data conta a partir daí). */
  const [resposta, setResposta] = useState<{ termo: string; resultado: ResultadoDaBuscaGeral; em: Date } | null>(null);
  const [ativa, setAtiva] = useState(-1);
  /** Os pedidos feitos ou cancelados nesta janela (#363), pelo id do item: valem por cima do que a busca trouxe. */
  const [pedidos, setPedidos] = useState<Record<string, string | null>>({});
  const pedindo = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();
  const idLista = `${id}-lista`;
  const idTitulo = `${id}-titulo`;
  const idLeitura = `${id}-leitura`;

  // Quem abriu recebe o foco de volta ao fechar sem abrir nada (Esc, o véu, o botão Fechar). É lido no primeiro desenho, antes
  // de o campo receber o foco (num efeito, o modo estrito do React o leria de novo já com o foco no campo).
  const [anterior] = useState(() => document.activeElement as HTMLElement | null);
  // A página por trás não rola enquanto a janela está aberta. A trava é comum: fechar a busca aberta por cima de um cartão não
  // solta a página por trás do cartão.
  useEffect(() => {
    campo.current?.focus();
    return travarRolagem();
  }, []);
  const fechar = (devolverFoco = true) => {
    fecharBuscaGeral();
    if (devolverFoco) setTimeout(() => anterior?.focus?.(), 0);
  };

  const termo = useMemo(() => lerTermo(atrasado), [atrasado]);
  const pronta = buscaPronta(termo);
  const grupos = useMemo(() => gruposDosModulos(modulos), [modulos]);
  // A busca vai a todos os módulos de uma vez; os filtros só escolhem o que mostrar, então trocar de filtro é na hora.
  const busca = useRef(buscar);
  busca.current = buscar;
  const relogio = useRef(agora);
  relogio.current = agora;
  useEffect(() => {
    if (!pronta) return;
    let vivo = true;
    busca.current(termo.escrito, grupos).then(resultado => { if (vivo) setResposta({ termo: termo.escrito, resultado, em: relogio.current() }); }).catch(falha);
    return () => { vivo = false; };
  }, [pronta, termo, grupos]);

  const atual = pronta && resposta?.termo === termo.escrito ? resposta : null;
  // Logo depois de digitar, a resposta ainda é a da busca anterior: ela continua à vista, e o Enter espera a nova.
  const emDia = !!atual && lerTermo(texto).escrito === termo.escrito;
  const mostrada = pronta ? (atual ?? resposta) : null;
  const termoMostrado = useMemo(() => lerTermo(mostrada?.termo ?? ''), [mostrada]);
  const semAcesso = useMemo(() => (mostrada?.resultado.semAcesso ?? []).map(s => s.id in pedidos ? { ...s, pedido_id: pedidos[s.id] } : s), [mostrada, pedidos]);
  const mostrados = useMemo(() => mostrada ? montarGrupos(mostrada.resultado.buscas, semAcesso, termoMostrado, filtros, mostrada.em) : [],
    [mostrada, semAcesso, termoMostrado, filtros]);
  const opcoes = useMemo(() => opcoesDosGrupos(mostrados), [mostrados]);
  const situacao = situacaoDaBusca({ pronta, respondida: !!atual, linhas: opcoes.length });
  // A cada lista nova, a primeira linha fica escolhida: Enter abre o primeiro resultado. É no mesmo desenho que mostra a lista
  // (num efeito, a lista apareceria um instante sem nenhuma linha escolhida).
  const [opcoesVistas, setOpcoesVistas] = useState<OpcaoDaBusca[]>([]);
  if (opcoes !== opcoesVistas) {
    setOpcoesVistas(opcoes);
    setAtiva(opcoes.length ? 0 : -1);
  }
  useEffect(() => {
    if (ativa < 0) return;
    lista.current?.querySelector(`[id="${CSS.escape(opcoes[ativa]?.id ?? '')}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [ativa, opcoes]);

  /** O botão da linha do item de que a pessoa não faz parte: pede para participar, ou cancela o pedido pendente. */
  async function alternarPedidoDaLinha(item: ItemSemAcesso) {
    if (pedindo.current) return;
    pedindo.current = true;
    try {
      const pedido = await alternar(item);
      setPedidos(p => ({ ...p, [item.id]: pedido }));
      avisar(ITEM_SEM_ACESSO[estadoDoItemSemAcesso(item.pedido_id)].feito);
    } catch (e) { falha(e); }
    finally { pedindo.current = false; }
  }

  function abrir(o: OpcaoDaBusca, novaAba = false) {
    const linha = linhaDaOpcao(o);
    // O item de que a pessoa não faz parte não abre: o Enter faz o que o botão da linha faz.
    if (linha.tipo === 'semAcesso') { void alternarPedidoDaLinha(linha); return; }
    const para = enderecoDaLinha(linha, termoMostrado.escrito);
    if (!para) return;
    if (novaAba) { abrirEmNovaAba(para); return; }
    fechar(false);
    navegar(para);
  }

  /** As teclas do campo. As setas andam pela lista sem tirar o foco do campo (aria-activedescendant). */
  const TECLAS: Record<string, (e: KeyboardEvent<HTMLInputElement>) => void> = {
    ArrowDown: () => setAtiva(a => proximaOpcao(a, opcoes.length, 1)),
    ArrowUp: () => setAtiva(a => proximaOpcao(a, opcoes.length, -1)),
    Enter: e => { if (emDia && opcoes[ativa]) abrir(opcoes[ativa], pedeNovaAba(e)); }
  };
  const leitura = LEITURA_DO_TERMO[lerTermo(texto).forma](lerTermo(texto));
  const filtrosLigados = filtros.modulo !== FILTROS_PADRAO.modulo || filtros.periodo !== FILTROS_PADRAO.periodo;
  const ativaId = opcoes[ativa]?.id;

  return <div className="veu-janela veu-busca-geral" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}
    onKeyDown={e => {
      // Esc fecha só a busca, sem fechar o cartão que estiver aberto embaixo dela.
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    }}>
    <div className="busca-geral" role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="sr">Buscar em todo o SEMPER</h2>
      <div className="busca-geral-campo">
        <Icone nome="buscar" tam={20} />
        <input ref={campo} data-busca-geral type="text" role="combobox" aria-label="Buscar em todo o SEMPER" aria-expanded={opcoes.length > 0}
          aria-controls={idLista} aria-autocomplete="list" aria-activedescendant={ativaId} aria-describedby={leitura ? idLeitura : undefined}
          placeholder="Nome, CPF ou CNPJ, número de processo ou código" autoComplete="off" spellCheck={false} value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { const acao = TECLAS[e.key]; if (acao) { e.preventDefault(); acao(e); } }} />
        {/* O filtro de data fica na linha do campo: a dos módulos precisa da largura toda. */}
        <label className="busca-geral-periodo"><span>Criado</span>
          <select className="filtro" value={filtros.periodo} onChange={e => setFiltros(f => ({ ...f, periodo: e.target.value as PeriodoDaBusca }))}>
            {(Object.keys(PERIODOS_DA_BUSCA) as PeriodoDaBusca[]).map(p => <option key={p} value={p}>{PERIODOS_DA_BUSCA[p].rotulo}</option>)}
          </select>
        </label>
        <button type="button" className="busca-geral-fechar" onClick={() => fechar()} aria-label="Fechar a busca" title="Fechar (Esc)">
          <Tecla aria-hidden="true">Esc</Tecla><span className="icone-de-toque" aria-hidden="true"><Icone nome="fechar" tam={18} /></span>
        </button>
      </div>
      {leitura && <p className="busca-geral-leitura" id={idLeitura}>{leitura}</p>}
      <div className="busca-geral-filtros">
        <Segmentos<FiltroDeModulo> rotulo="Módulo" atual={filtros.modulo} aoEscolher={modulo => setFiltros(f => ({ ...f, modulo }))}
          opcoes={[{ id: 'todos', rotulo: 'Tudo' }, ...modulos.map(m => ({ id: m, rotulo: MODULOS_DA_BUSCA[m].rotulo }))]} />
      </div>
      <p className="sr" role="status">{ANUNCIO_DA_BUSCA[situacao](mostrados, !!atual)}</p>
      <div className="busca-geral-corpo" aria-busy={pronta && !atual}>
        <div ref={lista} id={idLista} role="listbox" aria-label="Resultados" hidden={!opcoes.length}>
          {mostrados.map(g => <Grupo key={g.grupo} g={g} opcoes={opcoes} ativaId={ativaId} termo={termoMostrado} periodo={filtros.periodo}
            aoApontar={o => setAtiva(opcoes.indexOf(o))} aoAbrir={abrir} aoAlternar={alternarPedidoDaLinha} />)}
        </div>
        {SITUACAO[situacao]({ termo: termo.escrito, filtrosLigados, limparFiltros: () => setFiltros(FILTROS_PADRAO) })}
        {!!atual?.resultado.falhas.length && <Aviso tipo="erro" className="busca-geral-falha">
          Não foi possível buscar agora em {atual.resultado.falhas.map(g => GRUPOS_DA_BUSCA[g].titulo).join(', ')}. Tente de novo em instantes.
        </Aviso>}
      </div>
      <p className="busca-geral-rodape" aria-hidden="true">
        <span><Tecla><Icone nome="acima" tam={12} /></Tecla><Tecla><Icone nome="abaixo" tam={12} /></Tecla> andar</span>
        <span><Tecla>Enter</Tecla> abrir</span>
        <span><Tecla>{ehMac() ? '⌘' : 'Ctrl'}</Tecla><Tecla>Enter</Tecla> abrir em nova aba</span>
        <span><Tecla>Esc</Tecla> fechar</span>
      </p>
    </div>
  </div>;
}

interface PropsGrupo {
  g: GrupoMostrado;
  opcoes: OpcaoDaBusca[];
  ativaId: string | undefined;
  termo: TermoDaBusca;
  periodo: PeriodoDaBusca;
  aoApontar: (o: OpcaoDaBusca) => void;
  aoAbrir: (o: OpcaoDaBusca, novaAba?: boolean) => void;
  aoAlternar: (item: ItemSemAcesso) => Promise<void>;
}
function Grupo({ g, opcoes, ativaId, termo, periodo, aoApontar, aoAbrir, aoAlternar }: PropsGrupo) {
  const idTitulo = useId();
  const doGrupo = opcoes.filter(o => o.grupo === g.grupo);
  return <div role="group" aria-labelledby={idTitulo} className="busca-geral-grupo">
    <div role="presentation" id={idTitulo} className="busca-geral-grupo-titulo">{GRUPOS_DA_BUSCA[g.grupo].titulo}</div>
    {doGrupo.map(o => {
      const linha = linhaDaOpcao(o);
      return <Linha key={o.id} id={o.id} linha={linha} para={enderecoDaLinha(linha, termo.escrito)} ativa={o.id === ativaId}
        aoApontar={() => aoApontar(o)} aoAbrir={() => aoAbrir(o)}>
        {pelaLinha(CONTEUDO_DA_LINHA, linha, { g, termo, periodo, aoAlternar })}
      </Linha>;
    })}
  </div>;
}

/** O que a linha mostra, de cada tipo de linha. */
interface ContextoDaLinha { g: GrupoMostrado; termo: TermoDaBusca; periodo: PeriodoDaBusca; aoAlternar: (item: ItemSemAcesso) => Promise<void> }
const CONTEUDO_DA_LINHA: PorTipoDaLinha<[ContextoDaLinha], ReactNode> = {
  verTodos: (_l, { g, periodo }) => <><span className="busca-geral-icone"><Icone nome="seta" tam={16} /></span>
    <span className="busca-geral-texto"><span className="busca-geral-titulo">Ver todos em {GRUPOS_DA_BUSCA[g.grupo].pagina}</span>
      <span className="busca-geral-meta">{textoDoVerTodos(g.total, periodo)}</span></span></>,
  achado: (item, { g, termo }) => <><span className="busca-geral-icone"><Icone nome={ICONE_DO_GRUPO[g.grupo]} tam={16} /></span>
    <span className="busca-geral-texto">
      <span className="busca-geral-titulo"><Realce texto={item.titulo} termo={termo} /></span>
      <span className="busca-geral-meta"><span>{GRUPOS_DA_BUSCA[g.grupo].tipo}</span><span className="busca-geral-codigo">{item.codigo}</span>
        {item.contexto && <span className="busca-geral-contexto">{item.contexto}</span>}</span>
    </span></>,
  // #363: o item existe, mas a pessoa não faz parte dele: só o tipo e o código, e o botão de pedir (ou de cancelar o pedido). O botão
  // não recebe o foco (ele fica no campo, como em toda a lista): o Enter na linha faz o mesmo.
  semAcesso: (item, { g, aoAlternar }) => {
    const tipo = GRUPOS_DA_BUSCA[g.grupo].tipo, estado = ITEM_SEM_ACESSO[estadoDoItemSemAcesso(item.pedido_id)];
    return <><span className="busca-geral-icone"><Icone nome="cadeado" tam={16} /></span>
      <span className="busca-geral-texto">
        <span className="busca-geral-titulo">{tipo} <span className="busca-geral-codigo">{item.codigo}</span></span>
        <span className="busca-geral-meta">{estado.meta}</span>
      </span>
      <Botao forma="mini" tabIndex={-1} className="busca-geral-pedir" aria-label={estado.rotulo(tipo, item.codigo)} onClick={() => aoAlternar(item)}>{estado.botao}</Botao></>;
  }
};

interface PropsLinha {
  id: string;
  linha: LinhaDaBusca;
  /** Para onde a linha leva; sem endereço (o item de que a pessoa não faz parte), ela não abre. */
  para: string | null;
  ativa: boolean;
  aoApontar: () => void;
  aoAbrir: () => void;
  children: ReactNode;
}
/**
 * Uma linha da lista. Abre como os itens das listas dos módulos (cliquesQueAbrem, em ui/abrirItem.tsx): o clique abre aqui,
 * Ctrl+clique (Cmd no Mac) e a rodinha abrem numa aba nova. Nenhum clique tira o foco do campo.
 */
function Linha({ id, linha, para, ativa, aoApontar, aoAbrir, children }: PropsLinha) {
  return <div id={id} role="option" aria-selected={ativa} aria-disabled={(!para && linha.tipo !== 'semAcesso') || undefined}
    className={'busca-geral-linha' + (linha.tipo === 'verTodos' ? ' ver-todos' : '')}
    onMouseMove={() => { if (!ativa) aoApontar(); }} {...(para ? cliquesQueAbrem(para, aoAbrir) : {})} onMouseDown={e => e.preventDefault()}>
    {children}
  </div>;
}

/** O título com o trecho que combina com o texto digitado em destaque. */
function Realce({ texto, termo }: { texto: string; termo: TermoDaBusca }) {
  const partes = trechoQueCombina(texto, termo);
  if (!partes) return <>{texto}</>;
  return <>{partes[0]}<mark>{partes[1]}</mark>{partes[2]}</>;
}

interface PropsSituacao { termo: string; filtrosLigados: boolean; limparFiltros: () => void }
/** O que a janela diz quando não há resultados para mostrar: antes de digitar, buscando e quando nada foi achado. */
const SITUACAO: Record<SituacaoDaBusca, (p: PropsSituacao) => ReactNode> = {
  antes: () => <div className="busca-geral-situacao">
    <p>Busque em todo o SEMPER de uma vez: pessoas, processos, contratos, demandas, tarefas, compromissos e anotações.</p>
    <Nota>CPF, CNPJ e número de processo podem ir com ou sem pontuação. O código de qualquer item (como o de uma tarefa) acha o item direto.</Nota>
  </div>,
  buscando: () => <div className="busca-geral-situacao"><Carregando>Buscando…</Carregando></div>,
  nada: ({ termo, filtrosLigados, limparFiltros }) => <div className="busca-geral-situacao"><Vazio>
    <p>Nada encontrado para <b>“{termo}”</b>{filtrosLigados ? ' com estes filtros' : ''}.</p>
    {filtrosLigados
      ? <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={limparFiltros}>Limpar os filtros</button>
      : <Nota>Confira a grafia ou os números, ou tente só uma parte do nome. Só aparecem os itens ativos a que você tem acesso.</Nota>}
  </Vazio></div>,
  resultados: () => null
};
