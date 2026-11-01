// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  abandonarGravacao, esquecerGravacao, estaGravando, gravacao, gravarImportacao, type EstadoGravacao, type PedidoDeGravacao, type TotaisDoLote
} from './gravacaoDaImportacao';

// No fim, a gravação pede que as listas recarreguem e avisa no pé da tela; o teste confere os dois pedidos.
const { avisar, sinalizarMudanca } = vi.hoisted(() => ({
  avisar: vi.fn<typeof import('./avisos').avisar>(), sinalizarMudanca: vi.fn<typeof import('./avisos').sinalizarMudanca>()
}));
vi.mock('./avisos', () => ({ avisar, sinalizarMudanca }));

interface Item { linha: number }
/** Linhas do arquivo (a 1ª é o cabeçalho), em lotes de 2: [2, 3], [4, 5], [6]. */
const LOTES: Item[][] = [[{ linha: 2 }, { linha: 3 }], [{ linha: 4 }, { linha: 5 }], [{ linha: 6 }]];
const ID = 'importacao-1';

/** Um pedido em que cada lote cria uma pessoa e completa as outras; o registro conta 1 incompleta. */
function pedido(mudar: Partial<PedidoDeGravacao<Item>> = {}) {
  return {
    lotes: LOTES,
    iniciar: vi.fn(async () => ID),
    gravarLote: vi.fn(async (_id: string, lote: Item[]): Promise<TotaisDoLote> => ({ criadas: 1, completadas: lote.length - 1 })),
    concluir: vi.fn(async (_id: string, completadas: number) => ({ criadas: 3, completadas, incompletas: 1 })),
    avisoFinal: vi.fn(() => 'Importação concluída.'),
    ...mudar
  };
}
/** Uma promessa que o teste resolve quando quiser (para olhar a gravação no meio). */
function promessa<T>() {
  let resolver!: (v: T) => void;
  const p = new Promise<T>(r => { resolver = r; });
  return { p, resolver };
}
/** Dispara o beforeunload, como o navegador ao recarregar ou fechar a aba; devolve se ele pediu para confirmar. */
function sairDaPagina() {
  const evento = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(evento);
  return evento.defaultPrevented;
}

