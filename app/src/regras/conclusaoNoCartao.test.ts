// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { acaoDeConclusao, avisoDaConclusao, colunaDaAcao, NOME_DA_ACAO } from './conclusaoNoCartao';

const COLUNAS = [
  { id: 'a', nome: 'Para fazer', marco: 'inicio' as const },
  { id: 'b', nome: 'Fazendo', marco: null },
  { id: 'c', nome: 'Feito', marco: 'concluido' as const }
];

describe('Concluir e Reabrir no cartão (#397)', () => {
  it.each([
    ['a', 'concluir'],
    ['b', 'concluir'],
    [null, 'concluir'],
    ['c', 'reabrir']
  ])('dado o item na coluna %s, quando o cartão pergunta a ação, então é %s', (etapa, acao) => {
    // Quando
    const resultado = acaoDeConclusao(COLUNAS, etapa);
    // Então
    expect(resultado).toBe(acao);
  });

  it('dado um quadro sem a coluna das concluídas, quando o cartão pergunta a ação, então não há botão', () => {
    // Dado
    const semFim = COLUNAS.filter(c => c.marco !== 'concluido');
    // Quando / Então
    expect(acaoDeConclusao(semFim, 'a')).toBeNull();
  });

  it('dado o item concluído num quadro sem a coluna do início, quando o cartão pergunta a ação, então não há como reabrir', () => {
    // Dado
    const semInicio = COLUNAS.filter(c => c.marco !== 'inicio');
    // Quando / Então
    expect(acaoDeConclusao(semInicio, 'c')).toBeNull();
  });

  it('dadas as colunas renomeadas, quando a ação leva o item, então vale a coluna-marco, e não o nome', () => {
    // Dado
    const renomeadas = COLUNAS.map(c => ({ ...c, nome: 'Outro nome ' + c.id }));
    // Quando / Então
    expect(colunaDaAcao(renomeadas, 'concluir')?.id).toBe('c');
    expect(colunaDaAcao(renomeadas, 'reabrir')?.id).toBe('a');
  });

  it.each([
    ['tarefas', 'concluir', 'Tarefa concluída.'],
    ['tarefas', 'reabrir', 'Tarefa reaberta em "Para fazer".'],
    ['demandas', 'concluir', 'Demanda concluída.'],
    ['demandas', 'reabrir', 'Demanda reaberta em "Para fazer".']
  ] as const)('dado o módulo %s e a ação %s, quando ela termina, então o aviso diz "%s"', (modulo, acao, aviso) => {
    // Quando / Então
    expect(avisoDaConclusao(modulo, acao, 'Para fazer')).toBe(aviso);
  });

  it('dadas as duas ações, então cada uma tem o nome do botão e da dica', () => {
    // Então
    expect(NOME_DA_ACAO).toEqual({ concluir: 'Concluir', reabrir: 'Reabrir' });
  });
});
