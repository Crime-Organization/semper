// Sincronização das pessoas com o Google Contatos (#164). Esvazia a fila (public.contatos_google_fila): cria ou atualiza
// cada contato na conta Google do escritório da pessoa (as regras ficam em _compartilhado/contatosGoogle.ts).
// Quem chama:
//   - a rotina do banco, a cada 2 minutos, quando há alguém na fila (privado.chamar_sincronizacao_de_contatos), com a
//     senha da rotina (o segredo SENHA_DA_ROTINA aqui, e o mesmo valor no Vault): todos os escritórios;
//   - o administrador, em Configurações ("Sincronizar agora"), logado: só o escritório dele, com as esperas zeradas.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
// Os tokens do Google ficam só aqui no servidor: o de renovação vem do cofre, o de acesso dura a execução.
import { senhaDaRotinaConfere } from '../_compartilhado/avisoDaTroca.ts';
import { sincronizarContatos, type PassosDaSincronizacao, type PessoaNaFila } from '../_compartilhado/contatosGoogle.ts';
import { cabecalhosCors, lerSitesPermitidos, nivelDaSessao } from '../_compartilhado/ligacao.ts';
import { json, rpc, segredo, usuarioLogado } from '../_compartilhado/servidor.ts';

const passos = (): PassosDaSincronizacao => ({
  pendentes: (escritorio, limite) => rpc<PessoaNaFila[]>('contatos_google_pendentes', { p_escritorio: escritorio, p_limite: limite }),
  tokenDeRenovacao: escritorio => rpc<string | null>('ligacao_token', { p_escritorio: escritorio, p_perfil: null, p_provedor: 'google' }),
  concluir: (p, recurso, etag) => rpc<void>('contatos_google_concluir', {
    p_pessoa: p.pessoa_id, p_versao: p.versao, p_conta: p.conta_email, p_recurso: recurso, p_etag: etag
  }),
  falhou: (p, falha, detalhe, espera) => rpc<void>('contatos_google_falhou', { p_pessoa: p.pessoa_id, p_erro: falha, p_detalhe: detalhe, p_espera: espera }),
  buscar: fetch,
  clienteId: segredo('GOOGLE_CLIENT_ID'),
  clienteSegredo: segredo('GOOGLE_CLIENT_SECRET')
});

Deno.serve(async req => {
  const cors = cabecalhosCors(req.headers.get('Origin'), lerSitesPermitidos(Deno.env.get('SITES_PERMITIDOS')));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ resultado: 'erro' }, 405, cors);
  try {
    let escritorio: string | null = null;
    if (!senhaDaRotinaConfere(req.headers.get('x-senha-da-rotina'), Deno.env.get('SENHA_DA_ROTINA'))) {
      const autorizacao = req.headers.get('Authorization');
      const usuario = await usuarioLogado(autorizacao);
      if (!usuario) return json({ resultado: 'sem-permissao' }, 401, cors);
      // Só administrador, com a sincronização ligada; a fila do escritório dele fica liberada para já.
      escritorio = await rpc<string | null>('contatos_google_agora', { p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao) });
      if (!escritorio) return json({ resultado: 'desligada' }, 200, cors);
    }
    return json({ resultado: 'ok', ...await sincronizarContatos(passos(), escritorio) }, 200, cors);
  } catch (e) {
    console.error('google-sincronizar', (e as Error).message);
    return json({ resultado: 'erro' }, 500, cors);
  }
});
