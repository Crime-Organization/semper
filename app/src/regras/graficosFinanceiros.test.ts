// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { ContratoDaCarteira, Lancamento, ParcelaDoEscritorio } from '../dados/tipos';
import { maiorDaEscala, mesesDoCaixa, mesesRecebidos, segregarContratos } from './graficosFinanceiros';

const lanc = (data: string, tipo: Lancamento['tipo'], valor: number, categoria: Lancamento['categoria'] = 'despesa') => ({ data, tipo, valor, categoria });
const parcela = (contrato_id: string, valor: number, recebida_em: string | null, extra: Partial<ParcelaDoEscritorio> = {}): ParcelaDoEscritorio => ({
  id: contrato_id + valor + recebida_em, contrato_id, numero: 1, vencimento: '2026-01-10', valor, recebimento_id: null, recebida_em, recebido: null,
  contrato_codigo: 'K', cliente_nome: 'C', responsavel_id: 'u1', total_parcelas: null, ...extra
});
const contrato = (id: string, extra: Partial<ContratoDaCarteira> = {}): ContratoDaCarteira => ({
  id, codigo: id, categoria: 'pro_labore', responsavel_id: 'u1', assinado_em: '2025-03-01', valor: 100000, descontos: null, ...extra
});

describe('Entradas e saídas por mês', () => {
  it('dado lançamentos do ano, quando soma, então cada mês tem as suas entradas e saídas, sem os repasses entre contas', () => {
    // Quando
    const meses = mesesDoCaixa([lanc('2026-03-05', 'entrada', 1000, 'recebimento'), lanc('2026-03-20', 'saida', 300), lanc('2026-03-21', 'saida', 999, 'transferencia'), lanc('2025-03-01', 'entrada', 5)], 2026);
    // Então
    expect(meses).toHaveLength(12);
    expect(meses[2]).toMatchObject({ mes: '2026-03', entradas: 1000, saidas: 300 });
    expect(meses[0]).toMatchObject({ entradas: 0, saidas: 0 });
  });

  it('dado parcelas recebidas de dois responsáveis, quando escolhe um, então só as dele contam', () => {
    // Quando
    const meses = mesesRecebidos([parcela('a', 500, '2026-02-01', { recebido: 450 }), parcela('b', 700, '2026-02-03', { responsavel_id: 'u2' })], 2026, 'u1');
    // Então
    expect(meses[1].entradas).toBe(450);
  });
});

describe('Contratos separados, como na planilha de Contratos', () => {
  it('dado contratos com parcelas recebidas, quando separa por categoria, então mostra o contratado, o recebido e o que falta', () => {
    // Dado
    const contratos = [contrato('a'), contrato('b', { valor: 50000, descontos: 10000 }), contrato('c', { categoria: 'quota_litis', valor: null })];
    const parcelas = [parcela('a', 30000, '2026-01-10'), parcela('b', 40000, '2026-01-10'), parcela('c', 20000, '2026-01-10'), parcela('c', 20000, null)];
    // Quando
    const grupos = segregarContratos(contratos, parcelas, 'categoria', () => '');
    // Então: o maior contratado vem primeiro; sem valor, vale a soma das parcelas; o que falta nunca é negativo
    expect(grupos.map(g => g.chave)).toEqual(['pro_labore', 'quota_litis']);
    expect(grupos[0]).toMatchObject({ contratos: 2, contratado: 140000, recebido: 70000, emAberto: 70000 });
    expect(grupos[1]).toMatchObject({ contratos: 1, contratado: 40000, recebido: 20000, emAberto: 20000 });
  });

  it('dado um contrato de êxito sem valor e já recebido, quando separa, então o contratado é o recebido e nada fica em aberto', () => {
    // Quando
    const [g] = segregarContratos([contrato('a', { categoria: 'quota_litis', valor: 0 })], [parcela('a', 90000, '2026-05-02')], 'categoria', () => '');
    // Então
    expect(g).toMatchObject({ contratado: 90000, recebido: 90000, emAberto: 0 });
  });

  it('dado um responsável escolhido, quando separa por ano, então só os contratos dele entram', () => {
    // Quando
    const grupos = segregarContratos([contrato('a'), contrato('b', { responsavel_id: 'u2', assinado_em: null })], [], 'ano', () => '', 'u2');
    // Então
    expect(grupos).toEqual([{ chave: '', rotulo: 'Sem data', contratos: 1, contratado: 100000, recebido: 0, emAberto: 100000 }]);
  });

  it('dado só zeros, quando calcula a escala, então ela não é zero', () => {
    // Então
    expect(maiorDaEscala([0, 0])).toBe(1);
  });
});
