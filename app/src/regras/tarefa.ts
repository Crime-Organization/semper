// Regras da tarefa (módulo Tarefas): o cadastro por etapas, os papéis de cada pessoa, quem vê a tarefa, quem pode ser
// mencionado nos comentários e quando oferecer concluir a demanda. Tudo puro, sem tela nem banco.
import type { DadosTarefa, Demanda, EquipeDoContrato, Lembrete, Membro, PapelNaTarefa, Tarefa } from '../dados/tipos';
import { contratosEmQueEsta } from './contrato';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, TAMANHO_TAREFA } from '../dados/limites';
import { doContratoEmQueEsta, estaNaDemanda, valorLegivelDemanda } from './demanda';
import { fmtData, lerData } from './pessoa';
import { CONFERENCIAS_DO_LEMBRETE, horaELembreteAoGravar, horaELembreteDoCartao } from './lembrete';
import { erroDaDataDeInicio, inicioAoGravar, ROTULO_DO_INICIO } from './dataDeInicio';
import { estaPeloGrupo } from './gruposDaEquipe';

/** Rótulo das tarefas fora das colunas do quadro. */
export const SEM_SITUACAO_TAREFA = 'Sem situação';

// ---------- formulário ----------
/** Campos do formulário de tarefa, como digitados. */
export interface CamposTarefa {
  titulo: string;
  descricao: string;
  /** dd/mm/aaaa, ou vazio. */
  prazo: string;
  /** hh:mm, ou vazio (só vale com o prazo). */
  hora: string;
  /** Minutos antes do prazo, ou null sem lembrete (só vale com o prazo). */
  lembrete: Lembrete | null;
  /** A data de início, dd/mm/aaaa (#357). null no cadastro novo: a tarefa começa no dia em que é criada (o padrão do banco). */
  inicio: string | null;
  responsavelId: string;
  participantes: string[];
  /** Uma por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  pessoas: string[];
  demandaId: string;
  contratoId: string;
  /** Um processo só, ou vazio. */
  processoId: string;
}
export const TAREFA_VAZIA: CamposTarefa = {
  titulo: '', descricao: '', prazo: '', hora: '', lembrete: null, inicio: null, responsavelId: '', participantes: [], pessoas: [''], demandaId: '', contratoId: '', processoId: ''
};

/** Confere um campo: devolve a mensagem de erro ou null. */
type Conferencia = (c: CamposTarefa) => string | null;
const escolhidos = (lista: string[]) => lista.filter(Boolean);
const repetido = (lista: string[]) => new Set(escolhidos(lista)).size < escolhidos(lista).length;

/** Regras do cadastro, uma lista por campo (a primeira que falhar dá a mensagem). Campo novo = entrada nova aqui. */
const CONFERENCIAS: Partial<Record<keyof CamposTarefa, Conferencia[]>> = {
  titulo: [
    c => c.titulo.trim() ? null : 'Dê um título à tarefa.',
    c => c.titulo.trim().length > TAMANHO_TAREFA.titulo ? `O título pode ter até ${TAMANHO_TAREFA.titulo} caracteres.` : null
  ],
  descricao: [c => c.descricao.length > TAMANHO_TAREFA.descricao ? `A descrição pode ter até ${TAMANHO_TAREFA.descricao} caracteres.` : null],
  prazo: [c => { try { lerData(c.prazo); return null; } catch (e) { return (e as Error).message; } }],
  inicio: [c => c.inicio === null ? null : erroDaDataDeInicio(c.inicio) || null],
  ...CONFERENCIAS_DO_LEMBRETE,
  responsavelId: [c => c.responsavelId ? null : 'Escolha o responsável.'],
  participantes: [
    c => repetido(c.participantes) ? 'A mesma pessoa aparece duas vezes nos participantes.' : null,
    c => escolhidos(c.participantes).length > COLABORADORES_MAXIMOS ? `Uma tarefa pode ter até ${COLABORADORES_MAXIMOS} participantes.` : null
  ],
  pessoas: [
    c => repetido(c.pessoas) ? 'A mesma pessoa aparece duas vezes.' : null,
    c => escolhidos(c.pessoas).length > CLIENTES_MAXIMOS ? `Uma tarefa pode ter até ${CLIENTES_MAXIMOS} pessoas ligadas.` : null
  ]
};

