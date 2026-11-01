// Testes da linha do SEMPER montada pelo conversor e do contrato com a tela de importação (lerImportacao + normalizarLinha).
// Padrão Dado / Quando / Então: veja app/TESTES.md. Só dados fictícios.
import { describe, expect, it } from 'vitest';
import { TAMANHO_OBSERVACOES, TAMANHO_PESSOA } from '../../src/dados/limites';
import { COLUNAS_IMPORTACAO, lerImportacao, normalizarLinha, type ContextoImportacao } from '../../src/regras/importacao';
import { CNPJ, CNPJ_COM_LETRAS, CPF, CPF_2, CPF_COM_ZERO, google, site } from './ficticios';
import { limpar, PENDENTES_NO_CONFERIR, type Entrada } from './limpar';
import { conferirNaTela, csvParaSemper, OBSERVACAO_CORTADA, paraSemper, PROVAS_DIVERGENTES, responsaveis } from './paraSemper';
import type { LinhaDoSite } from './planilhas';

const CTX: ContextoImportacao = { hoje: '2026-10-31', lgpdPadrao: 'contrato' };
/** As linhas do SEMPER de uma planilha fictícia. */
const converter = (linhas: LinhaDoSite[], arquivos: Entrada['google'] = [], lgpd?: string) =>
  paraSemper(limpar({ site: linhas, google: arquivos }).finais, { lgpd });
const umaLinha = (valores: LinhaDoSite['valores']) => converter([site(2, valores)]).linhas[0];

