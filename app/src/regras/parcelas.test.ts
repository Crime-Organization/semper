// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { ParaReceber, RecebimentoGravado } from '../dados/tipos';
import { dividirRecebimento } from './financeiro';
import {
  avisoDaSoma, chegouAoAssinado, cruzaOutroPeriodo, dadosDaParcela, dadosDoRecebimento, dadosDoSocio, divisaoGravada, eraSocio, errosDaParcela, errosDoFormDeRecebimento, errosDoSocio, formDaParcela, linhasDaDivisao, nomesDoRecebimento,
  parcelasDoContrato, partesDoRecebimento, periodoDoSocio, previaDoRecebimento, recebimentoNovo, parcelaAntiga, resumoDasParcelas, situacaoDaParcela, somarMeses
} from './parcelas';

const HOJE = '2026-11-10';
const CONTRATO = { categoria: 'pro_labore' as const, valor: 1000, descontos: null, entrada: null, parcelas: 3, primeiro_pagamento: '2027-01-31', assinado_em: null };

describe('As datas das parcelas', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'], ['2024-01-31', 1, '2024-02-29'], ['2026-01-31', 2, '2026-03-31'], ['2026-03-15', 0, '2026-03-15'], ['2026-11-30', 3, '2027-02-28'], ['2026-12-05', 1, '2027-01-05']
  ])('quando parte de %s e soma %d meses, então cai em %s', (de, meses, ate) => {
    // Então
    expect(somarMeses(de, meses)).toBe(ate);
  });
});

describe('Quando as parcelas nascem', () => {
  it('quando o contrato tem valor e parcelas, então a soma é o valor, e a sobra da divisão vai na última', () => {
    // Quando
    const p = parcelasDoContrato(CONTRATO, HOJE);
    // Então
    expect(p).toEqual([{ vencimento: '2027-01-31', valor: 33333 }, { vencimento: '2027-02-28', valor: 33333 }, { vencimento: '2027-03-31', valor: 33334 }]);
  });

  it('quando há entrada, então ela é a primeira parcela', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, entrada: 400 }, HOJE).map(p => p.valor)).toEqual([40000, 30000, 30000]);
  });

  it('quando há entrada e uma parcela só, então o resto vira a segunda, para somar o valor', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, entrada: 400, parcelas: 1 }, HOJE).map(p => p.valor)).toEqual([40000, 60000]);
  });

  it('quando a entrada é o valor inteiro, então é uma parcela só', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, entrada: 1000 }, HOJE).map(p => p.valor)).toEqual([100000]);
  });

  it('quando não diz quantas parcelas, então é uma só', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, parcelas: null }, HOJE).map(p => p.valor)).toEqual([100000]);
  });

  it('quando há mais parcelas que centavos, então nenhuma fica zerada', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, valor: 0.02, parcelas: 5 }, HOJE).map(p => p.valor)).toEqual([1, 1]);
  });

  it.each(['quota_litis', 'sucumbencia', 'pro_bono'] as const)('quando a categoria é %s, então não gera: lança-se à mão', categoria => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, categoria }, HOJE)).toEqual([]);
  });

  it.each([[null], [0]])('quando o valor é %s, então não gera', valor => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, valor }, HOJE)).toEqual([]);
  });

  it('quando não há primeiro pagamento, então começa na assinatura e, sem ela, hoje', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, primeiro_pagamento: null, assinado_em: '2026-05-02' }, HOJE)[0].vencimento).toBe('2026-05-02');
    expect(parcelasDoContrato({ ...CONTRATO, primeiro_pagamento: null }, HOJE)[0].vencimento).toBe(HOJE);
  });

  it('quando a primeira data é absurda, então não gera', () => {
    // Então
    expect(parcelasDoContrato({ ...CONTRATO, primeiro_pagamento: '1900-01-01' }, HOJE)).toEqual([]);
  });

  it('dado um desconto, quando gera, então ele sai do valor antes de dividir', () => {
    // Dado / Quando / Então
    expect(parcelasDoContrato({ ...CONTRATO, descontos: 100 }, HOJE).map(p => p.valor)).toEqual([30000, 30000, 30000]);
  });

  it('dado um desconto e uma entrada, quando gera, então a entrada fica como foi combinada e as outras dividem o resto', () => {
    // Dado / Quando / Então
    expect(parcelasDoContrato({ ...CONTRATO, descontos: 100, entrada: 300 }, HOJE).map(p => p.valor)).toEqual([30000, 30000, 30000]);
  });

  it('dado um desconto do valor inteiro, quando gera, então não há parcelas', () => {
    // Dado / Quando / Então
    expect(parcelasDoContrato({ ...CONTRATO, descontos: 1000 }, HOJE)).toEqual([]);
  });
});

