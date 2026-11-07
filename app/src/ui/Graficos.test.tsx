// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarrasEmpilhadas, BarrasPorMes } from './Graficos';

const reais = (v: number) => `R$ ${v}`;
const ENTRADA = { chave: 'e', nome: 'Entradas', cor: 'green' }, SAIDA = { chave: 's', nome: 'Saídas', cor: 'orange' };

describe('Gráfico de barras por mês', () => {
  it('dado duas séries, quando aparece, então tem a legenda, a dica de cada barra e a tabela para o leitor de tela', () => {
    // Quando
    const { container } = render(<BarrasPorMes rotulo="Entradas e saídas de 2026" itens={[{ nome: 'Jan', e: 10, s: 4 }, { nome: 'Fev', e: 0, s: 2 }]}
      series={[ENTRADA, SAIDA]} valor={(i, s) => (s === 'e' ? i.e : i.s)} formatar={reais} formatarCurto={reais} />);
    // Então
    const tabela = screen.getByRole('table', { name: 'Entradas e saídas de 2026' });
    expect(within(tabela).getByRole('row', { name: /Jan/ })).toHaveTextContent('R$ 10');
    // A dica de cada barra é o <title> de dentro dela (o que o navegador mostra ao passar o mouse).
    expect([...container.querySelectorAll('rect > title')].map(t => t.textContent)).toContain('Jan · Entradas: R$ 10');
    // Cada série aparece na legenda e no cabeçalho da tabela escondida.
    expect(screen.getAllByText('Saídas')).toHaveLength(2);
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
});
