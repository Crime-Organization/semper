// A equipe de um cartão (tarefa, demanda, contrato, anotação...) em bolinhas com as iniciais, à direita do topo do cartão:
// primeiro o responsável e, depois de um pequeno traço, os participantes. O nome de cada um aparece na dica, ao passar o mouse
// e no foco do teclado. Peça comum: todo cartão com equipe a mostra assim.
// Para quem pode alterar o cartão (#356), cada bolinha já é a ação, sem ficha nem menu no meio: a do responsável abre direto a
// busca para trocá-lo (sem responsável, ela aparece vazia, tracejada, para escolher um); a de um participante o tira na hora,
// com o aviso no pé da tela e o Desfazer; e, depois dos participantes, a bolinha com "+" abre a busca só na equipe
// (BuscaNaEquipe) para pôr mais alguém. Quem só lê vê as bolinhas com o nome na dica, sem ação.
import { useRef, type ReactNode } from 'react';
import type { Membro } from '../dados';
import { Avatar } from './Avatar';
import { propsDaDica } from './base';
import { BuscaNaEquipe } from './BuscaNaEquipe';
import { Icone } from './Icone';

/** Tamanho das bolinhas da equipe no cartão (maiores que as do quadro, para clicar com folga). Vale também para a do "+". */
const TAMANHO_BOLINHA = 34;
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

/** O que muda a equipe ali mesmo, no topo do cartão (#356). Quem usa grava (com as regras do lápis do módulo) e relê o cartão. */
export interface MudarAEquipe {
  /** O nome da bolinha com "+": "Pôr participante". */
  por: string;
  /** Quem a busca do "+" acha: os integrantes ativos que ainda não estão no cartão. */
  candidatos: (termo: string) => Membro[];
  /** Quem a busca de trocar o responsável acha: os integrantes ativos, menos o responsável de agora. */
  responsaveis: (termo: string) => Membro[];
  /** O que a bolinha de um participante diz (o clique o tira): "Tirar Ana Souza", ou "Sair da tarefa (Ana Souza)", na própria. */
  tirar: (p: PessoaDaEquipe) => string;
  /** A lista chegou ao máximo: o "+" fica desligado, com este motivo na dica. */
  cheia?: string;
  /** Uma mudança ainda grava: as bolinhas ficam desligadas até ela terminar, para uma não apagar a outra. */
  ocupado?: boolean;
  aoPor: (m: Membro) => unknown;
  aoTirar: (p: PessoaDaEquipe) => unknown;
  aoTrocarResponsavel: (m: Membro) => unknown;
}

interface Props {
  /** null: o cartão está sem responsável (aparece a bolinha vazia). */
  responsavel: PessoaDaEquipe | null;
  participantes: PessoaDaEquipe[];
  /** Sem isto, as bolinhas são só para ver (quem só lê o cartão, o cartão arquivado, o contrato). */
  mudar?: MudarAEquipe;
}

/** A dica de quem só vê: o nome e o papel ("Ana Souza · Responsável"). */
const quemE = (p: PessoaDaEquipe) => `${p.nome} · ${p.papel}`;
/** O nome da bolinha para o leitor de tela: "Ana Souza, Responsável". */
const nomeDaBolinha = (p: PessoaDaEquipe) => `${p.nome}, ${p.papel}`;

export function EquipeDoCartao({ responsavel, participantes, mudar }: Props) {
  // Depois de tirar alguém, a bolinha dele some: o foco vai à bolinha do "+" (que, desligada, continua no Tab), e o teclado não se perde.
  const mais = useRef<HTMLButtonElement>(null);
  const focarNoMais = () => setTimeout(() => mais.current?.focus(), 0);
  const motivoDoMais = mudar?.ocupado ? GRAVANDO_A_EQUIPE : mudar?.cheia;
  return <div className="equipe-cartao" role="group" aria-label="Equipe">
    {mudar
      ? <BuscaNaEquipe adicionar={TROCAR_O_RESPONSAVEL} buscar={mudar.responsaveis} desligado={mudar.ocupado} aoEscolher={m => void mudar.aoTrocarResponsavel(m)}
        bolinha={{
          tamanho: TAMANHO_BOLINHA, motivoDesligado: mudar.ocupado ? GRAVANDO_A_EQUIPE : undefined, classe: 'equipe-bolinha' + (responsavel ? '' : ' vazia'),
          conteudo: <Bolinha p={responsavel} />,
          dica: responsavel ? `${quemE(responsavel)}. Clique para trocar.` : `${SEM_RESPONSAVEL}. Clique para escolher.`,
          rotulo: responsavel ? `${nomeDaBolinha(responsavel)}. ${TROCAR_O_RESPONSAVEL}` : `${SEM_RESPONSAVEL}. Escolher o responsável`,
          semCandidatos: responsavel ? { dica: `${quemE(responsavel)}. ${NINGUEM_PARA_ASSUMIR}`, rotulo: nomeDaBolinha(responsavel) }
            : { dica: `${SEM_RESPONSAVEL}. ${NINGUEM_PARA_ASSUMIR}`, rotulo: SEM_RESPONSAVEL }
        }} />
      : <SoParaVer dica={responsavel ? quemE(responsavel) : SEM_RESPONSAVEL} rotulo={responsavel ? nomeDaBolinha(responsavel) : SEM_RESPONSAVEL} vazia={!responsavel}><Bolinha p={responsavel} /></SoParaVer>}
    {(participantes.length > 0 || mudar) && <span className="equipe-traco" aria-hidden="true" />}
    {participantes.length > 0 && <span className="equipe-participantes">
      {participantes.map(p => mudar
        ? <button key={p.id} type="button" className="equipe-bolinha" aria-label={mudar.tirar(p)} {...propsDaDica(mudar.ocupado ? GRAVANDO_A_EQUIPE : mudar.tirar(p))}
          aria-disabled={mudar.ocupado || undefined} onClick={() => {
            if (mudar.ocupado) return;
            focarNoMais();
            void mudar.aoTirar(p);
          }}><Bolinha p={p} /></button>
        : <SoParaVer key={p.id} dica={quemE(p)} rotulo={nomeDaBolinha(p)}><Bolinha p={p} /></SoParaVer>)}
    </span>}
    {mudar && <BuscaNaEquipe bolinha={{ tamanho: TAMANHO_BOLINHA, motivoDesligado: motivoDoMais }} desligado={!!motivoDoMais} adicionar={mudar.por}
      buscar={mudar.candidatos} aoEscolher={m => void mudar.aoPor(m)} botao={mais} />}
  </div>;
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
