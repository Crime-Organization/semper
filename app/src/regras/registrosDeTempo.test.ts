// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { conferirCorrecao, diaDoRegistro, duracaoDoRegistro, duracaoParaEscrever, emAndamento, inicioNoDia, lerDuracaoDoRegistro, NO_HISTORICO,
  NOME_DO_TIPO, possoMexer, registroNoHistorico, registrosEmOrdem, tipoDoRegistro } from './registrosDeTempo';

const registro = (id: number, inicio: string, extra: Partial<{ perfil_id: string | null; segundos: number; ajuste: boolean }> = {}) =>
  ({ id, perfil_id: 'u-ana', inicio, segundos: 3600, ajuste: false, ...extra });
const HOJE = '2026-11-21';

describe('Registros de tempo da tarefa', () => {
  it('dados registros de dias diferentes, quando a lista é montada, então vem do mais novo ao mais antigo', () => {
    // Dado
    const lista = [registro(1, '2026-11-18T13:00:00.000Z'), registro(2, '2026-11-20T13:00:00.000Z'), registro(3, '2026-11-19T13:00:00.000Z')];
    // Quando / Então
    expect(registrosEmOrdem(lista).map(r => r.id)).toEqual([2, 3, 1]);
  });

  it('dado o registro de outra pessoa, quando quem não é administrador olha, então não mexe; o administrador mexe', () => {
    // Dado
    const doBruno = registro(1, '2026-11-18T13:00:00.000Z', { perfil_id: 'u-bruno' });
    // Quando / Então
    expect(possoMexer(doBruno, 'u-ana', false)).toBe(false);
    expect(possoMexer(doBruno, 'u-ana', true)).toBe(true);
    expect(possoMexer(doBruno, 'u-bruno', false)).toBe(true);
  });

  it('dado o período que o cronômetro está contando, quando a pessoa quer mexer nele, então só depois de pausar', () => {
    // Dado
    const r = registro(7, '2026-11-21T13:00:00.000Z');
    // Quando / Então
    expect(emAndamento(r, 7, true)).toBe(true);
    expect(emAndamento(r, 7, false)).toBe(false);
    expect(emAndamento(r, 8, true)).toBe(false);
  });

  it('quando a lista mostra a duração, então o período contado vem por extenso e o ajuste com o sinal', () => {
    // Quando / Então
    expect(duracaoDoRegistro({ segundos: 4800, ajuste: false })).toBe('1 h 20 min');
    expect(duracaoDoRegistro({ segundos: 1800, ajuste: true })).toBe('+30 min');
    expect(duracaoDoRegistro({ segundos: -600, ajuste: true })).toBe('−10 min');
    expect(NOME_DO_TIPO[tipoDoRegistro({ ajuste: true })]).toBe('Ajuste');
    expect(NOME_DO_TIPO[tipoDoRegistro({ ajuste: false })]).toBe('Cronômetro');
  });

  it('quando o campo da duração abre para mudar, então traz a duração como a pessoa escreve, que se lê de volta igual', () => {
    // Quando / Então
    expect(duracaoParaEscrever(4800)).toBe('1h20');
    expect(duracaoParaEscrever(3600)).toBe('1h');
    expect(duracaoParaEscrever(2700)).toBe('45min');
    expect(duracaoParaEscrever(-1200)).toBe('-20min');
    expect(lerDuracaoDoRegistro(duracaoParaEscrever(4800), false)).toBe(4800);
    expect(lerDuracaoDoRegistro(duracaoParaEscrever(-1200), true)).toBe(-1200);
  });

  it('dado um período contado, quando a duração nova é negativa ou passa de 12 horas, então não vale', () => {
    // Quando / Então
    expect(() => lerDuracaoDoRegistro('-20min', false)).toThrow(/não fica negativo/);
    expect(() => lerDuracaoDoRegistro('13h', false)).toThrow(/até 12 horas/);
    expect(lerDuracaoDoRegistro('13h', true)).toBe(13 * 3600);
  });

  it('quando o registro muda de dia, então fica na mesma hora do dia novo', () => {
    // Dado
    const inicio = new Date(2026, 10, 18, 14, 30).toISOString();
    // Quando
    const novo = inicioNoDia(inicio, '2026-11-15');
    // Então
    expect(diaDoRegistro(novo)).toBe('2026-11-15');
    expect(new Date(novo).getHours()).toBe(14);
    expect(new Date(novo).getMinutes()).toBe(30);
  });

  it('dada uma correção completa, quando é conferida, então sai pronta para gravar; sem mudar o dia, o instante fica o mesmo', () => {
    // Dado
    const r = registro(1, new Date(2026, 10, 18, 14, 0).toISOString());
    // Quando
    const mesmoDia = conferirCorrecao(r, { duracao: '45min', dia: '18/11/2026', motivo: ' Contei o almoço ' }, HOJE);
    const outroDia = conferirCorrecao(r, { duracao: '45min', dia: '17/11/2026', motivo: 'Era de ontem' }, HOJE);
    // Então
    expect(mesmoDia).toEqual({ erros: {}, correcao: { segundos: 2700, inicio: r.inicio, motivo: 'Contei o almoço' } });
    expect(diaDoRegistro(outroDia.correcao!.inicio)).toBe('2026-11-17');
  });

  it('dada uma correção sem motivo, com o dia no futuro e a duração errada, quando é conferida, então diz o erro de cada campo', () => {
    // Dado
    const r = registro(1, new Date(2026, 10, 18, 14, 0).toISOString());
    // Quando
    const { erros, correcao } = conferirCorrecao(r, { duracao: 'muito', dia: '30/11/2026', motivo: '  ' }, HOJE);
    // Então
    expect(correcao).toBeUndefined();
    expect(erros.duracao).toMatch(/Escreva o tempo/);
    expect(erros.dia).toBe('O dia do registro não pode ser depois de hoje.');
    expect(erros.motivo).toMatch(/Diga o motivo/);
    expect(conferirCorrecao(r, { duracao: '1h', dia: '31/02/2026', motivo: 'x' }, HOJE).erros.dia).toBe('Data inexistente.');
    expect(conferirCorrecao(r, { duracao: '1h', dia: '', motivo: 'x' }, HOJE).erros.dia).toBe('Diga o dia do registro.');
  });

  it('quando o histórico descreve o registro, então diz de quem e de que dia (no horário de Brasília), sem a duração', () => {
    // Dado
    const registroDaAna = registroNoHistorico('Ana', false, '2026-11-18T17:00:00.000Z');
    // Quando / Então
    expect(NO_HISTORICO.apagado(registroDaAna)).toBe('Apagado o tempo contado de Ana, de 18/11/2026');
    expect(NO_HISTORICO.corrigido(registroNoHistorico(null, true, '2026-11-19T02:00:00.000Z'), '17/11/2026', ' Revisão '))
      .toBe('Corrigido o ajuste de tempo de usuário removido, de 18/11/2026, que passou para 17/11/2026. Motivo: Revisão');
    expect(NO_HISTORICO.devolvido(registroDaAna)).toBe('Devolvido o tempo contado de Ana, de 18/11/2026');
  });
});
