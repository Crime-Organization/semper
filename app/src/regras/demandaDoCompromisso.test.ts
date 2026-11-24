// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os dias de nascer são os mesmos do teste do banco (supabase/tests/demandas_dos_compromissos.test.sql).
import { describe, expect, it } from 'vitest';
import type { DiaLancado } from '../dados/tipos';
import { DEMANDA_DO_COMPROMISSO, TAMANHO_DEMANDA } from '../dados/limites';
import {
  AVISOS_DA_DEMANDA_DO_COMPROMISSO, avisoDaDemandaMudada, avisoDasDemandasNascidas, demandaAGravar, descreverDemandaDoCompromisso, diaDaDemanda, diasAntesDosCampos, diaUtilDoEscritorio, enderecoDaDemanda,
  erroDosDiasAntes, tituloDaDemanda
} from './demandaDoCompromisso';
import { CONFERENCIAS_DA_REPETICAO, REPETICAO_VAZIA } from './repeticao';

const lancado = (data: string, tipo: DiaLancado['tipo'] = 'feriado', orgao_id: string | null = null): DiaLancado => ({ id: data, data, motivo: 'Lançado', tipo, orgao_id });

describe('O dia em que a demanda nasce', () => {
  it.each([
    ['numa sexta, 3 dias antes, cai na terça', '2030-03-15', 3, [], '2030-03-12'],
    ['numa segunda, 2 dias antes, cai no sábado e recua para a sexta', '2030-03-18', 2, [], '2030-03-15'],
    ['1 dia antes, no feriado nacional de 15/11 (sexta), recua para a quinta', '2030-11-16', 1, [], '2030-11-14'],
    ['3 dias antes, num feriado lançado pelo escritório para todos os órgãos, recua', '2030-03-15', 3, [lancado('2030-03-12')], '2030-03-11'],
    ['3 dias antes, numa suspensão que fecha o fórum, recua', '2030-03-15', 3, [lancado('2030-03-12', 'suspensao')], '2030-03-11'],
    ['3 dias antes, numa suspensão só de prazos (com expediente), não recua', '2030-03-16', 3, [lancado('2030-03-13', 'suspensao_com_expediente')], '2030-03-13'],
    ['3 dias antes, num dia lançado só para um órgão, não recua', '2030-03-15', 3, [lancado('2030-03-12', 'feriado', 'o1')], '2030-03-12']
  ])('dado um compromisso %s', (_caso, data, dias, lancados, esperado) => {
    // Dado / Quando / Então
    expect(diaDaDemanda(data, dias, lancados)).toBe(esperado);
  });

  it('dado um fim de semana, um feriado nacional e um dia comum, quando se pergunta se é dia útil, então só o comum é', () => {
    // Dado / Quando / Então
    expect(diaUtilDoEscritorio('2030-03-16', [])).toBe(false);
    expect(diaUtilDoEscritorio('2030-12-25', [])).toBe(false);
    expect(diaUtilDoEscritorio('2030-03-14', [])).toBe(true);
  });
});

describe('A demanda que nasce', () => {
  it('dado o título do compromisso, quando a demanda nasce, então leva a data; sem título, "Compromisso"', () => {
    // Dado / Quando / Então
    expect(tituloDaDemanda('Reunião mensal', '2030-03-15')).toBe('Reunião mensal (15/03/2030)');
    expect(tituloDaDemanda(null, '2030-03-15')).toBe('Compromisso (15/03/2030)');
  });

  it('dado um título bem longo, quando a demanda nasce, então o título cabe no da demanda, com a data no fim', () => {
    // Dado
    const longo = 'a'.repeat(TAMANHO_DEMANDA.titulo);
    // Quando
    const titulo = tituloDaDemanda(longo, '2030-03-15');
    // Então
    expect(titulo).toHaveLength(TAMANHO_DEMANDA.titulo);
    expect(titulo.endsWith('(15/03/2030)')).toBe(true);
  });

  it('dados os dias, quando o cartão e o aviso do cadastro os mostram, então dizem quantos', () => {
    // Dado / Quando / Então
    expect(descreverDemandaDoCompromisso(1)).toBe('Nasce 1 dia antes de cada data');
    expect(descreverDemandaDoCompromisso(30)).toBe('Nasce 30 dias antes de cada data');
    expect(avisoDasDemandasNascidas(0)).toBe('');
    expect(avisoDasDemandasNascidas(1)).toBe(' 1 demanda já nasceu para as datas mais próximas.');
    expect(avisoDasDemandasNascidas(2)).toBe(' 2 demandas já nasceram para as datas mais próximas.');
  });
});

