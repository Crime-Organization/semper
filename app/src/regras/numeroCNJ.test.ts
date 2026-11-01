// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cnjValido, digitoDoCNJ, erroDoCNJ, fmtCNJ, mascaraCNJ, orgaoDoCNJ, partesDoCNJ } from './numeroCNJ';

// Números montados para os testes, com o dígito verificador certo.
const ESTADUAL_MG = '0001234-97.2026.8.13.0024';
const FEDERAL_6 = '5000123-76.2025.4.06.3800';
const TRABALHO_3 = '0010001-95.2024.5.03.0001';
const STJ = '0000100-92.2023.3.00.0000';

/** Conferência independente (ISO 7064): o número inteiro, com o dígito no fim, deixa resto 1 na divisão por 97. */
const restoComDigitoNoFim = (n: string) => {
  const p = partesDoCNJ(n)!;
  return (p.sequencial + p.ano + p.segmento + p.tribunal + p.origem + p.digito).split('').reduce((r, c) => (r * 10 + Number(c)) % 97, 0);
};

describe('Número do processo no padrão do CNJ', () => {
  it.each([ESTADUAL_MG, FEDERAL_6, TRABALHO_3, STJ])('quando o número é %s, então ele é válido', numero => {
    // Então
    expect(cnjValido(numero)).toBe(true);
    expect(erroDoCNJ(numero)).toBeNull();
  });

  it.each([ESTADUAL_MG, FEDERAL_6, TRABALHO_3, STJ])('quando o dígito de %s é calculado, então ele passa na conferência do resto 1', numero => {
    // Então
    expect(restoComDigitoNoFim(numero)).toBe(1);
  });

  it('quando o número vem só com algarismos, então ele também é válido e ganha a pontuação', () => {
    // Dado
    const algarismos = ESTADUAL_MG.replace(/\D/g, '');
    // Então
    expect(cnjValido(algarismos)).toBe(true);
    expect(fmtCNJ(algarismos)).toBe(ESTADUAL_MG);
  });

  it('quando um algarismo é trocado, então o dígito verificador não confere', () => {
    // Dado
    const trocado = '0001235-97.2026.8.13.0024';
    // Então
    expect(cnjValido(trocado)).toBe(false);
    expect(erroDoCNJ(trocado)).toBe('O dígito verificador não confere: confira o número do processo.');
  });

  it.each(['', '0001234-97.2026.8.13', '1234'])('quando o número digitado é "%s", então avisa que faltam algarismos', numero => {
    // Então
    expect(cnjValido(numero)).toBe(false);
    expect(erroDoCNJ(numero)).toBe('O número do processo tem 20 algarismos (NNNNNNN-DD.AAAA.J.TR.OOOO).');
  });

  it('quando o número é separado, então cada parte vem com os zeros à esquerda', () => {
    // Então
    expect(partesDoCNJ(ESTADUAL_MG)).toEqual({ sequencial: '0001234', digito: '97', ano: '2026', segmento: '8', tribunal: '13', origem: '0024' });
    expect(digitoDoCNJ({ sequencial: '0001234', ano: '2026', segmento: '8', tribunal: '13', origem: '0024' })).toBe('97');
  });

  it('quando o texto não tem 20 algarismos, então a formatação devolve o texto como veio', () => {
    // Então
    expect(fmtCNJ('processo físico 123')).toBe('processo físico 123');
    expect(fmtCNJ(null)).toBe('');
  });

  it.each([
    ['0', '0'],
    ['00012349', '0001234-9'],
    ['000123497202', '0001234-97.202'],
    ['00012349720268', '0001234-97.2026.8'],
    ['0001234972026813', '0001234-97.2026.8.13'],
    ['00012349720268130024', ESTADUAL_MG],
    [ESTADUAL_MG + '99', ESTADUAL_MG],
    ['abc 0001234', '0001234']
  ])('quando a pessoa digita "%s", então o campo mostra "%s"', (digitado, mostrado) => {
    // Então
    expect(mascaraCNJ(digitado)).toBe(mostrado);
  });

  it.each([
    [ESTADUAL_MG, 'TJMG'],
    [FEDERAL_6, 'TRF6'],
    [TRABALHO_3, 'TRT3'],
    [STJ, 'STJ'],
    ['0000001-00.2026.8.07.0001', 'TJDFT'],
    ['0000001-00.2026.8.26.0100', 'TJSP'],
    ['0000001-00.2026.5.00.0000', 'TST'],
    ['0000001-00.2026.6.13.0001', 'TRE-MG'],
    ['0000001-00.2026.9.13.0001', 'TJMMG']
  ])('quando o número é %s, então o órgão sugerido é %s', (numero, orgao) => {
    // Então (o órgão sai do segmento e do tribunal, mesmo que o dígito não confira)
    expect(orgaoDoCNJ(numero)).toBe(orgao);
  });

  it.each([
    ['um tribunal federal que não existe', '0000001-00.2026.4.07.0001'],
    ['um estado que não existe', '0000001-00.2026.8.28.0001'],
    ['Justiça Militar estadual fora de MG, RS e SP', '0000001-00.2026.9.05.0001'],
    ['um número incompleto', '0000001-00.2026']
  ])('quando é %s, então nenhum órgão é sugerido', (_caso, numero) => {
    // Então
    expect(orgaoDoCNJ(numero)).toBeNull();
  });
});
