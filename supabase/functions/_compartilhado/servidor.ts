// Ajudas das funções do servidor (Deno): ler os segredos, chamar funções do banco com a chave de serviço e responder.

/** Um segredo do servidor (Edge Functions → Secrets no painel do Supabase); sem ele, a função para com um erro claro. */
export function segredo(nome: string) {
  const v = Deno.env.get(nome);
  if (!v) throw new Error(`Falta o segredo ${nome} nas Edge Functions do Supabase.`);
  return v;
}

/** Chama uma função do banco com a chave de serviço (só as funções do servidor têm essa chave). */
export async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? segredo('SUPABASE_SECRET_KEY');
  const cabecalhos: Record<string, string> = { apikey: chave, 'Content-Type': 'application/json' };
  // A chave antiga (service_role) é um JWT e vai também no Authorization; a chave nova (sb_secret_…) vai só no apikey.
  if (chave.split('.').length === 3) cabecalhos.Authorization = `Bearer ${chave}`;
  const r = await fetch(`${segredo('SUPABASE_URL')}/rest/v1/rpc/${nome}`, { method: 'POST', headers: cabecalhos, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`O banco recusou ${nome} (${r.status}).`);
  return await r.json() as T;
}

/** Redireciona o navegador. */
export const redirecionar = (para: string) => new Response(null, { status: 302, headers: { Location: para, 'Cache-Control': 'no-store' } });

/** Uma página curta em texto, para quando não há para onde voltar (pedido vencido ou endereço estranho). */
export const pagina = (texto: string, status = 400) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>SEMPER</title><p style="font-family:system-ui;margin:2rem">${texto}</p>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
