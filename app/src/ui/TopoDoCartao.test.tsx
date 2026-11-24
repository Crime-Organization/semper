// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O topo dos cartões de item (#382), como o da anotação: o tipo e o código à esquerda; a equipe, o ícone de etiqueta, o lápis e o
// menu ⋯ à direita; os selos das etiquetas entre o topo e o título. Antes, as etiquetas ficavam numa seção "Etiquetas" no meio do
// cartão: os casos dela (quem chama recebe a etiqueta marcada; só quem pode mudar vê o x) estão aqui, pelo caminho novo.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Etiqueta } from '../dados';
import { lojaDeEtiquetas } from './Etiquetas';
import { BotoesNoPainel } from './PainelCartao';
import { FaixaDoArquivado, TopoDoCartao } from './TopoDoCartao';
import { CONFIRMAR_O_TIRAR } from './base';
import { Janelas } from './janela';

const MINHA: Etiqueta = { id: 'e-minha', cor: 'azul', texto: 'Minha', criado_por: 'u-bruno' };
const URGENTE: Etiqueta = { id: 'e-urgente', cor: 'vermelho', texto: 'Urgente', criado_por: 'u-ana' };

const { etiquetasDoCartao, etiquetaAplicar, etiquetaTirarEmLote, etiquetasListar } = vi.hoisted(() => ({
  etiquetasDoCartao: vi.fn(), etiquetaAplicar: vi.fn(), etiquetaTirarEmLote: vi.fn(), etiquetasListar: vi.fn()
}));
vi.mock('../dados', () => ({ SD: { etiquetasDoCartao, etiquetaAplicar, etiquetaTirarEmLote, etiquetasListar } }));
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: false }) }));

/** As etiquetas gravadas no cartão (o banco de mentira): aplicar põe, e o cartão relê daqui. */
let noCartao: string[] = [];
beforeEach(() => {
  noCartao = [];
  lojaDeEtiquetas.mudar([MINHA, URGENTE]);
  etiquetasListar.mockResolvedValue([MINHA, URGENTE]);
  etiquetasDoCartao.mockReset();
  etiquetasDoCartao.mockImplementation(async () => [...noCartao]);
  etiquetaAplicar.mockReset();
  etiquetaAplicar.mockImplementation(async (_modulo: string, _id: string, etiqueta: string) => { noCartao.push(etiqueta); });
  etiquetaTirarEmLote.mockReset();
  etiquetaTirarEmLote.mockResolvedValue(undefined);
});

/** A equipe é do cartão (EquipeNoTopo): aqui, só um lugar marcado, para ver onde ela fica. */
const EQUIPE = <div role="group" aria-label="Equipe">bolinhas</div>;

