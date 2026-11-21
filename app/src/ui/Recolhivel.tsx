// Seção que recolhe e expande (cartões de pessoa, contrato, demanda...). O conteúdo só é montado
// quando aberto: nada é consultado no banco enquanto a seção está fechada.
// Toda seção começa recolhida. Com "preferencia", a escolha de cada usuário (aberta ou fechada) fica guardada e vale
// na próxima vez. Toda seção tem ícone.
// Dentro de um grupo (<GrupoDeSecoes>, que o painel do cartão põe em volta do conteúdo), cada seção se inscreve, e a
// primeira mostra, logo acima dela e à direita, o botão "Expandir tudo" (ou "Recolher tudo", se já estão todas abertas),
// só com o ícone das duas setas, que abre ou fecha todas de uma vez, sem mudar a escolha guardada de cada uma. Ele fica sempre
// sozinho acima da primeira seção, à direita, no eixo das setas (#394); na coluna da direita do centro largo, o estilo o leva para a
// linha dos botões da janela (#397), mas ele continua ali na ordem do Tab, logo antes das seções que abre. Como cada cartão tem dois
// (o da esquerda e o da coluna), o grupo pode dar ao nome dele o alcance ("Expandir tudo da coluna da direita", veja
// ui/PainelCartao.tsx); a dica continua curta. O alcance não repete os títulos das seções: quem procura "Histórico de alterações"
// acha a seção, e não também o botão.
// O "+" do título leva ao cadastro de outro módulo (um endereço) ou, desde a #390, pede à própria seção o formulário ou o menu do
// item novo (Novo prazo, Adicionar checklist…): abre a seção, se estiver fechada, sem mudar a escolha guardada, e quem está dentro
// atende o pedido com usePedidoDeNovo, com o estado no mesmo lugar de sempre. Com `atalho` (#351), o mesmo "+" vira também um botão
// rápido do cartão (AtalhosDoCartao), que faz o que ele faz: abre a seção e o formulário ou o menu do item novo, preso ao botão.
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TipoDeAtalho } from '../regras/atalhosDoCartao';
import { BotaoLink, Contador, estiloBotao, propsDaDica } from './base';
import { Icone, ICONE_DO_MINI, ICONE_DO_TITULO_DE_SECAO, ICONE_DO_TOPO, type NomeIcone } from './Icone';
import { useNovoNoCartao, type NovoLigado } from './ItensLigados';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { useAtalhoDoCartao } from './registroDeAtalhos';

/** O tamanho da seta na ponta direita do título da seção: o mesmo de --seta-da-secao (estilo.css), em cujo meio fica o do "Expandir tudo" (#381). */
const TAMANHO_DA_SETA = 16;

/** A inscrição, que não muda enquanto o painel está aberto (a seção se inscreve uma vez e mantém a ordem). */
interface Inscricao {
  inscrever: (id: string, definir: (aberta: boolean) => void) => () => void;
  mudou: (id: string, aberta: boolean) => void;
}
/** O que o botão precisa: qual seção é a primeira, o alcance (no nome dele), se estão todas abertas e como abrir ou fechar todas. */
interface EstadoDoGrupo { primeira: string | null; alcance?: string; todasAbertas: boolean; definirTodas: (aberta: boolean) => void }
const InscricaoNoGrupo = createContext<Inscricao | null>(null);
const EstadoDoGrupo = createContext<EstadoDoGrupo | null>(null);

/**
 * O "+" do título que pede à própria seção o item novo (#390), em vez de levar a outra página: quem está dentro atende com
 * usePedidoDeNovo, como o botão "Novo…" de baixo, que continua. O rótulo é o nome desse botão (na dica e para o leitor de tela).
 */
