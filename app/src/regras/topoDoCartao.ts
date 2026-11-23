// O que o topo dos cartões de item diz, por módulo (#382): o nome do menu ⋯ para o leitor de tela, como a janela de excluir chama o
// item e a faixa do item arquivado. Desde a #382, os cartões de demanda, tarefa, processo, compromisso, contrato e pessoa têm o topo
// da anotação, num desenho só com ela (MoldeDoTopo): Arquivar e Excluir ficam no menu ⋯, e a faixa do arquivado diz onde.
import type { ModuloComEtiquetas } from '../dados';

/** Os cartões com o topo comum: os sete com etiquetas (a anotação também). */
export type ModuloDoTopo = ModuloComEtiquetas;

/** O que o topo de um módulo diz. */
export interface TextosDoTopo {
  /** Como a janela de excluir chama o item: "Excluir a tarefa?". */
  oQue: string;
  /**
   * O nome do ⋯ para o leitor de tela e na dica. Diferente do ⋯ da página do módulo ("Mais ações"), que fica atrás da janela do
   * cartão: dois botões com o mesmo nome confundem quem navega pelos nomes.
   */
  menu: string;
  /** A faixa do item arquivado: para quem pode excluí-lo (diz onde) e para quem não pode (diz quem pode). */
  arquivado: { podeExcluir: string; naoPode: string };
}

/** Onde está o Excluir, dito do mesmo jeito em todas as faixas (o mesmo da anotação). */
export const EXCLUIR_PELO_MENU = 'pelo menu ⋯';

export const TOPO_DO_CARTAO: Record<ModuloDoTopo, TextosDoTopo> = {
  demandas: {
    oQue: 'a demanda', menu: 'Mais ações da demanda',
    arquivado: {
      podeExcluir: `Demanda arquivada. Se não for mais necessária, pode ser excluída definitivamente ${EXCLUIR_PELO_MENU}.`,
      naoPode: 'Demanda arquivada. Só quem cadastrou esta demanda ou um administrador pode excluí-la.'
    }
  },
  tarefas: {
    oQue: 'a tarefa', menu: 'Mais ações da tarefa',
    arquivado: {
      podeExcluir: `Tarefa arquivada. Se não for mais necessária, pode ser excluída definitivamente ${EXCLUIR_PELO_MENU}.`,
      naoPode: 'Tarefa arquivada. Só quem cadastrou esta tarefa ou um administrador pode excluí-la.'
    }
  },
  processos: {
    oQue: 'o processo', menu: 'Mais ações do processo',
    arquivado: {
      podeExcluir: `Processo arquivado. Se não for mais necessário, pode ser excluído definitivamente ${EXCLUIR_PELO_MENU}.`,
      naoPode: 'Processo arquivado. Só quem cadastrou este processo ou um administrador pode excluí-lo.'
    }
  },
  compromissos: {
    oQue: 'o compromisso', menu: 'Mais ações do compromisso',
    arquivado: {
      podeExcluir: `Compromisso arquivado. Se não for mais necessário, pode ser excluído definitivamente ${EXCLUIR_PELO_MENU}.`,
      naoPode: 'Compromisso arquivado. Só quem cadastrou este compromisso ou um administrador pode excluí-lo.'
    }
  },
  contratos: {
    oQue: 'o contrato', menu: 'Mais ações do contrato',
    arquivado: {
      podeExcluir: `Contrato arquivado. Se não for mais necessário, pode ser excluído definitivamente ${EXCLUIR_PELO_MENU}. `
        + 'Excluí-lo apaga junto as demandas, as tarefas, as parcelas e os recebimentos dele; antes, uma janela mostra o que sai e os valores. '
        + 'Se for o último contrato do ano, o número dele volta a ser usado.',
      naoPode: 'Contrato arquivado. Só quem cadastrou este contrato ou um administrador pode excluí-lo.'
    }
  },
  anotacoes: {
    oQue: 'a anotação', menu: 'Mais ações da anotação',
    arquivado: {
      podeExcluir: `Anotação arquivada. Se não for mais necessária, pode ser excluída definitivamente ${EXCLUIR_PELO_MENU}.`,
      naoPode: 'Anotação arquivada. Só quem a escreveu ou um administrador pode excluí-la.'
    }
  },
  pessoas: {
    oQue: 'a pessoa', menu: 'Mais ações da pessoa',
    arquivado: {
      podeExcluir: `Pessoa arquivada. Se não for mais necessária, pode ser excluída definitivamente ${EXCLUIR_PELO_MENU}.`,
      naoPode: 'Pessoa arquivada. Só quem cadastrou esta pessoa ou um administrador pode excluí-la.'
    }
  }
};

/** O texto da faixa do item arquivado. */
export const faixaDoArquivado = (modulo: ModuloDoTopo, podeExcluir: boolean) =>
  TOPO_DO_CARTAO[modulo].arquivado[podeExcluir ? 'podeExcluir' : 'naoPode'];
