// Conclusão da ligação (#164): a página de Configurações, logada, manda o estado e o código que o Google devolveu ao
// navegador dela. Esta função confere quem está logado, consome o pedido só se essa pessoa é quem pediu e continua
// administradora ativa do escritório, com a verificação em duas etapas se ela a ativou (ligacao_pedido_usar), troca o
// código pelo token de renovação com o verificador do PKCE, confere a permissão dos contatos e o e-mail da conta, e guarda
// a ligação (o token vai para o cofre). Se a ligação trocou de conta, o token da conta antiga é revogado no Google.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
import { cabecalhosCors, ESCOPO_OBRIGATORIO, escoposDados, FORMATO_ESTADO, lerSitesPermitidos, nivelDaSessao, type ResultadoLigacao } from '../_compartilhado/ligacao.ts';
import { json, revogarNoGoogle, rpc, segredo, usuarioLogado, voltaDoGoogle } from '../_compartilhado/servidor.ts';

interface Pedido { escritorio_id: string; perfil_id: string | null; provedor: string; verificador: string }
interface Tokens { access_token?: string; refresh_token?: string; scope?: string }
interface Antiga { email_antigo: string | null; token_antigo: string | null }

Deno.serve(async req => {
  const cors = cabecalhosCors(req.headers.get('Origin'), lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')));
  const responder = (resultado: ResultadoLigacao, status = 200, extra: Record<string, unknown> = {}) => json({ resultado, ...extra }, status, cors);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return responder('erro', 405);
  try {
    const autorizacao = req.headers.get('Authorization');
    const usuario = await usuarioLogado(autorizacao);
    if (!usuario) return responder('erro', 401);
    const { estado, codigo } = await req.json() as { estado?: unknown; codigo?: unknown };
    if (typeof estado !== 'string' || !FORMATO_ESTADO.test(estado) || typeof codigo !== 'string' || !codigo || codigo.length > 2000) {
      return responder('expirado', 400);
    }
    const [pedido] = await rpc<Pedido[]>('ligacao_pedido_usar', { p_estado: estado, p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao) });
    if (!pedido) return responder('expirado');
    const resposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: codigo,
        client_id: segredo('GOOGLE_CLIENT_ID'),
        client_secret: segredo('GOOGLE_CLIENT_SECRET'),
        redirect_uri: voltaDoGoogle(),
        code_verifier: pedido.verificador,
        grant_type: 'authorization_code'
      })
    });
    if (!resposta.ok) throw new Error(`o Google recusou a troca do código (${resposta.status})`);
    const tokens = await resposta.json() as Tokens;
    const escopos = escoposDados(tokens.scope);
    if (!escopos.includes(ESCOPO_OBRIGATORIO)) return responder('sem-permissao');
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('o Google não mandou o token de renovação');
    const conta = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const { email, email_verified } = await conta.json() as { email?: string; email_verified?: boolean };
    if (!conta.ok || !email || !email_verified) throw new Error('o Google não informou o e-mail da conta');
    const [antiga] = await rpc<Antiga[]>('ligacao_guardar', {
      p_escritorio: pedido.escritorio_id, p_perfil: pedido.perfil_id, p_provedor: 'google', p_email: email,
      p_escopos: escopos, p_token: tokens.refresh_token, p_ligado_por: usuario
    });
    // Só a conta que saiu: revogar o token antigo da mesma conta derrubaria também o novo (a autorização é a mesma).
    if (antiga?.token_antigo && antiga.email_antigo !== email.toLowerCase()) await revogarNoGoogle(antiga.token_antigo);
    return responder('ligado', 200, { email: email.toLowerCase() });
  } catch (e) {
    console.error('google-concluir', (e as Error).message);
    return responder('erro', 500);
  }
});
