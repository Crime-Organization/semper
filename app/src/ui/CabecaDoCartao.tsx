// A cabeça dos cartões de item (#397, pedido do dono de 20/11), a mesma ordem em tarefa, demanda, processo (judicial e
// administrativo), compromisso, contrato e pessoa, num lugar só. De cima para baixo, na coluna da esquerda:
// 1. o topo (TopoDoCartao): a linha de cima (tipo, código, equipe, etiqueta, lápis e ⋯), a linha da Situação (com o ✓ Concluir na
//    tarefa e na demanda) e os selos das etiquetas;
// 2. o título;
// 3. os dados: a faixa das datas (na tarefa, com o tempo total à direita) e o bloco do tempo; logo depois deles, fora de edição, a
//    linha dos botões rápidos (AtalhosDoCartao: Datas, Checklist, Anotação, Ligação);
// 4. a descrição (no processo, o número), depois dos dados.
// O cartão sem dados (o processo e a pessoa, que só teriam a criação, já no rodapé; o contrato de quem não vê os valores) não os
// passa: aí a descrição vem logo depois do título, e os botões rápidos depois dela, e não entre o título e o número do processo.
// Depois da cabeça, o "Expandir tudo" da esquerda fica sozinho, acima da primeira seção (Recolhivel, #394), e as seções.
// Bloco sem nada (a faixa que some, o cartão sem descrição) não deixa buraco: o envoltório some. Os vãos entre
// os blocos (#396) vêm das variáveis de estilo.css (--vao-do-topo-a-situacao, --vao-ate-o-titulo, --vao-do-titulo-aos-dados,
// --vao-dos-dados-a-descricao), num lugar só.
import type { ReactNode } from 'react';
import { AtalhosDoCartao } from './AtalhosDoCartao';

interface Props {
  /** O topo do cartão (TopoDoCartao), com a Situação e as etiquetas. */
  topo: ReactNode;
  /** O título (TituloEditavel ou o h2 do contrato e da pessoa, com o que vai logo abaixo dele, como o nome fantasia). */
  titulo: ReactNode;
  /** Os dados: a faixa das datas e o bloco do tempo. */
  dados?: ReactNode;
  /** A descrição (no processo, o número). */
  descricao?: ReactNode;
  /** Em edição (o lápis aberto): sem os botões rápidos (a Situação já some no topo). */
  editando?: boolean;
}

export function CabecaDoCartao({ topo, titulo, dados, descricao, editando = false }: Props) {
  const atalhos = !editando && <AtalhosDoCartao />;
  return <header className="cartao-cabeca">
    {topo}
    <div className="cartao-cabeca-titulo">{titulo}</div>
    {dados && <div className="cartao-cabeca-dados">{dados}{atalhos}</div>}
    {descricao && <div className="cartao-cabeca-descricao">{descricao}</div>}
    {!dados && atalhos}
  </header>;
}
