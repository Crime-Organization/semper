// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O Concluir (e o Reabrir) ao lado da Situação (#397): um botão redondo só com o ícone, com o nome no leitor de tela e na dica; só
// para ver no cartão arquivado ou de quem só lê; o foco volta para ele depois da troca.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AcaoDeConclusao } from '../../regras/conclusaoNoCartao';
import { ConcluirNaSituacao } from './ConcluirNaSituacao';

/** Um cartão de mentira: concluir troca a ação para reabrir, e reabrir troca de volta, depois de gravar. */
function Cartao({ soParaVer = false }: { soParaVer?: boolean }) {
  const [acao, setAcao] = useState<AcaoDeConclusao>('concluir');
  return <ConcluirNaSituacao acao={acao} soParaVer={soParaVer}
    aoAgir={async a => { await Promise.resolve(); setAcao(a === 'concluir' ? 'reabrir' : 'concluir'); }} />;
}

describe('O Concluir ao lado da Situação (#397)', () => {
  it.each([
    ['concluir', 'Concluir'],
    ['reabrir', 'Reabrir']
  ] as const)('dada a ação %s, quando aparece, então o botão só tem o ícone, com o nome "%s" no leitor de tela e na dica', (acao, nome) => {
    // Quando
    render(<ConcluirNaSituacao acao={acao} soParaVer={false} aoAgir={vi.fn()} />);
    // Então
    const botao = screen.getByRole('button', { name: nome });
    expect(botao).toHaveTextContent('');
    expect(botao.querySelector('svg')).not.toBeNull();
    expect(botao).toHaveAttribute('data-dica', nome);
  });

  it('dado o quadro sem a coluna-marco (nenhuma ação), quando o cartão abre, então o botão não aparece', () => {
    // Quando
    render(<ConcluirNaSituacao acao={null} soParaVer={false} aoAgir={vi.fn()} />);
    // Então
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('dado o cartão arquivado ou de quem só lê, quando a pessoa clica no botão, então ele aparece só para ver e não faz nada', async () => {
    // Dado
    const aoAgir = vi.fn();
    render(<ConcluirNaSituacao acao="concluir" soParaVer aoAgir={aoAgir} />);
    const botao = screen.getByRole('button', { name: 'Concluir' });
    // Quando
    await userEvent.click(botao);
    // Então
    expect(botao).toHaveAttribute('aria-disabled', 'true');
    expect(botao).not.toBeDisabled();
    expect(aoAgir).not.toHaveBeenCalled();
  });

  it('dado o botão Concluir, quando a pessoa o aciona pelo teclado, então ele vira Reabrir no mesmo lugar e o foco volta para ele', async () => {
    // Dado
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Cartao />);
    screen.getByRole('button', { name: 'Concluir' }).focus();
    // Quando
    await userEvent.keyboard('{Enter}');
    await act(async () => { await vi.runAllTimersAsync(); });
    // Então
    expect(screen.getByRole('button', { name: 'Reabrir' })).toHaveFocus();
    vi.useRealTimers();
  });
});
