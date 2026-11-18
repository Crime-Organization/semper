// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Avisos } from './avisos';
import { AvisoDaEdicaoNoLugar, gravarNoLugar, useEdicaoNoLugar, type GravacaoNoLugar } from './EdicaoNoLugar';
import { Janelas } from './janela';
import { TituloEditavel } from './base';

type Dados = { titulo?: string };
/** Uma gravação do título no próprio lugar, com o que a tela mostra e o que o banco recebe. */
function gravacao(gravar: (d: Dados) => Promise<unknown>): GravacaoNoLugar<Dados> & { mostrados: Dados[] } {
  const mostrados: Dados[] = [];
  return {
    novo: { titulo: 'Novo' }, antes: { titulo: 'Antigo' }, gravar, aviso: 'Tarefa atualizada.', oQue: 'atualização da tarefa',
    mudanca: { tipo: 'tarefaAtualizada', id: 't1' }, mostrar: d => mostrados.push(d), depois: vi.fn(), mostrados
  };
}

describe('Gravar o título ou a descrição no próprio lugar (#346)', () => {
  it('dada uma gravação que dá certo, quando o cartão grava, então mostra o novo na hora, avisa com Desfazer, e o Desfazer grava o de antes', async () => {
    // Dado
    render(<Avisos />);
    const gravar = vi.fn(() => Promise.resolve());
    const g = gravacao(gravar);
    // Quando
    await gravarNoLugar(g);
    // Então
    expect(g.mostrados).toEqual([{ titulo: 'Novo' }]);
    expect(gravar).toHaveBeenCalledWith({ titulo: 'Novo' });
    expect(g.depois).toHaveBeenCalledOnce();
    expect(await screen.findByText('Tarefa atualizada.')).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    // Então
    await vi.waitFor(() => expect(gravar).toHaveBeenLastCalledWith({ titulo: 'Antigo' }));
  });

  it('dada uma gravação que falha, quando o cartão grava, então o de antes volta à tela, o erro segue adiante e nada de Desfazer', async () => {
    // Dado
    render(<Avisos />);
    const g = gravacao(() => Promise.reject(new Error('O título pode ter até 300 caracteres.')));
    // Quando / Então
    await expect(gravarNoLugar(g)).rejects.toThrow('O título pode ter até 300 caracteres.');
    expect(g.mostrados).toEqual([{ titulo: 'Novo' }, { titulo: 'Antigo' }]);
    expect(g.depois).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
  });
});

/** Um cartão com o título no próprio lugar e um link para sair dele. */
function Cartao({ aoSalvar }: { aoSalvar: (titulo: string) => void }) {
  const [titulo, setTitulo] = useState('Emitir a GRU');
  const edicao = useEdicaoNoLugar();
  return <>
    <AvisoDaEdicaoNoLugar edicao={edicao} gravado={{ titulo }} />
    <TituloEditavel key={edicao.chave} valor={titulo} aoSalvar={t => { aoSalvar(t); setTitulo(t); }} aoMudarRascunho={edicao.rascunhoDe('titulo')} />
    <Link to="/lista">Lista</Link>
  </>;
}
function abrirCartao(aoSalvar: (titulo: string) => void = vi.fn()) {
  const roteador = createMemoryRouter([
    { path: '/cartao', element: <Cartao aoSalvar={aoSalvar} /> },
    { path: '/lista', element: <p>Página da lista</p> }
  ], { initialEntries: ['/cartao'] });
  render(<><RouterProvider router={roteador} /><Janelas /></>);
}
const pergunta = () => screen.queryByRole('dialog', { name: 'Sair sem salvar?' });

describe('Sair do cartão com o título por salvar (#346)', () => {
  it('dado o título aberto sem mudança, quando a pessoa sai do cartão, então sai sem perguntar', async () => {
    // Dado
    abrirCartao();
    await userEvent.click(screen.getByRole('button', { name: 'Emitir a GRU' }));
    // Quando
    screen.getByRole('link', { name: 'Lista' }).click();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dado o título mudado e ainda não salvo, quando a pessoa sai do cartão, então o SEMPER pergunta, e "Sair sem salvar" sai sem gravar', async () => {
    // Dado
    const aoSalvar = vi.fn();
    abrirCartao(aoSalvar);
    await userEvent.click(screen.getByRole('button', { name: 'Emitir a GRU' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), ' de novo');
    // Quando
    screen.getByRole('link', { name: 'Lista' }).click();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });
});
