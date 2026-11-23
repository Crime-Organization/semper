// O que sai junto quando um contrato é excluído, e a janela que pergunta antes (#284). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { PreviaExclusaoContrato } from '../dados/tipos';
import type { TarefaParaArquivar } from './arquivarContrato';
import { fmtCentavos } from './caixa';
import { bloqueioDaExclusao, detalheDaExclusaoDoContrato, excluidosComOsContratos, janelaDaExclusao, RECUSA_DA_EXCLUSAO, tarefasDeCadaContrato, type EscritorioParaExcluir } from './exclusaoDoContrato';

const ARQUIVADO = '2030-01-01T00:00:00Z';
const tarefa = (id: string, extra: Partial<TarefaParaArquivar> = {}): TarefaParaArquivar =>
  ({ id, arquivado_em: null, demandas: [], contratos: [], processo_id: null, ...extra });

// Dado um escritório com os contratos K1 e K2 (que podem ser excluídos) e o K3; as demandas D1 (ativa) e D2 (arquivada) do K1, a D3
// sem contrato, a D4 do K3 e a contínua, com o K1.
const escritorio = (tarefas: TarefaParaArquivar[]): EscritorioParaExcluir => ({
  demandas: [
    { id: 'd1', contrato_id: 'k1', arquivado_em: null },
    { id: 'd2', contrato_id: 'k1', arquivado_em: ARQUIVADO },
    { id: 'd3', contrato_id: null, arquivado_em: null },
    { id: 'd4', contrato_id: 'k3', arquivado_em: null },
    { id: 'dc', contrato_id: 'k1', arquivado_em: null, continua: true }
  ],
  tarefas
});

describe('O que sai junto com o contrato excluído', () => {
  it('dado um contrato com demandas ativas, arquivadas e a contínua, quando é excluído, então saem todas, menos a contínua', () => {
    // Dado / Quando / Então
    expect(excluidosComOsContratos(['k1'], escritorio([])).demandas).toEqual(['d1', 'd2']);
  });

  it('dadas tarefas só do contrato ou das demandas dele, arquivadas ou não, quando ele é excluído, então saem todas', () => {
    // Dado
    const e = escritorio([tarefa('t1', { contratos: ['k1'] }), tarefa('t2', { demandas: ['d1'], arquivado_em: ARQUIVADO }), tarefa('t3', { demandas: ['d2', 'dc'] })]);
    // Quando / Então
    expect(excluidosComOsContratos(['k1'], e).tarefas).toEqual(['t1', 't2', 't3']);
  });

  it('dadas tarefas com outra ligação (contrato, demanda ou processo, mesmo arquivados), quando o contrato é excluído, então elas ficam', () => {
    // Dado
    const e = escritorio([
      tarefa('com-contrato', { contratos: ['k1', 'k3'] }),
      tarefa('com-demanda', { demandas: ['d1', 'd3'] }),
      tarefa('com-demanda-de-outro', { contratos: ['k1'], demandas: ['d4'] }),
      tarefa('com-processo', { contratos: ['k1'], processo_id: 'p1' }),
      tarefa('de-fora', { contratos: ['k3'] })
    ]);
    // Quando / Então
    expect(excluidosComOsContratos(['k1'], e).tarefas).toEqual([]);
  });

  it('dada uma tarefa ligada a dois contratos excluídos juntos, quando os dois saem, então ela sai também', () => {
    // Dado
    const e = escritorio([tarefa('dos-dois', { contratos: ['k1', 'k2'] })]);
    // Quando / Então
    expect(excluidosComOsContratos(['k1'], e).tarefas).toEqual([]);
    expect(excluidosComOsContratos(['k1', 'k2'], e).tarefas).toEqual(['dos-dois']);
  });

  it('dadas tarefas de dois contratos excluídos juntos, quando monta o resumo de cada um, então cada tarefa conta uma vez, no primeiro a que está ligada', () => {
    // Dado: uma tarefa dos dois, uma só do K2 e uma da D1 (do K1) e do K2
    const e = escritorio([tarefa('dos-dois', { contratos: ['k1', 'k2'] }), tarefa('do-k2', { contratos: ['k2'] }), tarefa('da-d1-e-k2', { contratos: ['k2'], demandas: ['d1'] })]);
    const junto = excluidosComOsContratos(['k1', 'k2'], e);
    // Quando
    const deCada = tarefasDeCadaContrato(['k1', 'k2'], junto, e);
    // Então
    expect(deCada).toEqual({ k1: ['dos-dois', 'da-d1-e-k2'], k2: ['do-k2'] });
    expect(Object.values(deCada).flat().toSorted()).toEqual(junto.tarefas.toSorted());
  });

  it('dada uma tarefa ligada só à demanda contínua do contrato, quando monta o resumo, então ela não conta (não sai)', () => {
    // Dado
    const e = escritorio([tarefa('da-continua', { demandas: ['dc'] })]);
    // Quando / Então
    expect(tarefasDeCadaContrato(['k1'], excluidosComOsContratos(['k1'], e), e)).toEqual({ k1: [] });
  });
});

// A prévia de um contrato sem nada ligado, que quem pede pode excluir.
const previa = (extra: Partial<PreviaExclusaoContrato> = {}): PreviaExclusaoContrato => ({
  contratos: 1, nao_excluiveis: 0, demandas: 0, tarefas: 0, segundos: 0, parcelas: 0, recebimentos: 0, estornados: 0, importadas: 0,
  com_dinheiro: false, sou_admin: false, tem_pagamento: false,
  valores: { recebido: 0, taxas: 0, repasses: 0, correcoes: 0, importado: 0 }, pagos: [], ...extra
});

