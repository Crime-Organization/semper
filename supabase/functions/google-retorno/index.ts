// Volta do Google (#164): depois que a pessoa autoriza (ou recusa), o Google manda o navegador para cá com o "code" e o
// "estado". Esta função NÃO liga nada: só devolve a pessoa à página de Configurações do pedido, levando o código. Lá, a
// página, logada com quem pediu, conclui a ligação (google-concluir). Assim, quem recebe o link de outra pessoa e
// autoriza no Google não liga a própria conta ao escritório dela: falta a sessão de quem pediu.
import { comCodigo, comResultado, FORMATO_ESTADO, lerSitesPermitidos, sitePermitido } from '../_compartilhado/ligacao.ts';
import { pagina, redirecionar, rpc } from '../_compartilhado/servidor.ts';

const PEDIDO_VENCIDO = 'Este pedido de ligação venceu ou já foi usado. Volte ao SEMPER, em Configurações, e clique de novo em "Conectar conta Google".';

Deno.serve(async req => {
  const url = new URL(req.url);
  const estado = url.searchParams.get('state') ?? '';
  if (!FORMATO_ESTADO.test(estado)) return pagina(PEDIDO_VENCIDO);
  try {
    const voltarPara = await rpc<string | null>('ligacao_pedido_volta', { p_estado: estado });
    if (!voltarPara || !sitePermitido(voltarPara, lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')))) return pagina(PEDIDO_VENCIDO);
    const codigo = url.searchParams.get('code');
    // A pessoa recusou na tela do Google (ou fechou): volta sem ligar nada.
    if (url.searchParams.get('error') || !codigo) return redirecionar(comResultado(voltarPara, 'recusado'));
    return redirecionar(comCodigo(voltarPara, estado, codigo));
  } catch (e) {
    console.error('google-retorno', (e as Error).message);
    return pagina('Não foi possível ligar a conta Google agora. Tente de novo em alguns minutos.', 500);
  }
});
