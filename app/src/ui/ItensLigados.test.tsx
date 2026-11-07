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

describe('O atalho para criar um item ligado', () => {
  const NOVA = { para: '/tarefas/nova/?contrato=k1', rotulo: 'Nova tarefa deste contrato' };

  it('dado itens na lista, quando aparece, então o atalho é só o "+", com o nome para o leitor de tela', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nada." novo={NOVA} itens={[{ id: 't1', para: '/tarefas/?id=t1', titulo: 'Protocolar' }]} /></MemoryRouter>);
    // Então
    const mais = screen.getByRole('link', { name: 'Nova tarefa deste contrato' });
    expect(mais).toHaveAttribute('href', NOVA.para);
    expect(mais).not.toHaveTextContent('Nova tarefa');
  });

  it('dado a lista vazia, quando aparece, então mostra o texto de vazio e o botão com o nome escrito', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nenhuma tarefa ligada a este contrato." novo={NOVA} itens={[]} /></MemoryRouter>);
    // Então
    expect(screen.getByText('Nenhuma tarefa ligada a este contrato.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveTextContent('Nova tarefa deste contrato');
  });
});
