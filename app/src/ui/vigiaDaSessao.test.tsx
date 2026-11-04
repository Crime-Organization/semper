// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFERIR_SESSAO_A_CADA } from './tempos';
import { useVigiaDaSessao } from './vigiaDaSessao';

function Vigia({ conferir, aoEncerrar }: { conferir: () => Promise<boolean>; aoEncerrar: () => void }) {
  useVigiaDaSessao(conferir, aoEncerrar);
  return null;
}
/** A aba fica à vista ou escondida (a pessoa foi para outra aba ou programa). */
function abaFica(estado: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(estado);
}
/** A pessoa volta para a aba do SEMPER. */
async function voltarParaAba() {
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
}
const passarOIntervalo = () => act(async () => { await vi.advanceTimersByTimeAsync(CONFERIR_SESSAO_A_CADA); });

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Vigia da sessão', () => {
  describe('Dada uma sessão encerrada em outro lugar', () => {
    it('quando a pessoa volta para a aba, então vai para a entrada', async () => {
      // Dado
      const aoEncerrar = vi.fn();
      render(<Vigia conferir={async () => true} aoEncerrar={aoEncerrar} />);
      // Quando
      await voltarParaAba();
      // Então
      expect(aoEncerrar).toHaveBeenCalledOnce();
    });

    it('quando passa o intervalo de conferência com a aba à vista, então vai para a entrada', async () => {
      // Dado
      vi.useFakeTimers();
      const aoEncerrar = vi.fn();
      render(<Vigia conferir={async () => true} aoEncerrar={aoEncerrar} />);
      // Quando
      await passarOIntervalo();
      // Então
      expect(aoEncerrar).toHaveBeenCalledOnce();
    });

    it('quando a aba está escondida, então nem confere', async () => {
      // Dado
      vi.useFakeTimers();
      abaFica('hidden');
      const conferir = vi.fn(async () => true);
      render(<Vigia conferir={conferir} aoEncerrar={vi.fn()} />);
      // Quando
      await passarOIntervalo();
      // Então
      expect(conferir).not.toHaveBeenCalled();
    });

    it('quando a tela já foi fechada antes da resposta, então não faz nada', async () => {
      // Dado
      let responder: (encerrada: boolean) => void = () => {};
      const aoEncerrar = vi.fn();
      const tela = render(<Vigia conferir={() => new Promise(r => { responder = r; })} aoEncerrar={aoEncerrar} />);
      await voltarParaAba();
      // Quando
      tela.unmount();
      await act(async () => { responder(true); });
      // Então
      expect(aoEncerrar).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['a sessão continua ativa', async () => false],
    ['o login não responde', async () => { throw new Error('Failed to fetch'); }]
  ])('quando %s, então a pessoa continua onde está', async (_caso, conferir) => {
    // Dado
    const aoEncerrar = vi.fn();
    render(<Vigia conferir={conferir} aoEncerrar={aoEncerrar} />);
    // Quando
    await voltarParaAba();
    // Então
    expect(aoEncerrar).not.toHaveBeenCalled();
  });
});
