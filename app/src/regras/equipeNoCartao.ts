// A equipe mudada no topo do cartão (#356): nas bolinhas, pôr e tirar participantes, trocar o responsável e (#388) tornar um
// participante responsável, sem abrir o lápis.
// Valem as regras do lápis de cada módulo: o responsável é qualquer um da equipe ativa e sai da lista de participantes ao entrar,
// a lista tem o máximo do banco e quem se tira do cartão sai pela regra da #276 (pessoasAoGravar, em sairDoCartao.ts). A tela lê
// a equipe gravada logo antes de gravar, para não apagar o que outra pessoa acabou de pôr; estas regras dizem o que gravar.
// O contrato tem as suas regras (equipeDoContrato.ts): lá cada participante tem o seu % da divisão, e quem entra pela bolinha fica com 0%.
import { COLABORADORES_MAXIMOS } from '../dados/limites';
import type { ModuloComSaida } from '../dados/tipos';
import { pessoasAoGravar, type CartaoAntes } from './sairDoCartao';

/** Os cartões que mudam a equipe nas bolinhas: os mesmos de onde a pessoa pode sair (#276). */
export type ModuloDaEquipe = ModuloComSaida;

/** A equipe de um cartão como está gravada: o responsável e a lista (participantes ou colaboradores). */
export type EquipeGravada = CartaoAntes;
/** O que gravar: a lista nova e, na troca, o responsável novo. */
export interface EquipeAGravar { responsavel_id?: string; lista: string[] }

/** As palavras de cada módulo, para os botões e os avisos. */
export interface EquipeDoModulo {
  /** O papel de quem está na lista, na bolinha: "Participante". */
  papel: string;
  /** O botão redondo com "+": "Pôr participante". */
  por: string;
  /** O mesmo botão com grupos da equipe no escritório (#378): "Pôr participante ou grupo". */
  porOuGrupo: string;
  /** O "Tirar" do menu da própria bolinha (tirarPelaBolinha) e o aviso de sair: "Sair da tarefa". */
  sair: string;
  /** "na tarefa": "Ana já estava na tarefa." */
  noItem: string;
  /** "da tarefa": "Ana saiu da tarefa." */
  doItem: string;
  /** "pela tarefa": "Responsável pela tarefa: Ana." */
  peloItem: string;
  /** Quantos cabem na lista (o banco recusa mais que isso). */
  maximo: number;
  /** O aviso de lista cheia: "Uma tarefa pode ter até 20 participantes." */
  cheia: string;
  /** O nome da ação, para o Desfazer: "mudança na equipe da tarefa". */
  oQue: string;
}

export const EQUIPE_DO_MODULO: Record<ModuloDaEquipe, EquipeDoModulo> = {
  tarefas: {
    papel: 'Participante', por: 'Pôr participante', porOuGrupo: 'Pôr participante ou grupo', sair: 'Sair da tarefa', noItem: 'na tarefa', doItem: 'da tarefa',
    peloItem: 'pela tarefa', maximo: COLABORADORES_MAXIMOS, cheia: `Uma tarefa pode ter até ${COLABORADORES_MAXIMOS} participantes.`, oQue: 'mudança na equipe da tarefa'
  },
  demandas: {
    papel: 'Colaborador', por: 'Pôr colaborador', porOuGrupo: 'Pôr colaborador ou grupo', sair: 'Sair da demanda', noItem: 'na demanda', doItem: 'da demanda',
    peloItem: 'pela demanda', maximo: COLABORADORES_MAXIMOS, cheia: `Uma demanda pode ter até ${COLABORADORES_MAXIMOS} colaboradores.`, oQue: 'mudança na equipe da demanda'
  },
  processos: {
    papel: 'Colaborador', por: 'Pôr colaborador', porOuGrupo: 'Pôr colaborador ou grupo', sair: 'Sair do processo', noItem: 'no processo', doItem: 'do processo',
    peloItem: 'pelo processo', maximo: COLABORADORES_MAXIMOS, cheia: `Um processo pode ter até ${COLABORADORES_MAXIMOS} colaboradores.`, oQue: 'mudança na equipe do processo'
  },
  compromissos: {
    papel: 'Participante', por: 'Pôr participante', porOuGrupo: 'Pôr participante ou grupo', sair: 'Sair do compromisso', noItem: 'no compromisso', doItem: 'do compromisso',
    peloItem: 'pelo compromisso', maximo: COLABORADORES_MAXIMOS, cheia: `Um compromisso pode ter até ${COLABORADORES_MAXIMOS} participantes.`, oQue: 'mudança na equipe do compromisso'
  },
  anotacoes: {
    papel: 'Compartilhada', por: 'Compartilhar com mais alguém', porOuGrupo: 'Compartilhar com alguém ou um grupo', sair: 'Sair da anotação', noItem: 'na anotação', doItem: 'da anotação',
    peloItem: 'pela anotação', maximo: COLABORADORES_MAXIMOS, cheia: `Uma anotação pode ser compartilhada com até ${COLABORADORES_MAXIMOS} pessoas.`, oQue: 'mudança na equipe da anotação'
  }
};

