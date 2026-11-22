// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O painel do Financeiro (#403) não faz conta nova: estes testes conferem que os números dele são os mesmos que as regras de antes
// dão (o resumo do caixa, os indicadores do que já entrou, a carteira de Direitos e o saldo do caixa de cada mês).
import { describe, expect, it } from 'vitest';
import type { Lancamento, ParcelaDoEscritorio, RecebimentoDoPeriodo } from '../dados/tipos';
import { mesDoCaixa } from './caixa';
import { indicadoresRealizados, mesesDoCaixa, mesesRealizados } from './graficosFinanceiros';
import {
  aReceberNoPeriodo, aReceberPorSemana, caixaPorMes, comparar, corteDoSaldo, diasDoPeriodo, emAtraso, mesesDoGrafico, MESES_DO_GRAFICO, nomeDoPeriodo, numerosDoCaixa,
  periodoAnterior, receitaPorMes, saldoAntesDe, SEMANAS_A_RECEBER
} from './numerosDoFinanceiro';
import { carteiraDeContratos, filtrarCarteira, filtrarExtrato, FILTRO_VAZIO, totaisDaCarteira, totaisDoExtrato } from './painelFinanceiro';

let id = 0;
const lanc = (data: string, tipo: Lancamento['tipo'], valor: number, categoria: Lancamento['categoria'] = tipo === 'entrada' ? 'recebimento' : 'despesa', conta_id = 'pj'): Lancamento => ({
  id: 'l' + (id++), conta_id, data, tipo, categoria, valor, descricao: 'Lançamento', par_id: null, origem: null, criado_em: data + 'T12:00:00Z'
} as Lancamento);
const parcela = (contrato_id: string, vencimento: string, valor: number, extra: Partial<ParcelaDoEscritorio> = {}): ParcelaDoEscritorio => ({
  id: 'p' + (id++), contrato_id, numero: 1, vencimento, valor, recebimento_id: null, recebida_em: null, recebido: null,
  contrato_codigo: 'K-' + contrato_id, cliente_nome: 'Cliente', responsavel_id: 'u1', total_parcelas: null, ...extra
});
const recebida = (contrato_id: string, data: string, valor: number, extra: Partial<ParcelaDoEscritorio> = {}) =>
  parcela(contrato_id, data, valor, { recebimento_id: 'r-' + contrato_id + data, recebida_em: data, recebido: valor, ...extra });
const recebimento = (contrato_id: string, data: string, responsavel_fica: number, responsavel_id = 'u1') => ({
  id: 'r-' + contrato_id + data, contrato_id, data, responsavel_fica, responsavel_id, escritorio_final: 0, terceiros: [], escritorio: 0, valor: 0
} as unknown as RecebimentoDoPeriodo);

/** Um caixa de dois anos, com repasse entre contas e ajuste (que não são receita nem despesa). */
const LANCAMENTOS = [
  lanc('2025-12-03', 'entrada', 300000), lanc('2025-12-20', 'saida', 120000),
  lanc('2026-01-05', 'entrada', 500000), lanc('2026-01-10', 'saida', 200000), lanc('2026-01-11', 'saida', 50000, 'transferencia'),
  lanc('2026-01-11', 'entrada', 50000, 'transferencia', 'pf'), lanc('2026-01-15', 'entrada', 1000, 'ajuste_a_mais'),
  lanc('2026-02-01', 'entrada', 250000), lanc('2026-02-28', 'saida', 400000), lanc('2025-03-01', 'entrada', 99900)
];

