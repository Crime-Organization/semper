// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { OcupacaoDaSala, Sala } from '../dados/tipos';
import { TAMANHO_SALA } from '../dados/limites';
import {
  avisoDoConflito, conflitoNaSala, dadosDaSala, errosDaSala, formDaSala, horarioNaSala, MINUTOS_NO_DIA, minutosNaSala, nomeDaSala, SALA_NOVA, salaDoCompromisso,
  salasParaEscolher
} from './sala';

const ocupacao = (hora: string | null, hora_fim: string | null = null, campos: Partial<OcupacaoDaSala> = {}): OcupacaoDaSala =>
  ({ id: 'c1', codigo: 'K1A2', tipo: 'reuniao', hora, hora_fim, titulo: 'Reunião com o cliente', ...campos });
const sala = (id: string, nome: string, campos: Partial<Sala> = {}): Sala => ({ id, nome, capacidade: 6, ativa: true, criado_em: '2026-11-22T10:00:00Z', ...campos });

describe('O conflito de horário na sala', () => {
  it('dada a sala ocupada das 14h às 15h, quando alguém marca às 14h30, então há conflito com esse compromisso', () => {
    // Dado
    const ocupada = [ocupacao('14:00:00', '15:00:00')];
    // Quando
    const conflito = conflitoNaSala({ hora: '14:30', horaFim: '' }, ocupada);
    // Então
    expect(conflito?.codigo).toBe('K1A2');
  });

  it.each([
    ['começa quando o outro termina', '15:00', '16:00'],
    ['termina quando o outro começa', '13:00', '14:00'],
    ['é antes, sem hora de fim (ocupa 1 hora)', '12:30', '']
  ])('dada a sala ocupada das 14h às 15h, quando o compromisso %s, então não há conflito', (_caso, hora, horaFim) => {
    // Dado / Quando / Então
    expect(conflitoNaSala({ hora, horaFim }, [ocupacao('14:00:00', '15:00:00')])).toBeNull();
  });

  it('dado um compromisso sem hora de fim às 15h, quando alguém marca às 15h30, então há conflito (ele ocupa a sala por 1 hora)', () => {
    // Dado / Quando / Então
    expect(conflitoNaSala({ hora: '15:30', horaFim: null }, [ocupacao('15:00:00')])).not.toBeNull();
    expect(conflitoNaSala({ hora: '16:00', horaFim: null }, [ocupacao('15:00:00')])).toBeNull();
  });

  it('dado um compromisso do dia inteiro, quando alguém marca em qualquer hora, então há conflito; e o do dia inteiro conflita com todos', () => {
    // Dado / Quando / Então
    expect(conflitoNaSala({ hora: '08:00', horaFim: '09:00' }, [ocupacao(null)])).not.toBeNull();
    expect(conflitoNaSala({ hora: null, horaFim: null }, [ocupacao('20:00:00', '21:00:00')])).not.toBeNull();
    expect(conflitoNaSala({ hora: '10:00', horaFim: '11:00' }, [])).toBeNull();
  });

  it('dado um compromisso às 23h30 sem fim, quando se contam os minutos, então ele vai só até o fim do dia', () => {
    // Dado / Quando / Então
    expect(minutosNaSala('23:30', null)).toEqual([23 * 60 + 30, MINUTOS_NO_DIA]);
    expect(minutosNaSala(null, null)).toEqual([0, MINUTOS_NO_DIA]);
    expect(minutosNaSala('09:15:00', '10:45:00')).toEqual([555, 645]);
  });

  it('dado o conflito, quando o aviso aparece, então diz com qual compromisso e em que horário, e o título só de quem a pessoa vê', () => {
    // Dado / Quando / Então
    expect(avisoDoConflito('Sala 1', ocupacao('14:00:00', '15:00:00')))
      .toBe('A sala Sala 1 já está ocupada das 14:00 às 15:00 por "Reunião com o cliente" (K1A2). Escolha outro horário ou outra sala.');
    expect(avisoDoConflito('Sala 1', ocupacao('14:00:00', null, { titulo: null })))
      .toBe('A sala Sala 1 já está ocupada das 14:00 às 15:00 pelo compromisso K1A2. Escolha outro horário ou outra sala.');
    expect(horarioNaSala(ocupacao(null))).toBe('o dia inteiro');
  });
});

