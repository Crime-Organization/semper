// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cronometro, errosDoAjuste, fmtDuracao, fmtParte, fmtRelogio, lerAjuste, outrosTemTempo, PARADO, parteDeCadaUmAparece, partesAoVivo, partesDaDuracao, segundosDoPeriodo, situacaoDoRelogio, somaDoTempo, totalAoVivo,
  totalAparece, type Evento } from './cronometro';

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
  // A regra mudou na revisão da #436: 59,6 s era "1 min" (arredondado) ao lado do relógio em 0:00:59; agora os dois cortam igual
  it.each([[4, '4 s'], [4.6, '4 s'], [59, '59 s'], [59.6, '59 s'], [60, '1 min'], [0.4, '0 min']])(
    'dado menos de um minuto, quando são %d segundos, então mostra %s, sem contradizer o relógio', (s, texto) => {
      // Então
      expect(fmtDuracao(s)).toBe(texto);
    });

  it.each([4.6, 59.6, 119.9, 3599.5, 1.15 * 3600])(
    'dado um tempo quebrado (%d s), quando o relógio e o tempo por extenso o mostram, então dizem os mesmos segundos', s => {
      // Quando
      const [h, m, x] = fmtRelogio(s).split(':').map(Number);
      // Então: o extenso é o relógio escrito de outro jeito (abaixo de um minuto, em segundos; depois, em horas e minutos)
      const esperado = h ? fmtDuracao(h * 3600 + m * 60) : m ? `${m} min` : x ? `${x} s` : '0 min';
      expect(fmtDuracao(s)).toBe(esperado);
    });

  it('dado 1,15 h (que a conta guarda como 4139,999… s), quando o tempo aparece, então é 1 h 09 min, e não 1 h 08 min', () => {
    // Então
    expect(fmtDuracao(1.15 * 3600)).toBe('1 h 09 min');
    expect(fmtRelogio(1.15 * 3600)).toBe('1:09:00');
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

describe('A parte de cada um, com o relógio contando (#436)', () => {
  // Como no tempo total: a Ana tem 10 min gravados, 4 deles no período que o cartão aberto está contando (id 2); a Rita, 5 min
  const tempo = {
    registros: [{ id: 1, perfil_id: 'ana', segundos: 360 }, { id: 2, perfil_id: 'ana', segundos: 240 }, { id: 3, perfil_id: 'rita', segundos: 300 }],
    equipe: [{ perfil_id: 'ana', percentual: 66.7 }, { perfil_id: 'rita', percentual: 33.3 }],
    total: 900
  };

  it('dado o cronômetro parado, quando a parte de cada um aparece, então é a do banco, com a duração de cada um', () => {
    // Quando / Então
    expect(partesAoVivo(tempo, 'ana', null, 0)).toEqual([
      { perfil_id: 'ana', percentual: 66.7, segundos: 600 }, { perfil_id: 'rita', percentual: 33.3, segundos: 300 }]);
  });

  it('dado o relógio da Ana contando, quando a parte de cada um aparece, então a linha dela anda com o relógio, e a % também', () => {
    // Quando: 9 min no período que estava gravado com 4
    const partes = partesAoVivo(tempo, 'ana', 2, 540);
    // Então: 6 + 9 = 15 min da Ana e 5 da Rita; a soma das linhas é o tempo total ao vivo
    expect(partes).toEqual([{ perfil_id: 'ana', segundos: 900, percentual: 75 }, { perfil_id: 'rita', segundos: 300, percentual: 25 }]);
    expect(partes.reduce((s, p) => s + p.segundos, 0)).toBe(totalAoVivo(tempo, 'ana', 2, 540));
  });

  it('dado quem ainda não tinha tempo na tarefa, quando o relógio dela conta, então ela entra na parte de cada um, na ordem da %', () => {
    // Quando: a Bia conta 30 min num período novo
    const partes = partesAoVivo(tempo, 'bia', null, 1800);
    // Então
    expect(partes.map(p => [p.perfil_id, p.percentual])).toEqual([['bia', 66.7], ['ana', 22.2], ['rita', 11.1]]);
  });

  it('dado quem só vê os próprios registros, quando o relógio conta, então o tempo dos outros vem da % do banco', () => {
    // Dado: a Rita não é administradora; o banco devolve só os registros dela, a parte de cada um e o total
    const daRita = { ...tempo, registros: [{ id: 3, perfil_id: 'rita', segundos: 300 }] };
    // Quando: mais 5 min no período dela
    const partes = partesAoVivo(daRita, 'rita', 3, 600);
    // Então: a Ana continua com os 10 min (66,7% de 15 min, arredondado no banco), e a Rita sobe para 10
    expect(Object.fromEntries(partes.map(p => [p.perfil_id, Math.round(p.segundos)]))).toEqual({ ana: 600, rita: 600 });
  });

  it('dado ninguém com tempo, quando o relógio começa, então só quem conta aparece, com 100%', () => {
    // Quando
    const partes = partesAoVivo({ registros: [], equipe: [], total: 0 }, 'ana', null, 4);
    // Então
    expect(partes).toEqual([{ perfil_id: 'ana', segundos: 4, percentual: 100 }]);
  });

  it.each([
    ['só quem está vendo tem tempo', [{ perfil_id: 'ana', segundos: 4, percentual: 100 }], false],
    ['só outra pessoa tem tempo (diz quem fez)', [{ perfil_id: 'rita', segundos: 4, percentual: 100 }], true],
    ['duas pessoas têm tempo', [{ perfil_id: 'ana', segundos: 4, percentual: 50 }, { perfil_id: 'rita', segundos: 4, percentual: 50 }], true],
    ['ninguém tem tempo', [], true]
  ])('quando %s, então a parte de cada um aparece: %s', (_caso, partes, aparece) => {
    // Então: a linha de uma pessoa só, que é quem está vendo, repetia o relógio e o tempo total
    expect(parteDeCadaUmAparece(partes, 'ana')).toBe(aparece);
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

describe('O relógio do cartão da tarefa (#442)', () => {
  it.each([
    [false, false, 0, 'zerado'],
    [false, true, 0, 'contando'],
    [false, false, 125, 'parado'],
    [true, false, 125, 'encerrado'],
    [true, false, 0, 'encerrado']
  ] as const)('dado concluída=%s, contando=%s e %s segundos meus, quando o cartão desenha o relógio, então a situação é "%s"', (concluida, contando, segundos, situacao) => {
    // Quando / Então
    expect(situacaoDoRelogio(concluida, contando, segundos)).toBe(situacao);
  });

  it('dado menos de um segundo contado, quando o cartão desenha o relógio, então ainda está zerado (o relógio diz "0 min")', () => {
    // Quando / Então
    expect(situacaoDoRelogio(false, false, 0.6)).toBe('zerado');
  });

  it.each([0, 4, 45 * 60, 65 * 60, 12 * 3600, 4.6])('dado %s segundos, quando o relógio quebra em pedaços, então os pedaços juntos são o tempo por extenso', segundos => {
    // Quando
    const partes = partesDaDuracao(segundos);
    // Então
    expect(partes.map(p => `${p.numero} ${p.unidade}`).join(' ')).toBe(fmtDuracao(segundos));
  });

  it('dado 1 h 05 min, quando o relógio quebra em pedaços, então o número e a unidade vêm separados', () => {
    // Quando / Então
    expect(partesDaDuracao(65 * 60)).toEqual([{ numero: '1', unidade: 'h' }, { numero: '05', unidade: 'min' }]);
  });

  it('dado só o meu tempo, quando o cartão decide a linha da equipe, então ela não aparece', () => {
    // Quando / Então
    expect(outrosTemTempo([{ perfil_id: 'eu', segundos: 600, percentual: 100 }], 'eu')).toBe(false);
  });

  it('dado o meu tempo e o de outra pessoa, quando o cartão decide a linha da equipe, então ela aparece', () => {
    // Quando / Então
    expect(outrosTemTempo([{ perfil_id: 'eu', segundos: 600, percentual: 60 }, { perfil_id: 'ana', segundos: 400, percentual: 40 }], 'eu')).toBe(true);
  });

  it('dado outra pessoa com tempo zero, quando o cartão decide a linha da equipe, então ela não aparece', () => {
    // Quando / Então
    expect(outrosTemTempo([{ perfil_id: 'ana', segundos: 0, percentual: 0 }], 'eu')).toBe(false);
  });
});

describe('A parte de cada um, escrita (#442)', () => {
  it.each([
    [66.7, '66,7%'],
    [67, '67,0%'],
    [100, '100,0%']
  ])('dado %s%%, quando a lista mostra, então escreve "%s", sempre com uma casa', (percentual, texto) => {
    // Quando / Então
    expect(fmtParte(percentual)).toBe(texto);
  });
});
