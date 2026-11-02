// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { dasDoMes, dividirRecebimento, erroDoDas, erroDoRecebimento, lerAliquota, type Recebimento } from './financeiro';

// R$ 1.000, em centavos, com o DAS de 4,5% e a taxa da máquina de R$ 30: os exemplos confirmados pelo escritório em 02/11/2026.
const BASE: Recebimento = { valor: 100000, parteNaConta: 100, contaComDas: true, aliquotaDas: 4.5, taxaMaquina: 3000, terceiros: [], socioIndicador: null, responsavelSocio: false };

describe('Sócio responsável (decisão de 02/11/2026)', () => {
  it('quando vai tudo para a conta da empresa, então a parte dele fica no escritório e conta para o lucro', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, responsavelSocio: true });
    // Então
    expect(d).toMatchObject({ liquido: 92500, escritorio: 92500, responsavelRecebe: 0, responsavelFica: 0, contribuicaoDoSocio: 92500, escritorioFinal: 92500 });
  });

  it('quando há terceiro, então recebe do escritório só o que vai repassar', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, responsavelSocio: true, terceiros: [{ id: 'ind', percentual: 10 }] });
    // Então
    expect(d).toMatchObject({ escritorio: 83250, responsavelRecebe: 9250, responsavelFica: 0, terceiros: [{ id: 'ind', valor: 9250 }], contribuicaoDoSocio: 83250 });
  });

  it('quando outro sócio indicou, então paga a indicação, sem diminuir a contribuição', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, responsavelSocio: true, socioIndicador: 'socio' });
    // Então
    expect(d).toMatchObject({ escritorio: 92500, socioIndicador: { id: 'socio', valor: 10000 }, escritorioFinal: 82500, contribuicaoDoSocio: 92500 });
  });

  it('quando vai só uma parte para a conta, então ele já ficou com a dele, e não conta para o lucro', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta: 30, taxaMaquina: 0, responsavelSocio: true });
    // Então
    expect(d).toMatchObject({ escritorio: 28650, ficouComOAdvogado: 70000, contribuicaoDoSocio: 0 });
  });

  it('quando não é sócio, então nada conta para o lucro', () => {
    // Então
    expect(dividirRecebimento(BASE).contribuicaoDoSocio).toBe(0);
  });
});

describe('Valor pequeno demais', () => {
  it('quando a parte na conta arredonda para zero, então avisa', () => {
    // Então
    expect(erroDoRecebimento({ ...BASE, valor: 1, parteNaConta: 20, taxaMaquina: 0 })).toBe('O valor é pequeno demais para dividir.');
  });
});

describe('Os exemplos confirmados pelo escritório', () => {
  it('quando vai tudo para a conta da empresa, sem indicador, então o escritório fica com 30% do líquido e o responsável com o resto', () => {
    // Quando
    const d = dividirRecebimento(BASE);
    // Então
    expect(d).toMatchObject({ naConta: 100000, das: 4500, taxaMaquina: 3000, liquido: 92500, escritorio: 27750, responsavelRecebe: 64750, responsavelFica: 64750, escritorioFinal: 27750, terceiros: [], socioIndicador: null });
  });

  it('quando há indicador que não é sócio, então o escritório fica com 20%, e o responsável recebe a parte do indicador para repassar', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, terceiros: [{ id: 'ind', percentual: 10 }] });
    // Então
    expect(d).toMatchObject({ liquido: 92500, escritorio: 18500, responsavelRecebe: 74000, responsavelFica: 64750, terceiros: [{ id: 'ind', valor: 9250 }], escritorioFinal: 18500 });
  });

  it('quando um sócio indicou, então o escritório fica com os 30% e paga a ele 10% do que o cliente pagou', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, socioIndicador: 'socio' });
    // Então
    expect(d).toMatchObject({ escritorio: 27750, responsavelRecebe: 64750, socioIndicador: { id: 'socio', valor: 10000 }, escritorioFinal: 17750 });
  });

  it('quando 30% vão para a conta da empresa, então tudo o que chega fica com o escritório, que paga o DAS, e o advogado já ficou com o resto', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta: 30, taxaMaquina: 0 });
    // Então
    expect(d).toMatchObject({ naConta: 30000, ficouComOAdvogado: 70000, das: 1350, escritorio: 28650, responsavelRecebe: 0, responsavelFica: 70000, escritorioFinal: 28650 });
  });
});

