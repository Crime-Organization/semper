// Regras da tarefa (módulo Tarefas): o cadastro por etapas, os papéis de cada pessoa, quem vê a tarefa, quem pode ser
// mencionado nos comentários e quando oferecer concluir a demanda. Tudo puro, sem tela nem banco.
import type { DadosTarefa, Demanda, Membro, PapelNaTarefa, Tarefa } from '../dados/tipos';
import { CLIENTES_MAXIMOS, COLABORADORES_MAXIMOS, TAMANHO_TAREFA } from '../dados/limites';
import { valorLegivelDemanda, veADemanda } from './demanda';
import { fmtData, lerData } from './pessoa';

/** Rótulo das tarefas fora das colunas do quadro. */
export const SEM_SITUACAO_TAREFA = 'Sem situação';

// ---------- formulário ----------
/** Campos do formulário de tarefa, como digitados. */
export interface CamposTarefa {
  titulo: string;
  descricao: string;
  /** dd/mm/aaaa, ou vazio. */
  prazo: string;
  responsavelId: string;
  participantes: string[];
  /** Uma por linha (o id da pessoa escolhida; linha vazia ainda sem pessoa). */
  pessoas: string[];
  demandaId: string;
  contratoId: string;
}
export const TAREFA_VAZIA: CamposTarefa = {
  titulo: '', descricao: '', prazo: '', responsavelId: '', participantes: [], pessoas: [''], demandaId: '', contratoId: ''
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
  return {
    titulo: c.titulo.trim(), descricao: c.descricao.trim() || null, prazo: lerData(c.prazo), responsavel_id: c.responsavelId,
    participantes: [...new Set(escolhidos(c.participantes))].filter(id => id !== c.responsavelId),
    pessoas: [...new Set(escolhidos(c.pessoas))], demanda_id: c.demandaId || null, contrato_id: c.contratoId || null
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
 * gravação que o tiraria dela. Por isso, ao passar a tarefa adiante ou sair dos participantes, a pessoa continua como
 * participante. Quem a vê pela demanda pode sair: o banco deixa (veja continuaPelaDemanda).
 */
export function semSairDaTarefa(d: DadosTarefa, eu: string, podeSair: boolean): { dados: DadosTarefa; ficou: boolean } {
  const participantes = d.participantes ?? [];
  if (podeSair || d.responsavel_id === eu || participantes.includes(eu)) return { dados: d, ficou: false };
  return { dados: { ...d, participantes: [...participantes, eu] }, ficou: true };
}

/** Campos do formulário a partir de uma tarefa salva (para atualizar). */
export const camposDaTarefa = (t: Tarefa): CamposTarefa => ({
  titulo: t.titulo, descricao: t.descricao || '', prazo: fmtData(t.prazo), responsavelId: t.responsavel_id,
  participantes: [...t.participantes], pessoas: t.pessoas.length ? t.pessoas.map(p => p.id) : [''],
  demandaId: t.demanda_id || '', contratoId: t.contrato_id || ''
});

// ---------- etapas do cadastro ----------
export type EtapaTarefa = 'tarefa' | 'pessoas' | 'ligacoes';
export interface DefinicaoEtapaTarefa { id: EtapaTarefa; titulo: string; texto: string; campos: (keyof CamposTarefa)[] }
/** As etapas do cadastro de tarefa, na ordem, como nos cadastros de pessoa, de contrato e de demanda. */
export const ETAPAS_TAREFA: DefinicaoEtapaTarefa[] = [
  { id: 'tarefa', titulo: 'A tarefa', texto: 'O que precisa ser feito e, se houver, o prazo.', campos: ['titulo', 'descricao', 'prazo'] },
  { id: 'pessoas', titulo: 'Pessoas', texto: 'Quem faz a tarefa, quem da equipe ajuda e, se houver, as pessoas do cadastro ligadas a ela.',
    campos: ['responsavelId', 'participantes', 'pessoas'] },
  { id: 'ligacoes', titulo: 'Demanda e contrato', texto: 'Se a tarefa é parte de uma demanda ou vem de um contrato, ligue aqui. Não é obrigatório.',
    campos: ['demandaId', 'contratoId'] }
];
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
  titulo: 'Título', descricao: 'Descrição', prazo: 'Prazo', responsavel_id: 'Responsável', participantes: 'Participantes',
  pessoas: 'Pessoas', demanda: 'Demanda', contrato: 'Contrato', etapa: 'Situação', arquivado_em: 'Arquivamento'
};
/** Como cada campo aparece no cartão e no histórico (o prazo como dia/mês/ano, vazio como traço), igual às demandas. */
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

type QuemEstaNaTarefa = Pick<Tarefa, 'criado_por' | 'responsavel_id' | 'participantes'>;
type QuemEstaNaDemanda = Pick<Demanda, 'criado_por' | 'responsavel_id' | 'colaboradores'>;
/**
 * Quem vê a tarefa (como a regra do banco): os administradores, quem criou, o responsável, os participantes e quem vê a
 * demanda ligada a ela (a demanda vem quando está ligada e quem pergunta pode vê-la).
 */
export const veATarefa = (t: QuemEstaNaTarefa, m: Membro, demanda: QuemEstaNaDemanda | null = null) =>
  m.papel === 'master' || m.papel === 'admin' || m.id === t.criado_por || m.id === t.responsavel_id || t.participantes.includes(m.id)
  || (!!demanda && veADemanda(demanda, m));
/** Por que o membro não pode ser mencionado na tarefa (null se pode): só quem vê a tarefa. */
export const motivoSemMencaoNaTarefa = (t: QuemEstaNaTarefa, demanda: QuemEstaNaDemanda | null = null) =>
  (m: Membro) => veATarefa(t, m, demanda) ? null : 'não participa; inclua como participante';
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
