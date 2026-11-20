// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { PROBLEMAS_DA_SINCRONIZACAO, RESULTADO_DO_AGORA, situacaoDaFila } from './sincronizacaoGoogle';

describe('Textos da sincronização com o Google Contatos', () => {
  it.each([
    [0, 0, 'Tudo em dia: não há ninguém esperando para ir ao Google.'],
    [1, 0, '1 pessoa esperando para ir ao Google.'],
    [5, 2, '5 pessoas esperando para ir ao Google (2 com falha).']
  ])('dadas %i pessoas na fila, %i com falha, quando a situação é mostrada, então diz "%s"', (pendentes, com_falha, texto) => {
    // Quando / Então
    expect(situacaoDaFila({ pendentes, com_falha })).toBe(texto);
  });

  it.each([
    [{ sincronizados: 0, falhas: 0 }, true, 'Nada esperando: os contatos já estavam em dia.'],
    [{ sincronizados: 1, falhas: 0 }, true, '1 pessoa foi ao Google.'],
    [{ sincronizados: 3, falhas: 1 }, false, '3 pessoas foram ao Google. 1 pessoa não foi: o SEMPER tenta de novo sozinho.'],
    [{ sincronizados: 0, falhas: 2 }, false, '2 pessoas não foram: o SEMPER tenta de novo sozinho.']
  ])('dado o "Sincronizar agora" com %o, quando termina, então o aviso é ok=%s e diz "%s"', (contas, ok, texto) => {
    // Quando
    const aviso = RESULTADO_DO_AGORA.ok({ resultado: 'ok', ...contas });
    // Então
    expect(aviso).toEqual({ ok, texto });
  });

  it('dada a sincronização desligada ou um erro, quando o "Sincronizar agora" termina, então o aviso é de falha', () => {
    // Quando
    const avisos = (['desligada', 'erro'] as const).map(r => RESULTADO_DO_AGORA[r]({ resultado: r, sincronizados: 0, falhas: 0 }));
    // Então
    expect(avisos.map(a => a.ok)).toEqual([false, false]);
  });

  it('dado cada problema, quando é mostrado, então diz o que houve e o que fazer', () => {
    // Quando / Então
    for (const { titulo, oQueFazer } of Object.values(PROBLEMAS_DA_SINCRONIZACAO)) {
      expect(titulo).toMatch(/\.$/);
      expect(oQueFazer.length).toBeGreaterThan(titulo.length);
    }
    expect(PROBLEMAS_DA_SINCRONIZACAO.autorizacao.oQueFazer).toContain('Ligar outra conta');
  });
});
