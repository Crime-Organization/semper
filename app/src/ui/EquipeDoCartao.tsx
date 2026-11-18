// A equipe de um cartão (tarefa, demanda, contrato...) em bolinhas com as iniciais, à direita dos botões do cartão:
// primeiro o responsável e, depois de um pequeno traço, os participantes. Clicar numa bolinha mostra o nome completo, o papel e
// o link para o cartão da pessoa. Peça comum: todo cartão com equipe a mostra assim.
// Para quem pode alterar o cartão (#356), depois dos participantes vem a bolinha com "+", que abre a busca só na equipe
// (BuscaNaEquipe), e a ficha de cada bolinha ganha a ação: tirar o participante, ou trocar o responsável. Quem só lê vê as
// bolinhas como antes, só para ver.
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Membro } from '../dados';
import { Avatar } from './Avatar';
import { BuscaNaEquipe } from './BuscaNaEquipe';
import { Icone } from './Icone';
import { MenuFlutuante } from './Menu';

/** Tamanho das bolinhas da equipe no cartão (maiores que as do quadro, para clicar com folga). Vale também para a do "+". */
const TAMANHO_BOLINHA = 34;
/** Tamanho dos ícones das ações na ficha da bolinha (como nos outros menus). */
const ICONE_DA_ACAO = 15;
/** A dica do "+" enquanto uma mudança na equipe ainda grava. */
const GRAVANDO_A_EQUIPE = 'Gravando a mudança na equipe…';

export interface PessoaDaEquipe {
  /** O usuário (dá a cor e as iniciais da bolinha). */
  id: string;
  nome: string;
  cor?: string | null;
  /** O papel no cartão, por extenso (ex.: "Responsável", "Participante · 10%"). */
  papel: string;
  /** Endereço do cartão da pessoa, se ela tem um. */
  para?: string;
}

/** Um usuário da equipe no papel dele no cartão, com o link para o cartão da pessoa ligada a ele. */
export function naEquipe(equipe: Membro[], perfilId: string, papel: string): PessoaDaEquipe {
  const m = equipe.find(x => x.id === perfilId);
  return { id: perfilId, nome: m?.nome || 'Usuário removido', cor: m?.cor, papel, para: m?.pessoa_id ? '/pessoas/?id=' + m.pessoa_id : undefined };
}

/** O que muda a equipe ali mesmo, no topo do cartão (#356). Quem usa grava (com as regras do lápis do módulo) e relê o cartão. */
export interface MudarAEquipe {
  /** O nome da bolinha com "+": "Pôr participante". */
  por: string;
  /** Quem a busca do "+" acha: os integrantes ativos que ainda não estão no cartão. */
  candidatos: (termo: string) => Membro[];
  /** Quem a busca de trocar o responsável acha: os integrantes ativos, menos o responsável de agora. */
  responsaveis: (termo: string) => Membro[];
  /** O texto da ação na ficha de um participante: "Tirar da tarefa" (ou "Sair da tarefa", na própria bolinha). */
  tirar: (p: PessoaDaEquipe) => string;
  /** A lista chegou ao máximo: o "+" fica desligado, com este motivo na dica. */
  cheia?: string;
  /** Uma mudança ainda grava: o "+" e as ações das fichas ficam desligados até ela terminar, para uma não apagar a outra. */
  ocupado?: boolean;
  aoPor: (m: Membro) => unknown;
  aoTirar: (p: PessoaDaEquipe) => unknown;
  aoTrocarResponsavel: (m: Membro) => unknown;
}

interface Props {
  responsavel: PessoaDaEquipe;
  participantes: PessoaDaEquipe[];
  /** Sem isto, as bolinhas são só para ver (quem só lê o cartão, o cartão arquivado, o contrato). */
  mudar?: MudarAEquipe;
}

export function EquipeDoCartao({ responsavel, participantes, mudar }: Props) {
  // Depois de tirar alguém, a bolinha dele some: o foco vai à bolinha do "+" (que, desligada, continua no Tab), e o teclado não se perde.
  const mais = useRef<HTMLButtonElement>(null);
  const focarNoMais = () => setTimeout(() => mais.current?.focus(), 0);
  const motivoDoMais = mudar?.ocupado ? GRAVANDO_A_EQUIPE : mudar?.cheia;
  return <div className="equipe-cartao" role="group" aria-label="Equipe">
    <Bolinha p={responsavel} acao={mudar && (fechar => <BuscaNaEquipe adicionar="Trocar o responsável" buscar={mudar.responsaveis}
      desligado={mudar.ocupado} aoEscolher={m => { fechar(true); void mudar.aoTrocarResponsavel(m); }} />)} />
    {(participantes.length > 0 || mudar) && <span className="equipe-traco" aria-hidden="true" />}
    {participantes.length > 0 && <span className="equipe-participantes">
      {participantes.map(p => <Bolinha key={p.id} p={p} acao={mudar && (fechar => <button type="button" disabled={mudar.ocupado} onClick={() => {
        fechar(false);
        focarNoMais();
        void mudar.aoTirar(p);
      }}><Icone nome="fechar" tam={ICONE_DA_ACAO} /> {mudar.tirar(p)}</button>)} />)}
    </span>}
    {mudar && <BuscaNaEquipe bolinha={{ tamanho: TAMANHO_BOLINHA, motivoDesligado: motivoDoMais }} desligado={!!motivoDoMais} adicionar={mudar.por}
      buscar={mudar.candidatos} aoEscolher={m => void mudar.aoPor(m)} botao={mais} />}
  </div>;
}

/** A ação da ficha: recebe como fechá-la (true: o foco volta à bolinha, que continua no lugar). */
type AcaoDaFicha = (fechar: (voltarFoco: boolean) => void) => ReactNode;

function Bolinha({ p, acao }: { p: PessoaDaEquipe; acao?: AcaoDaFicha }) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const proprio = useRef<HTMLButtonElement>(null);
  const membro: Partial<Membro> = { id: p.id, nome: p.nome, cor: p.cor };
  const fechar = (voltarFoco: boolean) => {
    setBotao(null);
    if (voltarFoco) setTimeout(() => proprio.current?.focus(), 0);
  };
  return <>
    <button ref={proprio} type="button" className="equipe-bolinha" aria-label={`${p.nome}, ${p.papel}`} title={p.nome} aria-haspopup="dialog" aria-expanded={!!botao}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Avatar p={membro} tam={TAMANHO_BOLINHA} />
    </button>
    {botao && <MenuFlutuante botao={botao} painel rotulo={p.nome} aoFechar={() => setBotao(null)}>
      <div className="equipe-ficha">
        <Avatar p={membro} tam={TAMANHO_BOLINHA} />
        <span><b>{p.nome}</b><small>{p.papel}</small></span>
      </div>
      {p.para && <Link className="equipe-ficha-link" to={p.para}>Abrir o cartão da pessoa</Link>}
      {/* "pergunta": a busca de trocar o responsável tem o campo com a cara dos outros campos. */}
      {acao && <div className="equipe-ficha-acao pergunta">{acao(fechar)}</div>}
    </MenuFlutuante>}
  </>;
}
