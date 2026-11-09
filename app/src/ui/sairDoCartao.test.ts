// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { avisar, sinalizarMudanca } from './avisos';
import { SAIDA_FALHOU, sairDoCartao } from './sairDoCartao';

vi.mock('./avisos', async original => ({ ...await original<typeof import('./avisos')>(), avisar: vi.fn(), sinalizarMudanca: vi.fn() }));

describe('Sair do cartão depois de gravar', () => {
  beforeEach(() => { vi.mocked(avisar).mockClear(); vi.mocked(sinalizarMudanca).mockClear(); });

  it('dado que a saída deu certo, então avisa e atualiza as listas', async () => {
    // Dado
    const sair = vi.spyOn(SD, 'cartaoSair').mockResolvedValue();
    // Quando
    await sairDoCartao('tarefas', 't1', 'Você saiu.');
    // Então
    expect(sair).toHaveBeenCalledWith('tarefas', 't1');
    expect(avisar).toHaveBeenCalledWith('Você saiu.');
    expect(sinalizarMudanca).toHaveBeenCalled();
  });

  it('dado que a saída falhou, então diz que o resto foi salvo e atualiza as listas', async () => {
    // Dado
    vi.spyOn(SD, 'cartaoSair').mockRejectedValue(new Error('sem rede'));
    // Quando
    const r = sairDoCartao('tarefas', 't1', 'Você saiu.');
    // Então
    await expect(r).rejects.toThrow(SAIDA_FALHOU);
    expect(sinalizarMudanca).toHaveBeenCalled();
    expect(avisar).not.toHaveBeenCalled();
  });
});