interface Opcoes { arquivado?: boolean; editando?: boolean; muda?: boolean; altera?: boolean; podeExcluir?: boolean }
/** O topo de uma tarefa, dentro da cabeça do cartão, com o título logo depois. Quem altera tem o lápis e o ⋯. */
function abrir({ arquivado = false, editando = false, muda = true, altera = true, podeExcluir = false }: Opcoes = {}) {
  const acoes = { aoArquivar: vi.fn(), aoExcluir: vi.fn(), aoEditar: vi.fn() };
  render(<header>
    <TopoDoCartao modulo="tarefas" id="t-1" inicio={<span>TAREFA C0FFEE12</span>} equipe={EQUIPE} arquivado={arquivado} editando={editando}
      mudaEtiquetas={muda} aoArquivar={altera ? acoes.aoArquivar : undefined} aoExcluir={altera && podeExcluir ? acoes.aoExcluir : undefined}
      lapis={altera ? { rotulo: 'Editar', aoEditar: acoes.aoEditar } : undefined} />
    <h2>Emitir a GRU</h2>
  </header>);
  return acoes;
}
/** Os botões do topo, na ordem da tela. */
const botoes = () => screen.getAllByRole('button').map(b => b.getAttribute('aria-label'));
/** Se `a` vem antes de `b` na página. */
const antes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('O topo do cartão ativo, para quem altera', () => {
  it('quando o cartão abre no centro largo, então a equipe, a etiqueta, o lápis e o ⋯ vêm primeiro (ficam no canto de cima), depois o tipo e o código, tudo antes do título', async () => {
    // Quando
    abrir();
    // Então: a direita vem antes no código, para flutuar no canto de cima com os botões (a tela a põe à direita)
    const titulo = screen.getByRole('heading', { level: 2, name: 'Emitir a GRU' });
    expect(antes(screen.getByRole('button', { name: 'Mais ações da tarefa' }), screen.getByText('TAREFA C0FFEE12'))).toBe(true);
    expect(antes(screen.getByText('TAREFA C0FFEE12'), titulo)).toBe(true);
    expect(antes(screen.getByRole('group', { name: 'Equipe' }), screen.getByRole('button', { name: 'Escolher etiquetas' }))).toBe(true);
    expect(botoes()).toEqual(['Escolher etiquetas', 'Editar', 'Mais ações da tarefa']);
    expect(antes(screen.getByRole('button', { name: 'Mais ações da tarefa' }), titulo)).toBe(true);
    // A seção "Etiquetas" do meio do cartão não existe mais; sem etiquetas, nem a linha dos selos.
    expect(screen.queryByRole('region', { name: 'Etiquetas' })).not.toBeInTheDocument();
    await waitFor(() => expect(etiquetasDoCartao).toHaveBeenCalledWith('tarefas', 't-1'));
    expect(screen.queryByRole('group', { name: 'Etiquetas' })).not.toBeInTheDocument();
  });

  it('quando a pessoa clica no ícone de etiqueta e marca uma, então ela é aplicada e o selo aparece entre o topo e o título', async () => {
    // Dado
    abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Escolher etiquetas' })).getByRole('checkbox', { name: 'Minha' }));
    // Então
    expect(etiquetaAplicar).toHaveBeenCalledWith('tarefas', 't-1', MINHA.id);
    const selos = await screen.findByRole('group', { name: 'Etiquetas' });
    expect(within(selos).getByText('Minha')).toBeInTheDocument();
    expect(antes(screen.getByRole('group', { name: 'Equipe' }), selos)).toBe(true);
    expect(antes(selos, screen.getByRole('heading', { level: 2 }))).toBe(true);
  });

  // A regra mudou (#424, decisão do dono): o x pergunta antes de tirar.
  it('quando a pessoa tira uma etiqueta pelo x do selo e confirma, então ela sai do cartão', async () => {
    // Dado
    noCartao = [MINHA.id];
    abrir();
    render(<Janelas />);
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar a etiqueta Minha' }));
    expect(etiquetaTirarEmLote).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: CONFIRMAR_O_TIRAR }));
    // Então
    await waitFor(() => expect(etiquetaTirarEmLote).toHaveBeenCalledWith('tarefas', ['t-1'], MINHA.id));
  });

  it('quando a pessoa usa o lápis e o Arquivar do ⋯, então cada um chama a sua ação', async () => {
    // Dado
    const acoes = abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações da tarefa' }));
    expect(screen.getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Arquivar']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    // Então
    expect(acoes.aoEditar).toHaveBeenCalledOnce();
    await waitFor(() => expect(acoes.aoArquivar).toHaveBeenCalledOnce());
  });
});

