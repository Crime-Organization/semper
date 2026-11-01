// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { iniciarPreferencias } from './preferencias';
import { SubmenuLateral } from './SubmenuLateral';

const abrir = (endereco: string) => render(<MemoryRouter initialEntries={[endereco]}>
  <Link to="/calendario/">Ir para o calendário</Link>
  <SubmenuLateral id="agenda" icone="calendario" rotulo="Agenda e calendário" caminhos={['/calendario']}>
    <a href="/calendario/">Feriados e prazos</a>
  </SubmenuLateral>
</MemoryRouter>);
const botao = () => screen.getByRole('button', { name: 'Agenda e calendário' });
const opcao = () => screen.queryByRole('link', { name: 'Feriados e prazos' });

describe('Submenu do menu lateral', () => {
  beforeEach(() => iniciarPreferencias({}));

  it('quando a pessoa clica no submenu, então as opções aparecem; clicando de novo, recolhem', async () => {
    // Dado
    abrir('/inicio/');
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(opcao()).toBeNull();
    // Quando
    await userEvent.click(botao());
    // Então
    expect(botao().getAttribute('aria-expanded')).toBe('true');
    expect(opcao()).not.toBeNull();
    // Quando
    await userEvent.click(botao());
    // Então
    expect(opcao()).toBeNull();
  });

  it('quando a pessoa está numa tela do submenu, então ele já aparece aberto', () => {
    // Quando
    abrir('/calendario/');
    // Então
    expect(opcao()).not.toBeNull();
  });

  it('quando a pessoa entra numa tela do submenu por outro caminho, então ele abre', async () => {
    // Dado
    abrir('/inicio/');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Ir para o calendário' }));
    // Então
    expect(opcao()).not.toBeNull();
  });

  it('quando a pessoa fecha o submenu estando dentro dele, então ele fecha', async () => {
    // Dado
    abrir('/calendario/');
    // Quando
    await userEvent.click(botao());
    // Então
    expect(opcao()).toBeNull();
  });

  it('quando a pessoa abriu o submenu e volta ao sistema, então ele continua aberto', async () => {
    // Dado
    const { unmount } = abrir('/inicio/');
    await userEvent.click(botao());
    unmount();
    // Quando
    abrir('/inicio/');
    // Então
    expect(opcao()).not.toBeNull();
  });

  it('quando a pessoa fechou o submenu e volta ao sistema fora dele, então ele continua fechado', async () => {
    // Dado
    iniciarPreferencias({ 'menu.agenda.aberto': true });
    const { unmount } = abrir('/inicio/');
    await userEvent.click(botao());
    unmount();
    // Quando
    abrir('/inicio/');
    // Então
    expect(opcao()).toBeNull();
  });
});