/** O que uma mudança dá: o que gravar, ou o aviso de por que nada é gravado (já estava assim: 'info'; a lista está cheia: 'erro'). */
export type MudancaNaEquipe = { gravar: EquipeAGravar } | { aviso: string; tipo: 'info' | 'erro' };

/**
 * As mudanças das bolinhas: pôr, tirar, trocar o responsável (pela busca) e tornar responsável quem já está na lista (#388, pelo
 * menu da bolinha dele).
 */
export type TipoDeMudanca = 'por' | 'tirar' | 'responsavel' | 'tornarResponsavel';
/** Uma mudança pedida na tela: o tipo, quem (o id do usuário) e o nome dele, para os avisos. */
export interface PedidoNaEquipe { tipo: TipoDeMudanca; id: string; nome: string }

/** Cada mudança, sobre a equipe gravada agora (`atual`). Uma entrada por tipo: tipo novo = entrada nova. */
export const MUDANCAS: Record<TipoDeMudanca, (modulo: ModuloDaEquipe, atual: EquipeGravada, id: string, nome: string) => MudancaNaEquipe> = {
  // Põe no fim da lista, sem repetir, sem o responsável e até o máximo do módulo.
  por: (modulo, atual, id, nome) => {
    const m = EQUIPE_DO_MODULO[modulo];
    if (id === atual.responsavel_id) return { aviso: `${nome} já é responsável ${m.peloItem}.`, tipo: 'info' };
    if (atual.lista.includes(id)) return { aviso: `${nome} já estava ${m.noItem}.`, tipo: 'info' };
    if (atual.lista.length >= m.maximo) return { aviso: m.cheia, tipo: 'erro' };
    return { gravar: { lista: [...atual.lista, id] } };
  },
  // Tira da lista; quem outra pessoa já tirou fica como está.
  tirar: (modulo, atual, id, nome) => atual.lista.includes(id)
    ? { gravar: { lista: atual.lista.filter(x => x !== id) } }
    : { aviso: `${nome} já não estava ${EQUIPE_DO_MODULO[modulo].noItem}.`, tipo: 'info' },
  // Troca o responsável, como o lápis: quem passa a responder sai da lista de participantes (se estava nela).
  responsavel: (modulo, atual, id, nome) => id === atual.responsavel_id
    ? { aviso: `${nome} já é responsável ${EQUIPE_DO_MODULO[modulo].peloItem}.`, tipo: 'info' }
    : { gravar: { responsavel_id: id, lista: atual.lista.filter(x => x !== id) } },
  // Decisão do dono (#388): quem estava na lista passa a responder, e o responsável de antes continua no item, no lugar dele na
  // lista (sem responsável gravado, o usuário excluído, só sai da lista quem foi promovido). Se outra pessoa já o tinha tirado da
  // lista, o de antes entra no fim, e aí vale o máximo do módulo.
  tornarResponsavel: (modulo, atual, id, nome) => {
    const m = EQUIPE_DO_MODULO[modulo];
    if (id === atual.responsavel_id) return { aviso: `${nome} já é responsável ${m.peloItem}.`, tipo: 'info' };
    const antigo = atual.responsavel_id;
    const semAntigo = atual.lista.filter(x => x !== antigo);
    const lista = !antigo ? semAntigo.filter(x => x !== id)
      : semAntigo.includes(id) ? semAntigo.map(x => x === id ? antigo : x) : [...semAntigo, antigo];
    if (lista.length > m.maximo) return { aviso: m.cheia, tipo: 'erro' };
    return { gravar: { responsavel_id: id, lista } };
  }
};

/** Como quem muda a equipe sai do cartão, pelas regras do lápis de cada módulo (#276). */
export interface SaidaDaPessoa {
  /** Quem está mudando. */
  eu: string;
  /** O banco aceita a gravação que a deixa fora do cartão (administrador, quem criou, fase de adaptação…)? */
  podeSair: boolean;
  /** Ela continua vendo o cartão pelo item ligado (a demanda da tarefa, o processo do compromisso)? */
  peloLigado?: boolean;
}

/**
 * O plano da mudança sobre a equipe gravada agora: o que gravar e se a pessoa sai do cartão depois (`sai`), ou o aviso de por que
 * nada se grava. Quem se tira (ou passa o cartão a outro) e não pode gravar fora dele fica nesta gravação e sai depois, por
 * SD.cartaoSair, como no lápis (pessoasAoGravar).
 */
