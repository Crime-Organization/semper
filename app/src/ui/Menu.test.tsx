// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MenuFlutuante } from './Menu';

// Botão "⋯" que abre o menu, como na barra de um módulo.
function ComMenu() {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" aria-label="Mais ações" onClick={e => setBotao(botao ? null : e.currentTarget)}>⋯</button>
    <p>Fora do menu</p>
    {botao && <MenuFlutuante botao={botao} rotulo="Mais ações" aoFechar={() => setBotao(null)}>
      <button type="button" role="menuitem">Exportar</button>
      <button type="button" role="menuitem">Importar</button>
    </MenuFlutuante>}
  </>;
}

describe('Menu flutuante', () => {
  it('quando a pessoa clica no botão, então o menu abre com o foco no primeiro item', async () => {
    // Dado
    render(<ComMenu />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    // Então
    expect(screen.getByRole('menu', { name: 'Mais ações' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Exportar' })).toHaveFocus();
  });

  it('quando a pessoa aperta Esc, então o menu fecha e o foco volta ao botão', async () => {
    // Dado
    render(<ComMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toHaveFocus();
  });

  it('quando a pessoa clica fora, então o menu fecha', async () => {
    // Dado
    render(<ComMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await new Promise(r => setTimeout(r, 0));
    // Quando
    await userEvent.click(screen.getByText('Fora do menu'));
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
