// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  arquivoDoModo, avisoDoBanco, BANCO_FICTICIO, bancoDeVerdadeNoComputador, faltaOBanco, MARCA_DO_BANCO_NA_POLITICA, MODO_DO_BANCO_LOCAL,
  politicaComOBanco, qualBanco
} from './qualBanco';

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
    expect(() => qualBanco(modo, variaveis)).toThrow(faltaOBanco(modo, variaveis));
  });

  it('dado as duas variáveis faltando, quando a pessoa lê o erro, então ele diz as duas, em qual arquivo e o que usar para desenvolver', () => {
    // Quando
    const texto = faltaOBanco('producao', {});
    // Então
    expect(texto).toContain('faltam ou estão erradas as variáveis');
    expect(texto).toContain('VITE_SUPABASE_URL');
    expect(texto).toContain('VITE_SUPABASE_CHAVE');
    expect(texto).toContain('app/.env.production');
    expect(texto).toContain('npm run dev');
  });

  it('dado só a chave faltando, quando a pessoa lê o erro, então ele fala só da chave, não do endereço que está lá', () => {
    // Quando
    const texto = faltaOBanco('production', { url: PRODUCAO.url });
    // Então
    expect(texto).toContain('falta ou está errada a variável VITE_SUPABASE_CHAVE');
    expect(texto).not.toContain('VITE_SUPABASE_URL');
  });

  it.each([
    ['sem o endereço', { chave: PRODUCAO.chave }],
    ['com o endereço sem http', { url: 'producao.exemplo.test', chave: PRODUCAO.chave }]
  ])('dado a chave certa e o banco %s, quando a pessoa lê o erro, então ele fala só do endereço', (_caso, variaveis) => {
    // Quando
    const texto = faltaOBanco('production', variaveis);
    // Então
    expect(texto).toContain('falta ou está errada a variável VITE_SUPABASE_URL (um endereço começando com http)');
    expect(texto).not.toContain('VITE_SUPABASE_CHAVE');
  });
});

describe('Banco de verdade no computador de quem desenvolve', () => {
  it.each(['producao', MODO_DO_BANCO_LOCAL, 'development'])('dado o modo "%s" no computador, quando pergunta, então é banco de verdade', modo => {
    // Quando / Então
    expect(bancoDeVerdadeNoComputador(modo, true)).toBe(true);
  });

  it.each(['falso', 'test'])('dado o modo "%s" no computador, quando pergunta, então não é: o banco é fictício', modo => {
    // Quando / Então
    expect(bancoDeVerdadeNoComputador(modo, true)).toBe(false);
  });

  it('dado o site publicado, quando pergunta, então não é o computador de quem desenvolve', () => {
    // Quando / Então
    expect(bancoDeVerdadeNoComputador('production', false)).toBe(false);
  });
});

describe('O banco na política de conteúdo do .htaccess', () => {
  const HTACCESS = `Header always set Content-Security-Policy "connect-src 'self' ${MARCA_DO_BANCO_NA_POLITICA} https://viacep.com.br"`;

  it('dado o .htaccess com a marca, quando compila, então o connect-src libera o endereço do banco das variáveis', () => {
    // Quando
    const texto = politicaComOBanco(HTACCESS, { supabaseUrl: PRODUCAO.url, supabaseChave: PRODUCAO.chave });
    // Então
    expect(texto).toBe(`Header always set Content-Security-Policy "connect-src 'self' ${PRODUCAO.url} https://viacep.com.br"`);
  });

  it('dado o banco local, com porta e barra no fim, quando compila, então libera só a origem dele', () => {
    // Quando
    const texto = politicaComOBanco(HTACCESS, { supabaseUrl: `${LOCAL.url}/`, supabaseChave: LOCAL.chave });
    // Então
    expect(texto).toContain(`'self' ${LOCAL.url} https://viacep.com.br`);
  });

  it('dado um .htaccess sem a marca, quando compila, então para com erro, em vez de publicar um site que não fala com o banco', () => {
    // Quando / Então
    expect(() => politicaComOBanco('connect-src \'self\'', BANCO_FICTICIO)).toThrow(MARCA_DO_BANCO_NA_POLITICA);
  });

  it('dado o app/public/.htaccess de verdade, quando confere, então ele tem a marca no connect-src e nenhum endereço de banco fixo', () => {
    // Dado
    const htaccess = readFileSync(fileURLToPath(new URL('../../public/.htaccess', import.meta.url)), 'utf8');
    // Quando
    const politica = htaccess.split('\n').find(linha => linha.includes('Content-Security-Policy')) ?? '';
    // Então
    expect(politica).toMatch(new RegExp(`connect-src 'self' ${MARCA_DO_BANCO_NA_POLITICA} `));
    expect(htaccess).not.toMatch(/supabase\.co/);
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
