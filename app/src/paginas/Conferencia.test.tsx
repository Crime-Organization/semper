// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador e com o módulo ligado; aqui a página é aberta de outro jeito.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Conferencia from './Conferencia';

type Ctx = { ehAdmin: boolean; perfil: { id: string }; equipe: { id: string; nome: string }[]; escritorio: { modulos: { financeiro: boolean } } };
const novoCtx = (m: Partial<Ctx> = {}): Ctx => ({ ehAdmin: false, perfil: { id: 'u-bruno' }, equipe: [], escritorio: { modulos: { financeiro: true } }, ...m });
const sessao = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock('../ui/sessao', () => ({ useSessao: () => ({ ctx: sessao.ctx }), useCtx: () => sessao.ctx }));

const abrir = () => render(<MemoryRouter initialEntries={['/conferencia/']}><Routes>
  <Route path="/conferencia/" element={<Conferencia />} />
  <Route path="/inicio/" element={<p>Início</p>} />
</Routes></MemoryRouter>);

describe('Quem abre a Conferência', () => {
  beforeEach(() => { sessao.ctx = novoCtx(); });

  it('quando quem abre não é administrador, então não vê o resumo de todos nem escolhe o responsável', async () => {
    // Quando
    abrir();
    // Então
    expect(await screen.findByRole('heading', { name: /^Conferência/ })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Resumo de todos' })).toBeNull();
    expect(screen.queryByLabelText('Responsável')).toBeNull();
  });

  it('quando quem abre é administrador, então vê o resumo de todos e escolhe o responsável', async () => {
    // Dado
    sessao.ctx = novoCtx({ ehAdmin: true });
    // Quando
    abrir();
    // Então
    expect(await screen.findByRole('region', { name: 'Resumo de todos' })).toBeTruthy();
    expect(screen.getByLabelText('Responsável')).toBeTruthy();
  });

  it('quando o escritório não tem o módulo ligado, então volta ao início', () => {
    // Dado
    sessao.ctx = novoCtx({ escritorio: { modulos: { financeiro: false } } });
    // Quando
    abrir();
    // Então
    expect(screen.getByText('Início')).toBeTruthy();
  });
});
