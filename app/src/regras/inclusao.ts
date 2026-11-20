// Aviso na caixa de Mensagens para quem entra num item (#377): as palavras de cada módulo, os rótulos da linha e o papel de cada
// pessoa entre duas versões da equipe. Quem recebe e quando, é o banco que decide (supabase/migrations/20261119193326_aviso_ao_ser_incluido.sql);
// o banco fictício segue a mesma regra por mudancasDaEquipe e avisoDaMudanca.
import type { EntrouComo, InclusaoDaMensagem, ItemDaInclusao, ModuloDoPedido } from '../dados/tipos';
import { AVISO_DESFEITO } from '../ui/tempos';
import { enderecoDoItemDoPedido } from './pedidoDeParticipacao';

/** As palavras de cada módulo. Módulo novo = uma entrada nova. */
export interface InclusaoDoModulo {
  /** O que quem incluiu fez: "incluiu você na tarefa", "pôs você como responsável pela tarefa". */
  acao: Record<EntrouComo, string>;
  /** A segunda linha, o que mudou para quem recebe: "Agora você é participante da tarefa." */
  agora: Record<EntrouComo, string>;
  /** Para quem foi retirado depois (sem o nome do item): "Você não faz mais parte desta tarefa." */
  naoFazMais: string;
  /** "a tarefa", no rótulo do botão: "Marcar como lida a mensagem de Ana sobre a tarefa X". */
  oItem: string;
  /** "uma tarefa", no rótulo do botão de quem foi retirado: "… de uma tarefa de que você não faz mais parte". */
  umItem: string;
}
const AGORA_RESPONSAVEL = 'Agora você é o responsável.';
export const INCLUSAO_DO_MODULO: Record<ModuloDoPedido, InclusaoDoModulo> = {
  tarefas: {
    acao: { participante: 'incluiu você na tarefa', responsavel: 'pôs você como responsável pela tarefa' },
    agora: { participante: 'Agora você é participante da tarefa.', responsavel: AGORA_RESPONSAVEL },
    naoFazMais: 'Você não faz mais parte desta tarefa.', oItem: 'a tarefa', umItem: 'uma tarefa'
  },
  demandas: {
    acao: { participante: 'incluiu você na demanda', responsavel: 'pôs você como responsável pela demanda' },
    agora: { participante: 'Agora você é colaborador da demanda.', responsavel: AGORA_RESPONSAVEL },
    naoFazMais: 'Você não faz mais parte desta demanda.', oItem: 'a demanda', umItem: 'uma demanda'
  },
  processos: {
    acao: { participante: 'incluiu você no processo', responsavel: 'pôs você como responsável pelo processo' },
    agora: { participante: 'Agora você é colaborador do processo.', responsavel: AGORA_RESPONSAVEL },
    naoFazMais: 'Você não faz mais parte deste processo.', oItem: 'o processo', umItem: 'um processo'
  },
  compromissos: {
    acao: { participante: 'incluiu você no compromisso', responsavel: 'pôs você como responsável pelo compromisso' },
    agora: { participante: 'Agora você é participante do compromisso.', responsavel: AGORA_RESPONSAVEL },
    naoFazMais: 'Você não faz mais parte deste compromisso.', oItem: 'o compromisso', umItem: 'um compromisso'
  },
  contratos: {
    acao: { participante: 'incluiu você no contrato', responsavel: 'pôs você como responsável pelo contrato' },
    agora: { participante: 'Agora você é participante do contrato.', responsavel: AGORA_RESPONSAVEL },
    naoFazMais: 'Você não faz mais parte deste contrato.', oItem: 'o contrato', umItem: 'um contrato'
  },
  anotacoes: {
    acao: { participante: 'compartilhou com você a anotação', responsavel: 'pôs você como responsável pela anotação' },
    agora: { participante: 'Agora a anotação está compartilhada com você.', responsavel: AGORA_RESPONSAVEL },
    naoFazMais: 'Esta anotação não está mais compartilhada com você.', oItem: 'a anotação', umItem: 'uma anotação'
  }
};

/**
 * O que quem incluiu fez, com o grupo pelo qual a pessoa entrou (#378): "incluiu você, pelo grupo Núcleo A, na demanda". Sem grupo
 * (ou como responsável), a frase de sempre.
 */
export const acaoDaInclusao = (i: Pick<InclusaoDaMensagem, 'modulo' | 'entrou_como' | 'grupo'>) => {
  const acao = INCLUSAO_DO_MODULO[i.modulo].acao[i.entrou_como];
  return i.grupo && i.entrou_como === 'participante' ? acao.replace('você', `você, pelo grupo ${i.grupo},`) : acao;
};

