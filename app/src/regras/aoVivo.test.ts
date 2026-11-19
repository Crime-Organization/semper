// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  acompanharValor, apagar, caberNoLimite, continuarLista, diferenca, escreverComMarca, escreverNoEscolhido, formatacaoTirada, linhaDaPosicao,
  linhasAoVivo, marcacoesAoVivo, marcarNoCursor, ondeEscrever, posicaoDoCursor, quebrasComuns, soEscondido, tomaOLugar,
  type MarcaPendente, type Marcacao, type Troca
} from './aoVivo';
import { alternarItemDeTarefa, alternarMarca, marcasNaLinha, pedacosDaLinha, type MarcaDoBotao } from './formatacao';

/** O texto de cada marcação de um tipo, para ler o teste como a pessoa vê a linha. */
const trechosDo = (texto: string, marcacoes: Marcacao[], tipo: Marcacao['tipo']) =>
  marcacoes.filter(m => m.tipo === tipo).map(m => 'fim' in m ? texto.slice(m.inicio, m.fim) : '');
/** As marcações do texto (as mesmas com o cursor em qualquer lugar). */
const marcacoesDe = (texto: string) => marcacoesAoVivo(linhasAoVivo(texto));
/** O texto como a pessoa o vê no editor: sem o que as marcações escondem ou trocam por um desenho (a bolinha vira "•"). */
function comoAparece(texto: string): string {
  const desenho: Partial<Record<Marcacao['tipo'], string>> = { marcador: '•', caixinha: '☐', divisoria: '—' };
  let r = '', p = 0;
  for (const m of marcacoesDe(texto).filter(tomaOLugar)) {
    if (!('fim' in m) || m.inicio < p) continue;
    r += texto.slice(p, m.inicio) + (desenho[m.tipo] ?? '');
    p = m.fim;
  }
  return r + texto.slice(p);
}

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

  it('dado um endereço colado com "_" (como o do livro do pedido da #368), quando lê, então nada nele vira itálico', () => {
    // Dado
    const linha = 'https://d1.cloudfront.net/37174467/Cap_1_-_Livro_IG-libre.pdf?1427833695=&disposition=inline_x_&Key-Pair-Id=A';
    // Quando
    const { simbolos, trechos } = marcasNaLinha(linha);
    // Então
    expect(simbolos).toEqual([]);
    expect(trechos).toEqual([]);
    expect(pedacosDaLinha(linha)).toEqual([{ texto: linha, marcas: [] }]);
  });

  it.each([
    ['http://site.com/a*b*c e *depois*', ['*', '*'], ['depois']],
    ['**https://site.com/a_b_c**', ['**', '**'], ['https://site.com/a_b_c']],
    ['_veja https://site.com/x_y_', ['_', '_'], ['veja https://site.com/x_y']],
    ['[https://a.com/x_y_z](https://a.com/x_y_z) e _fim_', ['[', '](https://a.com/x_y_z)', '_', '_'], ['https://a.com/x_y_z', 'fim']]
  ])('dado "%s", quando lê, então o endereço fica inteiro e só as marcas de fora dele valem', (linha, sinais, destaques) => {
    // Quando
    const { simbolos, trechos } = marcasNaLinha(linha);
    // Então
    expect(simbolos.map(s => linha.slice(s.inicio, s.fim))).toEqual(sinais);
    expect(trechos.map(t => linha.slice(t.inicio, t.fim))).toEqual(destaques);
  });

  it('dado "_https_" (a palavra, sem o "://"), quando lê, então não é endereço: é um itálico comum', () => {
    // Quando
    const { trechos } = marcasNaLinha('x _https_');
    // Então
    expect(trechos).toEqual([{ inicio: 3, fim: 8, marcas: ['italico'] }]);
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

  it('dado um texto de quatro linhas, quando procura a linha de cada posição, então acha a linha certa (também no fim dela)', () => {
    // Dado
    const linhas = linhasAoVivo('a\nbc\n\nd');
    // Então
    expect([0, 1, 2, 4, 5, 6].map(p => linhaDaPosicao(linhas, p))).toEqual([0, 0, 1, 1, 2, 3]);
  });
});

