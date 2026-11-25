// A reunião do Google Meet do compromisso (#437), levada pela função do servidor google-agendas junto com as cópias do
// compromisso nas agendas (agendasGoogle.ts). Combinado com o dono (25/11/2026):
//   - só quando marcam "Criar link do Google Meet" no compromisso (não é automático);
//   - a reunião é criada pela conta Google do escritório (a organizadora: a conta paga, que grava e transcreve), na agenda
//     principal dela; o convite vai pelo e-mail do escritório (sendUpdates) para a equipe do compromisso (o e-mail do Google
//     de cada um) e para as pessoas ligadas que têm e-mail. Cada um entra com a conta que quiser;
//   - mudou a data, a hora, o título ou os convidados: o mesmo link, e o convite é atualizado; arquivado, cancelado (coluna
//     "Cancelado"), excluído ou com a opção desmarcada: a reunião é cancelada (cada convidado recebe o cancelamento);
//   - a gravação e a transcrição automáticas são ligadas pela Meet REST API (Space.config.artifactConfig), que só o
//     organizador muda. Se o Google recusar (a edição do Workspace não grava, ou o administrador do Workspace desligou),
//     a reunião fica sem elas, e quem grava é a conta do escritório, na própria reunião;
//   - o link fica guardado (agenda_google_reunioes), aparece no cartão do compromisso e vai na descrição das cópias.
// O que fazer é decidido por funções puras (reuniaoDesejada, planejarReuniao, linkDaResposta); os pedidos ao Google ficam
// no adaptador (apiDaAgenda.ts). Sem Deno: testado no app (app/src/regras/reunioesGoogle.test.ts).
import { emailParaCompartilhar, FalhaDaAgenda, TAMANHO_DO_DETALHE, type ApiDaAgenda, type EventoDaReuniao, type RespostaDaReuniao } from './apiDaAgenda.ts';
import type { PedidoDaFila } from './agendasGoogle.ts';
import { assinaturaDoEvento, corpoParaMudar, MARCA_DO_ESCRITORIO, MARCA_DO_ITEM, quandoDoCompromissoNaAgenda, type CompromissoNaAgenda } from './eventosGoogle.ts';

/** Como ficou a gravação e a transcrição automáticas: ligadas, ou recusadas pelo Google (quem grava é a conta do escritório). */
export type GravacaoDaReuniao = 'ligada' | 'recusada';
/** A reunião já criada no Google, como o banco a guarda (public.agenda_google_reunioes). */
export interface ReuniaoGuardada {
  /** O id do evento na agenda principal da conta (idDaReuniao). */
  evento_id: string;
  /** O link do Meet; null enquanto o Google ainda o cria. */
  link: string | null;
  /** O nome do espaço do Meet ("spaces/…"), depois de ligar a gravação. */
  espaco: string | null;
  gravacao: GravacaoDaReuniao | null;
  /** O que o Google respondeu ao recusar a gravação. */
  gravacao_detalhe: string | null;
  /** O conteúdo do convite gravado, resumido: mudou o compromisso, muda a assinatura e o convite é atualizado. */
  assinatura: string | null;
}
/** A reunião como deve estar no Google (sem o pedido do link, que só vai ao criar) e a assinatura dela. */
export interface ReuniaoDesejada { evento: EventoDaReuniao & { id: string }; assinatura: string }

/** O id do evento da reunião, escolhido pelo SEMPER (como idDoEvento: "r" e o uuid do compromisso, só com o que o Google aceita). */
export const idDaReuniao = (compromissoId: string) => 'r' + compromissoId.toLowerCase().replace(/[^0-9a-f]/g, '');
/** A descrição do convite: quem recebe pode ser cliente, então nada da ficha (nem o link do SEMPER, que só a equipe abre). */
export const DESCRICAO_DA_REUNIAO = 'Reunião marcada pelo escritório. Para entrar, use o link do Google Meet deste convite, com a conta Google que preferir.';

const limpo = (t: string | null | undefined) => (t ?? '').trim();
/**
 * Os convidados: sem repetir (maiúsculas não contam), sem a própria conta do escritório (a organizadora), em ordem. O e-mail
 * torto (de uma pessoa importada, por exemplo) fica de fora: o Google recusaria a reunião inteira por causa dele.
 */
