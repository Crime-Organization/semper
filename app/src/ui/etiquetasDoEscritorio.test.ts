// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Etiqueta } from '../dados';
import { buscarEtiquetas, iniciarEtiquetas, lojaDeEtiquetas, procurarEtiquetas } from './etiquetasDoEscritorio';

const SD = vi.hoisted(() => ({ etiquetasListar: vi.fn<() => Promise<Etiqueta[]>>() }));
vi.mock('../dados', () => ({ SD }));
vi.mock('./avisos', () => ({ falha: vi.fn() }));

const DO_A: Etiqueta = { id: 'e-a', cor: 'azul', texto: 'Do escritório A', criado_por: 'u-a' };
const DO_B: Etiqueta = { id: 'e-b', cor: 'verde', texto: 'Do escritório B', criado_por: 'u-b' };

describe('Lista de etiquetas do escritório', () => {
  beforeEach(() => {
    SD.etiquetasListar.mockReset().mockResolvedValue([DO_A]);
    iniciarEtiquetas('ninguem');
  });

  it('quando outra conta entra, então a lista da anterior é esquecida na hora', async () => {
    // Dado
    iniciarEtiquetas('u-a');
    await buscarEtiquetas();
    expect(lojaDeEtiquetas.ler()).toEqual([DO_A]);
    // Quando
    iniciarEtiquetas('u-b');
    // Então
    expect(lojaDeEtiquetas.ler()).toBeNull();
  });

  it('quando a mesma conta é lida de novo, então a lista continua', async () => {
    // Dado
    iniciarEtiquetas('u-a');
    await buscarEtiquetas();
    // Quando
    iniciarEtiquetas('u-a');
    // Então
    expect(lojaDeEtiquetas.ler()).toEqual([DO_A]);
  });

  it('quando a resposta chega depois de trocar de conta, então ela é descartada', async () => {
    // Dado: a busca da conta A ainda não voltou
    let responder: (l: Etiqueta[]) => void = () => undefined;
    SD.etiquetasListar.mockReturnValueOnce(new Promise(r => { responder = r; }));
    iniciarEtiquetas('u-a');
    const busca = buscarEtiquetas();
    // Quando
    iniciarEtiquetas('u-b');
    responder([DO_A]);
    await busca;
    // Então
    expect(lojaDeEtiquetas.ler()).toBeNull();
  });

  it('quando um cartão traz uma etiqueta que a lista não conhece, então busca de novo, uma vez só por etiqueta', async () => {
    // Dado
    iniciarEtiquetas('u-a');
    await buscarEtiquetas();
    SD.etiquetasListar.mockClear().mockResolvedValue([DO_A, DO_B]);
    // Quando
    procurarEtiquetas(['e-a', 'e-b'], [DO_A]);
    await vi.waitFor(() => expect(lojaDeEtiquetas.ler()).toEqual([DO_A, DO_B]));
    procurarEtiquetas(['e-b'], [DO_A]);
    procurarEtiquetas(['e-a'], [DO_A, DO_B]);
    // Então
    expect(SD.etiquetasListar).toHaveBeenCalledTimes(1);
  });
});
