// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Contrato } from '../dados/tipos';
import {
  camposDoContrato, CONTRATO_VAZIO, dadosDoContrato, fmtDinheiro, fmtPercentual, lerDinheiro, lerPercentual, numeroContrato,
  calculadosDoContrato, limparObjetos, percentualResponsavel, textoDosParticipantes, siglaAdvogado, validarContrato, valorLegivelContrato, valorParcela, type CamposContrato
} from './contrato';

const campos = (c: Partial<CamposContrato>): CamposContrato => ({ ...CONTRATO_VAZIO, ...c });
const minimo = { clienteId: 'p1', responsavelId: 'u1', objetos: ['Registro de marca'], categoria: 'pro_labore' as const };

describe('Número do contrato', () => {
  it.each([
    ['Hellyne Nogueira', '529.982.247-62', 'HE62'],
    ['Ângela Souza', '11144477735', 'AN35'],
    ['Mateus', '39053344705', 'MA05']
  ])('quando o advogado é "%s" com CPF %s, então a sigla é %s', (nome, cpf, sigla) => {
    // Quando
    const resultado = siglaAdvogado(nome, cpf);
    // Então
    expect(resultado).toBe(sigla);
  });

  it.each([
    ['sem CPF', 'Hellyne', null],
    ['com CPF incompleto', 'Hellyne', '1234'],
    ['com nome de uma letra', 'H', '52998224725']
  ])('quando o advogado está %s, então não há sigla', (_caso, nome, cpf) => {
    // Quando
    const resultado = siglaAdvogado(nome, cpf);
    // Então
    expect(resultado).toBeNull();
  });

  it('quando o contrato é o 163º do escritório, criado em 2026, então o número é HE62-0163-2026', () => {
    // Quando
    const resultado = numeroContrato('HE62', 163, 2026);
    // Então
    expect(resultado).toBe('HE62-0163-2026');
  });
});

describe('Valor da parcela', () => {
  it.each([
    ['sem entrada, divide o valor pelas parcelas', 5000, null, 5, 1000],
    ['com entrada, a entrada conta como a primeira parcela', 5000, 1000, 5, 1000],
    ['com centavos, arredonda para o centavo', 1000, null, 3, 333.33],
    ['à vista com entrada, não há outras parcelas', 5000, 5000, 1, null],
    ['sem valor, não há parcela', null, null, 5, null],
    ['sem número de parcelas, não há parcela', 5000, null, null, null]
  ])('quando o contrato é %s, então a parcela é %s', (_caso, valor, entrada, parcelas, esperado) => {
    // Quando
    const resultado = valorParcela(valor, entrada, parcelas);
    // Então
    expect(resultado).toBe(esperado);
  });
});

describe('Percentual do responsável', () => {
  it.each([
    [null, [], null, 100],
    [20, [], null, 80],
    [20, [10], 10, 60],
    [30, [10, 5.5], null, 54.5],
    [100, [], null, 0],
    [30, [60], 20, null]
  ] as [number | null, number[], number | null, number | null][])('quando o escritório tem %s%%, os participantes %j e o indicador %s%%, então o responsável fica com %s',
  (escritorio, participantes, indicador, esperado) => {
    // Quando
    const resultado = percentualResponsavel(escritorio, participantes, indicador);
    // Então
    expect(resultado).toBe(esperado);
  });
});

describe('Valores em reais e percentuais', () => {
  it.each([
    ['R$ 1.500,00', 1500],
    ['1500,5', 1500.5],
    ['1500.50', 1500.5],
    ['1.500', 1500],
    ['1.234.567,89', 1234567.89],
    ['', null]
  ])('quando a pessoa digita "%s", então o valor é %s', (texto, esperado) => {
    // Quando
    const resultado = lerDinheiro(texto);
    // Então
    expect(resultado).toBe(esperado);
  });

  it.each(['abc', '12,345', '-5'])('quando a pessoa digita "%s", então o valor é recusado com o formato a usar', texto => {
    // Quando
    const ler = () => lerDinheiro(texto);
    // Então
    expect(ler).toThrow('Use um valor como 1.500,00.');
  });

  it('quando um valor é mostrado, então aparece em reais com centavos', () => {
    // Quando
    const resultado = fmtDinheiro(1500.5);
    // Então
    expect(resultado).toBe('R$ 1.500,50');
  });

  it.each([['30', 30], ['26,67%', 26.67], ['', null]])('quando o percentual digitado é "%s", então vale %s', (texto, esperado) => {
    // Quando
    const resultado = lerPercentual(texto);
    // Então
    expect(resultado).toBe(esperado);
  });

  it('quando o percentual passa de 100, então é recusado', () => {
    // Quando
    const ler = () => lerPercentual('120');
    // Então
    expect(ler).toThrow('Use um percentual de 0 a 100.');
  });

  it('quando um percentual é mostrado, então aparece com vírgula e o sinal', () => {
    // Quando
    const resultado = fmtPercentual(26.67);
    // Então
    expect(resultado).toBe('26,67%');
  });
});