export interface NovoNaSecao {
  rotulo: string;
  /** O pedido abre um menu (ex.: "Adicionar checklist"), e não um formulário: o leitor de tela fica sabendo. */
  menu?: boolean;
}
/** O pedido do "+" que a seção ainda não atendeu: o botão clicado, onde o menu do item novo se prende. */
interface PedidoDeNovo { botao: HTMLElement }
interface PedidoNaSecao { pedido: PedidoDeNovo | null; atendido: () => void }
const PedidoNaSecao = createContext<PedidoNaSecao | null>(null);

/**
 * Atende o "+" do título da seção em que está (veja NovoNaSecao): `atender` abre o formulário ou o menu do item novo, o mesmo que o
 * botão de baixo abre, e recebe o "+" clicado, onde o menu se prende. Com a seção fechada, o conteúdo só monta depois do clique: o
 * pedido espera por ele (e pela leitura, se quem atende só aparece depois dela).
 */
export function usePedidoDeNovo(atender: (botao: HTMLElement) => void) {
  const secao = useContext(PedidoNaSecao);
  const quem = useRef(atender);
  quem.current = atender;
  const pedido = secao?.pedido ?? null;
  useEffect(() => {
    if (!pedido) return;
    secao!.atendido();
    quem.current(pedido.botao);
  }, [pedido, secao]);
}

/** O primeiro campo que se preenche no formulário (sem os escondidos e os desligados). */
function primeiroCampo(formulario: Element | undefined) {
  return [...formulario?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? []]
    .find(c => c.type !== 'hidden' && !c.disabled);
}

/** Quem atende o "+" quando o estado do item novo fica em quem monta a seção (ex.: o menu dos checklists). */
export function AoPedirNovo({ atender }: { atender: (botao: HTMLElement) => void }) {
  usePedidoDeNovo(atender);
  return null;
}

/**
 * Põe as seções de dentro num grupo só delas, com o botão de expandir e recolher todas acima da primeira. Um grupo dentro de outro
 * (a coluna da direita, dentro do cartão) tem o seu botão, que só abre e fecha as dele (#397). O `alcance` vai no nome do botão,
 * depois de "Expandir tudo" ou "Recolher tudo", e diz de onde são as seções ("da coluna da direita").
 */
export function GrupoDeSecoes({ alcance, children }: { alcance?: string; children: ReactNode }) {
  const secoes = useRef(new Map<string, { aberta: boolean; definir: (aberta: boolean) => void }>());
  // Cada inscrição ou mudança redesenha o grupo (o estado das seções fica na referência).
  const [, setVersao] = useState(0);
  const [inscricao] = useState<Inscricao>(() => ({
    inscrever: (id, definir) => {
      secoes.current.set(id, { aberta: false, definir });
      setVersao(v => v + 1);
      return () => { secoes.current.delete(id); setVersao(v => v + 1); };
    },
    mudou: (id, aberta) => {
      const s = secoes.current.get(id);
      if (s && s.aberta !== aberta) { s.aberta = aberta; setVersao(v => v + 1); }
    }
  }));
  const todas = [...secoes.current.values()];
  const estado: EstadoDoGrupo = {
    primeira: secoes.current.keys().next().value ?? null,
    alcance,
    todasAbertas: todas.length > 0 && todas.every(s => s.aberta),
    definirTodas: aberta => secoes.current.forEach(s => s.definir(aberta))
  };
  return <InscricaoNoGrupo.Provider value={inscricao}>
    <EstadoDoGrupo.Provider value={estado}>{children}</EstadoDoGrupo.Provider>
  </InscricaoNoGrupo.Provider>;
}

/**
 * O botão que abre ou fecha todas as seções do grupo, à direita, acima da primeira. Desde a #366, só o ícone das duas setas
 * (para baixo: abre; para cima: fecha), redondo como os botões do cartão, sem texto: o nome ("Expandir tudo" ou "Recolher
 * tudo") vai para a dica, que aparece ao passar o mouse e no foco do teclado; o leitor de tela ouve também o alcance do grupo
 * (#397: cada cartão tem dois, o da esquerda e o da coluna, e o nome sozinho não os distingue).
 */
