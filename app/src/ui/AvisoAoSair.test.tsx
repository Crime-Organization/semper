// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avisar } from './avisos';
import { AvisoAoSair, podeSairDoCadastro } from './AvisoAoSair';
import { Janelas } from './janela';

vi.mock('./avisos', async original => ({ ...await original<typeof import('./avisos')>(), avisar: vi.fn() }));

/** Um cadastro mínimo: um campo, o que o sistema preenche sozinho, salvar e sair por um link. */
function Cadastro() {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState('a');
  const liberada = useRef(false);
  const navegar = useNavigate();
  return <>
    <AvisoAoSair estado={{ nome, tipo }} liberada={liberada} ocupado={salvando} />
    <label>Tipo A<input type="radio" name="tipo" checked={tipo === 'a'} onChange={() => setTipo('a')} /></label>
    <label>Tipo B<input type="radio" name="tipo" checked={tipo === 'b'} onChange={() => setTipo('b')} /></label>
    <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} /></label>
    <button type="button" data-testid="sistema" onClick={() => setNome('Vindo do sistema')}>Sistema preenche</button>
    <button type="button" onClick={() => { liberada.current = true; navegar('/lista'); }}>Salvar</button>
    <Link to="/lista">Lista</Link>
    <button type="button" onClick={() => setSalvando(true)}>Começar a salvar</button>
    <Link to="/cadastro?outro=1">Abrir de novo</Link>
    <Link to="/entrar/">Entrada</Link>
  </>;
}

function abrirCadastro() {
  const roteador = createMemoryRouter([
    { path: '/cadastro', element: <Cadastro /> },
    { path: '/lista', element: <p>Página da lista</p> },
    { path: '/entrar', element: <p>Página de entrada</p> }
  ], { initialEntries: ['/cadastro'] });
  render(<><RouterProvider router={roteador} /><Janelas /></>);
  return roteador;
}

const pergunta = () => screen.queryByRole('dialog', { name: 'Sair sem salvar?' });
const digitar = (texto: string) => userEvent.type(screen.getByLabelText('Nome'), texto);
const irParaLista = () => userEvent.click(screen.getByRole('link', { name: 'Lista' }));
/** Dispara o beforeunload, como o navegador ao recarregar ou fechar a aba; devolve se ele pediu para confirmar. */
function fecharAba() {
  const evento = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(evento);
  return evento.defaultPrevented;
}

describe('Aviso ao sair de um cadastro', () => {
  // As janelas são do sistema todo: a pergunta que ficou aberta num caso não pode passar para o próximo.
  afterEach(() => {
    if (pergunta()) fireEvent.keyDown(document, { key: 'Escape' });
    cleanup();
    vi.mocked(avisar).mockClear();
  });

  it('dado um cadastro vazio, quando a pessoa sai, então nada é perguntado', async () => {
    // Dado
    abrirCadastro();
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dado um campo preenchido, quando a pessoa sai, então a pergunta aparece e o cadastro continua', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toHaveTextContent('O que você preencheu neste cadastro será perdido.');
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana');
  });

  it('dada a pergunta aberta, quando a pessoa escolhe continuar, então fica no cadastro com o que digitou e pode perguntar de novo', async () => {
    // Dado
    const roteador = abrirCadastro();
    await digitar('Ana');
    await irParaLista();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    // Então
    await waitFor(() => expect(pergunta()).not.toBeInTheDocument());
    expect(roteador.state.location.pathname).toBe('/cadastro');
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana');
    await irParaLista();
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
  });

  it('dada a pergunta aberta, quando a pessoa escolhe sair, então vai para onde tinha pedido', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    await irParaLista();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
  });

  it('dado um campo preenchido, quando o cadastro é salvo, então nada é perguntado', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dado um campo preenchido e depois apagado, quando a pessoa sai, então nada é perguntado', async () => {
    // Dado
    abrirCadastro();
    await digitar('A');
    await digitar('{Backspace}');
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
  });

  it('dado um campo que o sistema preencheu depois de um clique na tela, quando a pessoa sai, então nada é perguntado', async () => {
    // Dado: um clique num campo, e só depois chega o que o sistema preenche
    abrirCadastro();
    await userEvent.click(screen.getByLabelText('Nome'));
    act(() => screen.getByTestId('sistema').click());
    expect(screen.getByLabelText('Nome')).toHaveValue('Vindo do sistema');
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
  });

  it('dado um campo preenchido, quando a pessoa abre o mesmo cadastro de novo, então a pergunta aparece', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Abrir de novo' }));
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
  });

  it('dado um campo preenchido, quando a sessão acaba e o sistema leva à entrada, então nada é perguntado', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    // Quando
    await userEvent.click(screen.getByRole('link', { name: 'Entrada' }));
    // Então
    expect(await screen.findByText('Página de entrada')).toBeInTheDocument();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dado um cadastro salvando, quando a pessoa tenta sair, então a saída espera, sem pergunta', async () => {
    // Dado
    const roteador = abrirCadastro();
    await digitar('Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Começar a salvar' }));
    // Quando
    await irParaLista();
    // Então
    await waitFor(() => expect(avisar).toHaveBeenCalledWith('Espere terminar de salvar.'));
    expect(pergunta()).not.toBeInTheDocument();
    expect(roteador.state.location.pathname).toBe('/cadastro');
  });

  it('dado um campo preenchido, quando o botão Sair do sistema confere, então a pergunta vem antes e a resposta volta', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    // Quando
    let resposta: Promise<boolean>;
    act(() => { resposta = podeSairDoCadastro(); });
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    // Então
    expect(await resposta!).toBe(false);
  });

  it('dado um cadastro salvando, quando o botão Sair do sistema confere, então não sai e avisa para esperar', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Começar a salvar' }));
    // Quando
    const pode = await podeSairDoCadastro();
    // Então
    expect(pode).toBe(false);
    expect(avisar).toHaveBeenCalledWith('Espere terminar de salvar.');
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dada só uma opção marcada, quando a pessoa sai, então a pergunta aparece', async () => {
    // Dado
    abrirCadastro();
    await userEvent.click(screen.getByLabelText('Tipo B'));
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
  });

  it('dada uma opção marcada e depois desmarcada, quando a pessoa sai, então nada é perguntado', async () => {
    // Dado
    abrirCadastro();
    await userEvent.click(screen.getByLabelText('Tipo B'));
    await userEvent.click(screen.getByLabelText('Tipo A'));
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
  });

  it('dado um cadastro vazio, quando o botão Sair do sistema confere, então pode sair sem pergunta', async () => {
    // Dado
    abrirCadastro();
    // Quando
    const pode = await podeSairDoCadastro();
    // Então
    expect(pode).toBe(true);
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dado um campo preenchido, quando a aba fecha ou recarrega, então o navegador pede confirmação', async () => {
    // Dado
    abrirCadastro();
    await digitar('Ana');
    // Quando
    const pediu = fecharAba();
    // Então
    expect(pediu).toBe(true);
  });

  it('dado um cadastro vazio, quando a aba fecha ou recarrega, então o navegador não pede confirmação', () => {
    // Dado
    abrirCadastro();
    // Quando
    const pediu = fecharAba();
    // Então
    expect(pediu).toBe(false);
  });
});
