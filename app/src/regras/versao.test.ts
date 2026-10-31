// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { haVersaoNova, versaoDoArquivo } from './versao';

describe('Versão no ar', () => {
  it.each([
    ['v1.9.0 ecee79f\n', 'v1.9.0'],
    ['  v2.0.10  ', 'v2.0.10'],
    ['<!doctype html><html>', null],
    ['', null],
    ['1.9.0 ecee79f', null]
  ])('quando o versao.txt diz %j, então a versão é %j', (texto, esperada) => {
    // Quando
    const versao = versaoDoArquivo(texto);
    // Então
    expect(versao).toBe(esperada);
  });
});

describe('Aviso de versão nova', () => {
  it.each([
    ['v1.9.0', 'v1.9.1', true],
    ['v1.9.0', 'v1.8.2', true],
    ['v1.9.0', 'v1.9.0', false],
    ['v1.9.0', null, false],
    ['', 'v1.9.1', false]
  ])('quando a aba está na %j e o servidor na %j, então há versão nova: %s', (daAba, noAr, esperado) => {
    // Quando
    const nova = haVersaoNova(daAba, noAr);
    // Então
    expect(nova).toBe(esperado);
  });
});
