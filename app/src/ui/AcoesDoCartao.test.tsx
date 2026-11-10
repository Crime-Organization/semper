// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AcoesDoCartao, RodapeDaEdicao } from './AcoesDoCartao';
import { falha } from './avisos';
import { Janelas } from './janela';

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