describe('Validação do cadastro de contrato', () => {
  it('quando nada foi preenchido, então os quatro campos obrigatórios pedem preenchimento', () => {
    // Quando
    const erros = validarContrato(CONTRATO_VAZIO);
    // Então
    expect(erros).toEqual({
      clienteId: 'Escolha o cliente.', responsavelId: 'Escolha o advogado responsável.',
      objetos: 'Informe ao menos um objeto do contrato.', categoria: 'Escolha a categoria de honorário.'
    });
  });

  it('quando só os obrigatórios estão preenchidos, então o contrato pode ser salvo', () => {
    // Quando
    const erros = validarContrato(campos(minimo));
    // Então
    expect(erros).toEqual({});
  });

  it.each([
    ['a entrada passa do valor', { valor: '1.000,00', entrada: '2.000,00' }, 'entrada', 'A entrada não pode passar do valor do contrato.'],
    ['os descontos passam do valor', { valor: '1.000,00', descontos: '1.500' }, 'descontos', 'Os descontos não podem passar do valor do contrato.'],
    ['as parcelas não são um número inteiro', { parcelas: '2,5' }, 'parcelas', 'Informe de 1 a 360 parcelas.'],
    ['a data de assinatura não existe', { assinadoEm: '31/02/2026' }, 'assinadoEm', 'Data inexistente.'],
    ['há percentual de participante sem participante', { participantes: [{ pessoaId: '', percentual: '20' }] }, 'participantes', 'Escolha o participante deste percentual.'],
    ['o percentual de um participante não é um número', { participantes: [{ pessoaId: 'p2', percentual: '2o' }] }, 'participantes', 'Use um percentual de 0 a 100.'],
    ['a mesma pessoa aparece duas vezes', { participantes: [{ pessoaId: 'p2', percentual: '' }, { pessoaId: 'p2', percentual: '5' }] }, 'participantes',
      'A mesma pessoa aparece duas vezes nos participantes.'],
    ['a soma com o escritório passa de 100%', { percentualEscritorio: '30', participantes: [{ pessoaId: 'p2', percentual: '60' }], indicadorId: 'p3', indicadorPercentual: '20' },
      'divisao', 'A soma dos percentuais (escritório, participantes e indicador) passa de 100%.'],
    ['indicador e participante são a mesma pessoa', { participantes: [{ pessoaId: 'p2', percentual: '' }], indicadorId: 'p2' }, 'indicadorId',
      'O indicador e os participantes precisam ser pessoas diferentes.'],
    ['o link do documento não é um endereço', { documentoUrl: 'drive.google.com/x' }, 'documentoUrl', 'Cole o link completo, começando com https://.'],
    ['os objetos são só linhas em branco', { objetos: ['  ', ''] }, 'objetos', 'Informe ao menos um objeto do contrato.'],
    ['há mais de 20 objetos', { objetos: Array.from({ length: 21 }, (_, i) => 'Objeto ' + i) }, 'objetos', 'Um contrato pode ter até 20 objetos.'],
    ['um objeto passa de 300 caracteres', { objetos: ['x'.repeat(301)] }, 'objetos', 'Cada objeto do contrato pode ter até 300 caracteres.']
  ])('quando %s, então o campo avisa o que corrigir', (_caso, extra, campo, mensagem) => {
    // Quando
    const erros = validarContrato(campos({ ...minimo, ...extra }));
    // Então
    expect(erros).toEqual({ [campo]: mensagem });
  });
});

