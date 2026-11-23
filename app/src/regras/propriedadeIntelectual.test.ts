// Propriedade intelectual (#317): tipo de proteção, campos de cada tipo, papéis próprios e prazos do INPI.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Processo } from '../dados/tipos';
import {
  AREA_DA_PI, CONCESSAO_ANTES_DO_DEPOSITO, camposDaProtecao, dadosDaProtecao, ehDePropriedadeIntelectual, fmtClassesNice, lerClassesNice, papeisDaProtecao, prazoPorExtenso,
  prazosDaProtecao, prazosPorVir, proximoPrazo, PROTECAO_VAZIA, situacaoDoPrazo, TIPOS_DE_PROTECAO, TIPOS_DE_PROTECAO_EM_ORDEM, type CamposProtecao, type DatasDaProtecao,
  type PrazoDaProtecao
} from './propriedadeIntelectual';
import { CAMPOS_PROCESSO, dadosDoProcesso, linhasDoProcesso, papeisParaEscolher, processoVazio, validarProcesso, valorLegivelProcesso } from './processo';

const datas = (d: Partial<DatasDaProtecao>): DatasDaProtecao & { area: string } =>
  ({ protecao: null, deposito: null, concessao: null, publicacao: null, criacao: null, area: AREA_DA_PI, ...d });
const nomes = (lista: readonly PrazoDaProtecao[]) => lista.map(x => x.nome);
const campos = (c: Partial<CamposProtecao> = {}) => ({ ...PROTECAO_VAZIA, area: AREA_DA_PI, ...c });

describe('Tipos de proteção', () => {
  it('quando a pessoa escolhe o tipo de proteção, então os cinco tipos estão na lista, cada um com o nome', () => {
    // Então
    expect(TIPOS_DE_PROTECAO_EM_ORDEM.map(t => TIPOS_DE_PROTECAO[t].nome))
      .toEqual(['Marca', 'Patente de invenção', 'Modelo de utilidade', 'Desenho industrial', 'Programa de computador']);
  });

  it.each([['Propriedade intelectual', true], ['propriedade INTELECTUAL ', true], ['Cível', false], ['', false], [null, false]] as const)(
    'quando a área é "%s", então é de propriedade intelectual: %s', (area, sim) => {
      // Então
      expect(ehDePropriedadeIntelectual(area)).toBe(sim);
    });

  it('quando o tipo é marca, então aparecem as classes de Nice e não as variações; na patente, nem uma nem outra', () => {
    // Então
    expect(TIPOS_DE_PROTECAO.marca.campos).toContain('classesNice');
    expect(TIPOS_DE_PROTECAO.marca.campos).not.toContain('variacoes');
    expect(TIPOS_DE_PROTECAO.patente_invencao.campos).toEqual(['deposito', 'publicacao', 'concessao']);
    expect(TIPOS_DE_PROTECAO.desenho_industrial.campos).toContain('variacoes');
    expect(TIPOS_DE_PROTECAO.programa_computador.campos).toEqual(['criacao', 'publicacao', 'linguagem']);
  });
});

describe('Papéis de propriedade intelectual', () => {
  it('quando o processo é uma patente, então titular e inventor estão entre os papéis, além dos de sempre', () => {
    // Quando
    const papeis = papeisParaEscolher({ area: AREA_DA_PI, protecao: 'patente_invencao' });
    // Então
    expect(papeis).toEqual(expect.arrayContaining(['titular', 'inventor', 'autor', 'testemunha']));
    expect(papeis).not.toContain('autor_da_criacao');
    expect(papeis.at(-1)).toBe('outro');
  });

  it('quando o processo é uma marca, então só o titular entra; no desenho, o titular e o autor da criação', () => {
    // Então
    expect(papeisDaProtecao({ area: AREA_DA_PI, protecao: 'marca' })).toEqual(['titular']);
    expect(papeisDaProtecao({ area: AREA_DA_PI, protecao: 'desenho_industrial' })).toEqual(['titular', 'autor_da_criacao']);
  });

  it('quando o processo de PI ainda não tem o tipo, então os três papéis aparecem; fora da área, nenhum', () => {
    // Então
    expect(papeisDaProtecao({ area: AREA_DA_PI })).toEqual(['titular', 'inventor', 'autor_da_criacao']);
    expect(papeisParaEscolher({ area: 'Cível' })).not.toEqual(expect.arrayContaining(['titular']));
    expect(papeisParaEscolher({ area: 'Cível', protecao: 'marca' })).not.toContain('inventor');
  });
});

