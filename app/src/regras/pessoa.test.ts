// Testes das regras de cadastro: rodam com "npm run verificar" e na rotina de publicação.
// Se algum falhar, a publicação para e o site no ar continua como estava.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, deCNPJws, faltaNoveCelular, fmtTelefone, lerData, MASCARAS, nomeProprio, qualificacao, telefoneNormal, valorLegivel, variantesTelefone } from './pessoa';

describe('Documentos', () => {
  describe('Dado um CPF', () => {
    it.each([
      ['529.982.247-25', true],
      ['529.982.247-26', false],
      ['111.111.111-11', false]
    ])('quando o CPF é %s, então a validação dá %s', (cpf, valido) => {
      // Quando
      const resultado = cpfValido(cpf);
      // Então
      expect(resultado).toBe(valido);
    });
  });

  describe('Dado um CNPJ', () => {
    it.each([
      ['11.222.333/0001-81', true],
      ['11.222.333/0001-82', false]
    ])('quando o CNPJ é %s, então a validação dá %s', (cnpj, valido) => {
      // Quando
      const resultado = cnpjValido(cnpj);
      // Então
      expect(resultado).toBe(valido);
    });
  });

  describe('Dado um campo com máscara', () => {
    it.each([
      ['cpf', '52998224725', '529.982.247-25'],
      ['cnpj', '11222333000181', '11.222.333/0001-81'],
      ['telefone', '38999991234', '(38) 99999-1234'],
      ['data', '10051980', '10/05/1980']
    ] as const)('quando se digita %s "%s", então o campo mostra "%s"', (campo, digitado, esperado) => {
      // Quando
      const mostrado = MASCARAS[campo](digitado);
      // Então
      expect(mostrado).toBe(esperado);
    });
  });
});

describe('Telefones', () => {
  describe('Dado um telefone para mostrar', () => {
    it.each([
      ['5538999991234', '(38) 99999-1234'],
      ['3832220000', '(38) 3222-0000'],
      ['(16) 8201-0240', '(16) 98201-0240'],
      ['(038) 3222-0000', '(38) 3222-0000']
    ])('quando o telefone é "%s", então aparece como "%s"', (telefone, esperado) => {
      // Quando
      const mostrado = fmtTelefone(telefone);
      // Então
      expect(mostrado).toBe(esperado);
    });
  });

  it('quando o telefone vem com +55 e pontuação, então fica só com DDD e número', () => {
    // Quando
    const normal = telefoneNormal('+55 (38) 99999-1234');
    // Então
    expect(normal).toBe('38999991234');
  });

  describe('Dado um número antigo, sem o 9 do celular', () => {
    it.each([
      ['(16) 8201-0240', true],
      ['(38) 3222-0000', false]
    ])('quando o número é "%s", então "falta o 9" dá %s', (telefone, falta) => {
      // Quando
      const resultado = faltaNoveCelular(telefone);
      // Então
      expect(resultado).toBe(falta);
    });

    it.each([
      ['(16) 8201-0240', ['16982010240', '1682010240']],
      ['(38) 3222-0000', ['3832220000']]
    ])('quando se busca o cadastro pelo número "%s", então as variantes procuradas são %j', (telefone, variantes) => {
      // Quando
      const resultado = variantesTelefone(telefone);
      // Então
      expect(resultado).toEqual(variantes);
    });
  });
});

describe('Datas', () => {
  it('quando a data vem no formato brasileiro, então vira o formato do banco', () => {
    // Quando
    const data = lerData('10/05/1980');
    // Então
    expect(data).toBe('1980-05-10');
  });

  it('quando a data está vazia, então fica sem data', () => {
    // Quando
    const data = lerData('');
    // Então
    expect(data).toBeNull();
  });

  it.each([
    ['31/02/1980', 'Data inexistente.'],
    ['1980-05-10', 'Use o formato DD/MM/AAAA.']
  ])('quando a data é "%s", então o erro é "%s"', (digitada, erro) => {
    // Quando
    const ler = () => lerData(digitada);
    // Então
    expect(ler).toThrow(erro);
  });
});

