// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AcoesDeQuemLe, LapisDoCartao, MenuDoCartao, ModoDeEdicao, RodapeDaEdicao, type AcaoDoTopo } from './AcoesDoCartao';
import { falha } from './avisos';
import { confirmar, Janelas } from './janela';

vi.mock('./avisos', async original => ({ ...await original<typeof import('./avisos')>(), falha: vi.fn() }));

// Desde a #382, os botões redondos Arquivar, Editar e a lixeira saíram do topo dos cartões: o lápis continua (LapisDoCartao), e
// Arquivar, Desarquivar e Excluir ficam no menu ⋯ (MenuDoCartao), como na anotação. Os casos abaixo garantem o mesmo de antes.
describe('O lápis e o ⋯ no topo do cartão ativo', () => {
  it('quando a pessoa clica no lápis e escolhe Arquivar no ⋯, então cada um chama a sua ação', async () => {
    // Dado
    const aoArquivar = vi.fn(), aoEditar = vi.fn();
    render(<><LapisDoCartao rotulo="Editar" aoEditar={aoEditar} /><MenuDoCartao rotulo="Mais ações da tarefa" arquivado={false} aoArquivar={aoArquivar} /></>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações da tarefa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Arquivar' }));
    // Então
    expect(aoEditar).toHaveBeenCalledOnce();
    expect(aoArquivar).toHaveBeenCalledOnce();
  });

  it('quando o cartão edita sem os valores, então o lápis tem esse nome, também na dica', () => {
    // Quando
    render(<LapisDoCartao rotulo="Editar sem os valores" aoEditar={() => {}} />);
    // Então
    expect(screen.getByRole('button', { name: 'Editar sem os valores' })).toHaveAttribute('title', 'Editar sem os valores');
  });
});

describe('O ⋯ do cartão arquivado', () => {
  const excluir = (aoConfirmar: () => unknown = vi.fn()) => ({ oQue: 'a tarefa', aoConfirmar });
  const abrir = () => userEvent.click(screen.getByRole('button', { name: 'Mais ações da tarefa' }));
  const itens = () => screen.getAllByRole('menuitem').map(b => b.textContent?.trim());

  it('quando a pessoa escolhe Desarquivar, então chama a ação de arquivar', async () => {
    // Dado
    const aoArquivar = vi.fn();
    render(<MenuDoCartao rotulo="Mais ações da tarefa" arquivado aoArquivar={aoArquivar} />);
    // Quando
    await abrir();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Desarquivar' }));
    // Então
    expect(aoArquivar).toHaveBeenCalledOnce();
  });

  it('quando a pessoa não pode excluir, então o ⋯ tem só Desarquivar', async () => {
    // Quando
    render(<MenuDoCartao rotulo="Mais ações da tarefa" arquivado aoArquivar={() => {}} />);
    await abrir();
    // Então
    expect(itens()).toEqual(['Desarquivar']);
  });

  it('quando a exclusão falha, então a pessoa recebe o aviso do erro e o ⋯ volta a funcionar', async () => {
    // Dado
    const erro = new Error('O banco recusou.');
    render(<><MenuDoCartao rotulo="Mais ações da tarefa" arquivado aoArquivar={() => {}} excluir={excluir(vi.fn().mockRejectedValue(erro))} /><Janelas /></>);
    await abrir();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir definitivamente' }));
    // Então
    await waitFor(() => expect(falha).toHaveBeenCalledWith(erro));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações da tarefa' })).toBeEnabled());
  });

  it('quando a pessoa cancela na janela, então nada é excluído, e o foco volta ao ⋯', async () => {
    // Dado
    const aoConfirmar = vi.fn();
    render(<><MenuDoCartao rotulo="Mais ações da tarefa" arquivado aoArquivar={() => {}} excluir={excluir(aoConfirmar)} /><Janelas /></>);
    await abrir();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    expect(await screen.findByRole('dialog', { name: 'Excluir a tarefa?' })).toHaveTextContent('não pode ser desfeita');
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mais ações da tarefa' })).toHaveFocus();
  });
});

describe('O ⋯ sem nada dentro', () => {
  it('dado quem só lê um cartão sem ações a mais, quando o topo aparece, então não há ⋯ (um menu vazio só faria clicar à toa)', () => {
    // Quando
    const { container } = render(<MenuDoCartao rotulo="Mais ações da tarefa" arquivado={false} />);
    // Então
    expect(container).toBeEmptyDOMElement();
  });

  it('dado o mesmo cartão para quem altera, quando o topo aparece, então o ⋯ está lá, com Arquivar (o caso de controle do de cima)', async () => {
    // Dado
    render(<MenuDoCartao rotulo="Mais ações da tarefa" arquivado={false} aoArquivar={() => {}} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações da tarefa' }));
    // Então
    expect(screen.getByRole('menuitem', { name: 'Arquivar' })).toBeInTheDocument();
  });
});

describe('Ações de quem só lê', () => {
  const baixar = (aoClicar: AcaoDoTopo['aoClicar'] = vi.fn()): AcaoDoTopo => ({ rotulo: 'Baixar .md', icone: 'baixar', aoClicar });

  it('quando quem só lê abre o cartão, então ele tem só as ações a mais, cada uma com o nome na dica', async () => {
    // Dado
    const aoClicar = vi.fn();
    render(<AcoesDeQuemLe acoes={[baixar(aoClicar)]} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Baixar .md' }));
    // Então
    expect(aoClicar).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Baixar .md' })).toHaveAttribute('title', 'Baixar .md');
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
    render(<ModoDeEdicao />);
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

describe('O menu ⋯ do cartão (a anotação e, desde a #382, todos)', () => {
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
