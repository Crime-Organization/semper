// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ItensLigados } from './ItensLigados';

describe('Itens ligados a um cadastro', () => {
  it('quando há itens, então cada um é um link para o item, com o código, o título e o detalhe', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nada ligado." itens={[
      { id: 'k1', para: '/contratos/?id=k1', codigo: 'MA96-0001-2026', titulo: 'Registro de marca', detalhe: 'Cliente · Em negociação' },
      { id: 'k2', para: '/contratos/?id=k2', codigo: 'MA96-0002-2026', titulo: 'Oposição', detalhe: 'Participante · Encerrado', arquivado: true }
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
