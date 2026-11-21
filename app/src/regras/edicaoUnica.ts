// Uma edição aberta de cada vez (#395): na faixa das datas do cartão (o início, o prazo, a data do compromisso, a assinatura) e
// nos prazos do processo, só um formulário fica aberto. Pedir outro troca o aberto por ele quando o aberto não tem nada por salvar;
// com algo por salvar, o aberto continua, e a pessoa é lembrada de salvar ou cancelar antes. Assim nada some sem aviso e nada
// fica por cima de nada. Tudo puro, sem tela.

/** O formulário aberto e se ele tem algo por salvar (diferente do gravado). */
export interface EdicaoAberta { id: string; sujo: boolean }

/** O que acontece com o pedido de abrir outro formulário: abre (trocando o aberto, se houver) ou fica o aberto. */
export type RespostaAoPedido = 'abrir' | 'manter';

/** Abre o pedido quando nada está aberto, quando é o mesmo ou quando o aberto não tem nada por salvar; senão, mantém o aberto. */
export const pedirEdicao = (aberta: EdicaoAberta | null, pedida: string): RespostaAoPedido =>
  !aberta || aberta.id === pedida || !aberta.sujo ? 'abrir' : 'manter';

/** O lembrete no formulário aberto, quando a pessoa pede outro sem salvar ou cancelar este. */
export const SALVE_OU_CANCELE = 'Salve ou cancele esta mudança antes de abrir outra.';
