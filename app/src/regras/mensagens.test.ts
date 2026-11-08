// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { MAIOR_CONTADOR_DE_MENSAGENS, TRECHO_DA_MENSAGEM } from '../dados/limites';
import { enderecoDoComentario, rotuloDoMenu, textoDoContador, trechoDaMensagem } from './mensagens';

describe('Caixa de mensagens', () => {
  it.each([
    ['pessoas', '/pessoas/?id=c1&comentario=m1'],
    ['contratos', '/contratos/?id=c1&comentario=m1'],
    ['demandas', '/demandas/?id=c1&comentario=m1'],
    ['tarefas', '/tarefas/?id=c1&comentario=m1'],
    ['compromissos', '/agenda/?id=c1&comentario=m1']
  ] as const)('dado um comentário em %s, quando a pessoa abre a mensagem, então vai para o cartão no comentário', (modulo, esperado) => {
    // Quando
    const endereco = enderecoDoComentario(modulo, 'c1', 'm1');
    // Então
    expect(endereco).toBe(esperado);
  });

  it('dado um comentário em várias linhas, quando vira trecho, então fica numa linha só', () => {
    // Então
    expect(trechoDaMensagem('  Ligar\n\namanhã   cedo ')).toBe('Ligar amanhã cedo');
  });

  it('dado um comentário comprido, quando vira trecho, então é cortado com reticências', () => {
    // Quando
    const trecho = trechoDaMensagem('a'.repeat(TRECHO_DA_MENSAGEM + 1));
    // Então
    expect(trecho).toBe('a'.repeat(TRECHO_DA_MENSAGEM) + '…');
  });

  it.each([[1, '1'], [MAIOR_CONTADOR_DE_MENSAGENS, String(MAIOR_CONTADOR_DE_MENSAGENS)], [MAIOR_CONTADOR_DE_MENSAGENS + 1, MAIOR_CONTADOR_DE_MENSAGENS + '+']])(
    'dado %i não lidas, quando o menu mostra o contador, então aparece %s', (n, esperado) => {
      // Então
      expect(textoDoContador(n)).toBe(esperado);
    });

  it.each([[0, 'Mensagens'], [1, 'Mensagens, 1 não lida'], [3, 'Mensagens, 3 não lidas']])('dado %i não lidas, quando o leitor de tela lê o menu, então diz "%s"', (n, esperado) => {
    // Então
    expect(rotuloDoMenu(n)).toBe(esperado);
  });
});
