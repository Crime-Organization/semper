// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it, vi } from 'vitest';
import type { DadosAnotacoes, ItemDaAnotacao } from '../dados';
import { buscarItensParaMencionar } from './mencoesDeItens';

const SD = vi.hoisted(() => ({ itensParaLigar: vi.fn<DadosAnotacoes['itensParaLigar']>() }));
vi.mock('../dados', () => ({ SD }));

const item = (modulo: ItemDaAnotacao['modulo'], id: string, codigo: string): ItemDaAnotacao => ({ modulo, id, codigo, nome: 'Item ' + id, arquivado_em: null });

describe('Busca da lista do ! (#297)', () => {
  it('dado um módulo que falha, quando a lista procura, então os outros aparecem, com o código igual ao termo primeiro', async () => {
    // Dado
    SD.itensParaLigar.mockImplementation(async modulo => {
      if (modulo === 'contratos') throw new Error('falhou');
      return modulo === 'tarefas' ? [item('tarefas', 't1', 'AB120000')] : [item('demandas', 'd1', 'AB12CD34')];
    });
    // Quando
    const achados = await buscarItensParaMencionar('ab12cd34', ['tarefas', 'contratos', 'demandas']);
    // Então
    expect(SD.itensParaLigar.mock.calls.map(([modulo, termo]) => [modulo, termo])).toEqual([['tarefas', 'ab12cd34'], ['contratos', 'ab12cd34'], ['demandas', 'ab12cd34']]);
    expect(achados.map(i => i.id)).toEqual(['d1', 't1']);
  });
});