describe('Linha do SEMPER a partir da planilha do site', () => {
  it('quando o CPF veio sem os zeros do começo, então volta com eles, formatado', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', cpf: String(Number(CPF_COM_ZERO)) });
    // Então
    expect(linha.documento).toBe('001.007.919-05');
  });

  it('quando o CPF é inválido, então vai como veio (a tela guarda na observação)', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', cpf: '123.456.789-00' });
    // Então
    expect(linha.documento).toBe('123.456.789-00');
  });

  it('quando o CNPJ tem letras, então vai formatado', () => {
    // Quando
    const linha = umaLinha({ nome: 'Empresa Fictícia', tipo: 'Entidade Empresarial', cnpj: '12.abc.345/01de-35', entidadeEmpresarial: 'Sociedade Empresária Limitada' });
    // Então
    expect(linha).toMatchObject({ tipo: 'pj', natureza: 'empresarial', documento: '12.ABC.345/01DE-35', tipo_entidade: 'Sociedade Empresária Limitada' });
  });

  it.each(['Não se enquadra', 'NAO SE ENQUADRA'])('quando o porte é "%s", então a coluna fica vazia', texto => {
    // Quando
    const linha = umaLinha({ nome: 'Empresa Fictícia', tipo: 'Entidade Empresarial', cnpj: CNPJ, porte: texto });
    // Então
    expect(linha.porte).toBe('');
  });

  it('quando o porte é "Microempresa", então vai como veio (a tela reconhece)', () => {
    // Quando
    const linha = umaLinha({ nome: 'Empresa Fictícia', tipo: 'Entidade Empresarial', cnpj: CNPJ, porte: 'Microempresa' });
    // Então
    expect(linha.porte).toBe('Microempresa');
  });

  it('quando o CEP de São Paulo veio com 7 algarismos, então volta com o zero', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', cep: '1234000', uf: 'SP' });
    // Então
    expect(linha.cep).toBe('01234-000');
  });

  it('quando o CEP não tem 8 algarismos, então vai como veio', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', cep: '3940-00', uf: 'MG' });
    // Então
    expect(linha.cep).toBe('3940-00');
  });

  it('quando o tipo está vazio e o CPF é válido, então vira pessoa física, com "conferir"', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', tipo: '', cpf: CPF });
    // Então
    expect(linha.tipo).toBe('pf');
    expect(linha.conferir).toBe('Tipo de cadastro em branco: ficou Pessoa física');
  });

  it('quando o tipo é desconhecido e não há documento, então vira somente contato, com "conferir"', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', tipo: 'Outro' });
    // Então
    expect(linha.tipo).toBe('contato');
    expect(linha.conferir).toBe('Tipo de cadastro "Outro" não reconhecido: ficou Somente contato');
  });

  it('quando o tipo é "Somente informações de contato", então vira somente contato', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', tipo: 'Somente informações de contato', telefone: '(38) 99999-0000' });
    // Então
    expect(linha).toMatchObject({ tipo: 'contato', telefones: '(38) 99999-0000', conferir: '' });
  });

  it('quando o responsável é "Ana e Bruno / Carla", então são três responsáveis', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', responsavel: 'Ana e Bruno / Carla' });
    // Então
    expect(linha.responsaveis).toBe('Ana | Bruno | Carla');
  });

  it('quando os envios juntados repetem responsáveis, então cada um aparece uma vez', () => {
    // Quando
    const nomes = responsaveis(['Ana, Bruno', 'ana & Carla', 'Bruno; Davi']);
    // Então
    expect(nomes).toEqual(['Ana', 'Bruno', 'Carla', 'Davi']);
  });

  it('quando há vários envios, então a data de cadastro é a do mais antigo', () => {
    // Dado
    const linhas = [
      site(2, { envio: '20/06/2021 10:00:00', nome: 'Maria Exemplo', cpf: CPF }),
      site(3, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF })
    ];
    // Quando
    const [linha] = converter(linhas).linhas;
    // Então
    expect(linha.cadastrado_em).toBe('2019-03-15T16:22:33.000Z');
  });

  it('quando o mesmo CPF vem com nomes diferentes, então sai uma linha só, com o nome antigo na observação', () => {
    // Quando
    const { linhas, marcas } = converter([
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'João Fictício', cpf: CPF })
    ]);
    // Então
    expect(linhas.map(l => l.documento)).toEqual(['529.982.247-25']);
    expect(linhas[0].nome).toBe('João Fictício');
    expect(linhas[0].observacoes).toContain('Envio anterior — Nome: "Maria Exemplo"');
    expect(marcas.map(m => m.mesmoDocumento)).toEqual([false]);
  });

  it('quando a observação passa do limite, então é cortada com "…" e o "conferir" avisa', () => {
    // Dado
    const linhas = [
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', cpf: CPF, complemento: 'x'.repeat(TAMANHO_OBSERVACOES) }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'Maria Exemplo', cpf: CPF, complemento: 'Apto 1' })
    ];
    // Quando
    const { linhas: [linha], marcas: [marca] } = converter(linhas);
    // Então
    expect(linha.observacoes.length).toBeLessThanOrEqual(TAMANHO_OBSERVACOES);
    expect(linha.observacoes.endsWith('…')).toBe(true);
    expect(linha.conferir).toBe(OBSERVACAO_CORTADA);
    expect(marca.observacaoCortada).toBe(true);
    expect(conferirNaTela(csvParaSemper([linha]), CTX).recusadas).toBe(0);
  });

  it('quando a base legal é informada, então vai para todos; sem ela, fica vazia', () => {
    // Quando
    const [com, sem] = [converter([site(2, { nome: 'Maria Exemplo' })], [], 'processo'), converter([site(2, { nome: 'Maria Exemplo' })])];
    // Então
    expect(com.linhas[0].lgpd_base).toBe('processo');
    expect(sem.linhas[0].lgpd_base).toBe('');
  });

  it('quando o nome começa com "=", então o CSV protege a célula e o telefone estrangeiro fica sem proteção', () => {
    // Dado
    const { linhas } = converter([site(2, { nome: '=Maria Exemplo', tipo: 'Somente informações de contato', telefone: '+1 555 123 4567' })]);
    // Quando
    const csv = csvParaSemper(linhas);
    // Então
    expect(csv).toContain(";'=Maria Exemplo;");
    expect(csv).toContain(';+1 555 123 4567;');
  });
});