describe('Quando não dá para excluir', () => {
  it('dado um pagamento já feito, quando até o administrador pede, então a janela diz quem foi pago e não exclui', () => {
    // Dado
    const p = previa({ com_dinheiro: true, sou_admin: true, tem_pagamento: true, pagos: [{ codigo: 'AA11-0001-2030', parcela: 1, nome: 'Bia', valor: 67900 }] });
    // Quando
    const j = janelaDaExclusao(p);
    // Então
    expect(j.titulo).toBe('Não dá para excluir');
    expect(j.bloqueio).toEqual({ tipo: 'pagamento', texto: RECUSA_DA_EXCLUSAO.pagamento, lista: [`Bia: ${fmtCentavos(67900)} (AA11-0001-2030, parcela 1)`] });
  });

  it('dado dinheiro recebido, quando quem pede não é administrador, então não exclui; o administrador exclui', () => {
    // Dado / Quando / Então
    expect(bloqueioDaExclusao(previa({ com_dinheiro: true }))).toBe('administrador');
    expect(bloqueioDaExclusao(previa({ com_dinheiro: true, sou_admin: true }))).toBeNull();
  });

  it('dado nenhum contrato que a pessoa possa excluir, quando pede, então a janela diz quem pode', () => {
    // Dado / Quando / Então
    expect(janelaDaExclusao(previa({ contratos: 0, nao_excluiveis: 1 })).bloqueio?.texto).toBe(RECUSA_DA_EXCLUSAO.nenhum);
  });
});

describe('A janela da exclusão', () => {
  it('dado um contrato sem nada ligado, quando pede para excluir, então a janela só avisa que é definitivo', () => {
    // Dado / Quando
    const j = janelaDaExclusao(previa());
    // Então
    expect(j.titulo).toBe('Excluir o contrato?');
    expect(j.itens).toEqual([]);
    expect(j.avisos).toEqual(['Processos, compromissos e documentos ligados continuam existindo.', 'A exclusão é definitiva e não pode ser desfeita.']);
  });

  it('dado um contrato com tudo, quando o administrador pede, então a janela diz quantos e quanto, com a parcela importada à parte', () => {
    // Dado
    const p = previa({
      demandas: 2, tarefas: 3, segundos: 7200, parcelas: 4, recebimentos: 1, estornados: 1, importadas: 1, com_dinheiro: true, sou_admin: true,
      valores: { recebido: 100000, taxas: 3000, repasses: 67900, correcoes: 5000, importado: 70000 }
    });
    // Quando
    const j = janelaDaExclusao(p);
    // Então
    expect(j.bloqueio).toBeNull();
    expect(j.itens).toEqual([
      '2 demandas',
      '3 tarefas, com 2 h de tempo registrado',
      '4 parcelas',
      `1 recebimento no Caixa: ${fmtCentavos(100000)} recebidos, ${fmtCentavos(3000)} de taxas da máquina e ${fmtCentavos(67900)} de repasses`,
      `Registros de correção dos recebimentos: ${fmtCentavos(5000)}`,
      '1 recebimento estornado',
      `1 parcela importada como paga: ${fmtCentavos(70000)}. Ela não passou pelo Caixa: excluí-la não muda o saldo.`
    ]);
    expect(j.avisos[0]).toContain('saem do Caixa, dos saldos e do lucro dos sócios');
    expect(j.avisos[1]).toContain('As demandas e as tarefas saem junto');
  });

  it('dado quem não vê o dinheiro do contrato, quando pede, então a janela conta sem mostrar os valores', () => {
    // Dado
    const p = previa({ recebimentos: 0, estornados: 2, importadas: 2, valores: null });
    // Quando / Então
    expect(janelaDaExclusao(p).itens).toEqual(['2 recebimentos estornados', '2 parcelas importadas como pagas. Elas não passaram pelo Caixa: excluí-las não muda o saldo.']);
  });

  it('dados vários contratos, alguns que a pessoa não pode excluir, quando pede, então o título conta os que saem e um aviso diz os que ficam', () => {
    // Dado / Quando
    const j = janelaDaExclusao(previa({ contratos: 3, nao_excluiveis: 1 }));
    // Então
    expect(j.titulo).toBe('Excluir 3 contratos?');
    expect(j.avisos).toContain('1 contrato selecionado não sai: só contratos arquivados podem ser excluídos, por quem os cadastrou ou por um administrador.');
  });
});

describe('O registro de ações da exclusão', () => {
  it('dado o resumo da cascata, quando o registro mostra a exclusão, então diz o que saiu junto e quanto', () => {
    // Dado
    const cascata = { demandas: 2, tarefas: 1, segundos: 0, parcelas: 0, recebimentos: 1, estornados: 0, recebido: 100000, taxas: 0, repasses: 0, correcoes: 0, importadas: 0, importado: 0 };
    // Quando / Então
    expect(detalheDaExclusaoDoContrato({ cascata })).toBe(`com 2 demandas, 1 tarefa, 1 recebimento de ${fmtCentavos(100000)}`);
    expect(detalheDaExclusaoDoContrato({ cascata: { ...cascata, demandas: 0, tarefas: 0, recebimentos: 0 } })).toBe('sem nada ligado');
    expect(detalheDaExclusaoDoContrato({})).toBe('');
  });
});
