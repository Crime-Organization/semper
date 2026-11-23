// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { chaveDaColuna, COLUNA_DE_APROVACAO_DAS_TAREFAS, colunaDeAprovacaoNoQuadro, COLUNAS_NOVAS_DAS_TAREFAS, COLUNAS_NOVAS_DOS_PROCESSOS, ordensEntre, planoDasColunasNovas, quadroJaTem, type ColunasNovas } from './colunasPadrao';

const TAREFAS = [
  { id: 't1', nome: 'Para fazer', ordem: 1, marco: 'inicio' as const },
  { id: 't2', nome: 'Fazendo', ordem: 2 },
  { id: 't3', nome: 'Aguardando retorno', ordem: 3 },
  { id: 't4', nome: 'Concluída', ordem: 4, marco: 'concluido' as const }
];
const ANALISE = 'Aguardando: análise do solicitante';
const CLIENTE = 'Aguardando: retorno do cliente';

describe('Colunas padrão novas (#314)', () => {
  it('dado nomes com outra escrita, quando compara, então ignora maiúsculas, acentos, espaços e sinais', () => {
    // Quando / Então
    expect(chaveDaColuna(' AGUARDANDO analise  do solicitante ')).toBe(chaveDaColuna(ANALISE));
  });

  it.each([
    ['Aguardando análise do solicitante', true],
    ['Aguardando retorno do advogado solicitante', true],
    ['AGUARDANDO SOLICITANTE', true],
    ['Aguardando retorno', false]
  ])('dado um quadro com "%s", quando pergunta se já tem a coluna da análise, então é %s', (nome, tem) => {
    // Quando / Então
    expect(quadroJaTem([nome], COLUNAS_NOVAS_DAS_TAREFAS.colunas[0])).toBe(tem);
  });

  it('dado dois vizinhos, quando reparte o espaço para duas colunas, então elas ficam entre eles, em ordem', () => {
    // Quando / Então
    expect(ordensEntre(2, 5, 2)).toEqual([3, 4]);
    expect(ordensEntre(2, undefined, 2)).toEqual([3, 4]);
    expect(ordensEntre(undefined, 5, 2)).toEqual([3, 4]);
    expect(ordensEntre(undefined, undefined, 2)).toEqual([1, 2]);
  });

  it('dado o quadro de Tarefas de antes, quando planeja, então as duas entram depois de "Fazendo", sem grupo', () => {
    // Quando
    const plano = planoDasColunasNovas(TAREFAS, [], COLUNAS_NOVAS_DAS_TAREFAS);
    // Então
    expect(plano).toEqual({ grupoNovo: null, grupoId: null, colunas: [{ nome: ANALISE, ordem: 2 + 1 / 3 }, { nome: CLIENTE, ordem: 2 + 2 / 3 }] });
  });

  it('dado a coluna do cliente criada à mão com outra escrita, quando planeja, então só a da análise entra', () => {
    // Dado
    const quadro = [...TAREFAS, { id: 'x', nome: 'aguardando retorno do CLIENTE', ordem: 3.5 }];
    // Quando / Então
    expect(planoDasColunasNovas(quadro, [], COLUNAS_NOVAS_DAS_TAREFAS)?.colunas.map(c => c.nome)).toEqual([ANALISE]);
  });

  it('dado o quadro que já tem as duas, ou nenhuma coluna, quando planeja, então nada entra', () => {
    // Dado
    const completo = [...TAREFAS, { id: 'a', nome: ANALISE, ordem: 2.3 }, { id: 'b', nome: CLIENTE, ordem: 2.6 }];
    // Quando / Então
    expect(planoDasColunasNovas(completo, [], COLUNAS_NOVAS_DAS_TAREFAS)).toBeNull();
    expect(planoDasColunasNovas([], [], COLUNAS_NOVAS_DAS_TAREFAS)).toBeNull();
  });

  it('dado "Fazendo" num grupo, quando planeja, então as duas entram no grupo, antes da coluna seguinte dele', () => {
    // Dado
    const quadro = TAREFAS.map(c => (c.id === 't2' || c.id === 't3' ? { ...c, grupo_id: 'g' } : c));
    // Quando
    const plano = planoDasColunasNovas(quadro, [{ id: 'g', nome: 'Em curso', ordem: 10 }], COLUNAS_NOVAS_DAS_TAREFAS);
    // Então
    expect(plano?.grupoId).toBe('g');
    expect(plano?.colunas.map(c => c.ordem)).toEqual([2 + 1 / 3, 2 + 2 / 3]);
  });

  it('dado o quadro sem "Fazendo", quando planeja, então as duas entram logo antes da coluna das concluídas', () => {
    // Dado
    const quadro = TAREFAS.map(c => (c.id === 't2' ? { ...c, nome: 'Em execução' } : c));
    // Quando / Então
    expect(planoDasColunasNovas(quadro, [], COLUNAS_NOVAS_DAS_TAREFAS)?.colunas.map(c => c.ordem)).toEqual([3 + 1 / 3, 3 + 2 / 3]);
  });

  it('dado o quadro sem "Fazendo" e sem a coluna das concluídas, quando planeja, então as duas entram no fim', () => {
    // Dado
    const quadro = [{ id: 'a', nome: 'Entrada', ordem: 1 }, { id: 'b', nome: 'Saída', ordem: 2 }];
    // Quando / Então
    expect(planoDasColunasNovas(quadro, [], COLUNAS_NOVAS_DAS_TAREFAS)?.colunas.map(c => c.ordem)).toEqual([3, 4]);
  });
});