describe('Contrato que já foi assinado', () => {
  const COLUNAS = [{ id: 'a', marco: null }, { id: 'b', marco: 'assinado' as const }, { id: 'c', marco: null }];

  it.each([['a', null, false], ['b', null, true], ['c', null, false], [null, null, false], ['sumiu', null, false], ['a', '2026-01-01', true]])(
    'quando a coluna é %s e a assinatura é %s, então já foi assinado: %s', (etapa, assinado, passou) => {
      // Então
      expect(chegouAoAssinado(COLUNAS, etapa, assinado)).toBe(passou);
    });

  it('quando o quadro não tem a coluna de assinado, então só a data conta', () => {
    // Então
    expect(chegouAoAssinado([{ id: 'a', marco: null }], 'a', null)).toBe(false);
  });
});

describe('Como a parcela aparece', () => {
  it('quando vence hoje, então ainda não é atraso', () => {
    // Então
    expect(situacaoDaParcela({ recebimento_id: null, vencimento: HOJE }, HOJE)).toBe('a_receber');
    expect(situacaoDaParcela({ recebimento_id: null, vencimento: '2026-11-09' }, HOJE)).toBe('atrasada');
    expect(situacaoDaParcela({ recebimento_id: 'r', vencimento: '2026-11-09' }, HOJE)).toBe('recebida');
  });

  it('dado uma parcela paga antes do caixa, quando aparece, então é recebida, mesmo sem recebimento', () => {
    // Dado
    const antiga = { recebimento_id: null, recebida_em: '2025-03-12', vencimento: '2025-03-10', valor: 600, recebido: 550 };
    // Então
    expect(situacaoDaParcela(antiga, HOJE)).toBe('recebida');
    expect(parcelaAntiga(antiga)).toBe(true);
    expect(resumoDasParcelas([antiga], HOJE)).toEqual({ recebida: 550, atrasada: 0, a_receber: 0 });
  });

  it('dado uma parcela recebida no caixa ou uma a receber, quando confere, então não é antiga', () => {
    // Então
    expect(parcelaAntiga({ recebimento_id: 'r', recebida_em: '2026-11-01' })).toBe(false);
    expect(parcelaAntiga({ recebimento_id: null, recebida_em: null })).toBe(false);
  });

  it('quando resume, então a recebida conta pelo que entrou', () => {
    // Dado
    const lista = [
      { recebimento_id: 'r', vencimento: '2026-11-01', valor: 1000, recebido: 900 },
      { recebimento_id: null, vencimento: '2026-11-01', valor: 500, recebido: null },
      { recebimento_id: null, vencimento: '2026-12-01', valor: 300, recebido: null }
    ];
    // Então
    expect(resumoDasParcelas(lista, HOJE)).toEqual({ recebida: 900, atrasada: 500, a_receber: 300 });
  });

  it('quando a soma das parcelas é diferente do contrato, então avisa', () => {
    // Então
    expect(avisoDaSoma([{ valor: 50000 }, { valor: 50000 }], 1000)).toBeNull();
    expect(avisoDaSoma([{ valor: 50000 }], 1000)?.replace(/\s/g, ' ')).toBe('As parcelas somam R$ 500,00, e o contrato é de R$ 1.000,00.');
    expect(avisoDaSoma([], 1000)).toBeNull();
    expect(avisoDaSoma([{ valor: 50000 }], null)).toBeNull();
    expect(avisoDaSoma([{ valor: 90000 }], 1000, 100)).toBeNull();
    expect(avisoDaSoma([{ valor: 100000 }], 1000, 100)?.replace(/\s/g, ' ')).toBe('As parcelas somam R$ 1.000,00, e o contrato, com os descontos, é de R$ 900,00.');
  });
});

describe('Formulário da parcela', () => {
  it('quando está preenchido, então vai em centavos, e volta como se digita', () => {
    // Então
    expect(errosDaParcela({ vencimento: HOJE, valor: '1.500,50' })).toEqual({});
    expect(dadosDaParcela({ vencimento: HOJE, valor: '1.500,50' })).toEqual({ vencimento: HOJE, valor: 150050 });
    expect(formDaParcela({ vencimento: HOJE, valor: 150050 })).toEqual({ vencimento: HOJE, valor: '1.500,50' });
  });

  it.each([
    ['data que não existe', { vencimento: '2026-02-31', valor: '10,00' }, 'vencimento'], ['sem valor', { vencimento: HOJE, valor: '' }, 'valor'],
    ['valor zerado', { vencimento: HOJE, valor: '0,00' }, 'valor'], ['valor absurdo', { vencimento: HOJE, valor: '99.999.999.999.999,00' }, 'valor']
  ])('quando há %s, então avisa no campo', (_caso, f, campo) => {
    // Então
    expect(Object.keys(errosDaParcela(f))).toEqual([campo]);
  });
});

