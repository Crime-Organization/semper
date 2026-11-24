// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DISTANCIA_DO_BOTAO, FaixaDoCartao, MARGEM_DA_TELA, MenuFlutuante } from './Menu';

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

describe('Menu flutuante dentro de um cartão, com a faixa de botões no alto (#422)', () => {
  /** Um cartão com a faixa do lápis no alto (até 54px da tela) e, no corpo, a data que abre a janela das datas. */
  function NoCartao() {
    const [faixa, setFaixa] = useState<HTMLElement | null>(null);
    const [botao, setBotao] = useState<HTMLElement | null>(null);
    return <FaixaDoCartao.Provider value={faixa}>
      <div ref={setFaixa}>
        <button type="button" aria-label="Editar">✎</button>
        <button type="button" aria-label="Mais ações do cartão" onClick={e => setBotao(botao ? null : e.currentTarget)}>⋯</button>
      </div>
      <button type="button" aria-label="Data da assinatura" onClick={e => setBotao(botao ? null : e.currentTarget)}>10/03/2026</button>
      {botao && <MenuFlutuante painel botao={botao} rotulo="Mudar a data" aoFechar={() => setBotao(null)}><button type="button">Salvar</button></MenuFlutuante>}
    </FaixaDoCartao.Provider>;
  }
  const retangulo = (top: number, bottom: number) => ({ top, bottom, left: 10, right: 40, width: 30, height: bottom - top, x: 10, y: top, toJSON: () => ({}) });

  it('dada a data rolada até o alto do cartão, embaixo da faixa, quando a pessoa a clica, então a janela abre abaixo da faixa e não cobre o lápis', async () => {
    // Dado: a faixa vai até 54px; a data rolou para 0–27px, por trás dela
    render(<NoCartao />);
    const faixa = screen.getByRole('button', { name: 'Editar' }).parentElement!;
    vi.spyOn(faixa, 'getBoundingClientRect').mockReturnValue(retangulo(14, 54));
    const data = screen.getByRole('button', { name: 'Data da assinatura' });
    vi.spyOn(data, 'getBoundingClientRect').mockReturnValue(retangulo(0, 27));
    // Quando
    await userEvent.click(data);
    // Então: abaixo da faixa (54 + a distância do botão), e do tamanho que cabe dali até o pé da tela
    const janela = screen.getByRole('dialog', { name: 'Mudar a data' });
    expect(parseFloat(janela.style.top)).toBe(54 + DISTANCIA_DO_BOTAO);
    expect(parseFloat(janela.style.maxHeight)).toBe(window.innerHeight - (54 + DISTANCIA_DO_BOTAO) - MARGEM_DA_TELA);
  });

  it('dado o botão ⋯ da própria faixa, quando a pessoa o clica, então o menu abre junto dele, como sempre', async () => {
    // Dado
    render(<NoCartao />);
    const mais = screen.getByRole('button', { name: 'Mais ações do cartão' });
    vi.spyOn(mais.parentElement!, 'getBoundingClientRect').mockReturnValue(retangulo(14, 54));
    vi.spyOn(mais, 'getBoundingClientRect').mockReturnValue(retangulo(14, 54));
    // Quando
    await userEvent.click(mais);
    // Então
    const menu = screen.getByRole('dialog', { name: 'Mudar a data' });
    expect(parseFloat(menu.style.top)).toBe(54 + DISTANCIA_DO_BOTAO);
    expect(menu.style.maxHeight).toBe('');
  });
});
