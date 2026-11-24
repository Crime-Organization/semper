// Propriedade intelectual (#317, parte C): os prazos do INPI do processo viram um compromisso que se repete na agenda (#307).
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  ACOMPANHAR_PRAZO_EXTRA, ACOMPANHAR_PROTECAO, acompanhamentoDaProtecao, AREA_DA_PI, AVISO_DO_ACOMPANHAMENTO, camposDoAcompanhamento, camposParaAcompanhar,
  avisoDoFimDaSerie, compromissoDoAcompanhamento, datasDaConta, datasQueRestamNaSerie, descreverAcompanhamento, descreverPrazoExtra, ehAcompanhamento,
  prazoExtraDaProtecao, prazosDaProtecao,
  TIPOS_DE_PROTECAO, type DatasDaProtecao
} from './propriedadeIntelectual';
import { compromissoVazio, repeticaoDoCompromisso, validarCompromisso } from './compromisso';
import { dataDaVez } from './repeticao';
import { diasEntre, somarDias } from './prazos';

const HOJE = '2026-11-04';
/** Um processo de PI com as datas dadas (e o número, se houver). */
const processo = (d: Partial<DatasDaProtecao>, numero: string | null = null) =>
  ({ protecao: null, deposito: null, concessao: null, publicacao: null, criacao: null, area: AREA_DA_PI, tipo: 'administrativo' as const, numero, ...d });

