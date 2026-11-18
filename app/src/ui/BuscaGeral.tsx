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
  type PorTipoDaLinha, type SituacaoDaBusca, type TermoDaBusca
} from '../regras/buscaGeral';
import { abrirEmNovaAba, cliquesQueAbrem, pedeNovaAba } from './abrirItem';
import { falha } from './avisos';
import { Aviso, Carregando, estiloBotao, Nota, Segmentos, Vazio } from './base';
import { abrirBuscaGeral, buscaGeralAberta, buscarEmTudo, fecharBuscaGeral, type BuscarEmTudo, type ResultadoDaBuscaGeral } from './fontesDaBuscaGeral';
import { Icone, type NomeIcone } from './Icone';
import { haJanelaAberta } from './janela';
import { travarRolagem } from './rolagem';
import { useAtrasado } from './util';
import './BuscaGeral.css';

/** O ícone de cada grupo: o mesmo do módulo no menu. */
const ICONE_DO_GRUPO: Record<GrupoDaBusca, NomeIcone> = {
  pessoas: 'pessoas', judiciais: 'processos', administrativos: 'processos', contratos: 'contratos', demandas: 'demandas', tarefas: 'tarefas',
  compromissos: 'calendario', anotacoes: 'documentos'
};
/** O aparelho é um Mac (ou iPhone, iPad): o atalho é com Cmd, e a dica mostra ⌘. */
const ehMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

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
    {!soIcone && <><span>Buscar</span><kbd aria-hidden="true">{atalho}</kbd></>}
  </button>;
}

interface Props {
  /** Os módulos em que buscar: os que o escritório tem ligados (modulosLigados, em regras/buscaGeral.ts). */
  modulos: readonly ModuloDaBusca[];
  /** Onde buscar; os testes trocam pela resposta que quiserem. */
  buscar?: BuscarEmTudo;
  /** O instante do filtro de data; os testes fixam. */
  agora?: () => Date;
}

/** O lugar da busca geral (um só, na casca do app): o atalho vale sempre, e a janela aparece quando aberta. */
export function BuscaGeral(props: Props) {
  const aberta = buscaGeralAberta.usar();
  useAtalhoDaBusca();
  return aberta ? <JanelaDaBusca {...props} /> : null;
}

function JanelaDaBusca({ modulos, buscar = buscarEmTudo, agora = () => new Date() }: Props) {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const atrasado = useAtrasado(texto);
  const [filtros, setFiltros] = useState<FiltrosDaBusca>(FILTROS_PADRAO);
  /** A última resposta: o termo, o que veio e quando chegou (o filtro de data conta a partir daí). */
  const [resposta, setResposta] = useState<{ termo: string; resultado: ResultadoDaBuscaGeral; em: Date } | null>(null);
  const [ativa, setAtiva] = useState(-1);
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
  const mostrados = useMemo(() => mostrada ? montarGrupos(mostrada.resultado.buscas, mostrada.resultado.semAcesso, termoMostrado, filtros, mostrada.em) : [],
    [mostrada, termoMostrado, filtros]);
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

  function abrir(o: OpcaoDaBusca, novaAba = false) {
    const para = enderecoDaLinha(linhaDaOpcao(o), termoMostrado.escrito);
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
          <kbd aria-hidden="true">Esc</kbd><span className="icone-de-toque" aria-hidden="true"><Icone nome="fechar" tam={18} /></span>
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
            aoApontar={o => setAtiva(opcoes.indexOf(o))} aoAbrir={abrir} />)}
        </div>
        {SITUACAO[situacao]({ termo: termo.escrito, filtrosLigados, limparFiltros: () => setFiltros(FILTROS_PADRAO) })}
        {!!atual?.resultado.falhas.length && <Aviso tipo="erro" className="busca-geral-falha">
          Não foi possível buscar agora em {atual.resultado.falhas.map(g => GRUPOS_DA_BUSCA[g].titulo).join(', ')}. Tente de novo em instantes.
        </Aviso>}
      </div>
      <p className="busca-geral-rodape" aria-hidden="true">
        <span><kbd><Icone nome="acima" tam={12} /></kbd><kbd><Icone nome="abaixo" tam={12} /></kbd> andar</span>
        <span><kbd>Enter</kbd> abrir</span>
        <span><kbd>{ehMac() ? '⌘' : 'Ctrl'}</kbd><kbd>Enter</kbd> abrir em nova aba</span>
        <span><kbd>Esc</kbd> fechar</span>
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
}
function Grupo({ g, opcoes, ativaId, termo, periodo, aoApontar, aoAbrir }: PropsGrupo) {
  const idTitulo = useId();
  const doGrupo = opcoes.filter(o => o.grupo === g.grupo);
  return <div role="group" aria-labelledby={idTitulo} className="busca-geral-grupo">
    <div role="presentation" id={idTitulo} className="busca-geral-grupo-titulo">{GRUPOS_DA_BUSCA[g.grupo].titulo}</div>
    {doGrupo.map(o => {
      const linha = linhaDaOpcao(o);
      return <Linha key={o.id} id={o.id} linha={linha} para={enderecoDaLinha(linha, termo.escrito)} ativa={o.id === ativaId}
        aoApontar={() => aoApontar(o)} aoAbrir={() => aoAbrir(o)}>
        {pelaLinha(CONTEUDO_DA_LINHA, linha, { g, termo, periodo })}
      </Linha>;
    })}
  </div>;
}

/** O que a linha mostra, de cada tipo de linha. */
const CONTEUDO_DA_LINHA: PorTipoDaLinha<[{ g: GrupoMostrado; termo: TermoDaBusca; periodo: PeriodoDaBusca }], ReactNode> = {
  verTodos: (_l, { g, periodo }) => <><span className="busca-geral-icone"><Icone nome="seta" tam={16} /></span>
    <span className="busca-geral-texto"><span className="busca-geral-titulo">Ver todos em {GRUPOS_DA_BUSCA[g.grupo].pagina}</span>
      <span className="busca-geral-meta">{textoDoVerTodos(g.total, periodo)}</span></span></>,
  achado: (item, { g, termo }) => <><span className="busca-geral-icone"><Icone nome={ICONE_DO_GRUPO[g.grupo]} tam={16} /></span>
    <span className="busca-geral-texto">
      <span className="busca-geral-titulo"><Realce texto={item.titulo} termo={termo} /></span>
      <span className="busca-geral-meta"><span>{GRUPOS_DA_BUSCA[g.grupo].tipo}</span><span className="busca-geral-codigo">{item.codigo}</span>
        {item.contexto && <span className="busca-geral-contexto">{item.contexto}</span>}</span>
    </span></>,
  // #363: o item existe, mas a pessoa não faz parte dele: só o tipo e o código (o botão "Pedir para participar" vem com a #363).
  semAcesso: (item, { g }) => <><span className="busca-geral-icone"><Icone nome="cadeado" tam={16} /></span>
    <span className="busca-geral-texto">
      <span className="busca-geral-titulo">{GRUPOS_DA_BUSCA[g.grupo].tipo} <span className="busca-geral-codigo">{item.codigo}</span></span>
      <span className="busca-geral-meta">Você não faz parte deste item.</span>
    </span></>
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
  return <div id={id} role="option" aria-selected={ativa} aria-disabled={!para || undefined}
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