describe('As decisões do escritório de 02/11/2026', () => {
  it('quando o indicador tem 15%, então o escritório continua com 20%, e o responsável fica com o resto', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, terceiros: [{ id: 'ind', percentual: 15 }] });
    // Então
    expect(d).toMatchObject({ escritorio: 18500, responsavelFica: 60125, terceiros: [{ id: 'ind', valor: 13875 }] });
  });

  it('quando só 30% vão para a conta, sem máquina, e o indicador tem 10%, então ele recebe R$ 98,65, do que ficou com o advogado', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta: 30, taxaMaquina: 0, terceiros: [{ id: 'ind', percentual: 10 }] });
    // Então
    expect(d).toMatchObject({ escritorio: 28650, ficouComOAdvogado: 70000, terceiros: [{ id: 'ind', valor: 9865 }], responsavelFica: 60135 });
  });

  it('quando só 30% vão para a conta e houve máquina, então a taxa é do advogado', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta: 30 });
    // Então
    expect(d).toMatchObject({ escritorio: 28650, ficouComOAdvogado: 67000, responsavelFica: 67000, escritorioFinal: 28650 });
  });

  it.each([[20, 20000, 80000], [30, 30000, 70000]] as const)('quando o dinheiro entra em conta sem DAS, em contrato de %i%%, então vale a mesma parte', (parteNaConta, escritorio, ficou) => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta, contaComDas: false });
    // Então
    expect(d).toMatchObject({ das: 0, taxaMaquina: 0, escritorio, ficouComOAdvogado: ficou });
  });
});

describe('A divisão fecha', () => {
  it.each([
    ['parte integral', BASE],
    ['um indicador', { ...BASE, terceiros: [{ id: 'a', percentual: 10 }] }],
    ['dois advogados', { ...BASE, terceiros: [{ id: 'a', percentual: 35 }] }],
    ['valor que não divide certo', { ...BASE, valor: 100001, taxaMaquina: 333, terceiros: [{ id: 'a', percentual: 7.5 }, { id: 'b', percentual: 3.33 }] }],
    ['sócio indicador', { ...BASE, valor: 33333, socioIndicador: 's' }]
  ])('quando há %s, então a soma das partes dá o líquido, sem sobrar nem faltar um centavo', (_caso, r) => {
    // Quando
    const d = dividirRecebimento(r);
    // Então
    const repassado = d.terceiros.reduce((s, t) => s + t.valor, 0);
    expect(d.escritorio + d.responsavelRecebe).toBe(d.liquido);
    expect(d.responsavelFica + repassado).toBe(d.responsavelRecebe);
    expect(d.liquido + d.das + d.taxaMaquina).toBe(d.naConta);
    expect(d.escritorioFinal).toBe(d.escritorio - (d.socioIndicador?.valor ?? 0));
  });

  it.each([[20, 0], [30, 0], [20, 777], [30, 777]] as const)('quando %i%% vão para a conta da empresa, com taxa de %i centavos, então tudo fecha com o que o cliente pagou', (parteNaConta, taxaMaquina) => {
    // Quando
    const d = dividirRecebimento({ ...BASE, valor: 100001, parteNaConta, taxaMaquina, terceiros: [{ id: 'a', percentual: 7.5 }] });
    // Então
    expect(d.naConta + d.ficouComOAdvogado + d.taxaMaquina).toBe(100001);
    expect(d.escritorio + d.das).toBe(d.naConta);
    expect(d.escritorio + d.ficouComOAdvogado).toBe(d.liquido);
    expect(d.responsavelFica + d.terceiros[0].valor).toBe(d.ficouComOAdvogado);
  });

  it('quando todo o líquido do responsável vai para os terceiros, então o arredondamento não o deixa negativo', () => {
    // Quando: R$ 1.000,03 em conta sem DAS, quatro partes de 20%
    const d = dividirRecebimento({ ...BASE, valor: 100003, contaComDas: false, terceiros: ['a', 'b', 'c', 'd'].map(id => ({ id, percentual: 20 })) });
    // Então
    expect(d.responsavelFica).toBe(0);
    expect(d.terceiros.reduce((s, t) => s + t.valor, 0)).toBe(d.responsavelRecebe);
    expect(d.escritorio + d.responsavelRecebe).toBe(d.liquido);
  });

  it('quando o percentual tem casas que o computador arredonda errado, então a conta continua exata', () => {
    // 4,35% de R$ 1.000 são exatamente R$ 43,50.
    expect(dividirRecebimento({ ...BASE, aliquotaDas: 4.35 }).das).toBe(4350);
  });

  it('quando o centavo fica no meio, então arredonda para cima', () => {
    // 4,5% de R$ 0,10 são 0,45 centavo, e de R$ 1,00, 4,5 centavos.
    expect(dividirRecebimento({ ...BASE, valor: 100, taxaMaquina: 0 }).das).toBe(5);
  });
});

