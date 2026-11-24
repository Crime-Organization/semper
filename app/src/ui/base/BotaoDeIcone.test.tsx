// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BotaoDeIcone, propsDoBotaoDeIcone } from './BotaoDeIcone';

describe('Botão só de ícone (#423)', () => {
  it('quando aparece, então mostra só o ícone, com o rótulo de nome e a explicação na dica', () => {
    // Dado / Quando
    render(<BotaoDeIcone icone="editar" rotulo="Mudar o prazo Réplica" dica="Mudar o prazo" onClick={() => {}} />);
    // Então
    const botao = screen.getByRole('button', { name: 'Mudar o prazo Réplica' });
    expect(botao).toHaveTextContent('');
    expect(botao.querySelector('svg')).toHaveAttribute('data-icone', 'editar');
    expect(botao).toHaveAttribute('data-dica', 'Mudar o prazo');
  });

  it('quando a explicação diz mais que o rótulo, então o leitor de tela também a ouve, como descrição', () => {
    // Dado / Quando
    render(<BotaoDeIcone icone="lixeira" rotulo="Excluir" dica="Excluir o prazo" />);
    // Então
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveAccessibleDescription('Excluir o prazo');
  });

  it('quando não há explicação, então a dica é o próprio rótulo, sem descrição repetida', () => {
    // Dado / Quando
    const props = propsDoBotaoDeIcone('Lançar prazo');
    // Então
    expect(props).toEqual({ 'aria-label': 'Lançar prazo', 'data-dica': 'Lançar prazo' });
  });

  it('quando recebe o clique, então faz a ação', async () => {
    // Dado
    const mudar = vi.fn();
    render(<BotaoDeIcone icone="editar" rotulo="Mudar" onClick={mudar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mudar' }));
    // Então
    expect(mudar).toHaveBeenCalledOnce();
  });
});
