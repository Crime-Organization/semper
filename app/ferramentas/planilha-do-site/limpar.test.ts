// Testes de juntar os cadastros da planilha do site (e cruzar com o Google Contatos). Padrão Dado / Quando / Então: veja
// app/TESTES.md. Só dados fictícios, montados no código.
import { describe, expect, it } from 'vitest';
import { chaveDoPar, type Decisoes } from './decisoes';
import { CASOS, limpar, MOTIVOS, PREFIXO_DA_DESCRICAO, PREFIXO_DO_NOME_ANTIGO, type Entrada } from './limpar';
import { CNPJ, CNPJ_COM_LETRAS, CPF, CPF_2, google, site } from './ficticios';
import { formatar } from './telefones';

const entrada = (linhas: Entrada['site'], arquivos: Entrada['google'] = []): Entrada => ({ site: linhas, google: arquivos });
const telefonesDe = (c: { telefones: Parameters<typeof formatar>[0][] }) => c.telefones.map(formatar);

describe('Juntar os cadastros da planilha do site', () => {
  describe('Dado dois envios com o mesmo CPF', () => {
    const dados = entrada([
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo da Silva', cpf: CPF, logradouro: 'Rua A', telefone: '(38) 99999-0000', email: 'maria@exemplo.com' }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'MARIA EXEMPLO DA SILVA', cpf: CPF, logradouro: 'Rua B', telefone: '(38) 3222-0000', email: 'maria2@exemplo.com' })
    ]);

    it('quando junta, então valem os campos do envio mais recente e o primeiro envio é o mais antigo', () => {
      // Quando
      const { finais } = limpar(dados);
      // Então
      expect(finais).toHaveLength(1);
      expect(finais[0].site.logradouro).toBe('Rua B');
      expect(finais[0].site.linhas).toEqual([2, 3]);
      expect(finais[0].primeiroEnvio).toBe('2019-03-15T16:22:33.000Z');
    });

    it('quando junta, então os telefones e e-mails dos dois envios são somados', () => {
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(telefonesDe(c)).toEqual(expect.arrayContaining(['(38) 99999-0000', '(38) 3222-0000']));
      expect(c.emails).toEqual(expect.arrayContaining(['maria@exemplo.com', 'maria2@exemplo.com']));
    });

    it('quando um campo do envio antigo ficou de fora, então vai para a observação', () => {
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.observacoes).toEqual(['Envio anterior — Logradouro: "Rua A"']);
      expect(c.comoJuntado).toContain(MOTIVOS.siteComSite);
    });
  });

  it('quando o mesmo telefone tem nomes parecidos, então os envios juntam', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo da Silva', telefone: '38 99999-0000' })
    ]);
    // Quando
    const { finais } = limpar(dados);
    // Então
    expect(finais).toHaveLength(1);
    expect(finais[0].site.linhas).toEqual([2, 3]);
  });

  it('quando o mesmo telefone tem nomes diferentes, então não junta nem vira par', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'João Fictício', telefone: '(38) 99999-0000' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares).toEqual([]);
  });

  it('quando o mesmo CPF tem nomes diferentes, então é o mesmo cadastro: vale o envio mais recente e o nome antigo vai para a observação', () => {
    // Dado
    const dados = entrada([
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'João Fictício', cpf: CPF })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.nome)).toEqual(['João Fictício']);
    expect(finais[0].observacoes).toEqual(['Envio anterior — Nome: "Maria Exemplo"']);
    expect(rel.pares).toEqual([]);
  });

  it('quando a empresa muda de nome com o mesmo CNPJ, então vale o nome mais recente e os dados antigos ficam na observação', () => {
    // Dado
    const dados = entrada([
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Padaria Antiga Ltda', tipo: 'Entidade Empresarial', cnpj: CNPJ, logradouro: 'Rua A' }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'Exemplo Alimentos S.A.', tipo: 'Entidade Empresarial', cnpj: CNPJ, logradouro: 'Rua B' })
    ]);
    // Quando
    const [c] = limpar(dados).finais;
    // Então
    expect(c.site.nome).toBe('Exemplo Alimentos S.A.');
    expect(c.site.logradouro).toBe('Rua B');
    expect(c.observacoes).toEqual(['Envio anterior — Nome: "Padaria Antiga Ltda"', 'Envio anterior — Logradouro: "Rua A"']);
  });

  it.each([
    ['igual', 'Maria Exemplo', 'Maria Exemplo'],
    ['com acento diferente', 'José Conceição', 'JOSE CONCEICAO'],
    ['com vírgula', 'Padaria Exemplo, Ltda', 'Padaria Exemplo Ltda'],
    ['com uma letra faltando', 'Maria Aparecida Exemplo', 'Maria Aparcida Exemplo']
  ])('quando o nome é %s, sem documento nem telefone em comum, então é o mesmo cadastro', (_caso, a, b) => {
    // Dado
    const dados = entrada([site(2, { nome: a, telefone: '(38) 99999-0000' }), site(3, { nome: b, telefone: '(38) 98888-0000' })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.linhas)).toEqual([[2, 3]]);
    expect(rel.pares).toEqual([]);
  });

  it('quando o mesmo nome tem a mesma data de nascimento, então é o mesmo cadastro', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', nascimento: '01/02/1980', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo', nascimento: '1980-02-01', telefone: '(38) 98888-0000' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(1);
    expect(rel.pares).toEqual([]);
  });

  it('quando o mesmo nome tem datas de nascimento diferentes, então ficam separados, com o par para decidir', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', nascimento: '01/02/1980', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo', nascimento: '01/02/1995', telefone: '(38) 98888-0000' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares.map(p => p.caso)).toEqual([CASOS.datasDiferentes]);
    expect(rel.pares[0].a.linhas).toEqual([2]);
    expect(rel.pares[0].b.linhas).toEqual([3]);
  });

  it('quando o nome tem uma palavra só, sem documento nem telefone em comum, então não junta: fica o par para decidir', () => {
    // Dado
    const dados = entrada([site(2, { nome: 'João', telefone: '(38) 99999-0000' }), site(3, { nome: 'João', telefone: '(38) 98888-0000' })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares.map(p => p.caso)).toEqual([CASOS.nomeDeUmaPalavra]);
  });

  it('quando o mesmo nome tem CPFs diferentes, então fica separado sem par', () => {
    // Dado
    const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF }), site(3, { nome: 'Maria Exemplo', cpf: CPF_2 })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares).toEqual([]);
    expect(rel.separadosPorProva).toBe(1);
  });

  it('quando a linha não tem nome, então fica de fora e é contada', () => {
    // Dado
    const dados = entrada([site(2, { nome: '', telefone: '(38) 99999-0000' }), site(3, { nome: 'Maria Exemplo' })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.nome)).toEqual(['Maria Exemplo']);
    expect(rel.semNome).toBe(1);
  });

  describe('Dado um arquivo do Google Contatos', () => {
    it('quando um contato casa pelo telefone, então o cliente ganha o e-mail dele e a conferência mostra o contato', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo da Silva', telefone: '(38) 99999-0000' })],
        [google('contatos.csv', [{ linha: 5, nome: 'Maria Exemplo', telefone: '+55 38 99999-0000', email: 'maria.google@exemplo.com' }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.emails).toEqual(['maria.google@exemplo.com']);
      expect(c.contatosGoogle).toEqual(['contatos.csv:5']);
      expect(c.site.nome).toBe('Maria Exemplo da Silva');
    });

    it('quando um contato só existe no Google, então ele não sai', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' })],
        [google('contatos.csv', [{ linha: 2, nome: 'Bruno Fictício', telefone: '(38) 97777-0000' }])]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      expect(finais.map(c => c.site.nome)).toEqual(['Maria Exemplo']);
      expect(rel.contatosDoGoogle).toBe(1);
    });

    it('quando a descrição do Google tem mais que a qualificação da planilha, então o resto vai para a observação', () => {
      // Dado
      const qualificacao = 'MARIA EXEMPLO, brasileira, professora, residente na Rua A, nº 10, em Montes Claros/MG';
      const dados = entrada([site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000', qualificacao })],
        [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo', telefone: '(38) 99999-0000',
          notas: `${qualificacao}, associada da Associação Fictícia\nIndicada pela vizinha Joana` }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.observacoes).toEqual([`${PREFIXO_DA_DESCRICAO}associada da Associação Fictícia\nIndicada pela vizinha Joana`]);
    });

    it('quando a descrição do Google é a qualificação da planilha, então nada vai para a observação', () => {
      // Dado
      const qualificacao = 'MARIA EXEMPLO, brasileira, professora';
      const dados = entrada([site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000', qualificacao })],
        [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo', telefone: '(38) 99999-0000', notas: qualificacao.toLowerCase() }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.observacoes).toEqual([]);
    });

    it('quando o contato do Google traz o CPF do cliente na descrição, então casa pelo CPF, mesmo com outro telefone', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' })],
        [google('contatos.csv', [{ linha: 3, nome: 'Maria Exemplo', telefone: '(38) 98888-0000', notas: `CPF nº ${CPF}` }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual(['contatos.csv:3']);
      expect(telefonesDe(c)).toEqual(['(38) 99999-0000', '(38) 98888-0000']);
    });

    it('quando há um arquivo complementar, então a versão antiga de um contato do primeiro não entra', () => {
      // Dado
      const atual = google('atual.csv', [{ linha: 2, nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }]);
      const antigo = google('antigo.csv', [
        { linha: 2, nome: 'Maria Exemplo', telefone: '(38) 99999-0000', email: 'maria.antiga@exemplo.com' },
        { linha: 3, nome: 'Bruno Fictício', telefone: '(38) 97777-0000', email: 'bruno@exemplo.com' }
      ]);
      const dados = entrada([
        site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }),
        site(3, { nome: 'Bruno Fictício', telefone: '(38) 97777-0000' })
      ], [atual, antigo]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      expect(rel.complementosDoGoogle).toBe(1);
      expect(finais.map(c => c.emails)).toEqual([[], ['bruno@exemplo.com']]);
      expect(finais.map(c => c.contatosGoogle)).toEqual([['atual.csv:2'], ['antigo.csv:3']]);
    });
  });

  describe('Referências', () => {
    const linhas = [
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }),
      site(4, { envio: '01/01/2020 09:00:00', nome: 'Bruno Fictício' })
    ];

    it('quando a mesma entrada é convertida de novo, então as referências são as mesmas', () => {
      // Quando
      const [uma, outra] = [limpar(entrada(linhas)), limpar(entrada(linhas))];
      // Então
      expect(uma.finais.map(c => c.referencia)).toEqual(outra.finais.map(c => c.referencia));
      expect(uma.finais[0].referencia).toMatch(/^site-[0-9a-z]+$/);
    });

    it('quando as linhas vêm em outra ordem, então cada cliente fica com a mesma referência', () => {
      // Dado
      const outraOrdem = [{ ...linhas[2], linha: 2 }, { ...linhas[1], linha: 3 }, { ...linhas[0], linha: 4 }];
      // Quando
      const [antes, depois] = [limpar(entrada(linhas)), limpar(entrada(outraOrdem))];
      // Então
      const porNome = (r: typeof antes) => Object.fromEntries(r.finais.map(c => [c.site.nome, c.referencia]));
      expect(porNome(depois)).toEqual(porNome(antes));
    });

    it('quando dois clientes dão a mesma referência, então o da linha de baixo ganha "-2"', () => {
      // Dado
      const repetidos = [
        site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF }),
        site(3, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF_2 })
      ];
      // Quando
      const { finais, rel } = limpar(entrada(repetidos));
      // Então
      expect(finais[1].referencia).toBe(`${finais[0].referencia}-2`);
      expect(rel.referenciasRepetidas).toBe(1);
    });
  });

  it('quando roda duas vezes com a mesma entrada, então dá o mesmo resultado (sem estado guardado)', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo', telefone: '(38) 98888-0000' }),
      site(4, { nome: 'Bruno Fictício', cpf: CPF })
    ], [google('contatos.csv', [{ linha: 2, nome: 'Bruno', telefone: '(38) 97777-0000' }])]);
    // Quando
    const [primeira, segunda] = [limpar(dados), limpar(dados)];
    // Então
    expect(segunda).toEqual(primeira);
  });
});

