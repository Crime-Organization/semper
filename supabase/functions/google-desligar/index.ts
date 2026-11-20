// Desligar a conta Google do escritório (#164), em Configurações. Esta função confere quem está logado; o banco confere se
// é administrador ativo (com a verificação em duas etapas, se a ativou), apaga a ligação, esvazia a fila dos contatos e
// devolve o token de renovação, lido antes de sair do cofre (ligacao_google_desligar_servidor). Então o token é revogado
// no Google: a conta deixa de valer também lá. Se o Google não responder, a conta continua desligada no SEMPER.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
import { cabecalhosCors, lerSitesPermitidos, nivelDaSessao } from '../_compartilhado/ligacao.ts';
import { json, revogarNoGoogle, rpc, usuarioLogado } from '../_compartilhado/servidor.ts';

Deno.serve(async req => {
  const cors = cabecalhosCors(req.headers.get('Origin'), lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ resultado: 'erro' }, 405, cors);
  try {
    const autorizacao = req.headers.get('Authorization');
    const usuario = await usuarioLogado(autorizacao);
    if (!usuario) return json({ resultado: 'sem-permissao' }, 401, cors);
    const [r] = await rpc<{ resultado: string; token: string | null }[]>('ligacao_google_desligar_servidor', {
      p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao)
    });
    if (r?.token) await revogarNoGoogle(r.token);
    return json({ resultado: r?.resultado ?? 'erro' }, 200, cors);
  } catch (e) {
    console.error('google-desligar', (e as Error).message);
    return json({ resultado: 'erro' }, 500, cors);
  }
});
