// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Roda no fuso de Brasília (TZ=America/Sao_Paulo).
import { describe, expect, it } from 'vitest';
import type { CompromissoLista, PrazoNaAgenda } from '../dados/tipos';
import { FUSO_DA_AGENDA } from './compromisso';
import { diasDoPeriodo, hojeNaAgenda, itensDaAgenda, itensDoDia, noMesmoMes, numeroDoDia, VISOES_DE_DATA } from './agenda';

const compromisso = (id: string, data: string, hora: string | null, titulo = id) =>
  ({ id, tipo: 'reuniao', titulo, data, hora, pessoa_nome: '', processo_numero: null } as CompromissoLista);
const prazo = (id: string, data: string, hora: string | null = null): PrazoNaAgenda => ({ origem: 'tarefas', id, codigo: id, titulo: id, prazo: data, responsavel_id: 'u', hora });

describe('A data da agenda', () => {
  it.each([
    ['2026-11-03T01:00:00Z', '2026-11-02'],
    ['2026-11-03T02:59:59Z', '2026-11-02'],
    ['2026-11-03T03:00:00Z', '2026-11-03'],
    ['2026-12-31T23:30:00-03:00', '2026-12-31']
  ])('quando o instante é %s, então hoje em Brasília é %s', (instante, dia) => {
    // Quando / Então
    expect(hojeNaAgenda(new Date(instante))).toBe(dia);
  });

  it('quando se pergunta o fuso, então é o de Brasília', () => {
    // Então
    expect(FUSO_DA_AGENDA).toBe('America/Sao_Paulo');
  });
});

describe('Os períodos da agenda', () => {
  it.each([
    ['dia', '2026-11-04', '2026-11-04', '2026-11-04'],
    ['semana', '2026-11-04', '2026-11-02', '2026-11-08'],
    ['semana', '2026-11-08', '2026-11-02', '2026-11-08'],
    ['semana', '2026-11-02', '2026-11-02', '2026-11-08'],
    ['semana', '2026-12-30', '2026-12-28', '2027-01-03'],
    ['mes', '2026-11-15', '2026-10-26', '2026-12-06'],
    ['mes', '2026-02-10', '2026-01-26', '2026-03-01'],
    ['mes', '2027-02-10', '2027-02-01', '2027-02-28']
  ] as const)('quando a visão é %s em %s, então vai de %s a %s, em semanas inteiras', (visao, data, de, ate) => {
    // Quando / Então
    expect(VISOES_DE_DATA[visao].periodo(data)).toEqual({ de, ate });
  });

  it.each([
    ['dia', '2026-11-30', 1, '2026-12-01'],
    ['dia', '2026-01-01', -1, '2025-12-31'],
    ['semana', '2026-11-04', 1, '2026-11-11'],
    ['semana', '2026-11-04', -1, '2026-10-28'],
    ['mes', '2026-01-31', 1, '2026-02-01'],
    ['mes', '2026-01-15', -1, '2025-12-01'],
    ['mes', '2026-12-15', 1, '2027-01-01']
  ] as const)('quando a visão é %s em %s e anda %i, então chega a %s', (visao, data, passos, chega) => {
    // Quando / Então
    expect(VISOES_DE_DATA[visao].andar(data, passos)).toBe(chega);
  });

  it.each([
    ['dia', '2026-11-04', 'quarta-feira, 04/11/2026'],
    ['semana', '2026-11-04', '02/11/2026 a 08/11/2026'],
    ['mes', '2026-11-04', 'novembro de 2026']
  ] as const)('quando a visão é %s em %s, então o título é %s', (visao, data, titulo) => {
    // Quando / Então
    expect(VISOES_DE_DATA[visao].titulo(data)).toBe(titulo);
  });

  it('quando pede os dias do período, então vêm todos, na ordem, mesmo virando o mês', () => {
    // Quando / Então
    expect(diasDoPeriodo({ de: '2026-10-30', ate: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });

  it('quando a grade do mês mostra um dia, então sabe se ele é do mês e qual é o número', () => {
    // Quando / Então
    expect(noMesmoMes('2026-11-30', '2026-11-04')).toBe(true);
    expect(noMesmoMes('2026-12-01', '2026-11-04')).toBe(false);
    expect(numeroDoDia('2026-11-05')).toBe('5');
  });
});

describe('Os itens da agenda', () => {
  it('quando há compromissos e prazos, então vêm por dia e hora, com os sem hora primeiro', () => {
    // Quando
    const itens = itensDaAgenda(
      [compromisso('tarde', '2026-11-04', '15:00:00'), compromisso('cedo', '2026-11-04', '08:00:00'), compromisso('dia-inteiro', '2026-11-04', null), compromisso('depois', '2026-11-05', '07:00:00')],
      [prazo('prazo', '2026-11-04')]);
    // Então
    expect(itens.map(i => i.titulo)).toEqual(['dia-inteiro', 'prazo', 'cedo', 'tarde', 'depois']);
  });

  it('dado um prazo com hora, quando junta com os compromissos do dia, então ele entra na hora dele', () => {
    // Quando
    const itens = itensDaAgenda([compromisso('tarde', '2026-11-04', '15:00:00'), compromisso('cedo', '2026-11-04', '08:00:00')], [prazo('prazo', '2026-11-04', '10:30')]);
    // Então
    expect(itens.map(i => i.titulo)).toEqual(['cedo', 'prazo', 'tarde']);
    expect(itens[1].hora).toBe('10:30');
  });

  it('quando pede os itens de um dia, então vêm só os dele', () => {
    // Dado
    const itens = itensDaAgenda([compromisso('a', '2026-11-04', '08:00:00'), compromisso('b', '2026-11-05', '08:00:00')], [prazo('c', '2026-11-05')]);
    // Quando / Então
    expect(itensDoDia(itens, '2026-11-05').map(i => i.titulo)).toEqual(['c', 'b']);
  });

  it('quando o mesmo id aparece em módulos diferentes, então a chave não repete', () => {
    // Quando
    const [a, b] = itensDaAgenda([compromisso('x', '2026-11-04', '08:00:00')], [prazo('x', '2026-11-04')]);
    // Então
    expect(a.chave).not.toBe(b.chave);
  });
});
