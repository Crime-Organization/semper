// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  CONTAGEM_PADRAO, contarPrazo, erroDoPrazo, feriadosDaJusticaFederal, feriadosDePraxe, feriadosNacionais, pascoa, PRAZO_MAXIMO_DIAS, recessoForense,
  type DiaSemExpediente
} from './prazos';

/** O calendário de um processo judicial em 2026 e 2027: os feriados nacionais e o recesso. */
const JUDICIAL: DiaSemExpediente[] = [...feriadosNacionais(2026), ...feriadosNacionais(2027), ...recessoForense(2025), ...recessoForense(2026)];
const datas = (dias: { data: string }[]) => dias.map(d => d.data);

describe('Prazo em dias úteis', () => {
  it('quando a intimação é numa terça e o prazo é de 5 dias úteis, então o fim de semana não conta', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-03', dias: 5, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então
    expect(p).toEqual({
      publicacao: '2026-11-03', inicio: '2026-11-04', final: '2026-11-10',
      pulados: [{ data: '2026-11-07', motivo: 'sábado' }, { data: '2026-11-08', motivo: 'domingo' }]
    });
  });

  it('quando há um feriado no meio, então ele também é pulado, com o nome dele', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-16', dias: 5, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então
    expect(p.inicio).toBe('2026-11-17');
    expect(p.final).toBe('2026-11-24');
    expect(p.pulados).toEqual([
      { data: '2026-11-20', motivo: 'Dia Nacional de Zumbi e da Consciência Negra' },
      { data: '2026-11-21', motivo: 'sábado' }, { data: '2026-11-22', motivo: 'domingo' }
    ]);
  });

  it('quando o prazo atravessa o recesso, então nenhum dia de 20/12 a 20/01 conta', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-12-17', dias: 5, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então: 18/12 é o 1º dia; o 2º só chega em 21/01
    expect(p.inicio).toBe('2026-12-18');
    expect(p.final).toBe('2027-01-26');
    expect(p.pulados.find(d => d.data === '2026-12-25')).toEqual({ data: '2026-12-25', motivo: 'Recesso forense' });
  });

  it('quando a intimação é numa sexta e o prazo é de 1 dia útil, então ele começa e termina na segunda', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-06', dias: 1, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então
    expect([p.inicio, p.final]).toEqual(['2026-11-09', '2026-11-09']);
  });

  it('quando a data é a da disponibilização no Diário, então a publicação é o dia útil seguinte e o prazo começa no outro', () => {
    // Dado: disponibilizado na quinta 19/11; sexta 20/11 é feriado
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-19', dias: 3, contagem: 'uteis', semExpediente: JUDICIAL, disponibilizacao: true });
    // Então
    expect(p).toEqual({
      publicacao: '2026-11-23', inicio: '2026-11-24', final: '2026-11-26',
      pulados: [
        { data: '2026-11-20', motivo: 'Dia Nacional de Zumbi e da Consciência Negra' },
        { data: '2026-11-21', motivo: 'sábado' }, { data: '2026-11-22', motivo: 'domingo' }
      ]
    });
  });

  it('quando o órgão tem uma suspensão própria (ex.: portaria do tribunal), então ela não conta como dia útil', () => {
    // Dado
    const comPortaria = [...JUDICIAL, { data: '2026-11-05', motivo: 'Portaria: sistema fora do ar', tipo: 'suspensao' as const }];
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-03', dias: 5, contagem: 'uteis', semExpediente: comPortaria });
    // Então
    expect(p.final).toBe('2026-11-11');
    expect(p.pulados[0]).toEqual({ data: '2026-11-05', motivo: 'Portaria: sistema fora do ar' });
  });
});

