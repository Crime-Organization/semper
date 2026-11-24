// LGPD: a pessoa excluída sai da cópia escondida dos recebimentos excluídos (#412). Os mesmos casos do teste do banco
// esquecer_pessoa_nos_recebimentos_excluidos. Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { semAPessoaNasCopias, type LinhaDaCopia } from './esquecimentoNaCopia';

const ANA = { id: 'p1', nome: 'ANA LIMA' };
const CARLA = { id: 'p3', nome: 'CARLA DIAS' };
const DORA = { id: 'p6', nome: 'DORA MELO' };
const ELISA_ROCHA = { id: 'p7', nome: 'ELISA ROCHA' };

// Dada a cópia de um recebimento excluído, com duas clientes (ANA LIMA e ANA LIMA SOUZA), o participante BRUNO REIS e a indicadora
// CARLA DIAS, gravada com o nome antigo (CARLA ANTIGA) nos itens e na descrição do pagamento.
const recebimento = () => ({
  cliente_nome: 'ANA LIMA; ANA LIMA SOUZA',
  valor: 100000,
  data: '2030-03-12',
  copia: {
    recebimento: {
      id: 'r1', valor: 100000,
      terceiros: [{ id: 'p4', nome: 'BRUNO REIS', valor: 5000 }],
      socio_indicador: { id: 'p3', nome: 'CARLA ANTIGA', valor: 2000 }
    },
    repasses: [{ pessoa_id: 'p3', nome: 'CARLA ANTIGA', descricao: 'ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', valor: 2000, pago_em: '2030-03-15' }],
    terceiros_pagos: [{ pessoa_id: 'p4', pago_em: '2030-03-15' }],
    lancamentos: [
      { descricao: 'Recebimento: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', valor: 100000 },
      { descricao: 'Repasse a CARLA ANTIGA: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', valor: 2000 }
    ]
  }
});

// Dado o recebimento de DORA MELO, única cliente, com a correção lançada; o motivo cita o nome dela e o do participante DORA MELO SANTOS.
const corrigido = () => ({
  cliente_nome: 'DORA MELO',
  copia: {
    recebimento: { id: 'r3', valor: 50000, terceiros: [{ id: 'p8', nome: 'DORA MELO SANTOS', valor: 1000 }] },
    lancamentos: [
      { descricao: 'Recebimento: DORA MELO (AA11-0003-2030, parcela 1)', valor: 50000 },
      { descricao: 'Correção do recebimento de DORA MELO (AA11-0003-2030): parte de DORA MELO SANTOS lançada para DORA MELO, em dobro', valor: 1000, corrige_recebimento: 'r3' }
    ]
  }
});

// Dado o recebimento de um contrato com muitos clientes, entre eles ELISA (outra pessoa), em que o Financeiro cortou as descrições:
// a lista de clientes no meio do nome, o código no meio e a descrição no fim, no meio do nome.
const cortado = () => ({
  cliente_nome: 'ELISA; FABIO NUNES; ELISA ROCHA',
  copia: {
    repasses: [{ tipo: 'responsavel', nome: 'GIL', descricao: 'ELISA; FABIO NUNES; ELISA RO (AA11-0004-2030, parcela 1)', valor: 3000 }],
    lancamentos: [
      { descricao: 'Recebimento: ELISA; FABIO NUNES; ELISA RO (AA11-0004-2030, parcela 1)', valor: 60000 },
      { descricao: 'Repasse a GIL: ELISA; FABIO NUNES; ELISA ROCHA (AA11-00', valor: 3000 },
      { descricao: 'Repasse a HUGO: ELISA; FABIO NUNES; ELISA R', valor: 2000 },
      { descricao: 'Taxa da máquina: FABIO NUNES; ELISA (AA11-0004-2030, parcela 1)', valor: 500 }
    ]
  }
});

const esquecer = <T extends LinhaDaCopia>(linha: T, pessoa: { id: string; nome: string }) => semAPessoaNasCopias([linha], pessoa)[0];

