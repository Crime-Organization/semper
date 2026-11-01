// Testes de juntar os cadastros da planilha do site (e cruzar com o Google Contatos). Padrão Dado / Quando / Então: veja
// app/TESTES.md. Só dados fictícios, montados no código.
import { describe, expect, it } from 'vitest';
import { chaveDoPar, type Decisoes } from './decisoes';
import { CASOS, limpar, MOTIVOS, PREFIXO_DA_DESCRICAO, type Entrada } from './limpar';
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

  it('quando o mesmo CPF tem nomes diferentes, então ficam separados, com o par para decidir e o CPF nos dois', () => {
    // Dado
    const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF }), site(3, { nome: 'João Fictício', cpf: CPF })]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais.map(c => c.site.doc)).toEqual([CPF, CPF]);
    expect(rel.pares).toHaveLength(1);
    expect(rel.pares[0]).toMatchObject({ caso: CASOS.mesmoDocumento, decisao: null });
    expect(finais[0].pendentes).toEqual([{ referencia: finais[1].referencia, nome: 'João Fictício', caso: CASOS.mesmoDocumento }]);
    expect(finais[1].pendentes[0].referencia).toBe(finais[0].referencia);
  });

  it('quando o mesmo nome não tem nada em comum, então ficam separados e viram par para decidir', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo', telefone: '(38) 98888-0000' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(2);
    expect(rel.pares.map(p => p.caso)).toEqual([CASOS.mesmoNomeSemProva]);
    expect(rel.pares[0].a.linhas).toEqual([2]);
    expect(rel.pares[0].b.linhas).toEqual([3]);
  });

  it('quando o mesmo nome tem a mesma data de nascimento, então junta', () => {
    // Dado
    const dados = entrada([
      site(2, { nome: 'Maria Exemplo', nascimento: '01/02/1980', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Maria Exemplo', nascimento: '1980-02-01', telefone: '(38) 98888-0000' })
    ]);
    // Quando
    const { finais, rel } = limpar(dados);
    // Então
    expect(finais).toHaveLength(1);
    expect(finais[0].comoJuntado).toContain(MOTIVOS.mesmoNomeComProva);
    expect(rel.pares).toEqual([]);
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

    it('quando o mesmo nome do Google traz o CPF do cliente na descrição, então casa só pelo nome', () => {
      // Dado
      const dados = entrada([site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' })],
        [google('contatos.csv', [{ linha: 3, nome: 'Maria Exemplo', telefone: '(38) 98888-0000', notas: `CPF nº ${CPF}` }])]);
      // Quando
      const [c] = limpar(dados).finais;
      // Então
      expect(c.contatosGoogle).toEqual(['contatos.csv:3']);
      expect(telefonesDe(c)).toEqual(['(38) 99999-0000', '(38) 98888-0000']);
    });

    it('quando há um arquivo complementar, então só entram dele os contatos sem nada em comum com o primeiro', () => {
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
    it('quando o telefone e o e-mail juntam em cadeia cadastros de CPFs diferentes, então o cliente fica marcado para conferir', () => {
      // Dado
      const dados = entrada([
        site(2, { nome: 'Ana Exemplo', cpf: CPF, email: 'ana@exemplo.com' }),
        site(3, { nome: 'Ana Exemplo', email: 'ana@exemplo.com', telefone: '(38) 99999-0000' }),
        site(4, { nome: 'Ana Exemplo Souza', cpf: CPF_2, telefone: '(38) 99999-0000' })
      ]);
      // Quando
      const { finais } = limpar(dados);
      // Então
      expect(finais).toHaveLength(1);
      expect(finais[0].provasDivergentes).toBe(true);
    });

    it('quando o aniversário do Google (sem ano) junta cadastros com datas de nascimento diferentes, então o cliente fica marcado', () => {
      // Dado
      const dados = entrada([
        site(2, { nome: 'Carlos Exemplo', nascimento: '05/06/1970', telefone: '(38) 99999-0000' }),
        site(3, { nome: 'Carlos Exemplo', nascimento: '05/06/1995', telefone: '(38) 98888-0000' })
      ], [google('contatos.csv', [{ linha: 2, nome: 'Carlos Exemplo', aniversario: '--06-05' }])]);
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
      // Dado: as linhas 5 e 6 juntam pela data; a 7 é par das duas
      const dados = entrada([
        site(5, { envio: '01/01/2022 10:00:00', nome: 'Dora Exemplo', nascimento: '01/01/1990', telefone: '(38) 99999-0001' }),
        site(6, { envio: '01/01/2018 10:00:00', nome: 'Dora Exemplo', nascimento: '01/01/1990', telefone: '(38) 99999-0002' }),
        site(7, { envio: '01/01/2023 10:00:00', nome: 'Dora Exemplo', telefone: '(38) 99999-0003' })
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
      // Dado: três clientes de mesmo nome, sem nada em comum
      const dados = entrada([
        site(2, { nome: 'Lia Exemplo', telefone: '(38) 99999-0001' }),
        site(3, { nome: 'Lia Exemplo', telefone: '(38) 99999-0002' }),
        site(4, { nome: 'Lia Exemplo', telefone: '(38) 99999-0003' })
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

    it('quando o mesmo nome e o mesmo telefone vêm com CPFs diferentes, então vira par para decidir', () => {
      // Dado: o mesmo telefone não junta (CPFs diferentes), e o par fica para decidir
      const dados = entrada([
        site(2, { nome: 'Maria Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }),
        site(3, { nome: 'Maria Exemplo', cpf: CPF_2, telefone: '(38) 99999-0000' })
      ]);
      // Quando
      const { finais, rel } = limpar(dados);
      // Então
      expect(finais).toHaveLength(2);
      expect(rel.pares.map(p => p.caso)).toEqual([CASOS.mesmoNomeDocumentoDiferente]);
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
