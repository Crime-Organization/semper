// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O dia útil anterior ao vencimento (#439), em supabase/functions/_compartilhado/diaUtilAnterior.ts: a despesa do escritório vai para a
// agenda Administrativo do Google nesse dia (#166). A função do servidor e o site usam a mesma conta.
import { describe, expect, it } from 'vitest';
import {
  DIAS_PARA_TRAS, diaUtil, diaUtilAnterior, diaUtilAteODia, FERIADOS_NACIONAIS_FIXOS, somarDiasCorridos, TIPOS_QUE_FECHAM, type DiaSemExpedienteLancado
} from '../../../supabase/functions/_compartilhado/diaUtilAnterior';
import { feriadosNacionais, TIPOS_SEM_EXPEDIENTE, type TipoSemExpediente } from './prazos';

const lancado = (data: string, tipo: string, orgao_id: string | null = null): DiaSemExpedienteLancado => ({ data, tipo, orgao_id });

describe('Dia útil anterior ao vencimento', () => {
  it.each([
    ['vence numa quinta: fica na quarta', '2026-11-26', '2026-11-25'],
    ['vence numa segunda: fica na sexta', '2026-11-30', '2026-11-27'],
    ['vence num sábado e a sexta é feriado nacional (20/11): fica na quinta', '2026-11-21', '2026-11-19'],
    ['vence na segunda depois do Natal numa sexta: fica na quinta, 24/12', '2026-12-28', '2026-12-24'],
    ['vence no primeiro dia do ano: fica no último do ano anterior', '2027-01-01', '2026-12-31']
  ])('dado que %s, então é esse o dia', (_caso, vencimento, esperado) => {
    // Quando
    const dia = diaUtilAnterior(vencimento);
    // Então
    expect(dia).toBe(esperado);
  });

  it('dado um feriado que o escritório lançou para todos os órgãos na véspera, quando calcula, então recua mais um dia', () => {
    // Dado
    const lancados = [lancado('2026-12-01', 'feriado')];
    // Quando
    const dia = diaUtilAnterior('2026-12-02', lancados);
    // Então
    expect(dia).toBe('2026-11-30');
  });

  it('dada uma suspensão sem expediente de vários dias, quando calcula, então pula todos eles', () => {
    // Dado
    const lancados = ['2026-12-07', '2026-12-08', '2026-12-09'].map(d => lancado(d, 'suspensao'));
    // Quando
    const dia = diaUtilAnterior('2026-12-10', lancados);
    // Então
    expect(dia).toBe('2026-12-04');
  });

  it.each([
    ['lançado só para um órgão', lancado('2026-12-01', 'feriado', 'orgao-1')],
    ['de suspensão só de prazos (com expediente)', lancado('2026-12-01', 'suspensao_com_expediente')]
  ])('dado um dia %s na véspera, quando calcula, então ele continua útil', (_caso, dia) => {
    // Quando
    const anterior = diaUtilAnterior('2026-12-02', [dia]);
    // Então
    expect(anterior).toBe('2026-12-01');
  });

  it('dado um ano inteiro sem dia útil antes do vencimento, quando calcula, então fica no dia de antes', () => {
    // Dado
    const lancados = Array.from({ length: DIAS_PARA_TRAS + 1 }, (_, i) => lancado(somarDiasCorridos('2026-12-01', -i), 'suspensao'));
    // Quando
    const dia = diaUtilAnterior('2026-12-02', lancados);
    // Então
    expect(dia).toBe('2026-12-01');
  });
});

describe('Dia útil do escritório', () => {
  it('dado um dia útil, quando procura de lá para trás, então fica no próprio dia', () => {
    // Quando / Então
    expect(diaUtilAteODia('2026-11-25')).toBe('2026-11-25');
    expect(diaUtilAteODia('2026-11-29')).toBe('2026-11-27');
  });

  it('dados os feriados nacionais do site, quando confere cada um, então a lista do servidor tem os mesmos dias', () => {
    // Dado
    const doSite = feriadosNacionais(2026).map(f => f.data.slice(5));
    // Então
    expect([...FERIADOS_NACIONAIS_FIXOS].sort()).toEqual(doSite.toSorted());
    expect(feriadosNacionais(2026).every(f => !diaUtil(f.data))).toBe(true);
  });

  it('dados os tipos de dia do Calendário, quando confere cada um, então fecham o escritório os mesmos que o site diz não ter expediente', () => {
    // Dado
    const tipos = Object.keys(TIPOS_SEM_EXPEDIENTE) as TipoSemExpediente[];
    // Então
    for (const tipo of tipos) expect(TIPOS_QUE_FECHAM.includes(tipo)).toBe(!TIPOS_SEM_EXPEDIENTE[tipo].expediente);
  });
});
