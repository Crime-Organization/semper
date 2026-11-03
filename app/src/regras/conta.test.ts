// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import { erroDoNovoEmail, normalizarEmail } from './conta';

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
    ['longo demais', 'a'.repeat(TAMANHO_EMAIL_DE_ACESSO) + '@exemplo.com', 'Informe um e-mail válido.'],
    ['igual ao atual, com outras maiúsculas e espaços', ' pessoa@exemplo.COM ', 'Este já é o seu e-mail de acesso.']
  ])('dado um e-mail %s, quando confere, então diz o que corrigir', (_caso, novo, mensagem) => {
    // Dado / Quando / Então
    expect(erroDoNovoEmail(novo, ATUAL)).toBe(mensagem);
  });

  it('dado um e-mail com espaços e maiúsculas, quando normaliza, então fica como a conta guarda', () => {
    // Dado / Quando / Então
    expect(normalizarEmail('  Nova@Exemplo.COM ')).toBe('nova@exemplo.com');
  });
});
