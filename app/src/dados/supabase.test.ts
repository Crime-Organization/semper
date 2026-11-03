// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício não guarda quem está logado como o supabase.ts guarda: isto só se prova aqui, com o login simulado e sem rede.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '00000000-0000-0000-0000-000000000001';
const login = vi.hoisted(() => ({ respostaDaTroca: {} as { email: string; new_email?: string } }));

vi.mock('@supabase/auth-js', () => ({
  AuthClient: class {
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
