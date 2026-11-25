// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { OcupacaoDaSala, OcupacaoNaSala, Sala } from '../dados/tipos';
import {
  enderecoParaMarcar, faixasDaSala, fimAntesDoProximo, GRADE_DAS_SALAS, horarioDaFaixa, horarioDoEndereco, horariosDaGrade, marcarNoHorario, OCUPADO,
  notaDosFiltrosNasSalas, ocupacoesPorSala, rotuloDaOcupacao, SALA_DO_FILTRO_DESATIVADA, salaDoEndereco, salasDaVisao, SEM_SALAS_ATIVAS, semSalasNaVisao
} from './salasDoDia';
import { CADASTRO_DE_COMPROMISSO } from './compromisso';
import { MINUTOS_NA_HORA } from './sala';

const ocupacao = (id: string, hora: string | null, hora_fim: string | null = null, campos: Partial<OcupacaoDaSala> = {}): OcupacaoDaSala =>
  ({ id, codigo: 'K' + id, tipo: 'reuniao', hora, hora_fim, titulo: 'Reunião ' + id, ...campos });
const sala = (id: string, nome: string, campos: Partial<Sala> = {}): Sala => ({ id, nome, capacidade: 6, ativa: true, criado_em: '2026-11-22T10:00:00Z', ...campos });
const em = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * MINUTOS_NA_HORA + m; };

describe('A grade da visão das salas', () => {
  it('dado um dia sem compromissos, quando se monta a grade, então vai das 7h às 21h, de meia em meia hora', () => {
    // Dado / Quando
    const horarios = horariosDaGrade([]);
    // Então
    expect(horarios[0]).toBe(GRADE_DAS_SALAS.inicio);
    expect(horarios.at(-1)).toBe(GRADE_DAS_SALAS.fim - GRADE_DAS_SALAS.passo);
    expect(horarios).toHaveLength((GRADE_DAS_SALAS.fim - GRADE_DAS_SALAS.inicio) / GRADE_DAS_SALAS.passo);
  });

  it('dado um compromisso das 6h10 às 7h e outro das 20h30 às 22h15, quando se monta a grade, então ela estica para caber os dois', () => {
    // Dado / Quando
    const horarios = horariosDaGrade([ocupacao('a', '06:10:00', '07:00:00'), ocupacao('b', '20:30:00', '22:15:00')]);
    // Então
    expect(horarios[0]).toBe(em('06:00'));
    expect(horarios.at(-1)).toBe(em('22:00'));
  });

  it('dado um compromisso do dia inteiro, quando se monta a grade, então ela não estica', () => {
    // Dado / Quando / Então
    expect(horariosDaGrade([ocupacao('a', null)])).toEqual(horariosDaGrade([]));
  });
});

