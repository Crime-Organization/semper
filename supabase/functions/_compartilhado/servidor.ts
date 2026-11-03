// Ajudas das funções do servidor (Deno): ler os segredos, chamar o banco e o login com a chave de serviço, e responder.
import { senhaDescartavel } from './trocaDeEmail.ts';

/** Um segredo do servidor (Edge Functions → Secrets no painel do Supabase); sem ele, a função para com um erro claro. */
export function segredo(nome: string) {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta o segredo ${nome} nas Edge Functions do Supabase.`);
  return v;
}

/**
 * O endereço público das funções. No Supabase é o próprio SUPABASE_URL; rodando localmente (supabase functions serve), o
 * SUPABASE_URL é um endereço interno, então o segredo URL_PUBLICA diz o endereço que o Google enxerga.
 */
export const urlPublica = () => (Deno.env.get('URL_PUBLICA') ?? segredo('SUPABASE_URL')).replace(/\/+$/, '');
/** Para onde o Google devolve a pessoa: precisa ser exatamente o endereço cadastrado no Google Cloud. */
export const voltaDoGoogle = () => `${urlPublica()}/functions/v1/google-retorno`;

/** Cabeçalhos com a chave de serviço (injetada pelo Supabase em toda função; nunca vai para o navegador). */
function comChaveDeServico(): Record<string, string> {
  const chave = segredo('SUPABASE_SERVICE_ROLE_KEY');
  const cabecalhos: Record<string, string> = { apikey: chave, 'Content-Type': 'application/json' };
  // A chave antiga é um JWT e vai também no Authorization; a chave nova (sb_secret_…) vai só no apikey.
  if (chave.split('.').length === 3) cabecalhos.Authorization = `Bearer ${chave}`;
  return cabecalhos;
}

/** Chama uma função do banco com a chave de serviço. Função sem retorno (void) responde sem corpo: devolve undefined. */
export async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${segredo('SUPABASE_URL')}/rest/v1/rpc/${nome}`, { method: 'POST', headers: comChaveDeServico(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`O banco recusou ${nome} (${r.status}).`);
  const texto = await r.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

/** Quem está logado no SEMPER, pelo token da sessão que o navegador mandou (o login do Supabase confere o token). */
export async function usuarioLogado(autorizacao: string | null): Promise<string | null> {
  if (!autorizacao?.startsWith('Bearer ')) return null;
  const r = await fetch(`${segredo('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: segredo('SUPABASE_SERVICE_ROLE_KEY'), Authorization: autorizacao } });
  if (!r.ok) return null;
  const { id } = await r.json() as { id?: string };
  return id ?? null;
}

/**
 * Troca o e-mail de acesso no login, sem pedir confirmação por link (quem chama já conferiu a permissão), e tira a senha antiga
 * de uso no mesmo passo. Um "não" do login (4xx) diz que nada mudou; outro erro não dá certeza, então lança.
 */
export async function trocarEmailNoLogin(perfil: string, email: string): Promise<'trocado' | 'email-em-uso' | 'recusado'> {
  const r = await fetch(`${segredo('SUPABASE_URL')}/auth/v1/admin/users/${perfil}`, {
    method: 'PUT', headers: comChaveDeServico(), body: JSON.stringify({ email, email_confirm: true, password: senhaDescartavel() })
  });
  if (r.ok) return 'trocado';
  if (r.status >= 500) throw new Error(`o login não respondeu à troca do e-mail (${r.status})`);
  const { error_code } = await r.json().catch(() => ({})) as { error_code?: string };
  return error_code === 'email_exists' ? 'email-em-uso' : 'recusado';
}

/** Revoga um token no Google(a conta que saiu do SEMPER deixa de valer lá também). Se o Google não responder, segue. */
export async function revogarNoGoogle(token: string) {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token })
    });
  } catch (e) { console.error('revogar no Google', (e as Error).message); }
}

/** Redireciona o navegador. */
export const redirecionar = (para: string) => new Response(null, { status: 302, headers: { Location: para, 'Cache-Control': 'no-store' } });

/** Uma página curta em texto fixo, para quando não há para onde voltar (pedido vencido ou endereço estranho). */
export const pagina = (texto: string, status = 400) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>SEMPER</title><p style="font-family:system-ui;margin:2rem">${texto}</p>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

/** Resposta em JSON (para a função chamada pelo navegador). */
export const json = (dados: unknown, status = 200, extras: Record<string, string> = {}) =>
  new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extras } });
