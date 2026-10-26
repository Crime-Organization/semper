// Testes das regras de cadastro: rodam com "npm run verificar" e na rotina de publicação.
// Se algum falhar, a publicação para e o site no ar continua como estava.
import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, deCNPJws, faltaNoveCelular, fmtTelefone, lerData, MASCARAS, nomeProprio, qualificacao, telefoneNormal, valorLegivel, variantesTelefone } from './pessoa';

describe('documentos', () => {
  it('confere os dígitos do CPF e do CNPJ', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
  });
  it('aplica as máscaras enquanto digita', () => {
    expect(MASCARAS.cpf('52998224725')).toBe('529.982.247-25');
    expect(MASCARAS.cnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(MASCARAS.telefone('38999991234')).toBe('(38) 99999-1234');
    expect(MASCARAS.data('10051980')).toBe('10/05/1980');
  });
});

describe('telefones e datas', () => {
  it('formata e normaliza telefones, inclusive com +55', () => {
    expect(fmtTelefone('5538999991234')).toBe('(38) 99999-1234');
    expect(fmtTelefone('3832220000')).toBe('(38) 3222-0000');
    expect(telefoneNormal('+55 (38) 99999-1234')).toBe('38999991234');
  });
  it('acrescenta o 9 dos celulares antigos e acha o cadastro com ou sem ele', () => {
    expect(fmtTelefone('(16) 8201-0240')).toBe('(16) 98201-0240');
    expect(fmtTelefone('(038) 3222-0000')).toBe('(38) 3222-0000');
    expect(faltaNoveCelular('(16) 8201-0240')).toBe(true);
    expect(faltaNoveCelular('(38) 3222-0000')).toBe(false);
    expect(variantesTelefone('(16) 8201-0240')).toEqual(['16982010240', '1682010240']);
    expect(variantesTelefone('(38) 3222-0000')).toEqual(['3832220000']);
  });
  it('lê datas no formato brasileiro e recusa as inexistentes', () => {
    expect(lerData('10/05/1980')).toBe('1980-05-10');
    expect(lerData('')).toBeNull();
    expect(() => lerData('31/02/1980')).toThrow('Data inexistente.');
    expect(() => lerData('1980-05-10')).toThrow('Use o formato DD/MM/AAAA.');
  });
});