describe('Gravação da importação', () => {
  beforeEach(() => { gravacao.reiniciar(); avisar.mockReset(); sinalizarMudanca.mockReset(); });

  it('quando todos os lotes gravam, então a loja conta o progresso, termina com os números do registro e avisa', async () => {
    // Dado
    const p = pedido();
    const fases: EstadoGravacao[] = [];
    const cancelar = gravacao.assinar(() => fases.push(gravacao.ler()));
    // Quando
    const fim = await gravarImportacao(p);
    cancelar();
    // Então
    expect(fases.slice(0, -1)).toEqual([
      { fase: 'gravando', gravadas: 0, total: 5 },
      { fase: 'gravando', gravadas: 2, total: 5 },
      { fase: 'gravando', gravadas: 4, total: 5 },
      { fase: 'gravando', gravadas: 5, total: 5 }
    ]);
    expect(fim).toEqual({ fase: 'concluida', total: 5, gravadas: 5, totais: { criadas: 3, completadas: 2, incompletas: 1 }, falha: null, erroAoRegistrar: null });
    expect(gravacao.ler()).toEqual(fim);
    expect(p.gravarLote).toHaveBeenCalledTimes(3);
    expect(p.concluir).toHaveBeenCalledWith(ID, 2);
    expect(avisar).toHaveBeenCalledWith('Importação concluída.', 'ok');
  });

  it('dado erro no 2º lote, quando grava, então para ali, diz quais linhas ficaram de fora e conclui o registro com o que entrou', async () => {
    // Dado
    const p = pedido({
      gravarLote: vi.fn(async (_id: string, lote: Item[]) => {
        if (lote[0].linha === 4) throw new Error('Linha 5: o e-mail é inválido.');
        return { criadas: 1, completadas: lote.length - 1 };
      })
    });
    // Quando
    const fim = await gravarImportacao(p);
    // Então
    expect(p.gravarLote).toHaveBeenCalledTimes(2);
    expect(fim.gravadas).toBe(2);
    expect(fim.falha).toEqual({ primeira: 4, ultima: 6, quantas: 3, mensagem: 'Linha 5: o e-mail é inválido.' });
    expect(p.concluir).toHaveBeenCalledWith(ID, 1);
    expect(avisar).toHaveBeenCalledWith('Importação concluída.', 'erro');
  });

  it('dado que o registro não abre, quando grava, então nenhum lote é tentado e todas as linhas ficam de fora', async () => {
    // Dado
    const p = pedido({ iniciar: vi.fn(async () => { throw new Error('Só administradores podem importar.'); }) });
    // Quando
    const fim = await gravarImportacao(p);
    // Então
    expect(p.gravarLote).not.toHaveBeenCalled();
    expect(p.concluir).not.toHaveBeenCalled();
    expect(fim.gravadas).toBe(0);
    expect(fim.falha).toEqual({ primeira: 2, ultima: 6, quantas: 5, mensagem: 'Só administradores podem importar.' });
  });

  it('dado que o registro não conclui, quando grava, então as pessoas continuam gravadas e os números vêm da soma dos lotes', async () => {
    // Dado
    const p = pedido({ concluir: vi.fn(async () => { throw new Error('Sem conexão.'); }) });
    // Quando
    const fim = await gravarImportacao(p);
    // Então
    expect(fim.gravadas).toBe(5);
    expect(fim.falha).toBeNull();
    expect(fim.totais).toEqual({ criadas: 3, completadas: 2, incompletas: null });
    expect(fim.erroAoRegistrar).toBe('Sem conexão.');
    expect(avisar).toHaveBeenCalledWith('Importação concluída.', 'erro');
  });

  it('dada a janela fechada no meio da gravação, quando ela termina, então as listas recarregam (só no fim)', async () => {
    // Dado
    const lote = promessa<TotaisDoLote>();
    const gravando = gravarImportacao(pedido({ lotes: [[{ linha: 2 }]], gravarLote: vi.fn(() => lote.p) }));
    const noMeio = sinalizarMudanca.mock.calls.length;
    // Quando
    lote.resolver({ criadas: 1, completadas: 0 });
    await gravando;
    // Então
    expect(noMeio).toBe(0);
    expect(sinalizarMudanca).toHaveBeenCalledTimes(1);
  });

  it('quando a gravação está no meio, então sair da página pede confirmação; depois que termina, não pede mais', async () => {
    // Dado
    const lote = promessa<TotaisDoLote>();
    const p = pedido({ lotes: [[{ linha: 2 }]], gravarLote: vi.fn(() => lote.p) });
    const gravando = gravarImportacao(p);
    // Quando
    const noMeio = sairDaPagina();
    lote.resolver({ criadas: 1, completadas: 0 });
    await gravando;
    // Então
    expect(noMeio).toBe(true);
    expect(sairDaPagina()).toBe(false);
  });

  it('quando já há uma gravação no meio, então outra não começa e a primeira não é afetada', async () => {
    // Dado
    const lote = promessa<TotaisDoLote>();
    const primeira = gravarImportacao(pedido({ lotes: [[{ linha: 2 }]], gravarLote: vi.fn(() => lote.p) }));
    const outra = pedido();
    // Quando
    const segunda = gravarImportacao(outra);
    // Então
    await expect(segunda).rejects.toThrow('Já há uma importação gravando. Espere terminar.');
    expect(outra.iniciar).not.toHaveBeenCalled();
    lote.resolver({ criadas: 1, completadas: 0 });
    expect((await primeira).gravadas).toBe(1);
  });

  it('dada uma gravação concluída, quando a tela a esquece, então a loja volta ao começo', async () => {
    // Dado
    await gravarImportacao(pedido());
    // Quando
    esquecerGravacao();
    // Então
    expect(gravacao.ler()).toEqual({ fase: 'ocioso' });
  });

  it('dada uma gravação no meio, quando a pessoa sai do sistema, então ela para antes do próximo lote e a loja volta ao começo, sem aviso', async () => {
    // Dado
    const lote = promessa<TotaisDoLote>();
    const p = pedido({ gravarLote: vi.fn(() => lote.p) });
    const gravando = gravarImportacao(p);
    await vi.waitFor(() => expect(p.gravarLote).toHaveBeenCalledTimes(1));
    // Quando
    abandonarGravacao();
    lote.resolver({ criadas: 1, completadas: 1 });
    const fim = await gravando;
    // Então
    expect(p.gravarLote).toHaveBeenCalledTimes(1);
    expect(fim.falha).toMatchObject({ primeira: 4, ultima: 6, quantas: 3 });
    expect(gravacao.ler()).toEqual({ fase: 'ocioso' });
    expect(estaGravando()).toBe(false);
    expect(sairDaPagina()).toBe(false);
    expect(avisar).not.toHaveBeenCalled();
    expect(sinalizarMudanca).not.toHaveBeenCalled();
  });

  it('dada uma gravação concluída, quando a pessoa sai do sistema, então quem entrar depois não vê o resumo dela', async () => {
    // Dado
    await gravarImportacao(pedido());
    // Quando
    abandonarGravacao();
    // Então
    expect(gravacao.ler()).toEqual({ fase: 'ocioso' });
  });

  it('dada uma gravação no meio, quando a tela tenta esquecê-la, então ela continua', async () => {
    // Dado
    const lote = promessa<TotaisDoLote>();
    const gravando = gravarImportacao(pedido({ lotes: [[{ linha: 2 }]], gravarLote: vi.fn(() => lote.p) }));
    // Quando
    esquecerGravacao();
    // Então
    expect(gravacao.ler()).toEqual({ fase: 'gravando', gravadas: 0, total: 1 });
    lote.resolver({ criadas: 1, completadas: 0 });
    await gravando;
  });
});
