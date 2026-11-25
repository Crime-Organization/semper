// Ida ao Google (#164): o administrador clicou em "Conectar conta Google" (ou, #166, em "Autorizar a agenda") em
// Configurações. O SEMPER já criou um pedido de ligação (ligacao_google_iniciar ou ligacao_google_iniciar_agendas) e mandou
// o navegador para cá com o "estado". Esta função confere o pedido e leva a pessoa para a tela de autorização do Google,
// com o desafio do PKCE e as permissões da finalidade do pedido (os contatos, ou a agenda somada à conta já ligada, que o
// Google já abre). É aberta (sem login): só redireciona; quem conclui a ligação é a página de Configurações, logada com
// quem pediu (google-concluir).
import { ESCOPOS_DO_PEDIDO, FORMATO_ESTADO, lerSitesPermitidos, sitePermitido, urlDeAutorizacao, type FinalidadeDoPedido } from '../_compartilhado/ligacao.ts';
import { pagina, redirecionar, rpc, segredo, voltaDoGoogle } from '../_compartilhado/servidor.ts';

const PEDIDO_VENCIDO = 'Este pedido de ligação venceu ou já foi usado. Volte ao SEMPER, em Configurações, e clique de novo em "Conectar conta Google".';

interface Pedido { voltar_para: string; desafio: string; finalidade: FinalidadeDoPedido; conta_email: string | null }

Deno.serve(async req => {
  try {
    const estado = new URL(req.url).searchParams.get('estado') ?? '';
    if (!FORMATO_ESTADO.test(estado)) return pagina(PEDIDO_VENCIDO);
    const [pedido] = await rpc<Pedido[]>('ligacao_pedido_conferir_finalidade', { p_estado: estado });
    if (!pedido || !sitePermitido(pedido.voltar_para, lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')))) return pagina(PEDIDO_VENCIDO);
    const escopos = ESCOPOS_DO_PEDIDO[pedido.finalidade] ?? ESCOPOS_DO_PEDIDO.contatos;
    // A conta só vem no pedido da agenda (o banco não a manda ao ligar a conta, que pode ser outra).
    return redirecionar(urlDeAutorizacao(segredo('GOOGLE_CLIENT_ID'), voltaDoGoogle(), estado, pedido.desafio, escopos, pedido.conta_email));
  } catch (e) {
    console.error('google-conectar', (e as Error).message);
    return pagina('Não foi possível ligar a conta Google agora. Tente de novo em alguns minutos.', 500);
  }
});
