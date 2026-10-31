// Testes da importação de pessoas por arquivo CSV. Padrão Dado / Quando / Então: veja app/TESTES.md.
// Só dados fictícios.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { TAMANHO_OBSERVACOES, TAMANHO_PESSOA, TAMANHO_REFERENCIA } from '../dados/limites';
import { CAMPOS } from './pessoa';
import { escreverCSV, lerCSV } from './csv';
import {
  acharResponsavel, classificar, COLUNAS_IMPORTACAO, completarVazios, DECISOES, DICA_ARQUIVADA, emLotes, juntarObservacoes,
  juntarResponsaveis, lerImportacao, modeloImportacao, NOME_DO_MODELO, nomesDeResponsaveis, normalizarLinha, opcoesDaLinha,
  PENDENCIAS, planejar, REFERENCIA_DO_EXEMPLO, resumir, ROTULO_DECISAO, textoDaObservacao,
  type ChaveImportacao, type Classificacao, type ContextoImportacao, type Decisao, type MapaResponsaveis,
  type PessoaExistente, type PessoaImportada
} from './importacao';

const CTX: ContextoImportacao = { hoje: '2026-10-31', lgpdPadrao: 'contrato' };
const CPF = '52998224725', CPF_2 = '11144477735', CNPJ = '11222333000181';

/** Uma linha lida do arquivo e já normalizada. */
const importar = (valores: Partial<Record<ChaveImportacao, string>>, numero = 2, ctx = CTX) => normalizarLinha({ numero, valores }, ctx);
const pf = (valores: Partial<Record<ChaveImportacao, string>> = {}, numero = 2) =>
  importar({ tipo: 'pf', nome: 'Maria Exemplo da Silva', ...valores }, numero);
const avisos = (p: PessoaImportada, campo?: ChaveImportacao) => p.problemas.filter(x => x.gravidade === 'aviso' && (!campo || x.campo === campo));
const erros = (p: PessoaImportada) => p.problemas.filter(x => x.gravidade === 'erro');

/** Um cadastro que já existe, com tudo vazio menos o que o teste passar. */
function existente(extra: Partial<PessoaExistente> = {}): PessoaExistente {
  return {
    id: 'p-1', codigo: '1', tipo: 'pf', nome: 'MARIA EXEMPLO DA SILVA', genero: null, nacionalidade: null, profissao: null,
    estado_civil: null, rg: null, rg_expedicao: null, nome_mae: null, nome_pai: null, nascimento: null, nascimento_municipio: null,
    nascimento_uf: null, natureza: null, tipo_entidade: null, nome_fantasia: null, porte: null, abertura: null, representantes: null,
    documento: CPF, cep: null, logradouro: null, numero: null, complemento: null, bairro: null, municipio: null, uf: null,
    telefones: [], emails: [], lgpd_base: 'contrato', lgpd_consentimento: null, etapa_id: null, etapa_ordem: null,
    arquivado_em: null, arquivado_por: null, criado_por: 'u-master', criado_em: '2020-01-01T12:00:00.000Z', atualizado_por: null,
    atualizado_em: '2020-01-01T12:00:00.000Z', resp: [], referencia: null, observacoes: null, pendencias: [], ...extra
  };
}

const EQUIPE: Membro[] = [
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', ativo: true },
  { id: 'u-ana2', nome: 'Ana Exemplo Souza', usuario: 'ana.souza', ativo: true },
  { id: 'u-joao', nome: 'JOÃO SILVA', usuario: 'joao.silva' },
  { id: 'u-carla', nome: 'Carla Fictícia Rocha', usuario: 'carla.rocha', ativo: false }
];
const MAPA: MapaResponsaveis = { 'ana lima': 'u-ana', 'joao silva': 'u-joao', 'ninguem': null };

describe('Ler o arquivo de importação', () => {
  it('quando o cabeçalho usa os rótulos, então cada coluna vira a chave dela e as que o SEMPER não conhece são listadas', () => {
    // Dado
    const texto = 'Nome;CPF/CNPJ;Data de nascimento;Apelido;tipo\r\nMARIA EXEMPLO;529.982.247-25;01/02/1980;Mari;pf\r\n';
    // Quando
    const leitura = lerImportacao(texto);
    // Então
    expect(leitura.linhas[0].valores).toEqual({ nome: 'MARIA EXEMPLO', documento: '529.982.247-25', nascimento: '01/02/1980', tipo: 'pf' });
    expect(leitura.desconhecidas).toEqual(['Apelido']);
    expect(leitura.faltando).toEqual([]);
  });

  it.each([['CPF', 'documento'], ['E-mail', 'emails'], ['Telefone', 'telefones'], ['estado civil', 'estado_civil'], ['Responsável', 'responsaveis']])(
    'quando o cabeçalho é o apelido "%s", então vale a coluna %s', (cabecalho, chave) => {
      // Dado
      const texto = `tipo;nome;${cabecalho}\npf;MARIA EXEMPLO;x\n`;
      // Quando
      const leitura = lerImportacao(texto);
      // Então
      expect(leitura.linhas[0].valores).toHaveProperty(chave, 'x');
    });

  it('quando falta a coluna nome, então "faltando" tem nome', () => {
    // Dado
    const texto = 'tipo;documento\npf;529.982.247-25\n';
    // Quando
    const leitura = lerImportacao(texto);
    // Então
    expect(leitura.faltando).toEqual(['nome']);
  });

  it('quando uma coluna aparece duas vezes, então vale a primeira e a outra é listada como repetida', () => {
    // Dado
    const texto = 'tipo;nome;Nome\npf;MARIA EXEMPLO;OUTRA\n';
    // Quando
    const leitura = lerImportacao(texto);
    // Então
    expect(leitura.linhas[0].valores.nome).toBe('MARIA EXEMPLO');
    expect(leitura.repetidas).toEqual(['Nome']);
  });

  it('quando há várias linhas, então cada uma leva o número da planilha (o cabeçalho é a 1)', () => {
    // Dado
    const texto = 'tipo;nome\npf;MARIA EXEMPLO\npj;PADARIA MODELO LTDA\n';
    // Quando
    const leitura = lerImportacao(texto);
    // Então
    expect(leitura.linhas.map(l => l.numero)).toEqual([2, 3]);
  });

  it('quando há uma linha em branco no meio, então a linha seguinte leva o número dela na planilha', () => {
    // Dado
    const texto = 'tipo;nome\npf;MARIA EXEMPLO\n;\n\npj;PADARIA MODELO LTDA\n';
    // Quando
    const leitura = lerImportacao(texto);
    // Então
    expect(leitura.linhas.map(l => l.numero)).toEqual([2, 5]);
  });

  it.each([['vazio', ''], ['só com o cabeçalho', 'tipo;nome\r\n']])('quando o arquivo está %s, então dá erro dizendo que não há pessoas', (_, texto) => {
    // Quando / Então
    expect(() => lerImportacao(texto)).toThrow('O arquivo não tem nenhuma pessoa');
  });

  it('quando o arquivo passa do máximo de linhas, então dá erro pedindo para dividir', () => {
    // Dado
    const texto = 'tipo;nome\n' + 'pf;MARIA EXEMPLO\n'.repeat(20001);
    // Quando / Então
    expect(() => lerImportacao(texto)).toThrow('Divida em partes');
  });

  it('quando o arquivo ainda tem as linhas de exemplo do modelo, então dá erro pedindo para apagá-las', () => {
    // Dado
    const texto = `referencia;tipo;nome\n${REFERENCIA_DO_EXEMPLO.toLowerCase()};pf;MARIA EXEMPLO\n`;
    // Quando / Então
    expect(() => lerImportacao(texto)).toThrow('Apague essas linhas');
  });
});

