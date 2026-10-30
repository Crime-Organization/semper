// A equipe de um cartão (tarefa, demanda, contrato...) em bolinhas com as iniciais, à direita dos botões do cartão:
// primeiro o responsável e, depois de um pequeno traço, os participantes. Clicar numa bolinha mostra o nome completo, o papel e
// o link para o cartão da pessoa. Peça comum: todo cartão com equipe a mostra assim.
import { useState } from 'react';
import { Link } from 'react-router';
import type { Membro } from '../dados';
import { Avatar } from './Avatar';
import { MenuFlutuante } from './Menu';

/** Tamanho das bolinhas da equipe no cartão (maiores que as do quadro, para clicar com folga). */
const TAMANHO_BOLINHA = 34;

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

interface Props {
  responsavel: PessoaDaEquipe;
  participantes: PessoaDaEquipe[];
}

export function EquipeDoCartao({ responsavel, participantes }: Props) {
  return <div className="equipe-cartao" role="group" aria-label="Equipe">
    <Bolinha p={responsavel} />
    {participantes.length > 0 && <span className="equipe-traco" aria-hidden="true" />}
    {participantes.length > 0 && <span className="equipe-participantes">
      {participantes.map(p => <Bolinha key={p.id} p={p} />)}
    </span>}
  </div>;
}

function Bolinha({ p }: { p: PessoaDaEquipe }) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const membro: Partial<Membro> = { id: p.id, nome: p.nome, cor: p.cor };
  return <>
    <button type="button" className="equipe-bolinha" aria-label={`${p.nome}, ${p.papel}`} title={p.nome} aria-expanded={!!botao}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Avatar p={membro} tam={TAMANHO_BOLINHA} />
    </button>
    {botao && <MenuFlutuante botao={botao} painel rotulo={p.nome} aoFechar={() => setBotao(null)}>
      <div className="equipe-ficha">
        <Avatar p={membro} tam={TAMANHO_BOLINHA} />
        <span><b>{p.nome}</b><small>{p.papel}</small></span>
      </div>
      {p.para && <Link className="equipe-ficha-link" to={p.para}>Abrir o cartão da pessoa</Link>}
    </MenuFlutuante>}
  </>;
}
