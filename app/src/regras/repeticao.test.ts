// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os casos de fim de mês e de ano bissexto são os mesmos do teste do banco (supabase/tests/compromissos_que_se_repetem.test.sql).
import { describe, expect, it } from 'vitest';
import { REPETICAO } from '../dados/limites';
import {
  avisoDaRepeticao, avisoDasSeguintes, avisoDoLapis, camposPorExtenso, camposQueMudamNasSeguintes, falhaNoLapis, passosDoLapis, perguntaDosCampos, REPETIDO_NO_CARTAO,
  CONFERENCIAS_DA_REPETICAO, dataDaVez, descreverRepeticao, REPETICAO_VAZIA, regraDosCampos, regraNoLimite, somarMeses, vezDaData, vezesParaGerar, vezNaLista,
  type CamposRepeticao, type SerieDeRepeticao, type VezNaLista
} from './repeticao';

const serie = (campos: Partial<SerieDeRepeticao> = {}): SerieDeRepeticao => ({ frequencia: 'mes', intervalo: 1, inicio: '2026-01-31', ate: null, vezes: null, ...campos });

describe('As datas da repetição', () => {
  it.each([
    ['mensal no dia 31, no mês seguinte', serie(), 1, '2026-02-28'],
    ['mensal no dia 31, dois meses depois (conta da primeira, volta ao dia 31)', serie(), 2, '2026-03-31'],
    ['mensal no dia 31, em abril', serie(), 3, '2026-04-30'],
    ['mensal no dia 31, em ano bissexto', serie({ inicio: '2024-01-31' }), 1, '2024-02-29'],
    ['anual em 29/02, no ano seguinte', serie({ frequencia: 'ano', inicio: '2024-02-29' }), 1, '2025-02-28'],
    ['anual em 29/02, quatro anos depois', serie({ frequencia: 'ano', inicio: '2024-02-29' }), 4, '2028-02-29'],
    ['a cada 2 semanas', serie({ frequencia: 'semana', intervalo: 2, inicio: '2026-11-22' }), 1, '2026-12-06'],
    ['a cada 10 anos (renovação de marca)', serie({ frequencia: 'ano', intervalo: 10, inicio: '2026-03-15' }), 1, '2036-03-15']
  ])('dada uma repetição %s, quando se conta a data, então ela é a certa', (_caso, r, n, esperada) => {
    // Dado / Quando / Então
    expect(dataDaVez(r, n)).toBe(esperada);
  });

  it('dado o fim do ano, quando se somam meses, então a data passa para o ano seguinte (e volta, com meses negativos)', () => {
    // Dado / Quando / Então
    expect(somarMeses('2026-11-30', 3)).toBe('2027-02-28');
    expect(somarMeses('2026-01-15', -2)).toBe('2025-11-15');
  });

  it('dada uma data da série, quando se procura a vez dela, então é a posição na regra (a primeira é a vez 0)', () => {
    // Dado / Quando / Então
    expect(vezDaData(serie(), '2026-01-31')).toBe(0);
    expect(vezDaData(serie(), '2026-04-30')).toBe(3);
  });
});

