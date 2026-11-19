// A equipe do contrato mudada no topo do cartão (#356), nas bolinhas: pôr um participante, tirá-lo e trocar o responsável, sem
// abrir o lápis. Valem as regras do lápis do contrato: o participante é uma pessoa do cadastro (a de alguém da equipe), com o seu %
// da divisão; o indicador não pode ser também participante; a lista tem o máximo do banco; o responsável é um advogado da equipe,
// e trocá-lo não mexe nos participantes. Decisão do dono (18/11): quem entra pela bolinha fica com 0%, e o % de cada um continua
// sendo mudado no lápis. A mudança que deixaria quem grava fora do contrato é recusada, e a bolinha já aparece desligada, com o
// motivo (IMPEDIMENTO_NO_CONTRATO): o contrato não tem a saída em dois passos dos outros cartões (#276), que pergunta antes e
// sai, e o banco recusa a gravação com que a pessoa deixaria de vê-lo. A regra daqui é a de alterar (alteraOContrato), um pouco
// mais rígida que a de ver do banco: quem foi mencionado num comentário continuaria vendo, mas a tela não sabe das menções, e
// sem estar no contrato ninguém mais o altera. Por isso o motivo fala em deixar de poder alterá-lo, e não em deixar de vê-lo.
// A tela lê o contrato logo antes de gravar, para não apagar o que outra pessoa acabou de pôr; estas regras dizem o que gravar.
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import type { Contrato, DadosContrato, ParticipanteGravado } from '../dados/tipos';
import { alteraOContrato, fmtPercentual, PARTICIPANTES_DEMAIS } from './contrato';
import type { PedidoNaEquipe, TipoDeMudanca } from './equipeNoCartao';

/** Decisão do dono (18/11): quem entra no contrato pela bolinha com "+" fica com 0% na divisão; o % se muda no lápis. */
export const PERCENTUAL_DE_QUEM_ENTRA = 0;

/** A equipe do contrato como está gravada: quem o criou, o responsável (usuário), o indicador e os participantes (pessoas, com o %). */
export interface EquipeDoContratoGravada {
  criado_por: string | null;
  responsavel_id: string;
  indicador_id: string | null;
  participantes: ParticipanteGravado[];
}
/** O que gravar, pela função de dados do lápis: os participantes (pôr e tirar) ou o responsável (trocar). */
export type EquipeDoContratoAGravar = Pick<DadosContrato, 'responsavel_id' | 'participantes'>;
/**
 * Uma mudança pedida na tela. Em pôr e tirar, o `id` é o da pessoa no cadastro (o contrato guarda o participante pela pessoa); na
 * troca do responsável, o do usuário.
 */
export type PedidoNoContrato = PedidoNaEquipe;
/** O que uma mudança dá: o que gravar, ou o aviso de por que nada é gravado (já estava assim: 'info'; não pode: 'erro'). */
export type MudancaNoContrato = { gravar: EquipeDoContratoAGravar } | { aviso: string; tipo: 'info' | 'erro' };
/** Quem está mudando: o usuário, a pessoa dele no cadastro e o papel (administrador ou não). */
export interface QuemMuda { id: string; pessoa_id?: string | null; papel: string }

/** A equipe gravada de um contrato lido do banco. */
export const equipeDoContrato = (k: Pick<Contrato, 'criado_por' | 'responsavel_id' | 'indicador_id' | 'participantes'>): EquipeDoContratoGravada => ({
  criado_por: k.criado_por, responsavel_id: k.responsavel_id, indicador_id: k.indicador_id,
  participantes: k.participantes.map(p => ({ pessoa_id: p.pessoa.id, percentual: p.percentual }))
});

const participa = (atual: EquipeDoContratoGravada, pessoaId: string) => atual.participantes.some(p => p.pessoa_id === pessoaId);

/** Cada mudança, sobre a equipe gravada agora (`atual`). Uma entrada por tipo: tipo novo = entrada nova. */
export const MUDANCAS_NO_CONTRATO: Record<TipoDeMudanca, (atual: EquipeDoContratoGravada, id: string, nome: string) => MudancaNoContrato> = {
  // Põe no fim da lista, com 0%, sem repetir, sem o indicador e até o máximo do banco.
  por: (atual, id, nome) => {
    if (id === atual.indicador_id) return { aviso: `${nome} é o indicador deste contrato, e o indicador não pode ser também participante.`, tipo: 'erro' };
    if (participa(atual, id)) return { aviso: `${nome} já participa do contrato.`, tipo: 'info' };
    if (atual.participantes.length >= PARTICIPANTES_MAXIMOS) return { aviso: PARTICIPANTES_DEMAIS, tipo: 'erro' };
    return { gravar: { participantes: [...atual.participantes, { pessoa_id: id, percentual: PERCENTUAL_DE_QUEM_ENTRA }] } };
  },
  // Tira da lista (com o % dele); quem outra pessoa já tirou fica como está.
  tirar: (atual, id, nome) => participa(atual, id)
    ? { gravar: { participantes: atual.participantes.filter(p => p.pessoa_id !== id) } }
    : { aviso: `${nome} já não participava do contrato.`, tipo: 'info' },
  // Troca o responsável, como o lápis: os participantes e os % deles ficam como estão.
  responsavel: (atual, id, nome) => id === atual.responsavel_id
    ? { aviso: `${nome} já é o advogado responsável pelo contrato.`, tipo: 'info' }
    : { gravar: { responsavel_id: id } }
};