describe('Outros casos da divisão', () => {
  it('quando o percentual do terceiro é outro, então o escritório continua com 20%, e o responsável fica com o resto', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, terceiros: [{ id: 'adv', percentual: 40 }] });
    // Então: líquido de 925,00
    expect(d).toMatchObject({ escritorio: 18500, responsavelRecebe: 74000, responsavelFica: 37000, terceiros: [{ id: 'adv', valor: 37000 }] });
  });

  it('quando a conta não recolhe DAS, então o líquido é o próprio valor, sem DAS nem taxa', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, contaComDas: false });
    // Então
    expect(d).toMatchObject({ das: 0, taxaMaquina: 0, liquido: 100000, escritorio: 30000, responsavelRecebe: 70000 });
  });

  it('quando um sócio indicou e só 20% chegaram à conta da empresa, então ele recebe os 10% sobre o que o cliente pagou', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta: 20, taxaMaquina: 0, socioIndicador: 'socio' });
    // Então
    expect(d).toMatchObject({ naConta: 20000, das: 900, escritorio: 19100, socioIndicador: { valor: 10000 }, escritorioFinal: 9100 });
  });

  it('quando a parte na conta é menor e houve máquina e terceiro, então a taxa e o repasse saem do que ficou com o advogado, e o repasse desconta o DAS e a taxa', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, parteNaConta: 30, terceiros: [{ id: 'ind', percentual: 10 }] });
    // Então: R$ 1.000 - 13,50 - 30 = 956,50
    expect(d).toMatchObject({ liquido: 95650, escritorio: 28650, ficouComOAdvogado: 67000, terceiros: [{ id: 'ind', valor: 9565 }], responsavelFica: 57435 });
  });
});

describe('O que não dá para dividir', () => {
  it.each([
    ['valor zerado', { valor: 0 }, 'Informe o valor recebido.'],
    ['valor com fração de centavo', { valor: 10.5 }, 'Informe o valor recebido.'],
    ['taxa negativa', { taxaMaquina: -1 }, 'A taxa da máquina precisa ser um valor em reais.'],
    ['taxa maior que o valor', { taxaMaquina: 100001 }, 'A taxa da máquina não pode ser maior que o valor recebido.'],
    ['DAS fora de 0 a 100', { aliquotaDas: 101 }, 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.'],
    ['DAS que não é número', { aliquotaDas: Number.NaN }, 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.'],
    ['DAS com mais de duas casas', { aliquotaDas: 4.567 }, 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.'],
    ['terceiro com zero', { terceiros: [{ id: 'a', percentual: 0 }] }, 'O percentual de cada pessoa precisa ser de 0 a 100, com até duas casas.'],
    ['terceiro com mais de duas casas', { terceiros: [{ id: 'a', percentual: 0.004 }] }, 'O percentual de cada pessoa precisa ser de 0 a 100, com até duas casas.'],
    ['parte fora da lista', { parteNaConta: 50 as never }, 'Escolha quanto vai para a conta da empresa: 20%, 30% ou 100%.'],
    ['parte em texto', { parteNaConta: '100' as never }, 'Escolha quanto vai para a conta da empresa: 20%, 30% ou 100%.'],
    ['parte que não é número', { parteNaConta: Number.NaN as never }, 'Escolha quanto vai para a conta da empresa: 20%, 30% ou 100%.'],
    ['taxa e DAS acima do que entrou', { taxaMaquina: 95501 }, 'A taxa da máquina e o DAS passam do que entrou na conta.'],
    ['DAS de 100% com taxa', { aliquotaDas: 100 }, 'A taxa da máquina e o DAS passam do que entrou na conta.'],
    ['taxa acima do que ficou com o advogado', { parteNaConta: 30 as const, taxaMaquina: 70001 }, 'A taxa da máquina passa do que ficou com o advogado.'],
    ['soma acima do que há para dividir', { terceiros: [{ id: 'a', percentual: 50 }, { id: 'b', percentual: 31 }] }, 'A soma dos percentuais passa do que há para dividir.'],
    ['repasse maior que o que ficou com o advogado', { parteNaConta: 30 as const, terceiros: [{ id: 'a', percentual: 75 }] }, 'Os repasses passam do que ficou com o advogado.']
  ])('quando há %s, então avisa', (_caso, mudanca, mensagem) => {
    // Então
    expect(erroDoRecebimento({ ...BASE, ...mudanca })).toBe(mensagem);
    expect(() => dividirRecebimento({ ...BASE, ...mudanca })).toThrow(mensagem);
  });

  it('quando está tudo certo, então não há erro', () => {
    // Então
    expect(erroDoRecebimento(BASE)).toBeNull();
    expect(erroDoRecebimento({ ...BASE, aliquotaDas: 0, taxaMaquina: 0 })).toBeNull();
  });

  it('quando taxa e DAS consomem exatamente o que entrou, então vale, com líquido zerado', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, taxaMaquina: 95500 });
    // Então
    expect(d).toMatchObject({ liquido: 0, escritorio: 0, responsavelRecebe: 0, responsavelFica: 0 });
  });

  it('quando a soma dá exatamente o que há para dividir, então vale, mesmo com casas que o computador soma errado', () => {
    // Então
    expect(erroDoRecebimento({ ...BASE, terceiros: [{ id: 'a', percentual: 0.01 }, { id: 'b', percentual: 64.76 }, { id: 'c', percentual: 15.23 }] })).toBeNull();
  });
});

