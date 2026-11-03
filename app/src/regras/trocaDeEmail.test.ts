// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As partes puras da função do servidor que troca o e-mail pelo administrador (#222), em supabase/functions/_compartilhado/.
import { describe, expect, it, vi } from 'vitest';
import { conferirPedido, senhaDescartavel, trocarEmailDaEquipe, type PassosDaTroca, type Preparo } from '../../../supabase/functions/_compartilhado/trocaDeEmail';
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';

/** O login guarda a senha com bcrypt, que só aceita até 72 bytes. */
const LIMITE_DE_SENHA_DO_LOGIN = 72;

const PERFIL = '00000000-0000-4000-8000-000000000001';
const PEDIDO = { perfil: PERFIL, email: 'nova@exemplo.com' };

function passos(preparo: Preparo | undefined, trocarNoLogin: PassosDaTroca['trocarNoLogin'] = async () => 'trocado') {
  return { preparar: vi.fn(async () => preparo), trocarNoLogin: vi.fn(trocarNoLogin), marcarFalha: vi.fn(async () => {}), avisar: vi.fn(async () => {}) };
}
const PRONTO: Preparo = { resultado: 'pronto', registro: 7 };

describe('conferirPedido', () => {
  it('dado um pedido certo, quando confere, então devolve o e-mail normalizado', () => {
    // Quando / Então
    expect(conferirPedido({ perfil: PERFIL, email: ' Nova@Exemplo.COM ' })).toEqual(PEDIDO);
  });

  it.each([
    ['sem corpo', null],
    ['sem e-mail', { perfil: PERFIL }],
    ['e-mail vazio', { perfil: PERFIL, email: '' }],
    ['e-mail que não é texto', { perfil: PERFIL, email: ['a@b.com'] }],
    ['e-mail grande demais', { perfil: PERFIL, email: 'a'.repeat(TAMANHO_EMAIL_DE_ACESSO + 1) }],
    ['sem pessoa', { email: 'a@b.com' }],
    ['pessoa que não é um código', { perfil: "1' or '1'='1", email: 'a@b.com' }],
    ['pessoa com caminho no meio', { perfil: `${PERFIL}/factors`, email: 'a@b.com' }]
  ])('dado um pedido %s, quando confere, então recusa', (_caso, corpo) => {
    // Quando / Então
    expect(conferirPedido(corpo)).toBeNull();
  });
});

describe('senhaDescartavel', () => {
  it('quando gera a senha, então ela cabe no limite do login e tem letras, números e símbolo', () => {
    // Quando
    const senha = senhaDescartavel();
    // Então
    expect(senha.length).toBeLessThanOrEqual(LIMITE_DE_SENHA_DO_LOGIN);
    expect(senha).toMatch(/[a-z]/);
    expect(senha).toMatch(/[A-Z]/);
    expect(senha).toMatch(/[0-9]/);
    expect(senha).toMatch(/[^a-zA-Z0-9]/);
  });

  it('quando gera duas senhas, então elas são diferentes', () => {
    // Quando / Então
    expect(senhaDescartavel()).not.toBe(senhaDescartavel());
  });
});

describe('trocarEmailDaEquipe', () => {
  it('dado que o banco autoriza, quando o login troca, então o resultado é trocado e o registro fica como está', async () => {
    // Dado
    const p = passos(PRONTO);
    // Quando
    const resultado = await trocarEmailDaEquipe(PEDIDO, p);
    // Então
    expect(resultado).toBe('trocado');
    expect(p.trocarNoLogin).toHaveBeenCalledWith(PERFIL, 'nova@exemplo.com');
    expect(p.marcarFalha).not.toHaveBeenCalled();
  });

  it('dado que o login troca, quando termina, então o aviso sai depois da troca, com o registro dela', async () => {
    // Dado
    const p = passos(PRONTO);
    // Quando
    await trocarEmailDaEquipe(PEDIDO, p);
    // Então
    expect(p.avisar).toHaveBeenCalledWith(7, 'trocada');
    expect(p.trocarNoLogin.mock.invocationCallOrder[0]).toBeLessThan(p.avisar.mock.invocationCallOrder[0]);
  });

  it.each(['sem-permissao', 'so-o-master', 'email-invalido', 'email-em-uso', 'convite-pendente', 'limite'] as const)('dado que o banco responde %s, quando pede a troca, então o login nem é chamado', async recusa => {
    // Dado
    const p = passos({ resultado: recusa, registro: null });
    // Quando
    const resultado = await trocarEmailDaEquipe(PEDIDO, p);
    // Então
    expect(resultado).toBe(recusa);
    expect(p.trocarNoLogin).not.toHaveBeenCalled();
    expect(p.avisar).not.toHaveBeenCalled();
  });

  it('dado que o banco não responde nenhuma linha, quando pede a troca, então recusa sem chamar o login', async () => {
    // Dado
    const p = passos(undefined);
    // Quando
    const resultado = await trocarEmailDaEquipe(PEDIDO, p);
    // Então
    expect(resultado).toBe('sem-permissao');
    expect(p.trocarNoLogin).not.toHaveBeenCalled();
  });

  it('dado que o banco não registrou a ação, quando pede a troca, então não troca sem registro', async () => {
    // Dado
    const p = passos({ resultado: 'pronto', registro: null });
    // Quando
    const resultado = await trocarEmailDaEquipe(PEDIDO, p);
    // Então
    expect(resultado).toBe('erro');
    expect(p.trocarNoLogin).not.toHaveBeenCalled();
  });

  it.each([['recusado', 'erro'], ['email-em-uso', 'email-em-uso']] as const)('dado que o login responde %s, quando pede a troca, então o registro passa a dizer que falhou', async (resposta, esperado) => {
    // Dado
    const p = passos(PRONTO, async () => resposta);
    // Quando
    const resultado = await trocarEmailDaEquipe(PEDIDO, p);
    // Então
    expect(resultado).toBe(esperado);
    expect(p.marcarFalha).toHaveBeenCalledWith(7);
    expect(p.avisar).not.toHaveBeenCalled();
  });

  it('dado que o login falha sem resposta certa, quando pede a troca, então o registro continua dizendo que houve a troca', async () => {
    // Dado
    const p = passos(PRONTO, async () => { throw new Error('sem resposta'); });
    // Quando / Então
    await expect(trocarEmailDaEquipe(PEDIDO, p)).rejects.toThrow('sem resposta');
    expect(p.marcarFalha).not.toHaveBeenCalled();
  });

  it('dado que o login falha sem resposta certa, quando pede a troca, então o aviso sai dizendo que ela não foi confirmada', async () => {
    // Dado
    const p = passos(PRONTO, async () => { throw new Error('sem resposta'); });
    // Quando / Então
    await expect(trocarEmailDaEquipe(PEDIDO, p)).rejects.toThrow('sem resposta');
    expect(p.avisar).toHaveBeenCalledWith(7, 'nao-confirmada');
  });
});
