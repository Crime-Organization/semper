// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a página é aberta como quem não é.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import Configuracoes from './Configuracoes';

vi.mock('../ui/sessao', () => ({ useSessao: () => ({ ctx: { ehAdmin: false, escritorio: { modulos: { processos: true } } } }) }));

describe('Configurações para quem não é administrador', () => {
  it('quando abre a página, então volta ao início: não cria nem apaga campos dos processos', () => {
    // Quando
    render(<MemoryRouter initialEntries={['/configuracoes/']}><Routes>
      <Route path="/configuracoes/" element={<Configuracoes />} />
      <Route path="/inicio/" element={<p>Início</p>} />
    </Routes></MemoryRouter>);
    // Então
    expect(screen.getByText('Início')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Campos dos processos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo campo' })).toBeNull();
  });
});