export function planoDaMudanca(modulo: ModuloDaEquipe, pedido: PedidoNaEquipe, atual: EquipeGravada, saida: SaidaDaPessoa):
  { gravar: EquipeAGravar; sai: boolean } | { aviso: string; tipo: 'info' | 'erro' } {
  const r = MUDANCAS[pedido.tipo](modulo, atual, pedido.id, pedido.nome);
  if ('aviso' in r) return r;
  const { lista, ficou } = pessoasAoGravar(r.gravar.lista, r.gravar.responsavel_id ?? atual.responsavel_id, saida.eu, atual, saida.podeSair, saida.peloLigado);
  return { gravar: { ...r.gravar, lista }, sai: ficou };
}

/** O aviso de cada mudança gravada. */
export const AVISO_DA_MUDANCA: Record<TipoDeMudanca, (modulo: ModuloDaEquipe, nome: string) => string> = {
  por: (modulo, nome) => `${nome} agora está ${EQUIPE_DO_MODULO[modulo].noItem}.`,
  tirar: (modulo, nome) => `${nome} saiu ${EQUIPE_DO_MODULO[modulo].doItem}.`,
  responsavel: (modulo, nome) => `Responsável ${EQUIPE_DO_MODULO[modulo].peloItem}: ${nome}.`,
  tornarResponsavel: (modulo, nome) => {
    const m = EQUIPE_DO_MODULO[modulo];
    return `Responsável ${m.peloItem}: ${nome}. Quem respondia antes continua ${m.noItem}.`;
  }
};

/**
 * O aviso quando a equipe foi gravada, mas a saída da pessoa (o segundo passo, SD.cartaoSair) falhou. Nas bolinhas não há Salvar:
 * ela sai de novo pela própria bolinha.
 */
export const saidaPelaBolinhaFalhou = (modulo: ModuloDaEquipe) => {
  const m = EQUIPE_DO_MODULO[modulo];
  return `A equipe foi gravada, mas você continua ${m.noItem}. Para sair, use "${m.sair}" de novo na sua bolinha.`;
};

/**
 * O "Tirar" do menu da bolinha de quem está na lista (#388; o nome e o papel já estão no alto do menu): "Tirar da tarefa"; na
 * própria bolinha, sair do cartão ("Sair da tarefa").
 */
export const tirarPelaBolinha = (modulo: ModuloDaEquipe, p: { id: string }, eu: string) =>
  p.id === eu ? EQUIPE_DO_MODULO[modulo].sair : `Tirar ${EQUIPE_DO_MODULO[modulo].doItem}`;

/**
 * O que o Desfazer grava, com a equipe lida de novo (`atual`): volta só o que esta mudança fez, e o que outra pessoa mudou depois
 * fica como ela deixou. null quando não há o que voltar (quem entrou já saiu; o responsável já foi trocado de novo).
 * - Pôr: tira quem entrou, se ainda está na lista.
 * - Tirar: põe de volta no fim, se ainda não voltou e não é o responsável (cheia, a recusa de pôr vale: `aviso`).
 * - Trocar o responsável: o de antes volta, se o novo ainda é o responsável; o novo volta à lista se estava nela antes.
 * - Tornar responsável: o de antes volta a responder, se o novo ainda é o responsável, e sai da lista; o novo volta a ela, no
 *   lugar em que o de antes estava (se outra pessoa já tirou o de antes, no fim).
 */
export function desfazerMudanca(modulo: ModuloDaEquipe, pedido: PedidoNaEquipe, antes: EquipeGravada, atual: EquipeGravada): EquipeAGravar | { aviso: string } | null {
  const DESFAZER: Record<TipoDeMudanca, () => EquipeAGravar | { aviso: string } | null> = {
    por: () => atual.lista.includes(pedido.id) ? { lista: atual.lista.filter(x => x !== pedido.id) } : null,
    tirar: () => {
      const r = MUDANCAS.por(modulo, atual, pedido.id, pedido.nome);
      if ('gravar' in r) return r.gravar;
      return r.tipo === 'erro' ? { aviso: r.aviso } : null;
    },
    responsavel: () => {
      if (atual.responsavel_id !== pedido.id) return null;
      const lista = atual.lista.filter(x => x !== antes.responsavel_id);
      return { responsavel_id: antes.responsavel_id, lista: antes.lista.includes(pedido.id) && !lista.includes(pedido.id) ? [...lista, pedido.id] : lista };
    },
    tornarResponsavel: () => {
      if (atual.responsavel_id !== pedido.id) return null;
      const lugar = atual.lista.indexOf(antes.responsavel_id);
      const volta = !antes.lista.includes(pedido.id) || atual.lista.includes(pedido.id) ? atual.lista.filter(x => x !== antes.responsavel_id)
        : lugar < 0 ? [...atual.lista, pedido.id] : atual.lista.with(lugar, pedido.id);
      return { responsavel_id: antes.responsavel_id, lista: volta };
    }
  };
  return DESFAZER[pedido.tipo]();
}
