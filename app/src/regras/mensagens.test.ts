// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { MAIOR_CONTADOR_DE_MENSAGENS, TRECHO_DA_MENSAGEM } from '../dados/limites';
import { colunaCancelada, dataDoAviso, EMAILS_DE_PRAZO, enderecoDoComentario, enderecoDoPrazo, NOME_DO_AVISO, paginaDoPrazo, rotuloDoAviso, rotuloDoMenu, textoDoContador, trechoDaMensagem } from './mensagens';

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

describe('Lembretes na caixa de Mensagens (#286)', () => {
  const HOJE = '2030-01-15';
  const lembrete = (extras: Partial<Parameters<typeof rotuloDoAviso>[0]> = {}) =>
    ({ modulo: 'tarefas' as const, data: '2030-01-18', concluido: false, parado: null, aviso: 'lembrete' as const, antecedencia: 60 as const, ...extras });

  it.each([
    [60, 'Lembrete: 1 hora antes'],
    [0, 'Lembrete: na hora do prazo'],
    [1440, 'Lembrete: 1 dia antes'],
    [null, 'Lembrete']
  ] as const)('dado um lembrete de %s minutos, quando é lido, então diz "%s", e não quantos dias faltam', (antecedencia, esperado) => {
    // Então
    expect(rotuloDoAviso(lembrete({ antecedencia }), HOJE)).toBe(esperado);
  });

  it('dado um lembrete de um prazo já concluído ou arquivado, quando é lido, então diz o que aconteceu com o prazo', () => {
    // Então
    expect(rotuloDoAviso(lembrete({ concluido: true }), HOJE)).toBe('Cumprido');
    expect(rotuloDoAviso(lembrete({ parado: 'arquivado' }), HOJE)).toBe('Arquivado');
  });

  it('dado os avisos de 3 dias e do dia, quando são lidos, então continuam contando de hoje', () => {
    // Então
    expect(rotuloDoAviso(lembrete({ aviso: 'proximo', antecedencia: null }), HOJE)).toBe('Faltam 3 dias');
    expect(rotuloDoAviso(lembrete({ aviso: 'hoje', data: HOJE, antecedencia: null }), HOJE)).toBe('Vence hoje');
  });

  it('quando o leitor de tela anuncia, então o lembrete tem nome próprio', () => {
    // Então
    expect(NOME_DO_AVISO.lembrete).toBe('Lembrete');
    expect(NOME_DO_AVISO.hoje).toBe('Aviso de prazo');
  });

  it('quando Minha conta lista os e-mails, então o dos lembretes vem com a chave que o banco lê', () => {
    // Então
    expect(EMAILS_DE_PRAZO.map(e => e.chave)).toContain('email_lembretes');
    expect(EMAILS_DE_PRAZO.find(e => e.chave === 'email_lembretes')?.rotulo).toBe('Lembretes que eu marcar nas tarefas e demandas, na hora escolhida');
  });
});
