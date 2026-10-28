// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { corDe, iniciais } from './Avatar';

describe('Avatar da equipe', () => {
  it.each([
    ['Mateus Freitas Gonçalves', 'MG'],
    ['ana', 'A'],
    ['  bruno   souza  ', 'BS'],
    ['', '?'],
    [null, '?']
  ])('quando o nome é %j, então as iniciais são "%s"', (nome, esperado) => {
    // Quando
    const letras = iniciais(nome);
    // Então
    expect(letras).toBe(esperado);
  });

  it('quando a pessoa escolheu uma cor, então o avatar usa essa cor', () => {
    // Quando
    const cor = corDe({ id: 'u1', nome: 'Ana', cor: '#123456' });
    // Então
    expect(cor).toBe('#123456');
  });

  it('quando a pessoa não escolheu cor, então a cor é sempre a mesma para ela', () => {
    // Quando
    const cores = [corDe({ id: 'u-ana', nome: 'Ana' }), corDe({ id: 'u-ana', nome: 'Ana' })];
    // Então
    expect(cores[0]).toMatch(/^#[0-9A-F]{6}$/i);
    expect(cores[1]).toBe(cores[0]);
  });

  it('quando não há pessoa, então ainda há uma cor', () => {
    // Quando
    const cor = corDe(null);
    // Então
    expect(cor).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