describe('Acompanhar os prazos do INPI na agenda', () => {
  it('dada uma patente depositada em 10/03/2020, quando a pessoa acompanha na agenda, então a série começa na próxima anuidade e vai até a 20ª', () => {
    // Quando
    const a = acompanhamentoDaProtecao(processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }, 'BR 10 2020 004567-8'), HOJE)!;
    // Então: a 7ª (até 10/06/2026) já acabou; a 8ª vence em 10/06/2027, e faltam 13 (da 8ª à 20ª).
    expect(a.titulo).toBe('Anuidade da patente BR 10 2020 004567-8');
    expect(a.data).toBe('2027-06-10');
    expect(a.regra).toEqual({ frequencia: 'ano', intervalo: 1, ate: null, vezes: 13 });
    // E a demanda nasce quando o prazo abre: de 10/03 a 10/06 são 92 dias.
    expect(a.diasAntes).toBe(92);
    expect(a.observacoes).toContain('de 8ª anuidade em diante');
    expect(a.observacoes).toContain(AVISO_DO_ACOMPANHAMENTO);
  });

  it('dado um modelo de utilidade, quando a pessoa acompanha, então a série vai até a 15ª anuidade', () => {
    // Quando
    const a = acompanhamentoDaProtecao(processo({ protecao: 'modelo_utilidade', deposito: '2020-03-10' }), HOJE)!;
    // Então
    expect(a.titulo).toBe('Anuidade do modelo de utilidade');
    expect(a.regra).toEqual({ frequencia: 'ano', intervalo: 1, ate: null, vezes: 8 });
  });

  it('dada uma marca concedida em 10/05/2015, quando a pessoa acompanha, então a prorrogação se repete a cada 10 anos, sem fim', () => {
    // Quando
    const a = acompanhamentoDaProtecao(processo({ protecao: 'marca', concessao: '2015-05-10' }), HOJE)!;
    // Então: o primeiro período terminou em 10/05/2025; o segundo termina em 10/05/2035. A prorrogação abre um ano antes.
    expect(a.titulo).toBe('Prorrogação da marca');
    expect(a.data).toBe('2035-05-10');
    expect(a.regra).toEqual({ frequencia: 'ano', intervalo: 10, ate: null, vezes: null });
    expect(a.diasAntes).toBe(365);
  });

  it.each([
    ['2025-01-15', '2030-01-15', 4],
    ['2018-01-15', '2028-01-15', 3]
  ] as const)('dado um desenho depositado em %s, quando a pessoa acompanha, então o quinquênio e as prorrogações vêm de 5 em 5 anos, a partir de %s, %i vezes',
    (deposito, data, vezes) => {
      // Quando
      const a = acompanhamentoDaProtecao(processo({ protecao: 'desenho_industrial', deposito }), HOJE)!;
      // Então
      expect(a.titulo).toBe('Quinquênio ou prorrogação do desenho');
      expect(a.data).toBe(data);
      expect(a.regra).toEqual({ frequencia: 'ano', intervalo: 5, ate: null, vezes });
    });

  it('dada uma patente com uma só anuidade por vir, quando a pessoa acompanha, então o compromisso não se repete', () => {
    // Quando: depositada em 10/12/2007, a 20ª anuidade vai de 10/12/2026 a 10/03/2027.
    const a = acompanhamentoDaProtecao(processo({ protecao: 'patente_invencao', deposito: '2007-12-10' }), HOJE)!;
    // Então
    expect(a.data).toBe('2027-03-10');
    expect(a.regra).toBeNull();
    expect(camposDoAcompanhamento(a).repetir).toBe('');
  });

  it.each([
    ['o programa de computador, que não tem prazo a pagar', { protecao: 'programa_computador', criacao: '2020-01-01' }],
    ['a patente sem depósito', { protecao: 'patente_invencao' }],
    ['o processo sem tipo de proteção', {}],
    ['a patente que já acabou', { protecao: 'patente_invencao', deposito: '2000-01-10' }]
  ] as const)('dado %s, quando o cartão abre, então não há o que acompanhar', (_, d) => {
    // Então
    expect(acompanhamentoDaProtecao(processo(d), HOJE)).toBeNull();
  });

  it('dado um processo de outra área, quando o cartão abre, então não há o que acompanhar', () => {
    // Então
    expect(acompanhamentoDaProtecao({ ...processo({ protecao: 'marca', concessao: '2015-05-10' }), area: 'Cível' }, HOJE)).toBeNull();
  });

  // A série do compromisso conta cada data a partir da primeira (regras/repeticao.ts). Nos depósitos de fim de mês, isso pode dar um dia
  // antes da data da lei (ex.: 29/02), nunca depois: o lembrete não chega atrasado.
  it.each(['patente_invencao', 'modelo_utilidade', 'desenho_industrial'] as const)(
    'dado um processo (%s) depositado em qualquer dia de 2024, quando a série é criada, então cada data dela cai no dia da lei ou até 3 dias antes', protecao => {
      const tipos = TIPOS_DE_PROTECAO[protecao].acompanhar!.tipos;
      for (let deposito = '2024-01-01'; deposito < '2025-01-01'; deposito = somarDias(deposito, 1)) {
        // Dado
        const d = processo({ protecao, deposito });
        const a = acompanhamentoDaProtecao(d, deposito)!;
        const daLei = prazosDaProtecao(d, deposito)!.datas.filter(x => tipos.includes(x.tipo)).map(x => x.fim);
        // Quando
        const daSerie = daLei.map((_, n) => dataDaVez({ frequencia: 'ano', intervalo: a.regra!.intervalo, inicio: a.data }, n));
        // Então
        expect(a.regra!.vezes).toBe(daLei.length);
        daSerie.forEach((data, n) => {
          expect(data <= daLei[n], `${deposito}, vez ${n}: ${data} depois de ${daLei[n]}`).toBe(true);
          expect(diasEntre(data, daLei[n])).toBeLessThanOrEqual(3);
        });
      }
    });

  it('quando o cadastro do compromisso abre pelo cartão, então vem com o tipo "Outro", a repetição e a demanda, e passa nas conferências', () => {
    // Dado
    const a = acompanhamentoDaProtecao(processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }), HOJE)!;
    // Quando
    const c = { ...compromissoVazio(), responsavelId: 'u-mauro', ...camposDoAcompanhamento(a) };
    // Então
    expect(c).toMatchObject({ tipo: 'outro', data: '10/06/2027', hora: '', repetir: 'ano', aCada: '1', termina: 'vezes', repetirVezes: '13', demandaDiasAntes: '92' });
    expect(validarCompromisso(c)).toEqual({});
    expect(repeticaoDoCompromisso(c)).toEqual(a.regra);
  });

  it('dada a marca, quando o cadastro abre, então a repetição não tem fim', () => {
    // Dado
    const a = acompanhamentoDaProtecao(processo({ protecao: 'marca', concessao: '2015-05-10' }), HOJE)!;
    // Quando
    const c = { ...compromissoVazio(), responsavelId: 'u-mauro', ...camposDoAcompanhamento(a) };
    // Então
    expect(c).toMatchObject({ termina: 'nunca', aCada: '10', repetirVezes: '' });
    expect(validarCompromisso(c)).toEqual({});
  });

  it('quando o cartão descreve o que vai criar, então diz a primeira data, a repetição e, com o módulo Demandas, a demanda', () => {
    // Dado
    const a = acompanhamentoDaProtecao(processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }), HOJE)!;
    // Então
    expect(descreverAcompanhamento(a, true))
      .toBe('Cria na agenda "Anuidade da patente" a partir de 10/06/2027 (todo ano, 13 vezes), com a demanda 92 dias antes de cada data, quando o prazo abre.');
    expect(descreverAcompanhamento(a, false)).toBe('Cria na agenda "Anuidade da patente" a partir de 10/06/2027 (todo ano, 13 vezes).');
  });

  it('dado um compromisso do processo com o mesmo título, quando o cartão abre, então ele já acompanha os prazos (o arquivado não conta)', () => {
    // Dado
    const a = { titulo: 'Anuidade da patente' };
    const ativo = { titulo: 'Anuidade da patente', arquivado_em: null }, arquivado = { titulo: 'Anuidade da patente', arquivado_em: '2026-01-01T00:00:00Z' };
    // Então
    expect(compromissoDoAcompanhamento([arquivado, ativo], a)).toBe(ativo);
    expect(compromissoDoAcompanhamento([arquivado, { titulo: 'Reunião', arquivado_em: null }], a)).toBeNull();
  });
});

