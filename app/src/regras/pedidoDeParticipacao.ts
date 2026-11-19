// Pedir para participar de um item de que ainda não faço parte (#363): as palavras de cada módulo, para onde cada mensagem leva,
// o que a linha da busca geral mostra e o que aparece no histórico. Quem pode pedir e aprovar, e o que muda no item, é o banco que
// confere (supabase/migrations/20261118220000_pedidos_de_participacao.sql); aqui fica só o que a tela mostra.
import type { ModuloDoPedido, PedidoDaMensagem, SituacaoDoPedido, TipoProcesso } from '../dados/tipos';
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import { EQUIPE_DO_MODULO } from './equipeNoCartao';
import { TIPOS_PROCESSO } from './processo';

/** As palavras de cada módulo e a página do cartão. Módulo novo = uma entrada nova. */
export interface PedidoDoModulo {
  /** "da tarefa": "pediu para participar da tarefa F00D1234". */
  doItem: string;
  /** O que acontece ao aprovar, para quem aprova: "entra como participante". */
  aoAprovar: string;
  /** O que mudou, para quem pediu: "Agora você é participante da tarefa." */
  aprovado: string;
  /** A página do cartão (o processo depende do tipo; sem ele, a pessoa não vê o processo: sem endereço). */
  pagina: (tipoDoProcesso: TipoProcesso | null) => string | null;
}
export const PEDIDO_DO_MODULO: Record<ModuloDoPedido, PedidoDoModulo> = {
  tarefas: { doItem: 'da tarefa', aoAprovar: 'entra como participante', aprovado: 'Agora você é participante da tarefa.', pagina: () => '/tarefas/' },
  demandas: { doItem: 'da demanda', aoAprovar: 'entra como colaborador', aprovado: 'Agora você é colaborador da demanda.', pagina: () => '/demandas/' },
  processos: { doItem: 'do processo', aoAprovar: 'entra como colaborador', aprovado: 'Agora você é colaborador do processo.', pagina: t => t && TIPOS_PROCESSO[t].caminho },
  compromissos: { doItem: 'do compromisso', aoAprovar: 'entra como participante', aprovado: 'Agora você é participante do compromisso.', pagina: () => '/agenda/' },
  contratos: { doItem: 'do contrato', aoAprovar: 'entra como participante, com 0% da divisão', aprovado: 'Agora você é participante do contrato, com 0% da divisão.',
    pagina: () => '/contratos/' },
  anotacoes: { doItem: 'da anotação', aoAprovar: 'passa a ter a anotação compartilhada', aprovado: 'Agora a anotação está compartilhada com você.', pagina: () => '/documentos/' }
};

/** O endereço que abre o cartão do item do pedido; null quando a pessoa não vê o item. */
export function enderecoDoItemDoPedido(p: Pick<PedidoDaMensagem, 'modulo' | 'item_id' | 'tipo_do_processo'>) {
  const pagina = PEDIDO_DO_MODULO[p.modulo].pagina(p.tipo_do_processo);
  return pagina && `${pagina}?${new URLSearchParams({ id: p.item_id })}`;
}

/** As respostas que chegam a quem pediu: o verbo de quem respondeu e o que muda para ela. Só aprovado e recusado viram resposta. */
export type RespostaDoPedido = Extract<SituacaoDoPedido, 'aprovado' | 'recusado'>;
export const RESPOSTA_DO_PEDIDO: Record<RespostaDoPedido, { verbo: string; depois: (modulo: ModuloDoPedido) => string; abre: boolean }> = {
  aprovado: { verbo: 'aprovou', depois: modulo => PEDIDO_DO_MODULO[modulo].aprovado, abre: true },
  recusado: { verbo: 'recusou', depois: () => 'Você continua sem acesso a este item.', abre: false }
};
/** A situação do pedido como resposta: o pendente e o cancelado não têm resposta (a caixa não os recebe). */
export const respostaDoPedido = (s: SituacaoDoPedido): RespostaDoPedido | null => s === 'aprovado' || s === 'recusado' ? s : null;
/** Para onde a resposta leva: ao cartão, só quando foi aprovada (recusada, a pessoa continua sem vê-lo). */
export function enderecoDaResposta(p: Pick<PedidoDaMensagem, 'modulo' | 'item_id' | 'tipo_do_processo' | 'situacao'>) {
  const r = respostaDoPedido(p.situacao);
  return r && RESPOSTA_DO_PEDIDO[r].abre ? enderecoDoItemDoPedido(p) : null;
}

