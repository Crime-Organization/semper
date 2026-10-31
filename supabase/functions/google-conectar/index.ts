// Ida ao Google (#164): o administrador clicou em "Conectar conta Google" em Configurações. O SEMPER já criou um pedido
// de ligação (ligacao_google_iniciar) e mandou o navegador para cá com o "estado". Esta função confere o pedido e leva
// a pessoa para a tela de autorização do Google. É aberta (sem login): o estado, longo e de uso único, é a prova.
import { lerSitesPermitidos, sitePermitido, urlDeAutorizacao } from '../_compartilhado/ligacao.ts';
import { pagina, redirecionar, rpc, segredo } from '../_compartilhado/servidor.ts';

const PEDIDO_VENCIDO = 'Este pedido de ligação venceu ou já foi usado. Volte ao SEMPER, em Configurações, e clique de novo em "Conectar conta Google".';

Deno.serve(async req => {
  try {
    const estado = new URL(req.url).searchParams.get('estado') ?? '';
    if (!/^[0-9a-f]{64}$/.test(estado)) return pagina(PEDIDO_VENCIDO);
    const voltarPara = await rpc<string | null>('ligacao_pedido_conferir', { p_estado: estado });
    if (!sitePermitido(voltarPara, lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')))) return pagina(PEDIDO_VENCIDO);
    const voltaDoGoogle = `${segredo('SUPABASE_URL')}/functions/v1/google-retorno`;
    return redirecionar(urlDeAutorizacao(segredo('GOOGLE_CLIENT_ID'), voltaDoGoogle, estado));
  } catch (e) {
    console.error('google-conectar', (e as Error).message);
    return pagina('Não foi possível ligar a conta Google agora. Tente de novo em alguns minutos.', 500);
  }
});
