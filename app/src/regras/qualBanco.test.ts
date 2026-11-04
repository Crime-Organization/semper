// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { avisoDoBanco, MODO_DO_BANCO_LOCAL, qualBanco } from './qualBanco';

const PRODUCAO = { supabaseUrl: 'https://producao.exemplo.test', supabaseChave: 'chave-producao' };
const LOCAL = { url: 'http://127.0.0.1:55321', chave: 'chave-local' };

describe('Qual banco o site usa', () => {
  it('dado o modo do banco local, quando escolhe, então usa o banco local', () => {
    // Quando / Então
    expect(qualBanco(MODO_DO_BANCO_LOCAL, PRODUCAO, LOCAL)).toEqual({ supabaseUrl: LOCAL.url, supabaseChave: LOCAL.chave });
  });

  it.each(['production', 'development', 'producao', 'falso', 'test', ''])('dado o modo "%s", mesmo com o endereço local preenchido, quando escolhe, então usa a produção', modo => {
    // Quando / Então
    expect(qualBanco(modo, PRODUCAO, LOCAL)).toEqual(PRODUCAO);
  });

  it.each([{}, { url: LOCAL.url }, { chave: LOCAL.chave }])('dado o modo do banco local sem endereço ou chave (%j), quando escolhe, então não inventa: usa a produção, e a faixa avisa', local => {
    // Quando / Então
    expect(qualBanco(MODO_DO_BANCO_LOCAL, PRODUCAO, local)).toEqual(PRODUCAO);
  });
});

describe('O aviso do banco na tela', () => {
  it('dado o site publicado, quando olha o aviso, então não há nenhum', () => {
    // Quando / Então
    expect(avisoDoBanco('production', false)).toBeNull();
  });

  it('dado o banco local, quando olha o aviso, então diz que não toca na produção', () => {
    // Quando
    const aviso = avisoDoBanco(MODO_DO_BANCO_LOCAL, true);
    // Então
    expect(aviso).toEqual({ tipo: 'info', texto: expect.stringContaining('nada aqui toca na produção') });
  });

  it.each(['producao', 'development'])('dado o modo "%s" no computador, quando olha o aviso, então alerta que grava em dados reais', modo => {
    // Quando
    const aviso = avisoDoBanco(modo, true);
    // Então
    expect(aviso).toEqual({ tipo: 'erro', texto: expect.stringContaining('dados reais') });
  });

  it.each(['falso', 'test'])('dado o modo "%s", que não usa a produção, quando olha o aviso, então não há nenhum', modo => {
    // Quando / Então
    expect(avisoDoBanco(modo, true)).toBeNull();
  });
});
