// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { MAIOR_CONTADOR_DE_MENSAGENS, TRECHO_DA_MENSAGEM } from '../dados/limites';
import { colunaCancelada, dataDoAviso, enderecoDoComentario, enderecoDoPrazo, paginaDoPrazo, rotuloDoAviso, rotuloDoMenu, textoDoContador, trechoDaMensagem } from './mensagens';

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

describe('Avisos de prazo', () => {
  const HOJE = '2030-01-15';

  it.each([
    ['processos', 'judicial', 'processos/judicial'],
    ['processos', 'administrativo', 'processos/administrativo'],
    ['demandas', undefined, 'demandas'],
    ['tarefas', undefined, 'tarefas'],
    ['compromissos', undefined, 'agenda']
  ] as const)('dado um prazo de %s (%s), quando a página é escolhida, então é %s', (modulo, tipo, esperada) => {
    // Então
    expect(paginaDoPrazo(modulo, tipo)).toBe(esperada);
  });

  it('dado um prazo, quando o endereço é montado, então abre o cartão pelo id', () => {
    // Quando
    const endereco = enderecoDoPrazo({ pagina: 'processos/judicial', cartao_id: 'c1' });
    // Então
    expect(endereco).toBe('/processos/judicial/?id=c1');
  });

  it.each([
    ['2030-01-15', 'Vence hoje'],
    ['2030-01-16', 'Falta 1 dia'],
    ['2030-01-18', 'Faltam 3 dias'],
    ['2030-01-13', 'Vencido há 2 dias']
  ])('dado o prazo de uma tarefa em %s, quando o aviso é lido, então diz "%s", contando de hoje', (data, esperado) => {
    // Então
    expect(rotuloDoAviso({ modulo: 'tarefas', data, concluido: false, parado: null }, HOJE)).toBe(esperado);
  });

  it.each([
    ['2030-01-15', 'É hoje'],
    ['2030-01-16', 'Em 1 dia'],
    ['2030-01-18', 'Em 3 dias'],
    ['2030-01-14', 'Passou há 1 dia']
  ])('dado um compromisso em %s, quando o aviso é lido, então diz "%s", sem falar em vencimento', (data, esperado) => {
    // Então
    expect(rotuloDoAviso({ modulo: 'compromissos', data, concluido: false, parado: null }, HOJE)).toBe(esperado);
  });

  it('dado um prazo já concluído, quando o aviso antigo é lido, então não diz que venceu', () => {
    // Então
    expect(rotuloDoAviso({ modulo: 'processos', data: '2030-01-10', concluido: true, parado: null }, HOJE)).toBe('Cumprido');
    expect(rotuloDoAviso({ modulo: 'compromissos', data: '2030-01-10', concluido: true, parado: null }, HOJE)).toBe('Realizado');
  });

  it.each([['cancelado', 'Cancelado'], ['excluido', 'Excluído'], ['arquivado', 'Arquivado']] as const)('dado um prazo %s, quando o aviso antigo é lido, então diz "%s", mesmo na data', (parado, esperado) => {
    // Então
    expect(rotuloDoAviso({ modulo: 'compromissos', data: HOJE, concluido: false, parado }, HOJE)).toBe(esperado);
  });

  it.each([['Cancelado', true], ['CANCELADA', true], ['Agendado', false], [null, false]])('dado a coluna %s, quando se confere, então cancelada é %s', (nome, esperado) => {
    // Então
    expect(colunaCancelada(nome)).toBe(esperado);
  });

  it('dado um prazo com hora e outro sem, quando a data é mostrada, então só o primeiro traz a hora', () => {
    // Então
    expect(dataDoAviso({ data: '2030-01-18', hora: '14:30' })).toBe('18/01/2030 às 14:30');
    expect(dataDoAviso({ data: '2030-01-18', hora: null })).toBe('18/01/2030');
  });
});
