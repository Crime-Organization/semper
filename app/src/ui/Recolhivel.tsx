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
// atende o pedido com usePedidoDeNovo, com o estado no mesmo lugar de sempre. Com `atalho` (#351; desde a #399, o menu
// "Acrescentar ao cartão", em AcrescentarAoCartao.tsx), a seção vira uma linha desse menu, com a contagem dela: o "ver" a abre (sem
// mudar a escolha guardada) e leva o foco ao título dela; o "+" da linha, enquanto o do título aparece, faz o que ele faz: abre a
// seção e o formulário ou o menu do item novo, preso à bolinha do menu.
// Desde a #427, o título é o único lugar das ações da seção: o número, a corrente (`ligar`: ligar um item que já existe) e o "+"
// (`novo`: criar um novo), só com o ícone e a explicação na dica e para o leitor de tela. Embaixo da lista não há mais botões de
// ligar nem de criar: quem está dentro atende a corrente com usePedidoDeLigar (a busca ou o formulário de ligar abre ali) e o "+"
// com usePedidoDeNovo, e os dois dizem se o título já tem o botão, para quem está dentro não repetir o seu. Com mais de um tipo
// (ex.: recurso e incidental), a corrente ou o "+" abre um menu pequeno, um item por tipo.
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import type { TipoDeAtalho } from '../regras/atalhosDoCartao';
import { BotaoLink, Contador, estiloBotao, propsDaDica } from './base';
import { Icone, ICONE_DO_MINI, ICONE_DO_TITULO_DE_SECAO, ICONE_DO_TOPO, type NomeIcone } from './Icone';
import { useNovoNoCartao, type NovoLigado } from './ItensLigados';
import { MenuFlutuante } from './Menu';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { useAtalhoDoCartao } from './registroDeAtalhos';
import { irAte } from './rolagem';

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
 * usePedidoDeNovo. O rótulo é o nome do "+" (na dica e para o leitor de tela).
 */
export interface NovoNaSecao {
  rotulo: string;
  /** O pedido abre um menu (ex.: "Adicionar checklist"), e não um formulário: o leitor de tela fica sabendo. */
  menu?: boolean;
  /** Por que ainda não se pode (ex.: a anotação nova, que espera ir ao banco): o "+" fica desligado, com o motivo na dica. */
  indisponivel?: string;
}
/**
 * A corrente do título (#427): pede à própria seção a busca (ou o formulário) para ligar um item que já existe. Quem está dentro
 * atende com usePedidoDeLigar, pelo mesmo rótulo, que é também o nome da corrente (ex.: "Ligar contrato existente").
 */
export interface LigarNaSecao {
  rotulo: string;
  /** Por que agora não se pode ligar (ex.: a lista do cartão já está cheia): a corrente fica desligada, com o motivo na dica. */
  indisponivel?: string;
}
/** Mais de um tipo (#427): a corrente ou o "+" abre um menu pequeno, com uma opção por tipo; o rótulo é o nome do botão e do menu. */
export interface VariosNaSecao<T> { rotulo: string; opcoes: T[] }
const temOpcoes = <T, U extends object>(x: U | VariosNaSecao<T>): x is VariosNaSecao<T> => 'opcoes' in x;

/** O pedido do "+" (ou da corrente) que a seção ainda não atendeu: o botão clicado, onde o menu do item novo se prende. */
interface PedidoDeNovo { botao: HTMLElement }
interface PedidoNaSecao {
  pedido: PedidoDeNovo | null;
  atendido: () => void;
  /** O título tem o "+" que pede à seção (NovoNaSecao). */
  noTitulo: boolean;
  /** Leva o foco de volta ao "+" do título (ex.: ao cancelar o formulário que ele abriu). */
  voltar: () => void;
}
const PedidoNaSecao = createContext<PedidoNaSecao | null>(null);
interface PedidoDeLigar { rotulo: string; botao: HTMLElement }
interface LigarDaSecao { rotulos: readonly string[]; pedido: PedidoDeLigar | null; atendido: () => void }
const LigarDaSecao = createContext<LigarDaSecao | null>(null);

/** O que o título da seção já oferece a quem está dentro: se ele tem o botão (e aí o de dentro não aparece) e como voltar a ele. */
export interface NoTitulo { peloTitulo: boolean; voltarAoTitulo: () => void }

/**
 * Atende o "+" do título da seção em que está (veja NovoNaSecao): `atender` abre o formulário ou o menu do item novo e recebe o
 * "+" clicado, onde o menu se prende. Com a seção fechada, o conteúdo só monta depois do clique: o pedido espera por ele (e pela
 * leitura, se quem atende só aparece depois dela). Devolve se o título tem o "+": com ele, quem atende não mostra botão seu (#427).
 */