describe('Modelo de importação', () => {
  it('quando o modelo é baixado sem mudar nada, então a leitura recusa os exemplos', () => {
    // Quando / Então
    expect(() => lerImportacao(modeloImportacao())).toThrow(REFERENCIA_DO_EXEMPLO);
  });

  it('quando os exemplos ganham uma referência própria, então nenhuma coluna falta ou é desconhecida e as duas linhas entram sem erro', () => {
    // Dado
    let n = 0;
    const texto = modeloImportacao().replace(new RegExp(REFERENCIA_DO_EXEMPLO, 'g'), () => `site-${++n}`);
    // Quando
    const leitura = lerImportacao(texto);
    const linhas = leitura.linhas.map(l => normalizarLinha(l, CTX));
    // Então
    expect(leitura.desconhecidas).toEqual([]);
    expect(leitura.faltando).toEqual([]);
    expect(Object.keys(leitura.linhas[0].valores)).toHaveLength(COLUNAS_IMPORTACAO.length);
    expect(linhas.flatMap(erros)).toEqual([]);
    expect(linhas.map(l => [l.dados.tipo, l.dados.documento])).toEqual([['pf', CPF], ['pj', CNPJ]]);
  });

  it('quando o modelo é gerado, então tem BOM, ";" e o cabeçalho com as chaves; o nome do arquivo é o combinado', () => {
    // Quando
    const modelo = modeloImportacao();
    // Então
    expect(modelo.startsWith('﻿referencia;tipo;nome;documento;')).toBe(true);
    expect(lerCSV(modelo)).toHaveLength(3);
    expect(NOME_DO_MODELO).toBe('modelo-importacao-pessoas.csv');
  });

  it('quando as colunas são listadas, então cada chave aparece uma vez e os rótulos dos campos vêm de CAMPOS', () => {
    // Quando
    const chaves = COLUNAS_IMPORTACAO.map(c => c.chave);
    // Então
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(COLUNAS_IMPORTACAO.find(c => c.chave === 'nascimento')?.rotulo).toBe(CAMPOS.nascimento);
    expect(COLUNAS_IMPORTACAO.find(c => c.chave === 'referencia')?.limite).toBe(TAMANHO_REFERENCIA);
    expect(COLUNAS_IMPORTACAO.filter(c => c.obrigatoria).map(c => c.chave)).toEqual(['tipo', 'nome']);
  });
});

