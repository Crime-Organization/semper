// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Lancamento, ParcelaDoEscritorio, RecebimentoDoPeriodo } from '../dados/tipos';
import { indicadoresRealizados, maiorDaEscala, mesesDoCaixa, mesesRealizados, receitaPorObjeto } from './graficosFinanceiros';

const lanc = (data: string, tipo: Lancamento['tipo'], valor: number, categoria: Lancamento['categoria'] = 'despesa') => ({ data, tipo, valor, categoria });
const parcela = (contrato_id: string, valor: number, recebida_em: string | null, extra: Partial<ParcelaDoEscritorio> = {}): ParcelaDoEscritorio => ({
  id: contrato_id + valor + recebida_em, contrato_id, numero: 1, vencimento: '2026-01-10', valor, recebimento_id: 'r-' + contrato_id, recebida_em, recebido: null,
  contrato_codigo: 'K', cliente_nome: 'C', responsavel_id: 'u1', total_parcelas: null, ...extra
});
const recebimento = (contrato_id: string, data: string, extra: Partial<RecebimentoDoPeriodo> = {}): RecebimentoDoPeriodo => ({
  id: 'r-' + contrato_id, parcela_id: 'p', contrato_id, conta_id: 'pj', data, valor: 100000, taxa_maquina: 0, aliquota_das: 0, parte_na_conta: 30, responsavel_socio: false,
  na_conta: 30000, ficou_com_advogado: 70000, das: 0, liquido: 100000, escritorio: 30000, responsavel_recebe: 0, responsavel_fica: 50000, escritorio_final: 30000, contribuicao_socio: 0,
  terceiros: [{ id: 'i', nome: 'Indicador', percentual: 10, papel: 'indicador', valor: 10000 }, { id: 'p', nome: 'Part', percentual: 10, papel: 'participante', valor: 10000 }],
  socio_indicador: null, responsavel_id: 'u1', ...extra
});

describe('Entradas e saídas do caixa por mês', () => {
  it('dado lançamentos do ano, quando soma, então cada mês tem as suas entradas e saídas, sem os repasses entre contas', () => {
    // Quando
    const meses = mesesDoCaixa([lanc('2026-03-05', 'entrada', 1000, 'recebimento'), lanc('2026-03-20', 'saida', 300), lanc('2026-03-21', 'saida', 999, 'transferencia'), lanc('2025-03-01', 'entrada', 5)], 2026);
    // Então
    expect(meses).toHaveLength(12);
    expect(meses[2]).toMatchObject({ mes: '2026-03', entradas: 1000, saidas: 300 });
  });
});

describe('Só o que já entrou', () => {
  const parcelas = [parcela('a', 100000, '2026-03-10'), parcela('b', 40000, '2026-03-12', { recebimento_id: null }), parcela('c', 70000, null), parcela('d', 90000, '2026-03-15', { responsavel_id: 'u2' })];
  const recebimentos = [recebimento('a', '2026-03-10'), recebimento('d', '2026-03-15', { responsavel_id: 'u2', responsavel_fica: 60000 })];
  const contratos = [{ id: 'a', objetos: ['Registro de marca'], responsavel_id: 'u1', assinado_em: '2026-03-01' }, { id: 'b', objetos: ['Registro de marca', 'Busca'], responsavel_id: 'u1', assinado_em: '2025-12-01' },
    { id: 'c', objetos: ['Oposição'], responsavel_id: 'u1', assinado_em: '2026-03-20' }, { id: 'd', objetos: ['Busca'], responsavel_id: 'u2', assinado_em: '2026-03-02' }];

  it('dado parcelas recebidas, a receber e de outro advogado, quando calcula os indicadores dele no mês, então só o recebido por ele entra', () => {
    // Quando
    const r = indicadoresRealizados(parcelas, recebimentos, contratos, '2026-03', 'u1');
    // Então: a parcela a receber não entra em nada; a bruta inclui o histórico importado (b), a líquida e os repasses só o do SEMPER (a)
    expect(r).toEqual({ bruta: 140000, liquida: 50000, contratosAssinados: 2, escritorio: 30000, indicadores: 10000, participantes: 10000, temHistoricoSemDivisao: true });
  });

  it('dado o escritório todo, quando calcula, então soma os dois advogados', () => {
    // Quando
    const r = indicadoresRealizados(parcelas, recebimentos, contratos, '2026-03');
    // Então
    expect(r.bruta).toBe(230000);
    expect(r.liquida).toBe(110000);
    expect(r.contratosAssinados).toBe(3);
  });

  it('dado um contrato com dois objetos, quando calcula a receita por objeto, então o valor se divide entre eles', () => {
    // Quando
    const lista = receitaPorObjeto(parcelas, recebimentos, contratos, '2026-03', 'u1');
    // Então
    expect(lista).toEqual([{ objeto: 'Registro de marca', bruta: 120000, liquida: 50000, contratos: 2 }, { objeto: 'Busca', bruta: 20000, liquida: 0, contratos: 1 }]);
  });

  it('dado o ano, quando monta os meses, então cada mês tem a bruta e a líquida', () => {
    // Quando
    const meses = mesesRealizados(parcelas, recebimentos, 2026, 'u1');
    // Então
    expect(meses[2]).toMatchObject({ mes: '2026-03', bruta: 140000, liquida: 50000 });
    expect(meses[3]).toMatchObject({ bruta: 0, liquida: 0 });
  });

  it('dado só zeros, quando calcula a escala, então ela não é zero', () => {
    // Então
    expect(maiorDaEscala([0, 0])).toBe(1);
  });
});
