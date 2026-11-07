// Gráficos simples, desenhados à mão (sem biblioteca): barras por mês e barras empilhadas por grupo. Cada um tem a
// legenda (quando há duas séries ou mais), a dica ao passar o mouse em cada barra e uma tabela escondida para o leitor
// de tela, para que nada dependa só da cor. As cores vêm das variáveis --grafico-* de estilo.css.
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/** "contorno": a cor da borda de uma série clara demais para o fundo (ex.: o que falta receber). */
export interface Serie { chave: string; nome: string; cor: string; contorno?: string }

function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return <ul className="grafico-legenda" aria-hidden="true">
    {series.map(s => <li key={s.chave}><span className="grafico-marca" style={{ background: s.cor, boxShadow: s.contorno ? `inset 0 0 0 1px ${s.contorno}` : undefined }} />{s.nome}</li>)}
  </ul>;
}

/** Uma tabela só para o leitor de tela, com os mesmos números do gráfico. */
function TabelaEscondida({ rotulo, colunas, linhas }: { rotulo: string; colunas: string[]; linhas: (string | ReactNode)[][] }) {
  return <div className="sr"><table aria-label={rotulo}>
    <thead><tr>{colunas.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => j ? <td key={j}>{c}</td> : <th key={j} scope="row">{c}</th>)}</tr>)}</tbody>
  </table></div>;
}

// Medidas do desenho, em pixels de verdade: o SVG tem a largura medida do cartão, então o texto fica sempre com o
// tamanho da letra do resto da tela, em qualquer largura (computador ou celular).
const LARGURA_INICIAL = 600;   // antes da primeira medida
const ALTURA = 200, PE = 22, TOPO = 8, LINHAS_DA_GRADE = 3;
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

/**
 * Barras por mês: cada mês um grupo, uma barra por série, lado a lado, a partir de uma linha de base. "valor" lê o
 * número de um item numa série; "formatar" escreve o valor (dica e tabela) e "formatarCurto", o do eixo.
 */
export function BarrasPorMes<T extends { nome: string }>({ rotulo, itens, series, valor, formatar, formatarCurto }: {
  rotulo: string; itens: T[]; series: Serie[]; valor: (item: T, serie: string) => number;
  formatar: (v: number) => string; formatarCurto: (v: number) => string;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const maior = Math.max(1, ...itens.flatMap(i => series.map(s => valor(i, s.chave))));
  const marcas = Array.from({ length: LINHAS_DA_GRADE + 1 }, (_, i) => (maior / LINHAS_DA_GRADE) * i);
  const eixoY = Math.max(EIXO_Y_MINIMO, Math.ceil(Math.max(...marcas.map(v => formatarCurto(v).length)) * LARGURA_DA_LETRA) + AFASTAMENTO_DO_EIXO * 2);
  const area = { x: eixoY, y: TOPO, l: largura - eixoY, a: ALTURA - TOPO - PE };
  const grupo = area.l / itens.length;
  const barra = Math.max(BARRA_MINIMA, Math.min(BARRA_MAXIMA, (grupo * OCUPACAO_DO_GRUPO - VAO_ENTRE_BARRAS * (series.length - 1)) / series.length));
  const y = (v: number) => area.y + area.a - (v / maior) * area.a;
  return <figure className="grafico" aria-label={rotulo}>
    <Legenda series={series} />
    <div ref={ref} className="grafico-area">
      <svg viewBox={`0 0 ${largura} ${ALTURA}`} width={largura} height={ALTURA} className="grafico-svg" role="presentation" aria-hidden="true">
        {marcas.map((v, i) => {
          const yy = y(v);
          return <g key={i}>
            <line x1={area.x} x2={largura} y1={yy} y2={yy} className={i ? 'grafico-grade' : 'grafico-base'} />
            <text x={area.x - AFASTAMENTO_DO_EIXO} y={yy + DESCIDA_DO_TEXTO} textAnchor="end" className="grafico-eixo">{formatarCurto(v)}</text>
          </g>;
        })}
        {itens.map((item, i) => {
          const inicio = area.x + grupo * i + (grupo - (barra * series.length + VAO_ENTRE_BARRAS * (series.length - 1))) / 2;
          return <g key={item.nome}>
            {series.map((s, j) => {
              const v = valor(item, s.chave), alto = Math.max(0, area.y + area.a - y(v));
              return <rect key={s.chave} className="grafico-barra" x={inicio + j * (barra + VAO_ENTRE_BARRAS)} y={y(v)} width={barra} height={alto} rx={Math.min(RAIO_DA_BARRA, barra / 2)} style={{ fill: s.cor }}>
                <title>{`${item.nome} · ${s.nome}: ${formatar(v)}`}</title>
              </rect>;
            })}
            <text x={area.x + grupo * i + grupo / 2} y={ALTURA - ESPACO_DO_MES} textAnchor="middle" className="grafico-eixo">{grupo < MES_COM_NOME_INTEIRO ? item.nome.slice(0, 1) : item.nome}</text>
          </g>;
        })}
      </svg>
    </div>
    <TabelaEscondida rotulo={rotulo} colunas={['', ...series.map(s => s.nome)]} linhas={itens.map(i => [i.nome, ...series.map(s => formatar(valor(i, s.chave)))])} />
  </figure>;
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
    <TabelaEscondida rotulo={rotulo} colunas={['', ...series.map(s => s.nome), 'Total']} linhas={grupos.map(g => [g.rotulo, ...g.partes.map(formatar), formatar(g.total)])} />
  </figure>;
}
