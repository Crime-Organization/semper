// Conta reservada (#215): o administrador cadastra na equipe alguém que não entra no sistema, para constar como responsável ou
// participante de contratos. A página de Equipe, logada, manda a pessoa. Esta função confere quem está logado; o banco decide se
// pode (equipe_reserva_preparar); só então o login cria a conta bloqueada, com a chave de serviço, que nunca vai ao navegador.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
import { cabecalhosCors, lerSitesPermitidos, nivelDaSessao } from '../_compartilhado/ligacao.ts';
import { conferirPedidoDaReserva, reservarConta, type PreparoDaReserva, type ResultadoDaReserva } from '../_compartilhado/reservaDeConta.ts';
import { criarContaReservadaNoLogin, json, rpc, usuarioLogado } from '../_compartilhado/servidor.ts';

Deno.serve(async req => {
  const cors = cabecalhosCors(req.headers.get('Origin'), lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')));
  const responder = (resultado: ResultadoDaReserva, status = 200) => json({ resultado }, status, cors);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return responder('erro', 405);
  try {
    const autorizacao = req.headers.get('Authorization');
    const usuario = await usuarioLogado(autorizacao);
    if (!usuario) return responder('sem-permissao', 401);
    const pedido = conferirPedidoDaReserva(await req.json().catch(() => null));
    if (!pedido) return responder('sem-permissao', 400);
    const resultado = await reservarConta(pedido, {
      preparar: async pessoa => (await rpc<PreparoDaReserva[]>('equipe_reserva_preparar', {
        p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao), p_pessoa: pessoa
      }))[0],
      criarNoLogin: criarContaReservadaNoLogin,
      concluir: email => rpc<void>('equipe_reserva_concluir', { p_usuario: usuario, p_email: email }),
      desistir: email => rpc<void>('equipe_reserva_desistir', { p_usuario: usuario, p_email: email })
    });
    return responder(resultado);
  } catch (e) {
    console.error('equipe-reservar-conta', (e as Error).message);
    return responder('erro', 500);
  }
});
