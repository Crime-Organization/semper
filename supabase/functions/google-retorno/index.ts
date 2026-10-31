// Volta do Google (#164): depois que a pessoa autoriza (ou recusa), o Google manda o navegador para cá com o "code" e o
// "estado". Esta função consome o pedido (uso único, até 10 minutos), troca o code pelo token de renovação, descobre
// o e-mail da conta, guarda a ligação (o token vai para o cofre do Supabase) e devolve a pessoa a Configurações com o
// resultado no endereço (?google=ligado). É aberta (sem login): quem garante é o estado, conferido no banco.
import { comResultado, ESCOPO_OBRIGATORIO, escoposDados, lerSitesPermitidos, sitePermitido } from '../_compartilhado/ligacao.ts';
import { pagina, redirecionar, rpc, segredo } from '../_compartilhado/servidor.ts';

const PEDIDO_VENCIDO = 'Este pedido de ligação venceu ou já foi usado. Volte ao SEMPER, em Configurações, e clique de novo em "Conectar conta Google".';

interface Pedido { escritorio_id: string; perfil_id: string | null; provedor: string; voltar_para: string | null; pedido_por: string }
interface Tokens { access_token?: string; refresh_token?: string; scope?: string }

Deno.serve(async req => {
  const url = new URL(req.url);
  const estado = url.searchParams.get('state') ?? '';
  if (!/^[0-9a-f]{64}$/.test(estado)) return pagina(PEDIDO_VENCIDO);
  let voltarPara: string;
  let pedido: Pedido;
  try {
    [pedido] = await rpc<Pedido[]>('ligacao_pedido_usar', { p_estado: estado });
    if (!pedido?.voltar_para || !sitePermitido(pedido.voltar_para, lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')))) return pagina(PEDIDO_VENCIDO);
    voltarPara = pedido.voltar_para;
  } catch (e) {
    console.error('google-retorno: pedido', (e as Error).message);
    return pagina('Não foi possível ligar a conta Google agora. Tente de novo em alguns minutos.', 500);
  }
  // A pessoa recusou na tela do Google (ou fechou): volta sem ligar nada.
  if (url.searchParams.get('error') || !url.searchParams.get('code')) return redirecionar(comResultado(voltarPara, 'recusado'));
  try {
    const resposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code')!,
        client_id: segredo('GOOGLE_CLIENT_ID'),
        client_secret: segredo('GOOGLE_CLIENT_SECRET'),
        redirect_uri: `${segredo('SUPABASE_URL')}/functions/v1/google-retorno`,
        grant_type: 'authorization_code'
      })
    });
    if (!resposta.ok) throw new Error(`o Google recusou a troca do code (${resposta.status})`);
    const tokens = await resposta.json() as Tokens;
    const escopos = escoposDados(tokens.scope);
    if (!escopos.includes(ESCOPO_OBRIGATORIO)) return redirecionar(comResultado(voltarPara, 'sem-permissao'));
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('o Google não mandou o token de renovação');
    const usuario = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const { email, email_verified } = await usuario.json() as { email?: string; email_verified?: boolean };
    if (!usuario.ok || !email || !email_verified) throw new Error('o Google não informou o e-mail da conta');
    await rpc('ligacao_guardar', {
      p_escritorio: pedido.escritorio_id, p_perfil: pedido.perfil_id, p_provedor: 'google', p_email: email,
      p_escopos: escopos, p_token: tokens.refresh_token, p_ligado_por: pedido.pedido_por
    });
    return redirecionar(comResultado(voltarPara, 'ligado'));
  } catch (e) {
    console.error('google-retorno', (e as Error).message);
    return redirecionar(comResultado(voltarPara, 'erro'));
  }
});