/** Erros do cadastro, por campo. Vazio: pode salvar. */
export function validarTarefa(c: CamposTarefa): Partial<Record<keyof CamposTarefa, string>> {
  const erros: Partial<Record<keyof CamposTarefa, string>> = {};
  for (const [campo, regras] of Object.entries(CONFERENCIAS) as [keyof CamposTarefa, Conferencia[]][]) {
    const erro = regras.map(r => r(c)).find(Boolean);
    if (erro) erros[campo] = erro;
  }
  return erros;
}

/** O que vai para o banco (só depois de validarTarefa sem erros). O responsável não entra nos participantes. */
export function dadosDaTarefa(c: CamposTarefa): DadosTarefa {
  const prazo = lerData(c.prazo);
  return {
    titulo: c.titulo.trim(), descricao: c.descricao.trim() || null, prazo, ...horaELembreteAoGravar(prazo, c), ...inicioAoGravar(c), responsavel_id: c.responsavelId,
    participantes: [...new Set(escolhidos(c.participantes))].filter(id => id !== c.responsavelId),
    pessoas: [...new Set(escolhidos(c.pessoas))], demanda_id: c.demandaId || null, contrato_id: c.contratoId || null,
    processo_id: c.processoId || null
  };
}

/**
 * Depois de gravar, a pessoa continua vendo a tarefa pela demanda ligada? A demanda que já estava ligada só vem na tarefa
 * para quem pode abri-la; a escolhida agora veio da lista de quem a vê.
 */
export const continuaPelaDemanda = (alvo: Pick<Tarefa, 'demanda_id' | 'demanda'>, demandaDepois: string | null | undefined) =>
  !!demandaDepois && (demandaDepois !== alvo.demanda_id || !!alvo.demanda);

/**
 * Quem não é administrador, não criou a tarefa e não vê a demanda ligada só a vê enquanto participa, e o banco recusa a
 * gravação que o tiraria dela. Por isso, ao passar a tarefa adiante ou sair dos participantes, esta gravação ainda a mantém
 * como participante. A saída vem depois, por SD.cartaoSair: assim o resto é gravado e ela sai de verdade (#276). Quem a vê pela demanda sai na própria gravação (veja continuaPelaDemanda).
 */
export function semSairDaTarefa(d: DadosTarefa, eu: string, podeSair: boolean, antes: CartaoAntes, continuaPeloLigado = false): { dados: DadosTarefa; ficou: boolean } {
  const participantes = d.participantes ?? [];
  const r = pessoasAoGravar(participantes, d.responsavel_id, eu, antes, podeSair, continuaPeloLigado);
  return { dados: r.lista === participantes ? d : { ...d, participantes: r.lista }, ficou: r.ficou };
}

/** Campos do formulário a partir de uma tarefa salva (para atualizar). */
export const camposDaTarefa = (t: Tarefa): CamposTarefa => ({
  titulo: t.titulo, descricao: t.descricao || '', prazo: fmtData(t.prazo), ...horaELembreteDoCartao(t), inicio: fmtData(t.data_inicio), responsavelId: t.responsavel_id,
  participantes: [...t.participantes], pessoas: t.pessoas.length ? t.pessoas.map(p => p.id) : [''],
  demandaId: t.demanda_id || '', contratoId: t.contrato_id || '', processoId: t.processo_id || ''
});

// ---------- etapas do cadastro ----------
export type EtapaTarefa = 'tarefa' | 'pessoas';
export interface DefinicaoEtapaTarefa {
  id: EtapaTarefa; titulo: string; texto: string; campos: (keyof CamposTarefa)[];
  /** O título da seção no lápis do cartão, quando lá só sobra parte dos campos (o cartão muda o resto no próprio lugar). */
  tituloNoLapis?: string;
}
/**
 * As etapas do cadastro de tarefa, na ordem: o cadastro mais curto do sistema (#299), com duas. A primeira tem a tarefa, o prazo (com a
 * hora e o lembrete num campo só) e as ligações, que são opcionais; ligar a demanda antes já traz as pessoas dela para a etapa
 * seguinte. A etapa das pessoas é a mesma de antes.
 */