describe('qualificação', () => {
  it('faz a concordância de gênero da pessoa física', () => {
    const texto = qualificacao({
      tipo: 'pf', nome: 'maria da silva', genero: 'f', nacionalidade: 'brasileira', profissao: 'professora', estado_civil: 'casado',
      documento: '52998224725', rg: 'MG 12.345.678 SSP/MG', rg_expedicao: '2001-02-03', nome_mae: 'joana', nascimento: '1980-05-10',
      logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG', cep: '39400121',
      emails: ['maria@exemplo.com'], telefones: ['38999991234']
    });
    expect(texto).toBe('MARIA DA SILVA, brasileira, professora, casada, inscrita no CPF sob o nº 529.982.247-25, com RG nº MG 12.345.678 SSP/MG, '
      + 'expedida em 03/02/2001, filha de JOANA, nascida em 10/05/1980, residente e domiciliada na Rua das Flores, nº 10, bairro Centro, '
      + 'em Montes Claros/MG, CEP 39400-121, endereço eletrônico maria@exemplo.com, telefone (38) 99999-1234');
  });
  it('usa a forma neutra quando o gênero não foi informado', () => {
    expect(qualificacao({ tipo: 'pf', nome: 'Alex', estado_civil: 'solteiro', documento: '52998224725' }))
      .toBe('ALEX, solteiro(a), inscrito(a) no CPF sob o nº 529.982.247-25');
  });
  it('flexiona também o que foi digitado com "(a)" e arruma o endereço em maiúsculas', () => {
    expect(qualificacao({ tipo: 'pf', nome: 'João', genero: 'm', profissao: 'AGRICULTOR(A)', logradouro: 'SÍTIO BOA VISTA', municipio: 'MONTES CLAROS', uf: 'mg' }))
      .toBe('JOÃO, agricultor, residente e domiciliado no Sítio Boa Vista, em Montes Claros/MG');
    expect(qualificacao({ tipo: 'pf', nome: 'Ana', genero: 'f', profissao: 'agricultor(a)', municipio: 'Montes Claros', uf: 'MG' }))
      .toBe('ANA, agricultora, residente e domiciliada em Montes Claros/MG');
    expect(qualificacao({ tipo: 'pf', nome: 'Ana', logradouro: 'Rua X,', numero: '5', bairro: 'Centro ,', municipio: 'Montes Claros' }))
      .toBe('ANA, residente e domiciliado(a) na Rua X, nº 5, bairro Centro, em Montes Claros');
  });
  it('sociedade concorda no feminino, com nome fantasia e porte; os representantes "e/ou" ficam no fim', () => {
    expect(qualificacao({
      tipo: 'pj', nome: 'Padaria Exemplo Ltda', natureza: 'empresarial', tipo_entidade: 'Sociedade Empresária Limitada', documento: '11222333000181',
      nome_fantasia: 'Pão Bom', porte: 'me', logradouro: 'AVENIDA PRINCIPAL', numero: '100', complemento: 'ANDAR 15 SALA 1922', municipio: 'Montes Claros', uf: 'MG',
      representantes: 'fulano de tal E/OU beltrano de tal', telefones: ['3832140000']
    })).toBe('PADARIA EXEMPLO LTDA, sociedade empresária limitada, inscrita no CNPJ sob o nº 11.222.333/0001-81, com título do estabelecimento PÃO BOM, '
      + 'com porte de microempresa, com sede na Avenida Principal, nº 100, Andar 15 Sala 1922, em Montes Claros/MG, telefone (38) 3214-0000, '
      + 'neste ato representada por FULANO DE TAL e/ou BELTRANO DE TAL');
  });
  it('representante vinculado entra com a função e a qualificação dele, sem os contatos', () => {
    const empresa = { tipo: 'pj' as const, nome: 'Bela Software Ltda', natureza: 'empresarial', tipo_entidade: 'Sociedade Empresária Limitada', documento: '11222333000181',
      municipio: 'São Paulo', uf: 'SP', emails: ['contato@bela.exemplo'], representantes: 'NOME DIGITADO' };
    const socia = { tipo: 'pf' as const, nome: 'Ludmila Exemplo', genero: 'f' as const, nacionalidade: 'brasileira', estado_civil: 'solteiro', documento: '52998224725',
      municipio: 'São Paulo', uf: 'SP', telefones: ['11999990000'] };
    expect(qualificacao(empresa, { representantes: [{ pessoa: socia, funcao: 'Sócia Administradora' }] }))
      .toBe('BELA SOFTWARE LTDA, sociedade empresária limitada, inscrita no CNPJ sob o nº 11.222.333/0001-81, com sede em São Paulo/SP, '
        + 'endereço eletrônico contato@bela.exemplo, neste ato representada por sua sócia administradora, LUDMILA EXEMPLO, brasileira, solteira, '
        + 'inscrita no CPF sob o nº 529.982.247-25, residente e domiciliada em São Paulo/SP');
  });
  it('MEI e empresário individual concordam com o gênero da pessoa e têm endereço profissional', () => {
    const mei = { tipo: 'pj' as const, nome: 'Fulana de Tal', natureza: 'empresarial', tipo_entidade: 'Microempreendedor(a) Individual (MEI)', documento: '11222333000181', municipio: 'Montes Claros', uf: 'MG' };
    expect(qualificacao({ ...mei, genero: 'f' }))
      .toBe('FULANA DE TAL, microempreendedora individual (MEI), inscrita no CNPJ sob o nº 11.222.333/0001-81, com endereço profissional em Montes Claros/MG');
    expect(qualificacao({ ...mei, genero: null }))
      .toBe('FULANA DE TAL, microempreendedor(a) individual (MEI), inscrito(a) no CNPJ sob o nº 11.222.333/0001-81, com endereço profissional em Montes Claros/MG');
    expect(qualificacao({ ...mei, tipo_entidade: 'Empresário(a) Individual', genero: 'm' }))
      .toBe('FULANA DE TAL, empresário individual, inscrito no CNPJ sob o nº 11.222.333/0001-81, com endereço profissional em Montes Claros/MG');
  });
  it('ente público e entidade sem fins lucrativos', () => {
    expect(qualificacao({ tipo: 'pj', nome: 'Município de Exemplo', natureza: 'publica', tipo_entidade: 'Município', documento: '11222333000181', representantes: 'Prefeito Fulano' }))
      .toBe('MUNICÍPIO DE EXEMPLO, pessoa jurídica de direito público, inscrita no CNPJ sob o nº 11.222.333/0001-81, neste ato representada por PREFEITO FULANO');
    expect(qualificacao({ tipo: 'pj', nome: 'Associação X', natureza: 'sem_fins', tipo_entidade: 'Associação Privada', documento: '11222333000181' }))
      .toBe('ASSOCIAÇÃO X, associação privada sem fins lucrativos, inscrita no CNPJ sob o nº 11.222.333/0001-81');
  });
  it('não gera qualificação para "somente contato"', () => {
    expect(qualificacao({ tipo: 'contato', nome: 'Fulano' })).toBe('');
  });
  it('escreve nomes de lugares digitados em maiúsculas como nome próprio', () => {
    expect(nomeProprio('RUA XV DE NOVEMBRO')).toBe('Rua XV de Novembro');
    expect(nomeProprio('rodovia br-251, km 5')).toBe('Rodovia BR-251, Km 5');
    expect(nomeProprio('Rua do McDonald')).toBe('Rua do McDonald');
    expect(nomeProprio("OLHOS D'ÁGUA")).toBe("Olhos D'Água");
  });
});

describe('consulta de CNPJ', () => {
  it('converte a resposta da Receita, reconhecendo MEI', () => {
    const x = deCNPJws({
      razao_social: 'Fulano de Tal', natureza_juridica: { descricao: '213-5 - Empresário (Individual)' }, simples: { mei: 'Sim' },
      estabelecimento: { cep: '39400-121', tipo_logradouro: 'Rua', logradouro: 'das Flores', ddd1: '38', telefone1: '32220000', email: 'A@B.COM' }
    });
    expect(x.tipo_entidade).toBe('Microempreendedor(a) Individual (MEI)');
    expect(x.natureza).toBe('empresarial');
    expect(x.porte).toBeNull();
    expect(x.logradouro).toBe('Rua das Flores');
    expect(x.telefones).toEqual(['(38) 3222-0000']);
    expect(x.emails).toEqual(['a@b.com']);
  });
});

describe('histórico', () => {
  it('mostra valores legíveis', () => {
    expect(valorLegivel('documento', '52998224725')).toBe('529.982.247-25');
    expect(valorLegivel('estado_civil', 'viuvo')).toBe('viúvo(a)');
    expect(valorLegivel('nascimento', '1980-05-10')).toBe('10/05/1980');
    expect(valorLegivel('emails', [])).toBe('—');
  });
});