// A regra mudou (#368, pedido do dono): os sinais não aparecem mais na linha do cursor. A formatação fica desenhada sempre.
describe('O que o editor esconde e mostra: sempre o mesmo, com o cursor em qualquer lugar', () => {
  const texto = '## Pendências\nLevar o **RG**';

  it('quando desenha, então os sinais do título e do negrito ficam escondidos, e o negrito destacado', () => {
    // Quando
    const m = marcacoesDe(texto);
    // Então
    expect(trechosDo(texto, m, 'esconder')).toEqual(['## ', '**', '**']);
    expect(trechosDo(texto, m, 'destaque')).toEqual(['RG']);
    expect(m.filter(x => x.tipo === 'linha').map(x => x.tipo === 'linha' && x.classe)).toEqual(['titulo-2', 'texto']);
    expect(comoAparece(texto)).toBe('Pendências\nLevar o RG');
  });

  it('dada uma lista com links colados, quando desenha, então cada "- " vira a bolinha (nunca o "-" escrito), e o "- [ ] ", a caixinha', () => {
    // Dado
    const lista = '- https://site.com/Cap_1_-_Livro_IG.pdf\n- [ ] CPF\n> Nota\n---';
    // Então
    expect(comoAparece(lista)).toBe('•https://site.com/Cap_1_-_Livro_IG.pdf\n☐CPF\nNota\n—');
  });

  it('quando desenha, então só o que esconde ou troca o texto (sinais, bolinha, caixinha, divisória) é pulado inteiro pelo cursor', () => {
    // Dado
    const t = '- [ ] **a**\n- b\n---';
    // Quando
    const pulados = marcacoesDe(t).filter(tomaOLugar).map(m => m.tipo);
    // Então: as linhas e os destaques não
    expect(pulados).toEqual(['caixinha', 'esconder', 'esconder', 'marcador', 'divisoria']);
  });

  it('dada a caixinha, quando a pessoa a marca, então a troca dá o mesmo texto do texto formatado', () => {
    // Dado
    const lista = 'Antes\n- [ ] CPF\n- [x] RG';
    const caixinhas = marcacoesDe(lista).filter(x => x.tipo === 'caixinha');
    // Quando
    const marcados = caixinhas.map(c => c.tipo === 'caixinha' && lista.slice(0, c.troca.inicio) + c.troca.texto + lista.slice(c.troca.fim));
    // Então
    expect(marcados).toEqual([alternarItemDeTarefa(lista, 1), alternarItemDeTarefa(lista, 2)]);
  });

  it('dado "- [ ] Levar **RG**" e um link, quando desenha, então a caixinha se chama como a pessoa lê o item, sem os sinais', () => {
    // Dado
    const lista = '- [ ] Levar **RG**\n- [ ] Ver [o site](https://exemplo.com)\n- [ ] \nfim';
    // Quando
    const nomes = marcacoesDe(lista).flatMap(c => c.tipo === 'caixinha' ? [c.nome] : []);
    // Então: o mesmo nome do texto formatado (o item sem texto fica com o nome vazio, e a tela diz "Item sem texto")
    expect(nomes).toEqual(['Levar RG', 'Ver o site', '']);
  });

  it('dado um título e uma citação, quando desenha, então o começo escondido leva o que o leitor de tela diz no lugar dele', () => {
    // Dado
    const t = '## Pendências\n> Nota';
    // Quando
    const leituras = marcacoesDe(t).flatMap(m => m.tipo === 'esconder' && m.leitura ? [m.leitura] : []);
    // Então
    expect(leituras).toEqual(['Título 2', 'Citação']);
  });

  it('dada a divisória, quando desenha, então ela vira a linha', () => {
    // Dado
    const t = 'a\n---';
    // Então
    expect(trechosDo(t, marcacoesDe(t), 'divisoria')).toEqual(['---']);
  });

  it('dado um texto comprido, quando desenha só a parte da tela, então as linhas de fora ficam sem marcações', () => {
    // Dado
    const t = '**a**\n**b**\n**c**', linhas = linhasAoVivo(t);
    // Quando
    const m = marcacoesAoVivo(linhas, { inicio: 6, fim: 10 });
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
    const linhas = linhasAoVivo(texto);
    return continuarLista(linhas[linhaDaPosicao(linhas, posicao)], { texto, inicio: posicao, fim: posicao });
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

  it('dado o cursor no começo do texto de um título, quando a pessoa tecla Enter, então a linha nova entra em cima e o título fica', () => {
    // Então
    expect(enter('## Pendências', 3)).toEqual({ texto: '\n## Pendências', inicio: 4, fim: 4 });
  });

  it('dado um título vazio, quando a pessoa tecla Enter, então o "## " sai, como no item de lista vazio', () => {
    // Então
    expect(enter('Antes\n## ')).toEqual({ texto: 'Antes\n', inicio: 6, fim: 6 });
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

/** O Backspace (ou o Delete) no texto com o cursor em "|" (ou o trecho escolhido entre os dois "|"): o texto e o cursor depois. */
function teclar(comCursor: string, paraTras = true) {
  const inicio = comCursor.indexOf('|'), fim = comCursor.lastIndexOf('|') - (comCursor.indexOf('|') === comCursor.lastIndexOf('|') ? 0 : 1);
  const texto = comCursor.replaceAll('|', '');
  const r = apagar(linhasAoVivo(texto), { texto, inicio, fim }, paraTras);
  return r && r.texto.slice(0, r.inicio) + '|' + r.texto.slice(r.inicio);
}

describe('O Backspace e o Delete apagam o que a pessoa vê, sem desmanchar a formatação (#368)', () => {
  it.each([
    ['- |Procuração', '|Procuração'],
    ['- [ ] |Ligar', '|Ligar'],
    ['## |Pendências', '|Pendências'],
    ['> |Nota', '|Nota'],
    ['1. |Um', '|Um'],
    ['Antes\n- |', 'Antes\n|']
  ])('dado "%s", quando a pessoa tecla Backspace no começo do texto da linha, então a formatação da linha sai', (antes, depois) => {
    // Então
    expect(teclar(antes)).toBe(depois);
  });

  it.each([
    ['Levar o **RG**|', 'Levar o **R|**'],
    ['Levar o **RG|**', 'Levar o **R|**'],
    ['Ver [o site](https://a.com)|', 'Ver [o sit|](https://a.com)'],
    ['Use `cod`| aqui', 'Use `co|` aqui']
  ])('dado "%s", quando a pessoa tecla Backspace logo depois do sinal escondido, então sai a letra, e os sinais ficam', (antes, depois) => {
    // Então
    expect(teclar(antes)).toBe(depois);
  });

  it.each([
    ['Levar o **G**|', 'Levar o |'],
    ['- **G**|', '- |'],
    ['Ver [x](https://a.com)|', 'Ver |'],
    ['**a** |**b**', '**a|b**']
  ])('dado "%s", quando o Backspace deixaria a formatação vazia ou partida, então ela sai inteira ou se junta, sem sinal à mostra', (antes, depois) => {
    // Então
    expect(teclar(antes)).toBe(depois);
  });

  it('dado "**RG**" escolhido inteiro, quando a pessoa tecla Backspace, então tudo sai (e não sobram os "**")', () => {
    // Então
    expect(teclar('Levar o |**RG**|')).toBe('Levar o |');
    expect(teclar('Levar o **|RG**|')).toBe('Levar o |');
  });

  it('dado um emoji antes do cursor, quando a pessoa tecla Backspace, então ele sai inteiro (as duas metades)', () => {
    // Então
    expect(teclar('**ok😀**|')).toBe('**ok|**');
  });

  it.each([
    ['|**RG** hoje', '|**G** hoje'],
    ['Levar o **R|G**', 'Levar o **R|**'],
    ['Levar o |**G** hoje', 'Levar o | hoje']
  ])('dado "%s", quando a pessoa tecla Delete, então sai a letra da frente, como a pessoa a vê', (antes, depois) => {
    // Então
    expect(teclar(antes, false)).toBe(depois);
  });

  it('dado o cursor no fim de uma linha e um item embaixo, quando a pessoa tecla Delete, então o texto do item vem sem o "- "', () => {
    // Então
    expect(teclar('Levar|\n- RG', false)).toBe('Levar|RG');
  });

  it.each([
    ['Antes\n|\n- RG', 'Antes\n|- RG'],
    ['Antes\n|\n## Título', 'Antes\n|## Título'],
    ['|\n- [ ] Ligar', '|- [ ] Ligar'],
    ['|\n> Nota', '|> Nota']
  ])('dada uma linha vazia em "%s", quando a pessoa tecla Delete nela, então só ela sai, e a de baixo continua formatada', (antes, depois) => {
    // Então
    expect(teclar(antes, false)).toBe(depois);
  });

  it.each([
    ['|- Procuração|\n- RG', '- |\n- RG'],
    ['|## Pendências|', '## |'],
    ['|- [ ] Ligar|', '- [ ] |'],
    ['|> Nota|', '> |']
  ])('dado o texto todo da linha escolhido junto com o começo escondido ("%s"), quando a pessoa tecla Backspace, então o texto sai e a formatação fica', (antes, depois) => {
    // Então
    expect(teclar(antes)).toBe(depois);
  });

  it.each([
    ['Texto\n|- RG'],
    ['```\n**a|**\n```'],
    ['a|\nb|']
  ])('dado "%s" (começo da linha, código, trecho de várias linhas), quando a pessoa apaga, então é o Backspace de sempre', antes => {
    // Então
    expect(teclar(antes)).toBeNull();
  });

  it('dado o texto guardado, quando a pessoa apaga uma letra, então o Markdown continua o mesmo de antes, só sem ela', () => {
    // Então
    expect(teclar('- [ ] Levar **RG** e [site](https://a.com)|')).toBe('- [ ] Levar **RG** e [sit|](https://a.com)');
  });
});

describe('Onde entra o que a pessoa digita colado a um sinal escondido (#368)', () => {
  /** Digita no "|" e devolve o texto com o cursor depois do que entrou. */
  const digitar = (comCursor: string, inserido: string) => {
    const texto = comCursor.replace('|', ''), p = ondeEscrever(linhasAoVivo(texto), texto, comCursor.indexOf('|'), inserido);
    return texto.slice(0, p) + inserido + '|' + texto.slice(p);
  };

  it.each([
    ['Levar o **contrato**|', 's', 'Levar o **contratos|**'],
    ['**|RG** hoje', ' ', ' |**RG** hoje'],
    ['|- RG', 'x', '- x|RG'],
    ['Levar o **R|**', 'G', 'Levar o **RG|**'],
    ['- |', 'https://site.com/a_b_c', '- https://site.com/a_b_c|']
  ])('dado "%s", quando a pessoa digita "%s", então entra onde a formatação se mantém', (antes, inserido, depois) => {
    // Então
    expect(digitar(antes, inserido)).toBe(depois);
  });

  it.each([
    ['-|', ' ', '- |'],
    ['#|', ' ', '# |'],
    ['**negrito*|', '*', '**negrito**|'],
    ['- [ ]|', ' ', '- [ ] |']
  ])('dado "%s", quando a pessoa digita a sintaxe na mão ("%s"), então ela entra onde está o cursor e vira formatação', (antes, inserido, depois) => {
    // Então
    expect(digitar(antes, inserido)).toBe(depois);
  });
});

describe('O que a pessoa digita ou cola por cima de um trecho escolhido (#368)', () => {
  /** Escreve "inserido" por cima do trecho entre os dois "|" e devolve o texto com o cursor depois (null: a troca de sempre). */
  const porCima = (comEscolha: string, inserido: string) => {
    const inicio = comEscolha.indexOf('|'), fim = comEscolha.lastIndexOf('|') - 1, texto = comEscolha.replaceAll('|', '');
    const r = escreverNoEscolhido(linhasAoVivo(texto), { texto, inicio, fim }, inserido);
    return r && r.texto.slice(0, r.inicio) + '|' + r.texto.slice(r.inicio);
  };

  it.each([
    ['|- https://velho.com|', 'https://novo.com/a_b', '- https://novo.com/a_b|'],
    ['Links:\n|- https://velho.com|\n- outro', 'https://novo.com', 'Links:\n- https://novo.com|\n- outro'],
    ['|- [ ] RG|', 'CPF', '- [ ] CPF|'],
    ['|## Pendências|', 'Prazos', '## Prazos|']
  ])('dado "%s" escolhido inteiro (com o começo escondido), quando a pessoa cola "%s", então a linha continua formatada', (antes, inserido, depois) => {
    // Então
    expect(porCima(antes, inserido)).toBe(depois);
  });

  it('dado um trecho escolhido em negrito, quando a pessoa digita por cima, então não sobra nenhum "**" à mostra', () => {
    // Então
    expect(porCima('Levar o |**RG**| hoje', 'CPF')).toBe('Levar o CPF| hoje');
  });

  it.each([
    ['|a\nb|', 'x'],
    ['|- a|', 'x\ny']
  ])('dado "%s" (várias linhas, ou um texto com quebra), quando a pessoa escreve por cima, então é a troca de sempre', (antes, inserido) => {
    // Então
    expect(porCima(antes, inserido)).toBeNull();
  });
});

describe('O B e o I com o cursor parado, sem trecho escolhido (#368)', () => {
  /** O botão da marca no "|". */
  const marcar = (comCursor: string, marca: MarcaDoBotao = 'negrito') => {
    const texto = comCursor.replace('|', '');
    return marcarNoCursor(linhasAoVivo(texto), texto, comCursor.indexOf('|'), marca);
  };
  /**
   * O botão da marca no "|" e, depois, cada letra digitada uma a uma, como o editor faz: com a marca pendente, ela vale para a
   * letra (escreverComMarca); sem ela, a letra entra onde a formatação se mantém (ondeEscrever). O texto, com o cursor no "|".
   */
  function marcarEDigitar(comCursor: string, digitado: string, marca: MarcaDoBotao = 'negrito') {
    const r = marcar(comCursor, marca);
    let texto = comCursor.replace('|', ''), p = comCursor.indexOf('|'), pendente: MarcaPendente | null = null;
    if ('troca' in r) ({ texto, inicio: p } = r.troca);
    else ({ pendente } = r);
    if (pendente) p = pendente.posicao;
    for (const letra of digitado) {
      const linhas = linhasAoVivo(texto);
      if (pendente?.posicao === p) {
        const escrito = escreverComMarca(linhas, texto, pendente, letra);
        ({ texto, inicio: p } = escrito.escolha);
        pendente = escrito.pendente;
        continue;
      }
      const onde = ondeEscrever(linhas, texto, p, letra);
      texto = texto.slice(0, onde) + letra + texto.slice(onde);
      p = onde + letra.length;
    }
    return texto.slice(0, p) + '|' + texto.slice(p);
  }

  it('dada uma linha vazia, quando a pessoa clica em Negrito, então o texto não muda (nada de "****", que viraria uma divisória) e a marca espera a letra', () => {
    // Então
    expect(marcar('Antes\n|')).toEqual({ pendente: { posicao: 6, marca: 'negrito', ligar: true } });
  });

  it.each([
    ['Antes\n|', 'RG', 'Antes\n**RG|**'],
    ['Levar |', 'RG', 'Levar **RG|**'],
    ['- |', 'RG', '- **RG|**'],
    ['Levar|', ' RG', 'Levar **RG|**']
  ])('dado "%s", quando a pessoa clica em Negrito e digita "%s", então o que ela digitou sai em negrito, sem sinal à mostra', (antes, digitado, depois) => {
    // Quando
    const r = marcarEDigitar(antes, digitado);
    // Então
    expect(r).toBe(depois);
    expect(linhasAoVivo(r.replace('|', '')).map(l => l.tipo)).not.toContain('divisoria');
  });

  it('dada uma linha vazia, quando a pessoa clica em Itálico e digita, então o que ela digitou sai em itálico', () => {
    // Então
    expect(marcarEDigitar('|', 'prazo', 'italico')).toBe('*prazo|*');
  });

  it.each([
    ['Levar o **RG**|', 14],
    ['Levar o **RG|**', 14],
    ['Levar o |**RG** hoje', 8],
    ['Levar o **|RG** hoje', 8]
  ])('dado o cursor colado a um negrito ("%s"), quando a pessoa clica em Negrito, então a marca é desligada e o cursor vai para fora dos sinais (%i)', (antes, posicao) => {
    // Então
    expect(marcar(antes)).toEqual({ pendente: { posicao, marca: 'negrito', ligar: false } });
  });

  it('dado o cursor logo depois de um negrito, quando a pessoa clica em Negrito e digita " hoje", então " hoje" sai sem negrito, e nenhum "*" aparece', () => {
    // Quando
    const r = marcarEDigitar('Levar o **RG**|', ' hoje');
    // Então
    expect(r).toBe('Levar o **RG** hoje|');
    expect(comoAparece(r.replace('|', ''))).toBe('Levar o RG hoje');
  });

  it('dado o cursor no meio de um negrito, quando a pessoa clica em Negrito, então o trecho perde o negrito, e o cursor fica na mesma letra', () => {
    // Então
    expect(marcar('Levar o **con|trato** hoje')).toEqual({ troca: { texto: 'Levar o contrato hoje', inicio: 11, fim: 11 } });
  });

  it('dado o cursor no meio de uma palavra, quando a pessoa clica em Negrito, então a palavra fica em negrito, e o cursor fica na mesma letra', () => {
    // Então
    expect(marcar('Levar o con|trato')).toEqual({ troca: { texto: 'Levar o **contrato**', inicio: 13, fim: 13 } });
  });

  it('dado o cursor numa linha de código, quando a pessoa clica em Negrito, então valem os sinais de sempre (lá eles ficam à mostra)', () => {
    // Dado
    const texto = '```\nx\n```';
    // Então
    expect(marcar('```\nx|\n```')).toEqual({ troca: alternarMarca({ texto, inicio: 5, fim: 5 }, 'negrito') });
  });
});

describe('O aviso para o leitor de tela quando a linha perde a formatação (#368)', () => {
  it.each([
    ['lista', 'texto', 'Item de lista tirado'],
    ['titulo', 'texto', 'Título tirado'],
    ['tarefa', 'texto', 'Caixinha tirada'],
    ['citacao', 'texto', 'Citação tirada'],
    ['lista', 'lista', null],
    ['texto', 'texto', null],
    ['lista', 'titulo', null]
  ] as const)('dada a linha "%s" que virou "%s", quando avisa, então o leitor de tela ouve %j', (antes, depois, aviso) => {
    // Então
    expect(formatacaoTirada(antes, depois)).toBe(aviso);
  });
});

describe('Onde o cursor para (#368)', () => {
  it.each([
    ['## Título', 0, 3],
    ['a\n- RG', 2, 4],
    ['- [ ] RG', 0, 6],
    ['1. Um', 0, 0],
    ['Texto', 0, 0]
  ])('dado "%s", quando o cursor vai para a posição %i, então ele fica na %i (nunca antes de um começo escondido)', (texto, posicao, esperada) => {
    // Então
    expect(posicaoDoCursor(linhasAoVivo(texto), posicao)).toBe(esperada);
  });

  it.each([
    ['Levar o **RG**', 12, 14, true],
    ['## Título', 0, 3, true],
    ['- RG', 0, 2, true],
    ['Levar o **RG**', 11, 14, false],
    ['a\n**b**', 1, 4, false]
  ])('dado "%s", quando a seta anda de %i até %i, então só passou pelo escondido: %s', (texto, de, ate, esperado) => {
    // Então
    expect(soEscondido(linhasAoVivo(texto), de, ate)).toBe(esperado);
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
