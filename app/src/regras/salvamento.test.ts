// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Historico } from '../dados/tipos';
import { decidirGravacao, juntarTextoNoHistorico, situacaoDoSalvamento, TEXTO_DO_SALVAMENTO } from './salvamento';

describe('O texto que salva sozinho', () => {
  it.each([
    ['igual ao gravado', { valor: 'a', gravado: 'a', salvando: false, falhou: false }, 'salvo'],
    ['mudado e ainda por gravar', { valor: 'ab', gravado: 'a', salvando: false, falhou: false }, 'porSalvar'],
    ['sendo gravado', { valor: 'ab', gravado: 'a', salvando: true, falhou: false }, 'salvando'],
    ['gravando de novo depois de uma falha', { valor: 'ab', gravado: 'a', salvando: true, falhou: true }, 'salvando'],
    ['mudado e com a gravação falha', { valor: 'ab', gravado: 'a', salvando: false, falhou: true }, 'naoSalvo'],
    ['de volta ao gravado depois de uma falha', { valor: 'a', gravado: 'a', salvando: false, falhou: true }, 'salvo'],
    ['mudado por outra pessoa no banco', { valor: 'ab', gravado: 'a', salvando: false, falhou: true, conflito: true }, 'conflito'],
    ['de volta ao gravado com o conflito ainda marcado', { valor: 'a', gravado: 'a', salvando: false, falhou: true, conflito: true }, 'salvo']
  ] as const)('dado o texto %s, quando a tela pergunta, então a situação é %j', (_caso, estado, situacao) => {
    // Então
    expect(situacaoDoSalvamento(estado)).toBe(situacao);
  });

  it('então cada situação tem o seu texto, a falha diz como tentar de novo e o conflito pede para escolher', () => {
    // Então
    expect(TEXTO_DO_SALVAMENTO.salvando).toBe('Salvando…');
    expect(TEXTO_DO_SALVAMENTO.salvo).toBe('Salvo');
    expect(TEXTO_DO_SALVAMENTO.naoSalvo).toMatch(/Ctrl\+S/);
    expect(TEXTO_DO_SALVAMENTO.conflito).toMatch(/Outra pessoa/);
  });
});

describe('A trava otimista do texto (ninguém apaga o que outra pessoa escreveu)', () => {
  it.each([
    ['o banco ainda tem o texto de que a pessoa partiu', { base: 'a', noBanco: 'a', novo: 'ab' }, 'gravar'],
    ['o banco já tem o texto novo (a mesma mudança, noutra aba)', { base: 'a', noBanco: 'ab', novo: 'ab' }, 'jaGravado'],
    ['outra pessoa mudou o texto depois que a anotação abriu', { base: 'a', noBanco: 'a, de outra pessoa', novo: 'ab' }, 'conflito']
  ] as const)('dado que %s, quando a gravação vai sair, então a decisão é %j', (_caso, textos, decisao) => {
    // Quando / Então
    expect(decidirGravacao(textos)).toBe(decisao);
  });
});

describe('O histórico com uma sessão de escrita numa linha só', () => {
  const MINUTO = 60_000;
  const JANELA = 10 * MINUTO;
  let n = 0;
  /** Uma linha do histórico, `minutos` depois das 10h. */
  const linha = (minutos: number, alteracoes: Historico['alteracoes'], feito_por = 'u-ana'): Historico =>
    ({ id: ++n, alteracoes, feito_por, em: new Date(Date.UTC(2026, 10, 18, 10, minutos)).toISOString() });
  const texto = { texto: { de: null, para: null } };

  it('dadas várias gravações seguidas do texto pela mesma pessoa, quando o histórico aparece, então elas viram uma linha só, a mais nova', () => {
    // Dado (do mais novo para o mais velho, como o banco lê)
    const hist = [linha(30, texto), linha(22, texto), linha(15, texto), linha(6, texto)];
    // Quando
    const juntas = juntarTextoNoHistorico(hist, JANELA);
    // Então: cada uma veio até 10 minutos depois da anterior, mesmo que a sessão inteira passe disso
    expect(juntas).toEqual([hist[0]]);
  });

  it('dada uma pausa maior que a janela, quando o histórico aparece, então são duas sessões', () => {
    // Dado
    const hist = [linha(40, texto), linha(35, texto), linha(5, texto)];
    // Quando / Então
    expect(juntarTextoNoHistorico(hist, JANELA)).toEqual([hist[0], hist[2]]);
  });

  it('dadas mudanças de outra pessoa ou de outro campo no meio, quando o histórico aparece, então elas separam as sessões e ficam', () => {
    // Dado
    const pasta = { pasta_id: { de: null, para: 'Clientes' } };
    const hist = [linha(9, texto), linha(8, texto, 'u-bruno'), linha(7, texto), linha(6, pasta), linha(5, texto), linha(4, { ...texto, titulo: { de: 'A', para: 'B' } })];
    // Quando / Então: nada se junta
    expect(juntarTextoNoHistorico(hist, JANELA)).toEqual(hist);
  });
});
