// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  acompanharValor, caberNoLimite, continuarLista, diferenca, linhasAoVivo, linhasDoCursor, marcacoesAoVivo, quebrasComuns,
  type Marcacao, type Troca
} from './aoVivo';
import { alternarItemDeTarefa, marcasNaLinha } from './formatacao';

/** O texto de cada marcação de um tipo, para ler o teste como a pessoa vê a linha. */
const trechosDo = (texto: string, marcacoes: Marcacao[], tipo: Marcacao['tipo']) =>
  marcacoes.filter(m => m.tipo === tipo).map(m => 'fim' in m ? texto.slice(m.inicio, m.fim) : '');
/** As marcações do texto com o cursor na posição dada. */
const comCursorEm = (texto: string, posicao: number) => {
  const linhas = linhasAoVivo(texto);
  return marcacoesAoVivo(linhas, linhasDoCursor(linhas, [{ inicio: posicao, fim: posicao }]));
};

describe('Os sinais e os destaques de uma linha (a mesma leitura do texto formatado)', () => {
  it('dada "Juntar **procuração** e *RG*", quando lê, então os sinais são os "**" e os "*", e os destaques, as palavras', () => {
    // Dado
    const linha = 'Juntar **procuração** e *RG*';
    // Quando
    const { simbolos, trechos } = marcasNaLinha(linha);
    // Então
    expect(simbolos.map(s => linha.slice(s.inicio, s.fim))).toEqual(['**', '**', '*', '*']);
    expect(trechos.map(t => [linha.slice(t.inicio, t.fim), t.marcas])).toEqual([['procuração', ['negrito']], ['RG', ['italico']]]);
  });

  it('dado um link com o texto em negrito, quando lê, então "[" e "](endereço)" são sinais, e o texto é link e negrito', () => {
    // Dado
    const linha = 'Veja [o **site**](https://exemplo.com) hoje';
    // Quando
    const { simbolos, trechos } = marcasNaLinha(linha);
    // Então
    expect(simbolos.map(s => linha.slice(s.inicio, s.fim))).toEqual(['[', '**', '**', '](https://exemplo.com)']);
    expect(trechos.map(t => [linha.slice(t.inicio, t.fim), t.marcas, t.link])).toEqual([
      ['o ', [], 'https://exemplo.com/'], ['site', ['negrito'], 'https://exemplo.com/']
    ]);
  });

  it('dado código em linha, quando lê, então as crases são sinais e o que fica dentro é código, sem marcas', () => {
    // Dado
    const linha = 'Use `**literal**` aqui';
    // Quando
    const { simbolos, trechos } = marcasNaLinha(linha);
    // Então
    expect(simbolos.map(s => linha.slice(s.inicio, s.fim))).toEqual(['`', '`']);
    expect(trechos.map(t => [linha.slice(t.inicio, t.fim), t.marcas])).toEqual([['**literal**', ['codigo']]]);
  });

  it.each([['5 * 3 * 2'], ['**urgente'], ['[sem par'], ['[link](javascript:alert(1))']])(
    'dado "%s", quando lê, então nada é sinal: o que não vira marca fica escrito', linha => {
      // Então
      expect(marcasNaLinha(linha).simbolos).toEqual([]);
    });

  it('dado um link sem texto, quando lê, então ele fica escrito inteiro, como link, para não sumir', () => {
    // Dado
    const linha = '[](https://exemplo.com)';
    // Quando
    const { simbolos, trechos } = marcasNaLinha(linha);
    // Então
    expect(simbolos).toEqual([]);
    expect(trechos).toEqual([{ inicio: 0, fim: linha.length, marcas: [], link: 'https://exemplo.com/' }]);
  });
});

