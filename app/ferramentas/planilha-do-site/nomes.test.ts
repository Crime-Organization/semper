// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Só nomes fictícios.
import { describe, expect, it } from 'vitest';
import { indiceDeNomes, mesmoNome } from './nomes';

describe('Mesmo nome', () => {
  it.each([
    ['acento', 'José Exemplo da Conceição', 'JOSE EXEMPLO DA CONCEICAO'],
    ['vírgula', 'Padaria Exemplo, Ltda', 'Padaria Exemplo Ltda'],
    ['partícula', 'Maria da Silva', 'Maria Silva'],
    ['espaço', 'Ana Maria Exemplo', 'Anamaria Exemplo'],
    ['uma letra faltando num nome longo', 'Maria Aparecida Exemplo', 'Maria Aparcida Exemplo'],
    ['uma letra trocada num nome longo', 'Fernando Exemplo Souza', 'Fernando Exemplo Sousa'],
    ['duas letras invertidas', 'Fernando Exemplo Souza', 'Fernando Exmeplo Souza'],
    ['dois erros num nome bem longo', 'Maria Aparecida Exemplo dos Santos', 'Maria Aparcida Exemplo dos Santo']
  ])('quando a diferença é %s, então é o mesmo nome', (_caso, a, b) => {
    // Então
    expect(mesmoNome(a, b)).toBe(true);
  });

  it.each([
    ['um nome curto com uma letra trocada', 'Ana Lima', 'Ana Lina'],
    ['dois erros num nome médio', 'Fernando Exemplo', 'Fernanda Exempla'],
    ['um número diferente', 'Auto Posto Exemplo 1 Ltda', 'Auto Posto Exemplo 2 Ltda'],
    ['pai e filho', 'Carlos Exemplo Souza Filho', 'Carlos Exemplo Souza'],
    ['nomes diferentes', 'Auto Posto Alfa', 'Auto Posto Beta'],
    ['uma palavra só', 'João', 'João'],
    ['um nome vazio', '', 'Maria Exemplo']
  ])('quando é %s, então não é o mesmo nome', (_caso, a, b) => {
    // Então
    expect(mesmoNome(a, b)).toBe(false);
  });
});

describe('Índice de nomes', () => {
  it('quando procura um nome, então acha as posições do mesmo nome, com ou sem erro de digitação', () => {
    // Dado
    const achar = indiceDeNomes(['Maria Aparecida Exemplo', 'Bruno Fictício', 'MARIA APARCIDA EXEMPLO', 'Carla']);
    // Então
    expect(achar('Maria Aparecida Exemplo').sort((a, b) => a - b)).toEqual([0, 2]);
    expect(achar('Nome Que Nao Existe Aqui')).toEqual([]);
    expect(achar('Carla')).toEqual([]);
  });
});
