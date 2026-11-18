// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  compararPeloInicio, dataDaCriacao, erroDaDataDeInicio, INICIO_VAZIO, inicioDoCriadoEm, inicioNosLimites, limitesDoPeriodo, PERIODOS, PERIODOS_DO_INICIO,
  type SentidoDoInicio
} from './dataDeInicio';

describe('Data de início de tarefas e demandas (#357)', () => {
  describe('Dada a data escrita', () => {
    it.each([
      ['25/11/2026', ''],
      ['', INICIO_VAZIO],
      ['   ', INICIO_VAZIO],
      ['2026-11-25', 'Use o formato DD/MM/AAAA.'],
      ['31/02/2026', 'Data inexistente.']
    ])('quando é "%s", então o erro é "%s"', (texto, erro) => {
      // Então
      expect(erroDaDataDeInicio(texto)).toBe(erro);
    });
  });

  describe('Dado o momento da criação', () => {
    it.each([
      ['2026-11-18T12:00:00.000Z', '2026-11-18'],
      // 23h30 de Brasília ainda é o mesmo dia, mesmo que em UTC já seja o seguinte
      ['2026-11-19T02:30:00.000Z', '2026-11-18'],
      ['2026-11-19T03:00:00.000Z', '2026-11-19']
    ])('quando o cartão foi criado em %s, então o início é %s (dia de Brasília)', (criado, inicio) => {
      // Então
      expect(inicioDoCriadoEm(criado)).toBe(inicio);
    });

    it('quando o cartão foi criado às 0h30 de Brasília e quem vê está em Manaus (ainda 23h30 do dia anterior), então a criação mostra o mesmo dia do início', () => {
      // Dado
      const fusoAntes = process.env.TZ;
      process.env.TZ = 'America/Manaus';
      try {
        // Quando
        const criado = '2026-11-18T03:30:00.000Z';
        // Então
        expect(dataDaCriacao(criado)).toBe('18/11/2026');
        expect(dataDaCriacao(criado)).toBe(inicioDoCriadoEm(criado).split('-').reverse().join('/'));
      } finally {
        process.env.TZ = fusoAntes;
      }
    });
  });

  describe('Dado o filtro "Início"', () => {
    const hoje = '2026-11-18';
    it.each([
      ['', {}],
      ['hoje', { inicioDesde: '2026-11-18', inicioAte: '2026-11-18' }],
      ['comecou', { inicioAte: '2026-11-18' }],
      ['futuro', { inicioDesde: '2026-11-19' }],
      ['semana', { inicioDesde: '2026-11-12', inicioAte: '2026-11-18' }],
      ['mes', { inicioDesde: '2026-10-20', inicioAte: '2026-11-18' }]
    ] as const)('quando o período é "%s", então os limites são %j', (periodo, limites) => {
      // Então
      expect(limitesDoPeriodo(periodo, hoje)).toEqual(limites);
    });

    it('quando os limites são aplicados, então só passa o início dentro deles', () => {
      // Dado
      const limites = limitesDoPeriodo('semana', hoje);
      // Então
      expect(inicioNosLimites('2026-11-12', limites)).toBe(true);
      expect(inicioNosLimites('2026-11-11', limites)).toBe(false);
      expect(inicioNosLimites('2026-11-19', limites)).toBe(false);
      expect(inicioNosLimites('1999-01-01', {})).toBe(true);
    });

    it('quando o filtro é montado, então cada período tem um nome, e o primeiro é qualquer data', () => {
      // Então
      expect(PERIODOS[0]).toBe('');
      expect(PERIODOS.every(p => PERIODOS_DO_INICIO[p].rotulo)).toBe(true);
    });
  });

  describe('Dada a ordem pelo início', () => {
    const item = (id: string, data_inicio: string, criado_em: string) => ({ id, data_inicio, criado_em });
    const ITENS = [item('dia-20', '2026-11-20', '2026-11-01T10:00:00Z'), item('dia-10', '2026-11-10', '2026-11-10T10:00:00Z'),
      item('dia-20-antes', '2026-11-20', '2026-10-01T10:00:00Z')];
    const ordenar = (sentido: SentidoDoInicio) => ITENS.toSorted((a, b) => compararPeloInicio(a, b, sentido)).map(x => x.id);

    it('quando ordena pelo que começou antes, então vai do início mais antigo ao mais recente; no mesmo dia, o criado antes vem antes', () => {
      // Então
      expect(ordenar(1)).toEqual(['dia-10', 'dia-20-antes', 'dia-20']);
    });

    it('quando ordena pelo que começa depois, então a ordem se inverte', () => {
      // Então
      expect(ordenar(-1)).toEqual(['dia-20', 'dia-20-antes', 'dia-10']);
    });
  });
});