/** O aviso para quem respondeu, no pé da tela. */
export const AVISO_AO_RESPONDER: Record<RespostaDoPedido, (nome: string, modulo: ModuloDoPedido) => string> = {
  aprovado: (nome, modulo) => `Pedido aprovado: ${nome} ${PEDIDO_DO_MODULO[modulo].aoAprovar}.`,
  recusado: nome => `Pedido recusado. ${nome} vai receber a resposta nas Mensagens.`
};

/** A linha do item na busca geral: sem pedido, "Pedir para participar"; com o pedido pendente, "Pedido enviado" e "Cancelar". */
export type EstadoDoItemSemAcesso = 'livre' | 'pedido';
export const estadoDoItemSemAcesso = (pedidoId: string | null | undefined): EstadoDoItemSemAcesso => pedidoId ? 'pedido' : 'livre';
export const ITEM_SEM_ACESSO: Record<EstadoDoItemSemAcesso, { meta: string; botao: string; rotulo: (tipo: string, codigo: string) => string; feito: string }> = {
  livre: {
    meta: 'Você não faz parte deste item.', botao: 'Pedir para participar', rotulo: (tipo, codigo) => `Pedir para participar: ${tipo} ${codigo}`,
    feito: 'Pedido enviado. Quem pode aprovar recebe nas Mensagens.'
  },
  pedido: {
    meta: 'Pedido enviado · aguardando resposta', botao: 'Cancelar', rotulo: (tipo, codigo) => `Cancelar o pedido: ${tipo} ${codigo}`,
    feito: 'Pedido cancelado.'
  }
};

/** O nome de cada linha que a resposta grava no histórico do item (o valor é o nome de quem pediu). */
export const CAMPOS_DO_PEDIDO_NO_HISTORICO: Record<`pedido_${RespostaDoPedido}`, string> = {
  pedido_aprovado: 'Pedido para participar aprovado',
  pedido_recusado: 'Pedido para participar recusado'
};

/**
 * Quantos cabem na equipe de cada item e o aviso de lista cheia: os mesmos do banco (privado.modulo_do_pedido), que são os do lápis
 * (EQUIPE_DO_MODULO) e, no contrato, os da divisão (PARTICIPANTES_MAXIMOS).
 */
export const LISTA_CHEIA: Record<ModuloDoPedido, { maximo: number; aviso: string }> = {
  tarefas: { maximo: EQUIPE_DO_MODULO.tarefas.maximo, aviso: EQUIPE_DO_MODULO.tarefas.cheia },
  demandas: { maximo: EQUIPE_DO_MODULO.demandas.maximo, aviso: EQUIPE_DO_MODULO.demandas.cheia },
  processos: { maximo: EQUIPE_DO_MODULO.processos.maximo, aviso: EQUIPE_DO_MODULO.processos.cheia },
  compromissos: { maximo: EQUIPE_DO_MODULO.compromissos.maximo, aviso: EQUIPE_DO_MODULO.compromissos.cheia },
  anotacoes: { maximo: EQUIPE_DO_MODULO.anotacoes.maximo, aviso: EQUIPE_DO_MODULO.anotacoes.cheia },
  contratos: { maximo: PARTICIPANTES_MAXIMOS, aviso: `Um contrato pode ter até ${PARTICIPANTES_MAXIMOS} participantes.` }
};

/** As recusas do banco, com as mesmas palavras (o banco fictício usa as mesmas). */
export const RECUSA_DO_PEDIDO = {
  itemNaoEncontrado: 'Item não encontrado neste escritório.',
  jaFazParte: 'Você já faz parte deste item.',
  semPessoa: 'Seu usuário não tem um cadastro de pessoa: peça a um administrador para incluir você no contrato.',
  indicador: 'Você é o indicador deste contrato: o indicador não entra na divisão como participante.',
  jaPediu: 'Você já pediu para participar deste item. Aguarde a resposta ou cancele o pedido.',
  pedidoNaoEncontrado: 'Pedido não encontrado.',
  jaRespondido: 'Este pedido já foi respondido.',
  cancelado: 'Este pedido foi cancelado por quem pediu.',
  naoAprova: 'Só um administrador, o responsável ou quem criou o item responde a este pedido.',
  inativo: 'Quem pediu não está mais ativo na equipe.',
  semPessoaParaOContrato: 'Quem pediu não tem um cadastro de pessoa para entrar no contrato.',
  arquivado: 'Este item foi arquivado: ele não recebe participantes. Recuse o pedido ou desarquive o item antes.',
  moduloDesligado: 'O módulo deste item está desligado no escritório: ele não recebe participantes.',
  /** A trava da divisão do contrato com parcelas (privado.trava_da_divisao), que o lápis também segue. */
  travaDaDivisao: 'Este contrato tem parcelas: só um administrador muda a divisão.'
} as const;
