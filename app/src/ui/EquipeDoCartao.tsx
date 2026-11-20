// A equipe de um cartão (tarefa, demanda, contrato, anotação...) em bolinhas com as iniciais, à direita do topo do cartão:
// primeiro o responsável e, depois de um pequeno traço, os participantes. O nome de cada um aparece na dica, ao passar o mouse
// e no foco do teclado. Peça comum: todo cartão com equipe a mostra assim.
// Para quem pode alterar o cartão (#356), cada bolinha já é a ação, sem ficha nem menu no meio: a do responsável abre direto a
// busca para trocá-lo (sem responsável, ela aparece vazia, tracejada, para escolher um); a de um participante o tira na hora,
// com o aviso no pé da tela e o Desfazer; e, depois dos participantes, a bolinha com "+" abre a busca só na equipe
// (BuscaNaEquipe) para pôr mais alguém. A bolinha cuja ação seria recusada (no contrato, sair dele sem poder) fica desligada, com
// o motivo na dica (`impedeTirar`, `impedeTrocar`). Quem só lê vê as bolinhas com o nome na dica, sem ação.
// Os grupos da equipe postos no item (#378) vêm depois dos participantes, em pílulas (GruposNoCartao), e o "+" acha também os
// grupos (a parte "Grupos da equipe" da busca). Sem grupos no escritório, nada disso aparece.
// Sem responsável principal (`semPrincipal`, #387: os responsáveis da pessoa, vários e todos iguais), só a lista: cada um é uma
// bolinha como a de um participante, sem a bolinha do responsável nem o traço, e o "+" põe mais um.
import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { GrupoDaEquipe, Membro } from '../dados';
import { GRUPOS_DEMAIS, nomeDoGrupo, numeroDoGrupo } from '../regras/gruposDaEquipe';
import { GruposNoCartao } from './GruposDoItem';
import { Avatar } from './Avatar';
import { propsDaDica } from './base';
import { BuscaNaEquipe } from './BuscaNaEquipe';
import { Icone } from './Icone';

/** Tamanho das bolinhas da equipe no cartão (maiores que as do quadro, para clicar com folga). Vale também para a do "+". */
const TAMANHO_BOLINHA = 34;
/** A mesma medida para o estilo (o vão entre as bolinhas no topo, no celular, em estilo.css): o número fica só aqui. */
const MEDIDA_DA_BOLINHA = { '--bolinha-da-equipe': TAMANHO_BOLINHA + 'px' } as CSSProperties;
/** Tamanho do ícone de pessoa dentro da bolinha vazia do responsável. */
const ICONE_DA_VAZIA = 16;
/** A dica do "+" enquanto uma mudança na equipe ainda grava. */
const GRAVANDO_A_EQUIPE = 'Gravando a mudança na equipe…';
/** O nome da busca que troca (ou escolhe) o responsável. */
const TROCAR_O_RESPONSAVEL = 'Trocar o responsável';
/** O que a bolinha vazia diz, quando o cartão está sem responsável. */
const SEM_RESPONSAVEL = 'Sem responsável';
/** Por que a bolinha do responsável não abre a busca: não há outra pessoa ativa na equipe para assumir. */
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
  /** O que a bolinha de um participante diz (o clique o tira): "Tirar Ana Souza", ou "Sair da tarefa (Ana Souza)", na própria. */
  tirar: (p: PessoaDaEquipe) => string;
  /** A lista chegou ao máximo: o "+" fica desligado, com este motivo na dica. */
  cheia?: string;
  /** Uma mudança ainda grava: as bolinhas ficam desligadas até ela terminar, para uma não apagar a outra. */
  ocupado?: boolean;
  /**
   * Por que a bolinha deste participante não o tira (no contrato, quem sairia deixaria de poder alterá-lo): ela fica desligada,
   * com o motivo na dica, em vez de oferecer uma ação que seria recusada. undefined: tira.
   */
  impedeTirar?: (p: PessoaDaEquipe) => string | undefined;
  aoPor: (m: Membro) => unknown;
  aoTirar: (p: PessoaDaEquipe) => unknown;
}