describe('As datas que viram cartão', () => {
  const datas = (r: SerieDeRepeticao, geradaAte: string, hoje: string) => vezesParaGerar(r, geradaAte, hoje).map(v => v.data);

  it('dada uma repetição mensal sem fim, quando ela é criada, então as datas dos próximos 12 meses viram cartões', () => {
    // Dado / Quando
    const geradas = datas(serie(), '2026-01-31', '2026-01-31');
    // Então
    expect(geradas).toHaveLength(REPETICAO.horizonteMeses);
    expect(geradas[0]).toBe('2026-02-28');
    expect(geradas.at(-1)).toBe('2027-01-31');
  });

  it('dada uma repetição a cada 10 anos, quando ela é criada, então a próxima aparece mesmo depois do horizonte', () => {
    // Dado / Quando / Então
    expect(datas(serie({ frequencia: 'ano', intervalo: 10, inicio: '2026-03-15' }), '2026-03-15', '2026-03-15')).toEqual(['2036-03-15']);
  });

  it('dada uma repetição até uma data ou por um número de vezes, então nenhuma data passa do fim', () => {
    // Dado / Quando / Então
    expect(datas(serie({ frequencia: 'semana', inicio: '2026-02-01', ate: '2026-02-20' }), '2026-02-01', '2026-02-01')).toEqual(['2026-02-08', '2026-02-15']);
    expect(datas(serie({ frequencia: 'semana', inicio: '2026-02-01', vezes: 3 }), '2026-02-01', '2026-02-01')).toEqual(['2026-02-08', '2026-02-15']);
  });

  it('dada uma série que já gerou datas, quando a rotina roda de novo, então só vêm as que ainda não viraram cartão, de hoje em diante', () => {
    // Dado
    const r = serie({ frequencia: 'ano', inicio: '2024-05-10' });
    // Quando / Então
    expect(datas(r, '2024-05-10', '2026-01-10')).toEqual(['2026-05-10']);
    expect(datas(r, '2026-05-10', '2026-06-01')).toEqual(['2027-05-10']);
    expect(datas(r, '2027-05-10', '2026-06-01')).toEqual([]);
  });
});

describe('O quadro e a tabela', () => {
  const vez = (id: string, data: string, aberta = true, hora: string | null = '10:00:00'): VezNaLista => ({ id, data, hora, aberta });

  it('dada uma série com datas passadas e futuras, então aparece só a próxima em aberto', () => {
    // Dado
    const vezes = [vez('a', '2026-11-15'), vez('c', '2026-11-29'), vez('b', '2026-11-22', false)];
    // Quando / Então
    expect(vezNaLista(vezes, '2026-11-20')).toBe('c');
  });

  it('dada uma série sem nenhuma data adiante em aberto, então aparece a última que passou sem ser marcada; sem nenhuma aberta, nenhuma', () => {
    // Dado / Quando / Então
    expect(vezNaLista([vez('a', '2026-11-01'), vez('b', '2026-11-08'), vez('c', '2026-11-29', false)], '2026-11-20')).toBe('b');
    expect(vezNaLista([vez('a', '2026-11-01', false)], '2026-11-20')).toBeNull();
  });

  it('dadas duas datas no mesmo dia, então vem a de hora mais cedo (a sem hora primeiro)', () => {
    // Dado / Quando / Então
    expect(vezNaLista([vez('a', '2026-11-22', true, '15:00:00'), vez('b', '2026-11-22', true, null)], '2026-11-20')).toBe('b');
  });
});