describe('Classes de Nice', () => {
  it('quando a pessoa digita as classes com vírgula, espaço ou ponto e vírgula, então ficam em ordem e sem repetir', () => {
    // Então
    expect(lerClassesNice('42, 9;35 9')).toEqual([9, 35, 42]);
    expect(lerClassesNice('  ')).toEqual([]);
    expect(fmtClassesNice([9, 35])).toBe('9, 35');
  });

  it.each(['46', '0', '9.5', 'nove'])('quando a classe é "%s", então dá erro', texto => {
    // Então
    expect(() => lerClassesNice(texto)).toThrow('As classes de Nice são números de 1 a 45');
  });
});

describe('Cadastro dos campos de propriedade intelectual', () => {
  it('quando a marca é salva, então vão as datas, as classes e a especificação, e os campos de outros tipos ficam vazios', () => {
    // Dado
    const c = campos({ protecao: 'marca', deposito: '10/03/2020', concessao: '17/05/2022', classesNice: '45, 35', especificacao: ' Serviços jurídicos ',
      apresentacaoMarca: 'mista', naturezaMarca: 'servico', variacoes: '3', linguagem: 'TypeScript', criacao: '01/01/2020' });
    // Quando
    const d = dadosDaProtecao(c);
    // Então
    expect(d).toEqual({ protecao: 'marca', deposito: '2020-03-10', concessao: '2022-05-17', publicacao: null, criacao: null, apresentacao_marca: 'mista',
      natureza_marca: 'servico', classes_nice: [35, 45], especificacao: 'Serviços jurídicos', variacoes: null, linguagem: null });
  });

  it('quando a área deixa de ser propriedade intelectual, então todos os campos dela ficam vazios', () => {
    // Quando
    const d = dadosDaProtecao({ ...campos({ protecao: 'marca', deposito: '10/03/2020', classesNice: '9' }), area: 'Cível' });
    // Então
    expect(d).toMatchObject({ protecao: null, deposito: null, classes_nice: [] });
  });

  it('quando o processo salvo é lido de volta, então os campos voltam como foram digitados', () => {
    // Dado
    const p: Partial<Processo> = { protecao: 'desenho_industrial', deposito: '2021-02-01', variacoes: 4, classes_nice: [] };
    // Quando
    const c = camposDaProtecao(p);
    // Então
    expect(c).toMatchObject({ protecao: 'desenho_industrial', deposito: '01/02/2021', variacoes: '4', classesNice: '' });
    expect(camposDaProtecao({})).toEqual(PROTECAO_VAZIA);
  });

  it('quando a concessão vem antes do depósito, a classe passa de 45 ou as variações passam de 20, então o cadastro avisa no campo', () => {
    // Dado
    const base = { ...processoVazio('administrativo'), numero: '900000001', clientes: ['p1'], responsavelId: 'u1', area: AREA_DA_PI };
    // Quando
    const marca = validarProcesso({ ...base, protecao: 'marca', deposito: '10/03/2022', concessao: '01/01/2021', classesNice: '9, 46' });
    const desenho = validarProcesso({ ...base, protecao: 'desenho_industrial', variacoes: '21' });
    // Então
    expect(marca).toMatchObject({ concessao: CONCESSAO_ANTES_DO_DEPOSITO, classesNice: expect.stringContaining('de 1 a 45') });
    expect(desenho).toEqual({ variacoes: 'O número de variações vai de 1 a 20.' });
  });

  it('quando um campo de outro tipo ou de fora da área tem erro, então ele não conta (não está na tela)', () => {
    // Dado
    const base = { ...processoVazio('administrativo'), numero: '1', clientes: ['p1'], responsavelId: 'u1', classesNice: '99', variacoes: 'muitas' };
    // Então
    expect(validarProcesso({ ...base, area: AREA_DA_PI, protecao: 'patente_invencao' })).toEqual({});
    expect(validarProcesso({ ...base, area: 'Cível', protecao: 'marca' })).toEqual({});
  });

  it('quando o processo de PI é gravado, então os campos dela vão junto com os de sempre', () => {
    // Dado
    const c = { ...processoVazio('administrativo'), numero: '1', clientes: ['p1'], responsavelId: 'u1', area: AREA_DA_PI, protecao: 'programa_computador' as const,
      criacao: '15/08/2019', linguagem: 'Python' };
    // Então
    expect(dadosDoProcesso(c)).toMatchObject({ area: AREA_DA_PI, protecao: 'programa_computador', criacao: '2019-08-15', linguagem: 'Python', deposito: null });
  });

  it('quando o cartão mostra os dados, então o tipo, as datas e as classes aparecem com nome; as classes vazias não aparecem', () => {
    // Dado
    const p = { numero: '1', area: AREA_DA_PI, protecao: 'marca', deposito: '2020-03-10', classes_nice: [9, 35], segredo: false } as unknown as Processo;
    // Então
    expect(linhasDoProcesso(p)).toEqual(expect.arrayContaining([['Tipo de proteção', 'Marca'], ['Depósito', '10/03/2020'], ['Classes de Nice', '9, 35']]));
    expect(linhasDoProcesso({ ...p, classes_nice: [] }).map(([r]) => r)).not.toContain('Classes de Nice');
    expect(CAMPOS_PROCESSO.natureza_marca).toBe('Natureza da marca');
    expect(valorLegivelProcesso('natureza_marca', 'servico')).toBe('De serviço');
  });
});