/** Por que a mudança é recusada quando deixaria quem grava fora do contrato (pôr alguém nunca deixa). */
export const FICARIA_FORA: Record<TipoDeMudanca, string> = {
  por: 'Sem estar no contrato, você deixaria de poder alterá-lo.',
  tirar: 'Você não pode sair deste contrato: sem estar nele, deixaria de poder alterá-lo. Peça a quem o cadastrou ou a um administrador.',
  responsavel: 'Você não pode passar este contrato a outro advogado: sem estar nele, deixaria de poder alterá-lo. Ponha-se antes como participante, ou peça a quem o cadastrou ou a um administrador.'
};

/**
 * O plano da mudança sobre a equipe gravada agora: o que gravar, ou o aviso de por que nada se grava. Como no lápis, quem deixaria
 * de estar no contrato com a gravação (não é administrador, não o cadastrou e sai da equipe dele) não grava.
 */
export function planoNoContrato(pedido: PedidoNoContrato, atual: EquipeDoContratoGravada, eu: QuemMuda): MudancaNoContrato {
  const r = MUDANCAS_NO_CONTRATO[pedido.tipo](atual, pedido.id, pedido.nome);
  if ('aviso' in r) return r;
  const depois = {
    criado_por: atual.criado_por, responsavel_id: r.gravar.responsavel_id ?? atual.responsavel_id,
    participantes: (r.gravar.participantes ?? atual.participantes).map(p => p.pessoa_id)
  };
  return alteraOContrato(depois, eu) ? r : { aviso: FICARIA_FORA[pedido.tipo], tipo: 'erro' };
}

/**
 * Um advogado qualquer que não é quem muda, para saber, antes de abrir a busca, se passar o contrato adiante deixaria quem muda
 * de fora (nenhum usuário tem o id vazio, e a busca do responsável nunca oferece o de agora).
 */
const OUTRO_ADVOGADO = '';

/**
 * Antes do clique, pelo mesmo cálculo de planoNoContrato sobre o contrato carregado: por que a bolinha não faz a mudança (ela
 * deixaria quem muda fora do contrato). Assim a bolinha aparece desligada, com o motivo na dica, e não oferece uma ação que
 * seria recusada. undefined: a bolinha faz a mudança.
 * - Tirar: a pessoa tirada (`pessoaId`, a do cadastro) é quem muda, e ela não ficaria no contrato por outro caminho.
 * - Responsável: quem muda só está no contrato por ser o responsável.
 */
export const IMPEDIMENTO_NO_CONTRATO = {
  tirar: (atual: EquipeDoContratoGravada, pessoaId: string, eu: QuemMuda) => impedimento({ tipo: 'tirar', id: pessoaId, nome: '' }, atual, eu),
  responsavel: (atual: EquipeDoContratoGravada, eu: QuemMuda) => impedimento({ tipo: 'responsavel', id: OUTRO_ADVOGADO, nome: '' }, atual, eu)
};
function impedimento(pedido: PedidoNoContrato, atual: EquipeDoContratoGravada, eu: QuemMuda) {
  const r = planoNoContrato(pedido, atual, eu);
  return 'aviso' in r && r.aviso === FICARIA_FORA[pedido.tipo] ? r.aviso : undefined;
}

/** O aviso de cada mudança gravada. */
export const AVISO_NO_CONTRATO: Record<TipoDeMudanca, (nome: string) => string> = {
  por: nome => `${nome} agora participa do contrato, com ${PERCENTUAL_DE_QUEM_ENTRA}% na divisão. O % se muda em Editar.`,
  tirar: nome => `${nome} saiu do contrato.`,
  responsavel: nome => `Advogado responsável pelo contrato: ${nome}.`
};

/**
 * O que a bolinha de um participante diz, na dica e para o leitor de tela (o clique o tira), com o % dele, que de outro jeito só
 * apareceria em Honorários: "Tirar Ana Souza · 10%", ou "Sair do contrato (Ana Souza · 10%)", na própria.
 */
export const tirarDoContrato = (p: { id: string; nome: string }, eu: string, percentual: number | null) => {
  const quem = percentual === null ? p.nome : `${p.nome} · ${fmtPercentual(percentual)}`;
  return p.id === eu ? `Sair do contrato (${quem})` : `Tirar ${quem}`;
};

/**
 * O que o Desfazer grava, com o contrato lido de novo (`atual`): volta só o que esta mudança fez, e o que outra pessoa mudou depois
 * fica como ela deixou. null quando não há o que voltar (quem entrou já saiu; o responsável já foi trocado de novo).
 * - Pôr: tira quem entrou, se ainda está na lista.
 * - Tirar: põe de volta no lugar de antes e com o % de antes, se ainda não voltou (indicador ou lista cheia: `aviso`).
 * - Trocar o responsável: o de antes volta, se o novo ainda é o responsável.
 */
export function desfazerNoContrato(pedido: PedidoNoContrato, antes: EquipeDoContratoGravada, atual: EquipeDoContratoGravada): EquipeDoContratoAGravar | { aviso: string } | null {
  const DESFAZER: Record<TipoDeMudanca, () => EquipeDoContratoAGravar | { aviso: string } | null> = {
    por: () => participa(atual, pedido.id) ? { participantes: atual.participantes.filter(p => p.pessoa_id !== pedido.id) } : null,
    tirar: () => {
      const lugar = antes.participantes.findIndex(p => p.pessoa_id === pedido.id);
      const r = MUDANCAS_NO_CONTRATO.por(atual, pedido.id, pedido.nome);
      if ('aviso' in r) return r.tipo === 'erro' ? { aviso: r.aviso } : null;
      return { participantes: atual.participantes.toSpliced(Math.min(lugar, atual.participantes.length), 0, antes.participantes[lugar]) };
    },
    responsavel: () => atual.responsavel_id === pedido.id ? { responsavel_id: antes.responsavel_id } : null
  };
  return DESFAZER[pedido.tipo]();
}