/** O nome do item na mensagem: o título (no contrato, o serviço); sem ele, o código. */
export const nomeDoItemDaInclusao = (item: ItemDaInclusao) => item.nome || item.codigo;

/** O endereço que abre o cartão do item (o mesmo do pedido para participar); null quando não há página (o processo sem tipo). */
export const enderecoDaInclusao = (modulo: ModuloDoPedido, item: ItemDaInclusao) =>
  enderecoDoItemDoPedido({ modulo, item_id: item.id, tipo_do_processo: item.tipo_do_processo });

/**
 * Os rótulos da linha e do botão "Marcar como lida". Com o item, têm quem incluiu e o nome do item (duas inclusões da mesma pessoa
 * não ficam com o mesmo rótulo); sem ele, só o módulo, sem nada do item. O botão começa pelo texto que aparece nele.
 */
export function rotulosDaInclusao(i: InclusaoDaMensagem, quem: string, situacao: string) {
  const m = INCLUSAO_DO_MODULO[i.modulo];
  if (!i.item) {
    return { linha: `Aviso ${situacao}: ${m.naoFazMais.replace(/\.$/, '')}`, marcarLida: `Marcar como lida a mensagem de ${m.umItem} de que você não faz mais parte` };
  }
  const nome = nomeDoItemDaInclusao(i.item);
  return { linha: `Aviso ${situacao}: ${quem} ${acaoDaInclusao(i)} ${nome}`, marcarLida: `Marcar como lida a mensagem de ${quem} sobre ${m.oItem} ${nome}` };
}

/** A equipe de um item: o responsável e os perfis da equipe (no contrato, os das pessoas participantes da divisão). */
export interface EquipeDoItem { responsavel_id: string | null; equipe: readonly string[] }
/** O papel de uma pessoa num item: o responsável, participante (na equipe) ou nenhum (fora do item). */
export type PapelNoItem = EntrouComo | 'nenhum';
export interface MudancaDePapel { perfil: string; antes: PapelNoItem; agora: PapelNoItem }

function papelNoItem(equipe: EquipeDoItem | null, perfil: string): PapelNoItem {
  if (equipe?.responsavel_id === perfil) return 'responsavel';
  return equipe?.equipe.includes(perfil) ? 'participante' : 'nenhum';
}

/** O papel de cada pessoa que mudou entre a equipe de antes (null: o item é novo) e a de agora, uma vez por pessoa. */
export function mudancasDaEquipe(antes: EquipeDoItem | null, agora: EquipeDoItem): MudancaDePapel[] {
  const perfis = new Set([antes?.responsavel_id, ...(antes?.equipe ?? []), agora.responsavel_id, ...agora.equipe].filter((p): p is string => !!p));
  return [...perfis].map(perfil => ({ perfil, antes: papelNoItem(antes, perfil), agora: papelNoItem(agora, perfil) })).filter(m => m.antes !== m.agora);
}

/**
 * O aviso de quem passa de um papel a outro (null: nenhum), como privado.avisar_inclusao: passar a responsável avisa como
 * responsável; entrar na equipe sem estar no item avisa como participante; sair e o responsável que passa a participante, não.
 */
export const AVISO_DA_MUDANCA: Record<PapelNoItem, Record<PapelNoItem, EntrouComo | null>> = {
  nenhum: { nenhum: null, participante: 'participante', responsavel: 'responsavel' },
  participante: { nenhum: null, participante: null, responsavel: 'responsavel' },
  responsavel: { nenhum: null, participante: null, responsavel: null }
};

/** Uma sequência de mudanças no papel de uma pessoa num item: o papel de antes da primeira, quando ela começou e a última (em ms). */
export interface SequenciaDeMudancas { papel_de_antes: PapelNoItem; desde: number; em: number }

/**
 * As mudanças que vêm a menos de AVISO_DESFEITO uma da outra contam como uma só (o desfazer, o Ctrl+Z, a troca logo corrigida):
 * vale o papel em que a pessoa ficou, comparado com o de antes da primeira. Devolve a sequência depois desta mudança (a que vinha,
 * com a última mudança agora, ou uma nova) e o aviso que vale. Quem usa apaga os avisos da sequência (os criados desde `desde`)
 * que a pessoa não leu e que não são o que vale, e cria o que vale, se ela ainda não tem um dele na sequência.
 */
export function avisoDaMudanca(mudanca: MudancaDePapel, anterior: SequenciaDeMudancas | undefined, agora: number) {
  const sequencia: SequenciaDeMudancas = anterior && agora - anterior.em < AVISO_DESFEITO
    ? { ...anterior, em: agora }
    : { papel_de_antes: mudanca.antes, desde: agora, em: agora };
  return { sequencia, aviso: AVISO_DA_MUDANCA[sequencia.papel_de_antes][mudanca.agora] };
}