export function convidadosDaReuniao(emails: readonly (string | null | undefined)[], contaDoEscritorio: string) {
  return [...new Set(emails.map(e => emailParaCompartilhar(e, contaDoEscritorio)).filter((e): e is string => !!e))].sort();
}

/**
 * A reunião que o compromisso deve ter no Google, ou null quando não deve ter nenhuma: sem a opção marcada, arquivado,
 * cancelado ou excluído (null).
 */
export function reuniaoDesejada(c: CompromissoNaAgenda | null, escritorioId: string, contaDoEscritorio: string): ReuniaoDesejada | null {
  if (!c?.reuniao || c.arquivado || c.cancelado) return null;
  const local = limpo(c.local) || limpo(c.sala_nome);
  const evento: EventoDaReuniao & { id: string } = {
    id: idDaReuniao(c.id),
    summary: limpo(c.titulo),
    ...quandoDoCompromissoNaAgenda(c),
    ...(local ? { location: local } : {}),
    description: DESCRICAO_DA_REUNIAO,
    status: 'confirmed',
    attendees: convidadosDaReuniao(c.convidados ?? [], contaDoEscritorio).map(email => ({ email })),
    extendedProperties: { private: { [MARCA_DO_ITEM]: `reuniao:${c.id}`, [MARCA_DO_ESCRITORIO]: escritorioId } }
  };
  return { evento, assinatura: assinaturaDoEvento(evento) };
}

/** O pedido do link do Meet, com um id novo a cada pedido (o Google pede um novo a cada vez). */
export const pedidoDoLink = (requestId: string): NonNullable<EventoDaReuniao['conferenceData']> =>
  ({ createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } });

/** O que a resposta do Google diz do link: pronto (com o link), ainda sendo criado, ou o Google não conseguiu criar. */
export type LinkDaReuniao = { estado: 'pronto'; link: string } | { estado: 'esperando' } | { estado: 'falhou' };
/** O tipo do ponto de entrada da reunião por vídeo (o link do Meet), na resposta do Google. */
const PONTO_DE_VIDEO = 'video';
/** O estado do pedido do link que ainda não terminou. */
const AINDA_CRIANDO = 'pending';
export function linkDaResposta(r: RespostaDaReuniao | null | undefined): LinkDaReuniao {
  const video = r?.conferenceData?.entryPoints?.find(p => p.entryPointType === PONTO_DE_VIDEO)?.uri || r?.hangoutLink;
  if (video) return { estado: 'pronto', link: video };
  return r?.conferenceData?.createRequest?.status?.statusCode === AINDA_CRIANDO ? { estado: 'esperando' } : { estado: 'falhou' };
}

/** O código da reunião no link do Meet ("https://meet.google.com/abc-mnop-xyz" → "abc-mnop-xyz"), ou null. */
export function codigoDoMeet(link: string | null | undefined) {
  const m = /^https:\/\/meet\.google\.com\/([a-z0-9-]+)\/?(?:\?.*)?$/i.exec(limpo(link));
  return m ? m[1] : null;
}

export type AcaoNaReuniao = 'cancelar' | 'criar' | 'conferir' | 'mudar' | 'gravar';
/**
 * O próximo passo para a reunião ficar como deve, ou null: nada a fazer. Sem as permissões do Meet na conta, nada (a reunião
 * nem se cria, nem se cancela). Primeiro cancela a que não deve mais existir; cria a que falta; confere o link que ainda
 * estava sendo criado; atualiza o convite que mudou; e, por último, liga a gravação e a transcrição.
 */
export function planejarReuniao(desejada: ReuniaoDesejada | null, guardada: ReuniaoGuardada | null, meet: boolean): AcaoNaReuniao | null {
  if (!meet) return null;
  if (!desejada) return guardada ? 'cancelar' : null;
  if (!guardada) return 'criar';
  if (!guardada.link) return 'conferir';
  if (guardada.assinatura !== desejada.assinatura) return 'mudar';
  return guardada.gravacao ? null : 'gravar';
}