describe('O prazo que já está no prazo extra, na agenda', () => {
  it('dada a patente depositada em 10/03/2020, quando o cartão abre, então a 7ª anuidade (no prazo extra) vira um compromisso no último dia do extra', () => {
    // Dado: a 7ª anuidade acabou em 10/06/2026, e o prazo extra, com taxa, vai até 10/12/2026; a série começa na 8ª
    const d = processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }, 'BR 10 2020 004567-8');
    // Quando
    const x = prazoExtraDaProtecao(d, HOJE)!;
    // Então
    expect(x).toMatchObject({ nome: '7ª anuidade', data: '2026-12-10', titulo: '7ª anuidade no prazo extra BR 10 2020 004567-8' });
    expect(x.observacoes).toContain('7ª anuidade: o prazo normal acabou em 10/06/2026; com a taxa extra, vai até 10/12/2026.');
    expect(x.observacoes).toContain(AVISO_DO_ACOMPANHAMENTO);
    expect(descreverPrazoExtra(x)).toBe('7ª anuidade está no prazo extra, com taxa, até 10/12/2026. Cria na agenda "7ª anuidade no prazo extra BR 10 2020 004567-8" nesse dia.');
    expect(acompanhamentoDaProtecao(d, HOJE)!.data).toBe('2027-06-10');
  });

  it('quando o cadastro do compromisso abre pelo prazo extra, então vem um compromisso só, do tipo "Outro", que passa nas conferências', () => {
    // Dado
    const d = processo({ protecao: 'patente_invencao', deposito: '2020-03-10' });
    // Quando
    const c = { ...compromissoVazio(), responsavelId: 'u-mauro', ...camposParaAcompanhar(ACOMPANHAR_PRAZO_EXTRA, d, HOJE) };
    // Então
    expect(c).toMatchObject({ tipo: 'outro', titulo: '7ª anuidade no prazo extra', data: '10/12/2026', hora: '', repetir: '' });
    expect(validarCompromisso(c)).toEqual({});
    expect(repeticaoDoCompromisso(c)).toBeNull();
  });

  it('dada a patente cuja última anuidade está no prazo extra, quando o cartão abre, então não há série, mas há o prazo extra', () => {
    // Dado: depositada em 10/07/2007, a 20ª anuidade acabou em 10/10/2026; com taxa, vai até 10/04/2027
    const d = processo({ protecao: 'patente_invencao', deposito: '2007-07-10' });
    // Então
    expect(acompanhamentoDaProtecao(d, HOJE)).toBeNull();
    expect(prazoExtraDaProtecao(d, HOJE)).toMatchObject({ nome: '20ª anuidade', data: '2027-04-10' });
  });

  it('dada a marca cujo período acabou em 10/08/2026, quando o cartão abre, então a prorrogação no prazo extra vai até 10/02/2027', () => {
    // Então
    expect(prazoExtraDaProtecao(processo({ protecao: 'marca', concessao: '2016-08-10' }), HOJE)).toMatchObject({ nome: '1ª prorrogação', data: '2027-02-10' });
  });

  it.each([
    ['o desenho no primeiro período', { protecao: 'desenho_industrial', deposito: '2025-01-15' }],
    ['a patente com o prazo extra já vencido', { protecao: 'patente_invencao', deposito: '2000-01-10' }],
    ['o programa de computador', { protecao: 'programa_computador', criacao: '2020-01-01' }]
  ] as const)('dado %s, quando o cartão abre, então não há prazo extra', (_, d) => {
    // Então
    expect(prazoExtraDaProtecao(processo(d), HOJE)).toBeNull();
  });

  it('dado um valor de ?acompanhar= que o cadastro não conhece, então ele não preenche nada', () => {
    // Então
    expect(ehAcompanhamento('outra-coisa')).toBe(false);
    expect(ehAcompanhamento(null)).toBe(false);
    expect(camposParaAcompanhar('outra-coisa', processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }), HOJE)).toBeNull();
    expect(camposParaAcompanhar(ACOMPANHAR_PROTECAO, processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }), HOJE)).toMatchObject({ repetir: 'ano' });
  });
});

