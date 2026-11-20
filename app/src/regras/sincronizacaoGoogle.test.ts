// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { AO_DECIDIR, aniversarioParaMostrar, MOTIVOS_PARA_CONFERIR, PRIMEIRA_NAO_TERMINOU, PROBLEMAS_DA_SINCRONIZACAO, RESULTADO_DO_AGORA, resumoDaPrimeira, situacaoDaFila } from './sincronizacaoGoogle';

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

  it('dada a primeira sincronização que não terminou (o Google falhou), quando o "Sincronizar agora" termina, então o aviso é de falha e não diz que está tudo em dia', () => {
    // Quando
    const aviso = RESULTADO_DO_AGORA.ok({ resultado: 'ok', sincronizados: 0, falhas: 0, primeira_por_fazer: true });
    // Então
    expect(aviso).toEqual({ ok: false, texto: PRIMEIRA_NAO_TERMINOU });
    expect(aviso.texto).not.toContain('em dia');
  });

  it('dada a primeira sincronização que não consegue terminar, quando o problema é mostrado, então manda avisar o suporte (não diz que o Google está fora)', () => {
    // Quando
    const problema = PROBLEMAS_DA_SINCRONIZACAO['primeira-recusada'];
    // Então
    expect(problema.oQueFazer).toContain('avise o suporte');
    expect(problema.titulo).not.toBe(PROBLEMAS_DA_SINCRONIZACAO['google-fora'].titulo);
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

  it.each([
    [{ ligados: 1, para_conferir: 0, novos: 0 }, 'Primeira sincronização feita: 1 contato do Google ligado a pessoas do SEMPER.'],
    [{ ligados: 12, para_conferir: 3, novos: 40 }, 'Primeira sincronização feita: 12 contatos do Google ligados a pessoas do SEMPER, 3 contatos para conferir.']
  ])('dada a primeira sincronização com %o, quando termina, então o resumo diz "%s"', (primeira, texto) => {
    // Quando / Então
    expect(resumoDaPrimeira(primeira)).toBe(texto);
  });

  it('dada a primeira sincronização feita no "Sincronizar agora", quando termina, então o aviso começa pelo resumo e segue com a fila', () => {
    // Quando
    const comFila = RESULTADO_DO_AGORA.ok({ resultado: 'ok', sincronizados: 2, falhas: 0, primeira: { ligados: 0, para_conferir: 1, novos: 2 } });
    const semFila = RESULTADO_DO_AGORA.ok({ resultado: 'ok', sincronizados: 0, falhas: 0, primeira: { ligados: 3, para_conferir: 0, novos: 0 } });
    // Então
    expect(comFila).toEqual({ ok: true, texto: 'Primeira sincronização feita: 0 contatos do Google ligados a pessoas do SEMPER, 1 contato para conferir. 2 pessoas foram ao Google.' });
    expect(semFila).toEqual({ ok: true, texto: 'Primeira sincronização feita: 3 contatos do Google ligados a pessoas do SEMPER.' });
  });

  it('dado cada motivo para conferir e cada decisão, quando são mostrados, então têm texto', () => {
    // Quando / Então
    for (const { selo, texto } of Object.values(MOTIVOS_PARA_CONFERIR)) {
      expect(selo.length).toBeGreaterThan(0);
      expect(texto).toMatch(/\.$/);
    }
    expect(Object.values(AO_DECIDIR).every(t => t.endsWith('.'))).toBe(true);
  });

  it.each([
    ['1980-05-17', '17/05/1980'],
    ['05-17', '17/05'],
    [null, ''],
    ['sem data', '']
  ])('dado o aniversário do Google %s, quando é mostrado, então fica "%s"', (aniversario, texto) => {
    // Quando / Então
    expect(aniversarioParaMostrar(aniversario)).toBe(texto);
  });
});
