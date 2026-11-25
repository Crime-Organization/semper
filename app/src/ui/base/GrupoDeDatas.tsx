// A faixa das datas do cartão (#361, redesenhada na #383), a mesma em todos os cartões (pessoa, contrato, demanda,
// processo, compromisso e anotação; a tarefa, desde a #442, tem o bloco "Prazo e tempo", em paginas/TempoNaTarefa.tsx): cada dado com o nome em cima, pequeno, numa linha só, e o valor embaixo, sem quebrar ("Sem prazo",
// "20/12/2030 às 14:30"). Os nomes ficam todos na mesma linha e os valores na de baixo, alinhados. Na faixa estreita (o celular),
// cada dado vira uma linha, com o nome à esquerda e o valor à direita, e os valores começam todos na mesma coluna. Quem decide é a
// largura da própria faixa (container query), nunca uma conta em JavaScript.
// O tempo da demanda (a soma do tempo nas tarefas dela) fica numa faixa própria, logo abaixo da das datas (#383): um dado largo,
// que ocupa a linha toda com o nome sempre em cima; o que vai na largura toda, embaixo dos dados, fica numa LinhaDoGrupo. A tarefa
// deixou de usar as duas faixas na #442.
// Desde a #422, as datas que se mudam ficam num resumo curto na faixa e abrem na janela das datas (JanelaDasDatas.tsx), que flutua
// sobre o cartão: nada do formulário fica dentro da faixa.
// FaixaDasDatas é a faixa das datas de um cartão (#385): a criação e as outras datas. Quando a criação seria a única, a faixa
// some, porque o rodapé de todo cartão já diz "Criada em … por …".
import { Children, useId, type ReactNode } from 'react';
import { dataDaCriacao } from '../../regras/dataDeInicio';
import './GrupoDeDatas.css';

/** A faixa: os dados lado a lado (as datas; na faixa do tempo, o dado largo) e, se houver, as linhas inteiras embaixo deles. */
export function GrupoDeDatas({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="grupo-datas" role="group" aria-label={rotulo}>
    <div className="grupo-datas-dados">{children}</div>
  </div>;
}

/** O nome da faixa das datas, para o leitor de tela. */
const ROTULO_DA_FAIXA = 'Datas do cartão';

interface PropsDaFaixa {
  /** A criação do item: o nome do dado ("Criada em", "Cadastrada em") e o instante gravado (o criado_em). */
  criacao: { rotulo: string; em: string };
  /** A criação depois das outras datas (no compromisso, a data e o horário dele vêm primeiro); sem isto, ela vem antes. */
  criacaoNoFim?: boolean;
  /** As outras datas do cartão (DadoDoGrupo). Sem nenhuma, a faixa some. */
  children?: ReactNode;
}

/**
 * A faixa das datas de um cartão (#385): a criação e as outras datas, lado a lado. Ela só aparece com mais de uma data: com a
 * criação sozinha (a pessoa, o processo, a anotação, o contrato de quem não vê os valores), a faixa some, porque o rodapé do
 * cartão já mostra a criação. Children.toArray descarta o que não vai à tela ({!oculto && …}): só conta o que aparece.
 */
export function FaixaDasDatas({ criacao, criacaoNoFim, children }: PropsDaFaixa) {
  const outras = Children.toArray(children);
  if (!outras.length) return null;
  const daCriacao = <DadoDoGrupo key="criacao" rotulo={criacao.rotulo}><b className="num">{dataDaCriacao(criacao.em)}</b></DadoDoGrupo>;
  return <GrupoDeDatas rotulo={ROTULO_DA_FAIXA}>{criacaoNoFim ? [...outras, daCriacao] : [daCriacao, ...outras]}</GrupoDeDatas>;
}

interface PropsDoDado {
  /** O nome do dado (ex.: "Prazo"), em cima do valor. */
  rotulo: string;
  /** O dado que precisa da linha toda (o cronômetro, com os botões ao lado dele): o nome sempre em cima, também no celular. */
  largo?: boolean;
  children: ReactNode;
}

/** Um dado da faixa: o nome em cima (ex.: "Datas") e o valor (o texto, o resumo das datas que se mudam, o cronômetro). */
export function DadoDoGrupo({ rotulo, largo, children }: PropsDoDado) {
  const id = useId();
  return <div className={'grupo-datas-dado' + (largo ? ' largo' : '')} role="group" aria-labelledby={id}>
    <span className="rotulo-caps grupo-datas-rotulo" id={id}>{rotulo}</span>{' '}
    <div className="grupo-datas-valor">{children}</div>
  </div>;
}

/** O que ocupa a largura toda da faixa, embaixo dos dados (ex.: o resumo de quem registrou tempo, embaixo do cronômetro). */
export function LinhaDoGrupo({ children }: { children: ReactNode }) {
  return <div className="grupo-datas-linha">{children}</div>;
}