describe('Qualificação', () => {
  describe('Dada uma pessoa física', () => {
    it('quando a pessoa tem todos os dados, então a qualificação concorda com o gênero', () => {
      // Dado
      const maria = {
        tipo: 'pf' as const, nome: 'maria da silva', genero: 'f' as const, nacionalidade: 'brasileira', profissao: 'professora', estado_civil: 'casado',
        documento: '52998224725', rg: 'MG 12.345.678 SSP/MG', rg_expedicao: '2001-02-03', nome_mae: 'joana', nascimento: '1980-05-10',
        logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG', cep: '39400121',
        emails: ['maria@exemplo.com'], telefones: ['38999991234']
      };
      // Quando
      const texto = qualificacao(maria);
      // Então
      expect(texto).toBe('MARIA DA SILVA, brasileira, professora, casada, inscrita no CPF sob o nº 529.982.247-25, com RG nº MG 12.345.678 SSP/MG, '
        + 'expedida em 03/02/2001, filha de JOANA, nascida em 10/05/1980, residente e domiciliada na Rua das Flores, nº 10, bairro Centro, '
        + 'em Montes Claros/MG, CEP 39400-121, endereço eletrônico maria@exemplo.com, telefone (38) 99999-1234');
    });

    it('quando o gênero não foi informado, então usa a forma neutra', () => {
      // Quando
      const texto = qualificacao({ tipo: 'pf', nome: 'Alex', estado_civil: 'solteiro', documento: '52998224725' });
      // Então
      expect(texto).toBe('ALEX, solteiro(a), inscrito(a) no CPF sob o nº 529.982.247-25');
    });

    it('quando a profissão foi digitada com "(a)" e o endereço em maiúsculas, então flexiona no masculino e arruma o endereço', () => {
      // Quando
      const texto = qualificacao({ tipo: 'pf', nome: 'João', genero: 'm', profissao: 'AGRICULTOR(A)', logradouro: 'SÍTIO BOA VISTA', municipio: 'MONTES CLAROS', uf: 'mg' });
      // Então
      expect(texto).toBe('JOÃO, agricultor, residente e domiciliado no Sítio Boa Vista, em Montes Claros/MG');
    });

    it('quando a profissão foi digitada com "(a)" e a pessoa é mulher, então flexiona no feminino', () => {
      // Quando
      const texto = qualificacao({ tipo: 'pf', nome: 'Ana', genero: 'f', profissao: 'agricultor(a)', municipio: 'Montes Claros', uf: 'MG' });
      // Então
      expect(texto).toBe('ANA, agricultora, residente e domiciliada em Montes Claros/MG');
    });

    it('quando o endereço tem vírgulas e espaços sobrando, então a pontuação sai limpa', () => {
      // Quando
      const texto = qualificacao({ tipo: 'pf', nome: 'Ana', logradouro: 'Rua X,', numero: '5', bairro: 'Centro ,', municipio: 'Montes Claros' });
      // Então
      expect(texto).toBe('ANA, residente e domiciliado(a) na Rua X, nº 5, bairro Centro, em Montes Claros');
    });
  });

  describe('Dada uma pessoa jurídica', () => {
    it('quando é sociedade com nome fantasia, porte e representantes "e/ou", então concorda no feminino e põe os representantes no fim', () => {
      // Dado
      const padaria = {
        tipo: 'pj' as const, nome: 'Padaria Exemplo Ltda', natureza: 'empresarial', tipo_entidade: 'Sociedade Empresária Limitada', documento: '11222333000181',
        nome_fantasia: 'Pão Bom', porte: 'me', logradouro: 'AVENIDA PRINCIPAL', numero: '100', complemento: 'ANDAR 15 SALA 1922', municipio: 'Montes Claros', uf: 'MG',
        representantes: 'fulano de tal E/OU beltrano de tal', telefones: ['3832140000']
      };
      // Quando
      const texto = qualificacao(padaria);
      // Então
      expect(texto).toBe('PADARIA EXEMPLO LTDA, sociedade empresária limitada, inscrita no CNPJ sob o nº 11.222.333/0001-81, com título do estabelecimento PÃO BOM, '
        + 'com porte de microempresa, com sede na Avenida Principal, nº 100, Andar 15 Sala 1922, em Montes Claros/MG, telefone (38) 3214-0000, '
        + 'neste ato representada por FULANO DE TAL e/ou BELTRANO DE TAL');
    });

    it('quando o representante é uma pessoa vinculada, então entra com a função e a qualificação dele, sem os contatos', () => {
      // Dado
      const empresa = { tipo: 'pj' as const, nome: 'Bela Software Ltda', natureza: 'empresarial', tipo_entidade: 'Sociedade Empresária Limitada', documento: '11222333000181',
        municipio: 'São Paulo', uf: 'SP', emails: ['contato@bela.exemplo'], representantes: 'NOME DIGITADO' };
      const socia = { tipo: 'pf' as const, nome: 'Ludmila Exemplo', genero: 'f' as const, nacionalidade: 'brasileira', estado_civil: 'solteiro', documento: '52998224725',
        municipio: 'São Paulo', uf: 'SP', telefones: ['11999990000'] };
      // Quando
      const texto = qualificacao(empresa, { representantes: [{ pessoa: socia, funcao: 'Sócia Administradora' }] });
      // Então
      expect(texto).toBe('BELA SOFTWARE LTDA, sociedade empresária limitada, inscrita no CNPJ sob o nº 11.222.333/0001-81, com sede em São Paulo/SP, '
        + 'endereço eletrônico contato@bela.exemplo, neste ato representada por sua sócia administradora, LUDMILA EXEMPLO, brasileira, solteira, '
        + 'inscrita no CPF sob o nº 529.982.247-25, residente e domiciliada em São Paulo/SP');
    });

    describe('Dado um MEI ou empresário individual', () => {
      const mei = { tipo: 'pj' as const, nome: 'Fulana de Tal', natureza: 'empresarial', tipo_entidade: 'Microempreendedor(a) Individual (MEI)', documento: '11222333000181', municipio: 'Montes Claros', uf: 'MG' };

      it('quando a MEI é mulher, então concorda no feminino e tem endereço profissional', () => {
        // Quando
        const texto = qualificacao({ ...mei, genero: 'f' });
        // Então
        expect(texto).toBe('FULANA DE TAL, microempreendedora individual (MEI), inscrita no CNPJ sob o nº 11.222.333/0001-81, com endereço profissional em Montes Claros/MG');
      });

      it('quando o gênero do MEI não foi informado, então usa a forma neutra', () => {
        // Quando
        const texto = qualificacao({ ...mei, genero: null });
        // Então
        expect(texto).toBe('FULANA DE TAL, microempreendedor(a) individual (MEI), inscrito(a) no CNPJ sob o nº 11.222.333/0001-81, com endereço profissional em Montes Claros/MG');
      });

      it('quando é empresário individual homem, então concorda no masculino', () => {
        // Quando
        const texto = qualificacao({ ...mei, tipo_entidade: 'Empresário(a) Individual', genero: 'm' });
        // Então
        expect(texto).toBe('FULANA DE TAL, empresário individual, inscrito no CNPJ sob o nº 11.222.333/0001-81, com endereço profissional em Montes Claros/MG');
      });
    });

    it('quando é ente público, então aparece como pessoa jurídica de direito público', () => {
      // Quando
      const texto = qualificacao({ tipo: 'pj', nome: 'Município de Exemplo', natureza: 'publica', tipo_entidade: 'Município', documento: '11222333000181', representantes: 'Prefeito Fulano' });
      // Então
      expect(texto).toBe('MUNICÍPIO DE EXEMPLO, pessoa jurídica de direito público, inscrita no CNPJ sob o nº 11.222.333/0001-81, neste ato representada por PREFEITO FULANO');
    });

    it('quando é entidade sem fins lucrativos, então isso aparece no tipo', () => {
      // Quando
      const texto = qualificacao({ tipo: 'pj', nome: 'Associação X', natureza: 'sem_fins', tipo_entidade: 'Associação Privada', documento: '11222333000181' });
      // Então
      expect(texto).toBe('ASSOCIAÇÃO X, associação privada sem fins lucrativos, inscrita no CNPJ sob o nº 11.222.333/0001-81');
    });
  });

  it('quando o cadastro é "somente contato", então não há qualificação', () => {
    // Quando
    const texto = qualificacao({ tipo: 'contato', nome: 'Fulano' });
    // Então
    expect(texto).toBe('');
  });

  describe('Dado um nome de lugar', () => {
    it.each([
      ['RUA XV DE NOVEMBRO', 'Rua XV de Novembro'],
      ['rodovia br-251, km 5', 'Rodovia BR-251, Km 5'],
      ['Rua do McDonald', 'Rua do McDonald'],
      ["OLHOS D'ÁGUA", "Olhos D'Água"]
    ])('quando o lugar foi digitado "%s", então aparece como "%s"', (digitado, esperado) => {
      // Quando
      const nome = nomeProprio(digitado);
      // Então
      expect(nome).toBe(esperado);
    });
  });
});