describe('Prazo em dias corridos', () => {
  it('quando ninguém escolhe a contagem, então o padrão é dias corridos', () => {
    // Então
    expect(CONTAGEM_PADRAO).toBe('corridos');
  });

  it('quando a intimação é numa sexta, então o prazo começa na segunda (Súmula 310 do STF) e o sábado e o domingo seguintes contam', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-06', dias: 7, contagem: 'corridos', semExpediente: JUDICIAL });
    // Então: 09 a 15/11 são 7 dias; 15/11 é domingo e feriado, o fim passa para segunda, 16/11
    expect(p.inicio).toBe('2026-11-09');
    expect(p.final).toBe('2026-11-16');
    expect(p.pulados).toEqual([
      { data: '2026-11-07', motivo: 'sábado' }, { data: '2026-11-08', motivo: 'domingo' },
      { data: '2026-11-15', motivo: 'Proclamação da República' }
    ]);
  });

  it('quando o último dia cai num sábado, então o fim passa para o primeiro dia útil seguinte', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-09', dias: 5, contagem: 'corridos', semExpediente: JUDICIAL });
    // Então: 10 a 14/11; 14 é sábado, 15 é domingo e feriado
    expect(p.final).toBe('2026-11-16');
    expect(p.pulados).toEqual([{ data: '2026-11-14', motivo: 'sábado' }, { data: '2026-11-15', motivo: 'Proclamação da República' }]);
  });

  it('quando o prazo atravessa o recesso, então o recesso não conta, mas o sábado antes dele conta', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-12-17', dias: 10, contagem: 'corridos', semExpediente: JUDICIAL });
    // Então: 18 e 19/12 são os dias 1 e 2; de 21/01 a 28/01, os dias 3 a 10
    expect(p.inicio).toBe('2026-12-18');
    expect(p.final).toBe('2027-01-28');
    expect(datas(p.pulados)).not.toContain('2026-12-19');
    expect(datas(p.pulados)).toContain('2027-01-20');
  });

  it('quando a intimação cai durante o recesso, então o prazo só começa no primeiro dia útil depois dele', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-12-22', dias: 5, contagem: 'corridos', semExpediente: JUDICIAL });
    // Então
    expect(p.inicio).toBe('2027-01-21');
    expect(p.final).toBe('2027-01-25');
  });

  it('quando o órgão não segue o recesso (ex.: INPI), então só os feriados e os fins de semana mexem no começo e no fim', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-12-17', dias: 10, contagem: 'corridos', semExpediente: feriadosNacionais(2026) });
    // Então: 18 a 27/12; 27 é domingo, o fim passa para 28/12
    expect(p.final).toBe('2026-12-28');
  });
});

describe('Pedido de prazo', () => {
  it.each([
    ['zero dias', { intimacao: '2026-11-03', dias: 0 }, 'O prazo precisa ter pelo menos 1 dia, em número inteiro.'],
    ['meio dia', { intimacao: '2026-11-03', dias: 1.5 }, 'O prazo precisa ter pelo menos 1 dia, em número inteiro.'],
    ['dias demais', { intimacao: '2026-11-03', dias: PRAZO_MAXIMO_DIAS + 1 }, `O prazo pode ter até ${PRAZO_MAXIMO_DIAS} dias.`],
    ['sem data', { intimacao: '', dias: 5 }, 'Informe a data da intimação.'],
    ['uma data que não existe', { intimacao: '2026-02-30', dias: 5 }, 'A data da intimação não existe.']
  ])('quando o pedido tem %s, então avisa o que está errado', (_caso, pedido, mensagem) => {
    // Então
    expect(erroDoPrazo(pedido)).toBe(mensagem);
    expect(() => contarPrazo({ ...pedido, contagem: 'uteis', semExpediente: [] })).toThrow(mensagem);
  });

  it('quando o pedido está certo, então não há erro', () => {
    // Então
    expect(erroDoPrazo({ intimacao: '2026-11-03', dias: 15 })).toBeNull();
  });

  it('quando a mesma data é feriado e suspensão, então vale a suspensão (o prazo corrido para)', () => {
    // Dado
    const dobrado: DiaSemExpediente[] = [
      { data: '2026-11-05', motivo: 'Feriado municipal', tipo: 'feriado' },
      { data: '2026-11-05', motivo: 'Suspensão de prazos', tipo: 'suspensao' }
    ];
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-03', dias: 2, contagem: 'corridos', semExpediente: dobrado });
    // Então: 04/11 é o dia 1; 05/11 não conta; 06/11 é o dia 2
    expect(p.final).toBe('2026-11-06');
    expect(p.pulados).toEqual([{ data: '2026-11-05', motivo: 'Suspensão de prazos' }]);
  });

  it('quando não há nenhum dia útil num ano inteiro, então a contagem desiste com um aviso', () => {
    // Dado
    const anoSuspenso = recessoForense(2026).concat(Array.from({ length: 400 }, (_, i) => {
      const d = new Date(Date.UTC(2027, 0, 21 + i));
      return { data: d.toISOString().slice(0, 10), motivo: 'Suspensão', tipo: 'suspensao' as const };
    }));
    const aviso = 'Não há nenhum dia útil num ano inteiro depois dessa data: confira o calendário de feriados.';
    // Então: tanto no começo do prazo quanto no meio dele
    expect(() => contarPrazo({ intimacao: '2026-12-22', dias: 1, contagem: 'uteis', semExpediente: anoSuspenso })).toThrow(aviso);
    expect(() => contarPrazo({ intimacao: '2026-12-17', dias: 2, contagem: 'uteis', semExpediente: anoSuspenso })).toThrow(aviso);
  });
});

