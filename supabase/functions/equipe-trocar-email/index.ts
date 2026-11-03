// Troca de e-mail pelo administrador (#222), para quem perdeu o e-mail antigo e não consegue confirmar a troca sozinho. A página
// de Equipe, logada, manda a pessoa e o e-mail novo. Esta função confere quem está logado; o banco decide se pode e registra
// a ação (equipe_email_preparar); só então o login troca o e-mail, com a chave de serviço, que nunca vai ao navegador. Depois,
// o aviso por e-mail sai para quem precisa saber (#224); se ele falhar, a troca continua valendo e o registro de ações mostra.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
import { avisarDaTroca } from '../_compartilhado/avisoDaTroca.ts';
import { PASSOS_DO_AVISO } from '../_compartilhado/avisoNoServidor.ts';
import { cabecalhosCors, lerSitesPermitidos, nivelDaSessao } from '../_compartilhado/ligacao.ts';
import { json, rpc, trocarEmailNoLogin, usuarioLogado } from '../_compartilhado/servidor.ts';
import { conferirPedido, trocarEmailDaEquipe, type Preparo, type ResultadoDaTroca } from '../_compartilhado/trocaDeEmail.ts';

Deno.serve(async req => {
  const cors = cabecalhosCors(req.headers.get('Origin'), lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')));
  const responder = (resultado: ResultadoDaTroca, status = 200) => json({ resultado }, status, cors);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return responder('erro', 405);
  try {
    const autorizacao = req.headers.get('Authorization');
    const usuario = await usuarioLogado(autorizacao);
    if (!usuario) return responder('sem-permissao', 401);
    const pedido = conferirPedido(await req.json().catch(() => null));
    if (!pedido) return responder('email-invalido', 400);
    const resultado = await trocarEmailDaEquipe(pedido, {
      preparar: async (perfil, email) => (await rpc<Preparo[]>('equipe_email_preparar', {
        p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao), p_perfil: perfil, p_email: email
      }))[0],
      trocarNoLogin: trocarEmailNoLogin,
      marcarFalha: registro => rpc<void>('equipe_email_falhou', { p_registro: registro }),
      avisar: (registro, situacao) => avisarDaTroca(registro, situacao, PASSOS_DO_AVISO)
    });
    return responder(resultado);
  } catch (e) {
    console.error('equipe-trocar-email', (e as Error).message);
    return responder('erro', 500);
  }
});
