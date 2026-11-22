// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { GraficosDeTarefas, TarefaNosGraficos } from '../dados/tipos';
import {
  desdeDoPainel, detalheDaAgenda, periodoDoRitmo, prazosDoDia, ritmoPorDia, ritmoVazio, situacaoDaColuna, tarefasEmAberto, tarefasPorSituacao
} from './graficosDoInicio';

const HOJE = '2026-11-22';
/** Meio-dia em Brasília (15h em UTC) do dia pedido. */
const meioDia = (dia: string) => `${dia}T15:00:00.000Z`;
const COLUNAS = [
  { id: 'c1', nome: 'Para fazer', marco: 'inicio' as const }, { id: 'c2', nome: 'Fazendo', marco: null },
  { id: 'c3', nome: 'Aguardando: análise do solicitante', marco: null }, { id: 'c4', nome: 'Aguardando: retorno do cliente', marco: null },
  { id: 'c5', nome: 'Revisão', marco: null }, { id: 'c9', nome: 'Concluída', marco: 'concluido' as const }
];
const tarefa = (id: string, extra: Partial<TarefaNosGraficos> = {}): TarefaNosGraficos => ({ id, etapa_id: 'c1', concluida_em: null, arquivado_em: null, ...extra });
const graficos = (extra: Partial<GraficosDeTarefas> = {}): GraficosDeTarefas => ({ tarefas: [], tempos: [], ...extra });

describe('Período do painel do Início', () => {
  it('dado hoje, então o painel lê desde 29 dias atrás (os 30 dias do ritmo mais longo, contando hoje)', () => {
    // Então
    expect(desdeDoPainel(HOJE)).toBe('2026-10-24');
  });

  it.each([['semana', 'semana'], ['mes', 'mes'], ['ano', 'semana'], [null, 'semana']])('dada a escolha guardada %j, então o ritmo mostra o período %s', (escolha, periodo) => {
    // Então
    expect(periodoDoRitmo(escolha)).toBe(periodo);
  });
});

describe('Tarefas por situação', () => {
  it.each([
    [undefined, 'a_fazer'], ['c1', 'a_fazer'], ['c2', 'fazendo'], ['c3', 'aguardando'], ['c4', 'aguardando'], ['c5', 'fazendo'], ['c9', 'concluidas']
  ])('dada a coluna %s, então a situação é %s', (id, situacao) => {
    // Então
    expect(situacaoDaColuna(COLUNAS.find(c => c.id === id))).toBe(situacao);
  });

  it('dadas tarefas em cada coluna, arquivadas e concluídas em dias diferentes, quando conta, então as em aberto vão pela coluna e as concluídas pelos últimos 7 dias', () => {
    // Dado
    const tarefas = [
      tarefa('a'), tarefa('b', { etapa_id: null }), tarefa('c', { etapa_id: 'apagada' }), tarefa('d', { etapa_id: 'c2' }), tarefa('e', { etapa_id: 'c5' }),
      tarefa('f', { etapa_id: 'c3' }), tarefa('g', { etapa_id: 'c1', arquivado_em: meioDia(HOJE) }),
      tarefa('h', { etapa_id: 'c9', concluida_em: meioDia(HOJE) }), tarefa('i', { etapa_id: 'c9', concluida_em: meioDia('2026-11-16'), arquivado_em: meioDia(HOJE) }),
      tarefa('j', { etapa_id: 'c9', concluida_em: meioDia('2026-11-15') })
    ];
    // Quando
    const s = tarefasPorSituacao(tarefas, COLUNAS, HOJE);
    // Então
    expect(s).toEqual({ a_fazer: 3, fazendo: 2, aguardando: 1, concluidas: 2 });
    expect(tarefasEmAberto(s)).toBe(6);
  });

  it('dada uma tarefa concluída perto da meia-noite, quando conta, então vale o dia de Brasília', () => {
    // Dado: 02h de 16/11 em UTC é 23h de 15/11 em Brasília, fora dos últimos 7 dias
    const tarefas = [tarefa('a', { etapa_id: 'c9', concluida_em: '2026-11-16T02:00:00.000Z' })];
    // Então
    expect(tarefasPorSituacao(tarefas, COLUNAS, HOJE).concluidas).toBe(0);
  });
});

describe('Ritmo por dia', () => {
  it('dados tempos e conclusões, quando monta os 7 dias, então cada dia tem as concluídas e as horas, com hoje por último', () => {
    // Dado
    const dados = graficos({
      tarefas: [tarefa('a', { concluida_em: meioDia(HOJE) }), tarefa('b', { concluida_em: meioDia('2026-11-20') }), tarefa('c', { concluida_em: meioDia('2026-11-20') })],
      tempos: [{ inicio: meioDia(HOJE), segundos: 5400 }, { inicio: meioDia('2026-11-20'), segundos: 3600 }, { inicio: meioDia('2026-11-20'), segundos: -1800 }, { inicio: meioDia('2026-11-19'), segundos: -600 }]
    });
    // Quando
    const dias = ritmoPorDia(dados, HOJE, 'semana');
    // Então
    expect(dias.map(d => [d.dia, d.nome, d.concluidas, d.horas])).toEqual([
      ['2026-11-16', 'Seg', 0, 0], ['2026-11-17', 'Ter', 0, 0], ['2026-11-18', 'Qua', 0, 0], ['2026-11-19', 'Qui', 0, 0],
      ['2026-11-20', 'Sex', 2, 0.5], ['2026-11-21', 'Sáb', 0, 0], ['2026-11-22', 'Dom', 1, 1.5]
    ]);
    expect(dias.at(-1)).toMatchObject({ detalhe: 'hoje, 22/11', curto: '22' });
    expect(dias[0].detalhe).toBe('segunda-feira, 16/11');
    expect(ritmoVazio(dias)).toBe(false);
  });

  it('dados os 30 dias, quando monta o eixo, então o nome curto aparece a cada 7 dias, contados de hoje para trás', () => {
    // Quando
    const dias = ritmoPorDia(graficos(), HOJE, 'mes');
    // Então
    expect(dias).toHaveLength(30);
    expect(dias[0]).toMatchObject({ dia: '2026-10-24', nome: '24/10' });
    expect(dias.filter(d => d.curto).map(d => d.curto)).toEqual(['25', '01', '08', '15', '22']);
    expect(ritmoVazio(dias)).toBe(true);
  });
});

describe('Números do dia', () => {
  it('dados prazos de vários dias, quando conta, então separa os em atraso, os de hoje e os da semana', () => {
    // Quando
    const n = prazosDoDia([{ data: '2026-11-01' }, { data: '2026-11-21' }, { data: HOJE }, { data: '2026-11-25' }, { data: '2026-12-30' }], HOJE);
    // Então
    expect(n).toEqual({ vencidos: 2, hoje: 1, semana: 1 });
  });

  it.each([
    [[], '10:00', 'agenda livre'],
    [[{ hora: '09:00:00' }, { hora: '14:30:00' }, { hora: null }], '10:00', 'o próximo às 14:30'],
    [[{ hora: '09:00:00' }], '10:00', 'nenhum mais hoje'],
    [[{ hora: null }], '10:00', 'valem o dia todo']
  ])('dados os compromissos de hoje %j às %s, então o detalhe diz "%s"', (compromissos, agora, texto) => {
    // Então
    expect(detalheDaAgenda(compromissos, agora)).toBe(texto);
  });
});
