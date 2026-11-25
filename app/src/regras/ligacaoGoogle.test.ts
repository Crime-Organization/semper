// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As partes puras das funções do servidor que ligam a conta Google (#164), em supabase/functions/_compartilhado/.
import { describe, expect, it } from 'vitest';
import {
  agendaAutorizada, cabecalhosCors, comCodigo, comResultado, contaServe, ESCOPO_OBRIGATORIO, ESCOPOS_CONTATOS, ESCOPOS_DA_AGENDA, ESCOPOS_DO_PEDIDO, escoposDados,
  FALTA_NA_AUTORIZACAO, lerSitesPermitidos, nivelDaSessao, RESULTADO_DO_PEDIDO, sitePermitido, urlDeAutorizacao
} from '../../../supabase/functions/_compartilhado/ligacao';

const ESTADO = 'a'.repeat(64);
const VOLTA_DO_GOOGLE = 'https://projeto.supabase.co/functions/v1/google-retorno';
const SITES = ['https://semper.app.br', 'http://localhost:8090'];
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
    ['o site do SEMPER', 'https://semper.app.br/configuracoes/', true],
    ['o ambiente local', 'http://localhost:8090/configuracoes/', true],
    ['um site parecido, mas de outro dono', 'https://semper.app.br.golpe.com/configuracoes/', false],
    ['o mesmo site sem https', 'http://semper.app.br/configuracoes/', false],
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
    const doSemper = cabecalhosCors('https://semper.app.br', SITES);
    // Então
    expect(doSemper['Access-Control-Allow-Origin']).toBe('https://semper.app.br');
    expect(doSemper['Access-Control-Allow-Headers']).toContain('authorization');
    expect(cabecalhosCors('https://golpe.com', SITES)).toEqual({});
    expect(cabecalhosCors(null, SITES)).toEqual({});
  });

  it('dado o pedido da agenda (#166), quando o endereço é montado, então pede só a agenda, somada ao que já foi dado, e já abre na conta do escritório', () => {
    // Quando
    const u = new URL(urlDeAutorizacao('cliente-123', VOLTA_DO_GOOGLE, ESTADO, 'desafio', ESCOPOS_DO_PEDIDO.agendas, 'contato@exemplo.com'));
    // Então
    expect(u.searchParams.get('scope')).toBe(['openid', 'email', ...ESCOPOS_DA_AGENDA].join(' '));
    expect(u.searchParams.get('include_granted_scopes')).toBe('true');
    expect(u.searchParams.get('login_hint')).toBe('contato@exemplo.com');
    expect(ESCOPOS_DA_AGENDA).toEqual(['https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/calendar.acls']);
    expect(ESCOPOS_DO_PEDIDO.contatos).toBe(ESCOPOS_CONTATOS);
  });

  it.each([
    ['contatos', [ESCOPO_OBRIGATORIO], null],
    ['contatos', ['openid', 'email'], 'sem-permissao'],
    ['agendas', [ESCOPO_OBRIGATORIO, ...ESCOPOS_DA_AGENDA], null],
    ['agendas', [ESCOPO_OBRIGATORIO, ESCOPOS_DA_AGENDA[0]], 'sem-permissao-agenda'],
    ['agendas', [ESCOPO_OBRIGATORIO], 'sem-permissao-agenda']
  ] as const)('dado o pedido de %s, quando o Google devolve %o, então o que falta é %s', (finalidade, escopos, falta) => {
    // Quando / Então
    expect(FALTA_NA_AUTORIZACAO[finalidade]([...escopos])).toBe(falta);
  });

  it('quando a conta que autorizou é conferida, então ligar a conta aceita qualquer uma; somar a agenda, só a que já está ligada', () => {
    // Quando / Então
    expect(contaServe('contatos', 'outra@exemplo.com', 'contato@exemplo.com')).toBe(true);
    expect(contaServe('agendas', 'Contato@Exemplo.com', 'contato@exemplo.com')).toBe(true);
    expect(contaServe('agendas', 'outra@exemplo.com', 'contato@exemplo.com')).toBe(false);
    expect(contaServe('agendas', 'outra@exemplo.com', null)).toBe(false);
    expect(RESULTADO_DO_PEDIDO).toEqual({ contatos: 'ligado', agendas: 'agenda-ligada' });
  });

  it('quando as permissões da conta são lidas, então a agenda só conta como autorizada com as duas', () => {
    // Quando / Então
    expect(agendaAutorizada([ESCOPO_OBRIGATORIO, ...ESCOPOS_DA_AGENDA])).toBe(true);
    expect(agendaAutorizada([ESCOPOS_DA_AGENDA[0]])).toBe(false);
    expect(agendaAutorizada(null)).toBe(false);
  });

  it('quando o Google responde as permissões dadas, então elas viram uma lista', () => {
    // Quando / Então
    expect(escoposDados('openid  https://www.googleapis.com/auth/contacts email')).toEqual(['openid', 'https://www.googleapis.com/auth/contacts', 'email']);
    expect(escoposDados(undefined)).toEqual([]);
  });
});
