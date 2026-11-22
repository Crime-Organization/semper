// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { GraficosDeProcessos, PainelDeProcessos, ProcessoNosGraficos } from '../dados/tipos';
import { ativosPorExtenso, ativosPorTipo, enderecoDoTipo, fasesDosProcessos, MESES_DO_MOVIMENTO, movimentoPorMes, painelDaPessoa, periodoDosGraficos, prazosPorSemana } from './graficosDeProcessos';
import { ITENS_POR_LISTA } from './painelProcessos';

const HOJE = '2026-11-22';
const processo = (id: string, extra: Partial<ProcessoNosGraficos> = {}): ProcessoNosGraficos =>
  ({ id, tipo: 'judicial', etapa_id: 'c1', distribuicao: null, criado_em: '2020-01-01T12:00:00Z', arquivado_em: null, ...extra });
const COLUNAS = {
  judicial: [{ id: 'c1', nome: 'Distribuído', marco: 'inicio' as const }, { id: 'c9', nome: 'Arquivado/baixado', marco: 'concluido' as const }],
  administrativo: [{ id: 'a1', nome: 'Protocolado', marco: 'inicio' as const }, { id: 'a9', nome: 'Arquivado/baixado', marco: 'concluido' as const }]
};
const vazio = (extra: Partial<GraficosDeProcessos> = {}): GraficosDeProcessos => ({ processos: [], prazos: [], andamentos: [], mudancas: [], ...extra });

describe('Período dos gráficos', () => {
  it('dado hoje, então o movimento começa no primeiro dia de 11 meses atrás, e os prazos vão até o fim da quarta semana', () => {
    // Então
    expect(periodoDosGraficos(HOJE)).toEqual({ desde: '2025-12-01', ate_prazos: '2026-12-19' });
  });

  it('dado o fim de um mês longo, então o começo do movimento não pula um mês', () => {
    // Então
    expect(periodoDosGraficos('2026-03-31').desde).toBe('2025-04-01');
  });
});

