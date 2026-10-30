// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cronometro, errosDoAjuste, fmtDuracao, fmtRelogio, lerAjuste, PARADO, segundosDoPeriodo, somaDoTempo, type Evento } from './cronometro';

const MIN = 60_000;
const INATIVIDADE = 10 * MIN;
/** Aplica os acontecimentos em ordem, a partir do cronômetro parado. */
const depois = (...eventos: Evento[]) => eventos.reduce(cronometro, PARADO);

describe('Cronômetro da tarefa', () => {
  it('quando começa e passam 5 minutos, então o período tem 5 minutos', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 });
    // Então
    expect(segundosDoPeriodo(c, 5 * MIN)).toBe(300);
  });

  it('quando pausa, então o tempo para de contar e volta a contar ao retomar', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'pausar', agora: 3 * MIN }, { tipo: 'iniciar', agora: 10 * MIN });
    // Então
    expect(segundosDoPeriodo(c, 12 * MIN)).toBe(300);
  });

  it('quando passam 10 minutos sem mexer, então aparece o aviso, e o tempo depois dele fica esperando a resposta', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'tique', agora: 10 * MIN, inatividade: INATIVIDADE });
    // Então
    expect(c.aviso).toBe(10 * MIN);
    expect(segundosDoPeriodo(c, 25 * MIN)).toBe(600);
  });

  it('quando a pessoa mexe antes dos 10 minutos, então não aparece o aviso', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'mexeu', agora: 6 * MIN }, { tipo: 'tique', agora: 12 * MIN, inatividade: INATIVIDADE });
    // Então
    expect(c.aviso).toBeNull();
  });

  it('quando responde "Ainda estou", então o tempo desde o aviso é somado', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'tique', agora: 10 * MIN, inatividade: INATIVIDADE },
      { tipo: 'responder', agora: 25 * MIN, aindaEstou: true });
    // Então
    expect(segundosDoPeriodo(c, 25 * MIN)).toBe(25 * 60);
  });

  it('quando responde "Não estava", então o tempo desde o aviso é descartado e a contagem recomeça dali', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'tique', agora: 10 * MIN, inatividade: INATIVIDADE },
      { tipo: 'responder', agora: 25 * MIN, aindaEstou: false });
    // Então
    expect(segundosDoPeriodo(c, 25 * MIN)).toBe(600);
    expect(segundosDoPeriodo(c, 30 * MIN)).toBe(900);
  });

  it('quando fecha o cartão com o aviso na tela, então o tempo desde o aviso não conta', () => {
    // Quando
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'tique', agora: 10 * MIN, inatividade: INATIVIDADE }, { tipo: 'pausar', agora: 40 * MIN });
    // Então
    expect(segundosDoPeriodo(c, 40 * MIN)).toBe(600);
  });

  it('quando o tempo do período é lido várias vezes, então só cresce (é o que vai sendo gravado)', () => {
    // Dado
    const c = depois({ tipo: 'iniciar', agora: 0 }, { tipo: 'tique', agora: 10 * MIN, inatividade: INATIVIDADE });
    const antes = segundosDoPeriodo(c, 12 * MIN);
    // Quando
    const respondido = cronometro(c, { tipo: 'responder', agora: 14 * MIN, aindaEstou: false });
    // Então
    expect(segundosDoPeriodo(respondido, 15 * MIN)).toBeGreaterThanOrEqual(antes);
  });
});

describe('Tempo por extenso e ajuste à mão', () => {
  it.each([[0, '0 min'], [45 * 60, '45 min'], [3900, '1 h 05 min'], [12 * 3600, '12 h'], [-300, '0 min']])('quando são %i segundos, então mostra %s', (s, texto) => {
    // Então
    expect(fmtDuracao(s)).toBe(texto);
  });

  it('quando o relógio do cartão mostra o tempo, então é horas:minutos:segundos', () => {
    // Então
    expect(fmtRelogio(4 * 60 + 9)).toBe('0:04:09');
    expect(fmtRelogio(26 * 3600 + 5)).toBe('26:00:05');
  });

  it.each([['30', 1800], ['30min', 1800], ['1h', 3600], ['1h30', 5400], ['1:30', 5400], ['-20min', -1200], ['+ 2h 15', 8100]])(
    'quando o ajuste é escrito "%s", então são %i segundos', (texto, segundos) => {
      // Então
      expect(lerAjuste(texto)).toBe(segundos);
    });

  it.each([['', 'Escreva o tempo'], ['meia hora', 'Escreva o tempo'], ['0', 'não pode ser zero'], ['25h', 'até 24 horas']])(
    'quando o ajuste é "%s", então explica o erro', (texto, erro) => {
      // Então
      expect(() => lerAjuste(texto)).toThrow(erro);
    });

  it('quando falta o motivo, então o ajuste não pode ser salvo', () => {
    // Quando
    const erros = errosDoAjuste('30min', '  ');
    // Então
    expect(erros).toEqual({ motivo: 'Diga o motivo do ajuste (ele fica registrado).' });
  });

  it('quando se somam os registros, então entram os ajustes; o tempo de cada um nunca fica negativo, e o da equipe soma o de cada um', () => {
    // Dado
    const r = [{ perfil_id: 'ana', segundos: 600 }, { perfil_id: 'ana', segundos: -120 }, { perfil_id: 'rita', segundos: 300 }, { perfil_id: 'rita', segundos: -900 }];
    // Então
    expect(somaDoTempo(r, 'ana')).toBe(480);
    expect(somaDoTempo(r, 'rita')).toBe(0);
    expect(somaDoTempo(r)).toBe(480);
  });
});
