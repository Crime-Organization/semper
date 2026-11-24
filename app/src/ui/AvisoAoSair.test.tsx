// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLayoutEffect, useRef, useState } from 'react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avisar } from './avisos';
import { AvisoAoSair, podeSairDoCadastro, SEM_SAIR_DA_TELA } from './AvisoAoSair';
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
/** Fecha a aba no instante em que a tela muda para `quando` (antes dos efeitos que o React roda depois de desenhar). */
function FecharAbaAoMudar({ quando, aoFechar }: { quando: boolean; aoFechar: (pediu: boolean) => void }) {
  useLayoutEffect(() => { if (quando) aoFechar(fecharAba()); }, [quando, aoFechar]);
  return null;
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

  it('dado algo por gravar, quando acaba de ser gravado e a aba fecha nesse mesmo instante, então o navegador não pede confirmação (#420)', async () => {
    // Dado: o aviso fica sempre na tela (como na anotação); a aba fecha no instante em que a tela muda para "gravado", antes dos
    // efeitos que o React roda depois de desenhar
    const pediuAoFecharLogo: boolean[] = [];
    function TextoGravado() {
      const [porSalvar, setPorSalvar] = useState(true);
      const liberada = useRef(false);
      return <>
        <AvisoAoSair preenchido={porSalvar} liberada={liberada} ocupado={false} />
        <FecharAbaAoMudar quando={!porSalvar} aoFechar={pediu => pediuAoFecharLogo.push(pediu)} />
        <button type="button" onClick={() => setPorSalvar(false)}>Gravar</button>
      </>;
    }
    render(<RouterProvider router={createMemoryRouter([{ path: '/anotacao', element: <TextoGravado /> }], { initialEntries: ['/anotacao'] })} />);
    expect(fecharAba()).toBe(true);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Gravar' }));
    // Então
    expect(pediuAoFecharLogo.length).toBeGreaterThan(0);
    expect(pediuAoFecharLogo).not.toContain(true);
    expect(fecharAba()).toBe(false);
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

/** A edição no próprio lugar (#339): o aviso só existe enquanto há algo por salvar, e quem o põe já diz que há. */
function EdicaoNoLugar({ aoDescartar }: { aoDescartar?: () => void }) {
  const [porSalvar, setPorSalvar] = useState(false);
  const liberada = useRef(false);
  return <>
    {porSalvar && <AvisoAoSair preenchido liberada={liberada} ocupado={false} aoDescartar={aoDescartar} />}
    <button type="button" onClick={() => setPorSalvar(true)}>Mudar o título</button>
    <button type="button" onClick={() => setPorSalvar(false)}>Salvar o título</button>
    <Link to="/lista">Lista</Link>
  </>;
}

describe('Aviso ao sair de uma edição no próprio lugar (#339)', () => {
  afterEach(() => {
    if (pergunta()) fireEvent.keyDown(document, { key: 'Escape' });
    cleanup();
  });
  function abrirEdicao(aoDescartar?: () => void) {
    const roteador = createMemoryRouter([
      { path: '/cartao', element: <EdicaoNoLugar aoDescartar={aoDescartar} /> },
      { path: '/lista', element: <p>Página da lista</p> }
    ], { initialEntries: ['/cartao'] });
    render(<><RouterProvider router={roteador} /><Janelas /></>);
  }

  it('dada uma mudança por salvar, quando a pessoa sai por um link, então o SEMPER pergunta antes, sem precisar comparar campos', async () => {
    // Dado
    abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o título' }));
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    expect(screen.queryByText('Página da lista')).not.toBeInTheDocument();
  });

  it('dada a mudança já salva, quando a pessoa sai por um link, então sai sem pergunta', async () => {
    // Dado
    abrirEdicao();
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o título' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar o título' }));
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dada a pergunta aberta, quando a pessoa escolhe "Sair sem salvar", então a edição é descartada antes de sair; ao continuar, nada é descartado', async () => {
    // Dado
    const aoDescartar = vi.fn();
    abrirEdicao(aoDescartar);
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o título' }));
    await irParaLista();
    // Quando: continua
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    // Então
    expect(aoDescartar).not.toHaveBeenCalled();
    // Quando: tenta de novo e escolhe sair
    await irParaLista();
    await userEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(aoDescartar).toHaveBeenCalledOnce();
  });
});

/**
 * Dois avisos no mesmo cartão (#395): o lápis aberto e a descrição mudada no lugar. Cada um entra e sai da tela por conta própria,
 * e cada um diz se tem algo a perder.
 */
