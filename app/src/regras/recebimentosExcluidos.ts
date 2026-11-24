// Os recebimentos que saíram com os contratos excluídos (#284), como a seção "Recebimentos excluídos" de "Contas, DAS e sócios" os
// mostra (#413): o contrato, a parcela, a data, o valor, a conta e quem excluiu. Só leitura: ninguém muda nem apaga estas linhas.
import type { RecebimentoExcluido } from '../dados/tipos';
import { fmtCentavos } from './caixa';
import { diaNoEscritorio } from './fuso';
import { fmtData } from './pessoa';

/** O que se diz de cada tipo de linha: o recebimento passou por uma conta; a parcela importada como paga, não. */
const DO_TIPO: Record<RecebimentoExcluido['tipo'], { conta: (r: RecebimentoExcluido) => string; selo: string | null }> = {
  recebimento: { conta: r => r.conta_nome ?? CONTA_REMOVIDA, selo: null },
  parcela_importada: { conta: () => SEM_CONTA, selo: 'Importada como paga' }
};
/** A conta que saiu da lista de contas depois da exclusão (o banco guarda o nome da hora, mas a linha antiga pode não ter). */
export const CONTA_REMOVIDA = 'Conta removida';
/** A parcela importada como paga não passou pelo Caixa. */
export const SEM_CONTA = 'Sem conta (não passou pelo Caixa)';
/** Quem excluiu e não está mais na equipe (ou a linha sem autor). */
export const QUEM_SAIU = 'Usuário removido';

/** Uma linha da seção, já em texto: a tela só mostra. */
export interface LinhaDoExcluido {
  id: number; contrato: string; parcela: string; data: string; valor: string; conta: string; quem: string; excluidoEm: string; selos: string[];
}

/** A linha de um recebimento excluído, com o nome de quem excluiu tirado da equipe. */
export function linhaDoExcluido(r: RecebimentoExcluido, equipe: readonly { id: string; nome: string }[]): LinhaDoExcluido {
  const tipo = DO_TIPO[r.tipo];
  return {
    id: r.id,
    contrato: 'Contrato ' + r.contrato_codigo,
    parcela: r.parcela_numero == null ? '' : 'Parcela ' + r.parcela_numero,
    data: r.data ? fmtData(r.data) : 'Sem data',
    valor: fmtCentavos(r.valor),
    conta: tipo.conta(r),
    quem: equipe.find(m => m.id === r.excluido_por)?.nome || QUEM_SAIU,
    excluidoEm: diaNoEscritorio(r.excluido_em),
    selos: [tipo.selo, r.estornado ? 'Estornado' : null].filter((s): s is string => !!s)
  };
}