describe('Prazos por semana', () => {
  it('dados prazos vencidos e futuros, quando monta o gráfico, então vêm os vencidos e cada semana a partir de hoje', () => {
    // Quando
    const barras = prazosPorSemana([{ final: '2026-11-01' }, { final: '2026-11-21' }, { final: HOJE }, { final: '2026-11-28' }, { final: '2026-11-29' }, { final: '2026-12-19' }, { final: '2026-12-20' }], HOJE);
    // Então
    expect(barras.map(b => [b.nome, b.n, b.vencidos])).toEqual([
      ['Vencidos', 2, true], ['22/11 a 28/11', 2, false], ['29/11 a 05/12', 1, false], ['06/12 a 12/12', 0, false], ['13/12 a 19/12', 1, false]
    ]);
    expect(barras[1]).toMatchObject({ curto: '22/11', detalhe: 'De 22/11 a 28/11', de: HOJE, ate: '2026-11-28' });
  });

  it('dado nenhum prazo, então as barras existem, todas com zero', () => {
    // Então
    expect(prazosPorSemana([], HOJE).map(b => b.n)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('Movimento por mês', () => {
  it('dado o período, então vêm 12 meses, do mais antigo ao atual, com o nome do eixo e o da dica', () => {
    // Quando
    const meses = movimentoPorMes(vazio(), HOJE, COLUNAS);
    // Então
    expect(meses).toHaveLength(MESES_DO_MOVIMENTO);
    expect(meses[0]).toEqual({ mes: '2025-12', nome: 'Dez', detalhe: 'dezembro de 2025', andamentos: 0, novos: 0, encerrados: 0 });
    expect(meses.at(-1)!.mes).toBe('2026-11');
  });

  it('dados andamentos, quando conta, então cada um entra no mês da data, e os de depois de hoje ou de antes do período ficam fora', () => {
    // Quando
    const meses = movimentoPorMes(vazio({ andamentos: [{ processo_id: 'p', data: '2026-11-02' }, { processo_id: 'p', data: HOJE }, { processo_id: 'p', data: '2026-11-30' }, { processo_id: 'p', data: '2025-11-30' }] }), HOJE, COLUNAS);
    // Então
    expect(meses.at(-1)!.andamentos).toBe(2);
    expect(meses.reduce((s, m) => s + m.andamentos, 0)).toBe(2);
  });

  it('dados processos, quando conta os novos, então vale a distribuição e, sem ela, o dia do cadastro em Brasília', () => {
    // Dado: cadastrado às 1h de 1º de outubro em UTC, que ainda é 30 de setembro em Brasília
    const processos = [processo('a', { distribuicao: '2026-10-05' }), processo('b', { criado_em: '2026-10-01T01:00:00Z' }), processo('c', { distribuicao: '2019-01-01', criado_em: '2026-10-10T12:00:00Z' })];
    // Quando
    const meses = movimentoPorMes(vazio({ processos }), HOJE, COLUNAS);
    // Então
    expect(meses.find(m => m.mes === '2026-10')!.novos).toBe(1);
    expect(meses.find(m => m.mes === '2026-09')!.novos).toBe(1);
  });

  it('dadas trocas de coluna, quando conta os encerrados, então só a ida para a coluna de encerrados conta, uma vez por processo no mês', () => {
    // Dado
    const processos = [processo('p'), processo('q', { tipo: 'administrativo' })];
    const mudancas = [
      { processo_id: 'p', em: '2026-11-03T15:00:00Z', de: 'Distribuído', para: 'Arquivado/baixado' },
      { processo_id: 'p', em: '2026-11-04T15:00:00Z', de: 'Arquivado/baixado', para: 'Distribuído' },
      { processo_id: 'p', em: '2026-11-05T15:00:00Z', de: 'Distribuído', para: 'Arquivado/baixado' },
      { processo_id: 'q', em: '2026-10-05T15:00:00Z', de: 'Protocolado', para: 'Arquivado/baixado' },
      { processo_id: 'q', em: '2026-10-06T15:00:00Z', de: 'Protocolado', para: 'Publicado' },
      { processo_id: 'sumiu', em: '2026-10-06T15:00:00Z', de: null, para: 'Arquivado/baixado' }
    ];
    // Quando
    const meses = movimentoPorMes(vazio({ processos, mudancas }), HOJE, COLUNAS);
    // Então
    expect(meses.find(m => m.mes === '2026-11')!.encerrados).toBe(1);
    expect(meses.find(m => m.mes === '2026-10')!.encerrados).toBe(1);
  });
});

describe('Ativos e fases', () => {
  const processos = [processo('a'), processo('b', { etapa_id: 'c9' }), processo('c', { arquivado_em: '2026-01-01' }), processo('d', { tipo: 'administrativo', etapa_id: null })];

  it('dados processos, quando conta os ativos, então ficam fora os arquivados e os da coluna de encerrados', () => {
    // Então
    expect(ativosPorTipo(processos, COLUNAS)).toEqual({ judicial: 1, administrativo: 1 });
  });

  it('dados processos, quando conta as fases, então cada coluna tem os não arquivados dela, e os sem coluna ficam juntos', () => {
    // Então
    expect(fasesDosProcessos(processos)).toEqual([
      { tipo: 'judicial', etapa_id: 'c1', n: 1 }, { tipo: 'judicial', etapa_id: 'c9', n: 1 }, { tipo: 'administrativo', etapa_id: null, n: 1 }
    ]);
  });
});

describe('Painel de uma pessoa', () => {
  const de = (responsavel_id: string, colaboradores: string[] = []) => ({ id: 'p' + responsavel_id, codigo: 'C', tipo: 'judicial' as const, numero: '1', titulo: null, cliente_nome: 'A', responsavel_id, colaboradores, clientes: [] });
  const andamento = (id: string, processo: ReturnType<typeof de>) => ({ id, tipo: 'intimacao' as const, categoria: null, data: HOJE, hora: null, local: null, texto: id, tratada_em: null, tarefa_id: null, criado_em: HOJE, processo });
  const PAINEL: PainelDeProcessos = {
    prazos: [{ id: 'z1', descricao: 'z1', final: '2026-11-01', tarefa_id: null, processo: de('ana') }, { id: 'z2', descricao: 'z2', final: HOJE, tarefa_id: null, processo: de('bia', ['ana']) }, { id: 'z3', descricao: 'z3', final: HOJE, tarefa_id: null, processo: de('bia') }],
    total_vencidos: 1, total_a_vencer: 2, marcados: [], total_marcados: 0,
    intimacoes: [andamento('i1', de('ana')), andamento('i2', de('bia'))], total_intimacoes: 2, ultimos: [andamento('u1', de('bia'))],
    parados: [{ processo: de('ana'), ultimo: '2026-01-01', dias: 300 }], total_parados: 1, dias_parado: 60, fases: []
  };

  it('dado o painel da equipe, quando separa o de uma pessoa, então ficam só os processos dela, com os totais refeitos', () => {
    // Quando
    const { painel, incompleto } = painelDaPessoa(PAINEL, 'ana', HOJE);
    // Então
    expect(incompleto).toBe(false);
    expect(painel.prazos.map(z => z.id)).toEqual(['z1', 'z2']);
    expect([painel.total_vencidos, painel.total_a_vencer, painel.total_intimacoes, painel.total_parados]).toEqual([1, 1, 1, 1]);
    expect(painel.ultimos).toEqual([]);
  });

  it('dada uma lista da equipe cortada no limite, quando separa a de uma pessoa, então avisa que pode faltar parte', () => {
    // Então
    expect(painelDaPessoa({ ...PAINEL, total_intimacoes: ITENS_POR_LISTA + 1 }, 'ana', HOJE).incompleto).toBe(true);
  });
});

describe('Textos e endereços dos números', () => {
  it('dado um número de processos, então o tipo vem no singular ou no plural', () => {
    // Então
    expect(ativosPorExtenso('judicial', 1)).toBe('1 judicial');
    expect(ativosPorExtenso('administrativo', 1200)).toBe('1.200 administrativos');
  });

  it('dada uma pessoa, então a lista do tipo vem filtrada por ela; sem pessoa, a lista toda', () => {
    // Então
    expect(enderecoDoTipo('judicial', 'u1')).toBe('/processos/judicial/?pessoa=u1');
    expect(enderecoDoTipo('administrativo', null)).toBe('/processos/administrativo/');
  });
});
