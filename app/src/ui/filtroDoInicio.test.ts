// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it, vi } from 'vitest';
import { filtroDoInicio } from './filtroDoInicio';

describe('Filtro "Início" de tarefas e demandas (#357)', () => {
  it('quando o filtro é montado, então começa em qualquer data e oferece os períodos', () => {
    // Quando
    const filtro = filtroDoInicio('', () => {});
    // Então
    expect(filtro.rotulo).toBe('Início');
    expect(filtro.opcoes[0]).toEqual(['', 'Qualquer data']);
    expect(filtro.opcoes.map(([, texto]) => texto)).toContain('Ainda vai começar');
  });

  it('quando a pessoa escolhe um período, então o filtro avisa qual', () => {
    // Dado
    const aoMudar = vi.fn();
    // Quando
    filtroDoInicio('', aoMudar).aoMudar('futuro');
    // Então
    expect(aoMudar).toHaveBeenCalledWith('futuro');
  });
});
