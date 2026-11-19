// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  andarComTecla, DIAS_DO_CABECALHO, diaEmFoco, dentroDosLimites, doMes, FORMATOS_DA_DATA, isoDoTexto, limitarDia, mesAoAbrir, mesForaDosLimites,
  nomeDoDia, numeroDoDia, SEMANAS_NO_CALENDARIO, semanasDoMes, somarMeses, textoDaDataDigitada, tituloDoMes
} from './campoData';

describe('Calendário pequeno dos campos de data (#357)', () => {
  describe('Dado um mês', () => {
    it('quando o calendário o mostra, então são seis semanas que começam no domingo, com o dia 1 na coluna do dia da semana dele', () => {
      // Quando (novembro de 2026 começa num domingo; outubro, numa quinta)
      const novembro = semanasDoMes('2026-11-18'), outubro = semanasDoMes('2026-10-05');
      // Então
      expect(novembro).toHaveLength(SEMANAS_NO_CALENDARIO);
      expect(novembro.every(s => s.length === 7)).toBe(true);
      expect(novembro[0][0]).toBe('2026-11-01');
      expect(outubro[0]).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
      expect(outubro[5][6]).toBe('2026-11-07');
    });

    it('quando o cabeçalho é montado, então vai de domingo a sábado, com a inicial e o nome inteiro', () => {
      // Então
      expect(DIAS_DO_CABECALHO.map(d => d.inicial).join('')).toBe('DSTQQSS');
      expect(DIAS_DO_CABECALHO[0].nome).toBe('domingo');
      expect(DIAS_DO_CABECALHO[6].nome).toBe('sábado');
    });

    it('quando se pergunta se um dia é do mês, então os pedaços dos meses vizinhos ficam de fora', () => {
      // Então
      expect(doMes('2026-11-30', '2026-11-01')).toBe(true);
      expect(doMes('2026-12-01', '2026-11-01')).toBe(false);
    });

    it('quando se mostra o título e o nome de um dia, então saem em português, com o dia da semana', () => {
      // Então
      expect(tituloDoMes('2026-11-18')).toBe('novembro de 2026');
      expect(nomeDoDia('2026-11-18')).toBe('quarta-feira, 18 de novembro de 2026');
      expect(nomeDoDia('2026-12-01')).toBe('terça-feira, 1º de dezembro de 2026');
      expect(numeroDoDia('2026-11-05')).toBe('5');
    });
  });

  describe('Dado o teclado no calendário', () => {
    it.each([
      ['ArrowLeft', false, '2026-11-17'],
      ['ArrowRight', false, '2026-11-19'],
      ['ArrowUp', false, '2026-11-11'],
      ['ArrowDown', false, '2026-11-25'],
      ['Home', false, '2026-11-15'],
      ['End', false, '2026-11-21'],
      ['PageUp', false, '2026-10-18'],
      ['PageDown', false, '2026-12-18'],
      ['PageUp', true, '2025-11-18'],
      ['PageDown', true, '2027-11-18']
    ])('quando a tecla é %s (Shift: %s) numa quarta, 18/11/2026, então o foco vai para %s', (tecla, comShift, esperado) => {
      // Quando
      const dia = andarComTecla('2026-11-18', tecla, comShift);
      // Então
      expect(dia).toBe(esperado);
    });

    it('quando a tecla não é do calendário, então não anda', () => {
      // Então
      expect(andarComTecla('2026-11-18', 'a', false)).toBeNull();
    });

    it('quando o mês seguinte não tem o mesmo dia, então vai ao último dia dele', () => {
      // Então
      expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
      expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29');
      expect(somarMeses('2026-03-31', -1)).toBe('2026-02-28');
      expect(somarMeses('2026-12-15', 1)).toBe('2027-01-15');
    });

    it('dado um limite, quando a tecla passaria dele, então o foco para no limite', () => {
      // Então
      expect(andarComTecla('2026-11-02', 'ArrowUp', false, { min: '2026-11-01' })).toBe('2026-11-01');
      expect(andarComTecla('2026-11-28', 'PageDown', false, { max: '2026-11-30' })).toBe('2026-11-30');
    });
  });

  describe('Dados os limites min e max', () => {
    const limites = { min: '2026-11-10', max: '2026-12-20' };
    it.each([
      ['2026-11-09', false], ['2026-11-10', true], ['2026-12-20', true], ['2026-12-21', false]
    ])('quando o dia é %s, então pode ser escolhido: %s', (dia, pode) => {
      // Então
      expect(dentroDosLimites(dia, limites)).toBe(pode);
    });

    it('quando o dia está fora, então o mais perto dentro é o limite', () => {
      // Então
      expect(limitarDia('2026-01-01', limites)).toBe('2026-11-10');
      expect(limitarDia('2027-01-01', limites)).toBe('2026-12-20');
      expect(limitarDia('2026-11-15', {})).toBe('2026-11-15');
    });

    it('quando o mês inteiro fica fora, então a seta para ele se desliga', () => {
      // Então
      expect(mesForaDosLimites('2026-10-01', limites)).toBe(true);
      expect(mesForaDosLimites('2026-11-01', limites)).toBe(false);
      expect(mesForaDosLimites('2027-01-01', limites)).toBe(true);
    });
  });

  describe('Dada a data escrita à mão', () => {
    it.each([
      ['10112030', '10/11/2030'],
      ['10/11/2030', '10/11/2030'],
      ['1011', '10/11'],
      ['2030-11-10', '10/11/2030'],
      [' 2030-11-10 ', '10/11/2030']
    ])('quando a pessoa escreve ou cola "%s", então o campo mostra "%s"', (escrito, mostrado) => {
      // Então
      expect(textoDaDataDigitada(escrito)).toBe(mostrado);
    });

    it.each([
      ['10/11/2030', '2030-11-10'], ['', null], ['10/11', null], ['31/02/2026', null]
    ])('quando o texto é "%s", então a data é %s', (texto, iso) => {
      // Então
      expect(isoDoTexto(texto)).toBe(iso);
    });
  });

  describe('Dados os dois jeitos de guardar', () => {
    it('quando o campo guarda dd/mm/aaaa, então o texto vai como foi escrito, e o dia escolhido vira dd/mm/aaaa', () => {
      // Dado
      const f = FORMATOS_DA_DATA.texto;
      // Então
      expect(f.doTexto('10/1')).toBe('10/1');
      expect(f.doIso('2030-11-10')).toBe('10/11/2030');
      expect(f.paraIso('10/11/2030')).toBe('2030-11-10');
      expect(f.paraTexto('10/11/2030')).toBe('10/11/2030');
    });

    it('quando o campo guarda aaaa-mm-dd, então a data pela metade vai vazia, e a inteira vai no formato do banco', () => {
      // Dado
      const f = FORMATOS_DA_DATA.iso;
      // Então
      expect(f.doTexto('10/1')).toBe('');
      expect(f.doTexto('10/11/2030')).toBe('2030-11-10');
      expect(f.paraTexto('2030-11-10')).toBe('10/11/2030');
      expect(f.paraTexto('')).toBe('');
      expect(f.paraIso('2030-02-31')).toBeNull();
    });
  });

  describe('Dado o calendário que abre', () => {
    it('quando há data escolhida, então abre no mês dela; sem ela, no de hoje, dentro dos limites', () => {
      // Então
      expect(mesAoAbrir('2030-03-15', '2026-11-18')).toBe('2030-03-01');
      expect(mesAoAbrir(null, '2026-11-18')).toBe('2026-11-01');
      expect(mesAoAbrir(null, '2026-11-18', { min: '2027-02-10' })).toBe('2027-02-01');
    });

    it('quando entra no calendário, então o foco vai ao dia escolhido, senão a hoje, senão ao dia 1 do mês', () => {
      // Então
      expect(diaEmFoco('2026-11-01', '2026-11-20', '2026-11-18')).toBe('2026-11-20');
      expect(diaEmFoco('2026-11-01', null, '2026-11-18')).toBe('2026-11-18');
      expect(diaEmFoco('2026-12-01', '2026-11-20', '2026-11-18')).toBe('2026-12-01');
      expect(diaEmFoco('2026-12-01', null, '2026-11-18', { min: '2026-12-05' })).toBe('2026-12-05');
    });
  });
});
