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

describe('Submenu do menu lateral com o "+" na linha (#404)', () => {
  beforeEach(() => iniciarPreferencias({}));
  const abrirComMais = () => render(<MemoryRouter initialEntries={['/inicio/']}>
    <SubmenuLateral id="agenda" icone="calendario" rotulo="Agenda e calendário" caminhos={['/calendario']}
      mais={<Link to="/agenda/novo/">Cadastrar compromisso</Link>}>
      <a href="/calendario/">Feriados e prazos</a>
    </SubmenuLateral>
  </MemoryRouter>);
  const mais = () => screen.queryByRole('link', { name: 'Cadastrar compromisso' });

  it('dado o submenu fechado, quando o menu aparece, então o "+" já está à vista, ao lado do botão', () => {
    // Quando
    abrirComMais();
    // Então
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(mais()).not.toBeNull();
    expect(mais()!.parentElement).toBe(botao().parentElement);
  });

  it('dado o "+" na linha, quando a pessoa abre e fecha o submenu, então ele continua funcionando e o "+" fica lá', async () => {
    // Dado
    abrirComMais();
    // Quando
    await userEvent.click(botao());
    // Então
    expect(opcao()).not.toBeNull();
    expect(mais()).not.toBeNull();
    // Quando
    await userEvent.click(botao());
    // Então
    expect(opcao()).toBeNull();
    expect(mais()).not.toBeNull();
  });

  it('dado um submenu sem "+" (como Processos), quando o menu aparece, então não há "+"', () => {
    // Quando
    abrir('/inicio/');
    // Então
    expect(mais()).toBeNull();
  });
});