function ExpandirTudo({ estado }: { estado: EstadoDoGrupo }) {
  const rotulo = estado.todasAbertas ? 'Recolher tudo' : 'Expandir tudo';
  return <div className="secoes-todas">
    <button type="button" className="cartao-botao recolher-todas" aria-label={estado.alcance ? `${rotulo} ${estado.alcance}` : rotulo} aria-expanded={estado.todasAbertas}
      {...propsDaDica(rotulo)} onClick={() => estado.definirTodas(!estado.todasAbertas)}>
      <Icone nome={estado.todasAbertas ? 'recolher' : 'expandir'} tam={ICONE_DO_TOPO} />
    </button>
  </div>;
}

interface Props {
  titulo: string;
  icone: NomeIcone;
  /** Chave da preferência que guarda se a seção fica aberta. Sem ela, a seção sempre começa recolhida. */
  preferencia?: string;
  /** Quantidade mostrada ao lado do título (ex.: quantos vínculos), visível mesmo com a seção fechada. */
  contador?: number;
  /**
   * Fica de fora do "Expandir tudo" (ex.: as informações sigilosas: cada abertura é registrada, e só abre quem
   * clicar nela).
   */
  foraDoExpandirTudo?: boolean;
  /** Abre a seção ao aparecer, sem mudar a escolha guardada (ex.: a mensagem que leva a um comentário). */
  abertaAoIniciar?: boolean;
  /**
   * O atalho para criar um item: um "+" no título, logo depois do número. Com um endereço, leva ao cadastro de um item já ligado (ex.:
   * "Nova tarefa deste contrato"); sem ele, pede o item novo à própria seção (veja NovoNaSecao). No cartão só para ler, ele não
   * aparece (veja CriarNoCartao, em ItensLigados.tsx).
   */
  novo?: NovoLigado | NovoNaSecao;
  /**
   * O botão rápido que o "+" oferece ao cartão (#351): o tipo dele na linha (Checklist, Anotação…). Só enquanto o "+" aparece: no
   * cartão arquivado ou só para ler, nenhum.
   */
  atalho?: TipoDeAtalho;
  children: ReactNode;
}

