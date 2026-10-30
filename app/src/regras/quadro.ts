// Colunas-marco dos quadros: o código fixo de cada uma diz ao sistema qual ponto do fluxo ela marca, mesmo que a coluna
// seja renomeada. Elas têm cor própria no quadro e não podem ser excluídas nem criadas à mão (banco/014_colunas_marco.sql).
import type { MarcoColuna } from '../dados/tipos';

export const MARCOS: Record<MarcoColuna, { rotulo: string; explicacao: string }> = {
  assinado: {
    rotulo: 'Contrato assinado',
    explicacao: 'Coluna do contrato assinado: quando o módulo Demandas existir, cada contrato que chegar aqui gera uma demanda para cada objeto. Pode ser renomeada, mas não excluída.'
  },
  inicio: {
    rotulo: 'Início do fluxo',
    explicacao: 'Primeira coluna do fluxo: o que o sistema cria sozinho entra aqui. Pode ser renomeada, mas não excluída.'
  },
  concluido: {
    rotulo: 'Concluído',
    explicacao: 'Última coluna do fluxo: o item chega aqui quando é concluído. Pode ser renomeada, mas não excluída.'
  }
};

/** Só administradores excluem colunas, e coluna-marco nunca. */
export const podeExcluirColuna = (c: { marco?: MarcoColuna | null }, ehAdmin: boolean) => ehAdmin && !c.marco;
