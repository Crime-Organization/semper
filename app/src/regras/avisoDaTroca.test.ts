// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O aviso por e-mail da troca de e-mail pelo administrador (#224), em supabase/functions/_compartilhado/.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avisarDaTroca, mensagensDoAviso, reenviarAvisos, senhaDaRotinaConfere, type DadosDoAviso, type MensagemDoAviso, type PassosDoAviso } from '../../../supabase/functions/_compartilhado/avisoDaTroca';

const EMAIL_NOVO = 'nova@exemplo.com';
const DADOS: DadosDoAviso = {
  escritorio: 'Escritório Exemplo', alvo: 'Bruno Souza', autor: 'Ana Lima', autor_email: 'ana@exemplo.com', em: '2026-11-03T17:30:00Z',
  email_antigo: 'bruno@exemplo.com', gestao: ['mateus@exemplo.com', 'carla@exemplo.com']
};
const REGISTRO = 7;

function passos(extras: Partial<PassosDoAviso> = {}) {
  return {
    dados: vi.fn<PassosDoAviso['dados']>(async () => DADOS),
    enviar: vi.fn<PassosDoAviso['enviar']>(async () => {}),
    registrar: vi.fn<PassosDoAviso['registrar']>(async () => {}),
    ...extras
  };
}
const falharPara = (...enderecos: string[]) => async ({ para }: MensagemDoAviso) => {
  if (enderecos.includes(para)) throw Object.assign(new Error(`recusou ${para}`), { code: 'EENVELOPE' });
};

describe('mensagensDoAviso', () => {
  it('dada uma troca, quando monta o aviso, então vai uma mensagem para o e-mail antigo e uma para cada pessoa da administração', () => {
    // Quando
    const mensagens = mensagensDoAviso(DADOS, 'trocada');
    // Então
    expect(mensagens.map(m => [m.destino, m.para])).toEqual([
      ['antigo', 'bruno@exemplo.com'], ['gestao', 'mateus@exemplo.com'], ['gestao', 'carla@exemplo.com']
    ]);
  });

  it('dada uma troca, quando monta o aviso, então ele diz quem trocou, de quem, em qual escritório e quando, no horário de Brasília', () => {
    // Quando
    const [antigo, gestao] = mensagensDoAviso(DADOS, 'trocada');
    // Então
    for (const m of [antigo, gestao]) {
      expect(m.texto).toContain('Ana Lima (ana@exemplo.com), do escritório Escritório Exemplo, trocou o e-mail de acesso');
      expect(m.texto).toContain('3 de novembro de 2026');
      expect(m.texto).toContain('14:30 (horário de Brasília)');
    }
    expect(antigo.texto).toContain('da sua conta no SEMPER');
    expect(gestao.texto).toContain('de Bruno Souza no SEMPER');
  });

  it('dada uma troca concluída, quando monta o aviso, então ele diz que a senha antiga deixou de valer e como criar outra', () => {
    // Quando
    const mensagens = mensagensDoAviso(DADOS, 'trocada');
    // Então
    for (const m of mensagens) {
      expect(m.texto).toContain('senha antiga');
      expect(m.texto).toContain('cria uma senha nova em "Esqueci minha senha", com o e-mail novo');
    }
  });

  it('dada uma troca não confirmada, quando monta o aviso, então não afirma que a senha já mudou', () => {
    // Quando
    const mensagens = mensagensDoAviso(DADOS, 'nao-confirmada');
    // Então
    for (const m of mensagens) {
      expect(m.texto).toContain('Se a troca foi concluída');
      expect(m.texto).not.toContain('A senha antiga deixou de valer');
    }
  });

  it.each(['trocada', 'nao-confirmada'] as const)('dada uma troca %s, quando monta o aviso, então não promete que os aparelhos foram desconectados e diz até quando o acesso pode durar', situacao => {
    // Quando
    const mensagens = mensagensDoAviso(DADOS, situacao);
    // Então
    for (const m of mensagens) {
      expect(m.texto).not.toContain('desconectados');
      expect(m.texto).toContain('pode continuar usando o sistema até ele vencer');
    }
  });

  it.each(['trocada', 'nao-confirmada'] as const)('dada uma troca %s, quando monta o aviso, então só a administração recebe a orientação de desativar o acesso', situacao => {
    // Quando
    const [antigo, ...gestao] = mensagensDoAviso(DADOS, situacao);
    // Então
    for (const m of gestao) {
      expect(m.texto).toContain('desative nessa mesma tela o acesso da pessoa e, se a suspeita for da conta de quem fez a troca, o dessa conta também');
      expect(m.texto).toContain('desativar corta o acesso na hora');
    }
    expect(antigo.texto).not.toContain('desative');
  });

  it('dado o banco devolvendo um e-mail novo por engano, quando monta o aviso, então nenhuma mensagem o mostra', () => {
    // Dado
    const dados = { ...DADOS, email_novo: EMAIL_NOVO };
    // Quando
    const mensagens = mensagensDoAviso(dados, 'trocada');
    // Então
    for (const m of mensagens) expect(JSON.stringify(m)).not.toContain(EMAIL_NOVO);
  });

  it('dada uma troca que o login não confirmou, quando monta o aviso, então ele diz que foi pedida e não foi confirmada', () => {
    // Quando
    const mensagens = mensagensDoAviso(DADOS, 'nao-confirmada');
    // Então
    for (const m of mensagens) {
      expect(m.texto).toContain('pediu a troca do e-mail de acesso');
      expect(m.texto).toContain('O sistema não confirmou se ela foi concluída.');
      expect(m.texto).not.toContain('trocou');
    }
  });

  it('dado um nome com marcação, quando monta o aviso, então o HTML mostra o nome como texto', () => {
    // Dado
    const dados = { ...DADOS, autor: '<a href="https://golpe.exemplo">Clique</a>' };
    // Quando
    const [mensagem] = mensagensDoAviso(dados, 'trocada');
    // Então
    expect(mensagem.html).not.toContain('<a href');
    expect(mensagem.html).toContain('&lt;a href=&quot;https://golpe.exemplo&quot;&gt;');
  });

  it('dado um escritório sem mais ninguém na administração, quando monta o aviso, então só o e-mail antigo recebe', () => {
    // Quando
    const mensagens = mensagensDoAviso({ ...DADOS, gestao: [] }, 'trocada');
    // Então
    expect(mensagens.map(m => m.para)).toEqual(['bruno@exemplo.com']);
  });
});

