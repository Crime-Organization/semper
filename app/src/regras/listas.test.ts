// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { itensDoTexto, moverNaLista, ordemNoFimDaLista, prazoDoItem, progressoDaLista, textoDosItens } from './listas';

describe('Listas da demanda', () => {
  it.each([
    ['nenhum item', [], { feitos: 0, total: 0, percentual: 0 }],
    ['um de três feito', [{ feito_em: 'x' }, { feito_em: null }, { feito_em: null }], { feitos: 1, total: 3, percentual: 33 }],
    ['todos feitos', [{ feito_em: 'x' }, { feito_em: 'y' }], { feitos: 2, total: 2, percentual: 100 }]
  ])('quando a lista tem %s, então o progresso é %j', (_caso, itens, esperado) => {
    // Quando
    const p = progressoDaLista(itens);
    // Então
    expect(p).toEqual(esperado);
  });

  it.each([
    ['vencido e por fazer', { prazo: '2026-10-28', feito_em: null }, 'vencido'],
    ['vencido mas feito', { prazo: '2026-10-28', feito_em: '2026-10-27T10:00:00Z' }, null],
    ['para hoje', { prazo: '2026-10-29', feito_em: null }, 'hoje'],
    ['sem data', { prazo: null, feito_em: null }, null]
  ])('quando o item está %s, então a situação da data de entrega é %s', (_caso, item, esperado) => {
    // Quando
    const s = prazoDoItem(item, '2026-10-29');
    // Então
    expect(s).toBe(esperado);
  });

  it('quando algo entra no fim da lista, então a posição vem depois da maior', () => {
    // Então
    expect(ordemNoFimDaLista([{ ordem: 1 }, { ordem: 4 }, { ordem: 2 }])).toBe(5);
    expect(ordemNoFimDaLista([])).toBe(1);
  });

  it('quando o segundo item sobe, então ele e o primeiro trocam de posição, e só eles mudam', () => {
    // Dado
    const itens = [{ id: 'a', ordem: 1 }, { id: 'b', ordem: 2 }, { id: 'c', ordem: 3 }];
    // Quando
    const mudancas = moverNaLista(itens, 1, -1);
    // Então
    expect(mudancas).toEqual([{ id: 'b', ordem: 1 }, { id: 'a', ordem: 2 }]);
  });

  it('quando as posições estão repetidas, então a troca renumera a lista', () => {
    // Quando
    const mudancas = moverNaLista([{ id: 'a', ordem: 0 }, { id: 'b', ordem: 0 }], 0, 1);
    // Então
    expect(mudancas).toEqual([{ id: 'b', ordem: 1 }, { id: 'a', ordem: 2 }]);
  });

  it.each([['o primeiro sobe', 0, -1], ['o último desce', 1, 1]] as const)('quando %s, então nada muda', (_caso, i, passo) => {
    // Quando
    const mudancas = moverNaLista([{ id: 'a', ordem: 1 }, { id: 'b', ordem: 2 }], i, passo);
    // Então
    expect(mudancas).toEqual([]);
  });
});

describe('Modelos de lista', () => {
  it('quando o modelo é escrito um item por linha, então os itens vêm limpos, sem linhas vazias, e voltam ao texto igual', () => {
    // Quando
    const itens = itensDoTexto('  Atos constitutivos \n\n  \nQuadro de sócios');
    // Então
    expect(itens).toEqual(['Atos constitutivos', 'Quadro de sócios']);
    expect(textoDosItens(itens)).toBe('Atos constitutivos\nQuadro de sócios');
  });
});
