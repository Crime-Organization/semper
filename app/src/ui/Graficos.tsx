// Gráficos simples, desenhados à mão (sem biblioteca): barras em pé (por mês, por semana), barras deitadas (uma por coluna do
// quadro) e barras empilhadas por grupo. Cada um tem a legenda (quando há duas séries ou mais), a dica com o número exato ao passar
// o mouse, ao tocar ou pelas setas do teclado, e a tabela com os mesmos números (escondida, para o leitor de tela, ou aberta por
// "Ver os números"), para que nada dependa só da cor. As cores vêm das variáveis --grafico-* de estilo.css.
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';

/** "contorno": a cor da borda de uma série clara demais para o fundo (ex.: o que falta receber). */
export interface Serie { chave: string; nome: string; cor: string; contorno?: string }

function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return <ul className="grafico-legenda" aria-hidden="true">
    {series.map(s => <li key={s.chave}><span className="grafico-marca" style={{ background: s.cor, boxShadow: s.contorno ? `inset 0 0 0 1px ${s.contorno}` : undefined }} />{s.nome}</li>)}
  </ul>;
}

/** A tabela com os números do gráfico: escondida, só para o leitor de tela, ou, com "visivel", aberta por quem pede "Ver os números". */
function TabelaDoGrafico({ rotulo, colunas, linhas, visivel }: { rotulo: string; colunas: string[]; linhas: (string | ReactNode)[][]; visivel?: boolean }) {
  const tabela = <table aria-label={rotulo}>
    <thead><tr>{colunas.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => j ? <td key={j} className="num">{c}</td> : <th key={j} scope="row">{c}</th>)}</tr>)}</tbody>
  </table>;
  return visivel ? <details className="grafico-numeros"><summary>Ver os números</summary>{tabela}</details> : <div className="sr">{tabela}</div>;
}

// Medidas do desenho, em pixels de verdade: o SVG tem a largura medida do cartão, então o texto fica sempre com o
// tamanho da letra do resto da tela, em qualquer largura (computador ou celular).
const LARGURA_INICIAL = 600;   // antes da primeira medida
const ALTURA = 200, PE = 22, TOPO = 8, LINHAS_DA_GRADE = 3;
const ESPACO_DO_ROTULO = 16;   // acima da barra mais alta, para o número escrito na ponta dela
const VAO_ENTRE_BARRAS = 2;    // entre as barras de séries diferentes no mesmo mês
const BARRA_MINIMA = 4, BARRA_MAXIMA = 18;
const OCUPACAO_DO_GRUPO = 0.7; // quanto da largura de cada mês as barras ocupam
const RAIO_DA_BARRA = 3;
const AFASTAMENTO_DO_EIXO = 6; // entre o valor do eixo e a grade
const DESCIDA_DO_TEXTO = 4;    // para o texto ficar no meio da linha
const ESPACO_DO_MES = 6;       // entre o nome do mês e a borda de baixo
const LARGURA_DA_LETRA = 6.2;  // média de uma letra de 11px, para reservar o espaço dos valores do eixo
const EIXO_Y_MINIMO = 36;
const MES_COM_NOME_INTEIRO = 30; // abaixo desta largura por mês, só a inicial ("J", "F"...): o nome inteiro fica na dica e na tabela
const FOLGA_DO_NOME = 8;       // o nome do eixo só aparece inteiro se sobra isto em volta dele
/** Até onde, da borda, a dica fica encostada a ela (em vez de centrada na barra e cortada pela borda do cartão). */
const BORDA_DA_DICA = 0.25;

/** A largura de um elemento, medida e atualizada quando ele muda de tamanho. */
function useLargura<E extends Element>(): [RefObject<E | null>, number] {
  const ref = useRef<E>(null);
  const [largura, setLargura] = useState(LARGURA_INICIAL);
  // Mede antes de o navegador pintar (sem um instante com a largura errada) e acompanha as mudanças de tamanho.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const agora = Math.round(el.getBoundingClientRect().width);
    if (agora > 0) setLargura(agora);
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setLargura(Math.round(e.contentRect.width)); });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, largura];
}

/** As setas levam de uma barra à outra (e Home e End, à primeira e à última); Esc fecha a dica. */
const TECLAS_DAS_BARRAS: Record<string, (atual: number | null, quantas: number) => number | null> = {
  ArrowRight: (atual, quantas) => atual === null ? 0 : Math.min(quantas - 1, atual + 1),
  ArrowLeft: (atual, quantas) => atual === null ? quantas - 1 : Math.max(0, atual - 1),
  Home: () => 0,
  End: (_atual, quantas) => quantas - 1,
  Escape: () => null
};

/** O que cada barra (ou grupo de barras) mostra: o nome do eixo; "curto", quando o nome não cabe; "detalhe", na dica e na tabela. */
export interface ItemDoGrafico { nome: string; curto?: string; detalhe?: string }

