// Conclusão da ligação (#164): a página de Configurações, logada, manda o estado e o código que o Google devolveu ao
// navegador dela. Esta função confere quem está logado, consome o pedido só se essa pessoa é quem pediu e continua
// administradora ativa do escritório, com a verificação em duas etapas se ela a ativou (ligacao_pedido_consumir), troca o
// código pelo token de renovação com o verificador do PKCE, confere as permissões da finalidade do pedido (os contatos ao
// ligar a conta; a agenda ao somá-la, #166) e o e-mail da conta, e guarda a ligação (o token vai para o cofre). Se a
// ligação trocou de conta, as reuniões do Google Meet da conta antiga que ainda vão acontecer são canceladas (#437, com o
// token dela, ainda válido) e só então o token da conta antiga é revogado no Google. Somar a agenda vale só para a conta já
// ligada: com outra conta, nada muda e a autorização nova é revogada.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
import {
  cabecalhosCors, contaServe, escoposDados, FALTA_NA_AUTORIZACAO, FORMATO_ESTADO, lerSitesPermitidos, nivelDaSessao, RESULTADO_DO_PEDIDO,
  type FinalidadeDoPedido, type ResultadoLigacao
} from '../_compartilhado/ligacao.ts';
import { cancelarReunioesDaConta, type ReuniaoDaConta } from '../_compartilhado/reunioesGoogle.ts';
import { json, revogarNoGoogle, rpc, segredo, usuarioLogado, voltaDoGoogle } from '../_compartilhado/servidor.ts';

/** As reuniões do Meet da conta que saiu do escritório são canceladas no Google; a falha só fica no registro do servidor. */
async function cancelarAsDaContaAntiga(escritorio: string, conta: string, renovacao: string) {
  try {
    const r = await cancelarReunioesDaConta({
      buscar: fetch, clienteId: segredo('GOOGLE_CLIENT_ID'), clienteSegredo: segredo('GOOGLE_CLIENT_SECRET'),
      reunioes: () => rpc<ReuniaoDaConta[]>('agendas_google_reunioes_da_conta', { p_escritorio: escritorio, p_conta: conta }),
      esquecida: compromisso => rpc<void>('agendas_google_reuniao_cancelada', { p_escritorio: escritorio, p_compromisso: compromisso, p_conta: conta })
    }, renovacao);
    if (r.falhas) console.error('google-concluir: reuniões da conta antiga não canceladas', r.falhas);
  } catch (e) { console.error('google-concluir: reuniões da conta antiga', (e as Error).message); }
}

interface Pedido { escritorio_id: string; perfil_id: string | null; provedor: string; verificador: string; finalidade: FinalidadeDoPedido; conta_email: string | null }
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
    const [pedido] = await rpc<Pedido[]>('ligacao_pedido_consumir', { p_estado: estado, p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao) });
    if (!pedido) return responder('expirado');
    const finalidade: FinalidadeDoPedido = pedido.finalidade in FALTA_NA_AUTORIZACAO ? pedido.finalidade : 'contatos';
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
    const falta = FALTA_NA_AUTORIZACAO[finalidade](escopos);
    if (falta) return responder(falta);
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('o Google não mandou o token de renovação');
    const conta = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const { email, email_verified } = await conta.json() as { email?: string; email_verified?: boolean };
    if (!conta.ok || !email || !email_verified) throw new Error('o Google não informou o e-mail da conta');
    // Somar a agenda com outra conta: a conta do escritório fica como está, e a autorização da outra conta não é guardada.
    if (!contaServe(finalidade, email, pedido.conta_email)) { await revogarNoGoogle(tokens.refresh_token); return responder('outra-conta'); }
    const [antiga] = await rpc<Antiga[]>('ligacao_guardar', {
      p_escritorio: pedido.escritorio_id, p_perfil: pedido.perfil_id, p_provedor: 'google', p_email: email,
      p_escopos: escopos, p_token: tokens.refresh_token, p_ligado_por: usuario
    });
    // Só a conta que saiu: revogar o token antigo da mesma conta derrubaria também o novo (a autorização é a mesma).
    if (antiga?.token_antigo && antiga.email_antigo !== email.toLowerCase()) {
      if (pedido.perfil_id === null && antiga.email_antigo) await cancelarAsDaContaAntiga(pedido.escritorio_id, antiga.email_antigo, antiga.token_antigo);
      await revogarNoGoogle(antiga.token_antigo);
    }
    return responder(RESULTADO_DO_PEDIDO[finalidade], 200, { email: email.toLowerCase() });
  } catch (e) {
    console.error('google-concluir', (e as Error).message);
    return responder('erro', 500);
  }
});
