// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// As janelas abertas são do sistema todo: cada caso recarrega os módulos para começar sem nenhuma.
let base: typeof import('./BotaoTirar');
beforeEach(async () => {
  vi.resetModules();
  const janela = await import('../janela');
  base = await import('./BotaoTirar');
  render(<janela.Janelas />);
});

describe('O "x" de tirar do cartão (#424)', () => {
  it('dado um item ligado, quando aparece, então o "x" se chama "Tirar <coisa>", no rótulo e na dica do mouse', () => {
    // Quando
    render(<base.BotaoTirar oQue="a etiqueta Urgente" aoTirar={() => {}} />);
    // Então
    const x = screen.getByRole('button', { name: 'Tirar a etiqueta Urgente' });
    expect(x).toHaveAttribute('title', 'Tirar a etiqueta Urgente');
  });

  it('dado o "x", quando a pessoa clica, então o SEMPER pergunta antes, e nada sai até a resposta', async () => {
    // Dado
    const aoTirar = vi.fn();
    render(<base.BotaoTirar oQue="a demanda D-12" aoTirar={aoTirar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a demanda D-12' }));
    // Então
    expect(screen.getByRole('dialog', { name: 'Tirar a demanda D-12?' })).toHaveTextContent(base.EXPLICACAO_DO_TIRAR);
    expect(aoTirar).not.toHaveBeenCalled();
  });

  it('dada a pergunta, quando a pessoa confirma, então o item sai', async () => {
    // Dado
    const aoTirar = vi.fn();
    render(<base.BotaoTirar oQue="Ana Souza" explicacao="A pessoa continua no cadastro." aoTirar={aoTirar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Ana Souza' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('A pessoa continua no cadastro.');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: base.CONFIRMAR_O_TIRAR }));
    // Então
    expect(aoTirar).toHaveBeenCalledTimes(1);
  });

  it('dada a pergunta, quando a pessoa cancela, então nada sai', async () => {
    // Dado
    const aoTirar = vi.fn();
    render(<base.BotaoTirar oQue="o processo Marca X" aoTirar={aoTirar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o processo Marca X' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    expect(aoTirar).not.toHaveBeenCalled();
  });

  it('dado quem não pode mudar o cartão, quando o cartão aparece, então não há "x"', () => {
    // Quando
    render(<base.TirarNoCartao pode={false}><base.BotaoTirar oQue="a tarefa T-1" aoTirar={() => {}} /></base.TirarNoCartao>);
    // Então
    expect(screen.queryByRole('button', { name: 'Tirar a tarefa T-1' })).toBeNull();
  });

  it('dado um lugar que decide por si (as etiquetas), quando passa `pode`, então vale o que ele diz, e não o cartão', () => {
    // Quando
    render(<base.TirarNoCartao pode={false}>
      <base.BotaoTirar forma="etiqueta" pode oQue="a etiqueta Urgente" aoTirar={() => {}} />
      <base.BotaoTirar pode={false} oQue="a tarefa T-2" aoTirar={() => {}} />
    </base.TirarNoCartao>);
    // Então
    expect(screen.getByRole('button', { name: 'Tirar a etiqueta Urgente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar a tarefa T-2' })).toBeNull();
  });

  it('dado o "x" dentro de algo que também abre (a linha, a pílula), quando a pessoa clica, então o clique não chega a ele', async () => {
    // Dado
    const abrir = vi.fn();
    render(<div onClick={abrir}><base.BotaoTirar oQue="a etiqueta Urgente" aoTirar={() => {}} /></div>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a etiqueta Urgente' }));
    // Então
    expect(abrir).not.toHaveBeenCalled();
  });

  it('dado outro caminho de tirar (perguntarETirar), quando a gravação falha, então o erro aparece no pé da tela', async () => {
    // Dado
    const avisos = await import('../avisos');
    const falha = vi.spyOn(avisos, 'falha').mockImplementation(() => 0);
    let pedido!: Promise<void>;
    act(() => { pedido = base.perguntarETirar({ oQue: 'o contrato C-1', aoTirar: () => { throw new Error('sem rede'); } }); });
    // Quando
    await userEvent.click(screen.getByRole('button', { name: base.CONFIRMAR_O_TIRAR }));
    await pedido;
    // Então
    expect(falha).toHaveBeenCalledWith(new Error('sem rede'));
  });
});
