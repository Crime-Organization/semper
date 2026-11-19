// O desenho de um comentário (#360): a bolinha e o nome de quem escreveu, quando, um detalhe opcional na mesma linha e, embaixo,
// o que vem dentro (o texto do comentário, com as ações dele, ou o balão de uma anotação). Os comentários do cartão
// (ui/Comentarios.tsx) e as anotações na coluna do cartão de um item (paginas/AnotacoesDoCartao.tsx) usam esta peça, para os dois
// continuarem com a mesma cara. Quem a usa põe a peça dentro do item dele (o <li> do comentário, o link da anotação).
import type { ReactNode } from 'react';
import type { Membro } from '../dados';
import { Avatar } from './Avatar';
import { useCtx } from './sessao';
import { dataHora, relativo } from './util';

/** O tamanho da bolinha de quem escreveu, nos comentários e nas anotações da coluna do cartão. */
export const BOLINHA_DO_COMENTARIO = 28;
/** Quem escreveu está marcado, mas saiu da equipe. */
export const USUARIO_REMOVIDO = 'Usuário removido';
/** Ninguém está marcado como quem escreveu (a conta foi apagada, ou o item veio de fora do SEMPER). */
export const SEM_AUTOR = 'Sem autor';

/** O nome de quem escreveu, como a cabeça do comentário o mostra. */
export function nomeDoAutor(equipe: Pick<Membro, 'id' | 'nome'>[], autorId: string | null) {
  if (!autorId) return SEM_AUTOR;
  return equipe.find(m => m.id === autorId)?.nome ?? USUARIO_REMOVIDO;
}

interface Props {
  /** Quem escreveu (null: ninguém marcado). */
  autorId: string | null;
  /** Quando (a data e a hora vão na dica; à vista, há quanto tempo). */
  quando: string;
  /** O que vem antes do "há quanto tempo", com a primeira letra maiúscula (ex.: "Atualizada": "Atualizada há 2 h"). */
  antesDoQuando?: string;
  /** O que vem logo depois (ex.: " (editado)"). */
  depoisDoQuando?: string;
  /** O que vai no fim da linha de cima (ex.: o código e o selo "Arquivada"). */
  extra?: ReactNode;
  /** A bolinha sem o nome na dica nem para o leitor de tela (o nome já está ao lado, e o todo é um link). */
  bolinhaSemDica?: boolean;
  /** O id da linha de cima, para quem a usa como descrição (aria-describedby). */
  idDaCabeca?: string;
  children: ReactNode;
}

export function ComoComentario({ autorId, quando, antesDoQuando, depoisDoQuando, extra, bolinhaSemDica = false, idDaCabeca, children }: Props) {
  const ctx = useCtx();
  const autor = autorId ? ctx.equipe.find(m => m.id === autorId) : undefined;
  return <>
    <Avatar p={autor} tam={BOLINHA_DO_COMENTARIO} semDica={bolinhaSemDica} />
    <div className="comentario-miolo">
      {/* Os espaços entre as partes não mudam o desenho (a linha é flex, com o vão dela), mas o leitor de tela lê uma de cada vez. */}
      <div className="comentario-cabeca" id={idDaCabeca}>
        <b>{nomeDoAutor(ctx.equipe, autorId)}</b>{' '}
        <span className="nota" title={dataHora(quando)}>{antesDoQuando ? `${antesDoQuando} ${relativo(quando)}` : relativo(quando)}{depoisDoQuando}</span>
        {extra && <>{' '}{extra}</>}
      </div>
      {children}
    </div>
  </>;
}
