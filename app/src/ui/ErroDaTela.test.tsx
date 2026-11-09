// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ErroDaTela } from './ErroDaTela';

function TelaQueFalha(): never {
  throw new Error('falha interna da tela');
}

describe('Erro ao abrir uma tela', () => {
  it('dada uma tela que falha, quando ela abre, então aparece o aviso em português e o botão de recarregar, sem o erro técnico', () => {
    // Dado
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const roteador = createMemoryRouter([{ path: '*', element: <TelaQueFalha />, errorElement: <ErroDaTela /> }]);
    // Quando
    render(<RouterProvider router={roteador} />);
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível abrir esta tela.');
    expect(screen.getByRole('button', { name: 'Recarregar a página' })).toBeInTheDocument();
    expect(screen.queryByText(/falha interna/)).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
