// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Hora e lembrete nos prazos de tarefas e demandas (#286).
import { describe, expect, it } from 'vitest';
import {
  CONFERENCIAS_DO_LEMBRETE, DICA_DO_LEMBRETE, HORA_PADRAO_DO_LEMBRETE, horaCurta, horaELembreteAoGravar, horaELembreteDoCartao, instanteDoLembrete, lembreteChegou, LEMBRETES, lerLembrete,
  momentoDoPrazo, OPCOES_DE_LEMBRETE, prazoComHora, rotuloDoLembrete, SEM_LEMBRETE, textoDoLembrete, TOLERANCIA_DO_LEMBRETE_EM_MINUTOS
} from './lembrete';

describe('As opções de lembrete', () => {
  it('quando o formulário lista as opções, então vêm da mais perto do prazo à mais longe, com os nomes combinados', () => {
    // Então
    expect(OPCOES_DE_LEMBRETE).toEqual([0, 30, 60, 1440]);
    expect([SEM_LEMBRETE, ...OPCOES_DE_LEMBRETE.map(l => LEMBRETES[l].nome)])
      .toEqual(['Sem lembrete', 'Na hora do prazo', '30 minutos antes', '1 hora antes', '1 dia antes']);
  });

  it.each([
    ['', null],
    ['0', 0],
    ['30', 30],
    ['1440', 1440],
    ['45', null],
    ['toString', null]
  ])('dado o valor "%s" escolhido, quando é lido, então o lembrete é %s', (valor, esperado) => {
    // Então
    expect(lerLembrete(valor)).toBe(esperado);
  });

  it('quando o lembrete aparece no cartão e no histórico, então vem por extenso; sem ele, "Sem lembrete"', () => {
    // Então
    expect(textoDoLembrete(60)).toBe('1 hora antes');
    expect(textoDoLembrete(0)).toBe('Na hora do prazo');
    expect(textoDoLembrete(null)).toBe('Sem lembrete');
  });

  it('quando o lembrete aparece na caixa de Mensagens, então diz que é lembrete e a antecedência', () => {
    // Então
    expect(rotuloDoLembrete(30)).toBe('Lembrete: 30 minutos antes');
    expect(rotuloDoLembrete(undefined)).toBe('Lembrete');
  });

  it('quando a dica do formulário é mostrada, então ela diz que, sem hora, o lembrete conta o prazo às 9h', () => {
    // Então
    expect(HORA_PADRAO_DO_LEMBRETE).toBe('09:00');
    expect(horaCurta(HORA_PADRAO_DO_LEMBRETE)).toBe('9h');
    expect(horaCurta('14:30:00')).toBe('14h30');
    expect(DICA_DO_LEMBRETE).toContain('Sem hora, o lembrete conta o prazo às 9h.');
  });
});

describe('O prazo com a hora', () => {
  it.each([
    ['2030-11-15', '14:00:00', '15/11/2030 às 14:00'],
    ['2030-11-15', '09:30', '15/11/2030 às 09:30'],
    ['2030-11-15', null, '15/11/2030'],
    [null, '14:00', '']
  ])('dado o prazo %s e a hora %s, quando aparece, então é "%s"', (data, hora, esperado) => {
    // Então
    expect(prazoComHora(data, hora)).toBe(esperado);
  });
});

