// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { camposDaDemanda, demandaParaTarefa, devePerguntarProcesso } from './processoDaDemanda';

const cliente = (id: string) => ({ id, codigo: id, nome: id, arquivado_em: null }) as never;

describe('O cadastro que vem da demanda', () => {
  it('quando todos estão ativos, então traz clientes, responsável e colaboradores', () => {
    // Quando
    const c = camposDaDemanda({ responsavel_id: 'u1', colaboradores: ['u2'], clientes: [cliente('c1'), cliente('c2')] }, ['u1', 'u2'], 'eu');
    // Então
    expect(c).toEqual({ responsavelId: 'u1', colaboradores: ['u2'], clientes: ['c1', 'c2'] });
  });

  it('quando o responsável ou um colaborador saiu, então fica quem está cadastrando, e o colaborador sai', () => {
    // Quando
    const c = camposDaDemanda({ responsavel_id: 'saiu', colaboradores: ['foi', 'eu', 'u2'], clientes: [] }, ['eu', 'u2'], 'eu');
    // Então
    expect(c).toEqual({ responsavelId: 'eu', colaboradores: ['u2'], clientes: [] });
  });
});

describe('Perguntar ao concluir', () => {
  it.each([
    ['foi para a coluna das concluídas, sem processo', { modulo: true, etapa: 'fim', concluida: 'fim', ligados: 0 }, true],
    ['foi para outra coluna', { modulo: true, etapa: 'x', concluida: 'fim', ligados: 0 }, false],
    ['saiu do quadro', { modulo: true, etapa: null, concluida: 'fim', ligados: 0 }, false],
    ['o quadro não tem coluna de concluídas', { modulo: true, etapa: null, concluida: null, ligados: 0 }, false],
    ['já tem processo', { modulo: true, etapa: 'fim', concluida: 'fim', ligados: 1 }, false],
    ['o escritório não tem o módulo', { modulo: false, etapa: 'fim', concluida: 'fim', ligados: 0 }, false]
  ])('quando %s, então a resposta é a certa', (_caso, pedido, resposta) => {
    // Então
    expect(devePerguntarProcesso(pedido)).toBe(resposta);
  });
});

describe('A demanda da tarefa nascida no processo', () => {
  it.each([
    ['nenhuma', [], null],
    ['uma', [{ id: 'd1', arquivado_em: null }], 'd1'],
    ['duas', [{ id: 'd1', arquivado_em: null }, { id: 'd2', arquivado_em: null }], null],
    ['uma ativa e uma arquivada', [{ id: 'd1', arquivado_em: 'x' }, { id: 'd2', arquivado_em: null }], 'd2']
  ])('quando há %s, então só herda quando não há dúvida', (_caso, ligadas, resposta) => {
    // Então
    expect(demandaParaTarefa(ligadas)).toBe(resposta);
  });
});