describe('Contrato com a tela de importação', () => {
  /** Clientes fictícios variados: pessoa física juntada com o Google, pessoa jurídica, CNPJ com letras, somente contato,
   *  tipo vazio, dados inválidos que a tela trata (UF, data, e-mail) e o mesmo CPF em dois clientes. */
  const LINHAS: LinhaDoSite[] = [
    site(2, { envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo da Silva', genero: 'Feminino', nacionalidade: 'Brasileira',
      profissao: 'Professora', estadoCivil: 'Casada', cpf: CPF, rg: 'MG-1', rgExpedicao: '10/05/2005', mae: 'Ana Exemplo',
      nascimento: '01/02/1980', nascimentoMunicipio: 'Montes Claros', nascimentoUf: 'MG', logradouro: 'Rua A', numero: '10',
      bairro: 'Centro', municipio: 'Montes Claros', uf: 'MG', cep: '39400000', telefone: '(38) 9 9999-0000 / (38) 3222-0000',
      email: 'maria@exemplo.com', responsavel: 'Ana e Bruno' }),
    site(3, { envio: '20/06/2021 10:00:00', nome: 'MARIA EXEMPLO DA SILVA', cpf: CPF, logradouro: 'Rua B', responsavel: 'Carla' }),
    site(4, { envio: '01/01/2020 09:00:00', nome: 'Padaria Fictícia Ltda', tipo: 'Entidade Empresarial', cnpj: CNPJ,
      entidadeEmpresarial: 'Sociedade Empresária Limitada', fantasia: 'Padaria Fictícia', porte: 'Microempresa', abertura: '05/03/2010',
      representantes: 'João Exemplo', logradouro: 'Av B', numero: '200', municipio: 'São Paulo', uf: 'SP', cep: '1234000',
      telefone: '(11) 3222-0001', responsavel: 'Ana' }),
    site(5, { envio: '02/02/2022 08:00:00', nome: 'Associação Fictícia', tipo: 'Entidade sem Fins Lucrativos', cnpj: CNPJ_COM_LETRAS,
      entidade: 'Associação Privada' }),
    site(6, { envio: '03/03/2023 08:00:00', nome: 'Bruno Contato', tipo: 'Somente informações de contato', telefone: '38 98888-0000',
      email: 'bruno@exemplo.com' }),
    site(7, { envio: '04/04/2024 08:00:00', nome: 'Carla Sem Tipo', tipo: '', cpf: CPF_2, uf: 'XX', nascimento: '31/02/1990', email: 'carla@' }),
    site(8, { envio: '05/05/2025 08:00:00', nome: 'Davi Fictício', cpf: CPF_2 })
  ];
  const GOOGLE = [google('contatos.csv', [{ linha: 2, nome: 'Maria Exemplo', telefone: '+55 38 99999-0000', email: 'maria.google@exemplo.com' }])];
  const texto = csvParaSemper(converter(LINHAS, GOOGLE).linhas);
  const leitura = lerImportacao(texto);
  const importadas = leitura.linhas.map(l => normalizarLinha(l, CTX));
  const porNome = (nome: string) => importadas.find(i => i.dados.nome === nome);

  it('quando a tela lê o arquivo, então todas as colunas são conhecidas e nenhuma falta', () => {
    // Então
    expect(leitura.desconhecidas).toEqual([]);
    expect(leitura.faltando).toEqual([]);
    expect(leitura.repetidas).toEqual([]);
    expect(texto.split('\r\n')[0]).toBe('﻿' + COLUNAS_IMPORTACAO.map(c => c.chave).join(';'));
  });

  it('quando a tela normaliza as linhas, então nenhuma é recusada', () => {
    // Então
    expect(importadas).toHaveLength(6);
    expect(importadas.flatMap(i => i.problemas.filter(p => p.gravidade === 'erro'))).toEqual([]);
    expect(conferirNaTela(texto, CTX).recusadas).toBe(0);
  });

  it('quando a tela normaliza a pessoa física juntada, então tipo, documento, contatos, responsáveis e data chegam certos', () => {
    // Quando
    const maria = porNome('MARIA EXEMPLO DA SILVA');
    // Então
    expect(maria?.dados).toMatchObject({
      tipo: 'pf', documento: CPF, genero: 'f', estado_civil: 'casado', nascimento: '1980-02-01', logradouro: 'Rua B', cep: '39400000',
      telefones: ['(38) 99999-0000', '(38) 3222-0000'], emails: ['maria@exemplo.com', 'maria.google@exemplo.com']
    });
    expect(maria?.nomesResponsaveis).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(maria?.cadastradoEm).toBe('2019-03-15T16:22:33.000Z');
    expect(maria?.observacoes).toContain('Envio anterior — Logradouro: "Rua A"');
  });

  it('quando a tela normaliza as pessoas jurídicas, então natureza, tipo de entidade e CNPJ chegam certos', () => {
    // Então
    expect(porNome('PADARIA FICTÍCIA LTDA')?.dados).toMatchObject({
      tipo: 'pj', natureza: 'empresarial', tipo_entidade: 'Sociedade Empresária Limitada', documento: CNPJ, porte: 'me', cep: '01234000'
    });
    expect(porNome('ASSOCIAÇÃO FICTÍCIA')?.dados).toMatchObject({ tipo: 'pj', natureza: 'sem_fins', documento: CNPJ_COM_LETRAS });
  });

  it('quando a tela normaliza o somente contato, então telefone e e-mail chegam', () => {
    // Então
    expect(porNome('BRUNO CONTATO')?.dados).toMatchObject({ tipo: 'contato', telefones: ['(38) 98888-0000'], emails: ['bruno@exemplo.com'] });
  });

  it('quando o mesmo CPF está em dois clientes e um tem dados inválidos, então a tela marca a conferência e guarda o que não coube', () => {
    // Quando
    const carla = porNome('CARLA SEM TIPO');
    // Então
    expect(carla?.dados).toMatchObject({ tipo: 'pf', documento: CPF_2, uf: null, nascimento: null, emails: [] });
    expect(carla?.pendencias).toEqual(['conferir']);
    expect(carla?.observacoes.some(o => o.startsWith('A conferir: Tipo de cadastro em branco'))).toBe(true);
    expect(porNome('DAVI FICTÍCIO')?.pendencias).toEqual(['conferir']);
  });
});

