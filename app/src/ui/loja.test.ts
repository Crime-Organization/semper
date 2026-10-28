// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it, vi } from 'vitest';
import { criarLoja } from './loja';

describe('Loja observável', () => {
  it('quando o valor muda, então quem se inscreveu é avisado e lê o valor novo', () => {
    // Dado
    const loja = criarLoja(1);
    const ouvinte = vi.fn(() => loja.ler());
    loja.assinar(ouvinte);
    // Quando
    loja.mudar(2);
    // Então
    expect(ouvinte).toHaveBeenCalledOnce();
    expect(ouvinte).toHaveReturnedWith(2);
  });

  it('quando o novo valor é calculado a partir do atual, então parte do valor de agora', () => {
    // Dado
    const loja = criarLoja<string[]>(['a']);
    // Quando
    loja.mudar(atual => [...atual, 'b']);
    // Então
    expect(loja.ler()).toEqual(['a', 'b']);
  });

  it('quando alguém cancela a inscrição, então não é mais avisado', () => {
    // Dado
    const loja = criarLoja(0);
    const ouvinte = vi.fn();
    const cancelar = loja.assinar(ouvinte);
    // Quando
    cancelar();
    loja.mudar(1);
    // Então
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('quando a loja é reiniciada, então volta ao valor inicial e avisa os inscritos', () => {
    // Dado
    const loja = criarLoja('inicial');
    loja.mudar('outro');
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    // Quando
    loja.reiniciar();
    // Então
    expect(loja.ler()).toBe('inicial');
    expect(ouvinte).toHaveBeenCalledOnce();
  });

  it('quando há várias lojas, então cada uma tem os próprios valores e inscritos', () => {
    // Dado
    const a = criarLoja(0), b = criarLoja(0);
    const ouvinteDeA = vi.fn();
    a.assinar(ouvinteDeA);
    // Quando
    b.mudar(5);
    // Então
    expect(a.ler()).toBe(0);
    expect(ouvinteDeA).not.toHaveBeenCalled();
  });
});