describe('Intimação em dia sem expediente', () => {
  it('quando a intimação é num sábado, então ela vale na segunda e o prazo começa na terça', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-11-07', dias: 5, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então: 10, 11, 12, 13 e 16/11
    expect(p).toMatchObject({ publicacao: '2026-11-09', inicio: '2026-11-10', final: '2026-11-16' });
    expect(p.pulados.slice(0, 2)).toEqual([{ data: '2026-11-07', motivo: 'sábado' }, { data: '2026-11-08', motivo: 'domingo' }]);
  });

  it('quando a intimação é durante o recesso com o fórum fechado, então ela vale em 07/01 e o prazo começa em 21/01', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2026-12-22', dias: 5, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então
    expect(p).toMatchObject({ publicacao: '2027-01-07', inicio: '2027-01-21', final: '2027-01-27' });
  });

  it('quando a intimação é de 07/01 a 20/01 (fórum aberto, prazos suspensos), então ela vale no dia e o prazo começa em 21/01', () => {
    // Quando
    const p = contarPrazo({ intimacao: '2027-01-12', dias: 5, contagem: 'uteis', semExpediente: JUDICIAL });
    // Então
    expect(p).toMatchObject({ publicacao: '2027-01-12', inicio: '2027-01-21', final: '2027-01-27' });
  });
});

describe('Disponibilização no Diário perto do recesso', () => {
  it.each([
    ['18/12/2026, antes do recesso', '2026-12-18', '2027-01-07', '2027-01-21', '2027-01-27'],
    ['12/01/2027, com o fórum aberto', '2027-01-12', '2027-01-13', '2027-01-21', '2027-01-27'],
    ['19/01/2027, véspera do fim', '2027-01-19', '2027-01-20', '2027-01-21', '2027-01-27'],
    ['20/01/2027, último dia', '2027-01-20', '2027-01-21', '2027-01-22', '2027-01-28']
  ])('quando a disponibilização é em %s, então a publicação, o início e o fim saem certos', (_caso, disponibilizado, publicacao, inicio, final) => {
    // Quando
    const p = contarPrazo({ intimacao: disponibilizado, dias: 5, contagem: 'uteis', semExpediente: JUDICIAL, disponibilizacao: true });
    // Então
    expect(p).toMatchObject({ publicacao, inicio, final });
  });

  it('quando um feriado cai na suspensão com expediente, então naquele dia o fórum fecha e a publicação passa para o dia seguinte', () => {
    // Dado: feriado municipal em 13/01/2027
    const comFeriado = [...JUDICIAL, { data: '2027-01-13', motivo: 'Feriado municipal', tipo: 'feriado' as const }];
    // Quando
    const p = contarPrazo({ intimacao: '2027-01-12', dias: 1, contagem: 'uteis', semExpediente: comFeriado, disponibilizacao: true });
    // Então
    expect(p.publicacao).toBe('2027-01-14');
    expect(p.pulados[0]).toEqual({ data: '2027-01-13', motivo: 'Feriado municipal' });
  });
});