describe('avisarDaTroca', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('dado que tudo sai, quando avisa, então envia para todos e registra que não houve falha', async () => {
    // Dado
    const p = passos();
    // Quando
    await avisarDaTroca(REGISTRO, 'trocada', p);
    // Então
    expect(p.dados).toHaveBeenCalledWith(REGISTRO);
    expect(p.enviar).toHaveBeenCalledTimes(3);
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, [], []);
  });

  it.each([
    ['o e-mail antigo', ['bruno@exemplo.com'], ['antigo'], []],
    ['uma pessoa da administração', ['carla@exemplo.com'], ['gestao'], ['carla@exemplo.com']],
    ['duas pessoas da administração', ['carla@exemplo.com', 'mateus@exemplo.com'], ['gestao'], ['mateus@exemplo.com', 'carla@exemplo.com']],
    ['todos', ['bruno@exemplo.com', 'carla@exemplo.com', 'mateus@exemplo.com'], ['antigo', 'gestao'], ['mateus@exemplo.com', 'carla@exemplo.com']]
  ])('dado que o envio falha para %s, quando avisa, então os outros recebem e o registro diz para quem não saiu', async (_caso, enderecos, falhas, gestaoSemAviso) => {
    // Dado
    const p = passos({ enviar: vi.fn(falharPara(...enderecos)) });
    // Quando
    await avisarDaTroca(REGISTRO, 'trocada', p);
    // Então
    expect(p.enviar).toHaveBeenCalledTimes(3);
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, falhas, gestaoSemAviso);
  });

  it('dado um erro de envio, quando avisa, então o registro do servidor leva só o código, sem o endereço', async () => {
    // Dado
    const p = passos({ enviar: vi.fn(falharPara('bruno@exemplo.com')) });
    // Quando
    await avisarDaTroca(REGISTRO, 'trocada', p);
    // Então
    expect(console.error).toHaveBeenCalledWith('aviso da troca de e-mail', 'envio', 'EENVELOPE');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('bruno@exemplo.com');
  });

  it.each([
    ['falha', async () => { throw new Error('banco fora do ar'); }],
    ['não acha o registro', async () => null]
  ])('dado que o banco %s ao buscar os dados, quando avisa, então nada é enviado, o registro diz que não saiu e nenhum erro sobe', async (_caso, dados) => {
    // Dado
    const p = passos({ dados: vi.fn(dados) });
    // Quando
    await avisarDaTroca(REGISTRO, 'trocada', p);
    // Então
    expect(p.enviar).not.toHaveBeenCalled();
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, ['antigo', 'gestao'], null);
  });

  it('dado que o banco falha ao registrar o resultado, quando avisa, então nenhum erro sobe', async () => {
    // Dado
    const p = passos({ registrar: vi.fn(async () => { throw new Error('banco fora do ar'); }) });
    // Quando / Então
    await expect(avisarDaTroca(REGISTRO, 'trocada', p)).resolves.toBeUndefined();
    expect(p.enviar).toHaveBeenCalledTimes(3);
  });
});

