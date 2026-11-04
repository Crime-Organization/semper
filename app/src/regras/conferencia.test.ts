// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { correcaoDaLinha, filtrarConferencia, formDaLinha, resumoDaConferencia, totaisDaConferencia, valorDaLinha } from './conferencia';

const HOJE = '2026-11-04';
const linha = (m: Partial<Parameters<typeof resumoDaConferencia>[0][number]> = {}) => ({ responsavel_id: 'ana', ano: 2026, situacao: null, valor_pago: 100, valor_caixa: 30, ...m });

describe('Filtrar a conferência', () => {
  const linhas = [
    { situacao: null, cliente: 'JOÃO DA SILVA', servico: 'Inventário', referencia: 'AB12-0001-2026' },
    { situacao: 'confere' as const, cliente: 'Maria', servico: null, referencia: null },
    { situacao: 'nao_confere' as const, cliente: 'Pedro', servico: null, referencia: null },
  ];

  it.each([
    ['todas', ['JOÃO DA SILVA', 'Maria', 'Pedro']],
    ['falta', ['JOÃO DA SILVA']],
    ['confere', ['Maria']],
    ['nao_confere', ['Pedro']],
  ] as const)('dado o filtro %s, quando filtra, então mostra só essas', (filtro, esperado) => {
    // Então
    expect(filtrarConferencia(linhas, filtro, '').map(l => l.cliente)).toEqual(esperado);
  });

  it.each(['joao', 'INVENTÁRIO', 'ab12'])('dado a busca %s, quando filtra, então acha sem ligar para acento ou maiúscula', busca => {
    // Então
    expect(filtrarConferencia(linhas, 'todas', busca).map(l => l.cliente)).toEqual(['JOÃO DA SILVA']);
  });
});

describe('Totais da conferência', () => {
  it('dado uma linha sem pagamento, quando soma, então vale o que entrou no caixa', () => {
    // Então
    expect(valorDaLinha({ valor_pago: 100, valor_caixa: 30 })).toBe(100);
    expect(valorDaLinha({ valor_pago: null, valor_caixa: 30 })).toBe(30);
    expect(valorDaLinha({ valor_pago: null, valor_caixa: null })).toBe(0);
  });

  it('dado linhas marcadas e sem marcar, quando soma, então separa o que confere, o que não confere e o que falta', () => {
    // Quando
    const t = totaisDaConferencia([linha({ situacao: 'confere' }), linha({ situacao: 'nao_confere', valor_pago: 200 }), linha({ valor_pago: null })]);
    // Então
    expect(t).toEqual({ total: 3, confere: 1, nao_confere: 1, falta: 1, valor_confere: 100, valor_nao_confere: 200, valor_falta: 30 });
  });

  it('dado linhas de pessoas e anos diferentes, quando resume, então agrupa por responsável e ano, com o ano mais novo primeiro', () => {
    // Quando
    const r = resumoDaConferencia([linha({ ano: 2025 }), linha({ responsavel_id: null }), linha(), linha({ responsavel_id: 'bia', situacao: 'confere' })]);
    // Então
    expect(r.map(x => [x.ano, x.responsavel_id, x.total])).toEqual([[2026, 'ana', 1], [2026, 'bia', 1], [2026, null, 1], [2025, 'ana', 1]]);
  });
});

describe('Corrigir uma linha', () => {
  const paga = { data_pago: '2025-03-12', valor_pago: 55000 };
  const soNoCaixa = { data_pago: null, valor_pago: null };

  it('dado uma linha paga, quando nada mudou, então não há o que salvar', () => {
    // Então
    expect(correcaoDaLinha(formDaLinha(paga), paga, HOJE)).toEqual({ acao: 'nada' });
  });

  it('dado uma linha paga, quando muda o valor, então salva a data e o valor', () => {
    // Então
    expect(correcaoDaLinha({ pagoEm: '2025-03-12', valorPago: '575,50' }, paga, HOJE)).toEqual({ acao: 'salvar', data: '2025-03-12', valor: 57550 });
  });

  it.each([
    [{ pagoEm: '', valorPago: '550,00' }, { pagoEm: 'Informe uma data válida.' }],
    [{ pagoEm: '2027-01-01', valorPago: '550,00' }, { pagoEm: 'A data do pagamento não pode estar no futuro.' }],
    [{ pagoEm: '2025-03-12', valorPago: '' }, { valorPago: 'Informe o valor.' }],
  ])('dado uma linha paga, quando a correção é %j, então avisa', (f, erros) => {
    // Então
    expect(correcaoDaLinha(f, paga, HOJE)).toEqual({ acao: 'erro', erros });
  });

  it('dado uma linha que só existe no caixa, quando falta a data ou o valor, então espera a pessoa terminar', () => {
    // Então
    expect(correcaoDaLinha({ pagoEm: '2025-03-12', valorPago: '' }, soNoCaixa, HOJE)).toEqual({ acao: 'nada' });
    expect(correcaoDaLinha({ pagoEm: '', valorPago: '100,00' }, soNoCaixa, HOJE)).toEqual({ acao: 'nada' });
  });

  it('dado uma linha que só existe no caixa, quando preenche os dois, então salva', () => {
    // Então
    expect(correcaoDaLinha({ pagoEm: '2025-03-12', valorPago: '100,00' }, soNoCaixa, HOJE)).toEqual({ acao: 'salvar', data: '2025-03-12', valor: 10000 });
  });
});
