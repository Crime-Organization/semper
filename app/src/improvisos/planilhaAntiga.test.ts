// @vitest-environment jsdom
// PROVISORIO-219: sai junto com planilhaAntiga.ts.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contexto, DadosPessoa } from '../dados';
import { avisar } from '../ui/avisos';
import { camposDoScript, enviarParaPlanilhaAntiga, lembrarDeApagarNaPlanilha } from './planilhaAntiga';

vi.mock('../ui/avisos', () => ({ avisar: vi.fn() }));

const AGORA = new Date(2026, 10, 3, 9, 30, 0);
const ctx = (slug: string) => ({
  escritorio: { slug },
  equipe: [{ id: 'u1', nome: 'Hellyne Nogueira Barboza Goncalves' }, { id: 'u2', nome: 'Lúcio Ferreira dos Santos' }, { id: 'u3', nome: 'Pessoa Nova da Equipe' }]
}) as unknown as Pick<Contexto, 'escritorio' | 'equipe'>;
const PF: DadosPessoa = {
  tipo: 'pf', nome: 'MARIA DE TESTE', genero: 'f', nacionalidade: 'brasileira', estado_civil: 'uniao_estavel', documento: '52998224725',
  rg_expedicao: '2010-02-01', nascimento: '1990-12-31', cep: '30110012', uf: 'MG', telefones: ['(31) 99999-0000', '(31) 3333-0000'], emails: ['maria@exemplo.com', 'outra@exemplo.com']
};
const CONTATO: DadosPessoa = { tipo: 'contato', nome: 'CONTATO' };

describe('Campos do script antigo', () => {
  it('dado uma pessoa física, quando monta, então os campos têm o formato do formulário do site', () => {
    // Dado / Quando
    const c = camposDoScript(PF, [], AGORA);
    // Então
    expect(c).toMatchObject({
      token: 'BRAGA_SECRET_TOKEN', tipo_de_cadastro: 'Pessoa física', tipo_pessoa: 'Pessoa física', tipo_cadastro: 'Pessoa física', nome: 'MARIA DE TESTE',
      genero: 'Feminino', nacionalidade: 'brasileiro(a)', estado_civil: 'em união estável', cpf: '529.982.247-25', cnpj: '',
      data_expedicao: '01/02/2010', data_nascimento: '31/12/1990', cep: '30110-012', estado_end: 'MG'
    });
  });

  it('dado vários telefones e e-mails, quando monta, então vai só o primeiro de cada, que é o que o script recebe', () => {
    // Dado / Quando
    const c = camposDoScript(PF, [], AGORA);
    // Então
    expect(c).toMatchObject({ telefone: '(31) 99999-0000', email: 'maria@exemplo.com' });
  });

  it.each([
    ['empresarial', 'Entidade Empresarial', 'tipo_empresarial'],
    ['publica', 'Administração Pública', 'tipo_publico'],
    ['sem_fins', 'Entidade sem Fins Lucrativos', 'tipo_semfins']
  ])('dado uma pessoa jurídica de natureza %s, quando monta, então o tipo e a entidade vão no campo certo', (natureza, tipo, campo) => {
    // Dado / Quando
    const c = camposDoScript({ tipo: 'pj', nome: 'EMPRESA', natureza, tipo_entidade: 'Entidade X', documento: '11222333000181', porte: 'epp', abertura: '2020-05-04', nome_fantasia: 'FANTASIA' }, [], AGORA);
    // Então
    expect(c).toMatchObject({ tipo_de_cadastro: tipo, [campo]: 'Entidade X', cnpj: '11.222.333/0001-81', cpf: '', porte: 'Empresa de Pequeno Porte', data_abertura: '04/05/2020', titulo_estab: 'FANTASIA' });
    expect([c.tipo_empresarial, c.tipo_publico, c.tipo_semfins].filter(Boolean)).toEqual(['Entidade X']);
  });

  it('dado somente informações de contato, quando monta, então o tipo é o do formulário e o resto fica vazio', () => {
    // Dado / Quando
    const c = camposDoScript({ ...CONTATO, telefones: ['(31) 99999-0000'] }, [], AGORA);
    // Então
    expect(c).toMatchObject({ tipo_de_cadastro: 'Somente informações de contato', telefone: '(31) 99999-0000', cpf: '', cnpj: '', genero: '', cep: '', email: '', data_nascimento: '' });
  });

  it('dado uma pessoa jurídica sem natureza, quando monta, então o tipo é o do formulário nos três campos', () => {
    // Dado / Quando
    const c = camposDoScript({ tipo: 'pj', nome: 'EMPRESA' }, [], AGORA);
    // Então
    expect(c).toMatchObject({ tipo_pessoa: 'Pessoa Jurídica', tipo_cadastro: 'Pessoa Jurídica', tipo_de_cadastro: 'Pessoa Jurídica' });
  });

  it('dado um MEI com o gênero do titular, quando monta, então o gênero vai vazio, como no formulário', () => {
    // Dado / Quando
    const c = camposDoScript({ tipo: 'pj', nome: 'MEI', genero: 'f', natureza: 'empresarial' }, [], AGORA);
    // Então
    expect(c.genero).toBe('');
  });

  it('dado profissionais da equipe, quando monta, então só vão os da aba LISTAS, escritos como ela escreve, para a planilha achar o e-mail', () => {
    // Dado / Quando
    const c = camposDoScript(CONTATO, ['Hellyne Nogueira Barboza Goncalves', 'Lúcio Ferreira dos Santos', 'Pessoa Nova da Equipe'], AGORA);
    // Então
    expect(c.profissional).toBe('HÉLLYNE NOGUEIRA BARBOZA GONÇALVES, LUCIO FERREIRA DOS SANTOS');
  });
});