describe('O período e o de antes', () => {
  it('dado um mês, quando pede o de antes, então é o mês anterior, e o de janeiro é o dezembro do ano anterior', () => {
    // Então
    expect(periodoAnterior('2026-11')).toBe('2026-10');
    expect(periodoAnterior('2026-01')).toBe('2025-12');
    expect(periodoAnterior('2026')).toBe('2025');
    expect(nomeDoPeriodo('2026-11')).toBe('Nov/2026');
    expect(nomeDoPeriodo('2026')).toBe('2026');
    expect(diasDoPeriodo('2026-02')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(diasDoPeriodo('2026')).toEqual({ de: '2026-01-01', ate: '2026-12-31' });
  });

  it('dado um mês ou o ano todo, quando monta os meses do gráfico, então são doze, terminando no mês escolhido (ou em dezembro)', () => {
    // Quando
    const doMes = mesesDoGrafico('2026-03'), doAno = mesesDoGrafico('2026');
    // Então
    expect(doMes).toHaveLength(MESES_DO_GRAFICO);
    expect(doMes[0]).toBe('2025-04');
    expect(doMes.at(-1)).toBe('2026-03');
    expect(doAno[0]).toBe('2026-01');
    expect(doAno.at(-1)).toBe('2026-12');
  });
});

describe('Os números do caixa são os de sempre', () => {
  it('dado o caixa de dois anos, quando calcula os números de um mês, então são os do resumo do extrato de hoje (sem repasse entre contas nem ajuste)', () => {
    // Quando
    const t = numerosDoCaixa(LANCAMENTOS, '2026-01');
    // Então
    expect(t).toEqual(totaisDoExtrato(filtrarExtrato(LANCAMENTOS, { ...FILTRO_VAZIO, mes: '2026-01' })));
    expect(t).toMatchObject({ entradas: 500000, saidas: 200000, resultado: 300000 });
  });

  it('dado o caixa, quando monta o gráfico de um ano, então cada mês tem as entradas e as saídas do gráfico de antes e o resultado delas', () => {
    // Quando
    const meses = caixaPorMes(LANCAMENTOS, mesesDoGrafico('2026'));
    // Então
    const antes = mesesDoCaixa(LANCAMENTOS, 2026);
    meses.forEach((m, i) => {
      expect(m).toMatchObject({ mes: antes[i].mes, entradas: antes[i].entradas, saidas: antes[i].saidas, resultado: antes[i].entradas - antes[i].saidas });
    });
    expect(meses[0]).toMatchObject({ nome: 'Jan/26', detalhe: 'janeiro de 2026', entradas: 500000, saidas: 200000, resultado: 300000 });
    expect(meses[1]).toMatchObject({ nome: 'Fev', resultado: -150000 });
  });

  it('dado o caixa, quando monta os últimos doze meses de janeiro, então o dezembro do ano anterior entra, com o ano no nome', () => {
    // Quando
    const meses = caixaPorMes(LANCAMENTOS, mesesDoGrafico('2026-01'));
    // Então
    expect(meses.at(-2)).toMatchObject({ mes: '2025-12', entradas: 300000, saidas: 120000 });
    expect(meses[0].nome).toBe('Fev/25');
    expect(meses.at(-1)?.nome).toBe('Jan/26');
  });
});

describe('O saldo nas contas', () => {
  it('dado o saldo de uma conta num dia e os lançamentos depois dele, quando calcula o saldo do fim de um mês, então é o saldo final do caixa daquele mês', () => {
    // Dado: R$ 1.000,00 antes de dezembro de 2025
    const base = { dia: '2025-12-01', saldo: 100000 };
    const daPj = LANCAMENTOS.filter(l => l.conta_id === 'pj' && l.data >= base.dia);
    // Quando
    const fimDeJaneiro = saldoAntesDe('2026-02-01', base, daPj);
    // Então: a mesma conta da página do caixa (mês a mês, com repasses e ajustes)
    const dezembro = mesDoCaixa(daPj.filter(l => l.data.startsWith('2025-12')), base.saldo);
    const janeiro = mesDoCaixa(daPj.filter(l => l.data.startsWith('2026-01')), dezembro.saldoFinal);
    expect(fimDeJaneiro).toBe(janeiro.saldoFinal);
    expect(fimDeJaneiro).toBe(100000 + 300000 - 120000 + 500000 - 200000 - 50000 + 1000);
  });

  it('dado um mês que já acabou ou que ainda corre, quando pede até onde vai o saldo, então é o dia seguinte ao fim dele, mas nunca depois de amanhã', () => {
    // Então
    expect(corteDoSaldo('2026-10', '2026-11-22')).toBe('2026-11-01');
    expect(corteDoSaldo('2026-11', '2026-11-22')).toBe('2026-11-23');
    expect(corteDoSaldo('2026', '2026-11-22')).toBe('2026-11-23');
    expect(corteDoSaldo('2025', '2026-11-22')).toBe('2026-01-01');
  });
});

describe('A receita é só o que já entrou (#268)', () => {
  const parcelas = [recebida('a', '2026-03-10', 100000), recebida('b', '2026-02-05', 40000, { responsavel_id: 'u2' }), parcela('c', '2026-03-20', 70000)];
  const recebimentos = [recebimento('a', '2026-03-10', 50000), recebimento('b', '2026-02-05', 30000, 'u2')];

  it('dadas parcelas recebidas e a receber, quando monta a receita de cada mês, então cada mês tem a bruta e a líquida dos indicadores de hoje', () => {
    // Quando
    const meses = receitaPorMes(parcelas, recebimentos, mesesDoGrafico('2026'));
    // Então
    const antes = mesesRealizados(parcelas, recebimentos, 2026);
    meses.forEach((m, i) => expect(m).toMatchObject({ bruta: antes[i].bruta, liquida: antes[i].liquida }));
    expect(meses[2]).toMatchObject({ bruta: 100000, liquida: 50000 });
  });

  it('dado um responsável, quando monta a receita, então só a dele entra, como nos indicadores', () => {
    // Quando
    const meses = receitaPorMes(parcelas, recebimentos, mesesDoGrafico('2026'), 'u2');
    // Então
    expect(meses[1]).toMatchObject({ bruta: indicadoresRealizados(parcelas, recebimentos, [], '2026-02', 'u2').bruta, liquida: 30000 });
    expect(meses[2]).toMatchObject({ bruta: 0, liquida: 0 });
  });
});

describe('O que falta receber', () => {
  const hoje = '2026-11-22';
  const parcelas = [
    parcela('a', '2026-11-05', 30000), parcela('a', '2026-11-25', 50000), recebida('a', '2026-11-10', 20000),
    parcela('b', '2026-10-10', 70000, { responsavel_id: 'u2' }), parcela('b', '2026-12-01', 60000, { responsavel_id: 'u2' }),
    parcela('c', '2027-03-01', 10000)
  ];

  it('dadas parcelas do mês, quando soma o que falta receber, então entram só as não recebidas, e as vencidas contam como atrasadas', () => {
    // Quando
    const r = aReceberNoPeriodo(parcelas, '2026-11', hoje);
    // Então
    expect(r).toEqual({ valor: 80000, parcelas: 2, atrasado: 30000 });
    expect(aReceberNoPeriodo(parcelas, '2026-11', hoje, 'u2')).toEqual({ valor: 0, parcelas: 0, atrasado: 0 });
    expect(aReceberNoPeriodo(parcelas, '2026', hoje, 'u2')).toEqual({ valor: 130000, parcelas: 2, atrasado: 70000 });
  });

  it('dadas parcelas vencidas, quando soma o que está em atraso hoje, então é o atraso da carteira da aba Direitos', () => {
    // Quando
    const r = emAtraso(parcelas, hoje);
    // Então
    const carteira = filtrarCarteira(carteiraDeContratos(parcelas, hoje), { situacao: '', busca: '' });
    expect(r).toEqual({ valor: totaisDaCarteira(carteira).atrasado, contratos: 2 });
    expect(r.valor).toBe(100000);
    expect(emAtraso(parcelas, hoje, 'u2')).toEqual({ valor: 70000, contratos: 1 });
  });

  it('dadas parcelas em aberto, quando monta as semanas, então as atrasadas vêm primeiro, e cada semana tem as que vencem nela', () => {
    // Quando
    const semanas = aReceberPorSemana(parcelas, hoje);
    // Então
    expect(semanas).toHaveLength(SEMANAS_A_RECEBER + 1);
    expect(semanas[0]).toMatchObject({ chave: 'atrasadas', atrasadas: true, valor: 100000, parcelas: 2, detalhe: 'Atrasadas · 2 parcelas' });
    expect(semanas[1]).toMatchObject({ nome: '22/11', valor: 50000, parcelas: 1, detalhe: 'De 22/11 a 28/11 · 1 parcela' });
    expect(semanas[2]).toMatchObject({ nome: '29/11', valor: 60000 });
    expect(semanas.slice(3).every(s => s.valor === 0)).toBe(true);
  });
});

describe('A comparação com o período de antes', () => {
  it('dado mais entrada que no mês anterior, quando compara, então sobe, em verde, com a diferença em reais', () => {
    // Quando
    const c = comparar(500000, 120000, '2026-10', 'mais-e-bom');
    // Então
    expect(c.seta).toBe('sobe');
    expect(c.tom).toBe('bom');
    expect(c.texto).toMatch(/^R\$\s3,8\smil a mais que em Out\/2026$/u);
  });

  it('dada mais saída, quando compara, então sobe em vermelho; menos saída desce em verde; abaixo de mil reais, vai com os centavos', () => {
    // Então
    expect(comparar(200000, 100000, '2026-10', 'mais-e-ruim')).toMatchObject({ seta: 'sobe', tom: 'erro' });
    const menos = comparar(100000, 178260, '2026-10', 'mais-e-ruim');
    expect(menos).toMatchObject({ seta: 'desce', tom: 'bom' });
    expect(menos.texto).toMatch(/^R\$\s782,60 a menos que em Out\/2026$/u);
  });

  it('dado o mesmo valor, ou o que falta receber, quando compara, então diz que é igual, sem seta, ou fica neutro', () => {
    // Então
    expect(comparar(1000, 1000, '2025', 'mais-e-bom')).toEqual({ texto: 'igual a 2025', seta: 'igual', tom: 'neutro' });
    expect(comparar(5000, 1000, '2026-10', 'neutro')).toMatchObject({ seta: 'sobe', tom: 'neutro' });
  });
});