describe('Feriados e suspensões prontos', () => {
  it.each([[2024, '2024-03-31'], [2025, '2025-04-20'], [2026, '2026-04-05'], [2027, '2027-03-28'], [2038, '2038-04-25']])(
    'quando o ano é %i, então a Páscoa cai em %s', (ano, data) => {
      // Então
      expect(pascoa(ano)).toBe(data);
    });

  it('quando se pede os feriados nacionais de 2026, então vêm só os que a lei federal fixa, em ordem de data', () => {
    // Quando
    const f = feriadosNacionais(2026);
    // Então
    expect(datas(f)).toEqual(['2026-01-01', '2026-04-21', '2026-05-01', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25']);
    expect(f.every(d => d.tipo === 'feriado')).toBe(true);
  });

  it('quando se pede os de praxe de 2026, então vêm Carnaval, Sexta-feira Santa e Corpus Christi, que não são nacionais por lei', () => {
    // Então
    expect(feriadosDePraxe(2026)).toEqual([
      { data: '2026-02-16', motivo: 'Carnaval', tipo: 'feriado' }, { data: '2026-02-17', motivo: 'Carnaval', tipo: 'feriado' },
      { data: '2026-04-03', motivo: 'Sexta-feira Santa', tipo: 'feriado' }, { data: '2026-06-04', motivo: 'Corpus Christi', tipo: 'feriado' }
    ]);
  });

  it('quando o órgão não adota o Corpus Christi, então o prazo que termina nele não é adiado', () => {
    // Quando: 5 dias úteis depois de 28/05/2026 são 29/05, 01, 02, 03 e 04/06
    const sem = contarPrazo({ intimacao: '2026-05-28', dias: 5, contagem: 'uteis', semExpediente: feriadosNacionais(2026) });
    const com = contarPrazo({ intimacao: '2026-05-28', dias: 5, contagem: 'uteis', semExpediente: [...feriadosNacionais(2026), ...feriadosDePraxe(2026)] });
    // Então: com o feriado, 04/06 não conta e o fim vai para 05/06
    expect(sem.final).toBe('2026-06-04');
    expect(com.final).toBe('2026-06-05');
  });

  it('quando se pede os feriados da Justiça Federal em 2026, então vêm os do art. 62 da Lei 5.010/1966', () => {
    // Quando
    const d = datas(feriadosDaJusticaFederal(2026));
    // Então: 01 a 06/01, Carnaval, quarta a domingo da Semana Santa, 11/08, 01/11, 08/12 e 20 a 31/12
    expect(d.slice(0, 6)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06']);
    expect(d).toEqual(expect.arrayContaining(['2026-02-16', '2026-02-17', '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05',
      '2026-08-11', '2026-11-01', '2026-12-08', '2026-12-20', '2026-12-31']));
    expect(d).toHaveLength(6 + 2 + 5 + 3 + 12);
    expect(d).toEqual([...d].sort());
  });

  it('quando se pede o recesso de 2026, então até 06/01 o fórum fecha e de 07/01 a 20/01 só os prazos ficam suspensos', () => {
    // Quando
    const r = recessoForense(2026);
    // Então
    expect(r).toHaveLength(32);
    expect([r[0].data, r[r.length - 1].data]).toEqual(['2026-12-20', '2027-01-20']);
    expect(r.filter(d => d.tipo === 'suspensao').map(d => d.data).at(-1)).toBe('2027-01-06');
    expect(r.filter(d => d.tipo === 'suspensao_com_expediente')).toHaveLength(14);
  });
});
