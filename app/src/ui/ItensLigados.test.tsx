// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AcoesDosLigados, CriarNoCartao, ItensLigados } from './ItensLigados';
import { Recolhivel } from './Recolhivel';

describe('Itens ligados a um cadastro', () => {
  it('quando há itens, então cada um é um link para o item, com o código, o título e o detalhe', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nada ligado." itens={[
      { id: 'k1', para: '/contratos/?id=k1', codigo: 'MA96-0001-2026', titulo: 'Registro de marca', detalhe: 'Cliente · Em negociação' },
      { id: 'k2', para: '/contratos/?id=k2', codigo: 'MA96-0002-2026', titulo: 'Oposição', detalhe: 'Participante · Encerrado', selo: 'Arquivado' }
    ]} /></MemoryRouter>);
    // Então
    const links = screen.getAllByRole('link');
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/contratos/?id=k1', '/contratos/?id=k2']);
    expect(links[0]).toHaveTextContent('MA96-0001-2026Registro de marcaCliente · Em negociação');
    expect(links[1]).toHaveTextContent('Arquivado');
  });

  it('quando não há itens, então mostra o aviso de vazio', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nenhum contrato ligado a esta pessoa." itens={[]} /></MemoryRouter>);
    // Então
    expect(screen.getByText('Nenhum contrato ligado a esta pessoa.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});


describe('Os atalhos de criar e ligar ficam só no título da seção (#427)', () => {
  it('dado itens na lista, quando aparece, então não há "+" ao lado da lista nem botão embaixo', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nada." itens={[{ id: 't1', para: '/tarefas/?id=t1', titulo: 'Protocolar' }]} /></MemoryRouter>);
    // Então: o único link é o do item
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Protocolar/ })).toHaveAttribute('href', '/tarefas/?id=t1');
  });

  it('dada a linha de baixo sem a busca aberta, quando aparece, então não ocupa lugar nenhum', () => {
    // Quando
    const { container } = render(<AcoesDosLigados />);
    // Então
    expect(container).toBeEmptyDOMElement();
  });
});

describe('O cartão só para ler (#376)', () => {
  const NOVA = { para: '/tarefas/nova/?contrato=k1', rotulo: 'Nova tarefa deste contrato' };
  const LIGAR = { rotulo: 'Ligar tarefa existente' };
  const secao = <Recolhivel titulo="Tarefas" icone="tarefas" ligar={LIGAR} novo={NOVA}><p>dentro</p></Recolhivel>;

  it('dado o cartão que deixa criar, quando aparece, então o título tem a corrente e o "+" que leva ao cadastro', () => {
    // Quando
    render(<MemoryRouter><CriarNoCartao pode>{secao}</CriarNoCartao></MemoryRouter>);
    // Então
    expect(screen.getByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveAttribute('href', NOVA.para);
    expect(screen.getByRole('button', { name: 'Ligar tarefa existente' })).toBeInTheDocument();
  });

  it('dado o cartão arquivado (ou de quem só lê), quando aparece, então nem a corrente nem o "+" aparecem, e o título continua', () => {
    // Quando
    render(<MemoryRouter><CriarNoCartao pode={false}>{secao}</CriarNoCartao></MemoryRouter>);
    // Então
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ligar tarefa existente' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tarefas' })).toBeInTheDocument();
  });

  it('dado uma seção fora de qualquer cartão, quando tem o atalho, então ele aparece (cada seção decide)', () => {
    // Quando
    render(<MemoryRouter><Recolhivel titulo="Tarefas" icone="tarefas" novo={NOVA}><p>dentro</p></Recolhivel></MemoryRouter>);
    // Então
    expect(screen.getByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveAttribute('href', NOVA.para);
  });
});
