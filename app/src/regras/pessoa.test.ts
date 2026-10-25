// Testes das regras de cadastro: rodam com "npm run verificar" e na rotina de publicação.
// Se algum falhar, a publicação para e o site no ar continua como estava.
import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, deCNPJws, fmtTelefone, lerData, MASCARAS, qualificacao, telefoneNormal, valorLegivel } from './pessoa';

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
      documento: '52998224725', rg: 'MG 12.345.678 SSP/MG', nome_mae: 'joana', nascimento: '1980-05-10',
      logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG', cep: '39400121',
      emails: ['maria@exemplo.com'], telefones: ['38999991234']
    });
    expect(texto).toBe('MARIA DA SILVA, brasileira, professora, casada, inscrita no CPF nº 529.982.247-25, com RG nº MG 12.345.678 SSP/MG, '
      + 'filha de JOANA, nascida em 10/05/1980, residente e domiciliada na Rua das Flores, nº 10, bairro Centro, em Montes Claros/MG, '
      + 'CEP: 39.400-121, e-mail maria@exemplo.com, telefone nº (38) 99999-1234');
  });
  it('usa a forma neutra quando o gênero não foi informado', () => {
    expect(qualificacao({ tipo: 'pf', nome: 'Alex', estado_civil: 'solteiro', documento: '52998224725' }))
      .toBe('ALEX, solteiro(a), inscrito(a) no CPF nº 529.982.247-25');
  });
  it('monta a pessoa jurídica com porte, sede e representantes "e/ou"', () => {
    expect(qualificacao({
      tipo: 'pj', nome: 'Padaria Exemplo Ltda', tipo_entidade: 'Sociedade Empresária Limitada', documento: '11222333000181', porte: 'me',
      logradouro: 'Avenida Principal', numero: '100', municipio: 'Montes Claros', uf: 'MG',
      representantes: 'fulano de tal E/OU beltrano de tal', telefones: ['3832140000']
    })).toBe('PADARIA EXEMPLO LTDA, sociedade empresária limitada, inscrito(a) no CNPJ nº 11.222.333/0001-81, com porte de microempresa, '
      + 'com sede na Avenida Principal, nº 100, em Montes Claros/MG, telefone nº (38) 3214-0000, neste ato representado(a) por FULANO DE TAL e/ou BELTRANO DE TAL');
  });
  it('não gera qualificação para "somente contato"', () => {
    expect(qualificacao({ tipo: 'contato', nome: 'Fulano' })).toBe('');
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