describe('Consulta de CNPJ', () => {
  describe('Dada a resposta da Receita para um MEI', () => {
    const resposta = {
      razao_social: 'Fulano de Tal', natureza_juridica: { descricao: '213-5 - Empresário (Individual)' }, simples: { mei: 'Sim' },
      estabelecimento: { cep: '39400-121', tipo_logradouro: 'Rua', logradouro: 'das Flores', ddd1: '38', telefone1: '32220000', email: 'A@B.COM' }
    };

    it('quando a resposta é convertida, então o tipo é MEI na natureza empresarial e sem porte', () => {
      // Quando
      const x = deCNPJws(resposta);
      // Então
      expect(x.tipo_entidade).toBe('Microempreendedor(a) Individual (MEI)');
      expect(x.natureza).toBe('empresarial');
      expect(x.porte).toBeNull();
    });

    it('quando a resposta é convertida, então endereço, telefone e e-mail vêm no formato do cadastro', () => {
      // Quando
      const x = deCNPJws(resposta);
      // Então
      expect(x.logradouro).toBe('Rua das Flores');
      expect(x.telefones).toEqual(['(38) 3222-0000']);
      expect(x.emails).toEqual(['a@b.com']);
    });
  });
});

describe('Histórico', () => {
  it.each([
    ['documento', '52998224725', '529.982.247-25'],
    ['estado_civil', 'viuvo', 'viúvo(a)'],
    ['nascimento', '1980-05-10', '10/05/1980'],
    ['emails', [], '—']
  ])('quando o campo %s mudou para %j, então o histórico mostra "%s"', (campo, valor, esperado) => {
    // Quando
    const mostrado = valorLegivel(campo, valor);
    // Então
    expect(mostrado).toBe(esperado);
  });
});
