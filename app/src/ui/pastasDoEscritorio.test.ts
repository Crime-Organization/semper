// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pasta } from '../dados';
import { buscarPastas, lojaDePastas, usePastas, useProcurarPastas } from './pastasDoEscritorio';

const SD = vi.hoisted(() => ({ pastasListar: vi.fn<() => Promise<Pasta[]>>() }));
vi.mock('../dados', () => ({ SD }));
vi.mock('./avisos', () => ({ falha: vi.fn() }));
const sessao = vi.hoisted(() => ({ dono: 'u-ana' }));
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: sessao.dono } }) }));

const pasta = (id: string, nome: string): Pasta => ({ id, nome, pasta_mae_id: null, criada_por: 'u-ana', criada_em: '' });
const ATAS = pasta('atas', 'Atas'), POPS = pasta('pops', 'POPs');
// Cada caso com uma conta própria: as pastas já procuradas são de uma conta só, e um caso não herda as do anterior.
let contas = 0;

describe('Lista de pastas do escritório', () => {
  beforeEach(() => {
    sessao.dono = `u-ana-${++contas}`;
    lojaDePastas.reiniciar();
    SD.pastasListar.mockReset().mockResolvedValue([POPS]);
  });

  it('quando a resposta de uma busca antiga chega depois da nova, então ela é descartada', async () => {
    // Dado: a primeira busca ainda não voltou
    let responder: (l: Pasta[]) => void = () => undefined;
    SD.pastasListar.mockReturnValueOnce(new Promise(r => { responder = r; })).mockResolvedValueOnce([POPS, ATAS]);
    const antiga = buscarPastas('u-ana');
    await buscarPastas('u-ana');
    // Quando
    responder([POPS]);
    await antiga;
    // Então
    expect(lojaDePastas.ler()).toEqual({ dono: 'u-ana', lista: [POPS, ATAS] });
  });

  it('dada a lista de outra conta, quando a tela pede as pastas, então não a mostra e lê as desta conta', async () => {
    // Dado
    lojaDePastas.mudar({ dono: 'u-bia', lista: [ATAS] });
    // Quando
    const { result } = renderHook(() => usePastas());
    // Então
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual([POPS]));
    expect(SD.pastasListar).toHaveBeenCalledTimes(1);
  });

  it('dada a lista guardada, quando a tela pede para reler, então lê de novo uma vez ao aparecer; sem pedir, não lê', async () => {
    // Dado
    lojaDePastas.mudar({ dono: sessao.dono, lista: [ATAS] });
    // Quando
    const semReler = renderHook(() => usePastas());
    // Então
    expect(semReler.result.current).toEqual([ATAS]);
    expect(SD.pastasListar).not.toHaveBeenCalled();
    // Quando
    const { result, rerender } = renderHook(() => usePastas({ reler: true }));
    // Então
    await waitFor(() => expect(result.current).toEqual([POPS]));
    rerender();
    expect(SD.pastasListar).toHaveBeenCalledTimes(1);
  });

  it('dada uma pasta que a lista guardada não conhece, quando a tela precisa dela, então espera a nova leitura, que a traz', async () => {
    // Dado: um colega criou "Atas" depois que a lista foi lida
    lojaDePastas.mudar({ dono: sessao.dono, lista: [POPS] });
    SD.pastasListar.mockResolvedValue([POPS, ATAS]);
    // Quando
    const { result } = renderHook(() => usePastas({ precisa: 'atas' }));
    // Então: enquanto lê, a lista ainda não veio (a tela não mostra "Sem pasta")
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual([POPS, ATAS]));
    expect(SD.pastasListar).toHaveBeenCalledTimes(1);
  });

  it('dada uma pasta apagada, quando a nova leitura não a traz, então devolve a lista e não lê mais por ela', async () => {
    // Dado
    lojaDePastas.mudar({ dono: sessao.dono, lista: [POPS] });
    // Quando
    const { result, rerender } = renderHook(() => usePastas({ precisa: 'apagada' }));
    // Então
    await waitFor(() => expect(result.current).toEqual([POPS]));
    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toEqual([POPS]);
    expect(SD.pastasListar).toHaveBeenCalledTimes(1);
  });

  it('dada uma lista de anotações com uma pasta desconhecida, quando ela aparece de novo, então as pastas são lidas uma vez só', async () => {
    // Dado
    lojaDePastas.mudar({ dono: sessao.dono, lista: [POPS] });
    SD.pastasListar.mockResolvedValue([POPS, ATAS]);
    // Quando
    const { rerender } = renderHook(({ ids }) => useProcurarPastas(ids), { initialProps: { ids: ['pops', 'atas', null] as (string | null)[] } });
    await waitFor(() => expect(lojaDePastas.ler()?.lista).toEqual([POPS, ATAS]));
    rerender({ ids: ['atas', 'pops'] });
    // Então
    expect(SD.pastasListar).toHaveBeenCalledTimes(1);
  });
});
