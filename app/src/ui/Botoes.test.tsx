// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Botao, BotaoDuplo } from './Botoes';

// Ação que só termina quando o teste manda.
function acaoPendente() {
  let terminar!: () => void, falhar!: (e: Error) => void;
  const promessa = new Promise<void>((ok, erro) => { terminar = ok; falhar = erro; });
  return { acao: vi.fn(() => promessa), terminar: () => act(async () => { terminar(); await promessa; }),
    falhar: () => act(async () => { falhar(new Error('falhou')); await promessa.catch(() => {}); }) };
}

describe('Botão que espera a ação', () => {
  it('quando é clicado e a ação ainda roda, então fica desativado e mostra o texto de ocupado', async () => {
    // Dado
    const { acao } = acaoPendente();
    render(<Botao onClick={acao} ocupadoTexto="Buscando…">Buscar</Botao>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    // Então
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled();
    expect(acao).toHaveBeenCalledOnce();
  });

  it('quando a ação termina, então volta ao normal', async () => {
    // Dado
    const { acao, terminar } = acaoPendente();
    render(<Botao onClick={acao} ocupadoTexto="Buscando…">Buscar</Botao>);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    // Quando
    await terminar();
    // Então
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled();
  });

  it('quando a ação dá erro, então também volta ao normal', async () => {
    // Dado
    const { acao, falhar } = acaoPendente();
    render(<Botao onClick={() => acao().catch(() => {})} ocupadoTexto="Buscando…">Buscar</Botao>);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    // Quando
    await falhar();
    // Então
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled();
  });

  it('quando a ação ainda roda e há um segundo clique, então a ação não roda duas vezes', async () => {
    // Dado
    const { acao } = acaoPendente();
    render(<Botao onClick={acao} ocupadoTexto="Buscando…">Buscar</Botao>);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Buscando…' }));
    // Então
    expect(acao).toHaveBeenCalledOnce();
  });
});

describe('Excluir em dois cliques', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('quando recebe o primeiro clique, então pede confirmação sem excluir', async () => {
    // Dado
    const excluir = vi.fn();
    render(<BotaoDuplo confirmar="Confirmar exclusão" aoConfirmar={excluir}>Excluir</BotaoDuplo>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Então
    expect(screen.getByRole('button', { name: 'Confirmar exclusão' })).toBeInTheDocument();
    expect(excluir).not.toHaveBeenCalled();
  });

  it('quando recebe o segundo clique, então exclui e volta ao texto inicial', async () => {
    // Dado
    const excluir = vi.fn();
    render(<BotaoDuplo confirmar="Confirmar exclusão" aoConfirmar={excluir}>Excluir</BotaoDuplo>);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    // Então
    expect(excluir).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('quando passam 4 segundos sem o segundo clique, então desiste da exclusão', () => {
    // Dado
    vi.useFakeTimers();
    const excluir = vi.fn();
    render(<BotaoDuplo confirmar="Confirmar exclusão" aoConfirmar={excluir}>Excluir</BotaoDuplo>);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    act(() => { vi.advanceTimersByTime(4000); });
    // Então
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(excluir).not.toHaveBeenCalled();
  });

  it('quando o botão perde o foco, então desiste da exclusão', async () => {
    // Dado
    const excluir = vi.fn();
    render(<><BotaoDuplo confirmar="Confirmar exclusão" aoConfirmar={excluir}>Excluir</BotaoDuplo><button type="button">Outro</button></>);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    await userEvent.tab();
    // Então
    expect(await screen.findByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(excluir).not.toHaveBeenCalled();
  });
});

describe('Botões só de ícone (#423)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('dado o botão que espera a ação, quando aparece, então mostra só o ícone, com o rótulo de nome e a explicação na dica', () => {
    // Dado / Quando
    render(<Botao icone="tarefas" rotulo="Criar tarefa" dica="Criar a tarefa de cumprir este prazo" onClick={() => {}} />);
    // Então
    const botao = screen.getByRole('button', { name: 'Criar tarefa' });
    expect(botao).toHaveTextContent('');
    expect(botao.querySelector('svg')).toHaveAttribute('data-icone', 'tarefas');
    expect(botao).toHaveAttribute('data-dica', 'Criar a tarefa de cumprir este prazo');
  });

  it('dado o botão que espera a ação, quando a ação ainda roda, então fica desativado, com o nome de ocupado, e não roda duas vezes', async () => {
    // Dado
    const { acao, terminar } = acaoPendente();
    render(<Botao icone="tarefas" rotulo="Criar tarefa" ocupadoTexto="Criando…" onClick={acao} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    // Então
    const ocupado = screen.getByRole('button', { name: 'Criando…' });
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(ocupado);
    expect(acao).toHaveBeenCalledOnce();
    await terminar();
    expect(screen.getByRole('button', { name: 'Criar tarefa' })).toBeEnabled();
  });

  it('dado o de excluir em dois cliques, quando recebe o primeiro clique, então o pedido de confirmação aparece escrito, sem a dica', async () => {
    // Dado
    const excluir = vi.fn();
    render(<BotaoDuplo icone="lixeira" rotulo="Excluir" dica="Excluir o prazo" confirmar="Confirmar: excluir Réplica" aoConfirmar={excluir} />);
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveAttribute('data-dica', 'Excluir o prazo');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Então
    const armado = screen.getByRole('button', { name: 'Confirmar: excluir Réplica' });
    expect(armado).toHaveTextContent('Confirmar: excluir Réplica');
    expect(armado).not.toHaveAttribute('data-dica');
    expect(excluir).not.toHaveBeenCalled();
  });

  it('dado o de excluir em dois cliques, quando recebe o segundo clique, então exclui e volta a ser só o ícone', async () => {
    // Dado
    const excluir = vi.fn();
    render(<BotaoDuplo icone="lixeira" rotulo="Excluir" confirmar="Confirmar exclusão" aoConfirmar={excluir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    // Então
    expect(excluir).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveTextContent('');
  });
});
