// Itens marcados na tabela de um módulo, para as ações em lote (arquivar, excluir...).
// Peça comum dos módulos: guarda só os ids.
import { useState } from 'react';

export function useSelecao() {
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  return {
    selecionadas,
    quantas: selecionadas.size,
    /** Marca (sim) ou desmarca os itens indicados, sem mexer nos outros. */
    marcar: (ids: string[], sim: boolean) => setSelecionadas(atual => {
      const s = new Set(atual);
      ids.forEach(id => sim ? s.add(id) : s.delete(id));
      return s;
    }),
    limpar: () => setSelecionadas(new Set())
  };
}
export type Selecao = ReturnType<typeof useSelecao>;
