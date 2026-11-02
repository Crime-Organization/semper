// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador e com o módulo ligado; aqui a página é aberta de outro jeito.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Financeiro from './Financeiro';

const sessao = vi.hoisted(() => ({ ctx: { ehAdmin: false, escritorio: { modulos: { financeiro: true } } } }));
vi.mock('../ui/sessao', () => ({ useSessao: () => ({ ctx: sessao.ctx }), useCtx: () => sessao.ctx }));

const abrir = () => render(<MemoryRouter initialEntries={['/financeiro/']}><Routes>
  <Route path="/financeiro/" element={<Financeiro />} />
  <Route path="/inicio/" element={<p>Início</p>} />
</Routes></MemoryRouter>);

describe('Quem não pode abrir o caixa', () => {
  beforeEach(() => { sessao.ctx = { ehAdmin: false, escritorio: { modulos: { financeiro: true } } }; });

  it('quando quem abre não é administrador, então volta ao início, sem ver o caixa', () => {
    // Quando
    abrir();
    // Então
    expect(screen.getByText('Início')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Caixa' })).toBeNull();
  });

  it('quando o escritório não tem o módulo ligado, então o administrador também volta ao início', () => {
    // Dado
    sessao.ctx = { ehAdmin: true, escritorio: { modulos: { financeiro: false } } };
    // Quando
    abrir();
    // Então
    expect(screen.getByText('Início')).toBeTruthy();
  });
});
