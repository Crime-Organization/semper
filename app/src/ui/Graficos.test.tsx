// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BarrasDeitadas, BarrasEmpilhadas, BarrasPorMes } from './Graficos';

const reais = (v: number) => `R$ ${v}`;
const ENTRADA = { chave: 'e', nome: 'Entradas', cor: 'green' }, SAIDA = { chave: 's', nome: 'Saídas', cor: 'orange' };
const MESES = [{ nome: 'Jan', detalhe: 'janeiro de 2026', e: 10, s: 4 }, { nome: 'Fev', e: 0, s: 2 }];
const porMes = (extra: Partial<Parameters<typeof BarrasPorMes<(typeof MESES)[number]>>[0]> = {}) => render(<BarrasPorMes rotulo="Entradas e saídas de 2026" itens={MESES}
  series={[ENTRADA, SAIDA]} valor={(i, s) => (s === 'e' ? i.e : i.s)} formatar={reais} formatarCurto={reais} {...extra} />);

describe('Gráfico de barras por mês', () => {
  it('dado duas séries, quando aparece, então tem a legenda e a tabela para o leitor de tela', () => {
    // Quando
    porMes();
    // Então
    const tabela = screen.getByRole('table', { name: 'Entradas e saídas de 2026' });
    expect(within(tabela).getByRole('row', { name: /janeiro de 2026/ })).toHaveTextContent('R$ 10');
    // Cada série aparece na legenda e no cabeçalho da tabela escondida.
    expect(screen.getAllByText('Saídas')).toHaveLength(2);
  });

  it('dado o gráfico, quando a pessoa passa o mouse ou toca num mês, então a dica mostra o número exato de cada série', () => {
    // Dado
    const { container } = porMes();
    const alvos = container.querySelectorAll('.grafico-alvo');
    // Quando
    fireEvent.pointerEnter(alvos[0]);
    // Então
    const dica = screen.getByRole('status');
    expect(dica).toHaveTextContent('janeiro de 2026');
    expect(dica).toHaveTextContent('R$ 10Entradas');
    expect(dica).toHaveTextContent('R$ 4Saídas');
    // Quando: o toque em outro mês
    fireEvent.pointerDown(alvos[1]);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Fev');
  });

  it('dado o gráfico no Tab, quando a pessoa usa as setas, então a dica passa de um mês ao outro, e o Esc fecha', () => {
    // Dado
    porMes();
    const area = screen.getByRole('group', { name: /Use as setas/ });
    // Quando
    fireEvent.keyDown(area, { key: 'ArrowRight' });
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('janeiro de 2026');
    // Quando
    fireEvent.keyDown(area, { key: 'End' });
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Fev');
    // Quando
    fireEvent.keyDown(area, { key: 'Escape' });
    // Então
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('dado "rotulos" e "corDoItem", quando aparece, então cada barra tem o número na ponta, e o item em destaque tem a cor dele', () => {
    // Quando
    const { container } = porMes({ rotulos: true, series: [ENTRADA], corDoItem: i => i.nome === 'Fev' ? 'red' : undefined });
    // Então
    expect([...container.querySelectorAll('.grafico-rotulo')].map(t => t.textContent)).toEqual(['R$ 10', 'R$ 0']);
    expect([...container.querySelectorAll<SVGRectElement>('.grafico-barra')].map(r => r.style.fill)).toEqual(['green', 'red']);
  });

  it('dado "escalaInteira", quando o maior número é 2, então as linhas da grade ficam em 0, 1, 2 e 3', () => {
    // Quando
    const { container } = porMes({ escalaInteira: true, series: [SAIDA], valor: i => (i.nome === 'Jan' ? 2 : 1), formatarCurto: String });
    // Então
    expect([...container.querySelectorAll('.grafico-eixo')].slice(0, 4).map(t => t.textContent)).toEqual(['0', '1', '2', '3']);
  });

  it('dado "tabelaVisivel", quando aparece, então a tabela fica em "Ver os números", para quem vê também', () => {
    // Quando
    porMes({ tabelaVisivel: true });
    // Então
    expect(screen.getByText('Ver os números').closest('details')).toContainElement(screen.getByRole('table', { name: 'Entradas e saídas de 2026' }));
  });
});

describe('Gráfico de barras deitadas', () => {
  it('dadas linhas com endereço, quando aparece, então cada linha tem o número e o nome, e leva à lista', () => {
    // Quando
    render(<MemoryRouter><BarrasDeitadas rotulo="Judicial" cor="green" maior={10} linhas={[{ chave: 'a', nome: 'Distribuído', n: 5, para: '/processos/judicial/?etapa=a' }, { chave: 'b', nome: 'Sentença', n: 1 }]} /></MemoryRouter>);
    // Então
    const lista = screen.getByRole('list', { name: 'Judicial' });
    expect(within(lista).getByRole('link', { name: '5 Distribuído' })).toHaveAttribute('href', '/processos/judicial/?etapa=a');
    expect(within(lista).getByText('Sentença')).toBeInTheDocument();
    // A escala é a do "maior" dado (10), não a desta lista: a barra de 5 ocupa metade.
    expect(lista.querySelector<HTMLElement>('.grafico-deitada-barra')!.style.width).toBe('50%');
  });
});

describe('Gráfico de barras empilhadas', () => {
  it('dado grupos com partes, quando aparece, então cada grupo mostra o total, e a tabela tem cada parte', () => {
    // Quando
    render(<BarrasEmpilhadas rotulo="Contratos por categoria" formatar={reais} series={[ENTRADA, SAIDA]}
      grupos={[{ chave: 'a', rotulo: 'Pró-labore', partes: [70, 30], total: 100 }]} />);
    // Então
    const tabela = screen.getByRole('table', { name: 'Contratos por categoria' });
    expect(within(tabela).getByRole('row', { name: /Pró-labore/ })).toHaveTextContent('R$ 70R$ 30R$ 100');
  });

  it('dado "tabelaVisivel", quando aparece, então "Ver os números" abre a tabela com cada parte', () => {
    // Quando
    render(<BarrasEmpilhadas rotulo="Receita por área" formatar={reais} series={[ENTRADA, SAIDA]} tabelaVisivel
      grupos={[{ chave: 'a', rotulo: 'Registro de marca', partes: [70, 30], total: 100 }]} />);
    // Então
    expect(screen.getByText('Ver os números').closest('details')).toContainElement(screen.getByRole('table', { name: 'Receita por área' }));
  });
});

describe('Números que não viram barra', () => {
  it('dado um número a mais (o resultado do mês), quando a pessoa passa o mouse, então a dica e a tabela o mostram, sem barra para ele', () => {
    // Dado
    const { container } = porMes({ extras: [{ chave: 'r', nome: 'Resultado', valor: i => i.e - i.s }], tabelaVisivel: true });
    // Então: duas barras por mês (as séries), nenhuma para o resultado
    expect(container.querySelectorAll('.grafico-barra')).toHaveLength(MESES.length * 2);
    expect(within(screen.getByRole('table', { name: 'Entradas e saídas de 2026' })).getByRole('row', { name: /janeiro de 2026/ })).toHaveTextContent('R$ 10R$ 4R$ 6');
    // Quando
    fireEvent.pointerEnter(container.querySelectorAll('.grafico-alvo')[1]);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('R$ -2Resultado');
  });
});
