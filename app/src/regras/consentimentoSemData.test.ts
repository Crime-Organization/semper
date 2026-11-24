// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O aviso do consentimento sem data no Início (#409) e o link para a página Pessoas já filtrada.
import { describe, expect, it } from 'vitest';
import { avisoDoConsentimentoSemData, LISTA_SEM_DATA, MARCA_SEM_DATA } from './consentimentoSemData';

describe('Aviso do consentimento sem data', () => {
  it('quando nenhuma pessoa está sem a data, então não há aviso', () => {
    // Quando / Então
    expect(avisoDoConsentimentoSemData(0)).toBeNull();
  });

  it('quando uma pessoa está sem a data, então o aviso fala dela no singular', () => {
    // Quando
    const frase = avisoDoConsentimentoSemData(1);
    // Então
    expect(frase).toMatch(/^1 pessoa está com a base legal "consentimento" e sem a data dele\./);
  });

  it('quando muitas pessoas estão sem a data, então o aviso diz quantas, no plural e com o ponto do milhar', () => {
    // Quando
    const frase = avisoDoConsentimentoSemData(1234);
    // Então
    expect(frase).toMatch(/^1\.234 pessoas estão com a base legal "consentimento"/);
    expect(frase).toContain('LGPD');
  });

  it('quando o aviso leva à lista, então o link abre Pessoas na tabela, filtrada pelo consentimento sem data', () => {
    // Dado
    const endereco = new URL(LISTA_SEM_DATA, 'http://semper');
    // Então
    expect(endereco.pathname).toBe('/pessoas/');
    expect(endereco.searchParams.get('visao')).toBe('tabela');
    expect(endereco.searchParams.get('marca')).toBe(MARCA_SEM_DATA);
  });
});
