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
import { emCaixaAlta } from './texto';
import type { AlcanceDoPainel } from './filtroDoPainel';
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
/** O endereço que abre o módulo com o trabalho de todos (?pessoa=todos): o filtro "Equipe toda" do painel do Início (#402). */
export const TODOS_NO_ENDERECO = 'todos';
/** O endereço de uma página do módulo filtrada em quem está logado. */
export const comigo = (caminho: string) => `${caminho}?${PARAMETRO_DA_PESSOA}=${EU_NO_ENDERECO}`;
/** O valor do ?pessoa= que abre a página do módulo com o trabalho que o painel mostra: o de quem está logado, o de todos ou o de uma pessoa. */
const PESSOA_NO_ENDERECO: Record<AlcanceDoPainel['tipo'], (a: AlcanceDoPainel) => string> = {
  eu: () => EU_NO_ENDERECO, equipe: () => TODOS_NO_ENDERECO, pessoa: a => a.pessoa ?? ''
};
/** O endereço de uma página do módulo filtrada no trabalho que o painel mostra (#402). */
export const noAlcance = (caminho: string, alcance: AlcanceDoPainel) => `${caminho}?${PARAMETRO_DA_PESSOA}=${PESSOA_NO_ENDERECO[alcance.tipo](alcance)}`;
/** O que cada valor especial do ?pessoa= pede: quem está logado (eu) ou o trabalho de todos (todos: sem filtro de pessoa). */
const PEDIDOS_NO_ENDERECO: Record<string, (eu: string) => string> = { [EU_NO_ENDERECO]: eu => eu, [TODOS_NO_ENDERECO]: () => '' };
/**
 * O filtro de pessoa com que a página do módulo abre: o que o endereço pede (quem está logado, todos ou o perfil de uma pessoa, que a
 * página confere na equipe); sem o parâmetro, o guardado.
 */
export function pessoaDoEndereco(doEndereco: string | null, eu: string, guardada: string) {
  if (doEndereco === null) return guardada;
  return Object.hasOwn(PEDIDOS_NO_ENDERECO, doEndereco) ? PEDIDOS_NO_ENDERECO[doEndereco](eu) : doEndereco;
}

