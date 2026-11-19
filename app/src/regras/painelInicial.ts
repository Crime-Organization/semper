// O painel da página inicial (#319): os blocos (o que cada um mostra, quando aparece e para onde leva o "Ver todos"), os prazos
// de hoje, da semana e os vencidos, a agenda do dia, os itens em andamento, as contagens por coluna do quadro, os processos, as
// anotações e as parcelas da semana. Tudo puro, sem tela nem banco. As datas são "aaaa-mm-dd", no horário de Brasília
// (hojeNaAgenda, em regras/agenda.ts).
import type {
  AndamentoNoPainel, AnotacaoLista, Coluna, CompromissoLista, Modulo, PainelDeProcessos, ParcelaDoEscritorio, PrazoNaAgenda, PrazoNoPainel, ProcessoNoPainel, TipoProcesso
} from '../dados/tipos';
import { ORIGENS_DE_PRAZO } from './agenda';
import { nomeDoAndamento, rotuloDoPrazo } from './andamentos';
import { fmtHora } from './compromisso';
import { compararPeloPrazo, type ComPrazo } from './ordemPorPrazo';
import { enderecoDoProcesso, linhaDoProcesso } from './painelProcessos';
import { fmtData } from './pessoa';
import { somarDias } from './prazos';

/** Até quantos dias à frente o painel olha: hoje e os próximos 7 (os prazos e as parcelas da semana). */
export const DIAS_DO_PAINEL = 7;
/** Quantos itens cada bloco (e cada grupo de prazos) mostra; o resto fica no "Ver todos". */
export const ITENS_POR_BLOCO = 5;
/** O primeiro dia da busca dos prazos vencidos: todos os que ficaram para trás, sem limite de data. */
export const DESDE_SEMPRE = '0001-01-01';
/** O endereço que já abre o módulo filtrado em quem está logado (/tarefas/?pessoa=eu), como o ?responsavel=eu de Pessoas. */
export const PARAMETRO_DA_PESSOA = 'pessoa';
export const EU_NO_ENDERECO = 'eu';
/** O endereço de uma página do módulo filtrada em quem está logado. */
export const comigo = (caminho: string) => `${caminho}?${PARAMETRO_DA_PESSOA}=${EU_NO_ENDERECO}`;
/** O filtro de pessoa com que a página do módulo abre: quem está logado, se o endereço pede (?pessoa=eu); senão, o guardado. */
export const pessoaDoEndereco = (doEndereco: string | null, eu: string, guardada: string) => doEndereco === EU_NO_ENDERECO ? eu : guardada;