const PREP: ParaReceber = {
  parte_na_conta: 100, contas: [{ id: 'pf', nome: 'PF', tem_das: false }, { id: 'pj', nome: 'PJ', tem_das: true }], das: [{ mes: '2026-11', aliquota: 4.5 }], terceiros: [], socio_indicador: null, responsavel_socio: false
};
const FORM = { data: HOJE, valor: '1.000,00', contaId: 'pj', taxa: '30,00' };

describe('Formulário do recebimento', () => {
  it('quando abre, então vem com o valor da parcela e a conta que recolhe DAS', () => {
    // Então
    expect(recebimentoNovo({ valor: 150050 }, HOJE, PREP.contas)).toEqual({ data: HOJE, valor: '1.500,50', contaId: 'pj', taxa: '' });
    expect(recebimentoNovo({ valor: 100 }, HOJE, [{ id: 'pf', nome: 'PF', tem_das: false }]).contaId).toBe('pf');
    expect(recebimentoNovo({ valor: 100 }, HOJE, []).contaId).toBe('');
  });

  it('quando o valor foi ajustado, então a divisão usa o que entrou', () => {
    // Quando
    const p = previaDoRecebimento({ ...FORM, valor: '2.000,00', taxa: '' }, PREP);
    // Então
    expect(p).toMatchObject({ divisao: { naConta: 200000, das: 9000 } });
  });

  it('quando está preenchido, então mostra a divisão confirmada pelo escritório', () => {
    // Quando
    const p = previaDoRecebimento(FORM, PREP);
    // Então
    expect(p).toMatchObject({ aliquota: 4.5, aviso: null, divisao: { liquido: 92500, escritorio: 27750, responsavelRecebe: 64750 } });
  });

  it('quando o DAS do mês não foi lançado, então usa o último, com aviso', () => {
    // Quando
    const p = previaDoRecebimento({ ...FORM, data: '2026-12-10' }, PREP);
    // Então
    expect(p).toMatchObject({ aliquota: 4.5, aviso: 'O DAS deste mês ainda não foi lançado. Está valendo o de 11/2026.' });
  });

  it('quando a conta recolhe DAS e nunca houve DAS, então não dá para dividir', () => {
    // Então
    expect(previaDoRecebimento(FORM, { ...PREP, das: [] })).toEqual({ erro: 'Nenhum DAS lançado até este mês. Peça a um administrador para lançar.' });
  });

  it('quando a conta não recolhe DAS, então não há DAS nem taxa', () => {
    // Quando
    const p = previaDoRecebimento({ ...FORM, contaId: 'pf' }, { ...PREP, das: [] });
    // Então
    expect(p).toMatchObject({ aliquota: 0, divisao: { das: 0, taxaMaquina: 0, liquido: 100000 } });
    expect(dadosDoRecebimento({ ...FORM, contaId: 'pf' }, false).taxa).toBe(0);
    expect(dadosDoRecebimento(FORM, true)).toEqual({ data: HOJE, valor: 100000, contaId: 'pj', taxa: 3000 });
  });

  it('quando sobrou texto errado na taxa e a conta não recolhe DAS, então o campo escondido não trava', () => {
    // Dado
    const f = { ...FORM, contaId: 'pf', taxa: 'abc' };
    // Então
    expect(errosDoFormDeRecebimento(f, false)).toEqual({});
    expect(dadosDoRecebimento(f, false).taxa).toBe(0);
    expect(previaDoRecebimento(f, { ...PREP, das: [] })).toMatchObject({ divisao: { liquido: 100000 } });
    expect(errosDoFormDeRecebimento({ ...f, contaId: 'pj' }, true)).toEqual({ taxa: 'Use um valor como 1.500,00.' });
  });

  it('quando um campo está por preencher, então o aviso fica no campo, sem prévia', () => {
    // Então
    expect(errosDoFormDeRecebimento({ ...FORM, valor: '' }, true)).toEqual({ valor: 'Informe o valor.' });
    expect(errosDoFormDeRecebimento({ ...FORM, data: '' }, true)).toEqual({ data: 'Informe uma data válida.' });
    expect(errosDoFormDeRecebimento({ ...FORM, contaId: '' }, true)).toEqual({ contaId: 'Escolha a conta.' });
    expect(errosDoFormDeRecebimento({ ...FORM, taxa: 'abc' }, true)).toEqual({ taxa: 'Use um valor como 1.500,00.' });
    expect(previaDoRecebimento({ ...FORM, valor: '' }, PREP)).toEqual({ erro: '' });
    expect(previaDoRecebimento({ ...FORM, contaId: 'sumiu' }, PREP)).toEqual({ erro: '' });
  });

  it('quando a taxa é maior que o valor, então a regra da divisão avisa', () => {
    // Então
    expect(previaDoRecebimento({ ...FORM, taxa: '2.000,00' }, PREP)).toEqual({ erro: 'A taxa da máquina não pode ser maior que o valor recebido.' });
  });
});

