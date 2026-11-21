// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { emCaixaAlta, normal, partesParaQuebrar, semAcento, sugestoesQueCombinam } from './texto';

describe('Nomes em maiúsculas (#386)', () => {
  it.each([
    ['análise', 'ANÁLISE'],
    ['Para fazer', 'PARA FAZER'],
    ['ação em curso', 'AÇÃO EM CURSO'],
    ['Aguardando: protocolo nº 2', 'AGUARDANDO: PROTOCOLO Nº 2'],
    ['JÁ EM MAIÚSCULAS', 'JÁ EM MAIÚSCULAS']
  ])('dado o nome "%s", quando aparece em maiúsculas, então sai "%s", com os acentos', (nome, esperado) => {
    // Quando
    const mostrado = emCaixaAlta(nome);
    // Então
    expect(mostrado).toBe(esperado);
  });

  it('dado um nome com espaços, quando aparece em maiúsculas, então os espaços ficam como estão', () => {
    // Quando
    const mostrado = emCaixaAlta(' em  análise ');
    // Então
    expect(mostrado).toBe(' EM  ANÁLISE ');
  });
});

describe('Busca sem acento', () => {
  it.each([
    ['  José da Conceição ', 'jose da conceicao'],
    ['ÁGUA', 'agua'],
    [null, ''],
    [42, '42']
  ])('quando o texto é %j, então a forma comparável é "%s"', (texto, esperado) => {
    // Quando
    const comparavel = normal(texto);
    // Então
    expect(comparavel).toBe(esperado);
  });

  it('dado um texto com espaços nas pontas, quando só se tiram os acentos, então os espaços ficam e cada letra continua no lugar', () => {
    // Quando
    const comparavel = semAcento(' Ação ');
    // Então
    expect(comparavel).toBe(' acao ');
  });
});

describe('Sugestões enquanto se digita', () => {
  const OBJETOS = ['Ação de cobrança', 'Ação de indenização por danos morais', 'Busca de anterioridade', 'Revisão de cobrança', 'Divórcio consensual']
    .map(valor => ({ valor }));
  const valores = (lista: { valor: string }[]) => lista.map(s => s.valor);

  it('quando a pessoa digita parte do texto, sem acento, então vêm primeiro as que começam por ele e depois as que o contêm', () => {
    // Quando
    const achadas = sugestoesQueCombinam('cobranca', OBJETOS, 8);
    const porInicio = sugestoesQueCombinam('acao', OBJETOS, 8);
    // Então
    expect(valores(achadas)).toEqual(['Ação de cobrança', 'Revisão de cobrança']);
    expect(valores(porInicio)).toEqual(['Ação de cobrança', 'Ação de indenização por danos morais']);
  });

  it('quando o texto já é igual a uma sugestão, então ela não aparece de novo', () => {
    // Quando
    const achadas = sugestoesQueCombinam('ação de cobrança', OBJETOS, 8);
    // Então
    expect(valores(achadas)).toEqual([]);
  });

  it('quando o campo está vazio, então vêm as primeiras sugestões, até o limite', () => {
    // Quando
    const achadas = sugestoesQueCombinam('', OBJETOS, 2);
    // Então
    expect(valores(achadas)).toEqual(['Ação de cobrança', 'Ação de indenização por danos morais']);
  });
});

describe('Onde o nome da coluna pode quebrar a linha (#352)', () => {
  it.each([
    ['Diligência/Análise/Falta de documentação', ['Diligência/', 'Análise/', 'Falta de documentação']],
    ['Para fazer', ['Para fazer']],
    ['Termina com barra/', ['Termina com barra/']],
    ['Barras//juntas', ['Barras/', '/', 'juntas']]
  ])('quando o nome é "%s", então as partes são %j, e juntas voltam a ser o nome', (nome, esperado) => {
    // Quando
    const partes = partesParaQuebrar(nome);
    // Então
    expect(partes).toEqual(esperado);
    expect(partes.join('')).toBe(nome);
  });
});
