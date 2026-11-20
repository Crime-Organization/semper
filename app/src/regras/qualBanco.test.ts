// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { arquivoDoModo, avisoDoBanco, BANCO_FICTICIO, faltaOBanco, MODO_DO_BANCO_LOCAL, qualBanco } from './qualBanco';

const PRODUCAO = { url: 'https://producao.exemplo.test', chave: 'chave-producao' };
const LOCAL = { url: 'http://127.0.0.1:55321', chave: 'chave-local' };

describe('Qual banco o site usa', () => {
  it('dado o modo do banco local com as variáveis do app/.env.docker, quando escolhe, então usa o banco local', () => {
    // Quando / Então
    expect(qualBanco(MODO_DO_BANCO_LOCAL, LOCAL)).toEqual({ supabaseUrl: LOCAL.url, supabaseChave: LOCAL.chave });
  });

  it.each(['production', 'producao'])('dado o modo "%s" com as variáveis da produção, quando escolhe, então usa o banco das variáveis, sem nada fixo no código', modo => {
    // Quando / Então
    expect(qualBanco(modo, PRODUCAO)).toEqual({ supabaseUrl: PRODUCAO.url, supabaseChave: PRODUCAO.chave });
  });

  it('dado o "npm run dev-producao" (modo "producao"), quando procura o arquivo do banco, então lê o mesmo do site publicado', () => {
    // Quando / Então
    expect(arquivoDoModo('producao')).toBe('production');
    expect(arquivoDoModo('production')).toBe('production');
    expect(arquivoDoModo(MODO_DO_BANCO_LOCAL)).toBe(MODO_DO_BANCO_LOCAL);
  });

  it.each(['falso', 'test'])('dado o modo "%s", que não usa o Supabase, quando escolhe, com ou sem variáveis, então fica com um endereço que não existe, sem erro', modo => {
    // Quando
    const semVariaveis = qualBanco(modo, {});
    const comAsDaProducao = qualBanco(modo, PRODUCAO);
    // Então
    expect(semVariaveis).toEqual(BANCO_FICTICIO);
    expect(comAsDaProducao).toEqual(BANCO_FICTICIO);
    expect(new URL(BANCO_FICTICIO.supabaseUrl).hostname).toMatch(/\.invalid$/);
  });

  it.each([
    ['production', {}],
    ['production', { url: PRODUCAO.url }],
    ['producao', { chave: PRODUCAO.chave }],
    [MODO_DO_BANCO_LOCAL, {}],
    ['development', {}],
    ['production', { url: 'producao.exemplo.test', chave: PRODUCAO.chave }]
  ])('dado o modo "%s" sem endereço válido ou sem chave (%j), quando escolhe, então para com um erro claro em português, em vez de cair noutro banco', (modo, variaveis) => {
    // Quando / Então
    expect(() => qualBanco(modo, variaveis)).toThrow(faltaOBanco(modo));
  });

  it('dado o erro de banco faltando, quando a pessoa lê, então ele diz quais variáveis faltam, em qual arquivo e o que usar para desenvolver', () => {
    // Quando
    const texto = faltaOBanco('producao');
    // Então
    expect(texto).toContain('VITE_SUPABASE_URL');
    expect(texto).toContain('VITE_SUPABASE_CHAVE');
    expect(texto).toContain('app/.env.production');
    expect(texto).toContain('npm run dev');
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
