// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Roda no fuso de Brasília (TZ=America/Sao_Paulo).
import { describe, expect, it } from 'vitest';
import { inicioDoDia, intervaloDoPeriodo, periodoPorExtenso, totalDoPeriodo } from './meuTempo';

describe('Períodos de "Meu tempo trabalhado"', () => {
  it.each([
    ['numa quarta-feira', '2026-10-28', { de: '2026-10-26', ate: '2026-11-02' }],
    ['numa segunda-feira', '2026-10-26', { de: '2026-10-26', ate: '2026-11-02' }],
    ['num domingo', '2026-11-01', { de: '2026-10-26', ate: '2026-11-02' }]
  ])('quando é "esta semana" %s, então vai da segunda ao domingo', (_caso, hoje, esperado) => {
    // Quando
    const intervalo = intervaloDoPeriodo('semana', hoje);
    // Então
    expect(intervalo).toEqual(esperado);
  });

  it('quando é "este mês", então vai do dia 1 ao último dia do mês', () => {
    // Quando / Então
    expect(intervaloDoPeriodo('mes', '2026-10-31')).toEqual({ de: '2026-10-01', ate: '2026-11-01' });
    expect(intervaloDoPeriodo('mes', '2026-12-15')).toEqual({ de: '2026-12-01', ate: '2027-01-01' });
  });

  it('quando é "mês passado" em janeiro, então é dezembro do ano anterior', () => {
    // Quando
    const intervalo = intervaloDoPeriodo('mes_passado', '2027-01-10');
    // Então
    expect(intervalo).toEqual({ de: '2026-12-01', ate: '2027-01-01' });
  });

  it('quando a pessoa escolhe as datas, então o último dia entra', () => {
    // Quando
    const intervalo = intervaloDoPeriodo('intervalo', '2026-10-31', { de: '2026-10-05', ate: '2026-10-09' });
    // Então
    expect(intervalo).toEqual({ de: '2026-10-05', ate: '2026-10-10' });
  });

  it.each([
    ['falta o último dia', { de: '2026-10-05', ate: '' }, 'Escolha o primeiro e o último dia.'],
    ['a data não existe', { de: '2026-02-30', ate: '2026-03-02' }, 'Confira as datas.'],
    ['as datas estão trocadas', { de: '2026-10-09', ate: '2026-10-05' }, 'O primeiro dia vem antes do último.']
  ])('quando no intervalo %s, então vem a mensagem de erro', (_caso, escolhido, mensagem) => {
    // Quando
    const resultado = intervaloDoPeriodo('intervalo', '2026-10-31', escolhido);
    // Então
    expect(resultado).toBe(mensagem);
  });

  it('quando o período aparece por extenso, então mostra o último dia que entra', () => {
    // Quando / Então
    expect(periodoPorExtenso({ de: '2026-10-26', ate: '2026-11-02' })).toBe('de 26/10/2026 a 01/11/2026');
    expect(periodoPorExtenso({ de: '2026-10-05', ate: '2026-10-06' })).toBe('em 05/10/2026');
  });

  it('quando o total é somado, então é a soma do tempo das tarefas', () => {
    // Quando / Então
    expect(totalDoPeriodo([{ segundos: 3600 }, { segundos: 1800 }])).toBe(5400);
    expect(totalDoPeriodo([])).toBe(0);
  });

  it('quando o dia vira instante, então é a meia-noite de Brasília', () => {
    // Quando / Então
    expect(inicioDoDia('2026-10-26')).toBe('2026-10-26T03:00:00.000Z');
  });
});
