// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFERIR_VERSAO_A_CADA } from './tempos';
import { AvisoDeVersaoNova } from './versaoNova';

/** O servidor responde o versao.txt com este texto (ou falha, se for um erro). */
function servidor(resposta: string | Error) {
  const ler = vi.fn(async () => {
    if (resposta instanceof Error) throw resposta;
    return new Response(resposta);
  });
  vi.stubGlobal('fetch', ler);
  return ler;
}
/** A pessoa volta para a aba do SEMPER (estava em outra aba ou programa). */
async function voltarParaAba() {
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Aviso de versão nova', () => {
  describe('Dada uma aba aberta na v1.9.0', () => {
    it('quando a pessoa volta para a aba e o servidor já está na v1.9.1, então aparece o aviso com o botão "Recarregar"', async () => {
      // Dado
      servidor('v1.9.1 abc1234\n');
      render(<AvisoDeVersaoNova versao="v1.9.0" />);
      // Quando
      await voltarParaAba();
      // Então
      expect(await screen.findByText('Há uma versão nova do SEMPER.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    });

    it('quando a pessoa clica em "Recarregar", então a página recarrega', async () => {
      // Dado
      servidor('v1.9.1 abc1234\n');
      const recarregar = vi.fn();
      render(<AvisoDeVersaoNova versao="v1.9.0" recarregar={recarregar} />);
      await voltarParaAba();
      // Quando
      await userEvent.click(await screen.findByRole('button', { name: 'Recarregar' }));
      // Então
      expect(recarregar).toHaveBeenCalledOnce();
    });

    it('quando a pessoa clica em "Agora não", então o aviso some e nada recarrega', async () => {
      // Dado
      servidor('v1.9.1 abc1234\n');
      const recarregar = vi.fn();
      render(<AvisoDeVersaoNova versao="v1.9.0" recarregar={recarregar} />);
      await voltarParaAba();
      // Quando
      await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
      // Então
      expect(screen.queryByText('Há uma versão nova do SEMPER.')).not.toBeInTheDocument();
      expect(recarregar).not.toHaveBeenCalled();
    });

    it('quando passa o intervalo de conferência com a aba à vista, então o SEMPER confere a versão sozinho', async () => {
      // Dado
      vi.useFakeTimers();
      const ler = servidor('v1.9.1 abc1234\n');
      render(<AvisoDeVersaoNova versao="v1.9.0" />);
      // Quando
      await act(async () => { await vi.advanceTimersByTimeAsync(CONFERIR_VERSAO_A_CADA); });
      // Então
      expect(ler).toHaveBeenCalledWith('/versao.txt', { cache: 'no-store' });
      expect(screen.getByText('Há uma versão nova do SEMPER.')).toBeInTheDocument();
    });

    it.each([
      ['a mesma versão', 'v1.9.0 ecee79f\n'],
      ['uma página de erro', '<!doctype html><title>Erro</title>'],
      ['nada (sem internet)', new Error('Failed to fetch')]
    ])('quando o servidor responde %s, então nenhum aviso aparece', async (_caso, resposta) => {
      // Dado
      const ler = servidor(resposta);
      render(<AvisoDeVersaoNova versao="v1.9.0" />);
      // Quando
      await voltarParaAba();
      // Então
      expect(ler).toHaveBeenCalledOnce();
      expect(screen.queryByText('Há uma versão nova do SEMPER.')).not.toBeInTheDocument();
    });
  });

  it('dada uma aba sem versão (npm run dev ou banco fictício), quando a pessoa volta para ela, então o SEMPER nem confere', async () => {
    // Dado
    const ler = servidor('v1.9.1 abc1234\n');
    render(<AvisoDeVersaoNova versao="" />);
    // Quando
    await voltarParaAba();
    // Então
    expect(ler).not.toHaveBeenCalled();
    expect(screen.queryByText('Há uma versão nova do SEMPER.')).not.toBeInTheDocument();
  });
});