describe('A repetição no cadastro', () => {
  const campos = (c: Partial<CamposRepeticao>) => ({ ...REPETICAO_VAZIA, data: '10/12/2026', ...c });
  const erros = (c: Partial<CamposRepeticao>) => Object.fromEntries(Object.entries(CONFERENCIAS_DA_REPETICAO)
    .map(([k, regras]) => [k, regras.map(r => r(campos(c))).find(Boolean) ?? null]).filter(([, e]) => e));

  it('dado um compromisso que não se repete, então nada da repetição é conferido', () => {
    // Dado / Quando / Então
    expect(erros({ aCada: '', termina: 'data' })).toEqual({});
    expect(regraDosCampos(REPETICAO_VAZIA)).toBeNull();
  });

  it('dada uma repetição sem o N, com o N acima do máximo, ou sem a data final, então o cadastro avisa', () => {
    // Dado / Quando / Então
    expect(erros({ repetir: 'ano', aCada: '' }).aCada).toMatch(/de 1 a/);
    expect(erros({ repetir: 'ano', aCada: String(REPETICAO.intervaloMaximo + 1) }).aCada).toMatch(/de 1 a/);
    expect(erros({ repetir: 'mes', termina: 'data' }).repetirAte).toBe('Informe até quando o compromisso se repete.');
    expect(erros({ repetir: 'mes', termina: 'data', repetirAte: '01/12/2026' }).repetirAte).toBe('A data final precisa ser depois da data do compromisso.');
    expect(erros({ repetir: 'mes', termina: 'vezes', repetirVezes: '1' }).repetirVezes).toMatch(/de 2 a/);
  });

  it('dada uma repetição a cada 10 anos até 2050, então a regra vai para o banco com a data final', () => {
    // Dado / Quando / Então
    expect(regraDosCampos(campos({ repetir: 'ano', aCada: '10', termina: 'data', repetirAte: '31/12/2050' }))).toEqual({ frequencia: 'ano', intervalo: 10, ate: '2050-12-31', vezes: null });
    expect(regraDosCampos(campos({ repetir: 'semana', termina: 'vezes', repetirVezes: '12' }))).toEqual({ frequencia: 'semana', intervalo: 1, ate: null, vezes: 12 });
  });

  it('dada uma regra, então ela só vale dentro dos limites do banco', () => {
    // Dado / Quando / Então
    expect(regraNoLimite({ frequencia: 'ano', intervalo: 10, ate: null, vezes: null })).toBe(true);
    expect(regraNoLimite({ frequencia: 'ano', intervalo: 0, ate: null, vezes: null })).toBe(false);
    expect(regraNoLimite({ frequencia: 'mes', intervalo: 1, ate: null, vezes: 1 })).toBe(false);
    expect(regraNoLimite({ frequencia: 'mes', intervalo: 1, ate: '2027-01-01', vezes: 3 })).toBe(false);
  });

  it.each([
    [{ frequencia: 'ano' as const, intervalo: 1, ate: null, vezes: null }, 'Todo ano, sem data para terminar'],
    [{ frequencia: 'ano' as const, intervalo: 10, ate: '2050-12-31', vezes: null }, 'A cada 10 anos, até 31/12/2050'],
    [{ frequencia: 'semana' as const, intervalo: 1, ate: null, vezes: 12 }, 'Toda semana, 12 vezes']
  ])('dada a regra %o, então o cartão a descreve por extenso', (r, texto) => {
    // Dado / Quando / Então
    expect(descreverRepeticao(r)).toBe(texto);
  });
});

describe('O aviso depois de cadastrar', () => {
  it('dada uma repetição com a sala livre, então o aviso diz quantas datas a mais; com a sala ocupada em alguma, diz quais', () => {
    // Dado / Quando / Então
    expect(avisoDaRepeticao('K1A2', { ids: ['a'], semSala: [] })).toBe('Compromisso K1A2 cadastrado, com mais 1 data na agenda.');
    expect(avisoDaRepeticao('K1A2', { ids: ['a', 'b', 'c'], semSala: ['2026-12-08'] }))
      .toBe('Compromisso K1A2 cadastrado, com mais 3 datas na agenda. Em 1 data (08/12/2026), a sala estava ocupada, e o compromisso ficou sem sala.');
  });

  it('dado o compromisso que passa a se repetir no cartão (#431), então o aviso diz isso, e não que ele foi cadastrado', () => {
    // Dado / Quando / Então
    expect(avisoDaRepeticao('K1A2', { ids: ['a', 'b'], semSala: [] }, REPETIDO_NO_CARTAO)).toBe('Compromisso K1A2 passa a se repetir, com mais 2 datas na agenda.');
  });
});

describe('O aviso de "esta e as seguintes"', () => {
  it('dadas as datas mudadas ou arquivadas, então o aviso diz quantas, no singular ou no plural', () => {
    // Dado / Quando / Então
    expect(avisoDasSeguintes('mudados', 1)).toBe('1 compromisso mudado na repetição.');
    expect(avisoDasSeguintes('arquivados', 5)).toBe('5 compromissos arquivados. A repetição parou.');
  });
});