/**
 * Barras em pé: cada item um grupo (um mês, uma semana), uma barra por série, lado a lado, a partir de uma linha de base. "valor" lê
 * o número de um item numa série; "formatar" escreve o valor (dica, tabela e ponta da barra) e "formatarCurto", o do eixo.
 * "corDoItem" troca a cor de um item (ex.: os prazos vencidos em destaque); "rotulos" escreve o número na ponta de cada barra
 * (para poucas barras); "tabelaVisivel" dá a quem vê a tabela dos números ("Ver os números").
 * "escalaInteira" é para contagens: as linhas da grade ficam em números inteiros.
 */
export function BarrasPorMes<T extends ItemDoGrafico>({ rotulo, itens, series, valor, formatar, formatarCurto, corDoItem, rotulos, tabelaVisivel, escalaInteira }: {
  rotulo: string; itens: T[]; series: Serie[]; valor: (item: T, serie: string) => number;
  formatar: (v: number) => string; formatarCurto: (v: number) => string;
  corDoItem?: (item: T) => string | undefined; rotulos?: boolean; tabelaVisivel?: boolean;
  /** Contagens (processos, prazos): o topo da escala sobe até as linhas da grade caírem em números inteiros. */
  escalaInteira?: boolean;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const idDaDica = useId();
  const maiorValor = Math.max(1, ...itens.flatMap(i => series.map(s => valor(i, s.chave))));
  const maior = escalaInteira ? Math.ceil(maiorValor / LINHAS_DA_GRADE) * LINHAS_DA_GRADE : maiorValor;
  const marcas = Array.from({ length: LINHAS_DA_GRADE + 1 }, (_, i) => (maior / LINHAS_DA_GRADE) * i);
  const eixoY = Math.max(EIXO_Y_MINIMO, Math.ceil(Math.max(...marcas.map(v => formatarCurto(v).length)) * LARGURA_DA_LETRA) + AFASTAMENTO_DO_EIXO * 2);
  const topo = TOPO + (rotulos ? ESPACO_DO_ROTULO : 0);
  const area = { x: eixoY, y: topo, l: largura - eixoY, a: ALTURA - topo - PE };
  const grupo = area.l / Math.max(1, itens.length);
  const barra = Math.max(BARRA_MINIMA, Math.min(BARRA_MAXIMA, (grupo * OCUPACAO_DO_GRUPO - VAO_ENTRE_BARRAS * (series.length - 1)) / series.length));
  const y = (v: number) => area.y + area.a - (v / maior) * area.a;
  const nomeNoEixo = (item: T) => grupo >= Math.max(MES_COM_NOME_INTEIRO, item.nome.length * LARGURA_DA_LETRA + FOLGA_DO_NOME) ? item.nome : item.curto ?? item.nome.slice(0, 1);
  const titulo = (item: T) => item.detalhe ?? item.nome;
  const corDa = (item: T, s: Serie) => corDoItem?.(item) ?? s.cor;

  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    const proxima = TECLAS_DAS_BARRAS[e.key];
    if (!proxima || !itens.length) return;
    e.preventDefault();
    setAtivo(proxima(ativo, itens.length));
  }
  const item = ativo === null ? null : itens[ativo];
  const centro = ativo === null ? 0 : area.x + grupo * ativo + grupo / 2;
  const lado = centro < largura * BORDA_DA_DICA ? 'esquerda' : centro > largura * (1 - BORDA_DA_DICA) ? 'direita' : 'centro';
  const alturaDaDica = item ? y(Math.max(...series.map(s => valor(item, s.chave)))) - (rotulos ? ESPACO_DO_ROTULO : 0) : 0;

  return <figure className="grafico" aria-label={rotulo}>
    <Legenda series={series} />
    {/* Um lugar só no Tab para o gráfico todo: as setas passam de uma barra à outra, e a dica diz o número (o leitor de tela ouve). */}
    <div ref={ref} className="grafico-area" tabIndex={0} role="group" aria-label={`${rotulo}. Use as setas para ler cada barra.`}
      aria-describedby={item ? idDaDica : undefined} onKeyDown={tecla} onBlur={() => setAtivo(null)}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setAtivo(null); }}>
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} width={largura} height={ALTURA} className={'grafico-svg' + (item ? ' com-ativo' : '')} role="presentation" aria-hidden="true">
        {marcas.map((v, i) => {
          const yy = y(v);
          return <g key={i}>
            <line x1={area.x} x2={largura} y1={yy} y2={yy} className={i ? 'grafico-grade' : 'grafico-base'} />
            <text x={area.x - AFASTAMENTO_DO_EIXO} y={yy + DESCIDA_DO_TEXTO} textAnchor="end" className="grafico-eixo">{formatarCurto(v)}</text>
          </g>;
        })}
        {itens.map((it, i) => {
          const inicio = area.x + grupo * i + (grupo - (barra * series.length + VAO_ENTRE_BARRAS * (series.length - 1))) / 2;
          return <g key={it.nome} className={ativo === i ? 'ativo' : undefined}>
            {series.map((s, j) => {
              const v = valor(it, s.chave), alto = Math.max(0, area.y + area.a - y(v)), x = inicio + j * (barra + VAO_ENTRE_BARRAS);
              return <g key={s.chave}>
                <rect className="grafico-barra" x={x} y={y(v)} width={barra} height={alto} rx={Math.min(RAIO_DA_BARRA, barra / 2)} style={{ fill: corDa(it, s) }} />
                {rotulos && <text x={x + barra / 2} y={y(v) - AFASTAMENTO_DO_EIXO} textAnchor="middle" className="grafico-rotulo">{formatar(v)}</text>}
              </g>;
            })}
            <text x={area.x + grupo * i + grupo / 2} y={ALTURA - ESPACO_DO_MES} textAnchor="middle" className="grafico-eixo">{nomeNoEixo(it)}</text>
            {/* O alvo do mouse e do toque: a faixa inteira do item, maior que a barra. */}
            <rect className="grafico-alvo" x={area.x + grupo * i} y={0} width={grupo} height={ALTURA}
              onPointerEnter={() => setAtivo(i)} onPointerDown={() => setAtivo(i)} />
          </g>;
        })}
      </svg>
      {item && <div id={idDaDica} className={'grafico-dica ' + lado} role="status" style={{ left: centro, top: alturaDaDica }}>
        <span className="grafico-dica-titulo">{titulo(item)}</span>
        {series.map(s => <span key={s.chave} className="grafico-dica-linha">
          <i className="grafico-dica-traco" style={{ background: corDa(item, s) }} aria-hidden="true" /><b className="num">{formatar(valor(item, s.chave))}</b>{s.nome}
        </span>)}
      </div>}
    </div>
    <TabelaDoGrafico rotulo={rotulo} colunas={['', ...series.map(s => s.nome)]} linhas={itens.map(i => [titulo(i), ...series.map(s => formatar(valor(i, s.chave)))])} visivel={tabelaVisivel} />
  </figure>;
}

