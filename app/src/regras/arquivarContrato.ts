// O que sai junto quando um contrato é arquivado (#284). O banco faz o mesmo no gatilho privado.contrato_arquiva_em_cascata
// (supabase/migrations/20261122232543_contrato_arquiva_em_cascata.sql); o banco fictício usa esta regra para se comportar igual.
//   - As demandas ativas do contrato, menos a demanda contínua (#313), que nunca é arquivada.
//   - As tarefas ativas ligadas ao contrato ou a qualquer demanda dele (mesmo uma já arquivada antes), desde que não tenham outra
//     ligação ativa: outro contrato não arquivado, outra demanda não arquivada (que não seja a contínua) ou um processo não arquivado.
//   Desarquivar o contrato traz de volta só o que foi arquivado junto com ele (a marca fica guardada à parte).

/**
 * A demanda, como a regra precisa dela. A contínua (#313) ainda pode não existir: sem o campo, não é contínua.
 * JUNCAO-313 (obrigatório ao juntar a #313): trocar `continua` pela forma real da demanda contínua aqui e em falso.ts; tirar dos
 * testes SQL contrato_arquiva_em_cascata e contrato_exclui_em_cascata o "add column if not exists continua"; trocar
 * privado.demanda_continua() por uma migração nova; e acrescentar um teste com a contínua criada pelo caminho real da #313.
 * Sem isso, a cascata arquiva e exclui a demanda contínua sem erro nenhum.
 */
export interface DemandaParaArquivar { id: string; contrato_id: string | null; arquivado_em: string | null; continua?: boolean }

/** A tarefa, como a regra precisa dela: todas as ligações (#283), não só a principal. */
export interface TarefaParaArquivar {
  id: string; arquivado_em: string | null;
  demandas: readonly string[]; contratos: readonly string[]; processo_id: string | null;
}

/** O escritório como a regra o vê: as demandas e as tarefas, e se um contrato ou um processo está ativo (não arquivado). */
export interface EscritorioParaArquivar {
  demandas: readonly DemandaParaArquivar[];
  tarefas: readonly TarefaParaArquivar[];
  contratoAtivo: (id: string) => boolean;
  processoAtivo: (id: string) => boolean;
}

/** Os ids que o arquivamento do contrato arquiva junto. */
export interface ArquivadosJunto { demandas: string[]; tarefas: string[] }

/** As demandas e as tarefas que saem junto quando o contrato é arquivado. */
export function arquivadosComOContrato(contratoId: string, e: EscritorioParaArquivar): ArquivadosJunto {
  const doContrato = e.demandas.filter(d => d.contrato_id === contratoId && !d.continua);
  const demandas = doContrato.filter(d => !d.arquivado_em).map(d => d.id);
  const idsDoContrato = new Set(doContrato.map(d => d.id));
  // Depois de arquivar as do contrato: a demanda ativa que sobra é de outro contrato ou sem contrato (a contínua não conta).
  const demandaAtiva = (id: string) => {
    const d = e.demandas.find(x => x.id === id);
    return !!d && !d.arquivado_em && !d.continua && !demandas.includes(id);
  };
  const tarefas = e.tarefas.filter(t => !t.arquivado_em
    && (t.contratos.includes(contratoId) || t.demandas.some(id => idsDoContrato.has(id)))
    && !t.contratos.some(id => id !== contratoId && e.contratoAtivo(id))
    && !t.demandas.some(demandaAtiva)
    && !(t.processo_id && e.processoAtivo(t.processo_id))).map(t => t.id);
  return { demandas, tarefas };
}
