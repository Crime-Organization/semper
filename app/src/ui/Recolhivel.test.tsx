// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { iniciarPreferencias } from './preferencias';
import { Recolhivel } from './Recolhivel';

describe('Seção recolhível', () => {
  it('quando começa fechada, então só o título aparece', () => {
    // Quando
    render(<Recolhivel titulo="Vínculos" icone="vinculo" contador={2}><p>João é cônjuge</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: /Vínculos/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Vínculos/ })).toHaveTextContent('2');
    expect(screen.queryByText('João é cônjuge')).not.toBeInTheDocument();
  });

  it('quando a pessoa clica no título, então o conteúdo aparece', async () => {
    // Dado
    render(<Recolhivel titulo="Vínculos" icone="vinculo"><p>João é cônjuge</p></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Vínculos' }));
    // Então
    expect(screen.getByRole('button', { name: 'Vínculos' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('João é cônjuge')).toBeInTheDocument();
  });

  it('quando a pessoa usa o teclado (Tab e Enter), então abre e fecha do mesmo jeito', async () => {
    // Dado
    render(<Recolhivel titulo="Vínculos" icone="vinculo"><p>João é cônjuge</p></Recolhivel>);
    await userEvent.tab();
    // Quando
    await userEvent.keyboard('{Enter}');
    const depoisDeAbrir = screen.getByRole('button', { name: 'Vínculos' }).getAttribute('aria-expanded');
    await userEvent.keyboard('{Enter}');
    // Então
    expect(depoisDeAbrir).toBe('true');
    expect(screen.getByRole('button', { name: 'Vínculos' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('João é cônjuge')).not.toBeInTheDocument();
  });

  it('quando o usuário nunca mexeu na seção, então ela começa recolhida; se já a abriu, começa aberta', () => {
    // Dado
    iniciarPreferencias({ 'teste.aberta': true });
    // Quando
    render(<>
      <Recolhivel titulo="Nunca mexida" icone="vinculo" preferencia="teste.nunca"><p>a</p></Recolhivel>
      <Recolhivel titulo="Já aberta" icone="vinculo" preferencia="teste.aberta"><p>b</p></Recolhivel>
    </>);
    // Então
    expect(screen.getByRole('button', { name: 'Nunca mexida' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Já aberta' })).toHaveAttribute('aria-expanded', 'true');
  });
});
