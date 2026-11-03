// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício não guarda quem está logado como o supabase.ts guarda: isto só se prova aqui, com o login simulado e sem rede.
import { AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/auth-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '00000000-0000-0000-0000-000000000001';
const login = vi.hoisted(() => ({ respostaDaTroca: {} as { email: string; new_email?: string }, erroDoUsuario: null as Error | null }));

vi.mock('@supabase/auth-js', async original => ({
  ...await original<typeof import('@supabase/auth-js')>(),
  AuthClient: class {
    getUser = async () => ({ data: { user: null }, error: login.erroDoUsuario });
    getSession = async () => ({ data: { session: { access_token: 'token', user: { id: ID, email: 'atual@exemplo.com' } } }, error: null });
    updateUser = async () => ({ data: { user: login.respostaDaTroca }, error: null });
  }
}));

describe('Troca do e-mail de acesso no supabase.ts', () => {
  let pedidos: { metodo: string; url: string }[];

  beforeEach(() => {
    vi.resetModules();
    pedidos = [];
    vi.stubGlobal('fetch', async (entrada: string | URL, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET', url = String(entrada);
      pedidos.push({ metodo, url });
      if (metodo !== 'GET') return new Response(null, { status: 204 });
      return Response.json(url.includes('/perfis') ? [{ id: ID, escritorio_id: 'e1', papel: 'usuario', nome: 'Pessoa' }] : [{ id: 'e1' }]);
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const leiturasDePerfil = () => pedidos.filter(p => p.metodo === 'GET' && p.url.includes('/perfis')).length;

  async function logado() {
    const { SD } = await import('./supabase');
    await SD.contexto();
    return SD;
  }

  it('dado uma troca esperando confirmação, quando a pessoa salva o nome, então ainda se sabe quem ela é', async () => {
    // Dado
    login.respostaDaTroca = { email: 'atual@exemplo.com', new_email: 'nova@exemplo.com' };
    const SD = await logado();
    await SD.trocarEmail('nova@exemplo.com');
    // Quando
    await SD.salvarPerfil({ nome: 'Outro Nome' });
    // Então
    expect(pedidos.find(p => p.metodo === 'PATCH')?.url).toContain(`id=eq.${ID}`);
  });

  it('dado uma troca esperando confirmação, quando pede o contexto, então não precisa ler de novo', async () => {
    // Dado
    login.respostaDaTroca = { email: 'atual@exemplo.com', new_email: 'nova@exemplo.com' };
    const SD = await logado();
    const antes = leiturasDePerfil();
    await SD.trocarEmail('nova@exemplo.com');
    // Quando
    await SD.contexto();
    // Então
    expect(leiturasDePerfil()).toBe(antes);
  });

  it('dado uma troca que já valeu, quando pede o contexto, então lê de novo', async () => {
    // Dado
    login.respostaDaTroca = { email: 'nova@exemplo.com' };
    const SD = await logado();
    const antes = leiturasDePerfil();
    await SD.trocarEmail('nova@exemplo.com');
    // Quando
    await SD.contexto();
    // Então
    expect(leiturasDePerfil()).toBeGreaterThan(antes);
  });
});

describe('Troca do e-mail de um colega no supabase.ts', () => {
  const PERFIL = '00000000-0000-0000-0000-000000000002';
  let pedidos: { url: string; init?: RequestInit }[];

  function responderCom(resposta: () => Response) {
    vi.resetModules();
    pedidos = [];
    vi.stubGlobal('fetch', async (entrada: string | URL, init?: RequestInit) => { pedidos.push({ url: String(entrada), init }); return resposta(); });
    return import('./supabase').then(m => m.SD);
  }
  afterEach(() => { vi.unstubAllGlobals(); });

  it('quando pede a troca, então manda a pessoa e o e-mail normalizado à função do servidor, com a sessão de quem está logado', async () => {
    // Dado
    const SD = await responderCom(() => Response.json({ resultado: 'trocado' }));
    // Quando
    await SD.equipeTrocarEmail(PERFIL, ' Nova@Exemplo.COM ');
    // Então
    const [pedido] = pedidos;
    expect(pedido.url).toContain('/functions/v1/equipe-trocar-email');
    expect(JSON.parse(String(pedido.init?.body))).toEqual({ perfil: PERFIL, email: 'nova@exemplo.com' });
    expect(new Headers(pedido.init?.headers).get('Authorization')).toBe('Bearer token');
  });

  it.each([
    ['sem-permissao', 'Você não pode trocar o e-mail de acesso desta pessoa.'],
    ['so-o-master', 'Esta pessoa alcança informações sigilosas: só o master pode trocar o e-mail de acesso dela.'],
    ['email-invalido', 'Informe um e-mail válido.'],
    ['email-em-uso', 'Este e-mail já é usado em outra conta do SEMPER.'],
    ['convite-pendente', 'Este e-mail já tem um convite pendente.'],
    ['erro', 'Não foi possível trocar o e-mail agora. Tente de novo.'],
    ['resposta-que-ninguem-conhece', 'Não foi possível trocar o e-mail agora. Tente de novo.']
  ])('dado que a função responde %s, quando pede a troca, então a tela recebe a mensagem certa', async (resultado, mensagem) => {
    // Dado
    const SD = await responderCom(() => Response.json({ resultado }));
    // Quando / Então
    await expect(SD.equipeTrocarEmail(PERFIL, 'nova@exemplo.com')).rejects.toThrow(mensagem);
  });

  it('dado que a função não responde em JSON, quando pede a troca, então a troca é dada como não feita', async () => {
    // Dado
    const SD = await responderCom(() => new Response('Bad gateway', { status: 502 }));
    // Quando / Então
    await expect(SD.equipeTrocarEmail(PERFIL, 'nova@exemplo.com')).rejects.toThrow('Não foi possível trocar o e-mail agora. Tente de novo.');
  });
});

describe('Sessão encerrada no supabase.ts', () => {
  it.each<[string, Error | null, boolean]>([
    ['diz que a sessão não existe', new AuthSessionMissingError(), true],
    ['não responde', new AuthRetryableFetchError('Failed to fetch', 0), false],
    ['confirma quem está logado', null, false]
  ])('quando o login %s, então sessaoEncerrada dá %s', async (_caso, erro, esperado) => {
    // Dado
    login.erroDoUsuario = erro;
    const { SD } = await import('./supabase');
    // Quando
    const encerrada = await SD.sessaoEncerrada();
    // Então
    expect(encerrada).toBe(esperado);
  });
});