/** Onde a reunião é guardada no banco. */
export interface PassosDaReuniao {
  /** Guarda a reunião criada ou mudada (o link, a gravação, a assinatura do convite). */
  reuniaoGravada(p: PedidoDaFila, r: ReuniaoGuardada): Promise<void>;
  /** A reunião foi cancelada no Google (ou sumiu de lá): esquece-a. */
  reuniaoCancelada(p: PedidoDaFila): Promise<void>;
}
export interface ExecucaoDaReuniao {
  api: ApiDaAgenda; passos: PassosDaReuniao; pedido: PedidoDaFila; orcamento: { restante: number };
  /** Um id novo para cada pedido do link (crypto.randomUUID no servidor; fixo nos testes). */
  novoPedido: () => string;
}
/**
 * O que a execução fez: o link (para as cópias levarem na descrição), quantas mudanças na reunião foram ao Google (criada,
 * mudada ou cancelada) e se restou o que fazer (o link ainda sendo criado, ou o orçamento acabou: o pedido volta à fila).
 * erro: a reunião falhou. As cópias vão mesmo assim (com o link que já estava guardado), e só depois a falha segue para a
 * fila, para o pedido voltar com espera.
 */
export interface ResultadoDaReuniao { link: string | null; feitas: number; restam: boolean; erro?: unknown }

/**
 * A falha da reunião, como vai para a fila: a de autorização (o Google negando a agenda principal ou o Meet) vira recusa só
 * deste pedido. Ela nunca para a fila do escritório inteiro: as agendas e as cópias usam outras permissões, que continuam.
 */
export function falhaDaReuniao(e: unknown) {
  return e instanceof FalhaDaAgenda && e.tipo === 'autorizacao' ? new FalhaDaAgenda('recusado', e.detalhe, e.motivo) : e;
}

/** A falha do Google ao criar o link: o pedido fica na fila como recusado (o administrador vê em Configurações). */
const SEM_LINK = 'o Google não criou o link do Meet';
const sumiu = (e: unknown) => e instanceof FalhaDaAgenda && e.tipo === 'sumiu';

type Estado = { guardada: ReuniaoGuardada | null; restam: boolean; feita: boolean };
type Fazer = (x: ExecucaoDaReuniao, d: ReuniaoDesejada | null, g: ReuniaoGuardada | null) => Promise<Estado>;

/** Guarda a reunião com o link da resposta; sem link ainda, o pedido volta; o Google sem conseguir criar: falha recusada. */
async function comOLink(x: ExecucaoDaReuniao, base: Omit<ReuniaoGuardada, 'link'>, r: RespostaDaReuniao, feita: boolean): Promise<Estado> {
  const link = linkDaResposta(r);
  const guardada: ReuniaoGuardada = { ...base, link: link.estado === 'pronto' ? link.link : null };
  await x.passos.reuniaoGravada(x.pedido, guardada);
  if (link.estado === 'falhou') throw new FalhaDaAgenda('recusado', SEM_LINK);
  return { guardada, restam: link.estado === 'esperando', feita };
}
const novaGuardada = (d: ReuniaoDesejada, assinatura: string | null): Omit<ReuniaoGuardada, 'link'> =>
  ({ evento_id: d.evento.id, espaco: null, gravacao: null, gravacao_detalhe: null, assinatura });
/** Pede o link de novo na reunião que já existe (a cancelada no Google volta; a que ficou sem link ganha um). */
const pedirOLinkDeNovo = (x: ExecucaoDaReuniao, d: ReuniaoDesejada) =>
  x.api.mudarReuniao(d.evento.id, { ...corpoParaMudar(d.evento), attendees: d.evento.attendees, conferenceData: pedidoDoLink(x.novoPedido()) });