describe('reenviarAvisos', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('dada uma falha só para o e-mail antigo, quando reenvia, então a administração não recebe de novo', async () => {
    // Dado
    const p = passos();
    // Quando
    const reenviados = await reenviarAvisos([{ registro: REGISTRO, situacao: 'trocada', destinos: ['antigo'] }], p);
    // Então
    expect(reenviados).toBe(1);
    expect(vi.mocked(p.enviar).mock.calls.map(([m]) => m.para)).toEqual(['bruno@exemplo.com']);
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, [], []);
  });

  it('dada uma falha só para a administração, quando reenvia e falha de novo para uma pessoa, então o registro continua apontando a administração', async () => {
    // Dado
    const p = passos({ enviar: vi.fn(falharPara('carla@exemplo.com')) });
    // Quando
    await reenviarAvisos([{ registro: REGISTRO, situacao: 'trocada', destinos: ['gestao'] }], p);
    // Então
    expect(p.enviar).toHaveBeenCalledTimes(2);
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, ['gestao'], ['carla@exemplo.com']);
  });

  it('dado que a troca não aconteceu de fato, quando reenvia, então o aviso diz que ela não foi confirmada', async () => {
    // Dado
    const p = passos();
    // Quando
    await reenviarAvisos([{ registro: REGISTRO, situacao: 'nao-confirmada', destinos: ['antigo', 'gestao'] }], p);
    // Então
    for (const [m] of vi.mocked(p.enviar).mock.calls) expect(m.texto).toContain('O sistema não confirmou se ela foi concluída.');
  });

  it('dados vários avisos, quando um falha ao buscar os dados, então os outros seguem e cada um tem o próprio resultado', async () => {
    // Dado
    const p = passos({ dados: vi.fn(async registro => { if (registro === 1) throw new Error('banco fora do ar'); return DADOS; }) });
    // Quando
    await reenviarAvisos([
      { registro: 1, situacao: 'trocada', destinos: ['gestao'] },
      { registro: 2, situacao: 'trocada', destinos: ['antigo'] }
    ], p);
    // Então
    expect(p.registrar).toHaveBeenCalledWith(1, ['gestao'], null);
    expect(p.registrar).toHaveBeenCalledWith(2, [], []);
  });

  it('dado que não há nada pendente, quando reenvia, então nada é enviado', async () => {
    // Dado
    const p = passos();
    // Quando
    const reenviados = await reenviarAvisos([], p);
    // Então
    expect(reenviados).toBe(0);
    expect(p.enviar).not.toHaveBeenCalled();
  });
});

describe('senhaDaRotinaConfere', () => {
  it.each([
    ['a senha certa', 'senha-da-rotina', 'senha-da-rotina', true],
    ['outra senha', 'senha-errada-aqui', 'senha-da-rotina', false],
    ['só o começo da senha', 'senha', 'senha-da-rotina', false],
    ['a senha com algo a mais', 'senha-da-rotina-e-mais', 'senha-da-rotina', false],
    ['nenhuma senha', null, 'senha-da-rotina', false],
    ['senha vazia', '', 'senha-da-rotina', false],
    ['uma senha, sem o segredo no servidor', 'qualquer', undefined, false],
    ['nada, sem o segredo no servidor', null, undefined, false]
  ])('dado um pedido com %s, quando confere, então a resposta é a esperada', (_caso, recebida, certa, esperado) => {
    // Quando / Então
    expect(senhaDaRotinaConfere(recebida, certa)).toBe(esperado);
  });
});
