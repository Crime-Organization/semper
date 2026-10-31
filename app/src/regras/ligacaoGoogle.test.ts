// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As partes puras das funções do servidor que ligam a conta Google (#164), em supabase/functions/_compartilhado/.
import { describe, expect, it } from 'vitest';
import {
  cabecalhosCors, comCodigo, comResultado, ESCOPO_OBRIGATORIO, ESCOPOS_CONTATOS, escoposDados, lerSitesPermitidos, nivelDaSessao, sitePermitido, urlDeAutorizacao
} from '../../../supabase/functions/_compartilhado/ligacao';

const ESTADO = 'a'.repeat(64);
const VOLTA_DO_GOOGLE = 'https://projeto.supabase.co/functions/v1/google-retorno';
const SITES = ['https://semper.bragaferreira.adv.br', 'http://localhost:8090'];
/** Um token de sessão de mentira, só com a carga (o login do Supabase é quem confere a assinatura de verdade). */
const tokenCom = (carga: object) => 'Bearer x.' + btoa(JSON.stringify(carga)).replace(/=+$/, '') + '.y';

describe('Ligação com a conta Google', () => {
  it('quando o endereço de autorização é montado, então pede os contatos e o e-mail, o token de renovação e leva o estado e o desafio', () => {
    // Quando
    const u = new URL(urlDeAutorizacao('cliente-123', VOLTA_DO_GOOGLE, ESTADO, 'desafio-do-pkce'));
    // Então
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: 'cliente-123', redirect_uri: VOLTA_DO_GOOGLE, response_type: 'code', scope: ESCOPOS_CONTATOS.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
      code_challenge: 'desafio-do-pkce', code_challenge_method: 'S256', state: ESTADO
    });
    expect(ESCOPOS_CONTATOS).toContain(ESCOPO_OBRIGATORIO);
  });

  it.each([
    ['o site do SEMPER', 'https://semper.bragaferreira.adv.br/configuracoes/', true],
    ['o ambiente local', 'http://localhost:8090/configuracoes/', true],
    ['um site parecido, mas de outro dono', 'https://semper.bragaferreira.adv.br.golpe.com/configuracoes/', false],
    ['o mesmo site sem https', 'http://semper.bragaferreira.adv.br/configuracoes/', false],
    ['um endereço que não é de página', 'javascript:alert(1)', false],
    ['nada', null, false]
  ])('quando a página de volta é %s, então a permissão dá %s', (_caso, volta, permitido) => {
    // Quando
    const resultado = sitePermitido(volta, SITES);
    // Então
    expect(resultado).toBe(permitido);
  });

  it('quando o servidor tem a lista de sites permitidos, então vale a lista dele (sem a barra do fim); sem ela, nenhum site', () => {
    // Quando / Então
    expect(lerSitesPermitidos(' https://a.com/ , http://localhost:5173 ')).toEqual(['https://a.com', 'http://localhost:5173']);
    expect(lerSitesPermitidos('')).toEqual([]);
    expect(lerSitesPermitidos(undefined)).toEqual([]);
    expect(sitePermitido('http://localhost:8090/configuracoes/', lerSitesPermitidos(undefined))).toBe(false);
  });

  it.each([
    ['com a verificação em duas etapas', tokenCom({ sub: 'u', aal: 'aal2' }), 'aal2'],
    ['só com a senha', tokenCom({ sub: 'u', aal: 'aal1' }), 'aal1'],
    ['sem o nível', tokenCom({ sub: 'u' }), 'aal1'],
    ['que não é um token', 'Bearer qualquer-coisa', 'aal1'],
    ['nenhuma', null, 'aal1']
  ])('quando a sessão vem %s, então o nível é %s', (_caso, autorizacao, nivel) => {
    // Quando / Então
    expect(nivelDaSessao(autorizacao)).toBe(nivel);
  });

  it('quando a ligação termina, então a página de volta leva o resultado no endereço, sem perder o que já tinha', () => {
    // Quando / Então
    expect(comResultado('https://semper.exemplo.com/configuracoes/', 'ligado')).toBe('https://semper.exemplo.com/configuracoes/?google=ligado');
    expect(comResultado('https://semper.exemplo.com/configuracoes/?aba=1', 'recusado')).toBe('https://semper.exemplo.com/configuracoes/?aba=1&google=recusado');
  });

  it('quando o Google devolve o código, então a página de volta leva o estado e o código, sem perder o que já tinha', () => {
    // Quando
    const u = new URL(comCodigo('https://semper.exemplo.com/configuracoes/?aba=1', ESTADO, '4/0Ab-c_d'));
    // Então
    expect(u.pathname).toBe('/configuracoes/');
    expect(Object.fromEntries(u.searchParams)).toEqual({ aba: '1', google_estado: ESTADO, google_codigo: '4/0Ab-c_d' });
  });

  it('quando a conclusão é chamada de um site do SEMPER, então o navegador recebe a permissão do CORS; de outro site, nenhuma', () => {
    // Quando
    const doSemper = cabecalhosCors('https://semper.bragaferreira.adv.br', SITES);
    // Então
    expect(doSemper['Access-Control-Allow-Origin']).toBe('https://semper.bragaferreira.adv.br');
    expect(doSemper['Access-Control-Allow-Headers']).toContain('authorization');
    expect(cabecalhosCors('https://golpe.com', SITES)).toEqual({});
    expect(cabecalhosCors(null, SITES)).toEqual({});
  });

  it('quando o Google responde as permissões dadas, então elas viram uma lista', () => {
    // Quando / Então
    expect(escoposDados('openid  https://www.googleapis.com/auth/contacts email')).toEqual(['openid', 'https://www.googleapis.com/auth/contacts', 'email']);
    expect(escoposDados(undefined)).toEqual([]);
  });
});