/** O que muda a equipe com responsável principal: a lista e, na bolinha do responsável, a troca. */
export interface MudarAEquipe extends MudarALista {
  /** Quem a busca de trocar o responsável acha: os integrantes ativos, menos o responsável de agora. */
  responsaveis: (termo: string) => Membro[];
  /** Por que a bolinha do responsável não abre a troca (no contrato, quem a passasse adiante ficaria de fora): o motivo na dica. */
  impedeTrocar?: string;
  aoTrocarResponsavel: (m: Membro) => unknown;
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

export function EquipeDoCartao(props: Props) {
  const { participantes, grupos } = props;
  const mudar: MudarALista | undefined = props.mudar;
  // Depois de tirar alguém, a bolinha dele some: o foco vai à bolinha do "+" (que, desligada, continua no Tab), e o teclado não se perde.
  const mais = useRef<HTMLButtonElement>(null);
  const focarNoMais = () => setTimeout(() => mais.current?.focus(), 0);
  // Só a lista, para quem só vê, e ninguém nela: nada a mostrar (nem um grupo vazio para o leitor de tela).
  if (props.semPrincipal && !mudar && !participantes.length && !grupos?.doItem.length) return null;
  // Com grupos no escritório, a lista de pessoas cheia não desliga o "+" enquanto houver grupo para pôr (e vice-versa).
  const comGrupos = mudar && grupos?.mudar;
  // O "+" só desliga sem pessoa e sem grupo para pôr; o motivo é o da lista cheia ou, sem ele, o dos grupos demais.
  const semPessoas = !!mudar?.cheia || !mudar?.candidatos('').length;
  const semGrupos = !(comGrupos && !comGrupos.cheio && comGrupos.candidatos('').length);
  const motivoComGrupos = semPessoas && semGrupos ? mudar?.cheia ?? (comGrupos?.cheio ? GRUPOS_DEMAIS : undefined) : undefined;
  const motivoDoMais = mudar?.ocupado ? GRAVANDO_A_EQUIPE : comGrupos ? motivoComGrupos : mudar?.cheia;
  // Desligada, a bolinha de um participante diz quem ele é e por quê; ligada, a ação ("Tirar Ana Souza").
  const motivoDoParticipante = (p: PessoaDaEquipe) => mudar?.ocupado ? GRAVANDO_A_EQUIPE : mudar?.impedeTirar?.(p);
  return <div className="equipe-cartao" role="group" aria-label="Equipe" style={MEDIDA_DA_BOLINHA}>
    {!props.semPrincipal && <>
      <BolinhaDoResponsavel responsavel={props.responsavel} mudar={props.mudar} />
      {(participantes.length > 0 || mudar || !!grupos?.doItem.length) && <span className="equipe-traco" aria-hidden="true" />}
    </>}
    {participantes.length > 0 && <span className="equipe-participantes">
      {participantes.map(p => {
        if (!mudar) return <SoParaVer key={p.id} dica={quemE(p)} rotulo={nomeDaBolinha(p)}><Bolinha p={p} /></SoParaVer>;
        const motivo = motivoDoParticipante(p), impede = mudar.ocupado ? undefined : motivo;
        return <button key={p.id} type="button" className="equipe-bolinha" aria-label={impede ? nomeDaBolinha(p) : mudar.tirar(p)}
          {...propsDaDica(impede ? `${quemE(p)} · ${impede}` : motivo ?? mudar.tirar(p))} aria-description={impede}
          aria-disabled={!!motivo || undefined} onClick={() => {
            if (motivo) return;
            focarNoMais();
            void mudar.aoTirar(p);
          }}><Bolinha p={p} /></button>;
      })}
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

/** A bolinha do responsável: para quem altera, abre a troca (sem responsável, vazia, para escolher um); para quem só vê, o nome na dica. */
function BolinhaDoResponsavel({ responsavel, mudar }: { responsavel: PessoaDaEquipe | null; mudar?: MudarAEquipe }) {
  if (!mudar) return <SoParaVer dica={responsavel ? quemE(responsavel) : SEM_RESPONSAVEL} rotulo={responsavel ? nomeDaBolinha(responsavel) : SEM_RESPONSAVEL}
    vazia={!responsavel}><Bolinha p={responsavel} /></SoParaVer>;
  // A bolinha do responsável que não pode ser passada adiante diz só quem ele é e o motivo, sem o "clique para trocar".
  const impedeTrocar = responsavel ? mudar.impedeTrocar : undefined;
  const motivoDoResponsavel = mudar.ocupado ? GRAVANDO_A_EQUIPE : impedeTrocar;
  return <BuscaNaEquipe adicionar={TROCAR_O_RESPONSAVEL} buscar={mudar.responsaveis} desligado={!!motivoDoResponsavel} aoEscolher={m => void mudar.aoTrocarResponsavel(m)}
    bolinha={{
      tamanho: TAMANHO_BOLINHA, motivoDesligado: motivoDoResponsavel, classe: 'equipe-bolinha' + (responsavel ? '' : ' vazia'),
      conteudo: <Bolinha p={responsavel} />,
      dica: responsavel ? (impedeTrocar ? quemE(responsavel) : `${quemE(responsavel)}. Clique para trocar.`) : `${SEM_RESPONSAVEL}. Clique para escolher.`,
      rotulo: responsavel ? (impedeTrocar ? nomeDaBolinha(responsavel) : `${nomeDaBolinha(responsavel)}. ${TROCAR_O_RESPONSAVEL}`) : `${SEM_RESPONSAVEL}. Escolher o responsável`,
      semCandidatos: responsavel ? { dica: `${quemE(responsavel)}. ${NINGUEM_PARA_ASSUMIR}`, rotulo: nomeDaBolinha(responsavel) }
        : { dica: `${SEM_RESPONSAVEL}. ${NINGUEM_PARA_ASSUMIR}`, rotulo: SEM_RESPONSAVEL }
    }} />;
}

/** A bolinha com as iniciais (e a cor) de quem está no cartão; sem ninguém, o ícone de pessoa, para a bolinha vazia. */
function Bolinha({ p }: { p: PessoaDaEquipe | null }) {
  if (!p) return <Icone nome="conta" tam={ICONE_DA_VAZIA} />;
  // Sem a dica do próprio Avatar: a da bolinha (o nome e a ação) é a única, e a do navegador não a contradiz.
  return <Avatar p={{ id: p.id, nome: p.nome, cor: p.cor }} tam={TAMANHO_BOLINHA} semDica />;
}

/** A bolinha de quem só vê: sem ação, mas com o nome na dica, que também aparece no foco do teclado. */
function SoParaVer({ dica, rotulo, vazia = false, children }: { dica: string; rotulo: string; vazia?: boolean; children: ReactNode }) {
  return <span className={'equipe-bolinha so-ver' + (vazia ? ' vazia' : '')} role="img" aria-label={rotulo} tabIndex={0} {...propsDaDica(dica)}
    style={vazia ? { width: TAMANHO_BOLINHA, height: TAMANHO_BOLINHA } : undefined}>{children}</span>;
}