describe('A coluna de cada sala', () => {
  const horarios = horariosDaGrade([]);

  it('dada a sala livre, quando se monta a coluna, então cada horário é um pedaço livre só dele', () => {
    // Dado / Quando
    const faixas = faixasDaSala([], horarios);
    // Então
    expect(faixas).toHaveLength(horarios.length);
    expect(faixas.every(f => f.linhas === 1 && !f.ocupacoes.length)).toBe(true);
  });

  it('dada a sala ocupada das 9h às 10h30, quando se monta a coluna, então os três horários viram um pedaço só, ocupado', () => {
    // Dado
    const reuniao = ocupacao('a', '09:00:00', '10:30:00');
    // Quando
    const faixas = faixasDaSala([reuniao], horarios);
    // Então
    const ocupada = faixas.find(f => f.ocupacoes.length)!;
    expect(ocupada).toMatchObject({ linha: horarios.indexOf(em('09:00')), linhas: 3, inicio: em('09:00'), fim: em('10:30'), ocupacoes: [reuniao] });
    expect(faixas.find(f => f.inicio === em('10:30'))?.ocupacoes).toEqual([]);
    expect(faixas.reduce((n, f) => n + f.linhas, 0)).toBe(horarios.length);
  });

  it('dado um compromisso às 14h, sem hora de fim, quando se monta a coluna, então ele ocupa 1 hora', () => {
    // Dado / Quando
    const ocupada = faixasDaSala([ocupacao('a', '14:00:00')], horarios).find(f => f.ocupacoes.length);
    // Então
    expect(ocupada).toMatchObject({ inicio: em('14:00'), fim: em('15:00'), linhas: 2 });
  });

  it('dados dois compromissos que dividem a meia hora (14h às 14h20 e 14h20 às 15h), quando se monta a coluna, então ficam no mesmo pedaço', () => {
    // Dado
    const um = ocupacao('a', '14:00:00', '14:20:00'), outro = ocupacao('b', '14:20:00', '15:00:00');
    // Quando
    const ocupadas = faixasDaSala([um, outro], horarios).filter(f => f.ocupacoes.length);
    // Então
    expect(ocupadas).toHaveLength(1);
    expect(ocupadas[0]).toMatchObject({ inicio: em('14:00'), fim: em('15:00'), ocupacoes: [um, outro] });
  });

  it('dados dois compromissos seguidos (9h às 10h e 10h às 11h), quando se monta a coluna, então cada um é um pedaço', () => {
    // Dado / Quando
    const ocupadas = faixasDaSala([ocupacao('a', '09:00:00', '10:00:00'), ocupacao('b', '10:00:00', '11:00:00')], horarios).filter(f => f.ocupacoes.length);
    // Então
    expect(ocupadas.map(f => [f.inicio, f.fim])).toEqual([[em('09:00'), em('10:00')], [em('10:00'), em('11:00')]]);
  });

  it('dado um compromisso do dia inteiro, quando se monta a coluna, então ela é um pedaço só, ocupado', () => {
    // Dado / Quando
    const faixas = faixasDaSala([ocupacao('a', null)], horarios);
    // Então
    expect(faixas).toHaveLength(1);
    expect(faixas[0].linhas).toBe(horarios.length);
  });
});

describe('As salas e as ocupações da visão', () => {
  it('dada a ocupação de todas as salas, quando se separa por sala, então cada sala fica com as dela, sem repetir a sala', () => {
    // Dado
    const lista: OcupacaoNaSala[] = [{ ...ocupacao('a', '09:00:00'), sala_id: 's1' }, { ...ocupacao('b', '10:00:00'), sala_id: 's2' }, { ...ocupacao('c', '11:00:00'), sala_id: 's1' }];
    // Quando
    const porSala = ocupacoesPorSala(lista);
    // Então
    expect(porSala.s1.map(o => o.id)).toEqual(['a', 'c']);
    expect(porSala.s2).toEqual([ocupacao('b', '10:00:00')]);
  });

  it('dadas salas ativas e desativadas, quando se monta a visão, então vêm só as ativas, por nome; com o filtro de uma sala, só ela', () => {
    // Dado
    const salas = [sala('s2', 'Sala Verde'), sala('s1', 'Sala Azul'), sala('s3', 'Sala Antiga', { ativa: false })];
    // Quando / Então
    expect(salasDaVisao(salas).map(s => s.id)).toEqual(['s1', 's2']);
    expect(salasDaVisao(salas, 's2').map(s => s.id)).toEqual(['s2']);
    expect(salasDaVisao(salas, 's3')).toEqual([]);
  });

  it('dado o compromisso de que a pessoa não participa (sem título), quando a visão o mostra, então diz só que está ocupado', () => {
    // Dado / Quando / Então
    expect(rotuloDaOcupacao({ titulo: null })).toBe(OCUPADO);
    expect(rotuloDaOcupacao({ titulo: 'Reunião com o perito' })).toBe('Reunião com o perito');
    expect(horarioDaFaixa({ hora: '14:00:00', hora_fim: null })).toBe('14:00 às 15:00');
    expect(horarioDaFaixa({ hora: null, hora_fim: null })).toBe('O dia inteiro');
  });
});

