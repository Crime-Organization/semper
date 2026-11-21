// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { GrupoDaLista, ItemDaLista, PessoaResumida } from '../dados/tipos';
import { dadosDaCopia, prazosDosItensCopiados, type TarefaParaCopiar } from './copiaDaTarefa';

const pessoa = (id: string) => ({ id, nome: id, codigo: id }) as PessoaResumida;
const TAREFA: TarefaParaCopiar = {
  titulo: 'Emitir a GRU', descricao: 'Pagar até o fim do dia', prazo: '2026-12-01', prazo_hora: '14:00:00', lembrete: 60,
  responsavel_id: 'ana', participantes: ['bruno'], grupos: ['g-marcas'], pessoas: [pessoa('cliente-1')]
};
const DEMANDA = { id: 'd2', clientes: ['cliente-2'], contrato_id: 'k2' };

const item = (id: string, ordem: number, prazo: string | null = null, grupo_id: string | null = null): ItemDaLista =>
  ({ id, texto: id, prazo, feito_em: null, feito_por: null, ordem, grupo_id, criado_em: '2026-11-01T00:00:00Z' });
const grupo = (id: string, ordem: number): GrupoDaLista => ({ id, nome: id, pai_id: null, ordem, criado_em: '2026-11-01T00:00:00Z' });

describe('Os dados da cópia da tarefa em outra demanda (#312)', () => {
  it('dada uma tarefa com pessoas, quando é copiada, então a cópia leva o título, a descrição, o prazo, a equipe e as pessoas, na demanda escolhida e com o contrato dela', () => {
    // Quando
    const dados = dadosDaCopia(TAREFA, DEMANDA);
    // Então
    expect(dados).toEqual({
      titulo: 'Emitir a GRU', descricao: 'Pagar até o fim do dia', prazo: '2026-12-01', prazo_hora: '14:00:00', lembrete: 60,
      responsavel_id: 'ana', participantes: ['bruno'], grupos: ['g-marcas'], pessoas: ['cliente-1'], demanda_id: 'd2', contrato_id: 'k2'
    });
  });

  it('dada uma tarefa sem pessoas e sem grupos, quando é copiada, então a cópia leva os clientes da demanda', () => {
    // Quando
    const dados = dadosDaCopia({ ...TAREFA, pessoas: [], grupos: undefined }, DEMANDA);
    // Então
    expect(dados.pessoas).toEqual(['cliente-2']);
    expect(dados.grupos).toEqual([]);
  });

  it('dada uma demanda sem contrato, quando a tarefa é copiada, então a cópia fica sem contrato', () => {
    // Quando
    const dados = dadosDaCopia(TAREFA, { ...DEMANDA, contrato_id: null });
    // Então
    expect(dados.contrato_id).toBeUndefined();
    expect(dados.demanda_id).toBe('d2');
  });
});

describe('Os prazos dos itens do checklist copiado (#312)', () => {
  it('dado um checklist com grupo e itens com prazo, quando a cópia nasce, então cada item dela recebe o prazo do item na mesma posição', () => {
    // Dado: na leitura, "a" (sem prazo), o grupo com "b" (prazo), e "c" (prazo)
    const original = { grupos: [grupo('g', 2)], itens: [item('a', 1), item('b', 3, '2026-12-05', 'g'), item('c', 4, '2026-12-09')] };
    const copia = { grupos: [grupo('G', 2)], itens: [item('A', 1), item('B', 3, null, 'G'), item('C', 4)] };
    // Quando
    const prazos = prazosDosItensCopiados(original, copia);
    // Então
    expect(prazos).toEqual([{ id: 'B', prazo: '2026-12-05' }, { id: 'C', prazo: '2026-12-09' }]);
  });
});
