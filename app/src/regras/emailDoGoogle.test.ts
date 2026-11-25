// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O e-mail do Google de cada pessoa da equipe (#166): quem pode mudar, o que vale e o que se grava.
import { describe, expect, it } from 'vitest';
import type { Papel } from '../dados/tipos';
import { emailDoGoogleParaGravar, erroDoEmailDoGoogle, RECUSA_DO_EMAIL_DO_GOOGLE, recusaDoEmailDoGoogle } from './emailDoGoogle';

const pessoa = (id: string, papel: Papel) => ({ id, papel });

describe('E-mail do Google', () => {
  it.each([
    ['a própria pessoa (usuário)', pessoa('beto', 'usuario'), pessoa('beto', 'usuario'), null],
    ['o próprio master', pessoa('ana', 'master'), pessoa('ana', 'master'), null],
    ['um usuário, pelo administrador', pessoa('beto', 'usuario'), pessoa('caio', 'admin'), null],
    ['um administrador, pelo master', pessoa('caio', 'admin'), pessoa('ana', 'master'), null],
    ['um usuário, por outro usuário', pessoa('beto', 'usuario'), pessoa('dani', 'usuario'), RECUSA_DO_EMAIL_DO_GOOGLE.naoAdmin],
    ['um administrador, por outro administrador', pessoa('caio', 'admin'), pessoa('eva', 'admin'), RECUSA_DO_EMAIL_DO_GOOGLE.admin],
    ['o master, por um administrador', pessoa('ana', 'master'), pessoa('caio', 'admin'), RECUSA_DO_EMAIL_DO_GOOGLE.master]
  ])('quando o e-mail do Google de %s é mudado, então a recusa é %s', (_caso, alvo, eu, recusa) => {
    // Quando / Então
    expect(recusaDoEmailDoGoogle(alvo, eu)).toBe(recusa);
  });

  it.each([
    ['vazio (volta ao de entrada)', '  ', null],
    ['um Gmail', 'Fulano.Pessoal@gmail.com', null],
    ['sem arroba', 'fulano', RECUSA_DO_EMAIL_DO_GOOGLE.invalido],
    ['sem domínio com ponto', 'fulano@exemplo', RECUSA_DO_EMAIL_DO_GOOGLE.invalido],
    ['longo demais', 'a'.repeat(250) + '@x.com', RECUSA_DO_EMAIL_DO_GOOGLE.invalido]
  ])('quando o e-mail digitado é %s, então o problema é %s', (_caso, digitado, problema) => {
    // Quando / Então
    expect(erroDoEmailDoGoogle(digitado)).toBe(problema);
  });

  it('quando o e-mail é gravado, então vai em minúsculas; vazio, ou igual ao de entrada, não se grava (vale o de entrada)', () => {
    // Quando / Então
    expect(emailDoGoogleParaGravar(' Fulano@Gmail.com ', 'fulano@escritorio.com')).toBe('fulano@gmail.com');
    expect(emailDoGoogleParaGravar('', 'fulano@escritorio.com')).toBeNull();
    expect(emailDoGoogleParaGravar('FULANO@escritorio.com', 'fulano@escritorio.com')).toBeNull();
    expect(emailDoGoogleParaGravar('fulano@gmail.com', null)).toBe('fulano@gmail.com');
  });
});