describe('As salas no cadastro e no cartão do compromisso', () => {
  it('dada uma sala desativada, quando o cadastro oferece as salas, então ela só aparece para o compromisso que já está nela', () => {
    // Dado
    const salas = [sala('s1', 'Sala 1'), sala('s2', 'Sala 2', { ativa: false })];
    // Quando / Então
    expect(salasParaEscolher(salas, null).map(s => s.id)).toEqual(['s1']);
    expect(salasParaEscolher(salas, 's2').map(s => s.id)).toEqual(['s1', 's2']);
  });

  it('dada a sala de um compromisso antigo, desativada, quando o cartão a mostra, então aparece o nome, com a capacidade e o aviso', () => {
    // Dado
    const salas = [sala('s2', 'Sala 2', { ativa: false, capacidade: 1 })];
    // Quando
    const s = salaDoCompromisso(salas, { sala_id: 's2' });
    // Então
    expect(s && nomeDaSala(s)).toBe('Sala 2 (1 pessoa) · desativada');
    expect(nomeDaSala(sala('s1', 'Sala 1'))).toBe('Sala 1 (6 pessoas)');
    expect(salaDoCompromisso(salas, { sala_id: null })).toBeNull();
  });
});

describe('O cadastro da sala nas Configurações', () => {
  const salas = [sala('s1', 'Sala de Reuniões'), sala('s2', 'Auditório', { ativa: false })];

  it('dado o formulário em branco, quando tenta salvar, então pede o nome e a capacidade', () => {
    // Dado / Quando / Então
    expect(errosDaSala(SALA_NOVA, salas)).toEqual({ nome: 'Dê um nome à sala.', capacidade: 'Informe quantas pessoas cabem.' });
  });

  it.each([['0'], ['2,5'], ['abc'], [String(TAMANHO_SALA.capacidadeMaxima + 1)]])('dada a capacidade "%s", quando tenta salvar, então pede um número válido', capacidade => {
    // Dado / Quando / Então
    expect(errosDaSala({ nome: 'Sala 3', capacidade }, salas).capacidade).toBe(`A capacidade é um número de 1 a ${TAMANHO_SALA.capacidadeMaxima}.`);
  });

  it('dado o nome de uma sala que já existe (mesmo desativada, com outras maiúsculas ou sem acento), quando tenta salvar, então avisa', () => {
    // Dado / Quando / Então
    expect(errosDaSala({ nome: 'sala de reunioes', capacidade: '4' }, salas).nome).toBe('Já existe uma sala com esse nome.');
    expect(errosDaSala({ nome: 'AUDITÓRIO', capacidade: '4' }, salas).nome).toBe('Já existe uma sala com esse nome.');
    // Ao mudar a própria sala, o nome dela não conta
    expect(errosDaSala({ nome: 'Sala de Reuniões', capacidade: '8' }, salas, 's1')).toEqual({});
  });

  it('dado o formulário preenchido, quando salva, então vai o nome sem espaços nas pontas e a capacidade em número', () => {
    // Dado / Quando / Então
    expect(dadosDaSala({ nome: '  Sala 3 ', capacidade: ' 12 ' })).toEqual({ nome: 'Sala 3', capacidade: 12 });
    expect(formDaSala(sala('s1', 'Sala 1'))).toEqual({ nome: 'Sala 1', capacidade: '6' });
    expect(errosDaSala({ nome: 'x'.repeat(TAMANHO_SALA.nome + 1), capacidade: '2' }, salas).nome).toBe(`O nome pode ter até ${TAMANHO_SALA.nome} caracteres.`);
  });
});