export function usePedidoDeNovo(atender: (botao: HTMLElement) => void): NoTitulo {
  const secao = useContext(PedidoNaSecao);
  const quem = useRef(atender);
  quem.current = atender;
  const pedido = secao?.pedido ?? null;
  useEffect(() => {
    if (!pedido) return;
    secao!.atendido();
    quem.current(pedido.botao);
  }, [pedido, secao]);
  return { peloTitulo: !!secao?.noTitulo, voltarAoTitulo: () => secao?.voltar() };
}

/**
 * Atende a corrente do título da seção em que está (veja LigarNaSecao), a do mesmo `rotulo`: `atender` abre a busca ou o
 * formulário de ligar e recebe a corrente clicada (para onde o foco volta ao fechar). Como no "+", o pedido espera o conteúdo
 * montar. Devolve se o título tem essa corrente: com ela, quem atende não mostra o botão "Ligar …" de baixo (#427). Sem rótulo
 * (ex.: a busca dentro de uma janela), nunca atende.
 */
export function usePedidoDeLigar(rotulo: string | undefined, atender: (botao: HTMLElement) => void): boolean {
  const secao = useContext(LigarDaSecao);
  const quem = useRef(atender);
  quem.current = atender;
  const meu = !!rotulo && !!secao?.rotulos.includes(rotulo);
  const pedido = meu && secao?.pedido?.rotulo === rotulo ? secao.pedido : null;
  useEffect(() => {
    if (!pedido) return;
    secao!.atendido();
    quem.current(pedido.botao);
  }, [pedido, secao]);
  return meu;
}

/** O primeiro campo que se preenche no formulário (sem os escondidos e os desligados). */
function primeiroCampo(formulario: Element | undefined) {
  return [...formulario?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? []]
    .find(c => c.type !== 'hidden' && !c.disabled);
}

/** Se o título da seção em que está tem o "+" que pede à seção (NovoNaSecao), para quem atende com AoPedirNovo não repetir o botão. */
export const useNovoPeloTitulo = () => !!useContext(PedidoNaSecao)?.noTitulo;

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
   * O atalho para criar um item: um "+" no título, logo depois do número (e da corrente). Com um endereço, leva ao cadastro de um item
   * já ligado (ex.: "Nova tarefa deste contrato"); sem ele, pede o item novo à própria seção (veja NovoNaSecao); com opções, abre um
   * menu com um endereço por tipo (ex.: "Novo recurso", "Novo incidental"). No cartão só para ler, ele não aparece (veja
   * CriarNoCartao, em ItensLigados.tsx).
   */
  novo?: NovoLigado | NovoNaSecao | VariosNaSecao<NovoLigado>;
  /**
   * A corrente (#427): ligar a seção a um item que já existe, logo depois do número. Pede à própria seção a busca de ligar (veja
   * LigarNaSecao); com opções, abre um menu com uma busca por tipo. Como o "+", não aparece no cartão só para ler.
   */
  ligar?: LigarNaSecao | VariosNaSecao<LigarNaSecao>;
  /**
   * A linha que a seção oferece ao menu "Acrescentar ao cartão" (#399): o tipo dela (checklist, anotação…). O "ver" vale sempre; o
   * acrescentar, só enquanto o "+" aparece (no cartão arquivado ou só para ler, nenhum).
   */
  atalho?: TipoDeAtalho;
  children: ReactNode;
}

/** O tamanho do ícone de cada opção do menu da corrente ou do "+" (o dos outros menus). */
const ICONE_DA_OPCAO = 15;

/** O menu aberto pela corrente ou pelo "+" com opções: qual dos dois e o botão onde ele se prende. */
interface MenuDoTitulo { de: 'novo' | 'ligar'; botao: HTMLElement }

interface PropsDoBotao {
  icone: NomeIcone;
  rotulo: string;
  /** Abre um menu (o leitor de tela fica sabendo). */
  menu?: boolean;
  /** Por que agora não se pode: o botão fica desligado (mas no Tab), com o motivo na dica e para o leitor de tela. */
  indisponivel?: string;
  aoClicar: (botao: HTMLElement) => void;
  botaoRef?: Ref<HTMLButtonElement>;
  /** O id do texto do motivo, que a seção põe logo depois do título, fora dele (para não entrar no nome da seção). */
  motivoId?: string;
}
/**
 * Um botão redondo do título da seção (#427): a corrente ou o "+", só com o ícone. O nome vai para a dica, que aparece ao passar o
 * mouse e no foco do teclado, e para o leitor de tela.
 */