describe('Prazos do INPI', () => {
  it('quando a patente de invenção tem depósito, então vale 20 anos do depósito, com o pedido de exame em 36 meses e as anuidades do 3º ao 20º ano', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'patente_invencao', deposito: '2020-03-10' }), '2026-11-22')!;
    // Então
    expect(r.validade).toEqual({ rotulo: 'Validade', data: '2040-03-10' });
    expect(r.datas.find(x => x.tipo === 'exame')).toMatchObject({ inicio: '2020-03-10', fim: '2023-03-10', fimExtra: null });
    const anuidades = r.datas.filter(x => x.tipo === 'anuidade');
    expect(nomes(anuidades)).toEqual(Array.from({ length: 18 }, (_, i) => `${i + 3}ª anuidade`));
    // A 3ª anuidade: do 2º aniversário, 3 meses no prazo normal e mais 6 com taxa extra.
    expect(anuidades[0]).toMatchObject({ inicio: '2022-03-10', fim: '2022-06-10', fimExtra: '2022-12-10' });
    expect(anuidades.at(-1)).toMatchObject({ nome: '20ª anuidade', inicio: '2039-03-10' });
  });

  it('quando o modelo de utilidade já foi concedido, então vale 15 anos, vai até a 15ª anuidade e o pedido de exame sai da lista', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'modelo_utilidade', deposito: '2018-07-01', concessao: '2023-01-10' }), '2026-11-22')!;
    // Então
    expect(r.validade?.data).toBe('2033-07-01');
    expect(r.datas.some(x => x.tipo === 'exame')).toBe(false);
    expect(nomes(r.datas).at(-1)).toBe('15ª anuidade');
  });

  it('quando o depósito é em 29/02, então as anuidades dos anos que não são bissextos caem em 28/02', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'patente_invencao', deposito: '2024-02-29' }), '2026-11-22')!;
    // Então
    expect(r.datas.find(x => x.nome === '3ª anuidade')).toMatchObject({ inicio: '2026-02-28', fim: '2026-05-28' });
    expect(r.datas.find(x => x.nome === '5ª anuidade')).toMatchObject({ inicio: '2028-02-29' });
    expect(r.validade?.data).toBe('2044-02-29');
  });

  it('quando o depósito é no fim do mês, então o fim do prazo cai no último dia do mês mais curto', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'patente_invencao', deposito: '2021-11-30' }), '2026-11-22')!;
    // Então: 30/11/2023 + 3 meses = 29/02/2024 (bissexto); + 6 meses = 29/08/2024.
    expect(r.datas.find(x => x.nome === '3ª anuidade')).toMatchObject({ inicio: '2023-11-30', fim: '2024-02-29', fimExtra: '2024-08-29' });
  });

  it('quando a marca tem concessão, então vale 10 anos dela, com a prorrogação no último ano ou 6 meses depois, e mostra as próximas', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'marca', deposito: '2010-01-05', concessao: '2012-05-17' }), '2026-11-22')!;
    // Então: a 1ª terminou em 2022 (supondo que foi prorrogada), a atual vai até 2032, e o cartão mostra mais uma.
    expect(r.validade).toEqual({ rotulo: 'Vigência atual até', data: '2032-05-17' });
    expect(r.datas.map(x => [x.nome, x.inicio, x.fim, x.fimExtra])).toEqual([
      ['1ª prorrogação', '2021-05-17', '2022-05-17', '2022-11-17'],
      ['2ª prorrogação', '2031-05-17', '2032-05-17', '2032-11-17'],
      ['3ª prorrogação', '2041-05-17', '2042-05-17', '2042-11-17']
    ]);
  });

  it('quando a marca ainda não foi concedida, então o cartão pede a data da concessão, sem datas', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'marca', deposito: '2025-01-05' }), '2026-11-22')!;
    // Então
    expect(r).toEqual({ validade: null, datas: [], falta: 'A validade da marca conta da concessão: informe a data da concessão.' });
  });

  it('quando o desenho industrial tem depósito, então vale 10 anos e pode ir a 25, com o 2º quinquênio no 5º ano e 3 prorrogações', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'desenho_industrial', deposito: '2015-04-20' }), '2026-11-22')!;
    // Então: o 1º período acabou em 2025; supondo a prorrogação, a vigência atual vai até 2030.
    expect(r.validade).toEqual({ rotulo: 'Vigência atual até', data: '2030-04-20' });
    expect(r.datas.map(x => [x.nome, x.inicio, x.fim, x.fimExtra])).toEqual([
      ['2º quinquênio', '2019-04-20', '2020-04-20', '2020-10-20'],
      ['1ª prorrogação', '2024-04-20', '2025-04-20', '2025-10-17'],
      ['2ª prorrogação', '2029-04-20', '2030-04-20', '2030-10-17'],
      ['3ª prorrogação', '2034-04-20', '2035-04-20', '2035-10-17']
    ]);
  });

  it('quando o desenho passou dos 25 anos, então a vigência é o limite, sem nova prorrogação', () => {
    // Quando
    const r = prazosDaProtecao(datas({ protecao: 'desenho_industrial', deposito: '1990-01-10' }), '2026-11-22')!;
    // Então
    expect(r.validade?.data).toBe('2015-01-10');
    expect(r.datas.filter(x => x.tipo === 'prorrogacao')).toHaveLength(3);
  });

  it('quando o programa de computador foi publicado, então a proteção vai até 31/12 do 50º ano seguinte ao da publicação; sem ela, ao da criação', () => {
    // Então
    expect(prazosDaProtecao(datas({ protecao: 'programa_computador', criacao: '2018-03-01', publicacao: '2019-06-10' }), '2026-11-22'))
      .toEqual({ validade: { rotulo: 'Proteção até', data: '2069-12-31' }, datas: [], falta: null });
    expect(prazosDaProtecao(datas({ protecao: 'programa_computador', criacao: '2018-03-01' }), '2026-11-22')?.validade?.data).toBe('2068-12-31');
    expect(prazosDaProtecao(datas({ protecao: 'programa_computador' }), '2026-11-22')?.falta).toContain('criação ou da publicação');
  });

  it('quando falta o depósito da patente ou do desenho, então o cartão diz o que falta', () => {
    // Então
    expect(prazosDaProtecao(datas({ protecao: 'patente_invencao' }), '2026-11-22')?.falta).toContain('data do depósito');
    expect(prazosDaProtecao(datas({ protecao: 'desenho_industrial' }), '2026-11-22')?.falta).toContain('data do depósito');
  });

  it('quando o processo não é de PI ou não tem o tipo, então não há prazos', () => {
    // Então
    expect(prazosDaProtecao({ ...datas({ protecao: 'marca', concessao: '2020-01-01' }), area: 'Cível' }, '2026-11-22')).toBeNull();
    expect(prazosDaProtecao(datas({ deposito: '2020-01-01' }), '2026-11-22')).toBeNull();
  });
});