describe('Normalizar uma linha', () => {
  describe('Dado o tipo e o nome', () => {
    it.each([['pf', 'pf'], ['Pessoa jurídica', 'pj'], ['SOMENTE CONTATO', 'contato'], ['física', 'pf']])(
      'quando o tipo é "%s", então vira %s', (texto, tipo) => {
        // Quando
        const p = importar({ tipo: texto, nome: 'MARIA EXEMPLO' });
        // Então
        expect(p.dados.tipo).toBe(tipo);
      });

    it.each([['vazio', ''], ['desconhecido', 'cliente']])('quando o tipo é %s, então é erro', (_, tipo) => {
      // Quando
      const p = importar({ tipo, nome: 'MARIA EXEMPLO' });
      // Então
      expect(erros(p).map(e => e.campo)).toEqual(['tipo']);
    });

    it('quando a linha não tem nome, então é erro', () => {
      // Quando
      const p = importar({ tipo: 'pf', nome: '  ' });
      // Então
      expect(erros(p)).toEqual([{ linha: 2, campo: 'nome', gravidade: 'erro', mensagem: 'Informe o nome.' }]);
    });

    it('quando o nome vem em minúsculas e com espaços a mais, então fica em maiúsculas e com espaços simples', () => {
      // Quando
      const p = importar({ tipo: 'pf', nome: '  maria   exemplo ' });
      // Então
      expect(p.dados.nome).toBe('MARIA EXEMPLO');
    });
  });

  describe('Dado um CPF ou CNPJ', () => {
    it('quando o CPF vem com pontos, então fica só com os números', () => {
      // Quando
      const p = pf({ documento: '529.982.247-25' });
      // Então
      expect(p.dados.documento).toBe(CPF);
      expect(p.problemas).toEqual([]);
    });

    it('quando o CNPJ tem letras minúsculas, então fica em maiúsculas, sem pontuação', () => {
      // Quando
      const p = importar({ tipo: 'pj', nome: 'EMPRESA EXEMPLO LTDA', documento: '12.abc.345/01de-35' });
      // Então
      expect(p.dados.documento).toBe('12ABC34501DE35');
    });

    it.each([['pf', 'CPF', '529.982.247-26'], ['pj', 'CNPJ', '11.222.333/0001-82']])(
      'quando o documento de %s tem dígito errado, então entra sem ele, com pendência, observação e aviso (não erro)', (tipo, especie, doc) => {
        // Quando
        const p = importar({ tipo, nome: 'NOME EXEMPLO', documento: doc });
        // Então
        expect(p.dados.documento).toBeNull();
        expect(p.pendencias).toEqual(['documento_invalido']);
        expect(p.observacoes).toEqual([`${especie} digitado no arquivo: ${doc}`]);
        expect(avisos(p, 'documento')).toHaveLength(1);
        expect(erros(p)).toEqual([]);
      });

    it('quando o CPF perdeu o zero do começo no Excel, então é completado, com aviso', () => {
      // Quando
      const p = pf({ documento: '1234567890' });
      // Então
      expect(p.dados.documento).toBe('01234567890');
      expect(avisos(p, 'documento')[0].mensagem).toContain('012.345.678-90');
    });

    it('quando completar com zero não dá um CPF válido, então é tratado como inválido', () => {
      // Quando
      const p = pf({ documento: '5299822472' });
      // Então
      expect(p.dados.documento).toBeNull();
      expect(p.pendencias).toEqual(['documento_invalido']);
    });

    it('quando o CPF veio em notação científica, então é erro explicado', () => {
      // Quando
      const p = pf({ documento: '5,29982E+10' });
      // Então
      expect(erros(p)).toHaveLength(1);
      expect(erros(p)[0].mensagem).toContain('notação científica');
      expect(erros(p)[0].mensagem).not.toContain('5,29982E+10');
    });

    it.each([['11 algarismos', CPF, CPF], ['14 caracteres', '11.222.333/0001-81', CNPJ]])(
      'quando um somente contato tem documento de %s, então é conferido pelo formato', (_, doc, esperado) => {
        // Quando
        const p = importar({ tipo: 'contato', nome: 'CONTATO EXEMPLO', documento: doc });
        // Então
        expect(p.dados.documento).toBe(esperado);
      });

    it('quando o documento é inválido, então o texto digitado fica guardado para achar linhas repetidas', () => {
      // Quando
      const p = pf({ documento: '123.456.789-00' });
      // Então
      expect(p.documentoNoArquivo).toBe('12345678900');
    });
  });

  describe('Dado o gênero', () => {
    it('quando a pessoa física vem sem gênero, então fica sem gênero e sem aviso', () => {
      // Quando
      const p = pf();
      // Então
      expect(p.dados.genero).toBeNull();
      expect(p.problemas).toEqual([]);
    });

    it('quando o gênero não é reconhecido, então fica vazio, com aviso', () => {
      // Quando
      const p = pf({ genero: 'x' });
      // Então
      expect(p.dados.genero).toBeNull();
      expect(avisos(p, 'genero')).toHaveLength(1);
    });

    it('quando um MEI vem com gênero "F", então guarda f e a natureza é deduzida', () => {
      // Quando
      const p = importar({ tipo: 'pj', nome: 'MARIA EXEMPLO', tipo_entidade: 'MEI', genero: 'F' });
      // Então
      expect(p.dados).toMatchObject({ genero: 'f', tipo_entidade: 'Microempreendedor(a) Individual (MEI)', natureza: 'empresarial' });
    });

    it('quando uma Ltda vem com gênero, então o gênero fica vazio, com aviso', () => {
      // Quando
      const p = importar({ tipo: 'pj', nome: 'PADARIA MODELO LTDA', tipo_entidade: 'Sociedade Empresária Limitada', genero: 'm' });
      // Então
      expect(p.dados.genero).toBeNull();
      expect(avisos(p, 'genero')).toHaveLength(1);
    });
  });

  describe('Dados os campos com lista fechada', () => {
    it.each([['Casada', 'casado'], ['casado(a)', 'casado'], ['Viúva', 'viuvo'], ['união estável', 'uniao_estavel']])(
      'quando o estado civil é "%s", então vira %s', (texto, chave) => {
        // Quando
        const p = pf({ estado_civil: texto });
        // Então
        expect(p.dados.estado_civil).toBe(chave);
      });

    it('quando o estado civil não é reconhecido, então fica vazio e o texto vai para a observação, com aviso', () => {
      // Quando
      const p = pf({ estado_civil: 'enrolado' });
      // Então
      expect(p.dados.estado_civil).toBeNull();
      expect(p.observacoes).toEqual(['Estado civil no arquivo: enrolado']);
      expect(avisos(p, 'estado_civil')).toHaveLength(1);
    });

    it('quando o porte é "ME", então vira me', () => {
      // Quando
      const p = importar({ tipo: 'pj', nome: 'PADARIA MODELO LTDA', porte: 'ME' });
      // Então
      expect(p.dados.porte).toBe('me');
    });

    it('quando o tipo de entidade não é da natureza informada, então fica vazio, com aviso e observação', () => {
      // Quando
      const p = importar({ tipo: 'pj', nome: 'PADARIA MODELO LTDA', natureza: 'empresarial', tipo_entidade: 'Município' });
      // Então
      expect(p.dados).toMatchObject({ natureza: 'empresarial', tipo_entidade: null });
      expect(p.observacoes).toEqual(['Tipo de entidade no arquivo: Município']);
    });

    it('quando a nacionalidade é "Brasileiro", então fica "brasileira", como no formulário', () => {
      // Quando
      const p = pf({ nacionalidade: 'Brasileiro' });
      // Então
      expect(p.dados.nacionalidade).toBe('brasileira');
    });
  });

  describe('Dadas as datas', () => {
    it('quando o nascimento é 1/2/1980, então vira 1980-02-01', () => {
      // Quando
      const p = pf({ nascimento: '1/2/1980' });
      // Então
      expect(p.dados.nascimento).toBe('1980-02-01');
    });

    it.each([['inexistente', '31/02/2000'], ['no futuro', '01/01/2030']])('quando a data é %s, então fica vazia, com aviso e observação', (_, texto) => {
      // Quando
      const p = pf({ nascimento: texto });
      // Então
      expect(p.dados.nascimento).toBeNull();
      expect(avisos(p, 'nascimento')).toHaveLength(1);
      expect(p.observacoes).toEqual([`Data de nascimento no arquivo: ${texto}`]);
    });

    it('quando a data de cadastro é 15/03/2019, então vira 15 de março de 2019', () => {
      // Quando
      const p = pf({ cadastrado_em: '15/03/2019' });
      // Então
      expect(p.cadastradoEm?.slice(0, 10)).toBe('2019-03-15');
    });

    it('quando a data de cadastro é hoje à noite (no horário de Brasília), então vale', () => {
      // Quando
      const p = pf({ cadastrado_em: '31/10/2026 23:30' });
      // Então
      expect(p.cadastradoEm).toBe('2026-11-01T02:30:00.000Z');
      expect(avisos(p, 'cadastrado_em')).toEqual([]);
    });

    it.each([['no futuro', '01/01/2030'], ['amanhã logo depois da meia-noite', '01/11/2026 00:30'], ['antes de 1900', '01/01/1890'],
      ['ilegível', 'ontem']])(
      'quando a data de cadastro é %s, então fica vazia (vale hoje), com aviso', (_, texto) => {
        // Quando
        const p = pf({ cadastrado_em: texto });
        // Então
        expect(p.cadastradoEm).toBeNull();
        expect(avisos(p, 'cadastrado_em')).toHaveLength(1);
      });
  });

  describe('Dado o endereço', () => {
    it('quando a UF vem em minúsculas, então fica em maiúsculas', () => {
      // Quando
      const p = pf({ uf: 'mg' });
      // Então
      expect(p.dados.uf).toBe('MG');
    });

    it('quando a UF não existe, então fica vazia, com observação e aviso', () => {
      // Quando
      const p = pf({ uf: 'XX' });
      // Então
      expect(p.dados.uf).toBeNull();
      expect(p.observacoes).toEqual(['UF no arquivo: XX']);
      expect(avisos(p, 'uf')).toHaveLength(1);
    });

    it.each([['39400-000', '39400000'], ['39.400-000', '39400000']])('quando o CEP é %s, então fica %s', (texto, cep) => {
      // Quando
      const p = pf({ cep: texto });
      // Então
      expect(p.dados.cep).toBe(cep);
    });

    it('quando o CEP perdeu o zero do começo no Excel, então é completado, com aviso', () => {
      // Quando
      const p = pf({ cep: '1310100' });
      // Então
      expect(p.dados.cep).toBe('01310100');
      expect(avisos(p, 'cep')[0].mensagem).toContain('01310-100');
    });

    it.each(['123', '123456', '3,94E+07', 'CEP 39400'])('quando o CEP é "%s", então fica vazio, com observação e aviso', texto => {
      // Quando
      const p = pf({ cep: texto });
      // Então
      expect(p.dados.cep).toBeNull();
      expect(p.observacoes).toEqual([`CEP no arquivo: ${texto}`]);
    });

    it('quando um somente contato vem com endereço, então o endereço fica de fora, com aviso', () => {
      // Quando
      const p = importar({ tipo: 'contato', nome: 'CONTATO EXEMPLO', municipio: 'Montes Claros' });
      // Então
      expect(p.dados.municipio).toBeNull();
      expect(avisos(p, 'tipo')[0].mensagem).toContain('Município');
    });

    it('quando uma pessoa física vem com tipo de entidade, então os campos de pessoa jurídica ficam vazios', () => {
      // Quando
      const p = pf({ tipo_entidade: 'Sociedade Empresária Limitada', nome_fantasia: 'PADARIA' });
      // Então
      expect(p.dados).toMatchObject({ natureza: null, tipo_entidade: null, nome_fantasia: null });
      expect(avisos(p, 'tipo')).toHaveLength(1);
    });
  });

  describe('Dados telefones e e-mails', () => {
    it('quando o mesmo celular vem com e sem o 9 e com +55, então fica um só', () => {
      // Quando
      const p = pf({ telefones: '38 8201-0240 | +55 (38) 98201-0240' });
      // Então
      expect(p.dados.telefones).toEqual(['(38) 98201-0240']);
    });

    it('quando um telefone não tem DDD, então fica de fora, com aviso e observação', () => {
      // Quando
      const p = pf({ telefones: '8201-0240 | (38) 3222-0000' });
      // Então
      expect(p.dados.telefones).toEqual(['(38) 3222-0000']);
      expect(avisos(p, 'telefones')).toHaveLength(1);
      expect(p.observacoes).toEqual(['Telefones no arquivo: 8201-0240']);
    });

    it('quando os e-mails se repetem em maiúsculas e um não tem arroba, então fica um só, em minúsculas, e um aviso', () => {
      // Quando
      const p = pf({ emails: 'MARIA@X.COM | maria@x.com | sem-arroba' });
      // Então
      expect(p.dados.emails).toEqual(['maria@x.com']);
      expect(avisos(p, 'emails')).toHaveLength(1);
    });

    it.each([
      ['uma fórmula com 12 algarismos', '+HYPERLINK("http://x.example/123456789012","clique")'],
      ['letras no meio', '-1+1234567890+SUM(A1)'],
      ['um sinal de menos na frente', '-1+12345678901']
    ])('quando o telefone tem %s, então fica de fora, com aviso e observação', (_, texto) => {
      // Quando
      const p = pf({ telefones: `${texto} | (38) 3222-0000` });
      // Então
      expect(p.dados.telefones).toEqual(['(38) 3222-0000']);
      expect(avisos(p, 'telefones').some(a => a.mensagem.includes('não reconhecido'))).toBe(true);
      expect(p.observacoes).toEqual([`Telefones no arquivo: ${texto}`]);
    });

    it.each([['+55 (38) 98201-0240', '(38) 98201-0240'], ['(38) 3222.0000', '(38) 3222-0000'], ['38 3222 0000', '(38) 3222-0000']])(
      'quando o telefone é "%s", então fica "%s", sem aviso', (texto, esperado) => {
        // Quando
        const p = pf({ telefones: texto });
        // Então
        expect(p.dados.telefones).toEqual([esperado]);
        expect(p.problemas).toEqual([]);
      });

    it('quando os itens vêm um por linha na célula, então também se separam', () => {
      // Quando
      const p = pf({ emails: 'maria@exemplo.com\nmaria2@exemplo.com' });
      // Então
      expect(p.dados.emails).toEqual(['maria@exemplo.com', 'maria2@exemplo.com']);
    });
  });

  describe('Dada a base legal (LGPD)', () => {
    it('quando vem vazia, então vale a escolhida na tela', () => {
      // Quando
      const [padrao, outra] = [pf(), importar({ tipo: 'pf', nome: 'MARIA EXEMPLO' }, 2, { ...CTX, lgpdPadrao: 'processo' })];
      // Então
      expect(padrao.dados.lgpd_base).toBe('contrato');
      expect(outra.dados.lgpd_base).toBe('processo');
    });

    it('quando vem o rótulo, então vira a chave', () => {
      // Quando
      const p = pf({ lgpd_base: 'Consentimento do titular (art. 7º, I)', lgpd_consentimento: '10/01/2020' });
      // Então
      expect(p.dados).toMatchObject({ lgpd_base: 'consentimento', lgpd_consentimento: '2020-01-10' });
    });

    it('quando vem data de consentimento com outra base, então a data fica de fora, com aviso', () => {
      // Quando
      const p = pf({ lgpd_base: 'contrato', lgpd_consentimento: '10/01/2020' });
      // Então
      expect(p.dados.lgpd_consentimento).toBeNull();
      expect(avisos(p, 'lgpd_consentimento')).toHaveLength(1);
    });

    it('quando a base não é reconhecida, então vale a da tela, com aviso', () => {
      // Quando
      const p = pf({ lgpd_base: 'porque sim' });
      // Então
      expect(p.dados.lgpd_base).toBe('contrato');
      expect(avisos(p, 'lgpd_base')).toHaveLength(1);
    });
  });

  describe('Dadas a observação, a conferência e os responsáveis', () => {
    it('quando "conferir" está preenchido, então a pendência "conferir" entra e o texto vai para a observação', () => {
      // Quando
      const p = pf({ observacoes: 'Cliente antigo.', conferir: 'telefone desatualizado' });
      // Então
      expect(p.pendencias).toEqual(['conferir']);
      expect(textoDaObservacao(p.observacoes)).toBe('Cliente antigo.\nA conferir: telefone desatualizado');
      expect(PENDENCIAS.conferir).toBe('Dados a conferir');
    });

    it('quando os responsáveis se repetem com outra grafia, então cada nome fica uma vez', () => {
      // Quando
      const p = pf({ responsaveis: 'Ana Lima | ana lima | @joao.silva' });
      // Então
      expect(p.nomesResponsaveis).toEqual(['Ana Lima', '@joao.silva']);
    });

    it('quando a observação toda passa do limite, então é erro', () => {
      // Quando
      const p = pf({ observacoes: 'a'.repeat(TAMANHO_OBSERVACOES), conferir: 'confira' });
      // Então
      expect(erros(p).map(e => e.campo)).toEqual(['observacoes']);
    });

    it.each([['nome', TAMANHO_PESSOA.nome], ['referencia', TAMANHO_REFERENCIA]] as const)(
      'quando %s passa do limite, então é erro', (campo, limite) => {
        // Quando
        const p = pf({ [campo]: 'A'.repeat(limite + 1) });
        // Então
        expect(erros(p).map(e => e.campo)).toEqual([campo]);
      });
  });

  describe('Dado um texto que a planilha leria como fórmula', () => {
    it.each([['nome', '=HIPERLINK("x")', 'HIPERLINK("X")'], ['profissao', '-professora', 'professora'], ['bairro', '@Centro', 'Centro'],
      ['complemento', '+1', '1'], ['rg', '\t=MG-1', 'MG-1'], ['numero', '+SUM(A1)', 'SUM(A1)'], ['numero', "+cmd|' /C calc'!A0", "cmd|' /C calc'!A0"]] as const)(
      'quando %s começa com fórmula, então o começo sai, com aviso', (campo, texto, esperado) => {
        // Quando
        const p = pf({ [campo]: texto });
        // Então
        expect(p.dados[campo]).toBe(esperado);
        expect(avisos(p, campo)).toHaveLength(1);
      });

    it('quando o telefone começa com +55, então fica como está, sem aviso', () => {
      // Quando
      const p = pf({ telefones: '+55 (38) 98201-0240' });
      // Então
      expect(p.dados.telefones).toEqual(['(38) 98201-0240']);
      expect(p.problemas).toEqual([]);
    });

    it('quando o número do endereço é só "-", então fica vazio, com aviso', () => {
      // Quando
      const p = pf({ numero: '-' });
      // Então
      expect(p.dados.numero).toBeNull();
      expect(avisos(p, 'numero')).toHaveLength(1);
    });

    it('quando o texto começa com apóstrofo sem fórmula depois, então o apóstrofo fica', () => {
      // Quando
      const p = pf({ complemento: "'casa dos fundos'" });
      // Então
      expect(p.dados.complemento).toBe("'casa dos fundos'");
      expect(p.problemas).toEqual([]);
    });

    it('quando um item de uma lista começa com =, então o começo sai daquele item', () => {
      // Quando
      const p = pf({ emails: 'maria@exemplo.com | =maria2@exemplo.com' });
      // Então
      expect(p.dados.emails).toEqual(['maria@exemplo.com', 'maria2@exemplo.com']);
      expect(avisos(p, 'emails')).toHaveLength(1);
    });
  });
});

