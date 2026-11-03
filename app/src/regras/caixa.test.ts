// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Lancamento } from '../dados/tipos';
import {
  centavosNoCampo, contaNova, dadosDaConta, dadosDaTransferencia, dadosDoLancamento, descricaoDoRepasse, diasDoMes, errosDaConta, errosDaTransferencia, errosDoLancamento, fmtCentavos, formDoLancamento, lancamentoNovo, mesDe, mesDoCaixa, mesValido,
  nomeDaCategoria, paraCentavos, transferenciaNova, valorNoAjuste, valorNoHistorico, categoriasDoFormulario, ehAjuste, rotuloDaCategoria, textoDosAjustes, valorDoAjuste } from './caixa';
import { normal } from './texto';

const HOJE = '2026-11-10';
const CONTA = { saldo_inicial_em: '2026-01-01' };
const lancamento = (extra: Partial<Lancamento>): Lancamento => ({
  id: 'l', conta_id: 'c1', data: HOJE, tipo: 'entrada', categoria: 'recebimento', valor: 1000, descricao: 'x', par_id: null, criado_por: 'u', criado_em: '2026-11-10T10:00:00Z', atualizado_em: '2026-11-10T10:00:00Z', origem: null, ...extra
});

describe('Dinheiro em centavos', () => {
  it.each([[19.99, 1999], [0.07, 7], [1.1, 110], [4.35, 435], [1234567.89, 123456789]])('quando são R$ %d, então vira um número inteiro de centavos, sem erro do computador', (reais, centavos) => {
    // Então
    expect(paraCentavos(reais)).toBe(centavos);
  });

  it('quando mostra, então aparece em reais', () => {
    // Então
    expect(fmtCentavos(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
    expect(centavosNoCampo(123450)).toBe('1.234,50');
  });
});

describe('Formulário do lançamento', () => {
  const CHEIO = { ...lancamentoNovo('c1', HOJE), valor: '1.500,50', descricao: ' Honorários ' };

  it('quando está preenchido, então o que vai para o banco está em centavos, com o tipo da categoria', () => {
    // Então
    expect(errosDoLancamento(CHEIO, CONTA)).toEqual({});
    expect(dadosDoLancamento(CHEIO)).toEqual({ conta_id: 'c1', data: HOJE, tipo: 'entrada', categoria: 'recebimento', valor: 150050, descricao: 'Honorários' });
    expect(dadosDoLancamento({ ...CHEIO, categoria: 'despesa' }).tipo).toBe('saida');
  });

  it.each([
    ['sem conta', { contaId: '' }, 'contaId', 'Escolha a conta.'],
    ['data que não existe', { data: '2026-02-31' }, 'data', 'Informe uma data válida.'],
    ['data antes do saldo inicial', { data: '2025-12-31' }, 'data', 'A conta começa em 01/01/2026, com o saldo inicial.'],
    ['valor vazio', { valor: '' }, 'valor', 'Informe o valor.'],
    ['valor zerado', { valor: '0,00' }, 'valor', 'Informe o valor.'],
    ['valor com letras', { valor: 'abc' }, 'valor', 'Use um valor como 1.500,00.'],
    ['valor negativo', { valor: '-5,00' }, 'valor', 'Use um valor como 1.500,00.'],
    ['valor absurdo', { valor: '99.999.999.999.999,00' }, 'valor', 'Esse valor é grande demais. Confira.'],
    ['sem descrição', { descricao: '  ' }, 'descricao', 'Diga do que se trata.'],
    ['descrição longa', { descricao: 'x'.repeat(301) }, 'descricao', 'Use até 300 caracteres.']
  ])('quando há %s, então avisa no campo', (_caso, mudanca, campo, mensagem) => {
    // Então
    expect(errosDoLancamento({ ...CHEIO, ...mudanca }, CONTA)).toEqual({ [campo]: mensagem });
  });

  it('quando abre um lançamento salvo, então volta como se digita, e salva igual', () => {
    // Dado
    const l = lancamento({ valor: 150050, categoria: 'despesa', tipo: 'saida', descricao: 'Luz' });
    // Quando
    const f = formDoLancamento(l);
    // Então
    expect(f).toEqual({ contaId: 'c1', data: HOJE, categoria: 'despesa', valor: '1.500,50', descricao: 'Luz' });
    expect(dadosDoLancamento(f).valor).toBe(150050);
  });
});

describe('Transferência entre contas', () => {
  const CONTAS = [{ id: 'pj', saldo_inicial_em: '2026-01-01' }, { id: 'pf', saldo_inicial_em: '2026-06-01' }];
  const CHEIA = { ...transferenciaNova({ id: 'pj', nome: 'PJ' }, { id: 'pf', nome: 'PF' }, HOJE), valor: '100,00' };

  it('quando é nova, então o texto diz o sentido certo, com o nome das contas', () => {
    // Então
    expect(CHEIA.descricao).toBe('Repasse de PJ para PF');
    expect(transferenciaNova({ id: 'pf', nome: 'PF' }, { id: 'pj', nome: 'PJ' }, HOJE).descricao).toBe(descricaoDoRepasse('PF', 'PJ'));
    expect(transferenciaNova({ id: 'pj', nome: 'PJ' }, undefined, HOJE)).toMatchObject({ para: '', descricao: '' });
    expect(nomeDaCategoria('transferencia')).toBe('Repasse entre contas');
    expect(dadosDaTransferencia(CHEIA)).toEqual({ de: 'pj', para: 'pf', data: HOJE, valor: 10000, descricao: 'Repasse de PJ para PF' });
  });

  it('quando as contas são a mesma ou faltam, então avisa', () => {
    // Então
    expect(errosDaTransferencia(CHEIA, CONTAS)).toEqual({});
    expect(errosDaTransferencia({ ...CHEIA, para: 'pj' }, CONTAS).para).toBe('Escolha duas contas diferentes.');
    expect(errosDaTransferencia({ ...CHEIA, para: '' }, CONTAS).para).toBe('Escolha as duas contas.');
  });

  it('quando a data é anterior ao início de uma das contas, então avisa', () => {
    // Então
    expect(errosDaTransferencia({ ...CHEIA, data: '2026-03-01' }, CONTAS).data).toBe('A conta começa em 01/06/2026, com o saldo inicial.');
  });
});

describe('Formulário da conta', () => {
  const CHEIA = { ...contaNova(HOJE), nome: ' PJ ', temDas: true, saldoInicial: '1.000,00' };

  it('quando está preenchida, então vai em centavos', () => {
    // Então
    expect(errosDaConta(CHEIA, [], normal)).toEqual({});
    expect(dadosDaConta(CHEIA)).toEqual({ nome: 'PJ', tem_das: true, saldo_inicial: 100000, saldo_inicial_em: HOJE });
  });

  it('quando o saldo inicial é negativo, então vale', () => {
    // Então
    expect(dadosDaConta({ ...CHEIA, saldoInicial: '-250,50' }).saldo_inicial).toBe(-25050);
    expect(errosDaConta({ ...CHEIA, saldoInicial: '-250,50' }, [], normal)).toEqual({});
  });

  it('quando o saldo é zero, então vale', () => {
    // Então
    expect(dadosDaConta({ ...CHEIA, saldoInicial: '0,00' }).saldo_inicial).toBe(0);
  });

  it('quando o nome já existe, sem contar maiúsculas e acentos, então avisa, menos para a própria conta', () => {
    // Dado
    const existentes = [{ id: 'a', nome: 'Espécie' }];
    // Então
    expect(errosDaConta({ ...CHEIA, nome: 'ESPECIE' }, existentes, normal).nome).toBe('Já existe uma conta com esse nome.');
    expect(errosDaConta({ ...CHEIA, nome: 'ESPECIE' }, existentes, normal, 'a').nome).toBeUndefined();
  });

  it.each([
    ['sem nome', { nome: ' ' }, 'nome'], ['saldo absurdo', { saldoInicial: '100.000.000.000.000,01' }, 'saldoInicial'], ['saldo inválido', { saldoInicial: 'abc' }, 'saldoInicial'], ['saldo vazio', { saldoInicial: '' }, 'saldoInicial'], ['data inválida', { saldoInicialEm: '' }, 'saldoInicialEm']
  ])('quando há %s, então avisa no campo', (_caso, mudanca, campo) => {
    // Então
    expect(Object.keys(errosDaConta({ ...CHEIA, ...mudanca }, [], normal))).toEqual([campo]);
  });
});

describe('O mês do caixa', () => {
  it.each([
    ['2026-01', '2026-01-01', '2026-01-31'], ['2024-02', '2024-02-01', '2024-02-29'], ['2026-02', '2026-02-01', '2026-02-28'], ['2026-12', '2026-12-01', '2026-12-31']
  ])('quando o mês é %s, então os dias vão de %s a %s', (mes, de, ate) => {
    // Então
    expect(diasDoMes(mes)).toEqual({ de, ate });
  });

  it('quando confere o mês, então só vale aaaa-mm', () => {
    // Então
    expect(mesValido('2026-11')).toBe(true);
    expect(mesValido('2026-13')).toBe(false);
    expect(mesValido('')).toBe(false);
    expect(mesDe(HOJE)).toBe('2026-11');
  });

  it('quando há lançamentos, então cada linha mostra o saldo, e o último do dia fica marcado, para comparar com o banco', () => {
    // Dado: fora de ordem, de propósito
    const lista = [
      lancamento({ id: 'd', data: '2026-11-11', tipo: 'saida', valor: 300 }),
      lancamento({ id: 'b', data: '2026-11-10', tipo: 'saida', valor: 200, criado_em: '2026-11-10T12:00:00Z' }),
      lancamento({ id: 'a', data: '2026-11-10', tipo: 'entrada', valor: 1000, criado_em: '2026-11-10T09:00:00Z' })
    ];
    // Quando
    const m = mesDoCaixa(lista, 500);
    // Então
    expect(m.linhas.map(l => [l.lancamento.id, l.saldo, l.fimDoDia])).toEqual([['a', 1500, false], ['b', 1300, true], ['d', 1000, true]]);
    expect(m).toMatchObject({ saldoAnterior: 500, entradas: 1000, saidas: 500, saldoFinal: 1000 });
  });

  it('quando não há lançamentos, então o saldo final é o anterior', () => {
    // Então
    expect(mesDoCaixa([], -300)).toEqual({ linhas: [], saldoAnterior: -300, entradas: 0, saidas: 0, saldoFinal: -300 });
  });

  it('quando o saldo fica negativo, então a conta continua certa', () => {
    // Então
    expect(mesDoCaixa([lancamento({ tipo: 'saida', valor: 800 })], 500).saldoFinal).toBe(-300);
  });
});

describe('Ajustes do escritório', () => {
  it('quando mostra uma mudança no saldo, no início ou no DAS, então os valores aparecem como a pessoa lê', () => {
    // Então
    expect(valorNoAjuste('Saldo inicial de PJ', 100000).replace(/\s/g, ' ')).toBe('R$ 1.000,00');
    expect(valorNoAjuste('Início de PJ', '2026-01-01')).toBe('01/01/2026');
    expect(valorNoAjuste('DAS de 2026-03', 4.5)).toBe('4,5%');
    expect(valorNoAjuste('DAS de 2026-03', null)).toBe('—');
  });
});

describe('Histórico', () => {
  it('quando mostra uma alteração, então os valores aparecem como a pessoa lê', () => {
    // Então
    expect(valorNoHistorico('valor', 150050).replace(/\s/g, ' ')).toBe('R$ 1.500,50');
    expect(valorNoHistorico('data', '2026-11-10')).toBe('10/11/2026');
    expect(valorNoHistorico('categoria', 'despesa')).toBe('Despesa');
    expect(valorNoHistorico('tipo', 'saida')).toBe('Saída');
    expect(valorNoHistorico('excluido_em', '2026-11-10T10:00:00Z')).toBe('Excluído');
    expect(valorNoHistorico('excluido_em', null)).toBe('—');
    expect(valorNoHistorico('descricao', 'Luz')).toBe('Luz');
  });
});

describe('Ajuste de saldo', () => {
  const semEspaco = (t: string) => t.replace(/\s/g, ' ');
  const AJUSTE_A_MAIS = { categoria: 'ajuste_a_mais', tipo: 'entrada' } as const;
  const AJUSTE_A_MENOS = { categoria: 'ajuste_a_menos', tipo: 'saida' } as const;

  it.each([['ajuste_a_mais', 'entrada', 'Ajuste de saldo (a mais)'], ['ajuste_a_menos', 'saida', 'Ajuste de saldo (a menos)']] as const)('quando lança %s, então vai como %s, com o nome certo', (categoria, tipo, nome) => {
    // Dado
    const form = { ...lancamentoNovo('c1', HOJE), categoria, valor: '10,00', descricao: 'Diferença do extrato' };
    // Quando
    const dados = dadosDoLancamento(form);
    // Então
    expect(dados).toMatchObject({ categoria, tipo, valor: 1000 });
    expect(nomeDaCategoria(categoria)).toBe(nome);
    expect(valorNoHistorico('categoria', categoria)).toBe(nome);
    expect(rotuloDaCategoria(categoria)).toBe(nome);
  });

  it('dado um lançamento novo, quando lista as categorias, então os dois ajustes são oferecidos; as outras continuam dizendo o tipo', () => {
    // Quando
    const lista = categoriasDoFormulario('recebimento');
    // Então
    expect(lista).toEqual(expect.arrayContaining(['ajuste_a_mais', 'ajuste_a_menos']));
    expect(rotuloDaCategoria('despesa')).toBe('Despesa (saída)');
    expect(ehAjuste('despesa')).toBe(false);
    expect(ehAjuste('transferencia')).toBe(false);
  });

  it('dado um ajuste sem motivo, quando confere, então pede o motivo; nas outras categorias o texto continua o mesmo', () => {
    // Dado
    const base = { ...lancamentoNovo('c1', HOJE), valor: '10,00', descricao: ' ' };
    // Então
    expect(errosDoLancamento({ ...base, categoria: 'ajuste_a_menos' }, CONTA).descricao).toBe('Diga o motivo do ajuste.');
    expect(errosDoLancamento({ ...base, categoria: 'despesa' }, CONTA).descricao).toBe('Diga do que se trata.');
  });

  it('dado um ajuste longo demais, quando confere, então vale o mesmo limite dos outros lançamentos', () => {
    // Dado
    const form = { ...lancamentoNovo('c1', HOJE), categoria: 'ajuste_a_mais' as const, valor: '10,00', descricao: 'x'.repeat(301) };
    // Então
    expect(errosDoLancamento(form, CONTA).descricao).toBe('Use até 300 caracteres.');
  });

  it('dado um mês com ajustes, quando resume, então o saldo muda, mas entradas e saídas ficam sem eles', () => {
    // Dado
    const lista = [
      lancamento({ id: 'a', data: '2026-11-01', tipo: 'entrada', valor: 1000 }),
      lancamento({ id: 'b', data: '2026-11-02', tipo: 'saida', categoria: 'despesa', valor: 200 }),
      lancamento({ id: 'c', data: '2026-11-03', ...AJUSTE_A_MAIS, valor: 50 }),
      lancamento({ id: 'd', data: '2026-11-04', ...AJUSTE_A_MENOS, valor: 30 })
    ];
    // Quando
    const m = mesDoCaixa(lista, 100);
    // Então
    expect(m).toMatchObject({ saldoAnterior: 100, entradas: 1000, saidas: 200, ajustes: { aMais: 50, aMenos: 30 }, saldoFinal: 920 });
    expect(m.linhas.map(l => l.saldo)).toEqual([1100, 900, 950, 920]);
  });

  it('dado um mês sem ajuste, quando resume, então não há linha de ajustes', () => {
    // Então
    expect(mesDoCaixa([lancamento({ valor: 10 })], 0).ajustes).toBeUndefined();
  });

  it('dado ajustes que se anulam, quando resume, então a linha continua aparecendo', () => {
    // Dado
    const lista = [lancamento({ id: 'a', ...AJUSTE_A_MAIS, valor: 70 }), lancamento({ id: 'b', ...AJUSTE_A_MENOS, valor: 70 })];
    // Quando
    const m = mesDoCaixa(lista, 500);
    // Então
    expect(m.ajustes).toEqual({ aMais: 70, aMenos: 70 });
    expect(m.saldoFinal).toBe(500);
  });

  it('quando mostra os ajustes, então cada lado aparece com o seu sinal, e o lado zerado não aparece', () => {
    // Então
    expect(semEspaco(textoDosAjustes({ aMais: 5000, aMenos: 3000 }))).toBe('+ R$ 50,00 · − R$ 30,00');
    expect(semEspaco(textoDosAjustes({ aMais: 5000, aMenos: 0 }))).toBe('+ R$ 50,00');
    expect(semEspaco(textoDosAjustes({ aMais: 0, aMenos: 3000 }))).toBe('− R$ 30,00');
    expect(semEspaco(valorDoAjuste({ tipo: 'entrada', valor: 5000 }))).toBe('+ R$ 50,00');
    expect(semEspaco(valorDoAjuste({ tipo: 'saida', valor: 3000 }))).toBe('− R$ 30,00');
  });
});

describe('Categorias do lançamento à mão', () => {
  it('dado um lançamento novo, quando lista, então a divisão de lucro não é oferecida: ela nasce na página de lucro', () => {
    // Dado / Quando / Então
    expect(categoriasDoFormulario('despesa')).not.toContain('divisao_lucro');
    expect(categoriasDoFormulario('despesa')).toContain('despesa');
  });

  it('dado um lançamento antigo de divisão de lucro, quando abre, então continua vendo a categoria dele', () => {
    // Dado / Quando / Então
    expect(categoriasDoFormulario('divisao_lucro')).toContain('divisao_lucro');
  });
});
