// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PaginaModulo } from './PaginaModulo';

/** Mostra o endereço atual, para conferir o que ficou nele. */
function Endereco() {
  const l = useLocation();
  return <output aria-label="Endereço">{l.pathname + l.search}</output>;
}
function montar(inicio: string, aoBuscar = vi.fn()) {
  render(<MemoryRouter initialEntries={[inicio]}>
    <PaginaModulo titulo="Pessoas" busca={{ placeholder: 'Buscar nome', aoBuscar }}>lista</PaginaModulo>
    {/* O "Ver todos em Pessoas" da busca geral, de novo com o mesmo termo. */}
    <Link to="/pessoas/?busca=maria">Ver todos de novo</Link>
    <Endereco />
  </MemoryRouter>);
  return aoBuscar;
}

describe('Página de módulo: a busca que chega pelo endereço', () => {
  it('dado o endereço com a busca (o "Ver todos" da busca geral), quando a página abre, então o campo vem preenchido e a lista já busca', () => {
    // Quando
    const aoBuscar = montar('/pessoas/?busca=jos%C3%A9+da+silva');
    // Então
    expect(screen.getByRole('searchbox')).toHaveValue('josé da silva');
    expect(aoBuscar).toHaveBeenCalledWith('josé da silva');
  });

  it('dado o endereço sem a busca, quando a página abre, então o campo vem vazio', () => {
    // Quando
    montar('/pessoas/');
    // Então
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('dado o endereço com a busca, o cartão aberto e a visão, quando a página lê a busca, então ela e a visão saem do endereço e o cartão fica', async () => {
    // Quando
    montar('/pessoas/?id=p1&busca=maria&visao=tabela');
    // Então
    await waitFor(() => expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent(/^\/pessoas\/\?id=p1$/));
    expect(screen.getByRole('searchbox')).toHaveValue('maria');
  });

  it('dado o campo trocado à mão, quando chega de novo o mesmo ?busca=, então o campo volta a mostrar esse termo', async () => {
    // Dado
    montar('/pessoas/?busca=maria');
    await waitFor(() => expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent(/^\/pessoas\/$/));
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'joão');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Ver todos de novo' }));
    // Então
    expect(screen.getByRole('searchbox')).toHaveValue('maria');
  });
});
