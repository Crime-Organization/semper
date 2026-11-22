// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LigadosNoCadastro, type TextosDosLigados } from './LigadosNoCadastro';

const TEXTOS: TextosDosLigados = {
  rotulo: 'Demanda', maisUm: 'Mais uma demanda', adicionar: 'Adicionar demanda', tirar: 'Tirar a demanda', id: 'demanda', maximo: 2,
  dica: 'Busque pelo código.'
};
const busca = <input id="demanda" aria-describedby="demanda-dica" />;

describe('Os itens ligados no cadastro, quando podem ser vários (#283)', () => {
  it('quando ainda não há nenhum, então a busca aparece direto, com o nome do campo', () => {
    // Quando
    render(<LigadosNoCadastro textos={TEXTOS} escolhidos={[]} aoTirar={vi.fn()} busca={busca} />);
    // Então
    expect(screen.getByRole('textbox', { name: 'Demanda' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar demanda/ })).not.toBeInTheDocument();
  });

  it('dado um escolhido, quando a pessoa clica no "+", então a busca de mais um aparece, com o foco nela', async () => {
    // Dado
    render(<LigadosNoCadastro textos={TEXTOS} escolhidos={[{ id: 'd1', texto: 'D1 · Registro' }]} aoTirar={vi.fn()} busca={busca} />);
    expect(screen.getByRole('group', { name: 'Demanda' })).toHaveTextContent('D1 · Registro');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Adicionar demanda/ }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Mais uma demanda' })).toHaveFocus();
  });

  it('dados dois escolhidos, quando a pessoa tira um, então avisa qual', async () => {
    // Dado
    const aoTirar = vi.fn();
    render(<LigadosNoCadastro textos={TEXTOS} escolhidos={[{ id: 'd1', texto: 'D1' }, { id: 'd2', texto: 'D2' }]} aoTirar={aoTirar} busca={busca} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a demanda: D2' }));
    // Então
    expect(aoTirar).toHaveBeenCalledWith('d2');
  });

  it('dada a lista cheia, então o "+" não aparece', () => {
    // Quando
    render(<LigadosNoCadastro textos={TEXTOS} escolhidos={[{ id: 'd1', texto: 'D1' }, { id: 'd2', texto: 'D2' }]} aoTirar={vi.fn()} busca={busca} />);
    // Então
    expect(screen.queryByRole('button', { name: /Adicionar demanda/ })).not.toBeInTheDocument();
  });
});