const FAZER: Record<AcaoNaReuniao, Fazer> = {
  async cancelar(x, _d, g) {
    await x.api.cancelarReuniao(g!.evento_id);
    await x.passos.reuniaoCancelada(x.pedido);
    return { guardada: null, restam: false, feita: true };
  },
  // O id é do SEMPER: numa nova tentativa, a reunião criada antes (a resposta que se perdeu) já existe, e é aproveitada; a
  // cancelada antes (a opção desmarcada e marcada de novo) volta, com um link novo. A aproveitada fica sem assinatura: o
  // convite é atualizado logo depois, para ficar como o compromisso está agora.
  async criar(x, d) {
    try { return await comOLink(x, novaGuardada(d!, d!.assinatura), await x.api.criarReuniao({ ...d!.evento, conferenceData: pedidoDoLink(x.novoPedido()) }), true); } catch (err) {
      if (!(err instanceof FalhaDaAgenda && err.tipo === 'repetido')) throw err;
    }
    const existente = await x.api.lerReuniao(d!.evento.id);
    if (existente.status === 'cancelled') return comOLink(x, novaGuardada(d!, d!.assinatura), await pedirOLinkDeNovo(x, d!), true);
    return comOLink(x, novaGuardada(d!, null), existente, true);
  },
  // O link que ainda estava sendo criado: lido de novo; se o Google não conseguiu, pede outra vez. A reunião apagada no
  // Google (só a conta do escritório consegue) é esquecida e criada de novo.
  async conferir(x, d, g) {
    let r: RespostaDaReuniao;
    try { r = await x.api.lerReuniao(g!.evento_id); } catch (err) {
      if (!sumiu(err)) throw err;
      await x.passos.reuniaoCancelada(x.pedido);
      return { guardada: null, restam: false, feita: false };
    }
    if (r.status !== 'cancelled' && linkDaResposta(r).estado !== 'falhou') return comOLink(x, g!, r, false);
    return comOLink(x, g!, await pedirOLinkDeNovo(x, d!), false);
  },
  // O compromisso mudou: o convite muda, sem o pedido do link (o link fica o mesmo). Apagada no Google: criada de novo.
  async mudar(x, d, g) {
    try { await x.api.mudarReuniao(g!.evento_id, { ...corpoParaMudar(d!.evento), attendees: d!.evento.attendees }); } catch (err) {
      if (!sumiu(err)) throw err;
      await x.passos.reuniaoCancelada(x.pedido);
      return { guardada: null, restam: false, feita: false };
    }
    const guardada = { ...g!, assinatura: d!.assinatura };
    await x.passos.reuniaoGravada(x.pedido, guardada);
    return { guardada, restam: false, feita: true };
  },
  // A gravação e a transcrição automáticas: o que não for falha temporária (a edição que não grava, a permissão negada pelo
  // administrador do Workspace) fica guardado como recusado, e a reunião segue sem elas.
  async gravar(x, _d, g) {
    const codigo = codigoDoMeet(g!.link);
    let guardada: ReuniaoGuardada;
    try {
      if (!codigo) throw new FalhaDaAgenda('recusado', 'o link do Meet não tem o código da reunião');
      const espaco = await x.api.espacoDoMeet(codigo);
      await x.api.ligarGravacao(espaco);
      guardada = { ...g!, espaco, gravacao: 'ligada', gravacao_detalhe: null };
    } catch (err) {
      if (!(err instanceof FalhaDaAgenda) || err.tipo === 'temporario') throw err;
      guardada = { ...g!, gravacao: 'recusada', gravacao_detalhe: err.detalhe.slice(0, TAMANHO_DO_DETALHE) };
    }
    await x.passos.reuniaoGravada(x.pedido, guardada);
    return { guardada, restam: false, feita: false };
  }
};

/**
 * Leva a reunião do compromisso ao Google, um passo de cada vez (o plano é refeito depois de cada um), dentro do orçamento
 * de ações da execução. Para quando não há mais o que fazer, quando o link ainda está sendo criado ou quando o orçamento acaba.
 */
export async function levarReuniao(x: ExecucaoDaReuniao, item: CompromissoNaAgenda | null, guardadaAntes: ReuniaoGuardada | null, meet: boolean): Promise<ResultadoDaReuniao> {
  const desejada = reuniaoDesejada(item, x.pedido.escritorio_id, x.pedido.conta_email);
  let estado: Estado = { guardada: guardadaAntes, restam: false, feita: false };
  let feitas = 0, erro: unknown;
  try {
    for (let acao = planejarReuniao(desejada, estado.guardada, meet); acao; acao = planejarReuniao(desejada, estado.guardada, meet)) {
      if (x.orcamento.restante <= 0) { estado.restam = true; break; }
      x.orcamento.restante--;
      estado = await FAZER[acao](x, desejada, estado.guardada);
      if (estado.feita) feitas++;
      if (estado.restam) break;
    }
  } catch (e) { erro = falhaDaReuniao(e); }
  return { link: desejada ? estado.guardada?.link ?? null : null, feitas, restam: estado.restam, ...(erro === undefined ? {} : { erro }) };
}
