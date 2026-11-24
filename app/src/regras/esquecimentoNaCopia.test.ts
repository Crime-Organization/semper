// LGPD: a pessoa excluída sai da cópia escondida dos recebimentos excluídos (#412). Os mesmos casos do teste do banco
// esquecer_pessoa_nos_recebimentos_excluidos. Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { semAPessoa } from './esquecimentoNaCopia';

const ANA = { id: 'p1', nome: 'ANA LIMA' };
const CARLA = { id: 'p3', nome: 'CARLA DIAS' };

// Dada a cópia de um recebimento excluído, com duas clientes (ANA LIMA e ANA LIMA SOUZA), o participante BRUNO REIS e a indicadora
// CARLA DIAS, gravada com o nome antigo.
const copia = () => ({
  cliente_nome: 'ANA LIMA; ANA LIMA SOUZA',
  valor: 100000,
  data: '2030-03-12',
  recebimento: {
    id: 'r1', valor: 100000,
    terceiros: [{ id: 'p4', nome: 'BRUNO REIS', valor: 5000 }],
    socio_indicador: { id: 'p3', nome: 'CARLA ANTIGA', valor: 2000 }
  },
  repasses: [{ pessoa_id: 'p3', nome: 'CARLA ANTIGA', descricao: 'ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', valor: 2000, pago_em: '2030-03-15' }],
  terceiros_pagos: [{ pessoa_id: 'p4', pago_em: '2030-03-15' }],
  lancamentos: [
    { descricao: 'Recebimento: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', valor: 100000 },
    { descricao: 'Repasse a CARLA DIAS: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)', valor: 2000 }
  ]
});

describe('Esquecer a pessoa na cópia dos recebimentos excluídos', () => {
  it('quando a cliente é esquecida, então o nome dela vira "pessoa excluída" na lista e nas descrições, e a outra cliente continua', () => {
    // Quando
    const c = semAPessoa(copia(), ANA);
    // Então
    expect(c.cliente_nome).toBe('pessoa excluída; ANA LIMA SOUZA');
    expect(c.repasses[0].descricao).toBe('pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)');
    expect(c.lancamentos.map(l => l.descricao)).toEqual([
      'Recebimento: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)',
      'Repasse a CARLA DIAS: pessoa excluída; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)'
    ]);
    expect(JSON.stringify(c)).not.toMatch(/ANA LIMA($|[^ ]| [^S])/);
  });

  it('quando a cliente é esquecida, então valores, datas, participantes e marcações continuam', () => {
    // Quando
    const c = semAPessoa(copia(), ANA);
    // Então
    expect({ valor: c.valor, data: c.data, recebido: c.recebimento.valor, terceiros: c.recebimento.terceiros, pagos: c.terceiros_pagos })
      .toEqual({ valor: 100000, data: '2030-03-12', recebido: 100000, terceiros: copia().recebimento.terceiros, pagos: copia().terceiros_pagos });
  });

  it('quando a indicadora é esquecida, então sai também o nome antigo, de onde a cópia aponta para ela, e os valores continuam', () => {
    // Quando
    const c = semAPessoa(copia(), CARLA);
    // Então
    expect(c.recebimento.socio_indicador).toEqual({ id: 'p3', nome: 'pessoa excluída', valor: 2000 });
    expect(c.repasses[0]).toMatchObject({ nome: 'pessoa excluída', valor: 2000, pago_em: '2030-03-15' });
    expect(c.lancamentos[1].descricao).toBe('Repasse a pessoa excluída: ANA LIMA; ANA LIMA SOUZA (AA11-0001-2030, parcela 1)');
    expect(JSON.stringify(c)).not.toContain('CARLA');
    expect(c.recebimento.terceiros[0].nome).toBe('BRUNO REIS');
  });

  it('dado um nome com ponto e parênteses, quando é esquecido, então só ele sai, e o nome parecido continua', () => {
    // Dado
    const c = { cliente_nome: 'EMPRESA (S.A.); EMPRESA (SXA)', valor: 70000 };
    // Quando / Então
    expect(semAPessoa(c, { id: 'p5', nome: 'EMPRESA (S.A.)' })).toEqual({ cliente_nome: 'pessoa excluída; EMPRESA (SXA)', valor: 70000 });
  });

  it('dada uma cópia sem a pessoa, quando outra pessoa é esquecida, então nada muda', () => {
    // Dado
    const c = copia();
    // Quando / Então
    expect(semAPessoa(c, { id: 'p9', nome: 'OUTRA PESSOA' })).toEqual(copia());
  });
});