// ---------- os blocos ----------
export type BlocoDoPainel = 'prazos' | 'agenda' | 'tarefas' | 'demandas' | 'processos' | 'anotacoes' | 'parcelas' | 'pessoas';
export interface DefinicaoDoBloco {
  titulo: string;
  /** O que o bloco diz quando não há nada (ele nunca some por estar vazio). */
  vazio: string;
  /**
   * O "Ver todos": a página do módulo, já filtrada no que é da pessoa quando a página sabe filtrar. Com "modulo", o link só aparece
   * quando o escritório tem esse módulo ligado (sem ele, a página some do menu).
   */
  verTodos: { rotulo: string; para: string; modulo?: Modulo };
  /** O módulo que o escritório precisa ter ligado para o bloco aparecer (null: aparece sempre). O Financeiro segue a mesma regra do menu. */
  modulo: Modulo | null;
}
/** Os blocos, na ordem da tela: no celular, em uma coluna, os prazos e a agenda vêm primeiro. */
export const BLOCOS_DO_PAINEL: Record<BlocoDoPainel, DefinicaoDoBloco> = {
  prazos: { titulo: 'Prazos', vazio: 'Nenhum prazo vencido, para hoje ou para os próximos 7 dias.', verTodos: { rotulo: 'Ver na agenda', para: comigo('/agenda/'), modulo: 'compromissos' }, modulo: null },
  agenda: { titulo: 'Agenda de hoje', vazio: 'Nenhum compromisso hoje.', verTodos: { rotulo: 'Ver a agenda', para: comigo('/agenda/') }, modulo: 'compromissos' },
  tarefas: { titulo: 'Tarefas em andamento', vazio: 'Nenhuma tarefa em andamento com você.', verTodos: { rotulo: 'Ver todas', para: comigo('/tarefas/') }, modulo: 'tarefas' },
  demandas: { titulo: 'Suas demandas', vazio: 'Nenhuma demanda em aberto com você.', verTodos: { rotulo: 'Ver todas', para: comigo('/demandas/') }, modulo: 'demandas' },
  processos: { titulo: 'Seus processos', vazio: 'Nenhum processo com você.', verTodos: { rotulo: 'Ver o painel', para: '/processos/' }, modulo: 'processos' },
  anotacoes: { titulo: 'Anotações recentes', vazio: 'Nenhuma anotação sua ainda.', verTodos: { rotulo: 'Ver todas', para: '/documentos/' }, modulo: 'anotacoes' },
  parcelas: { titulo: 'Parcelas da semana', vazio: 'Nenhuma parcela vencida ou a vencer nos próximos 7 dias.', verTodos: { rotulo: 'Ver todas', para: '/parcelas/' }, modulo: 'financeiro' },
  pessoas: { titulo: 'Pessoas', vazio: 'Nenhuma pessoa cadastrada ainda.', verTodos: { rotulo: 'Ver todas', para: '/pessoas/' }, modulo: null }
};
export const ORDEM_DOS_BLOCOS = Object.keys(BLOCOS_DO_PAINEL) as BlocoDoPainel[];
/** Os módulos ligados no escritório (o que falta conta como desligado, como no menu). */
export type ModulosLigados = Partial<Record<string, boolean>> | null | undefined;
const ligado = (modulo: Modulo | null | undefined, modulos: ModulosLigados) => !modulo || !!modulos?.[modulo];
/** Os blocos que o escritório mostra: os sem módulo e os dos módulos ligados. */
export const blocosDoEscritorio = (modulos: ModulosLigados) => ORDEM_DOS_BLOCOS.filter(b => ligado(BLOCOS_DO_PAINEL[b].modulo, modulos));
/** O "Ver todos" do bloco, ou null quando a página a que ele leva depende de um módulo que o escritório não tem ligado. */
export function verTodosDoBloco(bloco: BlocoDoPainel, modulos: ModulosLigados) {
  const { verTodos } = BLOCOS_DO_PAINEL[bloco];
  return ligado(verTodos.modulo, modulos) ? verTodos : null;
}

/** O número do bloco: "12", ou "50+" quando a leitura parou antes do fim (há mais do que o painel leu). */
export const fmtContagem = (n: number, completa = true) => `${n.toLocaleString('pt-BR')}${completa ? '' : '+'}`;

// ---------- prazos ----------
/**
 * Os grupos dos prazos (e das parcelas), na ordem da tela, com a cor do selo do título (os tipos de Selo, em ui/base): os em
 * atraso em vermelho, os de hoje em laranja, os da semana neutros.
 */
export type SituacaoNoPainel = 'vencidos' | 'hoje' | 'semana';
export const GRUPOS_DO_PAINEL: Record<SituacaoNoPainel, { titulo: string; selo: 'erro' | 'pend' | 'arq'; cabe: (data: string, hoje: string) => boolean }> = {
  vencidos: { titulo: 'Em atraso', selo: 'erro', cabe: (data, hoje) => data < hoje },
  hoje: { titulo: 'Hoje', selo: 'pend', cabe: (data, hoje) => data === hoje },
  semana: { titulo: `Próximos ${DIAS_DO_PAINEL} dias`, selo: 'arq', cabe: (data, hoje) => data > hoje && data <= somarDias(hoje, DIAS_DO_PAINEL) }
};
const SITUACOES = Object.keys(GRUPOS_DO_PAINEL) as SituacaoNoPainel[];
/** Em que grupo a data cai (null: depois da semana do painel). */
export const situacaoNoPainel = (data: string, hoje: string) => SITUACOES.find(s => GRUPOS_DO_PAINEL[s].cabe(data, hoje)) ?? null;
/** Os grupos com os itens de cada um, na ordem da tela, só os que têm algum. */
export function emGrupos<T>(itens: T[], dataDe: (i: T) => string, hoje: string) {
  return SITUACOES.map(s => ({ situacao: s, ...GRUPOS_DO_PAINEL[s], itens: itens.filter(i => situacaoNoPainel(dataDe(i), hoje) === s) })).filter(g => g.itens.length);
}