describe('O campo "Gerar demanda" no cadastro', () => {
  const conferir = (repetir: '' | 'mes', demandaDiasAntes: string) =>
    CONFERENCIAS_DA_REPETICAO.demandaDiasAntes.map(r => r({ ...REPETICAO_VAZIA, repetir, demandaDiasAntes, data: '15/03/2030' })).find(Boolean) ?? null;

  it.each([
    ['em branco', '', null],
    ['7 dias', '7', null],
    ['o máximo', String(DEMANDA_DO_COMPROMISSO.diasMaximos), null],
    ['zero', '0', `Informe de 1 a ${DEMANDA_DO_COMPROMISSO.diasMaximos} dias, ou deixe em branco.`],
    ['acima do máximo', String(DEMANDA_DO_COMPROMISSO.diasMaximos + 1), `Informe de 1 a ${DEMANDA_DO_COMPROMISSO.diasMaximos} dias, ou deixe em branco.`],
    ['texto', 'uma semana', `Informe de 1 a ${DEMANDA_DO_COMPROMISSO.diasMaximos} dias, ou deixe em branco.`]
  ])('dado o campo com %s, quando é conferido, então dá o erro certo', (_caso, texto, erro) => {
    // Dado / Quando / Então
    expect(erroDosDiasAntes(texto)).toBe(erro);
    expect(conferir('mes', texto)).toBe(erro);
  });

  it('dado o compromisso que não se repete, quando o campo é conferido, então nada é cobrado', () => {
    // Dado / Quando / Então
    expect(conferir('', '0')).toBeNull();
  });

  it('dado o compromisso que já se repete (no lápis do cartão, #417), quando o campo é conferido, então ele é cobrado', () => {
    // Dado / Quando / Então
    expect(CONFERENCIAS_DA_REPETICAO.demandaDiasAntes.map(r => r({ ...REPETICAO_VAZIA, seRepete: true, demandaDiasAntes: '0', data: '15/03/2030' })).find(Boolean))
      .toBe(`Informe de 1 a ${DEMANDA_DO_COMPROMISSO.diasMaximos} dias, ou deixe em branco.`);
  });

  it('dada a demanda ligada, mudada ou desligada no lápis, quando avisa, então diz o que vale para as datas em aberto', () => {
    // Dado / Quando / Então
    expect(avisoDaDemandaMudada(7, 1)).toBe('A demanda passa a nascer 7 dias antes de cada data em aberto. 1 demanda já nasceu para as datas mais próximas.');
    expect(avisoDaDemandaMudada(1, 0)).toBe('A demanda passa a nascer 1 dia antes de cada data em aberto.');
    expect(avisoDaDemandaMudada(null, 0)).toBe('As datas em aberto não geram mais demanda. As que já nasceram continuam.');
  });

  it('dado o campo preenchido ou em branco, quando vai para o banco, então vira o número ou null', () => {
    // Dado / Quando / Então
    expect(diasAntesDosCampos({ demandaDiasAntes: ' 7 ' })).toBe(7);
    expect(diasAntesDosCampos({ demandaDiasAntes: '' })).toBeNull();
  });
});

describe('Os avisos na caixa de Mensagens', () => {
  it('dado cada aviso, quando a caixa o mostra, então diz o que aconteceu, com as datas', () => {
    // Dado
    const m = { data_antes: '2030-03-15', data_nova: '2030-03-18' };
    // Quando / Então
    expect(AVISOS_DA_DEMANDA_DO_COMPROMISSO.demanda_nova.trecho(m)).toContain('18/03/2030');
    expect(AVISOS_DA_DEMANDA_DO_COMPROMISSO.data_mudou.trecho(m)).toContain('de 15/03/2030 para 18/03/2030');
    expect(AVISOS_DA_DEMANDA_DO_COMPROMISSO.cancelado.trecho(m)).toContain('A demanda continua');
    expect(enderecoDaDemanda('d1')).toBe('/demandas/?id=d1');
  });
});

describe('A demanda de cada data no lápis do cartão (#417)', () => {
  const lapis = { modulo: true, dias: null, atual: null, repetiuAgora: false, seRepete: false };
  it('dada a repetição dada agora, quando decide a demanda, então só liga se houver dias', () => {
    // Dado / Quando / Então
    expect(demandaAGravar({ ...lapis, repetiuAgora: true, dias: 7 })).toBe(7);
    expect(demandaAGravar({ ...lapis, repetiuAgora: true, dias: null })).toBeUndefined();
  });

  it('dado o compromisso que já se repete, quando decide a demanda, então liga, muda ou desliga só se os dias mudaram', () => {
    // Dado / Quando / Então
    expect(demandaAGravar({ ...lapis, seRepete: true, dias: 7, atual: null })).toBe(7);
    expect(demandaAGravar({ ...lapis, seRepete: true, dias: 3, atual: 7 })).toBe(3);
    expect(demandaAGravar({ ...lapis, seRepete: true, dias: null, atual: 7 })).toBeNull();
    expect(demandaAGravar({ ...lapis, seRepete: true, dias: 7, atual: 7 })).toBeUndefined();
    expect(demandaAGravar({ ...lapis, seRepete: true, dias: null, atual: null })).toBeUndefined();
  });

  it('dado o compromisso que não se repete nem ganhou repetição, ou o módulo Demandas desligado, quando decide a demanda, então não mexe', () => {
    // Dado / Quando / Então
    expect(demandaAGravar({ ...lapis, dias: 7 })).toBeUndefined();
    expect(demandaAGravar({ ...lapis, modulo: false, repetiuAgora: true, dias: 7 })).toBeUndefined();
    expect(demandaAGravar({ ...lapis, modulo: false, seRepete: true, dias: null, atual: 7 })).toBeUndefined();
  });
});