function DoisAvisos({ descartes }: { descartes: string[] }) {
  const [lapis, setLapis] = useState(false), [lapisMudado, setLapisMudado] = useState(false);
  const [descricao, setDescricao] = useState(false);
  const liberada = useRef(false);
  return <>
    {descricao && <AvisoAoSair preenchido liberada={liberada} ocupado={false} aoDescartar={() => descartes.push('descrição')} />}
    {lapis && <AvisoAoSair preenchido={lapisMudado} liberada={liberada} ocupado={false} aoDescartar={() => descartes.push('lápis')} />}
    <button type="button" onClick={() => setDescricao(true)}>Mudar a descrição</button>
    <button type="button" onClick={() => setLapis(true)}>Abrir o lápis</button>
    <button type="button" onClick={() => setLapisMudado(true)}>Mudar no lápis</button>
    <button type="button" onClick={() => { setLapis(false); setLapisMudado(false); }}>Cancelar o lápis</button>
    <button type="button" onClick={() => setDescricao(false)}>Salvar a descrição</button>
    <Link to="/lista">Lista</Link>
  </>;
}

describe('Mais de um aviso na mesma tela (#395)', () => {
  afterEach(() => {
    if (pergunta()) fireEvent.keyDown(document, { key: 'Escape' });
    cleanup();
  });
  function abrir() {
    const descartes: string[] = [];
    const roteador = createMemoryRouter([
      { path: '/cartao', element: <DoisAvisos descartes={descartes} /> },
      { path: '/lista', element: <p>Página da lista</p> }
    ], { initialEntries: ['/cartao'] });
    render(<><RouterProvider router={roteador} /><Janelas /></>);
    return descartes;
  }
  const clicar = (nome: string) => userEvent.click(screen.getByRole('button', { name: nome }));

  it('dada a descrição por salvar, quando o lápis abre e é cancelado e a pessoa sai, então a pergunta ainda aparece', async () => {
    // Dado
    abrir();
    await clicar('Mudar a descrição');
    await clicar('Abrir o lápis');
    await clicar('Cancelar o lápis');
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    expect(screen.queryByText('Página da lista')).not.toBeInTheDocument();
  });

  it('dado o lápis mudado, quando a descrição é mudada e salva no lugar e a pessoa sai, então a pergunta ainda aparece', async () => {
    // Dado
    abrir();
    await clicar('Abrir o lápis');
    await clicar('Mudar no lápis');
    await clicar('Mudar a descrição');
    await clicar('Salvar a descrição');
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
  });

  it('dados os dois por salvar, quando a pessoa sai e escolhe "Sair sem salvar", então uma pergunta só descarta os dois', async () => {
    // Dado
    const descartes = abrir();
    await clicar('Mudar a descrição');
    await clicar('Abrir o lápis');
    await clicar('Mudar no lápis');
    // Quando
    await irParaLista();
    await userEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(screen.queryAllByRole('dialog', { name: 'Sair sem salvar?' })).toHaveLength(0);
    expect(descartes.sort()).toEqual(['descrição', 'lápis']);
  });

  it('dados os dois avisos e nada mudado, quando a pessoa sai, então sai sem pergunta', async () => {
    // Dado
    abrir();
    await clicar('Abrir o lápis');
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dada a descrição por salvar e o lápis aberto e cancelado, quando o botão Sair do sistema confere, então a pergunta vem antes', async () => {
    // Dado
    abrir();
    await clicar('Mudar a descrição');
    await clicar('Abrir o lápis');
    await clicar('Cancelar o lápis');
    // Quando
    let resposta: Promise<boolean> | undefined;
    act(() => { resposta = podeSairDoCadastro(); });
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar no cadastro' }));
    expect(await resposta).toBe(false);
  });
});

/** O texto que salva sozinho (a anotação): sair grava antes o que falta, e só pergunta se a gravação falhar. */
function TextoQueSalvaSozinho({ salvarAntes, aoFicar }: { salvarAntes: () => Promise<boolean>; aoFicar?: () => void }) {
  const [porSalvar, setPorSalvar] = useState(false);
  const liberada = useRef(false);
  return <>
    {porSalvar && <AvisoAoSair preenchido liberada={liberada} ocupado={false} salvarAntes={salvarAntes} aoFicar={aoFicar} />}
    <button type="button" onClick={() => setPorSalvar(true)}>Escrever</button>
    <Link to="/lista">Lista</Link>
  </>;
}

