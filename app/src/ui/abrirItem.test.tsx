// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cliquesQueAbrem, LinhaQueAbre, NomeDaLinha } from './abrirItem';

const PARA = '/pessoas/?id=p1';
let abrirAba: ReturnType<typeof vi.spyOn>;
beforeEach(() => { abrirAba = vi.spyOn(window, 'open').mockReturnValue(null); });
afterEach(() => { vi.restoreAllMocks(); });

function Endereco() {
  const { pathname, search } = useLocation();
  return <output aria-label="Endereço">{pathname + search}</output>;
}

/** Tabela com uma linha que abre a pessoa p1: caixa de seleção, nome e telefone. */
function montar(aoAbrir?: () => void) {
  const marcar = vi.fn();
  render(<MemoryRouter initialEntries={['/pessoas/']}>
    <table><tbody>
      <LinhaQueAbre para={PARA} aoAbrir={aoAbrir}>
        <td><input type="checkbox" aria-label="Selecionar JOSÉ" onChange={marcar} /></td>
        <td><NomeDaLinha>JOSÉ DA SILVA TESTE</NomeDaLinha></td>
        <td>(38) 99000-1000</td>
      </LinhaQueAbre>
    </tbody></table>
    <Endereco />
  </MemoryRouter>);
  return { marcar, linha: screen.getByRole('row'), telefone: screen.getByRole('cell', { name: '(38) 99000-1000' }) };
}

describe('Abrir um item da lista', () => {
  it('quando a pessoa clica na linha, então o item abre aqui, sem aba nova', async () => {
    // Dado
    const aoAbrir = vi.fn();
    const { telefone } = montar(aoAbrir);
    // Quando
    await userEvent.click(telefone);
    // Então
    expect(aoAbrir).toHaveBeenCalledOnce();
    expect(abrirAba).not.toHaveBeenCalled();
  });

  it.each([['Control'], ['Meta']])('quando a pessoa dá %s+clique na linha, então o endereço do item abre numa aba nova', async tecla => {
    // Dado
    const aoAbrir = vi.fn();
    const { telefone } = montar(aoAbrir);
    const usuario = userEvent.setup();
    // Quando
    await usuario.keyboard(`{${tecla}>}`);
    await usuario.click(telefone);
    await usuario.keyboard(`{/${tecla}}`);
    // Então
    expect(abrirAba).toHaveBeenCalledExactlyOnceWith(PARA, '_blank');
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('quando a pessoa clica com a rodinha na linha, então o endereço do item abre numa aba nova', async () => {
    // Dado
    const aoAbrir = vi.fn();
    const { telefone } = montar(aoAbrir);
    // Quando
    await userEvent.pointer({ keys: '[MouseMiddle]', target: telefone });
    // Então
    expect(abrirAba).toHaveBeenCalledExactlyOnceWith(PARA, '_blank');
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('quando a pessoa marca a caixa de seleção, então a caixa muda e a linha não abre', async () => {
    // Dado
    const aoAbrir = vi.fn();
    const { marcar } = montar(aoAbrir);
    // Quando
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar JOSÉ' }));
    // Então
    expect(marcar).toHaveBeenCalledOnce();
    expect(aoAbrir).not.toHaveBeenCalled();
    expect(abrirAba).not.toHaveBeenCalled();
  });

  it('quando a linha mostra o nome, então ele é um link para o endereço do item (o botão direito oferece abrir em nova aba)', () => {
    // Quando
    montar(vi.fn());
    // Então
    expect(screen.getByRole('link', { name: 'JOSÉ DA SILVA TESTE' })).toHaveAttribute('href', PARA);
  });

  it('quando a pessoa clica no nome, então o item abre aqui e o link não navega sozinho', () => {
    // Dado
    const aoAbrir = vi.fn();
    montar(aoAbrir);
    // Quando
    const seguiu = fireEvent.click(screen.getByRole('link', { name: 'JOSÉ DA SILVA TESTE' }));
    // Então
    expect(seguiu).toBe(false);
    expect(aoAbrir).toHaveBeenCalledOnce();
    expect(abrirAba).not.toHaveBeenCalled();
  });

  it('quando a pessoa dá Ctrl+clique no nome, então abre uma aba nova só', () => {
    // Dado
    const aoAbrir = vi.fn();
    montar(aoAbrir);
    // Quando
    fireEvent.click(screen.getByRole('link', { name: 'JOSÉ DA SILVA TESTE' }), { ctrlKey: true });
    // Então
    expect(abrirAba).toHaveBeenCalledExactlyOnceWith(PARA, '_blank');
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('quando a linha não diz o que fazer no clique, então o clique vai ao endereço do item', async () => {
    // Dado
    const { telefone } = montar();
    // Quando
    await userEvent.click(telefone);
    // Então
    expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent(PARA);
  });

  it('quando a pessoa clica num botão de dentro do cartão, então o botão cuida do clique e o cartão não abre', async () => {
    // Dado
    const aoAbrir = vi.fn(), apagar = vi.fn();
    render(<article aria-label="Cartão" {...cliquesQueAbrem(PARA, aoAbrir)}>
      JOSÉ DA SILVA TESTE <button type="button" onClick={apagar}>Apagar</button>
    </article>);
    const usuario = userEvent.setup();
    // Quando
    await usuario.click(screen.getByRole('button', { name: 'Apagar' }));
    await usuario.keyboard('{Control>}');
    await usuario.click(screen.getByRole('button', { name: 'Apagar' }));
    await usuario.keyboard('{/Control}');
    // Então
    expect(apagar).toHaveBeenCalledTimes(2);
    expect(aoAbrir).not.toHaveBeenCalled();
    expect(abrirAba).not.toHaveBeenCalled();
  });
});
