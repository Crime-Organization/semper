// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consultarCEP, consultarCNPJ } from './consultas';

// Respostas simuladas da internet: nenhum teste fala com a Receita, a BrasilAPI ou o ViaCEP.
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const rede = vi.fn<typeof fetch>();
beforeEach(() => { rede.mockReset(); vi.stubGlobal('fetch', rede); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('Consultar CNPJ na Receita', () => {
  it('quando a Receita encontra o CNPJ, então os dados viram campos do cadastro', async () => {
    // Dado
    rede.mockResolvedValue(resposta({ razao_social: 'Padaria Exemplo Ltda', estabelecimento: { cidade: { nome: 'Montes Claros' }, estado: { sigla: 'MG' } } }));
    // Quando
    const dados = await consultarCNPJ('11.222.333/0001-81');
    // Então
    expect(rede).toHaveBeenCalledWith('https://publica.cnpj.ws/cnpj/11222333000181');
    expect(dados).toMatchObject({ nome: 'PADARIA EXEMPLO LTDA', municipio: 'Montes Claros', uf: 'MG' });
  });

  it.each([
    ['a Receita não encontra o CNPJ', resposta({}, 404), 'CNPJ não encontrado na Receita.'],
    ['há consultas demais seguidas', resposta({}, 429), 'Muitas consultas seguidas. Aguarde um minuto e tente de novo.'],
    ['a Receita está fora do ar', resposta({}, 500), 'Não foi possível consultar o CNPJ agora.'],
    ['a resposta vem sem razão social', resposta({}), 'CNPJ não encontrado na Receita.']
  ])('quando %s, então o erro é "%s"', async (_situacao, respostaDaRede, erro) => {
    // Dado
    rede.mockResolvedValue(respostaDaRede);
    // Quando
    const consulta = consultarCNPJ('11222333000181');
    // Então
    await expect(consulta).rejects.toThrow(erro);
  });
});

describe('Consultar CEP', () => {
  it('quando o CEP não tem 8 dígitos, então nem consulta e avisa', async () => {
    // Quando
    const consulta = consultarCEP('3940');
    // Então
    await expect(consulta).rejects.toThrow('O CEP tem 8 dígitos.');
    expect(rede).not.toHaveBeenCalled();
  });

  it('quando a BrasilAPI encontra o CEP, então o endereço vem dela', async () => {
    // Dado
    rede.mockResolvedValue(resposta({ street: 'Rua das Flores', neighborhood: 'Centro', city: 'Montes Claros', state: 'MG' }));
    // Quando
    const endereco = await consultarCEP('39400-121');
    // Então
    expect(rede).toHaveBeenCalledWith('https://brasilapi.com.br/api/cep/v2/39400121');
    expect(endereco).toEqual({ logradouro: 'Rua das Flores', bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG' });
  });

  it.each([
    ['responde com erro', () => rede.mockResolvedValueOnce(resposta({}, 500))],
    ['está fora do ar', () => rede.mockRejectedValueOnce(new TypeError('Failed to fetch'))]
  ])('quando a BrasilAPI %s, então o endereço vem do ViaCEP', async (_situacao, falharBrasilAPI) => {
    // Dado
    falharBrasilAPI();
    rede.mockResolvedValueOnce(resposta({ logradouro: 'Rua das Flores', bairro: 'Centro', localidade: 'Montes Claros', uf: 'MG' }));
    // Quando
    const endereco = await consultarCEP('39400121');
    // Então
    expect(rede).toHaveBeenLastCalledWith('https://viacep.com.br/ws/39400121/json/');
    expect(endereco).toEqual({ logradouro: 'Rua das Flores', bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG' });
  });

  it('quando nenhum dos dois encontra o CEP, então pede para conferir ou preencher à mão', async () => {
    // Dado
    rede.mockResolvedValueOnce(resposta({}, 404)).mockResolvedValueOnce(resposta({ erro: true }));
    // Quando
    const consulta = consultarCEP('00000000');
    // Então
    await expect(consulta).rejects.toThrow('CEP não encontrado. Confira o número ou preencha manualmente.');
  });

  it('quando os dois estão fora do ar, então pede para preencher o endereço à mão', async () => {
    // Dado
    rede.mockRejectedValue(new TypeError('Failed to fetch'));
    // Quando
    const consulta = consultarCEP('39400121');
    // Então
    await expect(consulta).rejects.toThrow('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.');
  });
});
