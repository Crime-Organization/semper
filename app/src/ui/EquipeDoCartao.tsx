// A equipe de um cartão (tarefa, demanda, contrato, anotação...) em bolinhas com as iniciais, à direita do topo do cartão:
// primeiro o responsável e, depois de um pequeno traço, os participantes. O nome de cada um aparece na dica, ao passar o mouse
// e no foco do teclado. Peça comum: todo cartão com equipe a mostra assim.
// Para quem pode alterar o cartão, o clique numa bolinha abre um menu (#388, pedido do dono; antes, #356, a bolinha já era a
// ação e tirava a pessoa na hora), como a pílula dos grupos: no alto, o nome e o papel; embaixo, o que dá para fazer. Quem chama
// diz quais ações cada bolinha tem (`acoes`, pela tabela ACOES_NA_BOLINHA de regras/menuDaBolinha.ts): o participante pode
// virar responsável, sair do item e ter o perfil aberto; o responsável pode ser trocado (o menu abre a busca só na equipe,
// BuscaNaEquipe, presa à bolinha) e ter o perfil aberto. A ação que seria recusada (no contrato, sair dele sem poder) aparece com
// o motivo no lugar dela (`impedeTirar`, `impedeTrocar`, `impedeTornar`). Esc ou o clique fora fecham o menu e o foco volta à
// bolinha. Sem responsável, a bolinha dele aparece vazia, tracejada, e abre direto a escolha. Depois dos participantes, a
// bolinha com "+" abre a busca para pôr mais alguém. Quem só lê vê as bolinhas com o nome na dica, sem ação.
// Os grupos da equipe postos no item (#378) vêm depois dos participantes, em pílulas (GruposNoCartao), e o "+" acha também os
// grupos (a parte "Grupos da equipe" da busca). Sem grupos no escritório, nada disso aparece.
// Sem responsável principal (`semPrincipal`, #387: os responsáveis da pessoa, vários e todos iguais), só a lista: cada um é uma
// bolinha como a de um participante, sem a bolinha do responsável nem o traço, e o "+" põe mais um.
import { useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';
import type { GrupoDaEquipe, Membro } from '../dados';
import { GRUPOS_DEMAIS, nomeDoGrupo, numeroDoGrupo } from '../regras/gruposDaEquipe';
import { NOME_DA_ACAO, type AcaoDaBolinha, type PerfilNaBolinha } from '../regras/menuDaBolinha';
import { GruposNoCartao } from './GruposDoItem';
import { Avatar } from './Avatar';
import { propsDaDica } from './base';
import { BuscaNaEquipe, BuscaPresa } from './BuscaNaEquipe';
import { Icone, type NomeIcone } from './Icone';
import { MenuFlutuante } from './Menu';

/** Tamanho das bolinhas da equipe no cartão (maiores que as do quadro, para clicar com folga). Vale também para a do "+". */
const TAMANHO_BOLINHA = 34;
/** A mesma medida para o estilo (o vão entre as bolinhas no topo, no celular, em estilo.css): o número fica só aqui. */
const MEDIDA_DA_BOLINHA = { '--bolinha-da-equipe': TAMANHO_BOLINHA + 'px' } as CSSProperties;
/** Tamanho do ícone de pessoa dentro da bolinha vazia do responsável. */
const ICONE_DA_VAZIA = 16;
/** Tamanho do ícone na frente de cada ação do menu da bolinha (o mesmo do menu ⋯ do cartão). */
const ICONE_DO_MENU = 15;
/** O motivo das ações que mudam a equipe enquanto outra mudança ainda grava (e a dica do "+", nessa hora). */
const GRAVANDO_A_EQUIPE = 'Gravando a mudança na equipe…';
/** O nome da busca que troca (ou escolhe) o responsável. */
const TROCAR_O_RESPONSAVEL = NOME_DA_ACAO.trocarResponsavel;
/** O que a bolinha vazia diz, quando o cartão está sem responsável. */
const SEM_RESPONSAVEL = 'Sem responsável';
/** Por que o responsável não pode ser trocado: não há outra pessoa ativa na equipe para assumir. */
const NINGUEM_PARA_ASSUMIR = 'Não há outra pessoa na equipe para assumir.';

export interface PessoaDaEquipe {
  /** O usuário (dá a cor e as iniciais da bolinha). */
  id: string;
  nome: string;
  cor?: string | null;
  /** O papel no cartão, por extenso (ex.: "Responsável", "Participante · 10%"). */
  papel: string;
}

/** Um usuário da equipe no papel dele no cartão. */
export function naEquipe(equipe: Membro[], perfilId: string, papel: string): PessoaDaEquipe {
  const m = equipe.find(x => x.id === perfilId);
  return { id: perfilId, nome: m?.nome || 'Usuário removido', cor: m?.cor, papel };
}

/**
 * O que muda uma lista de pessoas ali mesmo, no topo do cartão (#356): pôr e tirar. Sozinha, serve à lista sem responsável principal
 * (os responsáveis da pessoa, #387). Quem usa grava (com as regras do lápis do módulo) e relê o cartão.
 */
export interface MudarALista {
  /** O nome da bolinha com "+": "Pôr participante". */
  por: string;
  /** Quem a busca do "+" acha: os integrantes ativos que ainda não estão no cartão. */
  candidatos: (termo: string) => Membro[];
  /** As ações do menu da bolinha de cada um (#388), na ordem do menu: a tabela de quem chama (ACOES_NA_BOLINHA). */
  acoes: (p: PessoaDaEquipe) => readonly AcaoDaBolinha[];
  /** O "Tirar" do menu da bolinha: "Tirar da tarefa", ou "Sair da tarefa", na própria. */
  tirar: (p: PessoaDaEquipe) => string;
  /** Onde fica o perfil de cada um ("Ver perfil"), ou por que ele não abre; null: não há perfil para ver. */
  perfil: (p: PessoaDaEquipe) => PerfilNaBolinha;
  /** A lista chegou ao máximo: o "+" fica desligado, com este motivo na dica. */
  cheia?: string;
  /** Uma mudança ainda grava: as ações que mudam a equipe esperam ela terminar (o motivo no menu), para uma não apagar a outra. */
  ocupado?: boolean;
  /**
   * Por que este participante não pode ser tirado (no contrato, quem sairia deixaria de poder alterá-lo): o menu mostra o
   * motivo no lugar do "Tirar", em vez de oferecer uma ação que seria recusada. undefined: tira.
   */
  impedeTirar?: (p: PessoaDaEquipe) => string | undefined;
  aoPor: (m: Membro) => unknown;
  aoTirar: (p: PessoaDaEquipe) => unknown;
}

/** O que muda a equipe com responsável principal: a lista e, nos menus das bolinhas, a troca do responsável e o "Tornar responsável". */
export interface MudarAEquipe extends MudarALista {
  /** As ações do menu da bolinha do responsável (ACOES_NA_BOLINHA.responsavel). */
  acoesDoResponsavel: readonly AcaoDaBolinha[];
  /** Quem a busca de trocar o responsável acha: os integrantes ativos, menos o responsável de agora. */
  responsaveis: (termo: string) => Membro[];
  /** Por que o responsável não pode ser trocado (no contrato, quem o passasse adiante ficaria de fora): o motivo no menu. */
  impedeTrocar?: string;
  /** Por que este participante não pode passar a responder: o motivo no lugar de "Tornar responsável". */
  impedeTornar?: (p: PessoaDaEquipe) => string | undefined;
  aoTrocarResponsavel: (m: Membro) => unknown;
  /** O participante passa a responder, e o responsável de antes continua no item (decisão do dono, #388). */
  aoTornarResponsavel: (p: PessoaDaEquipe) => unknown;
}

/** Os grupos da equipe no topo do cartão (#378). */
export interface GruposDoCartao {
  /** Os grupos postos no item, já na ordem do item. */
  doItem: GrupoDaEquipe[];
  /** A equipe do escritório (conta quem está em cada grupo). */
  equipe: Membro[];
  eu: string;
  /** A nota de quem está no cartão só por um grupo. */
  nota?: (g: GrupoDaEquipe) => string | null;
  /**
   * Quem altera o cartão: os grupos que o "+" acha (os que ainda não estão no item), o pôr e o tirar. Sem isto, as pílulas são
   * só para ver. Sem grupos no escritório, quem usa não passa nada.
   */
  mudar?: {
    candidatos: (termo: string) => GrupoDaEquipe[];
    /** O item já tem o máximo de grupos. */
    cheio: boolean;
    /** O nome do "+" com grupos no escritório: "Pôr participante ou grupo". */
    por: string;
    aoPor: (g: GrupoDaEquipe) => unknown;
    aoTirar: (g: GrupoDaEquipe) => unknown;
    /** Por que este grupo não sai do cartão (ele é o único caminho de quem muda até o item): o motivo no lugar do "Tirar". */
    impedeTirar?: (g: GrupoDaEquipe) => string | undefined;
  };
}

interface Comum {
  participantes: PessoaDaEquipe[];
  /** Os grupos da equipe do item (#378). */
  grupos?: GruposDoCartao;
}

/** A equipe de sempre: o responsável (um só), o traço e os participantes. */
interface ComResponsavel extends Comum {
  semPrincipal?: false;
  /** null: o cartão está sem responsável (aparece a bolinha vazia). */
  responsavel: PessoaDaEquipe | null;
  /** Sem isto, as bolinhas são só para ver (quem só lê o cartão, o cartão arquivado). */
  mudar?: MudarAEquipe;
}

/** Só a lista, sem responsável principal (#387): todos iguais, em `participantes`. */
interface SoALista extends Comum {
  semPrincipal: true;
  /** Sem isto, as bolinhas são só para ver. */
  mudar?: MudarALista;
}

type Props = ComResponsavel | SoALista;

/** A dica de quem só vê: o nome e o papel ("Ana Souza · Responsável"). */
const quemE = (p: PessoaDaEquipe) => `${p.nome} · ${p.papel}`;
/** O nome da bolinha para o leitor de tela: "Ana Souza, Responsável". */
const nomeDaBolinha = (p: PessoaDaEquipe) => `${p.nome}, ${p.papel}`;

/**
 * Uma linha do menu da bolinha (#388): a ação (um botão, ou o link do perfil) ou, quando ela não pode ser feita, o motivo no lugar
 * dela. `abreABusca`: a ação abre a busca de trocar o responsável, presa à bolinha.
 */
interface ItemDoMenu {
  acao: AcaoDaBolinha;
  rotulo: string;
  icone: NomeIcone;
  perigo?: boolean;
  motivo?: string;
  para?: string;
  fazer?: () => void;
  abreABusca?: boolean;
}

/** O que cada ação precisa para se montar no menu de uma bolinha. */
interface ParaMontar {
  p: PessoaDaEquipe;
  lista: MudarALista;
  /** Só na equipe com responsável principal (sem ela, não há "Tornar" nem "Trocar"). */
  equipe?: MudarAEquipe;
  focarNoMais: () => void;
  focarNoResponsavel: () => void;
}

/** O motivo comum das ações que mudam a equipe, antes do motivo próprio de cada uma. */
const motivoDeMudar = (x: ParaMontar, proprio: string | undefined) => x.lista.ocupado ? GRAVANDO_A_EQUIPE : proprio;

/** Cada ação do menu: como aparece e o que faz. Ação nova = entrada nova (o Record reclama se faltar alguma). */
const ITEM_DA_ACAO: Record<AcaoDaBolinha, (x: ParaMontar) => ItemDoMenu | null> = {
  tornarResponsavel: x => x.equipe ? {
    acao: 'tornarResponsavel', rotulo: NOME_DA_ACAO.tornarResponsavel, icone: 'acima', motivo: motivoDeMudar(x, x.equipe.impedeTornar?.(x.p)),
    // A pessoa vai para a bolinha do responsável: o foco também.
    fazer: () => { x.focarNoResponsavel(); void x.equipe?.aoTornarResponsavel(x.p); }
  } : null,
  trocarResponsavel: x => x.equipe ? {
    acao: 'trocarResponsavel', rotulo: TROCAR_O_RESPONSAVEL, icone: 'pessoas', abreABusca: true,
    motivo: motivoDeMudar(x, x.equipe.impedeTrocar ?? (x.equipe.responsaveis('').length ? undefined : NINGUEM_PARA_ASSUMIR))
  } : null,
  // Depois de tirar alguém, a bolinha dele some: o foco vai à bolinha do "+" (que, desligada, continua no Tab).
  tirar: x => ({
    acao: 'tirar', rotulo: x.lista.tirar(x.p), icone: 'fechar', perigo: true, motivo: motivoDeMudar(x, x.lista.impedeTirar?.(x.p)),
    fazer: () => { x.focarNoMais(); void x.lista.aoTirar(x.p); }
  }),
  verPerfil: x => {
    const perfil = x.lista.perfil(x.p);
    return perfil && { acao: 'verPerfil', rotulo: NOME_DA_ACAO.verPerfil, icone: 'conta', ...('para' in perfil ? { para: perfil.para } : { motivo: perfil.motivo }) };
  }
};

const montarMenu = (acoes: readonly AcaoDaBolinha[], x: ParaMontar) => acoes.flatMap(a => ITEM_DA_ACAO[a](x) ?? []);

export function EquipeDoCartao(props: Props) {
  const { participantes, grupos } = props;
  const mudar: MudarALista | undefined = props.mudar;
  const equipe = props.semPrincipal ? undefined : props.mudar;
  const mais = useRef<HTMLButtonElement>(null);
  const doResponsavel = useRef<HTMLButtonElement>(null);
  const focarNoMais = () => setTimeout(() => mais.current?.focus(), 0);
  const focarNoResponsavel = () => setTimeout(() => doResponsavel.current?.focus(), 0);
  // Só a lista, para quem só vê, e ninguém nela: nada a mostrar (nem um grupo vazio para o leitor de tela).
  if (props.semPrincipal && !mudar && !participantes.length && !grupos?.doItem.length) return null;
  // Com grupos no escritório, a lista de pessoas cheia não desliga o "+" enquanto houver grupo para pôr (e vice-versa).
  const comGrupos = mudar && grupos?.mudar;
  // O "+" só desliga sem pessoa e sem grupo para pôr; o motivo é o da lista cheia ou, sem ele, o dos grupos demais.
  const semPessoas = !!mudar?.cheia || !mudar?.candidatos('').length;
  const semGrupos = !(comGrupos && !comGrupos.cheio && comGrupos.candidatos('').length);
  const motivoComGrupos = semPessoas && semGrupos ? mudar?.cheia ?? (comGrupos?.cheio ? GRUPOS_DEMAIS : undefined) : undefined;
  const motivoDoMais = mudar?.ocupado ? GRAVANDO_A_EQUIPE : comGrupos ? motivoComGrupos : mudar?.cheia;
  const menuDe = (m: MudarALista, p: PessoaDaEquipe, acoes: readonly AcaoDaBolinha[]) => montarMenu(acoes, { p, lista: m, equipe, focarNoMais, focarNoResponsavel });
  return <div className="equipe-cartao" role="group" aria-label="Equipe" style={MEDIDA_DA_BOLINHA}>
    {!props.semPrincipal && <>
      <BolinhaDoResponsavel responsavel={props.responsavel} mudar={props.mudar} botao={doResponsavel}
        itens={props.mudar && props.responsavel ? menuDe(props.mudar, props.responsavel, props.mudar.acoesDoResponsavel) : []} />
      {(participantes.length > 0 || mudar || !!grupos?.doItem.length) && <span className="equipe-traco" aria-hidden="true" />}
    </>}
    {participantes.length > 0 && <span className="equipe-participantes">
      {participantes.map(p => mudar
        ? <BolinhaComMenu key={p.id} p={p} itens={menuDe(mudar, p, mudar.acoes(p))} />
        : <SoParaVer key={p.id} dica={quemE(p)} rotulo={nomeDaBolinha(p)}><Bolinha p={p} /></SoParaVer>)}
    </span>}
    {grupos && <GruposNoCartao grupos={grupos.doItem} equipe={grupos.equipe} eu={grupos.eu} nota={grupos.nota} ocupado={mudar?.ocupado}
      tirar={comGrupos ? g => { focarNoMais(); return comGrupos.aoTirar(g); } : undefined} impedeTirar={comGrupos?.impedeTirar} />}
    {mudar && <BuscaNaEquipe bolinha={{ tamanho: TAMANHO_BOLINHA, motivoDesligado: motivoDoMais }} desligado={!!motivoDoMais} adicionar={comGrupos ? comGrupos.por : mudar.por}
      buscar={termo => comGrupos && mudar.cheia ? [] : mudar.candidatos(termo)} aoEscolher={m => void mudar.aoPor(m)} botao={mais}
      motivoSemPessoas={comGrupos ? mudar.cheia : undefined}
      grupos={comGrupos ? {
        buscar: termo => comGrupos.cheio ? [] : comGrupos.candidatos(termo), aoEscolher: g => void comGrupos.aoPor(g),
        nome: g => nomeDoGrupo(g, grupos.equipe), texto: g => `${g.nome} · ${numeroDoGrupo(g, grupos.equipe)}`, motivo: comGrupos.cheio ? GRUPOS_DEMAIS : undefined
      } : undefined} />}
  </div>;
}

/**
 * A bolinha do responsável: para quem altera, abre o menu dele, com o "Trocar o responsável" (sem responsável, vazia, abre direto a
 * escolha de um); para quem só vê, o nome na dica.
 */
function BolinhaDoResponsavel({ responsavel, mudar, botao, itens }: {
  responsavel: PessoaDaEquipe | null; mudar?: MudarAEquipe; botao: RefObject<HTMLButtonElement | null>; itens: ItemDoMenu[];
}) {
  if (!mudar) return <SoParaVer dica={responsavel ? quemE(responsavel) : SEM_RESPONSAVEL} rotulo={responsavel ? nomeDaBolinha(responsavel) : SEM_RESPONSAVEL}
    vazia={!responsavel}><Bolinha p={responsavel} /></SoParaVer>;
  if (responsavel) return <BolinhaComMenu p={responsavel} itens={itens} botao={botao}
    busca={{ buscar: mudar.responsaveis, aoEscolher: m => void mudar.aoTrocarResponsavel(m) }} />;
  return <BuscaNaEquipe adicionar={TROCAR_O_RESPONSAVEL} buscar={mudar.responsaveis} desligado={!!mudar.ocupado} aoEscolher={m => void mudar.aoTrocarResponsavel(m)}
    botao={botao} bolinha={{
      tamanho: TAMANHO_BOLINHA, motivoDesligado: mudar.ocupado ? GRAVANDO_A_EQUIPE : undefined, classe: 'equipe-bolinha vazia',
      conteudo: <Bolinha p={null} />, dica: `${SEM_RESPONSAVEL}. Clique para escolher.`, rotulo: `${SEM_RESPONSAVEL}. Escolher o responsável`,
      semCandidatos: { dica: `${SEM_RESPONSAVEL}. ${NINGUEM_PARA_ASSUMIR}`, rotulo: SEM_RESPONSAVEL }
    }} />;
}

/**
 * A bolinha de quem altera (#388): o clique abre o menu com o nome, o papel e as ações. O "Trocar o responsável" fecha o menu e abre
 * a busca, presa à mesma bolinha. Esc ou o clique fora fecham o menu, e o foco volta à bolinha (no clique fora, se não foi parar em
 * outro botão ou campo).
 */
function BolinhaComMenu({ p, itens, botao, busca }: {
  p: PessoaDaEquipe; itens: ItemDoMenu[]; botao?: RefObject<HTMLButtonElement | null>;
  /** A busca de trocar o responsável, que o "Trocar o responsável" abre. */
  busca?: { buscar: (termo: string) => Membro[]; aoEscolher: (m: Membro) => void };
}) {
  const proprio = useRef<HTMLButtonElement>(null);
  const ref = botao ?? proprio;
  const [aberto, setAberto] = useState<{ botao: HTMLElement; o: 'menu' | 'busca' } | null>(null);
  // A pessoa escolheu uma ação: quem a faz cuida do foco (o menu fecha pelo mesmo clique, e não devolve o foco à bolinha).
  // Volta a false a cada menu aberto: no navegador, o menu some antes de o clique na ação chegar à página, e o fecharOMenu
  // daquele clique não roda; sem isso, o próximo clique fora não devolveria o foco à bolinha.
  const escolheu = useRef(false);
  function abrirOuFechar(b: HTMLElement) {
    escolheu.current = false;
    setAberto(a => a ? null : { botao: b, o: 'menu' });
  }
  const devolverFoco = () => setTimeout(() => ref.current?.focus(), 0);
  function escolher(i: ItemDoMenu) {
    escolheu.current = true;
    setAberto(a => a && i.abreABusca ? { botao: a.botao, o: 'busca' } : null);
    i.fazer?.();
  }
  function fecharOMenu() {
    // A busca que o menu acabou de abrir fica aberta (o clique que a abriu também fecha o menu).
    setAberto(a => a?.o === 'menu' ? null : a);
    if (escolheu.current) { escolheu.current = false; return; }
    // No clique fora, o foco que ficou sem lugar (na página, ou no cartão em volta da bolinha) volta a ela.
    setTimeout(() => {
      const foco = document.activeElement, b = ref.current;
      if (b && (!foco || foco === document.body || foco.contains(b))) b.focus();
    }, 0);
  }
  // O mesmo motivo (ex.: "Gravando a mudança na equipe…") aparece uma vez só, no lugar da primeira ação que ele impede.
  const visiveis = itens.filter((i, n) => !i.motivo || itens.findIndex(x => x.motivo === i.motivo) === n);
  return <>
    <button ref={ref} type="button" className="equipe-bolinha" aria-label={nomeDaBolinha(p)} {...propsDaDica(quemE(p))}
      aria-haspopup="menu" aria-expanded={!!aberto} onClick={e => abrirOuFechar(e.currentTarget)}>
      <Bolinha p={p} />
    </button>
    {aberto?.o === 'menu' && <MenuFlutuante botao={aberto.botao} rotulo={nomeDaBolinha(p)} aoFechar={fecharOMenu}>
      <p className="kmenu-titulo equipe-menu-titulo"><b>{p.nome}</b><span>{p.papel}</span></p>
      {visiveis.map(i => <ItemDaBolinha key={i.acao} item={i} aoEscolher={() => escolher(i)} />)}
    </MenuFlutuante>}
    {aberto?.o === 'busca' && busca && <BuscaPresa botao={aberto.botao} adicionar={TROCAR_O_RESPONSAVEL} buscar={busca.buscar}
      aoEscolher={m => { setAberto(null); devolverFoco(); busca.aoEscolher(m); }}
      fechar={foco => { setAberto(null); if (foco) devolverFoco(); }} />}
  </>;
}

/** Uma ação do menu da bolinha: o botão (o "Tirar" em vermelho), o link do perfil ou, impedida, o motivo no lugar dela. */
function ItemDaBolinha({ item, aoEscolher }: { item: ItemDoMenu; aoEscolher: () => void }) {
  if (item.motivo) return <p className="kmenu-nota">{item.motivo}</p>;
  const miolo = <><Icone nome={item.icone} tam={ICONE_DO_MENU} /> {item.rotulo}</>;
  if (item.para) return <Link role="menuitem" to={item.para} onClick={aoEscolher}>{miolo}</Link>;
  return <button type="button" role="menuitem" className={item.perigo ? 'perigo' : undefined} onClick={aoEscolher}>{miolo}</button>;
}

/** A bolinha com as iniciais (e a cor) de quem está no cartão; sem ninguém, o ícone de pessoa, para a bolinha vazia. */
function Bolinha({ p }: { p: PessoaDaEquipe | null }) {
  if (!p) return <Icone nome="conta" tam={ICONE_DA_VAZIA} />;
  // Sem a dica do próprio Avatar: a da bolinha (o nome e o papel) é a única, e a do navegador não a contradiz.
  return <Avatar p={{ id: p.id, nome: p.nome, cor: p.cor }} tam={TAMANHO_BOLINHA} semDica />;
}

/** A bolinha de quem só vê: sem ação, mas com o nome na dica, que também aparece no foco do teclado. */
function SoParaVer({ dica, rotulo, vazia = false, children }: { dica: string; rotulo: string; vazia?: boolean; children: ReactNode }) {
  return <span className={'equipe-bolinha so-ver' + (vazia ? ' vazia' : '')} role="img" aria-label={rotulo} tabIndex={0} {...propsDaDica(dica)}
    style={vazia ? { width: TAMANHO_BOLINHA, height: TAMANHO_BOLINHA } : undefined}>{children}</span>;
}
