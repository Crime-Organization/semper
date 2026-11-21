// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { tituloDaAba } from './tituloDaAba';

describe('Título da aba do navegador (#323)', () => {
  it('dado um escritório com nome, quando a página abre, então a aba mostra a página, o escritório e o SEMPER', () => {
    // Quando
    const titulo = tituloDaAba('Pessoas', 'Marques & Lima Advogados', 'SEMPER');
    // Então
    expect(titulo).toBe('Pessoas · Marques & Lima Advogados · SEMPER');
  });

  it.each([
    ['sem escritório (a entrada)', null],
    ['com o nome em branco', '   '],
    ['com o nome do próprio produto', 'SEMPER']
  ])('dado um escritório %s, quando a página abre, então a aba mostra só a página e o SEMPER', (_caso, escritorio) => {
    // Quando
    const titulo = tituloDaAba('Entrar', escritorio, 'SEMPER');
    // Então
    expect(titulo).toBe('Entrar · SEMPER');
  });

  it('dado um nome com espaços nas pontas, quando a página abre, então a aba mostra o nome sem eles', () => {
    // Quando
    const titulo = tituloDaAba('Início', '  Núcleo de Inovação Exemplo ', 'SEMPER');
    // Então
    expect(titulo).toBe('Início · Núcleo de Inovação Exemplo · SEMPER');
  });
});