function BotaoDoTitulo({ icone, rotulo, menu, indisponivel, aoClicar, botaoRef, motivoId }: PropsDoBotao) {
  return <button ref={botaoRef} type="button" className={estiloBotao({ forma: 'mini' }, 'secao-novo')} aria-label={rotulo} {...propsDaDica(indisponivel ?? rotulo)}
    aria-haspopup={menu ? 'menu' : undefined} aria-disabled={indisponivel ? true : undefined} aria-describedby={indisponivel ? motivoId : undefined}
    onClick={e => { if (!indisponivel) aoClicar(e.currentTarget); }}><Icone nome={icone} tam={ICONE_DO_MINI} /></button>;
}

export function Recolhivel({ titulo, icone, preferencia, contador, foraDoExpandirTudo = false, abertaAoIniciar = false, novo: pedido, ligar: pedidoDeLigar, atalho, children }: Props) {
  const novo = useNovoNoCartao(pedido);
  const ligar = useNovoNoCartao(pedidoDeLigar);
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
  const [ligarAAtender, setLigarAAtender] = useState<PedidoDeLigar | null>(null);
  const [menu, setMenu] = useState<MenuDoTitulo | null>(null);
  const botaoDoNovo = useRef<HTMLButtonElement>(null);
  const novoNaSecao = !!novo && !('para' in novo) && !temOpcoes(novo);
  const pedidoNaSecao = useMemo<PedidoNaSecao>(() => ({
    pedido: aAtender, atendido: () => setAAtender(null), noTitulo: novoNaSecao,
    voltar: () => setTimeout(() => botaoDoNovo.current?.focus(), 0)
  }), [aAtender, novoNaSecao]);
  // Os rótulos das correntes, juntos num texto só: a lista do contexto só muda quando eles mudam.
  const rotulosDeLigar = (ligar ? (temOpcoes(ligar) ? ligar.opcoes : [ligar]) : []).map(o => o.rotulo).join('\n');
  const ligarDaSecao = useMemo<LigarDaSecao>(() => ({
    rotulos: rotulosDeLigar ? rotulosDeLigar.split('\n') : [], pedido: ligarAAtender, atendido: () => setLigarAAtender(null)
  }), [rotulosDeLigar, ligarAAtender]);
  const corpo = useRef<HTMLDivElement>(null);
  const secao = useRef<HTMLElement>(null), botaoDoTitulo = useRef<HTMLButtonElement>(null);
  /** Os formulários que a seção já mostrava no clique do "+" ou da corrente (que abre um formulário, e não um menu): o novo é o que vem depois. */
  const formulariosAntes = useRef<Set<Element> | null>(null);
  const guardarFormularios = () => { formulariosAntes.current = new Set(corpo.current?.querySelectorAll('form') ?? []); };
  // Abre a seção como o abertaAoIniciar: só agora, sem gravar a escolha (#390).
  const pedirNovo = (botao: HTMLElement) => {
    setAberto(true);
    setAAtender({ botao });
    if (novoNaSecao && !(novo as NovoNaSecao).menu) guardarFormularios();
  };
  const pedirLigar = (rotulo: string, botao: HTMLElement) => {
    setAberto(true);
    setLigarAAtender({ rotulo, botao });
    guardarFormularios();
  };
  // A linha do menu do cartão (#399): o "ver" abre a seção, como o abertaAoIniciar, e leva até ela; o "+" faz o mesmo que o do
  // título: leva ao mesmo endereço, pede o item novo à seção ou abre o menu dos tipos.
  useAtalhoDoCartao(atalho, {
    quantidade: contador,
    ver: () => { setAberto(true); irAte(secao.current, botaoDoTitulo.current); },
    acrescentar: !novo || ('indisponivel' in novo && novo.indisponivel) ? undefined : ('para' in novo ? { nome: novo.rotulo, para: novo.para }
      : temOpcoes(novo) ? { nome: novo.rotulo, menu: true, abrir: (botao: HTMLElement) => setMenu({ de: 'novo', botao }) }
      : { nome: novo.rotulo, menu: novo.menu, abrir: pedirNovo })
  });
  // Fechada antes de quem atende aparecer (ex.: a leitura falhou), o pedido acaba: não abre o formulário quando ela reabrir.
  useEffect(() => { if (!aberto) { setAAtender(null); setLigarAAtender(null); } }, [aberto]);
  // Atendido o pedido, o foco vai ao primeiro campo do formulário novo, que fica à vista: com uma lista longa, ele aparece
  // embaixo, longe do "+", e quem usa o teclado ou o leitor de tela não ficaria sabendo (o menu e a busca já levam o foco a si).
  useEffect(() => {
    const antes = formulariosAntes.current;
    if (aAtender || ligarAAtender || !antes) return;
    formulariosAntes.current = null;
    const formulario = [...corpo.current?.querySelectorAll('form') ?? []].find(f => !antes.has(f));
    primeiroCampo(formulario)?.focus();
  }, [aAtender, ligarAAtender]);
  const comAcoes = !!novo || !!ligar;
  const fecharMenu = () => setMenu(null);
  return <>
    {noGrupo && estado?.primeira === id && <ExpandirTudo estado={estado} />}
    <section className="bloco recolhivel" ref={secao}>
      {/* Com a corrente ou o "+", eles ficam entre o número e a seta (um botão não pode ir dentro do outro): o resto da linha, até a
          seta, também abre e fecha a seção. */}
      <h3 className={comAcoes ? 'com-novo' : undefined}>
        <button ref={botaoDoTitulo} type="button" className="recolher" aria-expanded={aberto} aria-controls={id} onClick={alternar}>
          <Icone nome={icone} tam={ICONE_DO_TITULO_DE_SECAO} />{titulo}
          {contador !== undefined && <Contador apagado={!contador}>{contador}</Contador>}
          {!comAcoes && <span className="recolher-seta"><Icone nome="abaixo" tam={TAMANHO_DA_SETA} /></span>}
        </button>
        {ligar && (temOpcoes(ligar)
          ? <BotaoDoTitulo icone="vinculo" rotulo={ligar.rotulo} menu aoClicar={botao => setMenu({ de: 'ligar', botao })} />
          : <BotaoDoTitulo icone="vinculo" rotulo={ligar.rotulo} indisponivel={ligar.indisponivel} motivoId={id + '-corrente'} aoClicar={botao => pedirLigar(ligar.rotulo, botao)} />)}
        {novo && ('para' in novo
          ? <BotaoLink forma="mini" className="secao-novo" to={novo.para} aria-label={novo.rotulo} {...propsDaDica(novo.rotulo)}><Icone nome="mais" tam={ICONE_DO_MINI} /></BotaoLink>
          : temOpcoes(novo)
            ? <BotaoDoTitulo icone="mais" rotulo={novo.rotulo} menu aoClicar={botao => setMenu({ de: 'novo', botao })} />
            : <BotaoDoTitulo icone="mais" rotulo={novo.rotulo} menu={novo.menu} indisponivel={novo.indisponivel} motivoId={id + '-novo'} aoClicar={pedirNovo} botaoRef={botaoDoNovo} />)}
        {comAcoes && <span className="recolher-resto" aria-hidden="true" onClick={alternar}><span className="recolher-seta"><Icone nome="abaixo" tam={TAMANHO_DA_SETA} /></span></span>}
      </h3>
      {/* Os motivos dos botões desligados do título, fora dele (no nome da seção, o leitor de tela os leria a cada vez). */}
      {ligar && !temOpcoes(ligar) && ligar.indisponivel && <span className="sr" id={id + '-corrente'}>{ligar.indisponivel}</span>}
      {novo && 'indisponivel' in novo && novo.indisponivel && <span className="sr" id={id + '-novo'}>{novo.indisponivel}</span>}
      {menu?.de === 'novo' && novo && temOpcoes(novo) && <MenuFlutuante botao={menu.botao} aoFechar={fecharMenu} rotulo={novo.rotulo}>
        {novo.opcoes.map(o => <Link key={o.para} role="menuitem" to={o.para} onClick={fecharMenu}><Icone nome="mais" tam={ICONE_DA_OPCAO} /> {o.rotulo}</Link>)}
      </MenuFlutuante>}
      {menu?.de === 'ligar' && ligar && temOpcoes(ligar) && <MenuFlutuante botao={menu.botao} aoFechar={fecharMenu} rotulo={ligar.rotulo}>
        {ligar.opcoes.map(o => <button key={o.rotulo} type="button" role="menuitem" onClick={() => { const botao = menu.botao; fecharMenu(); pedirLigar(o.rotulo, botao); }}>
          <Icone nome="vinculo" tam={ICONE_DA_OPCAO} /> {o.rotulo}
        </button>)}
      </MenuFlutuante>}
      {/* As seções de dentro desta (ex.: o histórico das parcelas, dentro de Honorários) ficam fora do grupo: o "Expandir
          tudo" abre e fecha só as do cartão, e não diria "Expandir tudo" por causa de uma seção escondida. */}
      {/* O pedido do "+" e o da corrente também são só desta seção: o de Honorários não chega ao histórico das parcelas, que fica dentro dela. */}
      {aberto && <div className="bloco-corpo" id={id} ref={corpo}><InscricaoNoGrupo.Provider value={null}><EstadoDoGrupo.Provider value={null}>
        <PedidoNaSecao.Provider value={pedidoNaSecao}><LigarDaSecao.Provider value={ligarDaSecao}>{children}</LigarDaSecao.Provider></PedidoNaSecao.Provider>
      </EstadoDoGrupo.Provider></InscricaoNoGrupo.Provider></div>}
    </section>
  </>;
}
