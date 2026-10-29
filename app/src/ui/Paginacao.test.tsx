// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacao } from './Paginacao';

describe('Paginação da tabela', () => {
  it('quando está numa página do meio, então mostra o intervalo e leva à próxima', async () => {
    // Dado
    const aoPaginar = vi.fn();
    render(<Paginacao pagina={1} porPagina={50} naPagina={50} total={1200} aoPaginar={aoPaginar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    // Então
    expect(screen.getByText('Mostrando 51–100 de 1.200')).toBeInTheDocument();
    expect(aoPaginar).toHaveBeenCalledWith(2);
  });

  it.each([
    ['primeira', 'Anterior', 0, 50],
    ['última', 'Próxima', 2, 20]
  ])('quando está na %s página, então o botão %s fica desligado', (_qual, botao, pagina, naPagina) => {
    // Quando
    render(<Paginacao pagina={pagina} porPagina={50} naPagina={naPagina} total={120} aoPaginar={vi.fn()} />);
    // Então
    expect(screen.getByRole('button', { name: botao })).toBeDisabled();
  });
});