describe('Achar o responsável na equipe', () => {
  it.each([
    ['joão silva', 'u-joao'],
    ['@ana.lima', 'u-ana'],
    ['ana.souza', 'u-ana2'],
    ['Ana Lima', 'u-ana'],
    ['Souza', 'u-ana2']
  ])('quando o arquivo diz "%s", então acha %s', (texto, id) => {
    // Quando
    const achado = acharResponsavel(texto, EQUIPE);
    // Então
    expect(achado).toEqual({ membro: EQUIPE.find(m => m.id === id) });
  });

  it.each([['Ana', 'ambiguo'], ['Zé Ninguém', 'nao_achado'], ['Carla', 'nao_achado'], ['', 'nao_achado']])(
    'quando o arquivo diz "%s", então o motivo é %s', (texto, motivo) => {
      // Quando
      const achado = acharResponsavel(texto, EQUIPE);
      // Então
      expect(achado).toEqual({ motivo });
    });

  it('quando os nomes se repetem em várias linhas, então cada um aparece uma vez, com a contagem e a sugestão', () => {
    // Dado
    const linhas = [pf({ responsaveis: 'Ana Lima | Ana' }), pf({ responsaveis: 'ana lima' }, 3), importar({ tipo: '', nome: 'X', responsaveis: 'Zé' }, 4)];
    // Quando
    const nomes = nomesDeResponsaveis(linhas, EQUIPE);
    // Então
    expect(nomes).toEqual([
      { texto: 'Ana Lima', quantas: 2, sugestao: 'u-ana' },
      { texto: 'Ana', quantas: 1, sugestao: null, motivo: 'ambiguo' }
    ]);
  });
});