export function Recolhivel({ titulo, icone, preferencia, contador, foraDoExpandirTudo = false, abertaAoIniciar = false, novo: pedido, atalho, children }: Props) {
  const novo = useNovoNoCartao(pedido);
  const [aberto, setAberto] = useState(() => abertaAoIniciar || (preferencia ? lerPreferencia(preferencia, false) : false));
  const id = useId();
  const inscricao = useContext(InscricaoNoGrupo);
  const estado = useContext(EstadoDoGrupo);
  const noGrupo = !!inscricao && !foraDoExpandirTudo;
  useEffect(() => {
    if (!inscricao || foraDoExpandirTudo) return;
    return inscricao.inscrever(id, setAberto);
  }, [inscricao, foraDoExpandirTudo, id]);
  useEffect(() => { if (noGrupo) inscricao.mudou(id, aberto); }, [noGrupo, inscricao, id, aberto]);
  const alternar = () => {
    setAberto(!aberto);
    if (preferencia) salvarPreferencia(preferencia, !aberto);
  };
  const [aAtender, setAAtender] = useState<PedidoDeNovo | null>(null);
  const pedidoNaSecao = useMemo<PedidoNaSecao>(() => ({ pedido: aAtender, atendido: () => setAAtender(null) }), [aAtender]);
  const corpo = useRef<HTMLDivElement>(null);
  /** Os formulários que a seção já mostrava no clique do "+" (que abre um formulário, e não um menu): o do item novo é o que vem depois. */
  const formulariosAntes = useRef<Set<Element> | null>(null);
  // Abre a seção como o abertaAoIniciar: só agora, sem gravar a escolha (#390).
  const pedirNovo = (botao: HTMLElement) => {
    setAberto(true);
    setAAtender({ botao });
    if (novo && !('para' in novo) && !novo.menu) formulariosAntes.current = new Set(corpo.current?.querySelectorAll('form') ?? []);
  };
  // O botão rápido do cartão faz o mesmo que o "+": leva ao mesmo endereço ou pede o item novo à seção.
  useAtalhoDoCartao(atalho, novo && ('para' in novo ? { nome: novo.rotulo, para: novo.para } : { nome: novo.rotulo, menu: novo.menu, abrir: pedirNovo }));
  // Fechada antes de quem atende aparecer (ex.: a leitura falhou), o pedido acaba: não abre o formulário quando ela reabrir.
  useEffect(() => { if (!aberto) setAAtender(null); }, [aberto]);
  // Atendido o pedido, o foco vai ao primeiro campo do formulário novo, que fica à vista: com uma lista longa, ele aparece
  // embaixo, longe do "+", e quem usa o teclado ou o leitor de tela não ficaria sabendo (o menu já leva o foco a si).
  useEffect(() => {
    const antes = formulariosAntes.current;
    if (aAtender || !antes) return;
    formulariosAntes.current = null;
    const formulario = [...corpo.current?.querySelectorAll('form') ?? []].find(f => !antes.has(f));
    primeiroCampo(formulario)?.focus();
  }, [aAtender]);
  return <>
    {noGrupo && estado?.primeira === id && <ExpandirTudo estado={estado} />}
    <section className="bloco recolhivel">
      {/* Com o "+", ele fica entre o número e a seta (um link não pode ir dentro do botão): o resto da linha, até a
          seta, também abre e fecha a seção. */}
      <h3 className={novo ? 'com-novo' : undefined}>
        <button type="button" className="recolher" aria-expanded={aberto} aria-controls={id} onClick={alternar}>
          <Icone nome={icone} tam={ICONE_DO_TITULO_DE_SECAO} />{titulo}
          {contador !== undefined && <Contador apagado={!contador}>{contador}</Contador>}
          {!novo && <span className="recolher-seta"><Icone nome="abaixo" tam={TAMANHO_DA_SETA} /></span>}
        </button>
        {novo && <>
          {'para' in novo
            ? <BotaoLink forma="mini" className="secao-novo" to={novo.para} aria-label={novo.rotulo} title={novo.rotulo}><Icone nome="mais" tam={ICONE_DO_MINI} /></BotaoLink>
            : <button type="button" className={estiloBotao({ forma: 'mini' }, 'secao-novo')} aria-label={novo.rotulo} title={novo.rotulo}
              aria-haspopup={novo.menu ? 'menu' : undefined} onClick={e => pedirNovo(e.currentTarget)}><Icone nome="mais" tam={ICONE_DO_MINI} /></button>}
          <span className="recolher-resto" aria-hidden="true" onClick={alternar}><span className="recolher-seta"><Icone nome="abaixo" tam={TAMANHO_DA_SETA} /></span></span>
        </>}
      </h3>
      {/* As seções de dentro desta (ex.: o histórico das parcelas, dentro de Honorários) ficam fora do grupo: o "Expandir
          tudo" abre e fecha só as do cartão, e não diria "Expandir tudo" por causa de uma seção escondida. */}
      {/* O pedido do "+" também é só desta seção: o de Honorários não chega ao histórico das parcelas, que fica dentro dela. */}
      {aberto && <div className="bloco-corpo" id={id} ref={corpo}><InscricaoNoGrupo.Provider value={null}><EstadoDoGrupo.Provider value={null}>
        <PedidoNaSecao.Provider value={pedidoNaSecao}>{children}</PedidoNaSecao.Provider>
      </EstadoDoGrupo.Provider></InscricaoNoGrupo.Provider></div>}
    </section>
  </>;
}