export type OrigemDoPrazo = PrazoNaAgenda['origem'] | 'processos';
/** O nome de cada origem de prazo, em cima do título do item. */
export const ORIGENS_NO_PAINEL: Record<OrigemDoPrazo, string> = { tarefas: 'Tarefa', demandas: 'Demanda', processos: 'Processo' };
/** Um prazo no painel: de uma tarefa, de uma demanda ou de um processo, com o endereço que abre o cartão dele. */
export interface PrazoDoPainel {
  chave: string; origem: OrigemDoPrazo; titulo: string;
  /** O que o prazo é além do título: o código da tarefa ou da demanda, o processo. */
  detalhe: string;
  data: string; hora: string | null; para: string;
}
/** A chave de um prazo no painel: a origem e o id do item. */
const chaveDoPrazo = (origem: OrigemDoPrazo, id: string) => `${origem}-${id}`;
export const prazoDaAgenda = (p: PrazoNaAgenda): PrazoDoPainel => ({
  chave: chaveDoPrazo(p.origem, p.id), origem: p.origem, titulo: p.titulo, detalhe: p.codigo, data: p.prazo, hora: p.hora, para: ORIGENS_DE_PRAZO[p.origem].endereco + p.id
});
export const prazoDoProcesso = (z: PrazoNoPainel): PrazoDoPainel => ({
  chave: chaveDoPrazo('processos', z.id), origem: 'processos', titulo: z.descricao, detalhe: linhaDoProcesso(z.processo), data: z.final, hora: null, para: enderecoDoProcesso(z.processo)
});
/**
 * Os prazos do painel: os de tarefas e demandas (vencidos e da semana), só dos módulos que o escritório tem ligados, e os dos
 * processos, os vencidos e os até o fim da semana (o painel de Processos olha mais longe). Sem repetidos: o prazo de processo com a
 * "tarefa de cumprir" ligada (paginas/processo/Prazos.tsx) que já está na lista sai, porque a tarefa acompanha o fim do prazo e
 * já o representa. Na ordem do prazo (a mesma das listas: no mesmo dia, sem hora primeiro).
 */