describe('Achados da revisão: o que a tela perderia vai para a observação', () => {
  it('quando o envio mais recente é "somente contato" e o anterior era pessoa física, então os campos da pessoa física vão para a observação', () => {
    // Dado
    const linhas = [
      site(2, { envio: '01/03/2020 10:00:00', nome: 'Ana Exemplo', cpf: CPF, rg: 'MG-1', nascimento: '01/02/1980', mae: 'Bia Exemplo',
        logradouro: 'Rua A', municipio: 'Montes Claros', uf: 'MG', telefone: '(38) 99999-0000' }),
      site(3, { envio: '01/03/2023 10:00:00', nome: 'Ana Exemplo', tipo: 'Somente informações de contato', telefone: '(38) 99999-0000' })
    ];
    // Quando
    const [linha] = converter(linhas).linhas;
    // Então
    expect(linha).toMatchObject({ tipo: 'contato', rg: '', nome_mae: '', nascimento: '', logradouro: '' });
    expect(linha.observacoes).toContain('Não vale para Somente contato — RG: "MG-1"');
    expect(linha.observacoes).toContain('Não vale para Somente contato — Nome da mãe: "Bia Exemplo"');
    expect(linha.observacoes).toContain('Não vale para Somente contato — Data de nascimento: "01/02/1980"');
    expect(linha.observacoes).toContain('Não vale para Somente contato — Logradouro: "Rua A"');
    const [importada] = conferirNaTela(csvParaSemper([linha]), CTX).importadas;
    expect(importada.problemas.filter(p => p.campo === 'tipo')).toEqual([]);
  });

  it('quando o envio mais recente é pessoa física e o anterior era empresa, então o CNPJ e o nome fantasia vão para a observação', () => {
    // Dado
    const linhas = [
      site(2, { envio: '01/03/2020 10:00:00', nome: 'Ana Exemplo', tipo: 'Entidade Empresarial', cnpj: CNPJ, fantasia: 'Loja Exemplo',
        telefone: '(38) 99999-0000' }),
      site(3, { envio: '01/03/2023 10:00:00', nome: 'Ana Exemplo', telefone: '(38) 99999-0000' })
    ];
    // Quando
    const [linha] = converter(linhas).linhas;
    // Então
    expect(linha).toMatchObject({ tipo: 'pf', documento: '', nome_fantasia: '' });
    expect(linha.observacoes).toContain(`Não vale para Pessoa física — CNPJ: "${CNPJ}"`);
    expect(linha.observacoes).toContain('Não vale para Pessoa física — Nome fantasia: "Loja Exemplo"');
  });

  it('quando o envio mais recente tem o CPF inválido e o anterior o válido, então vai o válido, formatado', () => {
    // Dado
    const linhas = [
      site(2, { envio: '01/03/2020 10:00:00', nome: 'Ana Exemplo', cpf: CPF, telefone: '(38) 99999-0000' }),
      site(3, { envio: '01/03/2023 10:00:00', nome: 'Ana Exemplo', cpf: '529.982.247-26', telefone: '(38) 99999-0000' }),
      site(4, { envio: '01/03/2021 10:00:00', nome: 'Bruno Fictício', cpf: CPF })
    ];
    // Quando
    const { linhas: resultado } = converter(linhas);
    // Então
    expect(resultado.map(l => l.documento)).toEqual(['529.982.247-25']);
  });

  it('quando um campo passa do tamanho da tela, então vai cortado e o texto inteiro fica na observação', () => {
    // Dado
    const numero = 'Sem número, casa de esquina ao lado da escola';
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', numero });
    // Então
    expect(linha.numero.length).toBeLessThanOrEqual(TAMANHO_PESSOA.numero);
    expect(linha.numero.endsWith('…')).toBe(true);
    expect(linha.observacoes).toContain(`Número inteiro: "${numero}"`);
    expect(conferirNaTela(csvParaSemper([linha]), CTX).recusadas).toBe(0);
  });

  it('quando o CEP tem 7 algarismos e a UF não é SP, então não vai para a coluna (a tela o faria de SP) e fica na observação', () => {
    // Quando
    const linha = umaLinha({ nome: 'Maria Exemplo', cep: '3940000', uf: 'MG' });
    // Então
    expect(linha.cep).toBe('');
    expect(linha.observacoes).toContain('CEP com 7 algarismos (falta um): "3940000"');
    expect(conferirNaTela(csvParaSemper([linha]), CTX).importadas[0].dados.cep).toBeNull();
  });

  it('quando o tipo está vazio e o CNPJ é válido, então vira pessoa jurídica, com "conferir"', () => {
    // Quando
    const linha = umaLinha({ nome: 'Padaria Exemplo', tipo: '', cnpj: CNPJ });
    // Então
    expect(linha).toMatchObject({ tipo: 'pj', documento: '11.222.333/0001-81' });
    expect(linha.conferir).toBe('Tipo de cadastro em branco: ficou Pessoa jurídica');
  });
});

