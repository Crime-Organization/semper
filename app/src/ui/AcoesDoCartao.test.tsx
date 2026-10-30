// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AcoesDoCartao, RodapeDaEdicao } from './AcoesDoCartao';

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

  it('quando o cartão está arquivado, então o botão é Desarquivar', () => {
    // Quando
    render(<AcoesDoCartao arquivado editando={false} aoArquivar={() => {}} aoEditar={() => {}} />);
    // Então
    expect(screen.getByRole('button', { name: 'Desarquivar' })).toBeInTheDocument();
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
