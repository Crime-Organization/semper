// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As partes puras das funções do servidor que ligam a conta Google (#164), em supabase/functions/_compartilhado/.
import { describe, expect, it } from 'vitest';
import {
  comResultado, ESCOPO_OBRIGATORIO, ESCOPOS_CONTATOS, escoposDados, lerSitesPermitidos, SITES_PADRAO, sitePermitido, urlDeAutorizacao
} from '../../../supabase/functions/_compartilhado/ligacao';

const ESTADO = 'a'.repeat(64);
const VOLTA_DO_GOOGLE = 'https://projeto.supabase.co/functions/v1/google-retorno';

describe('Ligação com a conta Google', () => {
  it('quando o endereço de autorização é montado, então pede os contatos e o e-mail, o token de renovação e leva o estado', () => {
    // Quando
    const u = new URL(urlDeAutorizacao('cliente-123', VOLTA_DO_GOOGLE, ESTADO));
    // Então
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: 'cliente-123', redirect_uri: VOLTA_DO_GOOGLE, response_type: 'code', scope: ESCOPOS_CONTATOS.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: ESTADO
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
    const resultado = sitePermitido(volta, SITES_PADRAO);
    // Então
    expect(resultado).toBe(permitido);
  });

  it('quando o servidor tem a lista de sites permitidos, então vale a lista dele (sem a barra do fim); sem ela, a padrão', () => {
    // Quando / Então
    expect(lerSitesPermitidos(' https://a.com/ , http://localhost:5173 ')).toEqual(['https://a.com', 'http://localhost:5173']);
    expect(lerSitesPermitidos('')).toEqual(SITES_PADRAO);
    expect(lerSitesPermitidos(undefined)).toEqual(SITES_PADRAO);
  });

  it('quando a ligação termina, então a página de volta leva o resultado no endereço, sem perder o que já tinha', () => {
    // Quando / Então
    expect(comResultado('https://semper.exemplo.com/configuracoes/', 'ligado')).toBe('https://semper.exemplo.com/configuracoes/?google=ligado');
    expect(comResultado('https://semper.exemplo.com/configuracoes/?aba=1', 'recusado')).toBe('https://semper.exemplo.com/configuracoes/?aba=1&google=recusado');
  });

  it('quando o Google responde as permissões dadas, então elas viram uma lista', () => {
    // Quando / Então
    expect(escoposDados('openid  https://www.googleapis.com/auth/contacts email')).toEqual(['openid', 'https://www.googleapis.com/auth/contacts', 'email']);
    expect(escoposDados(undefined)).toEqual([]);
  });
});