export function prazosDoPainel(daAgenda: PrazoNaAgenda[], dosProcessos: PrazoNoPainel[], hoje: string, modulos: ModulosLigados): PrazoDoPainel[] {
  const dosModulos = daAgenda.filter(p => ligado(p.origem, modulos)).map(prazoDaAgenda);
  const listados = new Set(dosModulos.map(p => p.chave));
  const semATarefa = dosProcessos.filter(z => !z.tarefa_id || !listados.has(chaveDoPrazo('tarefas', z.tarefa_id)));
  const todos = [...dosModulos, ...semATarefa.map(prazoDoProcesso)].filter(p => situacaoNoPainel(p.data, hoje));
  const unicos = [...new Map(todos.map(p => [p.chave, p])).values()];
  return unicos.toSorted((a, b) => compararPeloPrazo({ prazo: a.data, prazo_hora: a.hora }, { prazo: b.data, prazo_hora: b.hora }) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}
/**
 * Se o painel de Processos trouxe todos os prazos que o painel da página inicial mostra. Ele corta os vencidos e os a vencer, cada
 * parte à parte (ITENS_POR_LISTA, em regras/painelProcessos.ts): faltou vencido se vieram menos que o total deles; faltou a vencer
 * se vieram menos que o total e o último que veio ainda está dentro da semana do painel (senão os cortados são depois dela).
 */
export function prazosDosProcessosCompletos(p: Pick<PainelDeProcessos, 'prazos' | 'total_vencidos' | 'total_a_vencer'>, hoje: string) {
  const vencidos = p.prazos.filter(z => z.final < hoje), aVencer = p.prazos.filter(z => z.final >= hoje);
  const ultimo = aVencer.map(z => z.final).toSorted().at(-1);
  return vencidos.length >= p.total_vencidos && (aVencer.length >= p.total_a_vencer || !!ultimo && ultimo > somarDias(hoje, DIAS_DO_PAINEL));
}
/** A linha de cima do prazo: a origem, quanto falta (ou há quanto venceu), a data e a hora. */
export const quandoDoPrazo = (p: Pick<PrazoDoPainel, 'origem' | 'data' | 'hora'>, hoje: string) =>
  [ORIGENS_NO_PAINEL[p.origem], rotuloDoPrazo({ final: p.data, concluido_em: null }, hoje), fmtData(p.data) + (p.hora ? ` às ${fmtHora(p.hora)}` : '')].join(' · ');

// ---------- agenda do dia ----------
/** O compromisso cabe à pessoa: ela é a responsável ou participa, ou ele está na Agenda geral (que todos veem). */
export const naMinhaAgenda = (c: Pick<CompromissoLista, 'responsavel_id' | 'participantes' | 'geral'>, eu: string) =>
  c.geral || c.responsavel_id === eu || c.participantes.includes(eu);
/** Os compromissos de hoje que cabem à pessoa, em ordem de hora (os sem hora, que valem o dia, primeiro, como na Agenda). */
export const agendaDoDia = <C extends Pick<CompromissoLista, 'data' | 'hora' | 'responsavel_id' | 'participantes' | 'geral' | 'id'>>(compromissos: C[], eu: string, hoje: string) =>
  compromissos.filter(c => c.data === hoje && naMinhaAgenda(c, eu)).toSorted((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id));

// ---------- tarefas e demandas ----------
/** As colunas em aberto do quadro: todas menos a das concluídas (a coluna-marco "concluido"). */
export const colunasEmAberto = <C extends Pick<Coluna, 'marco'>>(colunas: C[]) => colunas.filter(c => c.marco !== 'concluido');
/**
 * Os itens em andamento do bloco: os primeiros de cada coluna em aberto (cada lista já lida na ordem do prazo, só das colunas em
 * aberto e da de fora do quadro), juntos na ordem do prazo (sem prazo no fim), até o limite. Como a leitura é por coluna, os
 * concluídos nunca tomam o lugar dos em andamento.
 */
export const emAndamentoPeloPrazo = <T extends ComPrazo>(porColuna: T[][], limite = ITENS_POR_BLOCO) =>
  porColuna.flat().toSorted((a, b) => compararPeloPrazo(a, b)).slice(0, limite);
/** Quantos itens há numa coluna do quadro (etapa_id null: fora do quadro, "Sem situação"). */
export interface ContagemDaColuna { etapa_id: string | null; n: number }
/** Uma linha das contagens por situação: a coluna e quantos itens da pessoa estão nela. */
export interface SituacaoComItens { chave: string; nome: string; n: number }
/** A chave da linha dos que estão fora do quadro. */
export const SEM_COLUNA = 'sem';
/**
 * As contagens por situação, na ordem das colunas do quadro, só as que têm itens, com os de fora do quadro no fim. Sem a coluna
 * das concluídas: o painel mostra o que está em aberto.
 */
export function situacoesEmAberto(colunas: Pick<Coluna, 'id' | 'nome' | 'marco'>[], contagens: ContagemDaColuna[], semSituacao: string): SituacaoComItens[] {
  const n = (etapa: string | null) => contagens.find(c => c.etapa_id === etapa)?.n ?? 0;
  const abertas = colunasEmAberto(colunas).map(c => ({ chave: c.id, nome: c.nome, n: n(c.id) }));
  return [...abertas, { chave: SEM_COLUNA, nome: semSituacao, n: n(null) }].filter(s => s.n > 0);
}
/** Quantos itens em aberto há, somando as situações. */
export const totalEmAberto = (situacoes: Pick<SituacaoComItens, 'n'>[]) => situacoes.reduce((soma, s) => soma + s.n, 0);
/** O nome da coluna em que o item está (ou o de fora do quadro). */
export const nomeDaColuna = (colunas: Pick<Coluna, 'id' | 'nome'>[], etapa: string | null, semSituacao: string) =>
  colunas.find(c => c.id === etapa)?.nome ?? semSituacao;

// ---------- processos ----------
type ProcessoNoBloco = Pick<ProcessoNoPainel, 'id' | 'tipo' | 'numero' | 'titulo' | 'cliente_nome'>;
/** O que vem a seguir num processo: um prazo ou uma audiência ou perícia marcada. */
export interface EventoDoProcesso { data: string; rotulo: string }
/** Um processo no bloco: com o evento mais próximo, se houver. */
export interface ProcessoDoPainel { id: string; tipo: TipoProcesso; titulo: string; para: string; proximo: EventoDoProcesso | null }
/**
 * Os processos da pessoa: primeiro os que têm prazo (inclusive vencido) ou audiência e perícia mais próximos, pela data; depois os
 * mais recentes, na ordem em que vieram (os atualizados por último primeiro). Sem repetidos, até ITENS_POR_BLOCO.
 */
export function processosDoPainel(recentes: ProcessoNoBloco[], prazos: Pick<PrazoNoPainel, 'final' | 'descricao' | 'processo'>[],
  marcados: Pick<AndamentoNoPainel, 'data' | 'tipo' | 'categoria' | 'processo'>[], limite = ITENS_POR_BLOCO): ProcessoDoPainel[] {
  const eventos = [
    ...prazos.map(z => ({ processo: z.processo, evento: { data: z.final, rotulo: 'Prazo: ' + z.descricao } })),
    ...marcados.map(a => ({ processo: a.processo, evento: { data: a.data, rotulo: nomeDoAndamento(a) } }))
  ].toSorted((a, b) => a.evento.data.localeCompare(b.evento.data));
  const vistos = new Map<string, ProcessoDoPainel>();
  const pegar = (p: ProcessoNoBloco, proximo: EventoDoProcesso | null) => {
    if (!vistos.has(p.id)) vistos.set(p.id, { id: p.id, tipo: p.tipo, titulo: linhaDoProcesso(p), para: enderecoDoProcesso(p), proximo });
  };
  eventos.forEach(e => pegar(e.processo, e.evento));
  recentes.forEach(p => pegar(p, null));
  return [...vistos.values()].slice(0, limite);
}
/** O que vem a seguir no processo, numa linha: "Prazo: Contestação · 20/11/2026". */
export const linhaDoEvento = (e: EventoDoProcesso) => `${e.rotulo} · ${fmtData(e.data)}`;

// ---------- anotações ----------
/** A anotação é da pessoa: ela a criou, é a responsável ou participa. */
export const anotacaoMinha = (a: Pick<AnotacaoLista, 'criado_por' | 'responsavel_id' | 'participantes'>, eu: string) =>
  a.criado_por === eu || a.responsavel_id === eu || a.participantes.includes(eu);
/** As anotações da pessoa, as alteradas por último primeiro. */
export const anotacoesRecentes = <A extends Pick<AnotacaoLista, 'criado_por' | 'responsavel_id' | 'participantes' | 'atualizado_em'>>(anotacoes: A[], eu: string) =>
  anotacoes.filter(a => anotacaoMinha(a, eu)).toSorted((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
/**
 * O que o bloco das anotações diz quando não achou nenhuma da pessoa: se a leitura chegou ao fim, ela não tem nenhuma; se parou
 * antes (o painel lê só as alteradas por último no escritório), pode haver outras dela mais antigas.
 */
export const vazioDasAnotacoes = (completa: boolean) => completa ? BLOCOS_DO_PAINEL.anotacoes.vazio : 'Nenhuma anotação sua entre as alteradas por último.';

// ---------- parcelas ----------
/** As parcelas ainda não recebidas que vencem até o fim da semana do painel, as vencidas também, na ordem do vencimento. */
export const parcelasDaSemana = <P extends Pick<ParcelaDoEscritorio, 'recebida_em' | 'vencimento' | 'numero'>>(parcelas: P[], hoje: string) =>
  parcelas.filter(p => !p.recebida_em && situacaoNoPainel(p.vencimento, hoje)).toSorted((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero);
/** "Parcela 2/10" (ou "Parcela 2" quando o contrato não diz quantas são). */
export const nomeDaParcela = (p: Pick<ParcelaDoEscritorio, 'numero' | 'total_parcelas'>) => `Parcela ${p.numero}${p.total_parcelas ? '/' + p.total_parcelas : ''}`;