/** Uma barra deitada: o nome, o número e, com "para", o endereço da lista daquilo. */
export interface BarraDeitada { chave: string; nome: string; n: number; para?: string }
/**
 * Barras deitadas, uma por linha, com o nome e o número sempre escritos (ex.: os processos em cada coluna do quadro). "maior" dá a
 * mesma escala a vários gráficos lado a lado (ex.: o judicial e o administrativo); sem ele, a barra mais longa é a maior desta lista.
 * Com "para", a linha toda leva à lista. Para o leitor de tela, cada linha é lida "número nome" ("3 Distribuído").
 */
export function BarrasDeitadas({ rotulo, linhas, cor, maior, formatar = n => n.toLocaleString('pt-BR') }: {
  rotulo: string; linhas: readonly BarraDeitada[]; cor: string; maior?: number; formatar?: (n: number) => string;
}) {
  const escala = Math.max(1, maior ?? 0, ...linhas.map(l => l.n));
  return <ul className="grafico-deitadas" aria-label={rotulo}>
    {linhas.map(l => {
      const conteudo = <>
        <b className="grafico-deitada-numero num">{formatar(l.n)}</b> <span className="grafico-deitada-nome">{l.nome}</span>
        <span className="grafico-deitada-trilho" aria-hidden="true"><span className="grafico-deitada-barra" style={{ width: `${(l.n / escala) * 100}%`, background: cor }} /></span>
      </>;
      return <li key={l.chave}>{l.para ? <Link to={l.para}>{conteudo}</Link> : <span>{conteudo}</span>}</li>;
    })}
  </ul>;
}

export interface Empilhado { chave: string; rotulo: string; partes: number[]; total: number; detalhe?: string }
/**
 * Barras deitadas, uma por grupo, cada uma com as partes empilhadas (ex.: o recebido e o que falta). A barra mais longa
 * é o maior total; ao lado, o total escrito. "series" dá o nome e a cor de cada parte, na ordem.
 */
export function BarrasEmpilhadas({ rotulo, grupos, series, formatar }: { rotulo: string; grupos: Empilhado[]; series: Serie[]; formatar: (v: number) => string }) {
  const maior = Math.max(1, ...grupos.map(g => g.total));
  return <figure className="grafico" aria-label={rotulo}>
    <Legenda series={series} />
    <ul className="grafico-empilhadas" aria-hidden="true">
      {grupos.map(g => <li key={g.chave}>
        <span className="grafico-empilhada-nome">{g.rotulo}{g.detalhe && <small>{g.detalhe}</small>}</span>
        <span className="grafico-empilhada-trilho">
          <span className="grafico-empilhada-barra" style={{ width: `${(g.total / maior) * 100}%` }}>
            {g.partes.map((v, i) => v > 0 && <span key={series[i].chave} className="grafico-empilhada-parte" style={{ flexGrow: v, background: series[i].cor, boxShadow: series[i].contorno ? `inset 0 0 0 1px ${series[i].contorno}` : undefined }}
              title={`${g.rotulo} · ${series[i].nome}: ${formatar(v)}`} />)}
          </span>
        </span>
        <span className="grafico-empilhada-total num">{formatar(g.total)}</span>
      </li>)}
    </ul>
    <TabelaDoGrafico rotulo={rotulo} colunas={['', ...series.map(s => s.nome), 'Total']} linhas={grupos.map(g => [g.rotulo, ...g.partes.map(formatar), formatar(g.total)])} />
  </figure>;
}
