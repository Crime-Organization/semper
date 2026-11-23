// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FuncaoNaTarefa } from '../dados';
import { iniciarFuncoes, lojaDeFuncoes, recarregarFuncoes } from './funcoesNaTarefa';

const SD = vi.hoisted(() => ({ funcoesNaTarefaListar: vi.fn<() => Promise<FuncaoNaTarefa[]>>() }));
vi.mock('../dados', () => ({ SD }));

const EXECUTA: FuncaoNaTarefa = { id: 'f1', nome: 'Executa', executa: true, ordem: 1 };
const ACOMPANHA: FuncaoNaTarefa = { id: 'f2', nome: 'Acompanha', executa: false, ordem: 2 };

describe('Lista de funções dos participantes da tarefa (#313)', () => {
  beforeEach(() => {
    SD.funcoesNaTarefaListar.mockReset().mockResolvedValue([ACOMPANHA, EXECUTA]);
    iniciarFuncoes('ninguem');
  });

  it('quando a lista chega, então vem na ordem da lista do escritório', async () => {
    // Quando
    await recarregarFuncoes();
    // Então
    expect(lojaDeFuncoes.ler()).toEqual([EXECUTA, ACOMPANHA]);
  });

  it('quando outra conta entra, então a lista da anterior é esquecida na hora', async () => {
    // Dado
    iniciarFuncoes('u-a');
    await recarregarFuncoes();
    // Quando
    iniciarFuncoes('u-b');
    // Então
    expect(lojaDeFuncoes.ler()).toBeNull();
  });

  it('quando a busca falha, então a lista fica vazia, e as telas seguem sem funções', async () => {
    // Dado
    SD.funcoesNaTarefaListar.mockRejectedValue(new Error('fora do ar'));
    // Quando
    await recarregarFuncoes();
    // Então
    expect(lojaDeFuncoes.ler()).toEqual([]);
  });
});
