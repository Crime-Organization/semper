// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O círculo de concluir antes do título (#350), na miniatura do quadro e na linha da tabela: o nome com o título do item, a dica,
// o visto só para ver, uma ação de cada vez, sem arrastar a miniatura, e o foco que segue o item quando ele muda de coluna.
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CirculoDoItem } from '../../regras/conclusaoNoCartao';
import { ConcluirNaMiniatura } from './ConcluirNaMiniatura';

const circulo = (estado: CirculoDoItem, aoAgir = vi.fn(() => Promise.resolve())) =>
  <ConcluirNaMiniatura id="t1" titulo="Emitir a GRU" estado={estado} concluida="Tarefa concluída" aoAgir={aoAgir} />;

describe('O círculo de concluir na miniatura (#350)', () => {
  it.each([
    ['concluir', 'Concluir Emitir a GRU', 'Concluir'],
    ['reabrir', 'Reabrir Emitir a GRU', 'Reabrir']
  ] as const)('dada a ação %s, quando o círculo aparece, então é um botão com o nome "%s", a dica "%s" e o visto', (estado, nome, dica) => {
    // Quando
    render(circulo(estado));
    // Então
    const botao = screen.getByRole('button', { name: nome });
    expect(botao).toHaveAttribute('data-dica', dica);
    expect(botao.querySelector('svg')).not.toBeNull();
  });

  it('dado um quadro sem a coluna das concluídas (nada a mostrar), quando a miniatura aparece, então não há círculo', () => {
    // Quando
    const { container } = render(circulo(null));
    // Então
    expect(container).toBeEmptyDOMElement();
  });

  it('dado o item concluído que a pessoa só lê (ou arquivado), quando o círculo aparece, então é só o visto, fora do Tab', () => {
    // Quando
    render(circulo('concluida'));
    // Então
    expect(screen.getByRole('img', { name: 'Tarefa concluída' })).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('dado o círculo vazio, quando a pessoa clica duas vezes seguidas, então a ação acontece uma vez só, e ele já mostra o concluído enquanto grava', async () => {
    // Dado
    let terminar = () => {};
    const aoAgir = vi.fn(() => new Promise<void>(r => { terminar = r; }));
    render(circulo('concluir', aoAgir));
    const botao = screen.getByRole('button', { name: 'Concluir Emitir a GRU' });
    // Quando
    await userEvent.click(botao);
    await userEvent.click(botao);
    // Então
    expect(aoAgir).toHaveBeenCalledTimes(1);
    expect(aoAgir).toHaveBeenCalledWith('concluir');
    expect(botao).toHaveAttribute('aria-busy', 'true');
    expect(botao).toHaveAttribute('data-estado', 'reabrir');
    expect(botao).not.toBeDisabled();
    await act(async () => { terminar(); });
    expect(botao).not.toHaveAttribute('aria-busy');
  });

  it('dado o círculo, quando a pessoa começa a arrastá-lo, então o arrasto é cancelado e não chega à miniatura', () => {
    // Dado
    const arrastarMiniatura = vi.fn();
    render(<article draggable onDragStart={arrastarMiniatura}>{circulo('concluir')}</article>);
    // Quando
    const comecou = fireEvent.dragStart(screen.getByRole('button', { name: 'Concluir Emitir a GRU' }));
    // Então
    expect(comecou).toBe(false);
    expect(arrastarMiniatura).not.toHaveBeenCalled();
  });

  it.each([
    ['o teclado', true],
    ['o mouse', false]
  ])('dado o item que muda de coluna, quando a pessoa conclui pelo %s e o círculo aparece na coluna nova, então o foco vai para ele = %s', async (_, comFoco) => {
    // Dado
    const { rerender } = render(<div key="velha">{circulo('concluir')}</div>);
    const botao = screen.getByRole('button', { name: 'Concluir Emitir a GRU' });
    // Quando
    if (comFoco) { botao.focus(); await userEvent.keyboard('{Enter}'); }
    else await userEvent.click(botao);
    await act(async () => { await Promise.resolve(); });
    rerender(<div key="nova">{circulo('reabrir')}</div>);
    // Então
    expect(document.activeElement === screen.getByRole('button', { name: 'Reabrir Emitir a GRU' })).toBe(comFoco);
  });
});