describe('Completar um cadastro que já existe', () => {
  it('quando o cadastro não tem CPF e o arquivo traz um válido, então o CPF entra; se já tem, não muda', () => {
    // Dado
    const nova = pf({ documento: CPF_2 }).dados;
    // Quando
    const [semDocumento, comDocumento] = [completarVazios(existente({ documento: null }), nova), completarVazios(existente(), nova)];
    // Então
    expect(semDocumento).toEqual({ documento: CPF_2 });
    expect(comDocumento).toEqual({});
  });

  it('quando o cadastro já tem município, nome e base legal, então nada disso muda', () => {
    // Dado
    const atual = existente({ municipio: 'Montes Claros', lgpd_base: 'processo' });
    const nova = pf({ nome: 'OUTRO NOME', municipio: 'Bocaiuva', lgpd_base: 'contrato', documento: CPF_2 }).dados;
    // Quando
    const mudancas = completarVazios(atual, nova);
    // Então
    expect(mudancas).toEqual({});
  });

  it('quando o cadastro tem campos vazios, então só eles são preenchidos', () => {
    // Dado
    const atual = existente({ profissao: 'professora' });
    const nova = pf({ profissao: 'advogada', rg: 'MG-1', municipio: 'Montes Claros' }).dados;
    // Quando
    const mudancas = completarVazios(atual, nova);
    // Então
    expect(mudancas).toEqual({ rg: 'MG-1', municipio: 'Montes Claros' });
  });

  it('quando o cadastro já tem telefone, então os novos são acrescentados depois, sem repetir', () => {
    // Dado
    const atual = existente({ telefones: ['(38) 98201-0240'] });
    const nova = pf({ telefones: '38 8201-0240 | (38) 3222-0000' }).dados;
    // Quando
    const mudancas = completarVazios(atual, nova);
    // Então
    expect(mudancas).toEqual({ telefones: ['(38) 98201-0240', '(38) 3222-0000'] });
  });

  it('quando os e-mails do arquivo já estão no cadastro (com outra caixa), então não há mudança', () => {
    // Dado
    const atual = existente({ emails: ['Maria@Exemplo.com'] });
    const nova = pf({ emails: 'maria@exemplo.com' }).dados;
    // Quando
    const mudancas = completarVazios(atual, nova);
    // Então
    expect(mudancas).toEqual({});
  });

  it.each([
    ['pessoa física sem gênero', {}, 'f'],
    ['pessoa física com gênero', { genero: 'm' as const }, undefined],
    ['MEI sem gênero', { tipo: 'pj' as const, tipo_entidade: 'Microempreendedor(a) Individual (MEI)', natureza: 'empresarial' }, 'f'],
    ['Ltda sem gênero', { tipo: 'pj' as const, tipo_entidade: 'Sociedade Empresária Limitada', natureza: 'empresarial' }, undefined]
  ])('quando o cadastro é %s e o arquivo traz "f", então o gênero completado é %s', (_, extra, genero) => {
    // Dado
    const atual = existente(extra);
    // Quando
    const mudancas = completarVazios(atual, { genero: 'f' });
    // Então
    expect(mudancas.genero).toBe(genero);
  });

  it('quando o cadastro é pessoa física, então campos de pessoa jurídica não entram; somente contato não ganha endereço', () => {
    // Dado
    const nova = { nome_fantasia: 'PADARIA', municipio: 'Montes Claros' };
    // Quando
    const [fisica, contato] = [completarVazios(existente(), nova), completarVazios(existente({ tipo: 'contato' }), nova)];
    // Então
    expect(fisica).toEqual({ municipio: 'Montes Claros' });
    expect(contato).toEqual({});
  });

  it('quando o tipo de entidade é de outra natureza, então não entra', () => {
    // Dado
    const atual = existente({ tipo: 'pj', natureza: 'empresarial', documento: CNPJ });
    // Quando
    const mudancas = completarVazios(atual, { natureza: 'publica', tipo_entidade: 'Município' });
    // Então
    expect(mudancas).toEqual({});
  });

  it('quando o cadastro não tem base legal, então ela entra com a data do consentimento', () => {
    // Dado
    const atual = existente({ lgpd_base: null });
    // Quando
    const mudancas = completarVazios(atual, { lgpd_base: 'consentimento', lgpd_consentimento: '2020-01-10' });
    // Então
    expect(mudancas).toEqual({ lgpd_base: 'consentimento', lgpd_consentimento: '2020-01-10' });
  });

  it('quando os responsáveis se juntam, então ninguém sai e ninguém se repete', () => {
    // Quando / Então
    expect(juntarResponsaveis(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it.each([
    [null, 'Nova.', 'Nova.'],
    ['Antiga.', 'Nova.', 'Antiga.\nNova.'],
    ['Antiga.\nNova.', 'Nova.', 'Antiga.\nNova.'],
    ['Antiga.', null, 'Antiga.']
  ])('quando a observação é %j e chega %j, então fica %j', (atual, nova, esperado) => {
    // Quando / Então
    expect(juntarObservacoes(atual, nova)).toBe(esperado);
  });
});

describe('Classificar as linhas', () => {
  it('quando o documento não existe no SEMPER, então é novo, com o cadastro todo', () => {
    // Dado
    const linha = pf({ documento: CPF, responsaveis: 'Ana Lima' });
    // Quando
    const [c] = classificar([linha], [], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'novo', existente: null, mudancas: linha.dados, responsaveisNovos: ['u-ana'], arquivada: false });
  });

  it('quando o documento existe e o cadastro não tem e-mail, então é completar, só com os e-mails', () => {
    // Dado
    const linha = pf({ documento: CPF, emails: 'maria@exemplo.com', municipio: 'Montes Claros' });
    const atual = existente({ municipio: 'Bocaiuva' });
    // Quando
    const [c] = classificar([linha], [atual], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'completar', existente: atual, mudancas: { emails: ['maria@exemplo.com'] } });
  });

  it('quando não há nada a completar, então é sem mudança', () => {
    // Dado
    const linha = pf({ documento: CPF, responsaveis: 'Ana Lima' });
    // Quando
    const [c] = classificar([linha], [existente({ resp: [{ perfil_id: 'u-ana' }] })], MAPA);
    // Então
    expect(c.situacao).toBe('sem_mudanca');
  });

  it('quando só o responsável é novo, então é completar, com ele', () => {
    // Dado
    const linha = pf({ documento: CPF, responsaveis: 'Ana Lima | João Silva' });
    // Quando
    const [c] = classificar([linha], [existente({ resp: [{ perfil_id: 'u-ana' }] })], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'completar', responsaveisNovos: ['u-joao'] });
  });

  it.each([['nova', null, 'completar'], ['que já está lá', 'Antes.\nCliente antigo.', 'sem_mudanca']])(
    'quando a observação do arquivo é %s, então a linha é %s', (_, observacoes, situacao) => {
      // Dado
      const linha = pf({ documento: CPF, observacoes: 'Cliente antigo.' });
      // Quando
      const [c] = classificar([linha], [existente({ observacoes })], MAPA);
      // Então
      expect(c.situacao).toBe(situacao);
    });

  it('quando o cadastro tem outro nome, então é para decidir (nome diferente)', () => {
    // Dado
    const linha = pf({ documento: CPF, nome: 'JOANA EXEMPLO' });
    // Quando
    const [c] = classificar([linha], [existente()], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'decidir', motivo: 'nome_diferente' });
  });

  it('quando o cadastro achado pela referência não tem CPF e o arquivo traz o CPF corrigido, então é completar, com o CPF', () => {
    // Dado
    const linha = pf({ referencia: 'site-1', documento: CPF_2 });
    // Quando
    const [c] = classificar([linha], [existente({ documento: null, referencia: 'site-1', pendencias: ['documento_invalido'] })], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'completar', mudancas: { documento: CPF_2 } });
  });

  it('quando o cadastro achado pela referência tem outro CPF, então é para decidir, e completar guarda o CPF do arquivo na observação', () => {
    // Dado
    const linha = pf({ referencia: 'site-1', documento: CPF_2 });
    const atual = existente({ referencia: 'site-1' });
    // Quando
    const c = classificar([linha], [atual], MAPA);
    const { itens } = planejar([linha], c, { [linha.linha]: 'usar_cadastro' }, MAPA);
    // Então
    expect(c[0]).toMatchObject({ situacao: 'decidir', motivo: 'documento_diferente' });
    expect(opcoesDaLinha(c[0])).toEqual(['usar_cadastro', 'nao_importar']);
    expect(itens[0].dados.documento).toBeUndefined();
    expect(itens[0].observacoes).toContain('CPF/CNPJ no arquivo importado: 111.444.777-35');
  });

  it('quando o cadastro de outro nome foi achado pela referência, então a explicação também fala da referência', () => {
    // Dado
    const linha = pf({ referencia: 'site-1', nome: 'JOANA EXEMPLO' });
    // Quando
    const [c] = classificar([linha], [existente({ documento: null, referencia: 'site-1' })], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'decidir', motivo: 'nome_diferente' });
    expect(DECISOES.nome_diferente.explicacao).toContain('referência');
  });

  it.each([['com algo a completar', { emails: 'maria@exemplo.com' }, 'completar'], ['sem nada a completar', {}, 'sem_mudanca']])(
    'quando o cadastro está arquivado e a linha vem %s, então é %s e continua arquivado', (_, valores, situacao) => {
      // Dado
      const linha = pf({ documento: CPF, ...valores });
      // Quando
      const [c] = classificar([linha], [existente({ arquivado_em: '2024-01-01T12:00:00.000Z' })], MAPA);
      // Então
      expect(c).toMatchObject({ situacao, arquivada: true });
      expect(c.motivo).toBeUndefined();
      expect(DICA_ARQUIVADA).toBe('Está arquivada: continua arquivada.');
    });

  it('quando o mesmo CPF aparece em duas linhas, então as duas são para decidir (repetido no arquivo)', () => {
    // Dado
    const linhas = [pf({ documento: CPF }), pf({ documento: '529.982.247-25', nome: 'OUTRA' }, 3)];
    // Quando
    const c = classificar(linhas, [], MAPA);
    // Então
    expect(c.map(x => [x.situacao, x.motivo])).toEqual([['decidir', 'repetido_no_arquivo'], ['decidir', 'repetido_no_arquivo']]);
  });

  it('quando o mesmo CPF inválido foi digitado em duas linhas, então as duas são para decidir', () => {
    // Dado
    const linhas = [pf({ documento: '123.456.789-00' }), pf({ documento: '12345678900' }, 3)];
    // Quando
    const c = classificar(linhas, [], MAPA);
    // Então
    expect(c.map(x => x.motivo)).toEqual(['repetido_no_arquivo', 'repetido_no_arquivo']);
  });

  it('quando a outra linha com o mesmo CPF tem erro, então ela é recusada e a primeira é nova', () => {
    // Dado
    const linhas = [pf({ documento: CPF }), importar({ tipo: 'pf', nome: '', documento: CPF }, 3)];
    // Quando
    const c = classificar(linhas, [], MAPA);
    // Então
    expect(c.map(x => x.situacao)).toEqual(['novo', 'recusada']);
  });

  it('quando a linha não tem documento mas tem a referência de um cadastro, então ele é achado pela referência', () => {
    // Dado
    const linha = importar({ tipo: 'contato', nome: 'CONTATO EXEMPLO', referencia: 'site-12', emails: 'contato@exemplo.com' });
    const atual = existente({ tipo: 'contato', nome: 'CONTATO EXEMPLO', documento: null, referencia: 'site-12' });
    // Quando
    const [c] = classificar([linha], [atual], MAPA);
    // Então
    expect(c).toMatchObject({ situacao: 'completar', existente: atual });
  });
});