describe('Como a divisão aparece', () => {
  const BASE = { valor: 100000, parteNaConta: 100 as const, contaComDas: true, aliquotaDas: 4.5, taxaMaquina: 3000, terceiros: [], socioIndicador: null, responsavelSocio: false };
  const nome = (id: string) => id.toUpperCase();
  const rotulos = (d: ReturnType<typeof dividirRecebimento>, socio = false) => linhasDaDivisao(d, 4.5, nome, socio).map(l => l.rotulo);

  it('quando há o que mostrar, então aparecem só as linhas com valor', () => {
    // Então
    expect(rotulos(dividirRecebimento(BASE))).toEqual(['Entra na conta', 'DAS (4,5%)', 'Taxa da máquina', 'Escritório', 'O escritório manda ao responsável', 'Fica com o responsável']);
  });

  it('quando há terceiro e sócio que indicou, então cada um aparece com o nome', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, terceiros: [{ id: 'ana', percentual: 10 }], socioIndicador: 'beto' });
    // Então
    expect(rotulos(d)).toContain('O responsável repassa a ANA');
    expect(rotulos(d)).toContain('O escritório paga a BETO, sócio que indicou');
    expect(rotulos(d)).toContain('Sobra no escritório');
  });

  it('quando o responsável é sócio, então a parte dele conta para o lucro', () => {
    // Quando
    const d = dividirRecebimento({ ...BASE, responsavelSocio: true });
    // Então
    expect(linhasDaDivisao(d, 4.5, nome, true, true).at(-1)).toEqual({ rotulo: 'Conta para o lucro do sócio responsável', valor: 64750 });
    // E só um administrador vê essa linha
    expect(rotulos(d, true)).not.toContain('Conta para o lucro do sócio responsável');
    expect(rotulos(d, true)).not.toContain('Fica com o responsável');
  });

  it('quando abre um recebimento gravado, então aparece como na hora, com o DAS que foi usado', () => {
    // Dado
    const r = {
      id: 'r', parcela_id: 'p', contrato_id: 'k', conta_id: 'pj', data: HOJE, valor: 100000, taxa_maquina: 3000, aliquota_das: 4.5, parte_na_conta: 100, responsavel_socio: false,
      na_conta: 100000, ficou_com_advogado: 0, das: 4500, liquido: 92500, escritorio: 27750, responsavel_recebe: 64750, responsavel_fica: 64750, escritorio_final: 17750, contribuicao_socio: 0,
      terceiros: [{ id: 'ana', nome: 'Ana', percentual: 10, valor: 9250 }], socio_indicador: { id: 'beto', nome: 'Beto', valor: 10000 }
    } satisfies RecebimentoGravado;
    // Quando
    const d = divisaoGravada(r), nomes = nomesDoRecebimento(r);
    // Então
    expect(d).toMatchObject({ naConta: 100000, escritorioFinal: 17750, terceiros: [{ id: 'ana', valor: 9250 }], socioIndicador: { id: 'beto', valor: 10000 } });
    expect([nomes.get('ana'), nomes.get('beto')]).toEqual(['Ana', 'Beto']);
    expect(divisaoGravada({ ...r, socio_indicador: null }).socioIndicador).toBeNull();
  });
});