describe('O lápis do compromisso que se repete (#417)', () => {
  it('dados os campos de antes e os gravados, quando compara, então ficam só o título, o local, a equipe e as pessoas que mudaram', () => {
    // Dado
    const antes = { titulo: 'Reunião', local: 'Sala 1', responsavel_id: 'u-ana', participantes: ['u-bia'], pessoas: ['p1'], observacoes: null };
    // Quando
    const mudou = camposQueMudamNasSeguintes(antes, { ...antes, local: 'Sala 2', participantes: [], observacoes: 'Nova' });
    // Então: as observações mudam só nesta data
    expect(mudou).toEqual({ local: 'Sala 2', participantes: [] });
    expect(camposQueMudamNasSeguintes(antes, { ...antes, observacoes: 'Nova' })).toEqual({});
  });

  it('dado o lápis sem o título (ele muda no próprio lugar), quando compara, então o título não entra', () => {
    // Dado / Quando / Então
    expect(camposQueMudamNasSeguintes({ titulo: 'Reunião', local: null }, { local: null })).toEqual({});
  });

  it.each([
    [{ titulo: 'x' }, 'o título'],
    [{ local: 'x', responsavel_id: 'u-ana', participantes: [] }, 'o local e a equipe'],
    [{ pessoas: [], titulo: 'x', local: null }, 'o título, o local e as pessoas']
  ])('dados os campos %o, quando a pergunta os cita, então vêm por extenso, sem repetir', (campos, texto) => {
    // Dado / Quando / Então
    expect(camposPorExtenso(campos)).toBe(texto);
    expect(perguntaDosCampos(campos)).toBe(`Este compromisso se repete. Mudar ${texto} só nesta data, ou nesta e nas seguintes ainda em aberto?`);
  });

  it('dado o lápis que só gravou esta data, quando avisa, então não há aviso próprio (vale o de sempre, com Desfazer)', () => {
    // Dado / Quando / Então
    expect(avisoDoLapis({ codigo: 'K1', seguintes: null, repetidos: null, demanda: null })).toBeNull();
  });

  it('dadas as seguintes mudadas, a repetição nova ou a demanda mudada, quando avisa, então diz cada coisa', () => {
    // Dado / Quando / Então
    expect(avisoDoLapis({ codigo: 'K1', seguintes: 3, repetidos: null, demanda: null })).toBe('4 compromissos mudados na repetição.');
    expect(avisoDoLapis({ codigo: 'K1', seguintes: null, repetidos: { ids: ['a', 'b'], semSala: ['2026-12-08'] }, demanda: { dias: 7, nascidas: 0 } }))
      .toBe('Compromisso K1 atualizado. Ele agora se repete, com mais 2 datas na agenda. Em 1 data (08/12/2026), a sala estava ocupada, e o compromisso ficou sem sala.'
        + ' A demanda passa a nascer 7 dias antes de cada data em aberto.');
    expect(avisoDoLapis({ codigo: 'K1', seguintes: null, repetidos: null, demanda: { dias: null, nascidas: 0 } }))
      .toBe('Compromisso K1 atualizado. As datas em aberto não geram mais demanda. As que já nasceram continuam.');
  });
});

describe('Os passos do lápis na repetição (#417)', () => {
  it('dado o compromisso que já se repete, quando o lápis grava, então a demanda vem antes das seguintes', () => {
    // Dado / Quando / Então: quem se tira das seguintes ainda muda a demanda das datas em aberto
    expect(passosDoLapis(true)).toEqual(['demanda', 'seguintes']);
  });

  it('dado o compromisso que ainda não se repete, quando o lápis grava, então a repetição nasce antes da demanda', () => {
    // Dado / Quando / Então
    expect(passosDoLapis(false)).toEqual(['repetir', 'demanda']);
  });

  it.each([
    ['seguintes', 'mudar as seguintes'],
    ['repetir', 'repeti-lo'],
    ['demanda', 'mudar a demanda de cada data']
  ] as const)('dado o passo %s que não deu, quando avisa, então diz que esta data ficou gravada e o que faltou', (passo, faltou) => {
    // Dado / Quando / Então
    expect(falhaNoLapis('K1', passo, 'Sem permissão.')).toBe(`O compromisso K1 foi atualizado, mas não foi possível ${faltou}: Sem permissão.`);
  });
});
