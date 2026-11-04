// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador e com o módulo ligado; aqui a página é aberta de outro jeito.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MeusValores from './MeusValores';

const sessao = vi.hoisted(() => ({ ctx: { ehAdmin: false, escritorio: { modulos: { financeiro: true } } } }));
vi.mock('../ui/sessao', () => ({ useSessao: () => ({ ctx: sessao.ctx }), useCtx: () => sessao.ctx }));

const abrir = () => render(<MemoryRouter initialEntries={['/meus-valores/']}><Routes>
  <Route path="/meus-valores/" element={<MeusValores />} />
  <Route path="/inicio/" element={<p>Início</p>} />
</Routes></MemoryRouter>);

describe('Quem abre Meus valores', () => {
  beforeEach(() => { sessao.ctx = { ehAdmin: false, escritorio: { modulos: { financeiro: true } } }; });

  it('quando quem abre não é administrador, então vê a tela dele, sem depender do caixa', async () => {
    // Quando
    abrir();
    // Então
    expect(await screen.findByText('Nenhum valor para você neste mês.', { exact: false })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^Meus valores/ })).toBeTruthy();
  });

  it('quando o escritório não tem o módulo ligado, então volta ao início', () => {
    // Dado
    sessao.ctx = { ehAdmin: true, escritorio: { modulos: { financeiro: false } } };
    // Quando
    abrir();
    // Então
    expect(screen.getByText('Início')).toBeTruthy();
  });
});
