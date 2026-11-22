// As peças dos painéis (#401): o de Processos é o primeiro, e os do Início e do Financeiro seguem o mesmo desenho. Cada painel é
//   <CabecaDoPainel> (o título, de quem é o trabalho e o filtro do administrador)
//   <NumerosDoPainel> com <NumeroDoPainel> (os números grandes do alto, cada um levando à lista dele)
//   <Painel> com <CartaoDoPainel> (os gráficos e as listas, numa grade que se arruma sozinha no computador e no celular).
// O desenho vem do estilo.css (seção "painéis") e está descrito no DESIGN.md ("Painéis").
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Contador, Nota, TituloSecao } from '../base';
import { Icone } from '../Icone';

/** O título do painel, com o ponto verde, a frase de quem é o trabalho e, à direita, o filtro (só para o administrador). */
export function CabecaDoPainel({ titulo, frase, children }: { titulo: string; frase?: ReactNode; children?: ReactNode }) {
  return <header className="painel-topo">
    <div className="painel-topo-texto">
      <h1 className="titulo">{titulo}<span className="ponto">.</span></h1>
      {frase && <p className="painel-frase">{frase}</p>}
    </div>
    {children && <div className="painel-topo-filtro">{children}</div>}
  </header>;
}

/** A linha dos números grandes, no alto do painel: três por linha no computador, dois no celular. */
export function NumerosDoPainel({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="numeros-do-painel" role="group" aria-label={rotulo}>{children}</div>;
}

/** O tom do número: neutro; alerta (algo pede atenção); erro (algo passou da hora); bom. */
export type TomDoNumero = 'neutro' | 'alerta' | 'erro' | 'bom';
/** A comparação com outro período (ex.: "3 a mais que em outubro"): a seta e a cor dizem se é bom ou ruim. */
export interface VariacaoDoNumero { texto: string; seta: 'sobe' | 'desce'; tom: Exclude<TomDoNumero, 'alerta'> }
/** Uma parte do número que leva à lista dela (ex.: os judiciais e os administrativos dos processos ativos). */
export interface ParteDoNumero { chave: string; texto: string; para: string }

/** O tamanho das setas do número (a da variação e a de "leva à lista"). */
const ICONE_DA_VARIACAO = 14;

/** Um endereço da tela: "#..." é um lugar desta página; o resto, outra página do SEMPER. */
function Destino({ para, className, children, ...resto }: { para: string; className?: string; children: ReactNode; 'aria-describedby'?: string }) {
  return para.startsWith('#') ? <a href={para} className={className} {...resto}>{children}</a> : <Link to={para} className={className} {...resto}>{children}</Link>;
}

/**
 * Um número grande do alto do painel: o nome em cima, o número e, embaixo, o detalhe (ex.: "de hoje a 28/11"). Com "para", o número
 * inteiro leva à lista daquilo; com "partes", cada parte leva à sua (e o número em si não leva a lugar nenhum).
 */
export function NumeroDoPainel({ rotulo, valor, detalhe, para, tom = 'neutro', variacao, partes }: {
  rotulo: string; valor: number; detalhe?: ReactNode; para?: string; tom?: TomDoNumero; variacao?: VariacaoDoNumero; partes?: readonly ParteDoNumero[];
}) {
  const id = useId();
  const miolo = <>
    <span className="numero-do-painel-rotulo" id={id + '-rotulo'}>{rotulo}</span>
    <b className="numero-do-painel-valor">{valor.toLocaleString('pt-BR')}</b>
    {detalhe && <span className="numero-do-painel-detalhe">{detalhe}</span>}
    {variacao && <span className={'numero-do-painel-variacao ' + variacao.tom}>
      <Icone nome={variacao.seta === 'sobe' ? 'acima' : 'abaixo'} tam={ICONE_DA_VARIACAO} />{variacao.texto}
    </span>}
    {para && <span className="numero-do-painel-seta" aria-hidden="true"><Icone nome="seta" tam={ICONE_DA_VARIACAO} /></span>}
  </>;
  const classe = 'numero-do-painel ' + tom;
  if (para) return <Destino para={para} className={classe + ' com-destino'}>{miolo}</Destino>;
  return <section className={classe} aria-labelledby={id + '-rotulo'}>
    {miolo}
    {partes && <ul className="numero-do-painel-partes">
      {partes.map(p => <li key={p.chave}><Destino para={p.para}>{p.texto}</Destino></li>)}
    </ul>}
  </section>;
}

/** A grade dos cartões do painel. Cada cartão diz a largura que ocupa no computador; no celular, todos ocupam a linha inteira. */
export function Painel({ children }: { children: ReactNode }) {
  return <div className="painel">{children}</div>;
}

/** Quanto da linha o cartão ocupa no computador (no celular, sempre a linha inteira). */
export type LarguraDoCartao = 'inteira' | 'metade' | 'terco' | 'dois-tercos';

/**
 * Um cartão do painel: o título (um h2, que dá nome à região), uma nota opcional embaixo dele, um link ou botão à direita do título
 * ("acao") e o conteúdo (um gráfico ou uma lista). Com "id", os números do alto podem levar a ele ("#id"). "contador" é o número ao
 * lado do título (quantos itens a lista tem, #402); "ocupado", enquanto o conteúdo carrega (o leitor de tela fica sabendo).
 */
export function CartaoDoPainel({ titulo, id, nota, acao, contador, ocupado, largura = 'inteira', children }: {
  titulo: string; id?: string; nota?: ReactNode; acao?: ReactNode; contador?: string; ocupado?: boolean; largura?: LarguraDoCartao; children: ReactNode;
}) {
  const automatico = useId();
  const idDoTitulo = (id ?? automatico) + '-titulo';
  return <section id={id} className={'cartao painel-cartao ' + largura} aria-labelledby={idDoTitulo} aria-busy={ocupado || undefined}>
    <div className="painel-cartao-cabeca">
      <div className="painel-cartao-titulo">
        <TituloSecao id={idDoTitulo}>{titulo}</TituloSecao>
        {contador !== undefined && <Contador title="Quantos há">{contador}</Contador>}
      </div>
      {acao}
    </div>
    {nota && <Nota>{nota}</Nota>}
    {children}
  </section>;
}