describe('Cadastro repetido se decide pelo CPF/CNPJ (#179)', () => {
  const empresa = (linha: number, nome: string, extra: Parameters<typeof site>[1] = {}) => site(linha, { nome, tipo: 'Entidade Empresarial', ...extra });

  it('quando duas empresas têm o e-mail da mesma contabilidade e nomes parecidos, então ficam separadas e sem par para decidir', () => {
    // Dado
    const dados = entrada([
      empresa(2, 'Auto Posto Alfa', { email: 'fiscal@contabilidade.exemplo' }),
      empresa(3, 'Auto Posto Beta', { email: 'fiscal@contabilidade.exemplo' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.linhas)).toEqual([[2], [3]]);
    expect(rel.pares).toEqual([]);
  });

  it('quando o CPF é igual e os nomes são compatíveis, então junta, mesmo sem telefone ou e-mail em comum', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo da Silva', cpf: CPF, telefone: '(38) 98888-0000' })
    ]);
    // Quando
    const { finais } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.linhas)).toEqual([[2, 3]]);
  });

  it('quando os CNPJs são diferentes, então ficam os dois, mesmo com o mesmo nome, telefone e e-mail, sem nada a decidir', () => {
    // Dado
    const dados = entrada([
      empresa(2, 'Padaria Exemplo', { cnpj: CNPJ, telefone: '(38) 3222-0000', email: 'fiscal@contabilidade.exemplo' }),
      empresa(3, 'Padaria Exemplo', { cnpj: CNPJ_COM_LETRAS, telefone: '(38) 3222-0000', email: 'fiscal@contabilidade.exemplo' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares).toEqual([]);
  });

  it('quando um é CPF e o outro CNPJ, então ficam os dois, mesmo com o mesmo nome', () => {
    // Dado
    const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF }), empresa(3, 'Maria Exemplo', { cnpj: CNPJ })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares).toEqual([]);
  });

  it('quando falta o documento em um dos lados, então o mesmo telefone e o mesmo nome juntam', () => {
    // Dado
    const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }), site(3, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' })]);
    // Quando
    const { finais } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.linhas)).toEqual([[2, 3]]);
    expect(finais[0].site.doc).toBe(CPF);
  });

  it('quando falta o documento e os nomes só se parecem, sem um conter o outro, então o telefone não junta', () => {
    // Dado
    const dados = entrada([empresa(2, 'Auto Posto Alfa', { telefone: '(38) 3222-0000' }), empresa(3, 'Auto Posto Beta', { telefone: '(38) 3222-0000' })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares).toEqual([]);
  });

  it.each([['com todos os algarismos iguais', '000.000.000-00'], ['inválido', '529.982.247-26']])('quando o número é %s, então conta como sem documento', (_caso, cpf) => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Ana Exemplo', cpf, telefone: '(38) 99999-0001' }),
      site(3, { nome: 'Bruno Fictício', cpf, telefone: '(38) 99999-0002' }),
      site(4, { nome: 'Carla Fictícia', cpf: CPF, telefone: '(38) 99999-0003' }),
      site(5, { nome: 'Carla Fictícia', cpf, telefone: '(38) 99999-0003' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então: o mesmo número não liga nomes diferentes, e o telefone ainda junta quem tem o mesmo nome
    expect(finais.map(c => c.site.linhas)).toEqual([[2], [3], [4, 5]]);
    expect(rel.pares).toEqual([]);
  });

  describe('Dado um contato do Google', () => {
    it('quando só o e-mail é igual ao do cliente, então não casa', () => {
      // Dado
      const dados = entrada([empresa(2, 'Padaria Exemplo', { cnpj: CNPJ, email: 'fiscal@contabilidade.exemplo' })],
        [google('contatos.csv', [{ linha: 2, nome: 'Padaria Exemplo Ltda', email: 'fiscal@contabilidade.exemplo' }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual([]);
    });

    it('quando só o nome é o mesmo, sem documento para conferir, então casa', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Aparecida Exemplo', telefone: '(38) 99999-0000' })],
        [google('contatos.csv', [{ linha: 2, nome: 'MARIA APARCIDA EXEMPLO', telefone: '(38) 98888-0000' }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual(['contatos.csv:2']);
      expect(c.observacoes).toEqual([]);
    });

    it('quando o nome é o mesmo, mas o aniversário não bate com o nascimento, então não casa', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', nascimento: '01/02/1980' })],
        [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo', aniversario: '1995-07-09' }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual([]);
    });

    it('quando o contato tem o CNPJ do cliente com outro nome, então casa e o nome antigo vai para a observação', () => {
      // Dado
      const dados = entrada([empresa(2, 'Exemplo Alimentos S.A.', { cnpj: CNPJ })],
        [google('contatos.csv', [{ linha: 2, nome: 'Padaria Antiga Ltda', notas: `CNPJ nº ${CNPJ}` }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual(['contatos.csv:2']);
      expect(c.observacoes).toContain(`${PREFIXO_DO_NOME_ANTIGO}Padaria Antiga Ltda`);
    });

    it('quando um contato sem documento tem o nome de dois clientes de CPFs diferentes, então não casa com nenhum', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF }), site(3, { nome: 'Maria Exemplo', cpf: CPF_2 })],
        [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo' }])]);
      // Quando
      const { finais } = limpar(dados);
      // Então
      expect(finais.map(c => c.contatosGoogle)).toEqual([[], []]);
    });

    it('quando o CPF do cliente é o do representante na descrição de uma empresa, então não casa: vale o primeiro documento', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF })],
        [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo', notas: `MARIA EXEMPLO LTDA, inscrita no CNPJ nº ${CNPJ}, representada por sócia de CPF nº ${CPF}` }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual([]);
    });

    it('quando dois contatos têm o mesmo representante e CNPJs diferentes, então não juntam', () => {
      // Dado
      const notas = (cnpj: string) => `inscrita no CNPJ nº ${cnpj}, representada por sócia de CPF nº ${CPF}`;
      const dados = entrada([empresa(2, 'Padaria Exemplo', { cnpj: CNPJ })], [google('contatos.csv', [
        { linha: 2, nome: 'Padaria Exemplo', notas: notas(CNPJ) },
        { linha: 3, nome: 'Padaria Exemplo', notas: notas(CNPJ_COM_LETRAS) }
      ])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual(['contatos.csv:2']);
    });
  });

  describe('Dado um arquivo complementar do Google', () => {
    const atual = google('atual.csv', [{ linha: 2, nome: 'Padaria Exemplo', telefone: '(38) 3222-0000', email: 'fiscal@contabilidade.exemplo', notas: `CNPJ nº ${CNPJ}` }]);
    const complementos = (dados: Parameters<typeof google>[1]) => limpar(entrada([site(2, { nome: 'Cliente Qualquer' })], [atual, google('antigo.csv', dados)])).rel.complementosDoGoogle;

    it.each([
      ['outro nome e o mesmo e-mail', { nome: 'Auto Posto Alfa', email: 'fiscal@contabilidade.exemplo' }],
      ['outro nome e o mesmo telefone', { nome: 'Auto Posto Alfa', telefone: '(38) 3222-0000' }],
      ['o mesmo nome, sem telefone ou e-mail em comum', { nome: 'Padaria Exemplo', telefone: '(38) 98888-0000' }],
      ['o mesmo nome e telefone, mas outro CPF/CNPJ', { nome: 'Padaria Exemplo', telefone: '(38) 3222-0000', notas: `CNPJ nº ${CNPJ_COM_LETRAS}` }]
    ])('quando o contato antigo tem %s, então ele não é descartado', (_caso, contato) => {
      // Então
      expect(complementos([{ linha: 2, ...contato }])).toBe(1);
    });

    it.each([
      ['o mesmo CPF/CNPJ', { nome: 'Nome Antigo Da Empresa', notas: `CNPJ nº ${CNPJ}` }],
      ['o mesmo nome e o mesmo telefone', { nome: 'Padaria Exemplo', telefone: '(38) 3222-0000' }],
      ['o mesmo nome e o mesmo e-mail', { nome: 'Padaria Exemplo', email: 'fiscal@contabilidade.exemplo' }]
    ])('quando o contato antigo tem %s, então é versão antiga e não entra', (_caso, contato) => {
      // Então
      expect(complementos([{ linha: 2, ...contato }])).toBe(0);
    });
  });
});

describe('Achados da revisão do conversor', () => {
  describe('Datas', () => {
    it('quando a data de nascimento é só o ano ("1980"), então fica como veio, sem virar uma data de 1905', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', nascimento: '1980', abertura: '1995' })]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.site.nascimento).toBe('1980');
      expect(c.site.abertura).toBe('1995');
    });

    it('quando a data vem como número de série do Excel (5 algarismos), então é lida', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', nascimento: '29221', envio: '43539.5' })]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.site.nascimento).toBe('1980-01-01');
      expect(c.primeiroEnvio).toBe('2019-03-15T15:00:00.000Z');
    });

    it('quando a data de envio não pode ser lida (formato americano), então é contada', () => {
      // Dado
      const dados = entrada([
        site(2, { nome: 'Maria Exemplo', envio: '3/15/2019 13:22:33' }),
        site(3, { nome: 'Bruno Fictício', envio: '15/03/2019 13:22:33' }),
        site(4, { nome: 'Carla Fictícia' })
      ]);
      // Quando
      const { rel } = limpar(dados);
      // Então
      expect(rel.envios).toEqual({ comData: 2, ilegiveis: 1 });
    });
  });

  describe('Junção em cadeia', () => {
    it('quando um cadastro sem documento tem o telefone e o nome de dois CPFs diferentes, então não junta com nenhum e vira par', () => {
      // Dado
      const dados = entrada([
        site(2, { nome: 'Ana Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }),
        site(3, { nome: 'Ana Exemplo', telefone: '(38) 99999-0000' }),
        site(4, { nome: 'Ana Exemplo Souza', cpf: CPF_2, telefone: '(38) 99999-0000' })
      ]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      expect(finais.map(c => c.site.linhas)).toEqual([[2], [3], [4]]);
      expect(rel.pares.map(p => p.caso)).toContain(CASOS.maisDeUmDocumento);
    });

    it('quando o telefone e o nome juntam cadastros com datas de nascimento diferentes, então o cliente fica marcado', () => {
      // Dado
      const dados = entrada([
        site(2, { nome: 'Carlos Exemplo', nascimento: '05/06/1970', telefone: '(38) 99999-0000' }),
        site(3, { nome: 'Carlos Exemplo', nascimento: '05/06/1995', telefone: '(38) 99999-0000' })
      ]);
      // Quando
      const { finais } = limpar(dados);
      // Então
      expect(finais.filter(c => c.provasDivergentes).map(c => c.site.linhas)).toEqual([[2, 3]]);
    });

    it('quando os envios juntados têm o mesmo CPF, então o cliente não fica marcado', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Ana Exemplo', cpf: CPF }), site(3, { nome: 'Ana Exemplo', cpf: CPF })]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.provasDivergentes).toBe(false);
    });
  });

  describe('Pares e decisões', () => {
    it('quando os mesmos dois clientes aparecem em mais de um par, então sai um par só, com as referências da saída', () => {
      // Dado: as linhas 5 e 6 juntam pelo CPF; a 7 é par das duas
      const dados = entrada([
        site(5, { envio: '01/01/2022 10:00:00', nome: 'Dora Exemplo', cpf: CPF, nascimento: '01/01/1990', telefone: '(38) 99999-0001' }),
        site(6, { envio: '01/01/2018 10:00:00', nome: 'Dora Exemplo', cpf: CPF, nascimento: '01/01/1990', telefone: '(38) 99999-0002' }),
        site(7, { envio: '01/01/2023 10:00:00', nome: 'Dora Exemplo', nascimento: '02/02/1991', telefone: '(38) 99999-0003' })
      ]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      const referencias = finais.map(c => c.referencia);
      expect(rel.pares).toHaveLength(1);
      expect(referencias).toContain(rel.pares[0].a.referencia);
      expect(referencias).toContain(rel.pares[0].b.referencia);
      expect(rel.pares[0].a.linhas).toEqual([5, 6]);
      expect(finais.map(c => c.pendentes.length)).toEqual([1, 1]);
    });

    it('quando um "sim" em cadeia juntaria dois clientes que você separou com "não", então o "não" vale', () => {
      // Dado: três clientes de mesmo nome e datas de nascimento diferentes
      const dados = entrada([
        site(2, { nome: 'Lia Exemplo', nascimento: '01/01/1970', telefone: '(38) 99999-0001' }),
        site(3, { nome: 'Lia Exemplo', nascimento: '01/01/1980', telefone: '(38) 99999-0002' }),
        site(4, { nome: 'Lia Exemplo', nascimento: '01/01/1990', telefone: '(38) 99999-0003' })
      ]);
      const ref = Object.fromEntries(limpar(dados).finais.map(c => [c.site.linhas[0], c.referencia]));
      const decisoes: Decisoes = new Map([
        [chaveDoPar(ref[2], ref[3]), 'sim'], [chaveDoPar(ref[3], ref[4]), 'sim'], [chaveDoPar(ref[2], ref[4]), 'nao']
      ]);
      // Quando
      const { finais, rel } = limpar(dados, decisoes);
      // Então
      expect(finais.map(c => c.site.linhas)).toEqual([[2, 3], [4]]);
      expect(rel.pares.map(p => p.feito)).not.toContain('juntados por CPF/CNPJ ou data iguais, apesar da sua decisão');
      expect(rel.pares.find(p => p.decisao === 'nao')?.feito).toBe('mantidos separados pela sua decisão');
    });

    it('quando o conflito de CPF é com um contato do Google que não é de nenhum cliente, então não vira par', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' })],
        [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo', telefone: '(38) 99999-0000', notas: `CPF ${CPF_2}` }])]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      expect(finais).toHaveLength(1);
      expect(rel.pares).toEqual([]);
    });

    it('quando o mesmo nome e o mesmo telefone vêm com CPFs diferentes, então ficam os dois, sem nada a decidir', () => {
      // Dado
      const dados = entrada([
        site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }),
        site(3, { nome: 'Maria Exemplo', cpf: CPF_2, telefone: '(38) 99999-0000' })
      ]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      expect(finais).toHaveLength(2);
      expect(rel.pares).toEqual([]);
      expect(rel.separadosPorProva).toBe(1);
    });
  });

  describe('Google Contatos', () => {
    it('quando dois contatos do Google casam com o cliente, então as descrições dos dois vão para a observação', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Eva Exemplo', telefone: '(38) 99999-0003' })], [google('contatos.csv', [
        { linha: 2, nome: 'Eva Exemplo', telefone: '(38) 99999-0003', notas: 'Cliente desde a ação de cobrança' },
        { linha: 3, nome: 'Eva Exemplo', telefone: '(38) 99999-0003', notas: 'Indicada pelo cliente Fulano' }
      ])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.observacoes).toEqual(expect.arrayContaining([
        `${PREFIXO_DA_DESCRICAO}Cliente desde a ação de cobrança`, `${PREFIXO_DA_DESCRICAO}Indicada pelo cliente Fulano`
      ]));
    });

    it('quando a descrição do Google tem um e-mail com cara de CNPJ com letras, então ele não conta como CNPJ', () => {
      // Dado: "exemplosilva64" tem o formato e os dígitos verificadores de um CNPJ com letras
      const dados = entrada([site(2, { nome: 'Padaria Exemplo', tipo: 'Entidade Empresarial', cnpj: CNPJ, telefone: '(38) 3222-0000' })],
        [google('contatos.csv', [{ linha: 2, nome: 'Padaria Exemplo', telefone: '(38) 3222-0000', email: 'padaria@exemplo.com',
          notas: 'Contato: exemplosilva64@exemplo.com' }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual(['contatos.csv:2']);
      expect(c.emails).toContain('padaria@exemplo.com');
    });

    it('quando a descrição do Google traz outro CNPJ com letras depois do rótulo, então ele conta como prova e o contato não casa', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Padaria Exemplo', tipo: 'Entidade Empresarial', cnpj: CNPJ, telefone: '(38) 3222-0000' })],
        [google('contatos.csv', [{ linha: 2, nome: 'Padaria Exemplo', telefone: '(38) 3222-0000', notas: `CNPJ nº ${CNPJ_COM_LETRAS}` }])]);
      // Quando
      const { finais } = limpar(dados);
      // Então
      expect(finais[0].contatosGoogle).toEqual([]);
    });
  });
});
