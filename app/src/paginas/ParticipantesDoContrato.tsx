// Os participantes do contrato, na etapa Divisão (#348): cada um numa linha, com a bolinha e o nome, o seu % sobre o líquido
// e o "X" para tirar; o "+ Adicionar participante" abre a busca só na equipe (BuscaNaEquipe, a mesma de EscolhaDaEquipe), sem
// quem já está no contrato. Quem saiu da equipe e já estava no contrato continua na lista, marcado, até alguém o tirar.
import { useId, useRef } from 'react';
import type { Membro } from '../dados/tipos';
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import type { CamposContrato } from '../regras/contrato';
import { candidatosAoContrato, participanteNaLista } from '../regras/equipe';
import { Avatar } from '../ui/Avatar';
import { BOLINHA_DA_EQUIPE, BuscaNaEquipe } from '../ui/BuscaNaEquipe';
import { Icone } from '../ui/Icone';

interface Props {
  equipe: Membro[];
  /** As linhas do formulário: a pessoa (pelo id do cadastro) e o % de cada participante, na ordem. */
  linhas: CamposContrato['participantes'];
  /** O nome de cada participante no cadastro em Pessoas, na mesma ordem (para quem não está mais na equipe). */
  nomes: string[];
  /** A chave de cada linha, para o React não trocar o % digitado ao tirar uma linha do meio. */
  chaves: number[];
  /** O indicador (id do cadastro), que não pode ser também participante. */
  indicadorId: string;
  erro?: string;
  aoAdicionar: (m: Membro) => void;
  aoTirar: (i: number) => void;
  aoMudarPercentual: (i: number, valor: string) => void;
}

export function ParticipantesDoContrato({ equipe, linhas, nomes, chaves, indicadorId, erro, aoAdicionar, aoTirar, aoMudarPercentual }: Props) {
  const id = useId();
  const grupo = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const noContrato = [...linhas.map(p => p.pessoaId), indicadorId].filter(Boolean);
  // O participante novo entra no fim da lista: o foco vai ao % dele, que é o que falta preencher.
  const focarNoNovo = () => lista.current?.querySelector<HTMLInputElement>('li:last-child input')?.focus();
  // Depois de tirar alguém, o foco vai ao botão de adicionar ou, se ele não está, ao grupo: o teclado não se perde.
  const tirar = (i: number) => {
    aoTirar(i);
    setTimeout(() => (botao.current ?? grupo.current)?.focus(), 0);
  };

  return <div ref={grupo} tabIndex={-1} className={'pergunta' + (erro ? ' erro' : '')} role="group" aria-labelledby={id + 'r'}>
    <span className="rot" id={id + 'r'}>Participantes</span>
    <p className="dica" id={id + 'd'}>Quem da equipe trabalha no caso com o responsável, cada um com o seu % sobre o líquido.</p>
    {linhas.length > 0 && <ul className="lista-participantes" ref={lista} aria-labelledby={id + 'r'}>
      {linhas.map((p, i) => {
        const { nome, membro, situacao } = participanteNaLista(equipe, p.pessoaId, nomes[i] ?? '');
        return <li className="linha-participante" key={chaves[i]}>
          <span className="participante">
            <span aria-hidden="true"><Avatar p={membro ?? { id: p.pessoaId, nome }} tam={BOLINHA_DA_EQUIPE} /></span>
            <span className="nome">{nome}{situacao && <small> ({situacao})</small>}</span>
          </span>
          <label>%
            <input type="text" inputMode="decimal" placeholder="0" aria-label={`% do participante ${i + 1}`} value={p.percentual}
              aria-invalid={erro ? true : undefined} onChange={e => aoMudarPercentual(i, e.target.value)} />
          </label>
          <button type="button" className="icone-btn" aria-label={`Tirar ${nome}`} title={`Tirar ${nome}`} onClick={() => tirar(i)}>
            <Icone nome="fechar" tam={15} />
          </button>
        </li>;
      })}
    </ul>}
    <BuscaNaEquipe buscar={termo => candidatosAoContrato(equipe, termo, noContrato)} aoEscolher={aoAdicionar} adicionar="Adicionar participante"
      descricao={id + 'd'} botao={botao} focoReserva={grupo} focarAoEscolher={focarNoNovo} desligado={linhas.length >= PARTICIPANTES_MAXIMOS} />
    {erro && <span className="msg-erro" role="alert">{erro}</span>}
  </div>;
}