describe('Sócios', () => {
  const LISTA = [{ id: 's1', pessoa_id: 'a', desde: '2026-01-01', ate: '2026-06-30' }, { id: 's2', pessoa_id: 'a', desde: '2026-08-01', ate: null }];

  it.each([
    ['2025-12-31', false], ['2026-01-01', true], ['2026-06-30', true], ['2026-07-01', false], ['2026-08-01', true], ['2030-01-01', true]
  ])('quando a data é %s, então era sócio: %s', (data, era) => {
    // Então
    expect(eraSocio(LISTA, 'a', data)).toBe(era);
  });

  it('quando a pessoa não está na lista, ou não há pessoa, então não era sócia', () => {
    // Então
    expect(eraSocio(LISTA, 'b', '2026-03-01')).toBe(false);
    expect(eraSocio(LISTA, null, '2026-03-01')).toBe(false);
  });

  it('quando um período cruza outro da mesma pessoa, então é recusado', () => {
    // Então
    expect(cruzaOutroPeriodo(LISTA, { pessoa_id: 'a', desde: '2026-06-01', ate: '2026-07-01' })).toBe(true);
    expect(cruzaOutroPeriodo(LISTA, { pessoa_id: 'a', desde: '2026-07-01', ate: '2026-07-31' })).toBe(false);
    expect(cruzaOutroPeriodo(LISTA, { pessoa_id: 'a', desde: '2026-07-01', ate: null })).toBe(true);
    expect(cruzaOutroPeriodo(LISTA, { pessoa_id: 'b', desde: '2026-06-01', ate: null })).toBe(false);
    expect(cruzaOutroPeriodo(LISTA, { id: 's1', pessoa_id: 'a', desde: '2026-02-01', ate: '2026-06-30' })).toBe(false);
  });

  it('quando preenche o período, então confere as datas', () => {
    // Então
    expect(errosDoSocio({ desde: '', ate: '' })).toEqual({ desde: 'Informe desde quando.' });
    expect(errosDoSocio({ desde: HOJE, ate: '' })).toEqual({});
    expect(errosDoSocio({ desde: HOJE, ate: '2026-11-09' })).toEqual({ ate: 'A saída não pode ser antes da entrada.' });
    expect(errosDoSocio({ desde: HOJE, ate: '2026-02-31' })).toEqual({ ate: 'Informe uma data válida, ou deixe em branco.' });
    expect(dadosDoSocio({ desde: HOJE, ate: '' })).toEqual({ desde: HOJE, ate: null });
    expect(periodoDoSocio({ desde: '2026-01-01', ate: null })).toBe('desde 01/01/2026');
    expect(periodoDoSocio({ desde: '2026-01-01', ate: '2026-06-30' })).toBe('desde 01/01/2026 até 30/06/2026');
  });
});

describe('Quem entra na divisão', () => {
  const nome = (id: string) => id.toUpperCase();
  const SOCIOS = [{ pessoa_id: 'socio', desde: '2026-01-01', ate: '2026-06-30' }, { pessoa_id: 'resp', desde: '2026-01-01', ate: null }];
  const CONTRATO_COM_PARTES = { participantes: [{ pessoa_id: 'part', percentual: 10 }, { pessoa_id: 'sem', percentual: null }], indicador_id: 'socio', indicador_percentual: 5 };

  it('quando o indicador era sócio na data, então recebe à parte, e não entra como terceiro', () => {
    // Quando
    const p = partesDoRecebimento(CONTRATO_COM_PARTES, SOCIOS, 'outro', '2026-03-01', nome);
    // Então
    expect(p).toEqual({ terceiros: [{ id: 'part', nome: 'PART', percentual: 10, papel: 'participante' }], socio_indicador: { id: 'socio', nome: 'SOCIO' }, responsavel_socio: false });
  });

  it('quando o indicador já não era sócio na data, então entra como terceiro, com o percentual do contrato', () => {
    // Quando
    const p = partesDoRecebimento(CONTRATO_COM_PARTES, SOCIOS, 'outro', '2026-07-01', nome);
    // Então
    expect(p.socio_indicador).toBeNull();
    expect(p.terceiros.map(t => t.id)).toEqual(['part', 'socio']);
  });

  it('quando o participante não tem percentual, então não entra na divisão', () => {
    // Quando
    const p = partesDoRecebimento({ ...CONTRATO_COM_PARTES, indicador_id: null, indicador_percentual: null }, SOCIOS, 'outro', '2026-03-01', nome);
    // Então
    expect(p.terceiros.map(t => t.id)).toEqual(['part']);
  });

  it('quando o responsável era sócio, então a divisão fica sabendo', () => {
    // Então
    expect(partesDoRecebimento({ participantes: [], indicador_id: null, indicador_percentual: null }, SOCIOS, 'resp', '2026-03-01', nome).responsavel_socio).toBe(true);
    expect(partesDoRecebimento({ participantes: [], indicador_id: null, indicador_percentual: null }, SOCIOS, null, '2026-03-01', nome).responsavel_socio).toBe(false);
  });
});
