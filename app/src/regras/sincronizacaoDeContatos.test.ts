// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A sincronização das pessoas com o Google Contatos (#164), em supabase/functions/_compartilhado/, com o Google simulado.
import { describe, expect, it, vi } from 'vitest';
import {
  CAMPOS_DO_CONTATO, contatoDaPessoa, CONTATOS_POR_PAGINA, ESPERAS_DAS_TENTATIVAS, esperaDaTentativa, MARCA_DO_SEMPER, PAGINAS_NO_MAXIMO, primeiraSincronizacao, sincronizarContatos,
  sincronizarTudo, TAMANHO_DO_DETALHE_DO_ERRO, telefoneNoGoogle, tipoDoErro, type EscritorioDaPrimeira, type PassosDaPrimeira, type PassosDaSincronizacao, type PessoaNaFila
} from '../../../supabase/functions/_compartilhado/contatosGoogle';
import { telefoneGoogle } from './contatosGoogle';

const ESCRITORIO = 'e1', OUTRO = 'e2';
const pessoa = (campos: Partial<PessoaNaFila> = {}): PessoaNaFila => ({
  pessoa_id: 'p1', versao: 1, tentativas: 1, escritorio_id: ESCRITORIO, conta_email: 'contato@exemplo.com', recurso: null, etag: null,
  tipo: 'pf', nome: 'Maria José Teste', telefones: ['(38) 99999-1234'], emails: ['Maria@Exemplo.com'], nascimento: '1980-05-17', abertura: null,
  ...campos
});

// ---------------------------------------------------------------------
// O Google simulado: cada pedido passa por "responder", que devolve a resposta (ou lança, como a rede caída).
// ---------------------------------------------------------------------
interface Pedido { url: string; metodo: string; corpo: string; autorizacao: string | null }
const resposta = (status: number, corpo: unknown = {}) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const erroDoGoogle = (status: number, situacao: string) => resposta(status, { error: { code: status, status: situacao } });
const PADRAO = (p: Pedido): Response => {
  if (p.url.startsWith('https://oauth2.googleapis.com/token')) return resposta(200, { access_token: 'acesso-' + new URLSearchParams(p.corpo).get('refresh_token') });
  if (p.url.includes(':createContact')) return resposta(200, { resourceName: 'people/c-novo', etag: 'etag-novo' });
  if (p.url.includes(':updateContact')) return resposta(200, { resourceName: 'people/c1', etag: 'etag-atualizado' });
  return resposta(200, { resourceName: 'people/c1', etag: 'etag-lido' });
};

