// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { ASSUNTO_DO_PEDIDO, conversaDoPedido, levaParaEntrada, mensagemDoPedido } from './paginaPublica';

describe('Página pública: quem vai para a entrada', () => {
  it.each([
    ['?primeiro-acesso', ''],
    ['?token_hash=abc&type=invite', ''],
    ['?nova-senha', ''],
    ['?recuperar', ''],
    ['?volta=%2Fpessoas%2F', ''],
    ['?desativado', ''],
    ['?encerrada', ''],
    ['?cliente', ''],
    ['', '#access_token=abc&type=invite'],
    ['', '#convite=123'],
    ['', '#error_description=Link+expirado']
  ])('dado o endereço "%s%s" de um link do sistema, quando a página abre, então vai para a entrada', (busca, ancora) => {
    // Quando / Então
    expect(levaParaEntrada(busca, ancora)).toBe(true);
  });

  it.each([
    ['', ''],
    ['', '#modulos'],
    ['?utm_source=busca', ''],
    ['?quero=demonstracao', '#perguntas']
  ])('dado o endereço "%s%s" de quem só visita, quando a página abre, então fica na página pública', (busca, ancora) => {
    // Quando / Então
    expect(levaParaEntrada(busca, ancora)).toBe(false);
  });
});

describe('Página pública: o pedido de demonstração', () => {
  it('dado o nome do escritório e o tamanho da equipe, quando monta a mensagem, então leva os dois', () => {
    // Quando
    const texto = mensagemDoPedido('  Silva &   Souza Advogados ', 'mais de 5 pessoas');
    // Então
    expect(texto).toBe('Olá! Quero uma demonstração do SEMPER para o escritório Silva & Souza Advogados (equipe de mais de 5 pessoas).');
  });

  it('dado só o nome do escritório, quando monta a mensagem, então não fala da equipe', () => {
    // Quando / Então
    expect(mensagemDoPedido('Núcleo de Inovação Exemplo')).toBe('Olá! Quero uma demonstração do SEMPER para o escritório Núcleo de Inovação Exemplo.');
  });

  it('dado o nome em branco, quando monta a mensagem, então não deixa um nome vazio no texto', () => {
    // Quando / Então
    expect(mensagemDoPedido('   ')).toBe('Olá! Quero uma demonstração do SEMPER para o meu escritório.');
  });

  it('dado o WhatsApp vazio, quando abre a conversa, então é um e-mail com o assunto e a mensagem, na mesma aba', () => {
    // Dado
    const mensagem = mensagemDoPedido('Marcas & Patentes Exemplo', 'até 5 pessoas');
    // Quando
    const conversa = conversaDoPedido({ whatsapp: '', email: 'contato@exemplo.test' }, mensagem);
    // Então
    expect(conversa.canal).toBe('e-mail');
    expect(conversa.novaAba).toBe(false);
    const endereco = new URL(conversa.endereco);
    expect(endereco.protocol).toBe('mailto:');
    expect(endereco.pathname).toBe('contato@exemplo.test');
    expect(endereco.searchParams.get('subject')).toBe(ASSUNTO_DO_PEDIDO);
    expect(endereco.searchParams.get('body')).toBe(mensagem);
  });

  it('dado o WhatsApp preenchido com pontuação, quando abre a conversa, então é o WhatsApp, só com os algarismos, numa aba nova', () => {
    // Quando
    const conversa = conversaDoPedido({ whatsapp: '+55 (38) 99999-0000', email: 'contato@exemplo.test' }, 'Olá!');
    // Então
    expect(conversa).toEqual({ endereco: 'https://wa.me/5538999990000?text=Ol%C3%A1!', novaAba: true, canal: 'WhatsApp' });
  });
});