describe('Gravação e leitura do contrato', () => {
  it('quando o formulário é gravado, então os textos viram números, datas e percentuais', () => {
    // Dado
    const c = campos({ ...minimo, objetos: ['Registro de marca', ' ', 'Busca de anterioridade '], valor: 'R$ 5.000,00', entrada: '1.000', parcelas: '5', assinadoEm: '10/03/2026', percentualEscritorio: '30',
      participantes: [{ pessoaId: 'p2', percentual: '20' }, { pessoaId: '', percentual: ' ' }, { pessoaId: 'p4', percentual: '' }], documentoUrl: ' https://drive.google.com/x ', codigoAntigo: 'he62-de74-001/24' });
    // Quando
    const d = dadosDoContrato(c);
    // Então
    expect(d).toMatchObject({ objetos: ['Registro de marca', 'Busca de anterioridade'], servico: 'Registro de marca; Busca de anterioridade',
      valor: 5000, entrada: 1000, parcelas: 5, descontos: null, assinado_em: '2026-03-10', percentual_escritorio: 30,
      participantes: [{ pessoa_id: 'p2', percentual: 20 }, { pessoa_id: 'p4', percentual: null }], indicador_id: null, indicador_percentual: null,
      documento_url: 'https://drive.google.com/x', codigo_antigo: 'HE62-DE74-001/24' });
  });

  it('quando um contrato salvo é aberto para atualizar, então os campos voltam formatados', () => {
    // Dado
    const k = { cliente_id: 'p1', responsavel_id: 'u1', objetos: ['Registro de marca', 'Oposição'], servico: 'Registro de marca; Oposição', categoria: 'pro_labore', valor: 5000, entrada: 1000.5,
      parcelas: 5, descontos: null, assinado_em: '2026-03-10', primeiro_pagamento: null, percentual_escritorio: 30,
      participantes: [{ pessoa: { id: 'p2', codigo: 'P2', nome: 'ANA', tipo: 'pf' }, percentual: 26.67 }], indicador_id: null, indicador_percentual: null, documento_url: null, observacoes: null, codigo_antigo: null } as Contrato;
    // Quando
    const c = camposDoContrato(k);
    // Então
    expect(c).toMatchObject({ objetos: ['Registro de marca', 'Oposição'], valor: '5.000,00', entrada: '1.000,50', parcelas: '5', descontos: '', assinadoEm: '10/03/2026',
      percentualEscritorio: '30', participantes: [{ pessoaId: 'p2', percentual: '26,67' }], indicadorPercentual: '' });
  });
});

describe('Campos do contrato no cartão e no histórico', () => {
  it.each([
    ['valor', 1500.5, 'R$ 1.500,50'],
    ['percentual_escritorio', 30, '30%'],
    ['indicador_percentual', 26.67, '26,67%'],
    ['categoria', 'quota_litis', 'Quota litis'],
    ['assinado_em', '2026-03-10', '10/03/2026'],
    ['servico', 'Registro de marca', 'Registro de marca'],
    ['cliente_id', 'JOSÉ DA SILVA', 'JOSÉ DA SILVA'],
    ['valor', null, '—']
  ])('quando o campo %s vale %j, então aparece como "%s"', (campo, valor, esperado) => {
    // Quando
    const texto = valorLegivelContrato(campo, valor);
    // Então
    expect(texto.replace(/\s/g, ' ')).toBe(esperado);
  });
});

describe('Valores calculados no cadastro', () => {
  it('quando valor, entrada, parcelas e percentuais estão preenchidos, então mostra a parcela e o % do responsável', () => {
    // Quando
    const r = calculadosDoContrato(campos({ valor: '5.000,00', entrada: '1.000,00', parcelas: '5', percentualEscritorio: '20',
      participantes: [{ pessoaId: 'p2', percentual: '10' }, { pessoaId: 'p3', percentual: '5' }], indicadorPercentual: '10' }));
    // Então
    expect(r).toEqual({ parcela: 1000, responsavel: 55 });
  });

  it('quando algum campo ainda está pela metade, então ele conta como vazio', () => {
    // Quando
    const r = calculadosDoContrato(campos({ valor: '5.000,0x', parcelas: '2,5', participantes: [{ pessoaId: 'p2', percentual: '1o' }] }));
    // Então
    expect(r).toEqual({ parcela: null, responsavel: 100 });
  });
});

describe('Objetos do contrato', () => {
  it.each([
    ['espaços nas pontas e linhas vazias', ['  Registro de marca ', '', '   ', 'Oposição'], ['Registro de marca', 'Oposição']],
    ['o mesmo objeto escrito de outro jeito', ['Registro de marca', 'REGISTRO DE MARCA', 'oposicao', 'Oposição'], ['Registro de marca', 'oposicao']],
    ['nenhum objeto', [''], []]
  ])('quando a lista tem %s, então fica como o banco guarda', (_caso, objetos, esperado) => {
    // Quando
    const limpos = limparObjetos(objetos);
    // Então
    expect(limpos).toEqual(esperado);
  });
});

describe('Participantes por extenso', () => {
  it.each([
    ['dois participantes, um sem %', [{ nome: 'ANA', percentual: 20 }, { nome: 'BRUNO', percentual: null }], 'ANA (20%), BRUNO'],
    ['percentual com casas decimais', [{ nome: 'ANA', percentual: 10.5 }], 'ANA (10,5%)'],
    ['nenhum participante', [], null]
  ])('quando há %s, então o texto é como no histórico do banco', (_caso, lista, esperado) => {
    // Quando
    const texto = textoDosParticipantes(lista);
    // Então
    expect(texto).toBe(esperado);
  });
});