function google(responder: (p: Pedido, padrao: typeof PADRAO) => Response | Promise<Response> = (p, padrao) => padrao(p)) {
  const pedidos: Pedido[] = [];
  const buscar = vi.fn(async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const p: Pedido = { url: String(entrada), metodo: init.method ?? 'GET', corpo: String(init.body ?? ''), autorizacao: new Headers(init.headers).get('Authorization') };
    pedidos.push(p);
    return responder(p, PADRAO);
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

function passos(fila: PessoaNaFila[], buscar: typeof fetch, extras: Partial<PassosDaSincronizacao> = {}) {
  return {
    pendentes: vi.fn<PassosDaSincronizacao['pendentes']>(async () => fila),
    tokenDeRenovacao: vi.fn<PassosDaSincronizacao['tokenDeRenovacao']>(async e => `renovacao-${e}`),
    concluir: vi.fn<PassosDaSincronizacao['concluir']>(async () => {}),
    falhou: vi.fn<PassosDaSincronizacao['falhou']>(async () => {}),
    buscar, clienteId: 'cliente', clienteSegredo: 'segredo',
    ...extras
  };
}
const doGoogle = (pedidos: Pedido[]) => pedidos.filter(p => p.url.startsWith('https://people.googleapis.com/'));

describe('contatoDaPessoa', () => {
  it('dada uma pessoa física, quando vira contato, então leva o nome em maiúsculas, os telefones, os e-mails e o nascimento, e só isso', () => {
    // Quando
    const contato = contatoDaPessoa(pessoa({ telefones: ['(38) 99999-1234', '38 3222-1111', '38999991234'], emails: ['Maria@Exemplo.com', 'maria@exemplo.com '] }));
    // Então
    expect(contato).toEqual({
      names: [{ givenName: 'MARIA JOSÉ TESTE' }],
      phoneNumbers: [{ value: '+55 38 99999-1234', type: 'mobile' }, { value: '+55 38 3222-1111' }],
      emailAddresses: [{ value: 'maria@exemplo.com' }],
      birthdays: [{ date: { year: 1980, month: 5, day: 17 } }],
      clientData: [{ key: MARCA_DO_SEMPER, value: 'p1' }]
    });
    expect(CAMPOS_DO_CONTATO.split(',').toSorted()).toEqual(Object.keys(contato).toSorted());
  });

  it('dada uma empresa, quando vira contato, então o aniversário é a data de abertura', () => {
    // Quando
    const contato = contatoDaPessoa(pessoa({ tipo: 'pj', nome: 'Exemplo Ltda', nascimento: '1990-01-01', abertura: '2015-03-09' }));
    // Então
    expect(contato.names).toEqual([{ givenName: 'EXEMPLO LTDA' }]);
    expect(contato.birthdays).toEqual([{ date: { year: 2015, month: 3, day: 9 } }]);
  });

  it('dada uma pessoa sem telefone, e-mail nem data, quando vira contato, então as listas vão vazias (e apagam o que havia no Google)', () => {
    // Quando
    const contato = contatoDaPessoa(pessoa({ telefones: null, emails: [], nascimento: null }));
    // Então
    expect([contato.phoneNumbers, contato.emailAddresses, contato.birthdays]).toEqual([[], [], []]);
  });

  it.each(['(38) 99999-1234', '38 3222-1111', '(38) 9999-1234', '(038) 99999-1234', '5538999991234', '99999-1234', '+1 415 555 0100', '+55 (38) 99999-1234', ''])(
    'dado o telefone "%s", quando vai ao Google, então fica igual ao da exportação em CSV', telefone => {
      // Quando
      const noGoogle = telefoneNoGoogle(telefone);
      // Então
      expect(noGoogle).toBe(telefoneGoogle(telefone));
    });
});

describe('tipoDoErro e esperaDaTentativa', () => {
  it.each([
    [400, 'FAILED_PRECONDITION', 'etag'], [404, null, 'sumiu'], [401, null, 'autorizacao'], [403, 'PERMISSION_DENIED', 'autorizacao'],
    [429, 'RESOURCE_EXHAUSTED', 'temporario'], [403, 'RESOURCE_EXHAUSTED', 'temporario'], [503, null, 'temporario'], [400, 'INVALID_ARGUMENT', 'recusado']
  ])('dada a resposta %i %s do Google, quando é classificada, então o erro é "%s"', (status, situacao, esperado) => {
    // Quando / Então
    expect(tipoDoErro(status, situacao)).toBe(esperado);
  });

  it('quando as tentativas falham uma atrás da outra, então a espera cresce até um dia e fica nele', () => {
    // Quando
    const esperas = [1, 2, 3, 4, 5, 6, 7, 50].map(esperaDaTentativa);
    // Então
    expect(esperas).toEqual([...ESPERAS_DAS_TENTATIVAS, ESPERAS_DAS_TENTATIVAS.at(-1), ESPERAS_DAS_TENTATIVAS.at(-1)]);
    expect(ESPERAS_DAS_TENTATIVAS.at(-1)).toBe(24 * 60 * 60);
  });
});

describe('sincronizarContatos', () => {
  it('dada uma pessoa nova na fila, quando sincroniza, então cria o contato com o token renovado e guarda a ligação', async () => {
    // Dado
    const { buscar, pedidos } = google();
    const s = passos([pessoa()], buscar);
    // Quando
    const r = await sincronizarContatos(s, null);
    // Então
    expect(r).toEqual({ sincronizados: 1, falhas: 0 });
    expect(new URLSearchParams(pedidos[0].corpo).get('refresh_token')).toBe('renovacao-e1');
    const [criar] = doGoogle(pedidos);
    expect([criar.metodo, criar.url, criar.autorizacao]).toEqual(['POST', 'https://people.googleapis.com/v1/people:createContact?personFields=metadata', 'Bearer acesso-renovacao-e1']);
    expect(JSON.parse(criar.corpo).names).toEqual([{ givenName: 'MARIA JOSÉ TESTE' }]);
    expect(s.concluir).toHaveBeenCalledWith(pessoa(), 'people/c-novo', 'etag-novo');
  });

  it('dada uma pessoa já ligada a um contato, quando sincroniza, então atualiza o mesmo contato com o etag (não cria outro)', async () => {
    // Dado
    const { buscar, pedidos } = google();
    const p = pessoa({ recurso: 'people/c1', etag: 'etag-1' });
    const s = passos([p], buscar);
    // Quando
    await sincronizarContatos(s, ESCRITORIO);
    // Então
    const [atualizar, ...outros] = doGoogle(pedidos);
    expect(outros).toEqual([]);
    expect(atualizar.metodo).toBe('PATCH');
    expect(atualizar.url).toBe(`https://people.googleapis.com/v1/people/c1:updateContact?updatePersonFields=${CAMPOS_DO_CONTATO}&personFields=metadata`);
    expect(JSON.parse(atualizar.corpo)).toMatchObject({ etag: 'etag-1', resourceName: 'people/c1' });
    expect(s.concluir).toHaveBeenCalledWith(p, 'people/c1', 'etag-atualizado');
  });

  it('dado um contato mexido no Google (etag velho), quando sincroniza, então relê o etag e atualiza de novo', async () => {
    // Dado
    let primeira = true;
    const { buscar, pedidos } = google((p, padrao) => {
      if (p.url.includes(':updateContact') && primeira) { primeira = false; return erroDoGoogle(400, 'FAILED_PRECONDITION'); }
      return padrao(p);
    });
    const s = passos([pessoa({ recurso: 'people/c1', etag: 'etag-velho' })], buscar);
    // Quando
    const r = await sincronizarContatos(s, null);
    // Então
    expect(doGoogle(pedidos).map(p => p.metodo)).toEqual(['PATCH', 'GET', 'PATCH']);
    expect(JSON.parse(doGoogle(pedidos)[2].corpo).etag).toBe('etag-lido');
    expect(r).toEqual({ sincronizados: 1, falhas: 0 });
  });

  it('dado um contato apagado no Google, quando sincroniza, então cria outro e a ligação passa a ser com ele', async () => {
    // Dado
    const { buscar, pedidos } = google((p, padrao) => (p.url.includes(':updateContact') ? erroDoGoogle(404, 'NOT_FOUND') : padrao(p)));
    const p = pessoa({ recurso: 'people/c1', etag: 'etag-1' });
    const s = passos([p], buscar);
    // Quando
    await sincronizarContatos(s, null);
    // Então
    expect(doGoogle(pedidos).map(x => x.metodo)).toEqual(['PATCH', 'POST']);
    expect(s.concluir).toHaveBeenCalledWith(p, 'people/c-novo', 'etag-novo');
  });

  it('dado o Google fora do ar para uma pessoa, quando sincroniza, então ela fica na fila com a espera da tentativa, e a próxima pessoa segue', async () => {
    // Dado
    const { buscar } = google((p, padrao) => (p.url.includes(':createContact') && p.corpo.includes('"p1"') ? erroDoGoogle(503, 'UNAVAILABLE') : padrao(p)));
    const primeira = pessoa({ tentativas: 3 }), segunda = pessoa({ pessoa_id: 'p2' });
    const s = passos([primeira, segunda], buscar);
    // Quando
    const r = await sincronizarContatos(s, null);
    // Então
    expect(r).toEqual({ sincronizados: 1, falhas: 1 });
    expect(s.falhou).toHaveBeenCalledWith(primeira, 'temporario', '503 UNAVAILABLE', esperaDaTentativa(3));
    expect(s.concluir).toHaveBeenCalledWith(segunda, 'people/c-novo', 'etag-novo');
  });

  it('dada a rede fora, quando sincroniza, então a falha é temporária', async () => {
    // Dado
    const { buscar } = google(p => { if (p.url.includes('people.googleapis.com')) throw new TypeError('fetch failed'); return PADRAO(p); });
    const s = passos([pessoa()], buscar);
    // Quando
    await sincronizarContatos(s, null);
    // Então
    expect(s.falhou).toHaveBeenCalledWith(pessoa(), 'temporario', 'sem resposta: fetch failed', esperaDaTentativa(1));
  });

  it('dados que o Google recusa, quando sincroniza, então a falha é de recusa (o administrador vê e corrige o cadastro)', async () => {
    // Dado
    const { buscar } = google((p, padrao) => (p.url.includes(':createContact') ? erroDoGoogle(400, 'INVALID_ARGUMENT') : padrao(p)));
    const s = passos([pessoa()], buscar);
    // Quando
    await sincronizarContatos(s, null);
    // Então
    expect(s.falhou).toHaveBeenCalledWith(pessoa(), 'recusado', '400 INVALID_ARGUMENT', esperaDaTentativa(1));
  });

  it('dados dois escritórios, um com a autorização vencida, quando sincroniza, então cada um usa a própria conta e só o vencido fica parado', async () => {
    // Dado
    const { buscar, pedidos } = google((p, padrao) =>
      (p.url.startsWith('https://oauth2.googleapis.com/token') && p.corpo.includes('renovacao-e1') ? resposta(400, { error: 'invalid_grant' }) : padrao(p)));
    const vencida1 = pessoa(), vencida2 = pessoa({ pessoa_id: 'p2' }), doOutro = pessoa({ pessoa_id: 'p3', escritorio_id: OUTRO, conta_email: 'outro@exemplo.com' });
    const s = passos([vencida1, doOutro, vencida2], buscar);
    // Quando
    const r = await sincronizarContatos(s, null);
    // Então
    expect(r).toEqual({ sincronizados: 1, falhas: 2 });
    expect(s.falhou).toHaveBeenCalledWith(vencida1, 'autorizacao', 'renovação: 400 invalid_grant', esperaDaTentativa(1));
    expect(s.falhou).toHaveBeenCalledWith(vencida2, 'autorizacao', 'renovação: 400 invalid_grant', esperaDaTentativa(1));
    expect(doGoogle(pedidos).map(p => p.autorizacao)).toEqual(['Bearer acesso-renovacao-e2']);
    expect(pedidos.filter(p => p.url.startsWith('https://oauth2.googleapis.com/token'))).toHaveLength(2);
  });

  it('dado um escritório sem token guardado, quando sincroniza, então a falha é de autorização, sem ir ao Google', async () => {
    // Dado
    const { buscar, pedidos } = google();
    const s = passos([pessoa()], buscar, { tokenDeRenovacao: async () => null });
    // Quando
    await sincronizarContatos(s, null);
    // Então
    expect(pedidos).toEqual([]);
    expect(s.falhou).toHaveBeenCalledWith(pessoa(), 'autorizacao', 'sem token de renovação', esperaDaTentativa(1));
  });

  it('quando sincroniza, então pede ao banco no máximo o limite, do escritório pedido', async () => {
    // Dado
    const s = passos([], google().buscar);
    // Quando
    await sincronizarContatos(s, ESCRITORIO, 5);
    // Então
    expect(s.pendentes).toHaveBeenCalledWith(ESCRITORIO, 5);
  });
});

// ---------------------------------------------------------------------
// A primeira sincronização (etapa 2)
// ---------------------------------------------------------------------
describe('primeiraSincronizacao', () => {
  const escritorio = (campos: Partial<EscritorioDaPrimeira> = {}): EscritorioDaPrimeira => ({ escritorio_id: ESCRITORIO, conta_email: 'contato@exemplo.com', tentativas: 1, ...campos });
  const PESSOAS = [
    { id: 'p1', tipo: 'pf' as const, nome: 'MARIA TESTE', telefones: ['38999991234'], emails: [], nascimento: null, abertura: null, recurso: null },
    { id: 'p2', tipo: 'pf' as const, nome: 'JOSE TESTE', telefones: [], emails: [], nascimento: null, abertura: null, recurso: null }
  ];
  /** A conta Google com os contatos em duas páginas. */
  const PAGINAS: Record<string, unknown> = {
    '': { connections: [{ resourceName: 'people/c1', etag: 'e1', names: [{ displayName: 'Maria Teste' }], phoneNumbers: [{ value: '+55 38 99999-1234' }] }], nextPageToken: 'pagina 2' },
    'pagina 2': { connections: [{ resourceName: 'people/c2', etag: 'e2', names: [{ displayName: 'José Teste' }] }] }
  };
  const contaComDuasPaginas = (p: Pedido, padrao: typeof PADRAO) => {
    if (!p.url.includes('/people/me/connections')) return padrao(p);
    return resposta(200, PAGINAS[new URL(p.url).searchParams.get('pageToken') ?? '']);
  };
  function passosDaPrimeira(buscar: typeof fetch, extras: Partial<PassosDaPrimeira> = {}) {
    return {
      ...passos([], buscar),
      primeiras: vi.fn<PassosDaPrimeira['primeiras']>(async () => [escritorio()]),
      pessoasDoEscritorio: vi.fn<PassosDaPrimeira['pessoasDoEscritorio']>(async () => PESSOAS),
      concluirPrimeira: vi.fn<PassosDaPrimeira['concluirPrimeira']>(async (_, c) => ({ ligados: c.ligar.length, para_conferir: c.conferir.length, novos: 0 })),
      primeiraFalhou: vi.fn<PassosDaPrimeira['primeiraFalhou']>(async () => {}),
      primeiraPorFazer: vi.fn<PassosDaPrimeira['primeiraPorFazer']>(async () => false),
      ...extras
    };
  }

  it('dada a conta com contatos em duas páginas, quando faz a primeira, então lê todas as páginas e grava as ligações e as dúvidas, sem escrever no Google', async () => {
    // Dado
    const g = google(contaComDuasPaginas);
    const p = passosDaPrimeira(g.buscar);
    // Quando
    const r = await primeiraSincronizacao(p, escritorio());
    // Então
    const leituras = g.pedidos.filter(x => x.url.includes('/people/me/connections'));
    expect(leituras).toHaveLength(2);
    expect(leituras.every(x => x.metodo === 'GET' && x.autorizacao === `Bearer acesso-renovacao-${ESCRITORIO}`)).toBe(true);
    expect(new URL(leituras[0].url).searchParams.get('pageSize')).toBe(String(CONTATOS_POR_PAGINA));
    expect(new URL(leituras[1].url).searchParams.get('pageToken')).toBe('pagina 2');
    expect(new URL(leituras[0].url).searchParams.get('personFields')).toContain('clientData');
    expect(g.pedidos.filter(x => x.metodo !== 'GET' && x.url.startsWith('https://people.googleapis.com/'))).toEqual([]);
    expect(p.pessoasDoEscritorio).toHaveBeenCalledWith(ESCRITORIO, 'contato@exemplo.com');
    expect(p.concluirPrimeira).toHaveBeenCalledWith(escritorio(), {
      ligar: [{ pessoa_id: 'p1', recurso: 'people/c1', etag: 'e1' }],
      conferir: [expect.objectContaining({ recurso: 'people/c2', motivo: 'so-nome', candidatos: ['p2'] })],
      semCorrespondencia: 0
    });
    expect(r).toEqual({ ligados: 1, para_conferir: 1, novos: 0 });
    expect(p.primeiraFalhou).not.toHaveBeenCalled();
  });

  it('dada a autorização vencida, quando faz a primeira, então nada é gravado e a falha é de autorização', async () => {
    // Dado
    const g = google((x, padrao) => x.url.startsWith('https://oauth2.googleapis.com/token') ? resposta(400, { error: 'invalid_grant' }) : padrao(x));
    const p = passosDaPrimeira(g.buscar);
    // Quando
    const r = await primeiraSincronizacao(p, escritorio({ tentativas: 2 }));
    // Então
    expect(r).toBeNull();
    expect(p.concluirPrimeira).not.toHaveBeenCalled();
    expect(p.primeiraFalhou).toHaveBeenCalledWith(escritorio({ tentativas: 2 }), 'autorizacao', expect.stringContaining('renovação'), esperaDaTentativa(2));
  });

  it('dado o Google fora no meio da leitura, quando faz a primeira, então nada é gravado e ela espera a próxima tentativa', async () => {
    // Dado
    const g = google((x, padrao) => new URL(x.url).searchParams.get('pageToken') ? erroDoGoogle(503, 'UNAVAILABLE') : contaComDuasPaginas(x, padrao));
    const p = passosDaPrimeira(g.buscar);
    // Quando
    await primeiraSincronizacao(p, escritorio());
    // Então
    expect(p.concluirPrimeira).not.toHaveBeenCalled();
    expect(p.primeiraFalhou).toHaveBeenCalledWith(escritorio(), 'temporario', '503 UNAVAILABLE', esperaDaTentativa(1));
  });

  it('dado o banco recusando a gravação, quando faz a primeira, então a falha é interna (do SEMPER, não do Google)', async () => {
    // Dado
    const p = passosDaPrimeira(google(contaComDuasPaginas).buscar, { concluirPrimeira: vi.fn(async () => { throw new Error('O banco recusou'); }) });
    // Quando
    await primeiraSincronizacao(p, escritorio());
    // Então
    expect(p.primeiraFalhou).toHaveBeenCalledWith(escritorio(), 'interno', 'erro: O banco recusou', esperaDaTentativa(1));
  });

  it('dada uma conta com mais contatos do que a leitura aceita, quando faz a primeira, então a falha é uma recusa (não passa sozinha)', async () => {
    // Dado: o Google sempre manda mais uma página
    const g = google((x, padrao) => x.url.includes('/people/me/connections') ? resposta(200, { connections: [], nextPageToken: 'mais' }) : padrao(x));
    const p = passosDaPrimeira(g.buscar);
    // Quando
    await primeiraSincronizacao(p, escritorio());
    // Então
    expect(g.pedidos.filter(x => x.url.includes('/people/me/connections'))).toHaveLength(PAGINAS_NO_MAXIMO);
    expect(p.primeiraFalhou).toHaveBeenCalledWith(escritorio(), 'recusado', expect.stringContaining('contatos na conta'), esperaDaTentativa(1));
  });

  it('dado um erro muito longo, quando a primeira falha, então o detalhe é cortado no tamanho que o banco aceita', async () => {
    // Dado
    const primeiraFalhou = vi.fn<PassosDaPrimeira['primeiraFalhou']>(async () => {});
    const p = passosDaPrimeira(google(contaComDuasPaginas).buscar, { primeiraFalhou,
      concluirPrimeira: vi.fn(async () => { throw new Error('x'.repeat(TAMANHO_DO_DETALHE_DO_ERRO * 2)); }) });
    // Quando
    await primeiraSincronizacao(p, escritorio());
    // Então
    expect(primeiraFalhou.mock.calls[0][2]).toHaveLength(TAMANHO_DO_DETALHE_DO_ERRO);
  });
});

describe('sincronizarTudo', () => {
  it('dada uma primeira por fazer, quando a função roda, então faz a primeira antes da fila e devolve as duas contagens', async () => {
    // Dado
    const ordem: string[] = [];
    const g = google((x, padrao) => x.url.includes('/people/me/connections') ? resposta(200, { connections: [] }) : padrao(x));
    const p = {
      ...passos([pessoa()], g.buscar, { pendentes: vi.fn(async () => { ordem.push('fila'); return [pessoa()]; }) }),
      primeiras: vi.fn(async () => [{ escritorio_id: ESCRITORIO, conta_email: 'contato@exemplo.com', tentativas: 1 }]),
      pessoasDoEscritorio: vi.fn(async () => []),
      concluirPrimeira: vi.fn(async () => { ordem.push('primeira'); return { ligados: 0, para_conferir: 0, novos: 3 }; }),
      primeiraFalhou: vi.fn(async () => {}),
      primeiraPorFazer: vi.fn(async () => false)
    };
    // Quando
    const r = await sincronizarTudo(p, ESCRITORIO);
    // Então
    expect(ordem).toEqual(['primeira', 'fila']);
    expect(p.primeiras).toHaveBeenCalledWith(ESCRITORIO);
    expect(r).toEqual({ sincronizados: 1, falhas: 0, primeira: { ligados: 0, para_conferir: 0, novos: 3 } });
  });

  it('sem primeira por fazer, quando a função roda, então só a fila anda e o resultado não fala da primeira', async () => {
    // Dado
    const p = { ...passos([], google().buscar), primeiras: vi.fn(async () => []), pessoasDoEscritorio: vi.fn(), concluirPrimeira: vi.fn(), primeiraFalhou: vi.fn(),
      primeiraPorFazer: vi.fn(async () => false) };
    // Quando
    const r = await sincronizarTudo(p, null);
    const doEscritorio = await sincronizarTudo(p, ESCRITORIO);
    // Então
    expect(r).toEqual({ sincronizados: 0, falhas: 0 });
    expect(doEscritorio).toEqual({ sincronizados: 0, falhas: 0 });
    expect(p.pessoasDoEscritorio).not.toHaveBeenCalled();
    expect(p.primeiraPorFazer).toHaveBeenCalledTimes(1);
  });

  it('dada a primeira que falha (Google fora) no "Sincronizar agora", quando a função roda, então o resultado diz que ela não terminou', async () => {
    // Dado
    const g = google((x, padrao) => x.url.includes('/people/me/connections') ? erroDoGoogle(503, 'UNAVAILABLE') : padrao(x));
    const p = { ...passos([], g.buscar), primeiras: vi.fn(async () => [{ escritorio_id: ESCRITORIO, conta_email: 'contato@exemplo.com', tentativas: 1 }]),
      pessoasDoEscritorio: vi.fn(), concluirPrimeira: vi.fn(), primeiraFalhou: vi.fn(async () => {}), primeiraPorFazer: vi.fn(async () => true) };
    // Quando
    const r = await sincronizarTudo(p, ESCRITORIO);
    // Então
    expect(p.primeiraFalhou).toHaveBeenCalled();
    expect(p.primeiraPorFazer).toHaveBeenCalledWith(ESCRITORIO);
    expect(r).toEqual({ sincronizados: 0, falhas: 0, primeira_por_fazer: true });
  });

  it('dada a primeira reservada por outra execução, quando o administrador pede "Sincronizar agora", então o resultado diz que ela não terminou', async () => {
    // Dado
    const p = { ...passos([], google().buscar), primeiras: vi.fn(async () => []), pessoasDoEscritorio: vi.fn(), concluirPrimeira: vi.fn(), primeiraFalhou: vi.fn(),
      primeiraPorFazer: vi.fn(async () => true) };
    // Quando
    const r = await sincronizarTudo(p, ESCRITORIO);
    // Então
    expect(r).toEqual({ sincronizados: 0, falhas: 0, primeira_por_fazer: true });
  });
});
