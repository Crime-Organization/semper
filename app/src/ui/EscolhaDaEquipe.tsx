// Quem da equipe está num item (participantes da tarefa e do compromisso, colaboradores da demanda e do processo,
// responsáveis da pessoa), no modelo de "Pessoas ligadas": aparecem só os escolhidos, cada um com o "X" para tirar, e o
// botão de adicionar abre uma busca (BuscaNaEquipe) que mostra só quem da equipe ativa ainda pode entrar. Assim a tela não
// lista o nome de todo o escritório o tempo todo (#282).
// Com `funcoes` (os participantes da tarefa, #313), cada escolhido tem ao lado a escolha da função dele.
import { useId, useRef, type ReactNode } from 'react';
import type { FuncaoNaTarefa, Membro } from '../dados/tipos';
import { candidatosDaEquipe } from '../regras/equipe';
import { Avatar } from './Avatar';
import { CampoDeVarios, idsDoCampoDeVarios } from './base';
import { BOLINHA_DA_EQUIPE, BuscaNaEquipe } from './BuscaNaEquipe';
import { Icone } from './Icone';

interface Props {
  /** O nome da lista: "Participantes", "Colaboradores"… */
  rotulo: string;
  dica?: ReactNode;
  erro?: string;
  equipe: Membro[];
  /** Os ids de quem já está na lista, na ordem em que entraram. */
  escolhidos: string[];
  /** Quem não pode entrar além dos escolhidos (o responsável, que já está no item por outro caminho). */
  fora?: string[];
  aoMudar: (ids: string[]) => void;
  /** O texto do botão: "Adicionar participante". */
  adicionar: string;
  /** A função de cada escolhido (#313): as opções, a de cada um (id do escolhido → id da função) e a troca. */
  funcoes?: { opcoes: readonly FuncaoNaTarefa[]; de: Readonly<Record<string, string>>; aoMudar: (id: string, funcao: string) => void };
}

export function EscolhaDaEquipe({ rotulo, dica, erro, equipe, escolhidos, fora = [], aoMudar, adicionar, funcoes }: Props) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const grupo = useRef<HTMLDivElement>(null);

  const jaNaLista = [...escolhidos, ...fora];
  // Depois de tirar alguém, o foco vai ao botão de adicionar ou, se não sobrou ninguém para entrar, ao grupo: o teclado não se perde.
  const tirar = (x: string) => {
    aoMudar(escolhidos.filter(e => e !== x));
    setTimeout(() => (botao.current ?? grupo.current)?.focus(), 0);
  };

  const membro = (x: string) => equipe.find(m => m.id === x);
  const ids = idsDoCampoDeVarios(id);
  return <CampoDeVarios rotulo={rotulo} dica={dica} erro={erro} id={id} grupo={grupo}>
    {escolhidos.length > 0 && <ul className="equipe-escolhida" aria-labelledby={ids.rotulo}>
      {escolhidos.map(x => {
        const m = membro(x), nome = m?.nome || 'Usuário removido';
        return <li key={x} className="escolhida">
          <span><span aria-hidden="true"><Avatar p={m ?? { id: x, nome }} tam={BOLINHA_DA_EQUIPE} /></span><span className="nome">{nome}{m?.ativo === false ? ' (desativado)' : ''}</span></span>
          {funcoes && funcoes.opcoes.length > 0 && <select className="funcao-do-participante" aria-label={`Função de ${nome}`} value={funcoes.de[x] ?? ''}
            onChange={e => funcoes.aoMudar(x, e.target.value)}>
            {!funcoes.opcoes.some(f => f.id === funcoes.de[x]) && <option value="">Sem função</option>}
            {funcoes.opcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>}
          <button type="button" className="icone-btn" aria-label={`Tirar ${nome}`} title={`Tirar ${nome}`} onClick={() => tirar(x)}>
            <Icone nome="fechar" tam={15} />
          </button>
        </li>;
      })}
    </ul>}
    <BuscaNaEquipe buscar={termo => candidatosDaEquipe(equipe, termo, jaNaLista)} aoEscolher={m => aoMudar([...escolhidos, m.id])}
      adicionar={adicionar} descricao={dica ? ids.dica : undefined} botao={botao} focoReserva={grupo} />
  </CampoDeVarios>;
}
