// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import { avisoDaTroca, erroDoEmailDoColega, erroDoNovoEmail, normalizarEmail, situacaoDoAvisoDaTroca, RECUSA_DA_TROCA, seloDoAvisoDaTroca } from './conta';
import { TROCAS_DE_EMAIL_POR_HORA } from '../dados/limites';

describe('Troca do e-mail de acesso', () => {
  const ATUAL = 'Pessoa@Exemplo.com';

  it('dado um e-mail novo válido, quando confere, então o pedido pode seguir', () => {
    // Dado / Quando / Então
    expect(erroDoNovoEmail('nova@exemplo.com', ATUAL)).toBeNull();
  });

  it.each([
    ['vazio', '   ', 'Informe o e-mail novo.'],
    ['sem domínio', 'nova@', 'Informe um e-mail válido.'],
    ['com espaço no meio', 'no va@exemplo.com', 'Informe um e-mail válido.'],
    ['com acento antes da arroba', 'joão@exemplo.com.br', 'Informe um e-mail válido.'],
    ['com acento no domínio', 'maria@exêmplo.com', 'Informe um e-mail válido.'],
    ['com ponto duplo no domínio', 'maria@exemplo..com', 'Informe um e-mail válido.'],
    ['longo demais', 'a'.repeat(TAMANHO_EMAIL_DE_ACESSO) + '@exemplo.com', 'Informe um e-mail válido.'],
    ['igual ao atual, com outras maiúsculas e espaços', ' pessoa@exemplo.COM ', 'Este já é o seu e-mail de acesso.']
  ])('dado um e-mail %s, quando confere, então diz o que corrigir', (_caso, novo, mensagem) => {
    // Dado / Quando / Então
    expect(erroDoNovoEmail(novo, ATUAL)).toBe(mensagem);
  });

  it('dado um ponto duplo antes da arroba, quando confere, então aceita, como o login', () => {
    // Dado / Quando / Então
    expect(erroDoNovoEmail('maria..silva@exemplo.com', ATUAL)).toBeNull();
  });

  it.each([
    ['com a troca esperando a confirmação', 'nova@exemplo.com', 'Pedido enviado. Confirme pelo link que chegará por e-mail.'],
    ['sem nada pendente', null, 'E-mail de acesso alterado.']
  ])('dado o pedido aceito %s, quando avisa, então diz o que aconteceu', (_caso, pendente, mensagem) => {
    // Dado / Quando / Então
    expect(avisoDaTroca(pendente)).toBe(mensagem);
  });

  it('dado um e-mail com espaços e maiúsculas, quando normaliza, então fica como a conta guarda', () => {
    // Dado / Quando / Então
    expect(normalizarEmail('  Nova@Exemplo.COM ')).toBe('nova@exemplo.com');
  });

  it.each([
    ['vazio', '', '', 'Informe o e-mail novo.'],
    ['inválido', 'sem-arroba', 'sem-arroba', 'Informe um e-mail válido.'],
    ['igual ao atual', ' Atual@Exemplo.com', 'atual@exemplo.com', 'Este já é o e-mail de acesso desta pessoa.'],
    ['repetido errado', 'nova@exemplo.com', 'nvoa@exemplo.com', 'Os dois e-mails não são iguais.'],
    ['igual ao repetido, com outra caixa', 'Nova@exemplo.com', ' nova@EXEMPLO.com ', null]
  ])('dado o e-mail de um colega %s, quando o administrador confere, então a resposta é a esperada', (_caso, novo, repetido, esperado) => {
    // Dado / Quando / Então
    expect(erroDoEmailDoColega(novo, repetido, 'atual@exemplo.com')).toBe(esperado);
  });

  it.each([
    ['saiu para todos', [], ''],
    ['falhou para o e-mail antigo', ['antigo'], 'o aviso por e-mail não saiu para o e-mail antigo'],
    ['falhou para a administração', ['gestao'], 'o aviso por e-mail não saiu para a administração'],
    ['falhou para todos', ['antigo', 'gestao'], 'o aviso por e-mail não saiu para o e-mail antigo e a administração'],
    ['não chegou ao fim', undefined, 'o aviso por e-mail não foi confirmado']
  ] as const)('dado um aviso de troca que %s, quando o registro de ações mostra, então diz o que aconteceu', (_caso, falhas, esperado) => {
    // Dado / Quando / Então
    expect(situacaoDoAvisoDaTroca(falhas && [...falhas])).toBe(esperado);
  });

  it.each([
    ['saiu para todos', { aviso_falhas: [] }, 'Aviso enviado'],
    ['falhou para alguém', { aviso_falhas: ['gestao'] }, 'Aviso não saiu'],
    ['não chegou ao fim', {}, 'Aviso sem confirmação'],
    ['de uma troca que o login recusou', { situacao: 'falhou', aviso_falhas: ['antigo'] }, undefined]
  ] as const)('dado um aviso %s, quando a lista de trocas mostra, então o destaque é o esperado', (_caso, resumo, texto) => {
    // Dado / Quando / Então
    expect(seloDoAvisoDaTroca({ ...resumo, aviso_falhas: 'aviso_falhas' in resumo ? [...resumo.aviso_falhas] : undefined })?.texto).toBe(texto);
  });

  it('dado o limite de trocas, quando recusa, então a mensagem diz o limite e que nada mudou', () => {
    // Dado / Quando / Então
    expect(RECUSA_DA_TROCA.limite).toBe(`O escritório chegou ao limite de ${TROCAS_DE_EMAIL_POR_HORA} trocas de e-mail por hora. Nada mudou: tente de novo mais tarde.`);
  });
});