describe('Quando o lembrete chega', () => {
  it('dado um prazo com hora, quando conta o instante, então é a hora de Brasília (3 horas antes do UTC)', () => {
    // Então
    expect(momentoDoPrazo('2030-11-15', '14:00:00').toISOString()).toBe('2030-11-15T17:00:00.000Z');
  });

  it('dado um prazo sem hora, quando conta o instante, então o prazo vale às 9h de Brasília', () => {
    // Então
    expect(momentoDoPrazo('2030-11-15', null).toISOString()).toBe('2030-11-15T12:00:00.000Z');
  });

  it.each([
    [0, '2030-11-15T17:00:00.000Z'],
    [30, '2030-11-15T16:30:00.000Z'],
    [60, '2030-11-15T16:00:00.000Z'],
    [1440, '2030-11-14T17:00:00.000Z']
  ] as const)('dado um lembrete de %s minutos num prazo às 14h, quando conta o instante, então é %s', (lembrete, esperado) => {
    // Então
    expect(instanteDoLembrete('2030-11-15', '14:00', lembrete).toISOString()).toBe(esperado);
  });

  it('dado um prazo sem hora com lembrete de 1 dia, quando conta o instante, então é às 9h do dia anterior', () => {
    // Então
    expect(instanteDoLembrete('2030-11-15', null, 1440).toISOString()).toBe('2030-11-14T12:00:00.000Z');
  });

  it.each([
    ['um minuto antes do instante', '2030-11-15T13:59:00-03:00', false],
    ['no instante', '2030-11-15T14:00:00-03:00', true],
    ['entre o instante e o prazo', '2030-11-15T14:40:00-03:00', true],
    ['dentro da tolerância depois do prazo', '2030-11-15T15:10:00-03:00', true],
    ['depois da tolerância', '2030-11-15T15:16:00-03:00', false]
  ])('dado um lembrete de 1 hora num prazo às 15h, quando a rotina roda %s, então chegou é %s', (_caso, agora, esperado) => {
    // Então
    expect(TOLERANCIA_DO_LEMBRETE_EM_MINUTOS).toBe(15);
    expect(lembreteChegou('2030-11-15', '15:00', 60, new Date(agora))).toBe(esperado);
  });
});

describe('Hora e lembrete no formulário', () => {
  const conferir = (c: { prazo: string; hora: string; lembrete: 0 | 30 | 60 | 1440 | null }) =>
    [...CONFERENCIAS_DO_LEMBRETE.hora, ...CONFERENCIAS_DO_LEMBRETE.lembrete].map(r => r(c)).filter(Boolean);

  it('dado hora e lembrete com prazo, quando confere, então não há erro', () => {
    // Então
    expect(conferir({ prazo: '15/11/2030', hora: '14:00', lembrete: 0 })).toEqual([]);
  });

  it('dado hora e lembrete sem prazo, quando confere, então pede o prazo para os dois', () => {
    // Então
    expect(conferir({ prazo: ' ', hora: '14:00', lembrete: 0 })).toEqual(['Informe o prazo para pôr a hora', 'Informe o prazo para marcar o lembrete']);
  });

  it('dado o prazo apagado, quando grava, então a hora e o lembrete vão vazios', () => {
    // Então
    expect(horaELembreteAoGravar(null, { hora: '14:00', lembrete: 60 })).toEqual({ prazo_hora: null, lembrete: null });
    expect(horaELembreteAoGravar('2030-11-15', { hora: '', lembrete: 60 })).toEqual({ prazo_hora: null, lembrete: 60 });
  });

  it('dado um cartão salvo com prazo, quando volta ao formulário, então a hora vem sem os segundos e o lembrete como está', () => {
    // Quando
    const campos = horaELembreteDoCartao({ prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 30 });
    // Então
    expect(campos).toEqual({ hora: '14:00', lembrete: 30 });
  });

  it('dado um cartão sem prazo que ficou com hora e lembrete no banco, quando volta ao formulário, então os dois vêm vazios', () => {
    // Dado: o site antigo tirou o prazo sem conhecer as colunas novas
    const cartao = { prazo: null, prazo_hora: '14:00:00', lembrete: 60 as const };
    // Quando
    const campos = horaELembreteDoCartao(cartao);
    // Então
    expect(campos).toEqual({ hora: '', lembrete: null });
    expect(Object.values(CONFERENCIAS_DO_LEMBRETE).flat().map(c => c({ prazo: '', ...campos })).filter(Boolean)).toEqual([]);
  });
});