describe('Aviso ao sair do texto que salva sozinho (a anotação)', () => {
  afterEach(() => {
    if (pergunta()) fireEvent.keyDown(document, { key: 'Escape' });
    cleanup();
  });
  function abrir(salvarAntes: () => Promise<boolean>, aoFicar?: () => void) {
    const roteador = createMemoryRouter([
      { path: '/anotacao', element: <TextoQueSalvaSozinho salvarAntes={salvarAntes} aoFicar={aoFicar} /> },
      { path: '/lista', element: <p>Página da lista</p> }
    ], { initialEntries: ['/anotacao'] });
    render(<><RouterProvider router={roteador} /><Janelas /></>);
  }

  it('dado um texto ainda por gravar, quando a pessoa sai por um link, então ele é gravado antes e ela sai sem pergunta', async () => {
    // Dado
    const salvarAntes = vi.fn(async () => true);
    abrir(salvarAntes);
    await userEvent.click(screen.getByRole('button', { name: 'Escrever' }));
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(salvarAntes).toHaveBeenCalledOnce();
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dada a gravação que falha, quando a pessoa sai por um link, então a pergunta de sempre aparece e ela fica, se quiser, e a tela sabe que ela ficou', async () => {
    // Dado
    const aoFicar = vi.fn();
    abrir(async () => false, aoFicar);
    await userEvent.click(screen.getByRole('button', { name: 'Escrever' }));
    // Quando
    await irParaLista();
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    // Então
    expect(screen.queryByText('Página da lista')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escrever' })).toBeInTheDocument();
    expect(aoFicar).toHaveBeenCalledOnce();
  });

  it('dado um texto ainda por gravar, quando ele é gravado e a pessoa sai, então a tela não é avisada de que ficou', async () => {
    // Dado
    const aoFicar = vi.fn();
    abrir(async () => true, aoFicar);
    await userEvent.click(screen.getByRole('button', { name: 'Escrever' }));
    // Quando
    await irParaLista();
    // Então
    expect(await screen.findByText('Página da lista')).toBeInTheDocument();
    expect(aoFicar).not.toHaveBeenCalled();
  });
});

/**
 * A anotação nova que acabou de ir ao banco (#369): a tela troca o próprio endereço, no lugar do atual, com a marca de que não sai
 * dela; o Voltar e os links continuam sendo segurados.
 */
function NotaQueGanhaEndereco() {
  const liberada = useRef(false);
  const navegar = useNavigate();
  return <>
    <AvisoAoSair preenchido liberada={liberada} ocupado={false} salvarAntes={async () => false} />
    <button type="button" onClick={() => navegar('/anotacao?id=a1', { replace: true, state: { [SEM_SAIR_DA_TELA]: true } })}>Ganhar o endereço</button>
    <button type="button" onClick={() => navegar('/anotacao?id=a2', { replace: true })}>Trocar sem a marca</button>
    <Link to="/lista" state={{ [SEM_SAIR_DA_TELA]: true }}>Lista</Link>
  </>;
}

describe('Aviso ao sair: a tela que só troca o próprio endereço (#369)', () => {
  afterEach(() => {
    if (pergunta()) fireEvent.keyDown(document, { key: 'Escape' });
    cleanup();
  });
  function abrir() {
    const roteador = createMemoryRouter([
      { path: '/anotacao', element: <NotaQueGanhaEndereco /> },
      { path: '/lista', element: <p>Página da lista</p> }
    ], { initialEntries: ['/anotacao'] });
    render(<><RouterProvider router={roteador} /><Janelas /></>);
    return roteador;
  }

  it('dado algo por gravar, quando a tela troca o próprio endereço com a marca, então a troca passa, sem pergunta', async () => {
    // Dado
    const roteador = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ganhar o endereço' }));
    // Então
    await waitFor(() => expect(roteador.state.location.search).toBe('?id=a1'));
    expect(pergunta()).not.toBeInTheDocument();
  });

  it('dado algo por gravar, quando a troca vem sem a marca, ou a marca vem num link (que não troca no lugar), então a saída é segurada', async () => {
    // Dado
    const roteador = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Trocar sem a marca' }));
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    expect(roteador.state.location.search).toBe('');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Continuar no cadastro' }));
    await irParaLista();
    // Então
    expect(await screen.findByRole('dialog', { name: 'Sair sem salvar?' })).toBeInTheDocument();
    expect(screen.queryByText('Página da lista')).not.toBeInTheDocument();
  });
});
