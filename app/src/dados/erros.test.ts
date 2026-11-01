// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { traduzir } from './erros';

describe('Erros do banco em português', () => {
  describe('Dado um registro repetido (código 23505 ou "duplicate key")', () => {
    it.each([
      ['pessoas_documento_unico', 'Já existe um cadastro com este CPF/CNPJ.'],
      ['pessoas_referencia_unica', 'Já existe um cadastro com esta referência de origem (de uma importação).'],
      ['quadro_colunas_nome_unico', 'Já existe uma coluna com esse nome neste quadro.'],
      ['convites_email_pendente', 'Este e-mail já tem um convite pendente.'],
      ['pessoa_vinculos_unico', 'Essas duas pessoas já têm esse vínculo.'],
      ['vinculo_tipos_unico', 'Esse tipo de vínculo já existe.'],
      ['orgaos_sigla_unica', 'Já existe um órgão com essa sigla.'],
      ['quadro_grupos_nome_unico', 'Já existe um grupo com esse nome neste quadro.'],
      ['outra_restricao', 'Esse registro já existe.']
    ])('quando a restrição é %s, então a mensagem é "%s"', (restricao, esperada) => {
      // Quando
      const erro = traduzir({ code: '23505', message: `duplicate key value violates unique constraint "${restricao}"` });
      // Então
      expect(erro.message).toBe(esperada);
    });

    it('quando só a mensagem diz "duplicate key", sem código, então também é registro repetido', () => {
      // Quando
      const erro = traduzir({ message: 'duplicate key value violates unique constraint "pessoas_documento_unico"' });
      // Então
      expect(erro.message).toBe('Já existe um cadastro com este CPF/CNPJ.');
    });
  });

  it.each([
    ['usuário que não pode ser excluído', { code: '23503', message: 'violates foreign key constraint "perfis_pessoa_fkey"' }, 'Esta pessoa é usuária do sistema e não pode ser excluída.'],
    ['pessoa que está em contratos', { code: '23503', message: 'violates foreign key constraint "contratos_cliente_id_fkey"' }, 'Esta pessoa está em contratos e não pode ser excluída.'],
    ['pessoa que participa de contratos', { code: '23503', message: 'violates foreign key constraint "contrato_participantes_pessoa_id_fkey"' }, 'Esta pessoa está em contratos e não pode ser excluída.'],
    ['formato inválido', { code: '23514', message: 'violates check constraint' }, 'Algum campo está em formato inválido. Confira os dados e tente de novo.'],
    ['sem permissão (código)', { code: '42501', message: 'x' }, 'Você não tem permissão para fazer isso.'],
    ['sem permissão (RLS)', { message: 'new row violates row-level security policy' }, 'Você não tem permissão para fazer isso.'],
    ['erro escrito pela função do banco', { code: 'P0001', message: 'Convite já usado.' }, 'Convite já usado.'],
    ['senha errada', { message: 'Invalid login credentials' }, 'E-mail ou senha incorretos.'],
    ['código do autenticador errado', { message: 'Invalid TOTP code entered' }, 'Código incorreto ou vencido. Digite o código que o aplicativo mostra agora.'],
    ['falta o código do autenticador', { message: 'AAL2 required' }, 'Para fazer isso, entre de novo com o código do aplicativo autenticador.'],
    ['e-mail não confirmado', { message: 'Email not confirmed' }, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    ['e-mail já cadastrado', { message: 'User already registered' }, 'Este e-mail já tem conta. Use "Entrar" ou recupere a senha.'],
    ['convite não encontrado', { message: 'Database error saving new user' }, 'Convite não encontrado ou vencido. Use o link mais recente que o escritório enviou para este e-mail, ou peça um novo ao administrador.'],
    ['senha curta', { message: 'Password should be at least 8 characters' }, 'A senha precisa ter pelo menos 8 caracteres.'],
    ['limite de e-mails', { message: 'email rate limit exceeded' }, 'O limite de envio de e-mails foi atingido. Aguarde cerca de uma hora e tente de novo.'],
    ['sem internet', { message: 'TypeError: Failed to fetch' }, 'Sem conexão com o servidor. Verifique a internet e tente de novo.'],
    ['sessão vencida', { message: 'JWT expired' }, 'Sua sessão expirou. Entre de novo.'],
    ['qualquer outro', { message: 'algo inesperado' }, 'Não foi possível concluir agora. Tente de novo.']
  ])('quando o erro é de %s, então a mensagem é a certa', (_caso, erroDoBanco, esperada) => {
    // Quando
    const erro = traduzir(erroDoBanco);
    // Então
    expect(erro.message).toBe(esperada);
  });

  it('quando o código diz uma coisa e a mensagem outra, então vale a primeira regra da lista', () => {
    // Quando: código de formato inválido (23514), com texto de senha errada
    const erro = traduzir({ code: '23514', message: 'Invalid login credentials' });
    // Então
    expect(erro.message).toBe('Algum campo está em formato inválido. Confira os dados e tente de novo.');
  });

  it('quando o erro é traduzido, então o original continua guardado para investigar', () => {
    // Dado
    const original = { code: '42501', message: 'permission denied for table pessoas' };
    // Quando
    const erro = traduzir(original) as Error & { original: unknown };
    // Então
    expect(erro.original).toBe(original);
  });

  it.each([[null], [undefined], ['texto solto']])('quando o erro vem num formato inesperado (%j), então ainda há uma mensagem', estranho => {
    // Quando
    const erro = traduzir(estranho);
    // Então
    expect(erro.message).toBe('Não foi possível concluir agora. Tente de novo.');
  });
});
