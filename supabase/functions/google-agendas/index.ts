// As agendas do escritório no Google Agenda (#166). Esvazia a fila (public.agendas_google_fila): para cada escritório com as
// agendas ligadas, cria as agendas que faltam (de cada pessoa ativa da equipe, a Geral, uma por sala ativa e a
// Administrativo), compartilha só para ver com o e-mail do Google de cada um e retira o compartilhamento de quem saiu; e
// leva às agendas os eventos de cada item que mudou (compromissos, prazos de tarefas e demandas, dias sem expediente e
// parcelas a receber), um pedido por item; no compromisso com "Criar link do Google Meet" (#437), também a reunião, criada
// pela conta do escritório, com os convites (_compartilhado/reunioesGoogle.ts).
// As regras ficam em _compartilhado/agendasGoogle.ts e _compartilhado/eventosGoogle.ts; os pedidos ao Google, em
// _compartilhado/apiDaAgenda.ts.
// Quem chama:
//   - a rotina do banco, a cada 2 minutos, quando há algo na fila (privado.chamar_sincronizacao_das_agendas), com a senha
//     da rotina (o segredo SENHA_DA_ROTINA aqui, e o mesmo valor no Vault): todos os escritórios;
//   - o administrador, em Configurações ("Sincronizar agora", nas Agendas no Google), logado: só o escritório dele.
// O login é conferido aqui mesmo (verify_jwt = false no config.toml), para responder também ao pedido prévio do CORS.
// Os tokens do Google ficam só aqui no servidor: o de renovação vem do cofre, o de acesso dura a execução.
import { senhaDaRotinaConfere } from '../_compartilhado/avisoDaTroca.ts';
import { sincronizarAgendas, type EstadoDasAgendas, type PassosDasAgendas, type PedidoDaFila } from '../_compartilhado/agendasGoogle.ts';
import type { ItemDaFila } from '../_compartilhado/eventosGoogle.ts';
import { cabecalhosCors, lerSitesPermitidos, nivelDaSessao } from '../_compartilhado/ligacao.ts';
import { json, rpc, segredo, usuarioLogado } from '../_compartilhado/servidor.ts';

const passos = (): PassosDasAgendas => ({
  pendentes: (escritorio, limite) => rpc<PedidoDaFila[]>('agendas_google_pendentes', { p_escritorio: escritorio, p_limite: limite }),
  estado: escritorio => rpc<EstadoDasAgendas>('agendas_google_estado', { p_escritorio: escritorio }),
  agendaCriada: (p, a, googleId) => rpc<string>('agendas_google_agenda_criada', {
    p_escritorio: p.escritorio_id, p_conta: p.conta_email, p_tipo: a.tipo, p_perfil: a.perfil_id, p_sala: a.sala_id, p_google: googleId, p_nome: a.nome
  }),
  agendaRenomeada: (agenda, nome) => rpc<void>('agendas_google_agenda_renomeada', { p_agenda: agenda, p_nome: nome }),
  agendaSumiu: agenda => rpc<void>('agendas_google_agenda_sumiu', { p_agenda: agenda }),
  compartilhada: (agenda, leitor, regra) => rpc<void>('agendas_google_compartilhada', { p_agenda: agenda, p_email: leitor.email, p_perfil: leitor.perfil_id, p_regra: regra }),
  compartilhamentoRecusado: (agenda, leitor, detalhe) => rpc<void>('agendas_google_compartilhamento_recusado', {
    p_agenda: agenda, p_email: leitor.email, p_perfil: leitor.perfil_id, p_detalhe: detalhe
  }),
  retirada: (agenda, email) => rpc<void>('agendas_google_retirada', { p_agenda: agenda, p_email: email }),
  concluir: (p, restam) => rpc<void>('agendas_google_concluir', { p_pedido: p.id, p_versao: p.versao, p_restam: restam }),
  falhou: (p, falha, detalhe, espera) => rpc<void>('agendas_google_falhou', { p_pedido: p.id, p_erro: falha, p_detalhe: detalhe, p_espera: espera }),
  item: p => rpc<ItemDaFila>('agendas_google_item', { p_escritorio: p.escritorio_id, p_assunto: p.assunto, p_item: p.item_id }),
  eventoGravado: (p, agenda, evento, assinatura) => rpc<void>('agendas_google_evento_gravado', {
    p_agenda: agenda, p_assunto: p.assunto, p_item: p.item_id, p_evento: evento, p_assinatura: assinatura
  }),
  eventoApagado: (agenda, evento) => rpc<void>('agendas_google_evento_apagado', { p_agenda: agenda, p_evento: evento }),
  // A reunião do Google Meet do compromisso (#437).
  reuniaoGravada: (p, r) => rpc<void>('agendas_google_reuniao_gravada', {
    p_escritorio: p.escritorio_id, p_compromisso: p.item_id, p_conta: p.conta_email, p_evento: r.evento_id, p_link: r.link, p_espaco: r.espaco,
    p_gravacao: r.gravacao, p_gravacao_detalhe: r.gravacao_detalhe, p_assinatura: r.assinatura
  }),
  reuniaoCancelada: p => rpc<void>('agendas_google_reuniao_cancelada', { p_escritorio: p.escritorio_id, p_compromisso: p.item_id, p_conta: p.conta_email }),
  tokenDeRenovacao: escritorio => rpc<string | null>('ligacao_token', { p_escritorio: escritorio, p_perfil: null, p_provedor: 'google' }),
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
      // Só administrador, com as agendas ligadas e autorizadas; o escritório dele vai para a fila, liberado para já.
      escritorio = await rpc<string | null>('agendas_google_agora', { p_usuario: usuario, p_nivel: nivelDaSessao(autorizacao) });
      if (!escritorio) return json({ resultado: 'desligada' }, 200, cors);
    }
    return json({ resultado: 'ok', ...await sincronizarAgendas(passos(), escritorio) }, 200, cors);
  } catch (e) {
    console.error('google-agendas', (e as Error).message);
    return json({ resultado: 'erro' }, 500, cors);
  }
});
