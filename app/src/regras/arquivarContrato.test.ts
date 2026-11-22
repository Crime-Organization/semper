// O que sai junto quando um contrato é arquivado (#284). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { arquivadosComOContrato, type EscritorioParaArquivar, type TarefaParaArquivar } from './arquivarContrato';

const ARQUIVADO = '2030-01-01T00:00:00Z';
const tarefa = (id: string, extra: Partial<TarefaParaArquivar> = {}): TarefaParaArquivar =>
  ({ id, arquivado_em: null, demandas: [], contratos: [], processo_id: null, ...extra });

// Dado um escritório com o contrato K1 (que vai ser arquivado) e o K2, ativo; o K3, arquivado; o processo P1, ativo, e o P2, arquivado.
const escritorio = (tarefas: TarefaParaArquivar[]): EscritorioParaArquivar => ({
  demandas: [
    { id: 'd1', contrato_id: 'k1', arquivado_em: null },
    { id: 'd2', contrato_id: 'k1', arquivado_em: ARQUIVADO },
    { id: 'd3', contrato_id: null, arquivado_em: null },
    { id: 'd4', contrato_id: 'k3', arquivado_em: ARQUIVADO },
    { id: 'dc', contrato_id: 'k1', arquivado_em: null, continua: true }
  ],
  tarefas,
  contratoAtivo: id => id === 'k1' || id === 'k2',
  processoAtivo: id => id === 'p1'
});

describe('As demandas que saem com o contrato', () => {
  it('dado um contrato com uma demanda ativa, uma já arquivada e a contínua, quando é arquivado, então sai só a ativa', () => {
    // Dado / Quando / Então
    expect(arquivadosComOContrato('k1', escritorio([])).demandas).toEqual(['d1']);
  });
});

describe('As tarefas que saem com o contrato', () => {
  it('dadas tarefas só do contrato ou das demandas dele (mesmo a já arquivada), quando ele é arquivado, então saem todas', () => {
    // Dado
    const e = escritorio([tarefa('t1', { contratos: ['k1'] }), tarefa('t2', { demandas: ['d1'] }), tarefa('t3', { demandas: ['d2'] })]);
    // Quando / Então
    expect(arquivadosComOContrato('k1', e).tarefas).toEqual(['t1', 't2', 't3']);
  });

  it('dadas tarefas com outra ligação ativa (contrato, demanda ou processo), quando o contrato é arquivado, então elas ficam', () => {
    // Dado
    const e = escritorio([
      tarefa('com-outro-contrato', { contratos: ['k1', 'k2'] }),
      tarefa('com-outra-demanda', { demandas: ['d1', 'd3'] }),
      tarefa('com-processo', { contratos: ['k1'], processo_id: 'p1' })
    ]);
    // Quando / Então
    expect(arquivadosComOContrato('k1', e).tarefas).toEqual([]);
  });

  it('dadas tarefas cujas outras ligações já estão arquivadas, ou só na contínua, quando o contrato é arquivado, então saem', () => {
    // Dado
    const e = escritorio([
      tarefa('com-contrato-arquivado', { contratos: ['k1', 'k3'] }),
      tarefa('com-demanda-arquivada', { contratos: ['k1'], demandas: ['d4'] }),
      tarefa('com-processo-arquivado', { contratos: ['k1'], processo_id: 'p2' }),
      tarefa('na-continua', { contratos: ['k1'], demandas: ['dc'] })
    ]);
    // Quando / Então
    expect(arquivadosComOContrato('k1', e).tarefas).toEqual(['com-contrato-arquivado', 'com-demanda-arquivada', 'com-processo-arquivado', 'na-continua']);
  });

  it('dadas uma tarefa já arquivada e uma de outro contrato, quando o contrato é arquivado, então nenhuma das duas entra', () => {
    // Dado
    const e = escritorio([tarefa('ja-arquivada', { contratos: ['k1'], arquivado_em: ARQUIVADO }), tarefa('de-outro', { contratos: ['k2'] })]);
    // Quando / Então
    expect(arquivadosComOContrato('k1', e).tarefas).toEqual([]);
  });
});