describe('As linhas do editor ao vivo', () => {
  it('dado um texto com título, lista, caixinhas, numerada, citação, código e divisória, quando lê, então cada linha tem o seu tipo', () => {
    // Dado
    const texto = '## Pendências\n- RG\n- [x] CPF\n- [ ] Procuração\n1. Um\n> Nota\n```\n**cru**\n```\n---\nfim';
    // Quando
    const linhas = linhasAoVivo(texto);
    // Então
    expect(linhas.map(l => [l.tipo, l.prefixo])).toEqual([
      ['titulo', 3], ['lista', 2], ['tarefa', 6], ['tarefa', 6], ['numerada', 3], ['citacao', 2], ['cerca', 0], ['codigo', 0], ['cerca', 0],
      ['divisoria', 0], ['texto', 0]
    ]);
    expect(linhas[0].nivel).toBe(2);
    expect(linhas.slice(2, 4).map(l => l.marcada)).toEqual([true, false]);
    expect(linhas[7].simbolos).toEqual([]);   // dentro do código, nada vira marca
  });

  it('dado um bloco de código que não fecha, quando lê, então só a primeira linha é cerca', () => {
    // Então
    expect(linhasAoVivo('```\na\nb').map(l => l.tipo)).toEqual(['cerca', 'codigo', 'codigo']);
  });

  it('dada uma linha depois de outras, quando lê, então as posições valem no texto todo', () => {
    // Dado
    const texto = 'a\n**b**';
    // Quando
    const [, l] = linhasAoVivo(texto);
    // Então
    expect([l.inicio, l.fim]).toEqual([2, 7]);
    expect(l.simbolos.map(s => texto.slice(s.inicio, s.fim))).toEqual(['**', '**']);
  });

  it('dados um cursor e um trecho escolhido de várias linhas, quando vê as linhas do cursor, então são as que eles tocam', () => {
    // Dado
    const linhas = linhasAoVivo('a\nb\nc\nd');
    // Quando
    const com = linhasDoCursor(linhas, [{ inicio: 0, fim: 0 }, { inicio: 4, fim: 6 }]);
    // Então
    expect([...com].sort((a, b) => a - b)).toEqual([0, 2, 3]);
  });
});

describe('O que o editor esconde e mostra, conforme o cursor (como no Obsidian)', () => {
  const texto = '## Pendências\nLevar o **RG**';

  it('dado o cursor em outra linha, quando desenha, então os sinais do título e do negrito ficam escondidos, e o negrito destacado', () => {
    // Quando
    const m = comCursorEm(texto, texto.length);
    // Então: o "## " fica escondido (a linha 0 não tem o cursor); os "**" da linha 1 aparecem, apagados
    expect(trechosDo(texto, m, 'esconder')).toEqual(['## ']);
    expect(trechosDo(texto, m, 'simbolo')).toEqual(['**', '**']);
    expect(trechosDo(texto, m, 'destaque')).toEqual(['RG']);
    expect(m.filter(x => x.tipo === 'linha').map(x => x.tipo === 'linha' && x.classe)).toEqual(['titulo-2', 'texto']);
  });

  it('dado o cursor no título, quando desenha, então o "## " aparece, apagado, e os "**" da outra linha somem', () => {
    // Quando
    const m = comCursorEm(texto, 4);
    // Então
    expect(trechosDo(texto, m, 'simbolo')).toEqual(['## ']);
    expect(trechosDo(texto, m, 'esconder')).toEqual(['**', '**']);
  });

  it('dada uma lista fora do cursor, quando desenha, então o "- " vira a bolinha, e o "- [ ] ", a caixinha', () => {
    // Dado
    const lista = '- RG\n- [ ] CPF\nfim';
    // Quando
    const m = comCursorEm(lista, lista.length);
    // Então
    expect(trechosDo(lista, m, 'marcador')).toEqual(['- ']);
    expect(trechosDo(lista, m, 'caixinha')).toEqual(['- [ ] ']);
  });

  it('dada a caixinha fora do cursor, quando a pessoa a marca, então a troca dá o mesmo texto do texto formatado', () => {
    // Dado
    const lista = 'Antes\n- [ ] CPF\n- [x] RG';
    const caixinhas = comCursorEm(lista, 0).filter(x => x.tipo === 'caixinha');
    // Quando
    const marcados = caixinhas.map(c => c.tipo === 'caixinha' && lista.slice(0, c.troca.inicio) + c.troca.texto + lista.slice(c.troca.fim));
    // Então
    expect(marcados).toEqual([alternarItemDeTarefa(lista, 1), alternarItemDeTarefa(lista, 2)]);
  });

  it('dado "- [ ] Levar **RG**" e um link, quando desenha, então a caixinha se chama como a pessoa lê o item, sem os sinais', () => {
    // Dado
    const lista = '- [ ] Levar **RG**\n- [ ] Ver [o site](https://exemplo.com)\n- [ ] \nfim';
    // Quando
    const nomes = comCursorEm(lista, lista.length).flatMap(c => c.tipo === 'caixinha' ? [c.nome] : []);
    // Então: o mesmo nome do texto formatado (o item sem texto fica com o nome vazio, e a tela diz "Item sem texto")
    expect(nomes).toEqual(['Levar RG', 'Ver o site', '']);
  });

  it('dada a divisória fora do cursor, quando desenha, então vira a linha; no cursor, o "---" aparece', () => {
    // Dado
    const t = 'a\n---';
    // Então
    expect(trechosDo(t, comCursorEm(t, 0), 'divisoria')).toEqual(['---']);
    expect(trechosDo(t, comCursorEm(t, t.length), 'simbolo')).toEqual(['---']);
  });

  it('dado um texto comprido, quando desenha só a parte da tela, então as linhas de fora ficam sem marcações', () => {
    // Dado
    const t = '**a**\n**b**\n**c**', linhas = linhasAoVivo(t);
    // Quando
    const m = marcacoesAoVivo(linhas, new Set(), { inicio: 6, fim: 10 });
    // Então
    expect(trechosDo(t, m, 'destaque')).toEqual(['b']);
  });
});