export const ETAPAS_TAREFA: DefinicaoEtapaTarefa[] = [
  { id: 'tarefa', titulo: 'A tarefa', texto: 'O que precisa ser feito, o prazo e, se houver, a demanda, o contrato ou o processo de que ela faz parte.',
    campos: ['titulo', 'descricao', 'prazo', 'hora', 'lembrete', 'inicio', 'demandaId', 'contratoId', 'processoId'], tituloNoLapis: 'Demanda, contrato e processo' },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'Quem faz a tarefa, quem da equipe ajuda e, se houver, as pessoas do cadastro ligadas a ela.',
    campos: ['responsavelId', 'participantes', 'pessoas'] }
];
/**
 * A ordem das seções no lápis do cartão: as pessoas antes da demanda, do contrato e do processo, como era antes de a #299 juntar as
 * ligações à primeira etapa do cadastro (no lápis, a primeira etapa fica só com elas).
 */
export const ORDEM_NO_LAPIS_TAREFA: Record<EtapaTarefa, number> = { pessoas: 1, tarefa: 2 };
/** As etapas na ordem do lápis do cartão (ORDEM_NO_LAPIS_TAREFA); o cadastro continua na ordem de ETAPAS_TAREFA. */
export const naOrdemDoLapisTarefa = <E extends { id: EtapaTarefa }>(etapas: readonly E[]) =>
  etapas.toSorted((a, b) => ORDEM_NO_LAPIS_TAREFA[a.id] - ORDEM_NO_LAPIS_TAREFA[b.id]);

// ---------- a demanda ligada no cadastro ----------
/** A demanda que se liga à tarefa, como chega do banco: os clientes e o contrato dela. */
export interface DemandaParaLigar { id: string; clientes: string[]; contratoId: string | null }
/** O que a demanda ligada trouxe para a tarefa (as pessoas e o contrato que estavam vazios), para desfazer ao tirá-la. */
export interface TrazidoDaDemanda { demandaId: string; pessoas: string[]; contratoId: string }
/**
 * Ao ligar a demanda (com a resposta do banco): os clientes dela entram nas pessoas, e o contrato dela no contrato, só se a tarefa
 * ainda não tem. Decide com os campos de agora, e não com os de quando a demanda foi escolhida: a pessoa pode ter escolhido alguém
 * ou um contrato enquanto a resposta vinha. Se a demanda já foi tirada ou trocada nesse meio-tempo, a resposta não vale (null).
 */
export function oQueADemandaTraz(c: CamposTarefa, d: DemandaParaLigar): { mudancas: Partial<CamposTarefa>; trazido: TrazidoDaDemanda } | null {
  if (c.demandaId !== d.id) return null;
  const pessoas = !c.pessoas.some(Boolean) && d.clientes.length ? d.clientes : [];
  const contratoId = !c.contratoId && d.contratoId ? d.contratoId : '';
  return {
    mudancas: { ...(pessoas.length ? { pessoas } : {}), ...(contratoId ? { contratoId } : {}) },
    trazido: { demandaId: d.id, pessoas, contratoId }
  };
}
/**
 * Ao tirar a demanda: sai também o que ela trouxe e a pessoa não mudou (os clientes dela que continuam nas pessoas, o contrato dela
 * se ainda é o mesmo). Assim, a próxima demanda ligada traz os dela, e a tarefa não fica com os clientes de uma e a demanda de outra.
 * `ficam` diz, linha a linha das pessoas, quais continuam (para a tela acompanhar os nomes).
 */