describe('Achados da revisão: documento repetido e "conferir" longo', () => {
  it('quando dois clientes têm o mesmo CPF de preenchimento ("000.000.000-00"), então não são marcados como mesmo CPF', () => {
    // Quando
    const { linhas, marcas } = converter([site(2, { nome: 'Maria Exemplo', cpf: '000.000.000-00' }), site(3, { nome: 'João Fictício', cpf: '000.000.000-00' })]);
    // Então
    expect(marcas.map(m => m.mesmoDocumento)).toEqual([false, false]);
    expect(linhas.map(l => l.conferir)).toEqual(['', '']);
  });

  it('quando dois clientes têm o CPF de preenchimento, então a coluna fica vazia e a tela não pede decisão', () => {
    // Quando
    const { linhas } = converter([site(2, { nome: 'Maria Exemplo', cpf: '000.000.000-00' }), site(3, { nome: 'João Fictício', cpf: '111.111.111-11' })]);
    // Então
    expect(linhas.map(l => l.documento)).toEqual(['', '']);
    expect(linhas.map(l => l.observacoes)).toEqual(['', '']);
    expect(conferirNaTela(csvParaSemper(linhas), CTX)).toMatchObject({ recusadas: 0, paraDecidir: 0 });
  });

  it('quando o mesmo CPF inválido está em dois clientes, então a conferência avisa que a tela pediria para decidir', () => {
    // Quando
    const { linhas } = converter([site(2, { nome: 'Maria Exemplo', cpf: '529.982.247-26' }), site(3, { nome: 'João Fictício', cpf: '529.982.247-26' })]);
    // Então
    expect(conferirNaTela(csvParaSemper(linhas), CTX).paraDecidir).toBe(2);
  });

  it('quando o cliente tem muitos pares e a observação é longa, então o "conferir" é resumido e a tela não recusa a linha', () => {
    // Dado: 41 clientes de mesmo nome e datas de nascimento diferentes; o primeiro com dois envios de complemento longo
    const linhas = [
      site(2, { envio: '15/03/2019 13:22:33', nome: 'Lia Exemplo', cpf: CPF, nascimento: '01/01/1940', complemento: 'x'.repeat(3800) }),
      site(3, { envio: '20/06/2021 10:00:00', nome: 'Lia Exemplo', cpf: CPF, nascimento: '01/01/1940', complemento: 'Apto 1' }),
      ...Array.from({ length: 40 }, (_, i) => site(4 + i, { nome: 'Lia Exemplo', nascimento: `01/01/${1950 + i}`, telefone: `(38) 9${String(1000 + i).padStart(4, '0')}-0000` }))
    ];
    // Quando
    const { linhas: [primeira], marcas: [marca] } = converter(linhas);
    // Então
    expect(primeira.conferir).toContain(`e mais ${40 - PENDENTES_NO_CONFERIR} que podem ser a mesma pessoa`);
    expect(primeira.conferir.match(/Pode ser a mesma pessoa/g)).toHaveLength(PENDENTES_NO_CONFERIR);
    expect(marca.observacaoCortada).toBe(true);
    expect(conferirNaTela(csvParaSemper([primeira]), CTX).recusadas).toBe(0);
  });

  it('quando o telefone e o nome juntam cadastros com datas de nascimento diferentes, então a linha leva o "conferir"', () => {
    // Dado
    const linhas = [
      site(2, { nome: 'Ana Exemplo', nascimento: '01/02/1980', telefone: '(38) 99999-0000' }),
      site(3, { nome: 'Ana Exemplo Souza', nascimento: '01/02/1995', telefone: '(38) 99999-0000' })
    ];
    // Quando
    const { linhas: [linha], marcas: [marca] } = converter(linhas);
    // Então
    expect(linha.conferir).toContain(PROVAS_DIVERGENTES);
    expect(marca.provasDivergentes).toBe(true);
  });
});