describe('A menor troca entre dois textos', () => {
  it.each([
    ['Levar RG', 'Levar o RG', { inicio: 6, fim: 6, texto: 'o ' }],
    ['abc', 'abc', { inicio: 3, fim: 3, texto: '' }],
    ['aaa', 'aa', { inicio: 2, fim: 3, texto: '' }],
    ['- a\n- b', 'a\nb', { inicio: 0, fim: 6, texto: 'a\n' }]
  ])('dado "%s" e depois "%s", quando compara, então a troca é %j', (antes, depois, troca) => {
    // Quando
    const d = diferenca(antes, depois);
    // Então
    expect(antes.slice(0, d.inicio) + d.texto + antes.slice(d.fim)).toBe(depois);
    expect(d).toEqual(troca);
  });
});

describe('O Enter numa lista', () => {
  const enter = (texto: string, posicao = texto.length) => {
    const linhas = linhasAoVivo(texto), n = [...linhasDoCursor(linhas, [{ inicio: posicao, fim: posicao }])][0];
    return continuarLista(linhas[n], { texto, inicio: posicao, fim: posicao });
  };

  it.each([
    ['- RG', '- RG\n- '],
    ['- [x] RG', '- [x] RG\n- [ ] '],
    ['1. RG', '1. RG\n2. '],
    ['9) RG', '9) RG\n10) '],
    ['> Nota', '> Nota\n> ']
  ])('dado "%s", quando a pessoa tecla Enter no fim, então a linha nova já começa a lista', (texto, novo) => {
    // Então
    expect(enter(texto)).toEqual({ texto: novo, inicio: novo.length, fim: novo.length });
  });

  it('dado um item vazio, quando a pessoa tecla Enter, então o começo sai e a lista acaba', () => {
    // Então
    expect(enter('- RG\n- ')).toEqual({ texto: '- RG\n', inicio: 5, fim: 5 });
  });

  it.each([['Texto comum'], ['## Título']])('dado "%s", quando a pessoa tecla Enter, então é o Enter de sempre', texto => {
    // Então
    expect(enter(texto)).toBeNull();
  });

  it('dado o cursor no meio do começo da linha, quando a pessoa tecla Enter, então é o Enter de sempre', () => {
    // Então
    expect(enter('- RG', 1)).toBeNull();
  });

  it('dado um item com um trecho escolhido, quando a pessoa tecla Enter, então o trecho sai e o item seguinte começa no lugar dele', () => {
    // Dado: "- abcdef", com "bcd" escolhido
    const texto = '- abcdef', [linha] = linhasAoVivo(texto);
    // Quando
    const r = continuarLista(linha, { texto, inicio: 3, fim: 6 });
    // Então
    expect(r).toEqual({ texto: '- a\n- ef', inicio: 6, fim: 6 });
  });

  it('dado um trecho escolhido que passa do item para a linha seguinte, quando a pessoa tecla Enter, então é o Enter de sempre', () => {
    // Dado
    const texto = '- abc\nfim', [linha] = linhasAoVivo(texto);
    // Então
    expect(continuarLista(linha, { texto, inicio: 3, fim: 8 })).toBeNull();
  });
});

