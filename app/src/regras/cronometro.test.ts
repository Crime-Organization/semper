// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cronometro, errosDoAjuste, fmtDuracao, fmtRelogio, lerAjuste, PARADO, segundosDoPeriodo, somaDoTempo, totalAoVivo, totalAparece, type Evento } from './cronometro';

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

  // #436: o resumo dizia "0 min" enquanto o relógio, ao lado, mostrava 0:00:04
  it.each([[4, '4 s'], [59, '59 s'], [59.6, '1 min'], [60, '1 min'], [0.4, '0 min']])(
    'dado menos de um minuto, quando são %d segundos, então mostra %s, sem contradizer o relógio', (s, texto) => {
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

describe('O tempo total da tarefa na faixa das datas (#397)', () => {
  // A Ana tem 10 min gravados, 4 deles no período que o cartão aberto está contando (id 2); a Rita, 5 min. O total do banco: 15 min.
  const tempo = {
    registros: [{ id: 1, perfil_id: 'ana', segundos: 360 }, { id: 2, perfil_id: 'ana', segundos: 240 }, { id: 3, perfil_id: 'rita', segundos: 300 }],
    total: 900
  };

  it('dado o cronômetro parado, quando a faixa mostra o total, então é o total gravado', () => {
    // Quando / Então
    expect(totalAoVivo(tempo, 'ana', null, 0)).toBe(900);
  });

  it('dado o cronômetro da Ana contando há 5 min no período já gravado com 4, quando a faixa mostra o total, então soma só o que falta gravar', () => {
    // Quando
    const total = totalAoVivo(tempo, 'ana', 2, 300);
    // Então: 6 min de antes + 5 min do relógio + 5 min da Rita
    expect(total).toBe(960);
  });

  it('dado um período novo, ainda sem registro, quando a faixa mostra o total, então soma o relógio inteiro', () => {
    // Quando / Então
    expect(totalAoVivo(tempo, 'rita', null, 120)).toBe(1020);
  });

  it('dado quem só vê os próprios registros (não é administrador), quando a faixa mostra o total, então o dos outros vem do total do banco', () => {
    // Dado: o banco devolve só os registros da Rita, mas o total da equipe
    const daRita = { registros: [{ id: 3, perfil_id: 'rita', segundos: 300 }], total: 900 };
    // Quando / Então
    expect(totalAoVivo(daRita, 'rita', 3, 360)).toBe(960);
  });
});

describe('Quem vê o tempo total da tarefa (#397)', () => {
  it('dado quem altera a tarefa, quando ninguém registrou tempo, então o total aparece (0 min é o tempo dela)', () => {
    // Quando / Então
    expect(totalAparece(true, 0)).toBe(true);
  });

  it('dado quem só lê, quando o banco devolve o total, então ele aparece', () => {
    // Quando / Então
    expect(totalAparece(false, 7200)).toBe(true);
  });

  it('dado quem só lê, quando o banco não devolve o total (só vê pela equipe vendo tudo, ou não há tempo), então ele não aparece', () => {
    // Quando / Então
    expect(totalAparece(false, 0)).toBe(false);
  });
});