describe('Planejar a gravação', () => {
  const planejarTudo = (linhas: PessoaImportada[], existentes: PessoaExistente[], decisoes: Record<number, Decisao> = {}) =>
    planejar(linhas, classificar(linhas, existentes, MAPA), decisoes, MAPA);

  it('quando a linha é nova, então o item leva o cadastro, a data antiga, os responsáveis ligados, a observação e as pendências', () => {
    // Dado
    const linha = pf({ documento: '529.982.247-26', referencia: 'site-1', cadastrado_em: '15/03/2019', responsaveis: 'Ana Lima | Ninguém' });
    // Quando
    const { itens, problemas } = planejarTudo([linha], []);
    // Então
    expect(problemas).toEqual([]);
    expect(itens).toEqual([{
      linha: 2, referencia: 'site-1', existente_id: null, dados: linha.dados, criado_em: '2019-03-15T12:00:00.000Z',
      responsaveis: ['u-ana'], observacoes: 'CPF digitado no arquivo: 529.982.247-26', pendencias: ['documento_invalido']
    }]);
  });

  it('quando a linha completa um cadastro, então o item leva só as mudanças, os responsáveis novos e a observação a acrescentar', () => {
    // Dado
    const linha = pf({ documento: CPF, emails: 'maria@exemplo.com', responsaveis: 'Ana Lima | João Silva', observacoes: 'Nova.', cadastrado_em: '15/03/2019' });
    const atual = existente({ resp: [{ perfil_id: 'u-ana' }], observacoes: 'Antiga.' });
    // Quando
    const { itens } = planejarTudo([linha], [atual]);
    // Então
    expect(itens).toEqual([{
      linha: 2, referencia: null, existente_id: 'p-1', dados: { emails: ['maria@exemplo.com'] }, criado_em: null,
      responsaveis: ['u-joao'], observacoes: 'Nova.', pendencias: []
    }]);
  });

  it('quando a observação do arquivo já está no cadastro, então nada é acrescentado', () => {
    // Dado
    const linha = pf({ documento: CPF, emails: 'maria@exemplo.com', observacoes: 'Antiga.' });
    // Quando
    const { itens } = planejarTudo([linha], [existente({ observacoes: 'Antiga.' })]);
    // Então
    expect(itens[0].observacoes).toBeNull();
  });

  it('quando a observação do cadastro passaria do limite, então é problema e a linha fica de fora', () => {
    // Dado
    const linha = pf({ documento: CPF, emails: 'maria@exemplo.com', observacoes: 'Nova.' });
    // Quando
    const { itens, problemas } = planejarTudo([linha], [existente({ observacoes: 'a'.repeat(TAMANHO_OBSERVACOES - 2) })]);
    // Então
    expect(itens).toEqual([]);
    expect(problemas.map(p => [p.linha, p.campo])).toEqual([[2, 'observacoes']]);
  });

  it('quando as linhas são recusadas ou sem mudança, então não vão para o banco', () => {
    // Dado
    const linhas = [importar({ tipo: 'pf', nome: '' }), pf({ documento: CPF }, 3)];
    // Quando
    const { itens } = planejarTudo(linhas, [existente()]);
    // Então
    expect(itens).toEqual([]);
  });

  it('quando a linha para decidir não tem decisão, então fica de fora, sem problema', () => {
    // Dado
    const linha = pf({ documento: CPF, nome: 'JOANA EXEMPLO' });
    // Quando
    const { itens, problemas } = planejarTudo([linha], [existente()]);
    // Então
    expect(itens).toEqual([]);
    expect(problemas).toEqual([]);
  });

  it('quando duas linhas escolhem entrar com o mesmo CPF, então é problema e as duas ficam de fora', () => {
    // Dado
    const linhas = [pf({ documento: CPF }), pf({ documento: CPF, nome: 'OUTRA' }, 3)];
    // Quando
    const { itens, problemas } = planejarTudo(linhas, [], { 2: 'manter_documento', 3: 'manter_documento' });
    // Então
    expect(itens).toEqual([]);
    expect(problemas.map(p => p.linha)).toEqual([2, 3]);
    expect(problemas[0].mensagem).toContain('só uma pode');
  });

  it('quando uma linha repetida fica com o CPF e a outra entra sem ele, então a segunda leva o CPF na observação e a pendência "conferir"', () => {
    // Dado
    const linhas = [pf({ documento: CPF, referencia: 'site-1' }), pf({ documento: CPF, nome: 'OUTRA', referencia: 'site-2' }, 3)];
    // Quando
    const { itens, problemas } = planejarTudo(linhas, [], { 2: 'manter_documento', 3: 'nova_sem_documento' });
    // Então
    expect(problemas).toEqual([]);
    expect(itens.map(i => [i.linha, i.dados.documento, i.referencia])).toEqual([[2, CPF, 'site-1'], [3, null, 'site-2']]);
    expect(itens[1].observacoes).toContain('CPF/CNPJ no arquivo: 529.982.247-25');
    expect(itens[1].pendencias).toEqual(['conferir']);
  });

  it('quando a linha repetida pela referência entra sem documento, então também entra sem a referência', () => {
    // Dado
    const linhas = [pf({ referencia: 'site-1' }), pf({ referencia: 'site-1', nome: 'OUTRA' }, 3)];
    // Quando
    const { itens } = planejarTudo(linhas, [], { 2: 'manter_documento', 3: 'nova_sem_documento' });
    // Então
    expect(itens.map(i => i.referencia)).toEqual(['site-1', null]);
  });

  it('quando a pessoa de outro nome é ligada ao cadastro existente, então o nome do arquivo vai para a observação', () => {
    // Dado
    const linha = pf({ documento: CPF, nome: 'JOANA EXEMPLO', emails: 'joana@exemplo.com' });
    // Quando
    const { itens } = planejarTudo([linha], [existente()], { 2: 'usar_cadastro' });
    // Então
    expect(itens).toMatchObject([{ existente_id: 'p-1', dados: { emails: ['joana@exemplo.com'] }, observacoes: 'Nome no arquivo importado: JOANA EXEMPLO' }]);
  });

  it('quando a escolha não cabe na linha, então é problema', () => {
    // Dado
    const linha = pf({ documento: CPF, nome: 'JOANA EXEMPLO' });
    // Quando
    const { itens, problemas } = planejarTudo([linha], [existente()], { 2: 'manter_documento' });
    // Então
    expect(itens).toEqual([]);
    expect(problemas).toHaveLength(1);
  });

  it('quando a linha tem nome diferente, então as opções são completar, entrar sem o documento ou não importar', () => {
    // Dado
    const linha = pf({ documento: CPF, nome: 'JOANA EXEMPLO' });
    // Quando
    const [c] = classificar([linha], [existente()], MAPA);
    // Então
    expect(opcoesDaLinha(c)).toEqual(['usar_cadastro', 'nova_sem_documento', 'nao_importar']);
    expect(DECISOES.nome_diferente.opcoes).not.toContain('manter_documento');
  });

  it('quando a linha é repetida no arquivo e o CPF não existe no SEMPER, então dá para manter o documento, mas não completar', () => {
    // Dado
    const c: Classificacao = { linha: 2, situacao: 'decidir', motivo: 'repetido_no_arquivo', existente: null, mudancas: {}, responsaveisNovos: [], arquivada: false };
    // Quando
    const opcoes = opcoesDaLinha(c);
    // Então
    expect(opcoes).toEqual(['manter_documento', 'nova_sem_documento', 'nao_importar']);
    expect(opcoes.map(o => ROTULO_DECISAO[o])).toContain('Não importar');
  });
});