// ---------- os blocos ----------
export type BlocoDoPainel = 'prazos' | 'agenda' | 'tarefas' | 'demandas' | 'processos' | 'anotacoes' | 'parcelas' | 'pessoas';
export interface DefinicaoDoBloco {
  titulo: string;
  /** O que o bloco diz quando não há nada (ele nunca some por estar vazio), no trabalho de quem está logado. */
  vazio: string;
  /** O mesmo, quando o painel mostra o trabalho da equipe ou de outra pessoa (sem o "com você"); sem ele, vale o vazio. */
  vazioDeOutros?: string;
  /**
   * O "Ver todos": a página do módulo (caminho); com "porPessoa", já filtrada no trabalho que o painel mostra (noAlcance). Com
   * "modulo", o link só aparece quando o escritório tem esse módulo ligado (sem ele, a página some do menu).
   */
  verTodos: { rotulo: string; caminho: string; porPessoa?: boolean; modulo?: Modulo };
  /** O módulo que o escritório precisa ter ligado para o bloco aparecer (null: aparece sempre). O Financeiro segue a mesma regra do menu. */
  modulo: Modulo | null;
}
/** Os blocos, na ordem da tela: no celular, em uma coluna, os prazos e a agenda vêm primeiro. */
export const BLOCOS_DO_PAINEL: Record<BlocoDoPainel, DefinicaoDoBloco> = {
  prazos: { titulo: 'Prazos', vazio: 'Nenhum prazo vencido, para hoje ou para os próximos 7 dias.',
    verTodos: { rotulo: 'Ver na agenda', caminho: '/agenda/', porPessoa: true, modulo: 'compromissos' }, modulo: null },
  agenda: { titulo: 'Agenda de hoje', vazio: 'Nenhum compromisso hoje.', verTodos: { rotulo: 'Ver a agenda', caminho: '/agenda/', porPessoa: true }, modulo: 'compromissos' },
  tarefas: { titulo: 'Tarefas em andamento', vazio: 'Nenhuma tarefa em andamento com você.', vazioDeOutros: 'Nenhuma tarefa em andamento.',
    verTodos: { rotulo: 'Ver todas', caminho: '/tarefas/', porPessoa: true }, modulo: 'tarefas' },
  demandas: { titulo: 'Demandas por fase', vazio: 'Nenhuma demanda em aberto com você.', vazioDeOutros: 'Nenhuma demanda em aberto.',
    verTodos: { rotulo: 'Ver todas', caminho: '/demandas/', porPessoa: true }, modulo: 'demandas' },
  processos: { titulo: 'Processos', vazio: 'Nenhum processo com você.', vazioDeOutros: 'Nenhum processo em andamento.',
    verTodos: { rotulo: 'Ver o painel', caminho: '/processos/' }, modulo: 'processos' },
  anotacoes: { titulo: 'Anotações recentes', vazio: 'Nenhuma anotação sua ainda.', vazioDeOutros: 'Nenhuma anotação ainda.',
    verTodos: { rotulo: 'Ver todas', caminho: '/documentos/' }, modulo: 'anotacoes' },
  parcelas: { titulo: 'Parcelas da semana', vazio: 'Nenhuma parcela vencida ou a vencer nos próximos 7 dias.', verTodos: { rotulo: 'Ver todas', caminho: '/financeiro/direitos/' }, modulo: 'financeiro' },
  pessoas: { titulo: 'Pessoas', vazio: 'Nenhuma pessoa cadastrada ainda.', verTodos: { rotulo: 'Ver todas', caminho: '/pessoas/' }, modulo: null }
};
export const ORDEM_DOS_BLOCOS = Object.keys(BLOCOS_DO_PAINEL) as BlocoDoPainel[];
/** Os módulos ligados no escritório (o que falta conta como desligado, como no menu). */
export type ModulosLigados = Partial<Record<string, boolean>> | null | undefined;
export const ligado = (modulo: Modulo | null | undefined, modulos: ModulosLigados) => !modulo || !!modulos?.[modulo];
/** Os blocos que o escritório mostra: os sem módulo e os dos módulos ligados. */
export const blocosDoEscritorio = (modulos: ModulosLigados) => ORDEM_DOS_BLOCOS.filter(b => ligado(BLOCOS_DO_PAINEL[b].modulo, modulos));
/** Quanto da linha cada bloco ocupa no computador (as larguras do CartaoDoPainel, em ui/painel). */
export type LarguraDoBloco = 'inteira' | 'metade' | 'terco' | 'dois-tercos';
/** Os dois blocos do dia, lado a lado no computador: os prazos, mais largos, e a agenda de hoje. */
const DO_DIA: Partial<Record<BlocoDoPainel, LarguraDoBloco>> = { prazos: 'dois-tercos', agenda: 'terco' };
/**
 * A largura de cada bloco que o escritório mostra (#402), para as linhas da grade ficarem cheias: os prazos e a agenda lado a lado
 * (sem um deles, o outro ocupa a linha); os demais, dois por linha, e o último sozinho ocupa a linha inteira.
 */
export function larguraDosBlocos(blocos: readonly BlocoDoPainel[]): Record<string, LarguraDoBloco> {
  const doDia = blocos.filter(b => DO_DIA[b]), outros = blocos.filter(b => !DO_DIA[b]);
  const larguras: Record<string, LarguraDoBloco> = {};
  doDia.forEach(b => { larguras[b] = doDia.length > 1 ? DO_DIA[b]! : 'inteira'; });
  outros.forEach((b, i) => { larguras[b] = outros.length % 2 && i === outros.length - 1 ? 'inteira' : 'metade'; });
  return larguras;
}
/**
 * O "Ver todos" do bloco (o rótulo e o endereço, já no trabalho que o painel mostra), ou null quando a página a que ele leva depende
 * de um módulo que o escritório não tem ligado.
 */
