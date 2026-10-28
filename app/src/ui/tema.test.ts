// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it } from 'vitest';
import { aplicarTema, mostrarTema, temaAtual, temaGuardado } from './tema';

describe('Tema da tela', () => {
  beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.tema; });

  it('quando nada foi escolhido, então o tema é automático', () => {
    // Quando
    const atual = [temaAtual(), temaGuardado()];
    // Então
    expect(atual).toEqual(['auto', 'auto']);
  });

  it.each([['claro'], ['escuro']] as const)('quando a pessoa escolhe o tema %s, então a tela muda e a escolha fica guardada no aparelho', tema => {
    // Quando
    aplicarTema(tema);
    // Então
    expect(document.documentElement.dataset.tema).toBe(tema);
    expect(temaAtual()).toBe(tema);
    expect(temaGuardado()).toBe(tema);
  });

  it('quando a pessoa volta para o automático, então a tela segue o aparelho e a escolha antiga some', () => {
    // Dado
    aplicarTema('escuro');
    // Quando
    aplicarTema('auto');
    // Então
    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(temaGuardado()).toBe('auto');
  });

  it('quando uma tela só mostra outro tema, então a escolha guardada não muda', () => {
    // Dado
    aplicarTema('escuro');
    // Quando
    mostrarTema('claro');
    // Então
    expect(temaAtual()).toBe('claro');
    expect(temaGuardado()).toBe('escuro');
  });

  it('quando o aparelho guardou um valor estranho, então o tema é automático', () => {
    // Dado
    localStorage.setItem('semper-tema', 'roxo');
    // Quando
    const guardado = temaGuardado();
    // Então
    expect(guardado).toBe('auto');
  });
});
