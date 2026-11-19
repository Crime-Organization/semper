// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AcoesDeQuemLe, AcoesDoCartao, MenuDoCartao, RodapeDaEdicao, type AcaoDoTopo } from './AcoesDoCartao';
import { falha } from './avisos';
import { confirmar, Janelas } from './janela';

vi.mock('./avisos', async original => ({ ...await original<typeof import('./avisos')>(), falha: vi.fn() }));

describe('Ações no topo do cartão', () => {
  it('quando o cartão está ativo, então há Arquivar e Editar, e cada um chama a sua ação', async () => {
    // Dado
    const aoArquivar = vi.fn(), aoEditar = vi.fn();
    render(<AcoesDoCartao arquivado={false} editando={false} aoArquivar={aoArquivar} aoEditar={aoEditar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    // Então
    expect(aoEditar).toHaveBeenCalledOnce();
    expect(aoArquivar).toHaveBeenCalledOnce();
  });

  it('quando o cartão está ativo, então não há lixeira, mesmo com a exclusão informada', () => {
    // Quando
    render(<AcoesDoCartao arquivado={false} editando={false} aoArquivar={() => {}} aoEditar={() => {}} excluir={{ oQue: 'a tarefa', aoConfirmar: () => {} }} />);
    // Então
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });
});

describe('Ações no topo do cartão arquivado', () => {
  const excluir = (aoConfirmar = vi.fn()) => ({ oQue: 'a tarefa', aoConfirmar });

  it('quando o cartão está arquivado, então o botão é Desarquivar e chama a ação de arquivar', async () => {
    // Dado
    const aoArquivar = vi.fn();
    render(<AcoesDoCartao arquivado editando={false} aoArquivar={aoArquivar} aoEditar={() => {}} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));
    // Então
    expect(aoArquivar).toHaveBeenCalledOnce();
  });

  it('quando a pessoa pode excluir, então o lápis dá lugar à lixeira', () => {
    // Quando
    render(<AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} excluir={excluir()} />);
    // Então
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('quando a pessoa não pode excluir, então não há lixeira nem lápis, só Desarquivar', () => {
    // Quando
    render(<AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} />);
    // Então
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Desarquivar']);
  });

  it('quando a pessoa clica na lixeira, então a janela pede confirmação e nada é excluído antes dela', async () => {
    // Dado
    const aoConfirmar = vi.fn();
    render(<><AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} excluir={excluir(aoConfirmar)} /><Janelas /></>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Então
    expect(await screen.findByRole('dialog', { name: 'Excluir a tarefa?' })).toHaveTextContent('não pode ser desfeita');
    expect(aoConfirmar).not.toHaveBeenCalled();
    // A janela é do sistema todo: fecha para não sobrar para o próximo caso.
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('quando a pessoa confirma na janela, então o item é excluído', async () => {
    // Dado
    const aoConfirmar = vi.fn();
    render(<><AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} excluir={excluir(aoConfirmar)} /><Janelas /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir definitivamente' }));
    // Então
    expect(aoConfirmar).toHaveBeenCalledOnce();
  });

  it('quando a exclusão falha, então a pessoa recebe o aviso do erro e a lixeira volta a funcionar', async () => {
    // Dado
    const erro = new Error('O banco recusou.');
    render(<><AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} excluir={excluir(vi.fn().mockRejectedValue(erro))} /><Janelas /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir definitivamente' }));
    // Então
    await waitFor(() => expect(falha).toHaveBeenCalledWith(erro));
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled();
  });

  it('quando a pessoa cancela na janela, então nada é excluído', async () => {
    // Dado
    const aoConfirmar = vi.fn();
    render(<><AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} excluir={excluir(aoConfirmar)} /><Janelas /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveFocus();
  });
});

describe('Ações a mais no topo do cartão', () => {
  const baixar = (aoClicar: AcaoDoTopo['aoClicar'] = vi.fn()): AcaoDoTopo => ({ rotulo: 'Baixar .md', icone: 'baixar', aoClicar });

  it('quando o cartão tem uma ação a mais, então ela vem antes de Arquivar e Editar e chama a sua ação', async () => {
    // Dado
    const aoClicar = vi.fn();
    render(<AcoesDoCartao arquivado={false} editando={false} aoArquivar={() => {}} aoEditar={() => {}} extras={[baixar(aoClicar)]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Baixar .md' }));
    // Então
    expect(aoClicar).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Baixar .md', 'Arquivar', 'Editar']);
    expect(screen.getByRole('button', { name: 'Baixar .md' })).toHaveAttribute('title', 'Baixar .md');
  });

  it('quando o cartão está em edição, então a ação a mais some com os outros botões', () => {
    // Quando
    render(<AcoesDoCartao arquivado={false} editando aoArquivar={() => {}} aoEditar={() => {}} extras={[baixar()]} />);
    // Então
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('quando quem só lê abre o cartão, então ele tem só as ações a mais, sem Arquivar nem Editar', async () => {
    // Dado
    const aoClicar = vi.fn();
    render(<AcoesDeQuemLe acoes={[baixar(aoClicar)]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Baixar .md' }));
    // Então
    expect(aoClicar).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('enquanto a ação a mais roda, então o botão fica desligado (sem baixar duas vezes)', async () => {
    // Dado
    let terminar = () => {};
    render(<AcoesDeQuemLe acoes={[baixar(() => new Promise<void>(r => { terminar = r; }))]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Baixar .md' }));
    // Então
    expect(screen.getByRole('button', { name: 'Baixar .md' })).toBeDisabled();
    terminar();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar .md' })).toBeEnabled());
  });
});

describe('Cartão em edição', () => {
  it('quando o cartão está em edição, então no lugar dos botões aparece só o aviso "Modo de edição"', () => {
    // Quando
    render(<AcoesDoCartao arquivado={false} editando aoArquivar={() => {}} aoEditar={() => {}} />);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Modo de edição');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Rodapé da edição', () => {
  it('quando está salvando, então os dois botões ficam desligados e o principal diz "Salvando…"', () => {
    // Quando
    render(<RodapeDaEdicao ocupado aoCancelar={() => {}} aoSalvar={() => {}} />);
    // Então
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
  });

  it('quando a pessoa clica em Salvar ou Cancelar, então a ação certa é chamada', async () => {
    // Dado
    const aoSalvar = vi.fn(), aoCancelar = vi.fn();
    render(<RodapeDaEdicao ocupado={false} aoCancelar={aoCancelar} aoSalvar={aoSalvar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(aoSalvar).toHaveBeenCalledOnce();
    expect(aoCancelar).toHaveBeenCalledOnce();
  });
});

describe('O menu ⋯ do cartão sem lápis (a anotação em Documentos)', () => {
  const baixar = (aoClicar: () => unknown = vi.fn()): AcaoDoTopo => ({ rotulo: 'Baixar .md', icone: 'baixar', aoClicar });
  const itens = () => screen.getAllByRole('menuitem').map(b => b.textContent?.trim());

  it('dado quem altera a anotação ativa, quando abre o ⋯, então vê as ações a mais e Arquivar, sem Excluir, e cada uma chama a sua ação', async () => {
    // Dado
    const aoArquivar = vi.fn(), aoBaixar = vi.fn();
    render(<MenuDoCartao arquivado={false} aoArquivar={aoArquivar} excluir={{ oQue: 'a anotação', aoConfirmar: vi.fn() }} extras={[baixar(aoBaixar)]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    // Então
    expect(itens()).toEqual(['Baixar .md', 'Arquivar']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    expect(aoArquivar).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Baixar .md' }));
    await waitFor(() => expect(aoBaixar).toHaveBeenCalledOnce());
  });

  it('dada a anotação arquivada, quando quem pode excluir escolhe Excluir, então a janela pergunta antes, e só a confirmação exclui', async () => {
    // Dado
    const aoConfirmar = vi.fn();
    render(<><MenuDoCartao arquivado aoArquivar={vi.fn()} excluir={{ oQue: 'a anotação', aoConfirmar }} /><Janelas /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    expect(itens()).toEqual(['Desarquivar', 'Excluir']);
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(await screen.findByRole('dialog', { name: 'Excluir a anotação?' })).toBeInTheDocument();
    expect(aoConfirmar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    // Então
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledOnce());
  });

  it('dado quem só lê, quando abre o ⋯, então só há as ações a mais', async () => {
    // Dado
    render(<MenuDoCartao arquivado={false} extras={[baixar()]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    // Então
    expect(itens()).toEqual(['Baixar .md']);
  });

  // #370: o "Mover para pasta" da anotação abre uma janela pelo ⋯; ao fechá-la, o foco se perdia (ia para o começo da página).
  it('dada uma ação a mais que abre uma janela, quando a pessoa a escolhe pelo teclado e fecha a janela, então o foco volta ao ⋯', async () => {
    // Dado
    const perguntar: AcaoDoTopo = { rotulo: 'Mover para pasta', icone: 'seta', aoClicar: () => confirmar('Mover a anotação', 'Para onde?') };
    render(<><MenuDoCartao arquivado={false} extras={[perguntar]} /><Janelas /></>);
    const mais = screen.getByRole('button', { name: 'Mais ações' });
    mais.focus();
    await userEvent.keyboard('{Enter}');
    // Quando
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    // Então
    await waitFor(() => expect(mais).toHaveFocus());
  });
});
