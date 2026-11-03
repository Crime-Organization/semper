// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O aviso por e-mail da troca de e-mail pelo administrador (#224), em supabase/functions/_compartilhado/.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avisarDaTroca, mensagensDoAviso, type DadosDoAviso, type MensagemDoAviso, type PassosDoAviso } from '../../../supabase/functions/_compartilhado/avisoDaTroca';

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
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, []);
  });

  it.each([
    ['o e-mail antigo', ['bruno@exemplo.com'], ['antigo']],
    ['uma pessoa da administração', ['carla@exemplo.com'], ['gestao']],
    ['duas pessoas da administração', ['carla@exemplo.com', 'mateus@exemplo.com'], ['gestao']],
    ['todos', ['bruno@exemplo.com', 'carla@exemplo.com', 'mateus@exemplo.com'], ['antigo', 'gestao']]
  ])('dado que o envio falha para %s, quando avisa, então os outros recebem e o registro diz para quem não saiu', async (_caso, enderecos, falhas) => {
    // Dado
    const p = passos({ enviar: vi.fn(falharPara(...enderecos)) });
    // Quando
    await avisarDaTroca(REGISTRO, 'trocada', p);
    // Então
    expect(p.enviar).toHaveBeenCalledTimes(3);
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, falhas);
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
    expect(p.registrar).toHaveBeenCalledWith(REGISTRO, ['antigo', 'gestao']);
  });

  it('dado que o banco falha ao registrar o resultado, quando avisa, então nenhum erro sobe', async () => {
    // Dado
    const p = passos({ registrar: vi.fn(async () => { throw new Error('banco fora do ar'); }) });
    // Quando / Então
    await expect(avisarDaTroca(REGISTRO, 'trocada', p)).resolves.toBeUndefined();
    expect(p.enviar).toHaveBeenCalledTimes(3);
  });
});