describe('Lotes e resumo', () => {
  it('quando 450 itens são divididos em lotes de 200, então ficam 200, 200 e 50', () => {
    // Quando
    const lotes = emLotes(Array.from({ length: 450 }, (_, i) => i), 200);
    // Então
    expect(lotes.map(l => l.length)).toEqual([200, 200, 50]);
  });

  it('quando o lote tem tamanho zero, então dá erro', () => {
    // Quando / Então
    expect(() => emLotes([1], 0)).toThrow('pelo menos 1 item');
  });

  it('quando as linhas são classificadas, então o resumo conta cada situação e as que entram com pendência', () => {
    // Dado
    const linhas = [
      pf({ documento: '529.982.247-26' }), pf({ documento: CPF_2, emails: 'a@exemplo.com' }, 3), pf({ documento: CPF }, 4),
      importar({ tipo: 'pf', nome: '' }, 5), pf({ documento: CNPJ, conferir: 'x' }, 6)
    ];
    const c = classificar(linhas, [existente(), existente({ id: 'p-2', documento: CPF_2 })], MAPA);
    // Quando
    const resumo = resumir(c, linhas);
    // Então
    expect(resumo).toEqual({ novos: 2, completar: 1, semMudanca: 1, decidir: 0, recusadas: 1, comPendencia: 2 });
  });

  it('quando a linha com pendência fica sem mudança ou para decidir, então não conta entre as que entram com pendência', () => {
    // Dado
    const linhas = [pf({ documento: CPF, conferir: 'x' }), pf({ documento: CPF_2, nome: 'JOANA EXEMPLO', conferir: 'y' }, 3)];
    const existentes = [
      existente({ pendencias: ['conferir'], observacoes: 'A conferir: x' }),
      existente({ id: 'p-2', documento: CPF_2 })
    ];
    const c = classificar(linhas, existentes, MAPA);
    // Quando
    const resumo = resumir(c, linhas);
    // Então
    expect(c.map(x => x.situacao)).toEqual(['sem_mudanca', 'decidir']);
    expect(resumo.comPendencia).toBe(0);
  });
});