describe('Colunas padrão novas num grupo novo', () => {
  const NOVAS: ColunasNovas = { grupoNovo: 'Acompanhamento', colunas: [{ nome: 'Aguardando MP', parecidos: [] }, { nome: 'Em acompanhamento', parecidos: [] }] };
  const GRUPOS = [{ id: 'g1', nome: 'Cumprimento', ordem: 100 }, { id: 'g2', nome: 'Encerrado', ordem: 101 }];
  const COLUNAS = [
    { id: 'a', nome: 'Distribuído', ordem: 1, grupo_id: 'g1', marco: 'inicio' as const },
    { id: 'b', nome: 'Baixado/arquivado', ordem: 2, grupo_id: 'g2', marco: 'concluido' as const }
  ];

  it('dado o grupo da coluna das concluídas, quando planeja, então o grupo novo fica logo antes dele, com as duas colunas', () => {
    // Quando
    const plano = planoDasColunasNovas(COLUNAS, GRUPOS, NOVAS);
    // Então
    expect(plano).toEqual({ grupoNovo: { nome: 'Acompanhamento', ordem: 100.5 }, grupoId: null,
      colunas: [{ nome: 'Aguardando MP', ordem: 1 }, { nome: 'Em acompanhamento', ordem: 2 }] });
  });

  it('dado um grupo de mesmo nome criado à mão, quando planeja, então as colunas entram no fim dele', () => {
    // Dado
    const grupos = [...GRUPOS, { id: 'g3', nome: 'ACOMPANHAMENTO', ordem: 50 }];
    const colunas = [...COLUNAS, { id: 'c', nome: 'Vigiar', ordem: 7, grupo_id: 'g3' }];
    // Quando
    const plano = planoDasColunasNovas(colunas, grupos, NOVAS);
    // Então
    expect(plano).toEqual({ grupoNovo: null, grupoId: 'g3', colunas: [{ nome: 'Aguardando MP', ordem: 8 }, { nome: 'Em acompanhamento', ordem: 9 }] });
  });

  it('dado dois grupos de nome parecido criados à mão, quando planeja, então as colunas entram no de menor ordem, como no banco', () => {
    // Dado
    const grupos = [...GRUPOS, { id: 'g4', nome: 'Acompanhamento.', ordem: 60 }, { id: 'g3', nome: 'ACOMPANHAMENTO', ordem: 50 }];
    // Quando
    const plano = planoDasColunasNovas(COLUNAS, grupos, NOVAS);
    // Então
    expect(plano?.grupoId).toBe('g3');
  });
});

describe('Colunas de acompanhamento dos processos judiciais (#315)', () => {
  const GRUPOS = [{ id: 'g1', nome: 'Cumprimento', ordem: 1000035 }, { id: 'g2', nome: 'Encerrado', ordem: 1000036 }];
  const COLUNAS = [
    { id: 'a', nome: 'Distribuído', ordem: 1, grupo_id: 'g1', marco: 'inicio' as const },
    { id: 'b', nome: 'Alvará', ordem: 29, grupo_id: 'g1' },
    { id: 'c', nome: 'Baixado/arquivado', ordem: 30, grupo_id: 'g2', marco: 'concluido' as const }
  ];

  it('dado o quadro judicial de antes, quando planeja, então o grupo "Acompanhamento" entra antes de "Encerrado", com as duas colunas', () => {
    // Quando
    const plano = planoDasColunasNovas(COLUNAS, GRUPOS, COLUNAS_NOVAS_DOS_PROCESSOS);
    // Então
    expect(plano?.grupoNovo).toEqual({ nome: 'Acompanhamento', ordem: 1000035.5 });
    expect(plano?.colunas.map(c => c.nome)).toEqual(['Aguardando MP', 'Em acompanhamento']);
  });

  it('dado "Aguardando Ministério Público" criada à mão, quando planeja, então só "Em acompanhamento" entra', () => {
    // Dado
    const quadro = [...COLUNAS, { id: 'x', nome: 'aguardando ministerio publico', ordem: 31 }];
    // Quando / Então
    expect(planoDasColunasNovas(quadro, GRUPOS, COLUNAS_NOVAS_DOS_PROCESSOS)?.colunas.map(c => c.nome)).toEqual(['Em acompanhamento']);
  });
});

describe('A coluna de aprovação das tarefas (#313)', () => {
  it('dado um quadro com a coluna da análise renomeada para um nome parecido, quando procura a de aprovação, então acha ela, e não a do marco', () => {
    // Dado
    const colunas = [...TAREFAS, { id: 't5', nome: 'Aguardando solicitante', ordem: 2.5 }, { id: 't6', nome: 'AGUARDANDO SOLICITANTE', ordem: 9 }];
    // Quando / Então
    expect(colunaDeAprovacaoNoQuadro(colunas)?.id).toBe('t5');
  });

  it('dado um quadro sem ela, quando procura, então não acha, e o plano a acrescenta depois de "Fazendo"', () => {
    // Quando
    const plano = planoDasColunasNovas(TAREFAS, [], COLUNA_DE_APROVACAO_DAS_TAREFAS);
    // Então
    expect(colunaDeAprovacaoNoQuadro(TAREFAS)).toBeUndefined();
    expect(plano?.colunas).toEqual([{ nome: ANALISE, ordem: 2.5 }]);
  });
});
