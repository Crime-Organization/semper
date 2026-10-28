// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Avisos e pilha de desfazer são do sistema todo: cada caso recarrega o módulo para começar vazio.
let avisos: typeof import('./avisos');
beforeEach(async () => { vi.resetModules(); avisos = await import('./avisos'); render(<avisos.Avisos />); });

describe('Aviso com desfazer', () => {
  it('quando uma ação é feita, então aparece o aviso com o botão "Desfazer"', () => {
    // Quando
    act(() => { avisos.feito('Pessoa arquivada.', 'arquivar a pessoa', vi.fn()); });
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Pessoa arquivada.');
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('quando a pessoa clica em "Desfazer", então a ação é desfeita uma vez e o aviso some', async () => {
    // Dado
    const reverter = vi.fn();
    act(() => { avisos.feito('Pessoa arquivada.', 'arquivar a pessoa', reverter); });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    // Então
    expect(reverter).toHaveBeenCalledOnce();
    expect(screen.queryByText('Pessoa arquivada.')).not.toBeInTheDocument();
    expect(await screen.findByText('Desfeito: arquivar a pessoa.')).toBeInTheDocument();
  });

  it('quando a pessoa aperta Ctrl+Z fora de um campo, então a ação é desfeita', async () => {
    // Dado
    const reverter = vi.fn();
    act(() => { avisos.feito('Pessoa arquivada.', 'arquivar a pessoa', reverter); });
    // Quando
    await userEvent.keyboard('{Control>}z{/Control}');
    // Então
    await vi.waitFor(() => expect(reverter).toHaveBeenCalledOnce());
  });

  it('quando a pessoa aperta Ctrl+Z dentro de um campo de texto, então vale o desfazer do campo, não o do sistema', async () => {
    // Dado
    const reverter = vi.fn();
    render(<input aria-label="Nome" />);
    act(() => { avisos.feito('Pessoa arquivada.', 'arquivar a pessoa', reverter); });
    await userEvent.click(screen.getByRole('textbox', { name: 'Nome' }));
    // Quando
    await userEvent.keyboard('{Control>}z{/Control}');
    // Então
    expect(reverter).not.toHaveBeenCalled();
  });

  it('quando a ação de desfazer falha, então aparece o erro dela', async () => {
    // Dado
    act(() => { avisos.feito('Pessoa arquivada.', 'arquivar a pessoa', () => { throw new Error('Sem conexão.'); }); });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    // Então
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
  });
});