describe('Ida e volta pelo CSV', () => {
  it('quando um arquivo escrito com escreverCSV é lido e normalizado, então volta o mesmo cadastro', () => {
    // Dado
    const texto = escreverCSV([['tipo', 'nome', 'documento', 'telefones'], ['pf', 'MARIA EXEMPLO; DA SILVA', '529.982.247-25', '(38) 99999-0000 | (38) 3222-0000']]);
    // Quando
    const [p] = lerImportacao(texto).linhas.map(l => normalizarLinha(l, CTX));
    // Então
    expect(p.dados).toMatchObject({ nome: 'MARIA EXEMPLO; DA SILVA', documento: CPF, telefones: ['(38) 99999-0000', '(38) 3222-0000'] });
  });

  describe('Dado um arquivo escrito com a proteção contra fórmula ligada (o apóstrofo na frente)', () => {
    const linhas = [
      ['tipo', 'nome', 'numero', 'complemento', 'observacoes', 'telefones'],
      ['pf', '=MARIA', '-', '- fundos', '-1 ponto', '+55 38 99999-0000']
    ];
    const ler = (texto: string) => lerImportacao(texto).linhas.map(l => normalizarLinha(l, CTX))[0];
    const protegido = () => ler(escreverCSV(linhas, { protegerFormulas: { exceto: [5] } }));

    it('quando é lido e normalizado, então nenhum campo fica com o apóstrofo', () => {
      // Quando
      const p = protegido();
      // Então
      expect(p.dados).toMatchObject({ nome: 'MARIA', numero: null, complemento: 'fundos', telefones: ['(38) 99999-0000'] });
      expect(p.observacoes).toEqual(['1 ponto']);
    });

    it('quando é lido e normalizado, então dá o mesmo cadastro e os mesmos avisos do arquivo sem a proteção', () => {
      // Quando
      const p = protegido();
      // Então
      expect(p).toEqual(ler(escreverCSV(linhas)));
    });
  });
});