export function semADemanda(c: CamposTarefa, trazido: TrazidoDaDemanda | null): { mudancas: Partial<CamposTarefa>; ficam: boolean[] } {
  const daDemanda = trazido && trazido.demandaId === c.demandaId ? trazido : null;
  const ficam = c.pessoas.map(p => !daDemanda || !p || !daDemanda.pessoas.includes(p));
  const pessoas = c.pessoas.filter((_, i) => ficam[i]);
  return {
    mudancas: {
      demandaId: '',
      ...(ficam.includes(false) ? { pessoas: pessoas.length ? pessoas : [''] } : {}),
      ...(daDemanda?.contratoId && c.contratoId === daDemanda.contratoId ? { contratoId: '' } : {})
    },
    ficam
  };
}

/** Erros só dos campos de uma etapa (o que impede de seguir para a próxima). */
export function errosDaEtapaTarefa(etapa: EtapaTarefa, c: CamposTarefa): Partial<Record<keyof CamposTarefa, string>> {
  const campos = ETAPAS_TAREFA.find(e => e.id === etapa)!.campos, erros = validarTarefa(c);
  return Object.fromEntries(Object.entries(erros).filter(([campo]) => campos.includes(campo as keyof CamposTarefa)));
}
/** Posição da primeira etapa com erro (para voltar a ela ao salvar), ou -1 se pode salvar. */
export const primeiraEtapaComErroTarefa = (c: CamposTarefa) =>
  ETAPAS_TAREFA.findIndex(e => Object.keys(errosDaEtapaTarefa(e.id, c)).length > 0);

// ---------- cartão e histórico ----------
/** Nome de cada campo no histórico de alterações da tarefa. */
export const CAMPOS_TAREFA: Record<string, string> = {
  titulo: 'Título', descricao: 'Descrição', prazo: 'Prazo', prazo_hora: 'Hora do prazo', lembrete: 'Lembrete', data_inicio: ROTULO_DO_INICIO, responsavel_id: 'Responsável', participantes: 'Participantes',
  pessoas: 'Pessoas', demanda: 'Demanda', contrato: 'Contrato', processo: 'Processo', etapa: 'Situação', arquivado_em: 'Arquivamento'
};
/** Como cada campo aparece no cartão e no histórico (o prazo como dia/mês/ano, a hora como hh:mm, o lembrete por extenso, vazio como traço), igual às demandas. */
export const valorLegivelTarefa = valorLegivelDemanda;

// ---------- pessoas da tarefa ----------
export const PAPEIS_NA_TAREFA: Record<PapelNaTarefa, string> = { pessoa: 'Ligada', responsavel: 'Responsável', participante: 'Participante' };
interface PessoasDaTarefa { pessoas: string[]; responsavel_id: string; participantes: string[] }
/** O que confere cada papel: a pessoa (ou o usuário dela, no responsável e nos participantes) no campo certo. */
const CONFERE_PAPEL: Record<PapelNaTarefa, (t: PessoasDaTarefa, pessoaId: string, perfilId: string | null) => boolean> = {
  pessoa: (t, p) => t.pessoas.includes(p),
  responsavel: (t, _p, perfil) => !!perfil && t.responsavel_id === perfil,
  participante: (t, _p, perfil) => !!perfil && t.participantes.includes(perfil)
};
/** Os papéis da pessoa na tarefa, na ordem de PAPEIS_NA_TAREFA (vazio: ela não está nela). */
export const papeisNaTarefa = (t: PessoasDaTarefa, pessoaId: string, perfilId: string | null = null) =>
  (Object.keys(CONFERE_PAPEL) as PapelNaTarefa[]).filter(papel => CONFERE_PAPEL[papel](t, pessoaId, perfilId));

type QuemEstaNaTarefa = Pick<Tarefa, 'criado_por' | 'responsavel_id' | 'participantes' | 'grupos'>;
type QuemEstaNaDemanda = Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores' | 'grupos'>;
/**
 * Na lista: a tarefa está aí só para ler? Altera quem está nela ou na demanda ligada (`equipe_da_demanda`, que vem quando quem lê
 * pode ver a demanda). Quem a vê só pelo contrato, o dela ou o da demanda, só lê (#326), como no cartão.
 */
