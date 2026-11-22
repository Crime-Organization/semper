// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { FiltroDoPainel } from './FiltroDoPainel';
import { CabecaDoPainel, CartaoDoPainel, NumeroDoPainel, NumerosDoPainel, Painel, ValorEmReais } from './Painel';

const comRotas = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Cabeça do painel', () => {
  it('dado um título, uma frase e um filtro, quando aparece, então o título é o h1 com o ponto, e a frase e o filtro vêm junto', () => {
    // Quando
    render(<CabecaDoPainel titulo="Processos" frase="O seu trabalho."><button type="button">Filtro</button></CabecaDoPainel>);
    // Então
    expect(screen.getByRole('heading', { level: 1, name: 'Processos.' })).toBeInTheDocument();
    expect(screen.getByText('O seu trabalho.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtro' })).toBeInTheDocument();
  });
});

describe('Números do painel', () => {
  it('dado um número com destino, quando aparece, então o número inteiro é um link para a lista, com o nome e o detalhe', () => {
    // Quando
    comRotas(<NumerosDoPainel rotulo="Números"><NumeroDoPainel rotulo="Prazos vencidos" valor={1234} detalhe="desde ontem" para="#prazos" tom="erro" /></NumerosDoPainel>);
    // Então
    const link = within(screen.getByRole('group', { name: 'Números' })).getByRole('link', { name: /Prazos vencidos/ });
    expect(link).toHaveAttribute('href', '#prazos');
    expect(link).toHaveTextContent('1.234');
    expect(link).toHaveTextContent('desde ontem');
  });

  it('dado um número com partes, quando aparece, então cada parte leva à sua lista, e o número tem o nome do rótulo', () => {
    // Quando
    comRotas(<NumeroDoPainel rotulo="Processos ativos" valor={3} partes={[{ chave: 'j', texto: '2 judiciais', para: '/processos/judicial/' }, { chave: 'a', texto: '1 administrativo', para: '/processos/administrativo/' }]} />);
    // Então
    const numero = screen.getByRole('region', { name: 'Processos ativos' });
    expect(within(numero).getByRole('link', { name: '2 judiciais' })).toHaveAttribute('href', '/processos/judicial/');
    expect(within(numero).getByRole('link', { name: '1 administrativo' })).toHaveAttribute('href', '/processos/administrativo/');
  });

  it('dada uma variação, quando aparece, então o texto dela vem com a seta', () => {
    // Quando
    comRotas(<NumeroDoPainel rotulo="Andamentos" valor={10} variacao={{ texto: '3 a mais que em outubro', seta: 'sobe', tom: 'bom' }} />);
    // Então
    expect(screen.getByText('3 a mais que em outubro')).toBeInTheDocument();
  });

  it('dada uma variação igual, quando aparece, então vem só o texto, sem seta', () => {
    // Quando
    const { container } = comRotas(<NumeroDoPainel rotulo="Entradas" valor={10} variacao={{ texto: 'igual a Out/2026', seta: 'igual', tom: 'neutro' }} />);
    // Então
    expect(screen.getByText('igual a Out/2026')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('dado um valor em reais, quando aparece, então o número mostra o "R$" e os centavos à parte, e o leitor de tela ouve o valor inteiro', () => {
    // Quando
    comRotas(<NumeroDoPainel rotulo="Entradas · Nov/2026" valor={123456} formatar={c => <ValorEmReais centavos={c} />} para="/financeiro/" />);
    // Então
    const link = screen.getByRole('link', { name: /^Entradas · Nov\/2026/u });
    expect(link).toHaveTextContent(/R\$\s1\.234,56/u);
    expect(within(link).getByText('R$', { selector: 'small' })).toBeInTheDocument();
    expect(within(link).getByText(',56', { selector: 'small' })).toBeInTheDocument();
  });
});

describe('Cartões do painel', () => {
  it('dado um cartão com id, nota e ação, quando aparece, então é uma região com o nome do título, que os números podem achar pelo id', () => {
    // Quando
    render(<Painel><CartaoDoPainel titulo="Prazos" id="painel-prazos" nota="Os próximos 15 dias." acao={<a href="#x">Ver todos</a>} largura="metade"><p>lista</p></CartaoDoPainel></Painel>);
    // Então
    const cartao = screen.getByRole('region', { name: 'Prazos' });
    expect(cartao).toHaveAttribute('id', 'painel-prazos');
    expect(within(cartao).getByText('Os próximos 15 dias.')).toBeInTheDocument();
    expect(within(cartao).getByRole('link', { name: 'Ver todos' })).toBeInTheDocument();
    expect(within(cartao).getByText('lista')).toBeInTheDocument();
  });
});

describe('Filtro do painel', () => {
  const EQUIPE = [{ id: 'eu', nome: 'Mauro' }, { id: 'a', nome: 'Ana' }, { id: 'x', nome: 'Xavier', ativo: false }];

  it('dado o administrador, quando abre o filtro, então escolhe entre o próprio trabalho, a equipe toda e as pessoas ativas da equipe', () => {
    // Dado
    const aoEscolher = vi.fn();
    render(<FiltroDoPainel alcance={{ tipo: 'eu', pessoa: 'eu' }} equipe={EQUIPE} eu="eu" aoEscolher={aoEscolher} />);
    const filtro = screen.getByRole('combobox', { name: 'Mostrar' });
    // Então
    expect(within(filtro).getAllByRole('option').map(o => o.textContent)).toEqual(['Meu trabalho', 'Equipe toda', 'Ana']);
    expect(filtro).toHaveValue('eu');
    // Quando
    fireEvent.change(filtro, { target: { value: 'a' } });
    // Então
    expect(aoEscolher).toHaveBeenCalledWith('a');
  });

  it('dado o alcance de uma pessoa, quando aparece, então ela vem escolhida', () => {
    // Quando
    render(<FiltroDoPainel alcance={{ tipo: 'pessoa', pessoa: 'a' }} equipe={EQUIPE} eu="eu" aoEscolher={() => {}} />);
    // Então
    expect(screen.getByRole('combobox', { name: 'Mostrar' })).toHaveValue('a');
  });
});
