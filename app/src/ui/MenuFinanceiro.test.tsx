// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { MenuFinanceiro } from './MenuFinanceiro';
import { iniciarPreferencias } from './preferencias';

const abrir = (endereco: string, ehAdmin: boolean) => render(<MemoryRouter initialEntries={[endereco]}><MenuFinanceiro ehAdmin={ehAdmin} /></MemoryRouter>);
const opcoes = () => screen.queryAllByRole('link').map(l => l.textContent);

describe('Submenu do Financeiro', () => {
  beforeEach(() => iniciarPreferencias({}));

  it('dado um administrador, quando abre o submenu, então vê as três telas', async () => {
    // Dado
    abrir('/inicio/', true);
    expect(opcoes()).toEqual([]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Financeiro' }));
    // Então
    expect(opcoes()).toEqual(['Parcelas', 'Caixa', 'Lucro dos sócios']);
  });

  it('dado quem não é administrador, quando abre o submenu, então não vê Caixa nem Lucro dos sócios', async () => {
    // Dado
    abrir('/inicio/', false);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Financeiro' }));
    // Então
    expect(opcoes()).toEqual(['Parcelas']);
  });

  it.each(['/parcelas/', '/financeiro/', '/lucros/'])('dado que entro em %s, quando a tela abre, então o submenu aparece aberto', endereco => {
    // Quando
    abrir(endereco, true);
    // Então
    expect(screen.getByRole('button', { name: 'Financeiro' }).getAttribute('aria-expanded')).toBe('true');
  });
});
