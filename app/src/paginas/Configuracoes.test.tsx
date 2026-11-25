// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a página é aberta como quem não é.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Configuracoes from './Configuracoes';

// Quem abre a página e os módulos ligados no escritório (de início, quem não é administrador, com Processos).
const sessao = vi.hoisted(() => ({ ehAdmin: false, modulos: { processos: true } as Record<string, boolean> }));
vi.mock('../ui/sessao', () => {
  const ctx = () => ({ ehAdmin: sessao.ehAdmin, perfil: { id: 'u-master' }, equipe: [], escritorio: { nome: 'Escritório', modulos: sessao.modulos } });
  return { useSessao: () => ({ ctx: ctx(), recarregar: async () => {} }), useCtx: ctx };
});

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

describe('Os papéis escritos nos processos, nas Configurações (#443)', () => {
  beforeEach(() => { sessao.ehAdmin = true; });
  const abrir = () => render(<MemoryRouter initialEntries={['/configuracoes/']}><Routes>
    <Route path="/configuracoes/" element={<Configuracoes />} />
  </Routes></MemoryRouter>);

  it('dado o administrador com o módulo Processos ligado, quando abre a página, então vê a seção dos papéis escritos', async () => {
    // Dado
    sessao.modulos = { processos: true };
    // Quando
    abrir();
    // Então
    expect(await screen.findByRole('heading', { name: 'Papéis escritos nos processos' })).toBeInTheDocument();
  });

  it('dado o administrador sem o módulo Processos, quando abre a página, então a seção não aparece', () => {
    // Dado
    sessao.modulos = {};
    // Quando
    abrir();
    // Então
    expect(screen.queryByRole('heading', { name: 'Papéis escritos nos processos' })).toBeNull();
  });
});
