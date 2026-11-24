// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

describe('Menu flutuante com as setas (#399)', () => {
  function ComSetas() {
    const [botao, setBotao] = useState<HTMLElement | null>(null);
    return <>
      <button type="button" aria-label="Acrescentar" onClick={e => setBotao(botao ? null : e.currentTarget)}>+</button>
      {botao && <MenuFlutuante botao={botao} rotulo="Acrescentar" setas aoFechar={() => setBotao(null)}>
        <div role="none"><button type="button" role="menuitem">Ver checklists</button><button type="button" role="menuitem">Adicionar checklist</button></div>
        <div role="none"><button type="button" role="menuitem">Ver anotações</button></div>
      </MenuFlutuante>}
    </>;
  }

  it('dado o menu aberto, quando a pessoa usa as setas, então o foco anda pelos itens e dá a volta nas pontas', async () => {
    // Dado
    render(<ComSetas />);
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar' }));
    expect(screen.getByRole('menuitem', { name: 'Ver checklists' })).toHaveFocus();
    // Quando / Então
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Adicionar checklist' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Ver anotações' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Ver checklists' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Ver anotações' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('menuitem', { name: 'Adicionar checklist' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Ver checklists' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Ver anotações' })).toHaveFocus();
  });

  it('dado um menu sem as setas (o de sempre), quando a pessoa aperta a seta, então o foco fica onde está', async () => {
    // Dado
    render(<ComMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    // Quando
    await userEvent.keyboard('{ArrowDown}');
    // Então
    expect(screen.getByRole('menuitem', { name: 'Exportar' })).toHaveFocus();
  });
});

describe('Menu flutuante travado (#422)', () => {
  /** Um painel que trava enquanto grava, como a janela das datas. */
  function Travado() {
    const [botao, setBotao] = useState<HTMLElement | null>(null);
    return <>
      <button type="button" onClick={e => setBotao(e.currentTarget)}>Abrir</button>
      <p>Fora do painel</p>
      {botao && <MenuFlutuante painel travado botao={botao} rotulo="Gravando" aoFechar={() => setBotao(null)}><button type="button">Dentro</button></MenuFlutuante>}
    </>;
  }

  it('dado o painel travado (gravando), quando a pessoa aperta Esc ou clica fora, então ele continua aberto', async () => {
    // Dado
    render(<Travado />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    // Quando
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByText('Fora do painel'));
    // Então
    expect(screen.getByRole('dialog', { name: 'Gravando' })).toBeInTheDocument();
  });

  it('dado o painel travado dentro de um cartão, quando a pessoa aperta Esc, então nem o painel nem o cartão fecham', async () => {
    // Dado: o cartão fecha com o Esc que chega a ele, como os cartões do quadro.
    const cartaoFechou = vi.fn();
    const noCartao = (e: KeyboardEvent) => { if (e.key === 'Escape') cartaoFechou(); };
    document.addEventListener('keydown', noCartao);
    try {
      render(<Travado />);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
      // Quando
      await userEvent.keyboard('{Escape}');
      // Então
      expect(screen.getByRole('dialog', { name: 'Gravando' })).toBeInTheDocument();
      expect(cartaoFechou).not.toHaveBeenCalled();
    } finally { document.removeEventListener('keydown', noCartao); }
  });
});

describe('Menu flutuante com a página rolando atrás (#422)', () => {
  it('dado o painel aberto num cartão parado, quando a página atrás rola, então o painel continua junto do botão', async () => {
    // Dado: o botão fica parado na tela (como num cartão por cima da página), a 100px do topo
    render(<ComMenu />);
    const botao = screen.getByRole('button', { name: 'Mais ações' });
    vi.spyOn(botao, 'getBoundingClientRect').mockReturnValue({ top: 80, bottom: 100, left: 10, right: 40, width: 30, height: 20, x: 10, y: 80, toJSON: () => ({}) });
    await userEvent.click(botao);
    const menu = screen.getByRole('menu', { name: 'Mais ações' });
    const antes = parseFloat(menu.style.top);
    // Quando: a página rola 200px
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });
    window.dispatchEvent(new Event('scroll'));
    await new Promise(r => setTimeout(r, 0));
    // Então: o painel desce o mesmo tanto, e continua na mesma altura da tela
    try {
      expect(parseFloat(menu.style.top)).toBe(antes + 200);
    } finally { Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 }); }
  });
});
