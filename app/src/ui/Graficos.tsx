// Gráficos simples, desenhados à mão (sem biblioteca): barras por mês e barras empilhadas por grupo. Cada um tem a
// legenda (quando há duas séries ou mais), a dica ao passar o mouse em cada barra e uma tabela escondida para o leitor
// de tela, para que nada dependa só da cor. As cores vêm das variáveis --grafico-* de estilo.css.
import type { ReactNode } from 'react';

export interface Serie { chave: string; nome: string; cor: string }

function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null;
  return <ul className="grafico-legenda" aria-hidden="true">
    {series.map(s => <li key={s.chave}><span className="grafico-marca" style={{ background: s.cor }} />{s.nome}</li>)}
  </ul>;
}

/** Uma tabela só para o leitor de tela, com os mesmos números do gráfico. */
function TabelaEscondida({ rotulo, colunas, linhas }: { rotulo: string; colunas: string[]; linhas: (string | ReactNode)[][] }) {
  return <div className="sr"><table aria-label={rotulo}>
    <thead><tr>{colunas.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => j ? <td key={j}>{c}</td> : <th key={j} scope="row">{c}</th>)}</tr>)}</tbody>
  </table></div>;
}

// Medidas do desenho (unidades do viewBox; o SVG estica para a largura do cartão).
const LARGURA = 600, ALTURA = 200, EIXO_Y = 52, PE = 22, TOPO = 8, LINHAS_DA_GRADE = 3;

/**
 * Barras por mês: cada mês um grupo, uma barra por série, lado a lado, a partir de uma linha de base. "valor" lê o
 * número de um item numa série; "formatar" escreve o valor (eixo, dica e tabela).
 */
export function BarrasPorMes<T extends { nome: string }>({ rotulo, itens, series, valor, formatar, formatarCurto }: {
  rotulo: string; itens: T[]; series: Serie[]; valor: (item: T, serie: string) => number;
  formatar: (v: number) => string; formatarCurto: (v: number) => string;
}) {
  const maior = Math.max(1, ...itens.flatMap(i => series.map(s => valor(i, s.chave))));
  const area = { x: EIXO_Y, y: TOPO, l: LARGURA - EIXO_Y, a: ALTURA - TOPO - PE };
  const grupo = area.l / itens.length, vao = 2, barra = Math.max(4, Math.min(18, (grupo * 0.7 - vao * (series.length - 1)) / series.length));
  const y = (v: number) => area.y + area.a - (v / maior) * area.a;
  return <figure className="grafico" aria-label={rotulo}>
    <Legenda series={series} />
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="grafico-svg" role="presentation" aria-hidden="true">
      {Array.from({ length: LINHAS_DA_GRADE + 1 }, (_, i) => {
        const v = (maior / LINHAS_DA_GRADE) * i, yy = y(v);
        return <g key={i}>
          <line x1={area.x} x2={LARGURA} y1={yy} y2={yy} className={i ? 'grafico-grade' : 'grafico-base'} />
          <text x={area.x - 6} y={yy + 4} textAnchor="end" className="grafico-eixo">{formatarCurto(v)}</text>
        </g>;
      })}
      {itens.map((item, i) => {
        const inicio = area.x + grupo * i + (grupo - (barra * series.length + vao * (series.length - 1))) / 2;
        return <g key={item.nome}>
          {series.map((s, j) => {
            const v = valor(item, s.chave), alto = Math.max(0, area.y + area.a - y(v));
            return <rect key={s.chave} className="grafico-barra" x={inicio + j * (barra + vao)} y={y(v)} width={barra} height={alto} rx={Math.min(3, barra / 2)} style={{ fill: s.cor }}>
              <title>{`${item.nome} · ${s.nome}: ${formatar(v)}`}</title>
            </rect>;
          })}
          <text x={area.x + grupo * i + grupo / 2} y={ALTURA - 6} textAnchor="middle" className="grafico-eixo">{item.nome}</text>
        </g>;
      })}
    </svg>
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
            {g.partes.map((v, i) => v > 0 && <span key={series[i].chave} className="grafico-empilhada-parte" style={{ flexGrow: v, background: series[i].cor }}
              title={`${g.rotulo} · ${series[i].nome}: ${formatar(v)}`} />)}
          </span>
        </span>
        <span className="grafico-empilhada-total num">{formatar(g.total)}</span>
      </li>)}
    </ul>
    <TabelaEscondida rotulo={rotulo} colunas={['', ...series.map(s => s.nome), 'Total']} linhas={grupos.map(g => [g.rotulo, ...g.partes.map(formatar), formatar(g.total)])} />
  </figure>;
}
