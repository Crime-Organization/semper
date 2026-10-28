// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A pilha de desfazer é do sistema todo: cada caso recarrega o módulo para começar com ela vazia.
let avisos: typeof import('./avisos');
beforeEach(async () => { vi.resetModules(); avisos = await import('./avisos'); });

describe('Desfazer', () => {
  describe('Dadas duas ações registradas, uma depois da outra', () => {
    it('quando se desfaz uma vez, então só a última ação é desfeita', async () => {
      // Dado
      const primeira = vi.fn(), segunda = vi.fn();
      avisos.registrarDesfazer('primeira', primeira);
      avisos.registrarDesfazer('segunda', segunda);
      // Quando
      avisos.desfazerUltimo();
      // Então
      await vi.waitFor(() => expect(segunda).toHaveBeenCalledOnce());
      expect(primeira).not.toHaveBeenCalled();
    });

    it('quando se desfaz duas vezes, então as duas são desfeitas da mais nova para a mais antiga', async () => {
      // Dado
      const ordem: string[] = [];
      avisos.registrarDesfazer('primeira', () => { ordem.push('primeira'); });
      avisos.registrarDesfazer('segunda', () => { ordem.push('segunda'); });
      // Quando
      avisos.desfazerUltimo();
      await vi.waitFor(() => expect(ordem).toHaveLength(1));
      avisos.desfazerUltimo();
      // Então
      await vi.waitFor(() => expect(ordem).toEqual(['segunda', 'primeira']));
    });
  });

  it('quando se desfaz uma ação, então as telas são avisadas de que os dados mudaram', async () => {
    // Dado
    const ouvir = vi.fn();
    window.addEventListener('semper:dados-mudaram', ouvir);
    avisos.registrarDesfazer('arquivar', () => ({ tipo: 'pessoa', id: 'p1' }));
    // Quando
    avisos.desfazerUltimo();
    // Então
    await vi.waitFor(() => expect(ouvir).toHaveBeenCalledOnce());
    expect((ouvir.mock.calls[0][0] as CustomEvent).detail).toEqual({ tipo: 'pessoa', id: 'p1' });
    window.removeEventListener('semper:dados-mudaram', ouvir);
  });

  it('quando não há nada para desfazer, então nada é executado e nada quebra', () => {
    // Quando
    const desfazer = () => avisos.desfazerUltimo();
    // Então
    expect(desfazer).not.toThrow();
  });

  it('quando a ação é feita com feito(), então ela fica disponível para desfazer', async () => {
    // Dado
    const reverter = vi.fn();
    avisos.feito('Pessoa arquivada.', 'arquivar a pessoa', reverter);
    // Quando
    avisos.desfazerUltimo();
    // Então
    await vi.waitFor(() => expect(reverter).toHaveBeenCalledOnce());
  });

  it('quando a mesma ação já foi desfeita, então ela não roda de novo', async () => {
    // Dado
    const reverter = vi.fn();
    avisos.registrarDesfazer('arquivar', reverter);
    avisos.desfazerUltimo();
    await vi.waitFor(() => expect(reverter).toHaveBeenCalledOnce());
    // Quando
    avisos.desfazerUltimo();
    // Então
    await Promise.resolve();
    expect(reverter).toHaveBeenCalledOnce();
  });
});
