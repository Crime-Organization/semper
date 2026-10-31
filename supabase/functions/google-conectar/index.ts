// Ida ao Google (#164): o administrador clicou em "Conectar conta Google" em Configurações. O SEMPER já criou um pedido
// de ligação (ligacao_google_iniciar) e mandou o navegador para cá com o "estado". Esta função confere o pedido e leva
// a pessoa para a tela de autorização do Google, com o desafio do PKCE do pedido. É aberta (sem login): só redireciona;
// quem conclui a ligação é a página de Configurações, logada com quem pediu (google-concluir).
import { FORMATO_ESTADO, lerSitesPermitidos, sitePermitido, urlDeAutorizacao } from '../_compartilhado/ligacao.ts';
import { pagina, redirecionar, rpc, segredo, voltaDoGoogle } from '../_compartilhado/servidor.ts';

const PEDIDO_VENCIDO = 'Este pedido de ligação venceu ou já foi usado. Volte ao SEMPER, em Configurações, e clique de novo em "Conectar conta Google".';

Deno.serve(async req => {
  try {
    const estado = new URL(req.url).searchParams.get('estado') ?? '';
    if (!FORMATO_ESTADO.test(estado)) return pagina(PEDIDO_VENCIDO);
    const [pedido] = await rpc<{ voltar_para: string; desafio: string }[]>('ligacao_pedido_conferir', { p_estado: estado });
    if (!pedido || !sitePermitido(pedido.voltar_para, lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')))) return pagina(PEDIDO_VENCIDO);
    return redirecionar(urlDeAutorizacao(segredo('GOOGLE_CLIENT_ID'), voltaDoGoogle(), estado, pedido.desafio));
  } catch (e) {
    console.error('google-conectar', (e as Error).message);
    return pagina('Não foi possível ligar a conta Google agora. Tente de novo em alguns minutos.', 500);
  }
});