describe('Envio ao script antigo', () => {
  const envio = vi.fn<typeof fetch>();
  beforeEach(() => { envio.mockReset(); envio.mockResolvedValue(new Response()); vi.stubGlobal('fetch', envio); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.mocked(avisar).mockClear(); });

  it('dado o escritório da planilha, quando cadastra, então envia uma vez, com os responsáveis pelo nome', () => {
    // Dado / Quando
    enviarParaPlanilhaAntiga(CONTATO, ['u2', 'u-que-saiu'], ctx('braga-ferreira'));
    // Então
    expect(envio).toHaveBeenCalledTimes(1);
    const [endereco, pedido] = envio.mock.calls[0];
    expect(String(endereco)).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
    expect(pedido).toMatchObject({ method: 'POST', mode: 'no-cors' });
    expect(JSON.parse(String(pedido?.body))).toMatchObject({ nome: 'CONTATO', profissional: 'LUCIO FERREIRA DOS SANTOS' });
  });

  it.each(['teste', 'outro-escritorio'])('dado o escritório %s, quando cadastra, então nada é enviado', slug => {
    // Dado / Quando
    enviarParaPlanilhaAntiga(CONTATO, [], ctx(slug));
    // Então
    expect(envio).not.toHaveBeenCalled();
  });

  it('dado "npm run dev", que fala com o banco de verdade, quando cadastra, então nada é enviado', () => {
    // Dado
    vi.stubEnv('MODE', 'development');
    // Quando
    enviarParaPlanilhaAntiga(CONTATO, [], ctx('braga-ferreira'));
    // Então
    expect(envio).not.toHaveBeenCalled();
  });

  it('dado o escritório da planilha, quando desfaz o cadastro, então lembra de apagar lá fora; nos outros, não diz nada', () => {
    // Dado / Quando
    lembrarDeApagarNaPlanilha(ctx('teste'));
    // Então
    expect(avisar).not.toHaveBeenCalled();
    // Quando
    lembrarDeApagarNaPlanilha(ctx('braga-ferreira'));
    // Então
    expect(avisar).toHaveBeenCalledWith('Saiu do SEMPER, mas a linha na planilha, o contato no Google e o cartão no Trello continuam: apague à mão.', 'erro');
  });

  it('dado uma falha de rede, quando envia, então não lança erro e avisa: o cadastro segue salvo', async () => {
    // Dado
    envio.mockRejectedValue(new TypeError('Failed to fetch'));
    // Quando
    enviarParaPlanilhaAntiga(CONTATO, [], ctx('braga-ferreira'));
    // Então
    await vi.waitFor(() => expect(avisar).toHaveBeenCalledWith('A pessoa foi salva no SEMPER, mas não deu para confirmar o envio à planilha. Confira a planilha; se ela não estiver lá, cadastre pelo formulário do site.', 'erro'));
  });
});