describe('Esquecer a pessoa na cópia dos recebimentos excluídos', () => {
  it('quando a cliente é esquecida, então o nome dela vira "pessoa excluída" na lista e nas descrições, e a outra cliente continua', () => {
    // Quando
    const { cliente_nome, copia } = esquecer(recebimento(), ANA);
    // Então
    expect(cliente_nome).toBe('pessoa excluída; ANA LIMA SOUZA');
    expect(copia.repasses[0].descricao).toBe('pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)');
    expect(copia.lancamentos.map(l => l.descricao)).toEqual([
      'Recebimento: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)',
      'Repasse a CARLA ANTIGA: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)'
    ]);
    expect(JSON.stringify({ cliente_nome, copia })).not.toMatch(/ANA LIMA($|[^ ]| [^S])/);
  });

  it('quando a cliente é esquecida, então valores, datas, participantes e marcações continuam', () => {
    // Quando
    const c = esquecer(recebimento(), ANA);
    // Então
    expect({ valor: c.valor, data: c.data, recebido: c.copia.recebimento.valor, terceiros: c.copia.recebimento.terceiros, pagos: c.copia.terceiros_pagos })
      .toEqual({ valor: 100000, data: '2030-03-12', recebido: 100000, terceiros: recebimento().copia.recebimento.terceiros, pagos: recebimento().copia.terceiros_pagos });
  });

  it('quando a indicadora é esquecida, então sai também o nome antigo, dos itens e da descrição gravada antes da troca, e os valores continuam', () => {
    // Quando
    const { copia } = esquecer(recebimento(), CARLA);
    // Então
    expect(copia.recebimento.socio_indicador).toEqual({ id: 'p3', nome: 'pessoa excluída', valor: 2000 });
    expect(copia.repasses[0]).toMatchObject({ nome: 'pessoa excluída', valor: 2000, pago_em: '2030-03-15' });
    expect(copia.lancamentos[1].descricao).toBe('Repasse a pessoa excluída: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)');
    expect(JSON.stringify(copia)).not.toContain('CARLA');
    expect(copia.recebimento.terceiros[0].nome).toBe('BRUNO REIS');
  });

  it('dado o nome antigo só em outra linha do escritório, quando a indicadora é esquecida, então ele sai também desta', () => {
    // Dado uma linha sem item da indicadora, mas com o nome antigo dela na descrição
    const semItem = { cliente_nome: 'BRUNO REIS', copia: { lancamentos: [{ descricao: 'Repasse a CARLA ANTIGA: BRUNO REIS (AA11-0002-2030, parcela 1)' }] } };
    // Quando
    const [, depois] = semAPessoaNasCopias([recebimento(), semItem], CARLA);
    // Então
    expect(depois.copia.lancamentos[0].descricao).toBe('Repasse a pessoa excluída: BRUNO REIS (AA11-0002-2030, parcela 1)');
  });

  it('quando a cliente da correção é esquecida, então o nome sai da correção e do motivo, e o nome parecido do participante continua', () => {
    // Quando
    const { cliente_nome, copia } = esquecer(corrigido(), DORA);
    // Então
    expect(cliente_nome).toBe('pessoa excluída');
    expect(copia.lancamentos[1]).toEqual({ ...corrigido().copia.lancamentos[1],
      descricao: 'Correção do recebimento de pessoa excluída (AA11-0003-2030): parte de DORA MELO SANTOS lançada para pessoa excluída, em dobro' });
    expect(JSON.stringify(copia)).not.toMatch(/DORA MELO($|[^ ]| [^S])/);
  });

  it('quando a cliente das descrições cortadas é esquecida, então saem o nome com o código cortado e o pedaço do nome; a outra ELISA continua', () => {
    // Quando
    const { cliente_nome, copia } = esquecer(cortado(), ELISA_ROCHA);
    // Então
    expect(cliente_nome).toBe('ELISA; FABIO NUNES; pessoa excluída');
    expect(copia.repasses[0].descricao).toBe('ELISA; FABIO NUNES; pessoa excluída (AA11-0004-2030, parcela 1)');
    expect(copia.lancamentos).toEqual([
      { descricao: 'Recebimento: ELISA; FABIO NUNES; pessoa excluída (AA11-0004-2030, parcela 1)', valor: 60000 },
      { descricao: 'Repasse a GIL: ELISA; FABIO NUNES; pessoa excluída (AA11-00', valor: 3000 },
      { descricao: 'Repasse a HUGO: ELISA; FABIO NUNES; pessoa excluída', valor: 2000 },
      { descricao: 'Taxa da máquina: FABIO NUNES; ELISA (AA11-0004-2030, parcela 1)', valor: 500 }
    ]);
  });

  it('dado um nome com ponto e parênteses, quando é esquecido, então só ele sai, e o nome parecido continua', () => {
    // Dado
    const c = { cliente_nome: 'EMPRESA (S.A.); EMPRESA (SXA)', valor: 70000, copia: { parcela: { numero: 1, recebido: 70000 } } };
    // Quando / Então
    expect(esquecer(c, { id: 'p5', nome: 'EMPRESA (S.A.)' })).toEqual({ ...c, cliente_nome: 'pessoa excluída; EMPRESA (SXA)' });
  });

  it('dada uma cópia sem a pessoa, quando outra pessoa é esquecida, então nada muda', () => {
    // Quando / Então
    expect(semAPessoaNasCopias([recebimento(), corrigido(), cortado()], { id: 'p9', nome: 'OUTRA PESSOA' })).toEqual([recebimento(), corrigido(), cortado()]);
  });
});