describe('Situação de cada prazo', () => {
  const anuidade: PrazoDaProtecao = { tipo: 'anuidade', nome: '3ª anuidade', inicio: '2026-03-10', fim: '2026-06-10', fimExtra: '2026-12-10' };

  it.each([['2026-03-09', 'futuro'], ['2026-03-10', 'aberto'], ['2026-06-10', 'aberto'], ['2026-06-11', 'extra'], ['2026-12-10', 'extra'], ['2026-12-11', 'passou']] as const)(
    'quando hoje é %s, então a anuidade está "%s"', (hoje, situacao) => {
      // Então
      expect(situacaoDoPrazo(anuidade, hoje)).toBe(situacao);
    });

  it('quando a pessoa abre o cartão, então o próximo prazo é o primeiro que não passou, e o número conta os que faltam', () => {
    // Dado
    const r = prazosDaProtecao(datas({ protecao: 'patente_invencao', deposito: '2020-03-10' }), '2026-11-22')!;
    // Quando
    const proximo = proximoPrazo(r.datas, '2026-11-22');
    // Então: a 7ª anuidade (de 10/03/2026) ainda cabe no prazo extra, até 10/12/2026.
    expect(proximo?.nome).toBe('7ª anuidade');
    expect(situacaoDoPrazo(proximo!, '2026-11-22')).toBe('extra');
    expect(prazosPorVir(r.datas, '2026-11-22')).toBe(14);
    expect(prazoPorExtenso(proximo!)).toBe('de 10/03/2026 a 10/06/2026 (com taxa extra até 10/12/2026)');
  });
});