describe('O DAS de cada mês', () => {
  const LISTA = [{ mes: '2026-07', aliquota: 5 }, { mes: '2026-01', aliquota: 4.5 }, { mes: '2026-10', aliquota: 6 }];

  it.each([['2026-01', 4.5], ['2026-07', 5], ['2026-10', 6]])('quando %s tem DAS lançado, então vale ele, sem aviso', (mes, aliquota) => {
    // Então
    expect(dasDoMes(LISTA, mes)).toEqual({ aliquota, aviso: null });
  });

  it.each([
    ['2026-06', 4.5, 'O DAS deste mês ainda não foi lançado. Está valendo o de 01/2026.'],
    ['2026-09', 5, 'O DAS deste mês ainda não foi lançado. Está valendo o de 07/2026.'],
    ['2027-03', 6, 'O DAS deste mês ainda não foi lançado. Está valendo o de 10/2026.']
  ])('quando %s não tem DAS lançado, então vale o último, com aviso', (mes, aliquota, aviso) => {
    // Então
    expect(dasDoMes(LISTA, mes)).toEqual({ aliquota, aviso });
  });

  it('quando não há nada lançado até aquele mês, então não há DAS, e o sistema não inventa um', () => {
    // Então
    expect(dasDoMes(LISTA, '2025-12')).toBeNull();
    expect(dasDoMes([], '2026-01')).toBeNull();
  });

  it('quando o DAS muda num mês, então os meses anteriores continuam com o valor deles', () => {
    // Dado
    const antes = dasDoMes(LISTA, '2026-09');
    // Quando: o DAS de outubro é corrigido
    const depois = dasDoMes(LISTA.map(a => a.mes === '2026-10' ? { ...a, aliquota: 7 } : a), '2026-09');
    // Então
    expect(depois).toEqual(antes);
  });

  it.each([
    ['mês vazio', { mes: '', aliquota: 4.5 }, 'Escolha o mês.'], ['mês 13', { mes: '2026-13', aliquota: 4.5 }, 'Escolha o mês.'],
    ['DAS negativo', { mes: '2026-01', aliquota: -1 }, 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.'], ['DAS que não é número', { mes: '2026-01', aliquota: Number.NaN }, 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.'],
    ['DAS com mais de duas casas', { mes: '2026-01', aliquota: 4.567 }, 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.']
  ])('quando há %s, então avisa', (_caso, a, mensagem) => {
    // Então
    expect(erroDoDas(a)).toBe(mensagem);
  });

  it('quando está certo, então não há erro', () => {
    // Então
    expect(erroDoDas({ mes: '2026-11', aliquota: 4.5 })).toBeNull();
  });

  it.each([['4,5', 4.5], ['4.5', 4.5], ['4,5%', 4.5], [' 5 ', 5], ['0', 0], ['100', 100]])('quando digita "%s", então é %d%%', (texto, aliquota) => {
    // Então
    expect(lerAliquota(texto)).toEqual({ aliquota });
  });

  it.each([['1e1'], ['0x10'], ['101'], ['4,567'], ['abc'], ['-1']])('quando digita "%s", então avisa, sem virar outro número', texto => {
    // Então
    expect(lerAliquota(texto)).toEqual({ erro: 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.' });
  });

  it('quando não digita nada, então pede', () => {
    // Então
    expect(lerAliquota('  ')).toEqual({ erro: 'Informe o percentual.' });
  });
});