describe('As quebras de linha do Windows ("\\r\\n")', () => {
  it.each([
    ['Um\r\nDois\r\nTres', 'Um\nDois\nTres'],
    ['Um\rDois', 'Um\nDois'],
    ['Um\nDois', 'Um\nDois']
  ])('dado %j, quando o editor o recebe, então as linhas são as mesmas, com "\\n" e sem linha a mais', (texto, esperado) => {
    // Então
    expect(quebrasComuns(texto)).toBe(esperado);
  });
});

describe('O texto que volta de quem usa o editor', () => {
  it('dado um texto gravado com "\\r\\n", quando o editor o abre, então nada muda (nenhuma linha a mais)', () => {
    // Quando
    const r = acompanharValor('Linha 1\n**Linha 2**\nLinha 3', 'Linha 1\r\n**Linha 2**\r\nLinha 3', []);
    // Então
    expect(r).toEqual({ troca: null, enviados: [] });
  });

  it('dado que a pessoa digitou "b" e "c" e o React ainda devolve "ab", quando o valor volta, então o editor não desfaz o "c"', () => {
    // Dado: o editor tem "abc" e mandou "ab" e "abc"
    // Quando
    const r = acompanharValor('abc', 'ab', ['ab', 'abc']);
    // Então: nada muda, e só "abc" ainda espera a volta
    expect(r).toEqual({ troca: null, enviados: ['abc'] });
  });

  it('dado um texto que mudou fora do editor (lido de novo), quando chega, então o editor troca só o que mudou', () => {
    // Quando
    const r = acompanharValor('Levar RG', 'Levar o RG', ['Levar RG']);
    // Então
    expect(r).toEqual({ troca: { inicio: 6, fim: 6, texto: 'o ' }, enviados: [] });
  });

  it('dado o mesmo texto do editor, quando volta, então nada muda e nada mais espera', () => {
    // Então
    expect(acompanharValor('abc', 'abc', ['ab', 'abc'])).toEqual({ troca: null, enviados: [] });
  });
});

describe('O limite de tamanho do texto', () => {
  it.each([
    ['o que cabe entra inteiro', { inicio: 5, fim: 5, texto: '6' }, 5, 6, { inicio: 5, fim: 5, texto: '6' }],
    ['o trecho colado comprido entra até o limite', { inicio: 5, fim: 5, texto: '6789' }, 5, 6, { inicio: 5, fim: 5, texto: '6' }],
    ['com o texto no limite, a letra nova não entra', { inicio: 6, fim: 6, texto: '7' }, 6, 6, null],
    ['o trecho escolhido trocado por outro maior fica no limite', { inicio: 0, fim: 2, texto: 'abcd' }, 6, 6, { inicio: 0, fim: 2, texto: 'ab' }],
    ['o que diminui o texto entra, mesmo acima do limite', { inicio: 0, fim: 3, texto: 'a' }, 9, 6, { inicio: 0, fim: 3, texto: 'a' }],
    ['o corte não parte um emoji ao meio', { inicio: 5, fim: 5, texto: 'a😀' }, 5, 7, { inicio: 5, fim: 5, texto: 'a' }]
  ])('dado que %s', (_caso, troca: Troca, tamanho: number, maximo: number, esperado: Troca | null) => {
    // Quando
    const r = caberNoLimite(troca, tamanho, maximo);
    // Então
    expect(r).toEqual(esperado);
  });
});