export const soLeATarefaNaLista = (t: QuemEstaNaTarefa & { equipe_da_demanda: QuemEstaNaDemanda | null }, m: Pick<Membro, 'id' | 'papel'>, meusGrupos: readonly string[] = []) =>
  !estaNaTarefa(t, m as Membro, t.equipe_da_demanda, meusGrupos);
/**
 * Quem está na tarefa (como privado.estou_na_tarefa, sem a fase de adaptação): os administradores, quem criou, o responsável, os
 * participantes, quem está num grupo da equipe posto nela (`meusGrupos`, #378) e quem está na demanda ligada a ela (a demanda vem
 * quando está ligada e quem pergunta pode vê-la; também pelos grupos dela). É quem altera a tarefa.
 */
export const estaNaTarefa = (t: QuemEstaNaTarefa, m: Membro, demanda: QuemEstaNaDemanda | null = null, meusGrupos: readonly string[] = []) =>
  m.papel === 'master' || m.papel === 'admin' || m.id === t.criado_por || m.id === t.responsavel_id || t.participantes.includes(m.id)
  || estaPeloGrupo(t.grupos, meusGrupos) || (!!demanda && estaNaDemanda(demanda, m, meusGrupos));
/**
 * Quem vê a tarefa (como a regra de leitura do banco, #326): quem está nela e, só para ler, quem está no contrato da tarefa ou no
 * contrato da demanda ligada a ela (`contratosEmQueEsta`, como em veADemanda).
 */
export const veATarefa = (t: QuemEstaNaTarefa & { contrato_id?: string | null }, m: Membro,
  demanda: (QuemEstaNaDemanda & { contrato_id?: string | null }) | null = null, contratosDaPessoa: readonly string[] = [], meusGrupos: readonly string[] = []) =>
  estaNaTarefa(t, m, demanda, meusGrupos) || doContratoEmQueEsta(t.contrato_id, contratosDaPessoa) || doContratoEmQueEsta(demanda?.contrato_id, contratosDaPessoa);
/** O cartão com o contrato que veio com quem está nele (null: quem lê não pode abrir o contrato, e não se sabe quem está nele). */
type ComAEquipeDoContrato = { contrato_id?: string | null; contrato?: EquipeDoContrato | null };
/**
 * Por que o membro não pode ser mencionado na tarefa (null se pode): só quem a vê, como o gatilho do banco (#326: também quem está no
 * contrato dela ou no da demanda ligada). Os contratos contam quando vêm com quem está neles, isto é, quando quem comenta pode
 * abri-los; senão, conta só quem está na tarefa e na demanda (o banco ainda aceita quem está no contrato, se a menção for escrita à mão).
 */
export const motivoSemMencaoNaTarefa = (t: QuemEstaNaTarefa & ComAEquipeDoContrato, demanda: (QuemEstaNaDemanda & ComAEquipeDoContrato) | null = null) =>
  (m: Membro) => veATarefa(t, m, demanda, contratosEmQueEsta([t.contrato, demanda?.contrato], m)) ? null : 'não participa; inclua como participante';
/** A mensagem de quando alguém que não vê a tarefa aparece num comentário dela (a mesma do banco). */
export const mencaoNegadaNaTarefa = (nome: string) => `Não é possível mencionar ${nome} nesta tarefa: inclua essa pessoa como participante antes.`;

// ---------- a demanda quando as tarefas acabam ----------
/**
 * Todas as tarefas da demanda estão concluídas? Contam só as ativas (as arquivadas ficam de fora); sem nenhuma ativa,
 * não há o que oferecer. Quando sim, a tela oferece levar a demanda para a coluna-marco de concluídas.
 */
export const tarefasDaDemandaConcluidas = (tarefas: Pick<Tarefa, 'etapa_id' | 'arquivado_em'>[], colunaConcluida: string | null) => {
  const ativas = tarefas.filter(t => !t.arquivado_em);
  return !!colunaConcluida && ativas.length > 0 && ativas.every(t => t.etapa_id === colunaConcluida);
};