export function verTodosDoBloco(bloco: BlocoDoPainel, modulos: ModulosLigados, alcance: AlcanceDoPainel) {
  const { verTodos } = BLOCOS_DO_PAINEL[bloco];
  if (!ligado(verTodos.modulo, modulos)) return null;
  return { rotulo: verTodos.rotulo, para: verTodos.porPessoa ? noAlcance(verTodos.caminho, alcance) : verTodos.caminho };
}
/** O que o bloco diz quando não há nada: "com você" só quando o painel mostra o trabalho de quem está logado. */
export function vazioDoBloco(bloco: BlocoDoPainel, alcance: Pick<AlcanceDoPainel, 'tipo'>) {
  const def = BLOCOS_DO_PAINEL[bloco];
  return alcance.tipo === 'eu' ? def.vazio : def.vazioDeOutros ?? def.vazio;
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
/**
 * O compromisso cabe à pessoa: ela é a responsável ou participa, ou ele está na Agenda geral (que todos veem). Sem pessoa (o trabalho
 * da equipe toda), todos cabem.
 */
export const naMinhaAgenda = (c: Pick<CompromissoLista, 'responsavel_id' | 'participantes' | 'geral'>, pessoa: string | null) =>
  !pessoa || c.geral || c.responsavel_id === pessoa || c.participantes.includes(pessoa);
/** Os compromissos de hoje que cabem à pessoa (null: todos), em ordem de hora (os sem hora, que valem o dia, primeiro, como na Agenda). */
export const agendaDoDia = <C extends Pick<CompromissoLista, 'data' | 'hora' | 'responsavel_id' | 'participantes' | 'geral' | 'id'>>(compromissos: C[], pessoa: string | null, hoje: string) =>
  compromissos.filter(c => c.data === hoje && naMinhaAgenda(c, pessoa)).toSorted((a, b) => (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id));

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
 * das concluídas: o painel mostra o que está em aberto. Os nomes saem em maiúsculas, como no quadro (#386).
 */
export function situacoesEmAberto(colunas: Pick<Coluna, 'id' | 'nome' | 'marco'>[], contagens: ContagemDaColuna[], semSituacao: string): SituacaoComItens[] {
  const n = (etapa: string | null) => contagens.find(c => c.etapa_id === etapa)?.n ?? 0;
  const abertas = colunasEmAberto(colunas).map(c => ({ chave: c.id, nome: emCaixaAlta(c.nome), n: n(c.id) }));
  return [...abertas, { chave: SEM_COLUNA, nome: emCaixaAlta(semSituacao), n: n(null) }].filter(s => s.n > 0);
}
/** Quantos itens em aberto há, somando as situações. */
export const totalEmAberto = (situacoes: Pick<SituacaoComItens, 'n'>[]) => situacoes.reduce((soma, s) => soma + s.n, 0);
/** O nome da coluna em que o item está (ou o de fora do quadro), em maiúsculas como no quadro (#386). */
export const nomeDaColuna = (colunas: Pick<Coluna, 'id' | 'nome'>[], etapa: string | null, semSituacao: string) =>
  emCaixaAlta(colunas.find(c => c.id === etapa)?.nome ?? semSituacao);

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
/** A anotação é da pessoa: ela a criou, é a responsável ou participa. Sem pessoa (o trabalho da equipe toda), todas são. */
export const anotacaoMinha = (a: Pick<AnotacaoLista, 'criado_por' | 'responsavel_id' | 'participantes'>, pessoa: string | null) =>
  !pessoa || a.criado_por === pessoa || a.responsavel_id === pessoa || a.participantes.includes(pessoa);
/** As anotações da pessoa (null: todas), as alteradas por último primeiro. */
export const anotacoesRecentes = <A extends Pick<AnotacaoLista, 'criado_por' | 'responsavel_id' | 'participantes' | 'atualizado_em'>>(anotacoes: A[], pessoa: string | null) =>
  anotacoes.filter(a => anotacaoMinha(a, pessoa)).toSorted((a, b) => b.atualizado_em.localeCompare(a.atualizado_em));
/**
 * O que o bloco das anotações diz quando não achou nenhuma da pessoa: se a leitura chegou ao fim, ela não tem nenhuma; se parou
 * antes (o painel lê só as alteradas por último no escritório), pode haver outras dela mais antigas.
 */
export const vazioDasAnotacoes = (completa: boolean, alcance: Pick<AlcanceDoPainel, 'tipo'>) => completa ? vazioDoBloco('anotacoes', alcance)
  : alcance.tipo === 'eu' ? 'Nenhuma anotação sua entre as alteradas por último.' : 'Nenhuma anotação entre as alteradas por último.';

// ---------- parcelas ----------
/** As parcelas ainda não recebidas que vencem até o fim da semana do painel, as vencidas também, na ordem do vencimento. */
export const parcelasDaSemana = <P extends Pick<ParcelaDoEscritorio, 'recebida_em' | 'vencimento' | 'numero'>>(parcelas: P[], hoje: string) =>
  parcelas.filter(p => !p.recebida_em && situacaoNoPainel(p.vencimento, hoje)).toSorted((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero);
/** "Parcela 2/10" (ou "Parcela 2" quando o contrato não diz quantas são). */
export const nomeDaParcela = (p: Pick<ParcelaDoEscritorio, 'numero' | 'total_parcelas'>) => `Parcela ${p.numero}${p.total_parcelas ? '/' + p.total_parcelas : ''}`;