describe('Dias entre duas datas', () => {
  it.each([['2026-03-10', '2026-06-10', 92], ['2024-02-28', '2024-03-01', 2], ['2026-06-10', '2026-03-10', -92], ['2026-01-01', '2026-01-01', 0]] as const)(
    'dadas %s e %s, quando conta os dias, então são %i', (de, ate, dias) => {
      // Então
      expect(diasEntre(de, ate)).toBe(dias);
    });
});

describe('A série da agenda depois de atualizar as datas (#418)', () => {
  it('dado o depósito que recua e deixa uma anuidade para trás, quando as datas seguintes são atualizadas, então o cartão avisa que a série ficou com uma data a mais', () => {
    // Dado: a série criada com o depósito de 10/03/2020 (13 anuidades, da 8ª à 20ª, de 10/06/2027 em diante)
    const antes = acompanhamentoDaProtecao(processo({ protecao: 'patente_invencao', deposito: '2020-03-10' }), HOJE)!;
    const serie = { frequencia: 'ano' as const, intervalo: 1, inicio: antes.data, ate: null, vezes: antes.regra!.vezes };
    // Quando: o depósito passa para 10/07/2019 (a 8ª anuidade acabou em 10/10/2026: restam 12, da 9ª em diante)
    const depois = acompanhamentoDaProtecao(processo({ protecao: 'patente_invencao', deposito: '2019-07-10' }), HOJE)!;
    const restam = datasQueRestamNaSerie(serie, antes.data);
    // Então
    expect([restam, datasDaConta(depois), depois.data]).toEqual([13, 12, '2027-10-10']);
    expect(avisoDoFimDaSerie(restam, datasDaConta(depois))).toBe('Atenção: a série da agenda tem agora 13 datas, e a conta dá 12 datas. Confira o fim da série no cartão do compromisso.');
    // E quando os números batem, nada a avisar
    expect(avisoDoFimDaSerie(13, 13)).toBeNull();
    expect(avisoDoFimDaSerie(null, null)).toBeNull();
  });

  it('dadas as séries com número de vezes, com data final e sem fim, quando se conta o que resta de uma data em diante, então a conta segue a regra', () => {
    // Dado
    const base = { frequencia: 'ano' as const, intervalo: 1, inicio: '2027-06-10' };
    // Então: da 3ª data (10/06/2029) em diante, numa série de 13 vezes, restam 11
    expect(datasQueRestamNaSerie({ ...base, ate: null, vezes: 13 }, '2029-06-10')).toBe(11);
    // até 10/06/2031: 2029, 2030 e 2031
    expect(datasQueRestamNaSerie({ ...base, ate: '2031-06-10', vezes: null }, '2029-06-10')).toBe(3);
    expect(datasQueRestamNaSerie({ ...base, ate: null, vezes: null }, '2029-06-10')).toBeNull();
    // A marca, sem fim, e o compromisso de um prazo só
    expect(datasDaConta({ regra: { frequencia: 'ano', intervalo: 10, ate: null, vezes: null } })).toBeNull();
    expect(datasDaConta({ regra: null })).toBe(1);
    expect(avisoDoFimDaSerie(2, null)).toBe('Atenção: a série da agenda tem agora 2 datas, e a conta dá datas sem fim. Confira o fim da série no cartão do compromisso.');
  });
});