describe('O topo para quem só lê', () => {
  it('quando quem só lê abre o cartão com etiquetas, então vê a equipe e os selos, mas sem o ícone de etiqueta, sem o x, sem o lápis e sem o ⋯', async () => {
    // Dado
    noCartao = [MINHA.id];
    // Quando
    abrir({ muda: false, altera: false });
    // Então
    expect(within(await screen.findByRole('group', { name: 'Etiquetas' })).getByText('Minha')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Equipe' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('quando quem altera abre o mesmo cartão, então o x, o ícone, o lápis e o ⋯ aparecem (o caso de controle do de cima)', async () => {
    // Dado
    noCartao = [MINHA.id];
    // Quando
    abrir();
    // Então
    expect(await screen.findByRole('button', { name: 'Tirar a etiqueta Minha' })).toBeInTheDocument();
    expect(botoes()).toEqual(['Escolher etiquetas', 'Editar', 'Mais ações da tarefa', 'Tirar a etiqueta Minha']);
  });
});

describe('O topo do cartão arquivado', () => {
  it('quando quem pode excluir abre o ⋯, então acha Desarquivar e Excluir; o lápis e o ícone de etiqueta não aparecem', async () => {
    // Dado
    abrir({ arquivado: true, muda: false, podeExcluir: true });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações da tarefa' }));
    // Então
    expect(screen.getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Desarquivar', 'Excluir']);
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Escolher etiquetas' })).not.toBeInTheDocument();
  });
});

describe('O topo em edição', () => {
  it('quando o lápis está aberto, então no lugar dos botões fica "Modo de edição", a equipe some e os selos ficam sem o x', async () => {
    // Dado
    noCartao = [MINHA.id];
    // Quando
    abrir({ editando: true });
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Modo de edição');
    expect(within(await screen.findByRole('group', { name: 'Etiquetas' })).getByText('Minha')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Equipe' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('dado o topo com a Situação (#351), quando o lápis abre, então a Situação sai do topo, e volta quando a edição termina', () => {
    // Dado
    const topo = (editando: boolean) => <TopoDoCartao modulo="tarefas" id="t-1" inicio={<span>TAREFA</span>} arquivado={false} editando={editando}
      mudaEtiquetas={false} situacao={<select aria-label="Situação da tarefa"><option>FAZENDO</option></select>} />;
    const { rerender } = render(topo(false));
    expect(screen.getByRole('combobox', { name: 'Situação da tarefa' })).toBeInTheDocument();
    // Quando
    rerender(topo(true));
    // Então
    expect(screen.queryByRole('combobox', { name: 'Situação da tarefa' })).not.toBeInTheDocument();
    // E, ao terminar a edição
    rerender(topo(false));
    expect(screen.getByRole('combobox', { name: 'Situação da tarefa' })).toBeInTheDocument();
  });
});

describe('A faixa do item arquivado', () => {
  it('quando quem pode excluir abre o arquivado, então a faixa diz que o Excluir está no ⋯ e traz o Desarquivar à vista', async () => {
    // Dado
    const aoDesarquivar = vi.fn();
    render(<FaixaDoArquivado modulo="tarefas" podeExcluir aoDesarquivar={aoDesarquivar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));
    // Então
    expect(screen.getByText(/pode ser excluída definitivamente pelo menu ⋯\./)).toBeInTheDocument();
    expect(aoDesarquivar).toHaveBeenCalledOnce();
  });

  it('quando quem não altera o cartão o abre, então a faixa só explica, sem botão', () => {
    // Quando
    render(<FaixaDoArquivado modulo="tarefas" podeExcluir={false} />);
    // Então
    expect(screen.getByText('Tarefa arquivada. Só quem cadastrou esta tarefa ou um administrador pode excluí-la.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('O topo ao lado (os botões do cartão na linha dos botões da janela)', () => {
  it('quando o cartão abre ao lado, então o tipo e o código vêm antes da equipe, e os botões do cartão vão para a linha da janela', () => {
    // Dado: a linha dos botões da janela (o formato e o X), como o painel ao lado a oferece
    const linhaDaJanela = document.createElement('div');
    document.body.append(linhaDaJanela);
    // Quando
    render(<BotoesNoPainel.Provider value={linhaDaJanela}>
      <TopoDoCartao modulo="tarefas" id="t-1" inicio={<span>TAREFA C0FFEE12</span>} equipe={EQUIPE} arquivado={false} mudaEtiquetas
        aoArquivar={vi.fn()} lapis={{ rotulo: 'Editar', aoEditar: vi.fn() }} />
    </BotoesNoPainel.Provider>);
    // Então: a equipe vem logo depois do tipo e do código, para ficar na linha deles quando cabe
    expect(antes(screen.getByText('TAREFA C0FFEE12'), screen.getByRole('group', { name: 'Equipe' }))).toBe(true);
    expect(within(linhaDaJanela).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Escolher etiquetas', 'Editar', 'Mais ações da tarefa']);
    linhaDaJanela.remove();
  });
});

describe('Desarquivar pela faixa', () => {
  it('quando a pessoa desarquiva pelo botão da faixa, então a faixa some e o foco vai para o ⋯ (e não para o começo da página)', async () => {
    // Dado: o cartão arquivado, com a faixa e o Desarquivar dela
    const Cartao = ({ arquivado, aoDesarquivar }: { arquivado: boolean; aoDesarquivar: () => void }) => <article>
      <TopoDoCartao modulo="tarefas" id="t-1" inicio={<span>TAREFA C0FFEE12</span>} arquivado={arquivado} mudaEtiquetas={!arquivado}
        aoArquivar={aoDesarquivar} lapis={{ rotulo: 'Editar', aoEditar: vi.fn() }} />
      {arquivado && <FaixaDoArquivado modulo="tarefas" podeExcluir={false} aoDesarquivar={aoDesarquivar} />}
    </article>;
    const aoDesarquivar = vi.fn();
    const { rerender } = render(<Cartao arquivado aoDesarquivar={aoDesarquivar} />);
    // Quando: o clique desarquiva, e o cartão volta ativo (a faixa sai com o botão que tinha o foco)
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));
    rerender(<Cartao arquivado={false} aoDesarquivar={aoDesarquivar} />);
    // Então
    expect(aoDesarquivar).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Desarquivar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações da tarefa' })).toHaveFocus();
  });

  it('quando o cartão volta do arquivo com o foco em outro lugar (o caso de controle), então o foco fica onde estava', () => {
    // Dado
    const { rerender } = render(<>
      <input aria-label="Outro campo" />
      <TopoDoCartao modulo="tarefas" id="t-1" inicio={<span>TAREFA</span>} arquivado mudaEtiquetas={false} aoArquivar={vi.fn()} />
    </>);
    screen.getByRole('textbox', { name: 'Outro campo' }).focus();
    // Quando
    rerender(<>
      <input aria-label="Outro campo" />
      <TopoDoCartao modulo="tarefas" id="t-1" inicio={<span>TAREFA</span>} arquivado={false} mudaEtiquetas aoArquivar={vi.fn()} />
    </>);
    // Então
    expect(screen.getByRole('textbox', { name: 'Outro campo' })).toHaveFocus();
  });
});