describe('Os filtros da agenda na visão das salas', () => {
  it('dada a visão sem salas, quando não há filtro de sala, então diz que faltam salas ativas; com o filtro, que foi ele', () => {
    // Dado / Quando / Então
    expect(semSalasNaVisao()).toBe(SEM_SALAS_ATIVAS);
    expect(semSalasNaVisao('')).toBe(SEM_SALAS_ATIVAS);
    expect(semSalasNaVisao('s9')).toBe(SALA_DO_FILTRO_DESATIVADA);
  });

  it('dados busca, pessoa, tipo ou etiqueta escolhidos, quando a visão das salas abre, então a nota diz quais não valem ali', () => {
    // Dado / Quando / Então
    expect(notaDosFiltrosNasSalas({})).toBeNull();
    expect(notaDosFiltrosNasSalas({ termo: '  ' })).toBeNull();
    expect(notaDosFiltrosNasSalas({ tipo: 'reuniao' })).toBe('A visão das salas mostra toda a ocupação do dia: o filtro de tipo não vale aqui.');
    expect(notaDosFiltrosNasSalas({ termo: 'perito', pessoa: 'u1', etiqueta: 'e1' }))
      .toBe('A visão das salas mostra toda a ocupação do dia: a busca, o filtro de pessoa e o filtro de etiqueta não valem aqui.');
  });
});

describe('Marcar num horário livre', () => {
  it('dado um horário livre às 14h, sem nada logo depois, quando se monta o endereço, então ele leva a sala, a data e a hora, sem o fim', () => {
    // Dado / Quando
    const endereco = enderecoParaMarcar('s1', '2026-11-04', em('14:00'), [ocupacao('a', '09:00:00')]);
    // Então
    expect(endereco).toBe('/agenda/novo/?sala=s1&data=2026-11-04&hora=14%3A00');
    expect(marcarNoHorario('Sala Verde', em('14:00'))).toBe('Marcar em Sala Verde às 14:00');
  });

  it('dado o endereço do cadastro de compromisso num lugar só, quando a visão monta o do horário livre, então é esse mesmo cadastro', () => {
    // Dado / Quando
    const endereco = enderecoParaMarcar('s1', '2026-11-04', em('08:00'), []);
    // Então
    expect(CADASTRO_DE_COMPROMISSO).toBe('/agenda/novo/');
    expect(endereco.startsWith(CADASTRO_DE_COMPROMISSO + '?')).toBe(true);
    expect(GRADE_DAS_SALAS.inicio).toBe(7 * MINUTOS_NA_HORA);
  });

  it('dado um horário livre às 13h30 e a sala ocupada às 14h, quando se monta o endereço, então o compromisso termina às 14h', () => {
    // Dado
    const ocupada = [ocupacao('a', '14:00:00', '15:00:00')];
    // Quando / Então
    expect(fimAntesDoProximo(em('13:30'), ocupada)).toBe(em('14:00'));
    expect(fimAntesDoProximo(em('12:30'), ocupada)).toBeNull();
    expect(enderecoParaMarcar('s1', '2026-11-04', em('13:30'), ocupada)).toBe('/agenda/novo/?sala=s1&data=2026-11-04&hora=13%3A30&ate=14%3A00');
  });

  it('dado o endereço do horário livre, quando o cadastro o lê, então começa com a data, a hora e o fim; o que vier fora do formato fica vazio', () => {
    // Dado / Quando / Então
    expect(horarioDoEndereco(new URLSearchParams('sala=s1&data=2026-11-04&hora=13:30&ate=14:00'))).toEqual({ data: '04/11/2026', hora: '13:30', horaFim: '14:00' });
    expect(horarioDoEndereco(new URLSearchParams('data=04-11-2026&hora=25:00&ate=14:00'))).toEqual({});
    expect(horarioDoEndereco(new URLSearchParams('hora=14:00&ate=13:00'))).toEqual({ hora: '14:00' });
    expect(horarioDoEndereco(new URLSearchParams(''))).toEqual({});
  });

  it('dado o endereço com uma sala, quando o cadastro o lê, então a sala vem só se é ativa do escritório', () => {
    // Dado
    const salas = [sala('s1', 'Sala Verde'), sala('s2', 'Sala Antiga', { ativa: false })];
    // Quando / Então
    expect(salaDoEndereco(new URLSearchParams('sala=s1'), salas)).toBe('s1');
    expect(salaDoEndereco(new URLSearchParams('sala=s2'), salas)).toBe('');
    expect(salaDoEndereco(new URLSearchParams('sala=outra'), salas)).toBe('');
    expect(salaDoEndereco(new URLSearchParams(''), salas)).toBe('');
  });
});
