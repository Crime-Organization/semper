// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  TAMANHO_DO_ENDERECO, alternarInicioDeLinha, alternarLista, alternarMarca, alternarTitulo, blocosDoTexto, linkPermitido, pedacosDaLinha,
  porLink, tirarLink, type Escolha, type Marca
} from './formatacao';

const so = (texto: string) => ({ texto, marcas: [] });

describe('Negrito e itálico na linha (#293)', () => {
  it('dada "Juntar **procuração** e *comprovante*", quando lê, então "procuração" é negrito, "comprovante" é itálico, e as marcas somem', () => {
    // Quando
    const p = pedacosDaLinha('Juntar **procuração** e *comprovante*');
    // Então
    expect(p).toEqual([so('Juntar '), { texto: 'procuração', marcas: ['negrito'] }, so(' e '), { texto: 'comprovante', marcas: ['italico'] }]);
  });

  it('dadas as marcas do Trello com sublinhado, quando lê, então também valem', () => {
    // Então
    expect(pedacosDaLinha('__a__ e _b_')).toEqual([{ texto: 'a', marcas: ['negrito'] }, so(' e '), { texto: 'b', marcas: ['italico'] }]);
  });

  it('dado itálico dentro do negrito, quando lê, então o trecho tem os dois', () => {
    // Então
    expect(pedacosDaLinha('**muito *mesmo***')).toEqual([{ texto: 'muito ', marcas: ['negrito'] }, { texto: 'mesmo', marcas: ['negrito', 'italico'] }]);
  });

  it.each([
    ['**urgente'], ['contrato_final_v2.pdf'], ['joao_silva@exemplo.com'], ['5 * 3 * 2'], ['nota** solta'], ['a*b*c'], ['** espaço **']
  ])('dado "%s", quando lê, então fica como foi escrito', texto => {
    // Então
    expect(pedacosDaLinha(texto)).toEqual([so(texto)]);
  });

  it('dado texto parecido com código de página, quando lê, então é só texto', () => {
    // Então
    expect(pedacosDaLinha('<script>alert(1)</script> <img src=x onerror=alert(1)>')).toEqual([so('<script>alert(1)</script> <img src=x onerror=alert(1)>')]);
  });
});

describe('Listas e quebras de linha (#293)', () => {
  it('dada uma descrição com linhas que começam com "- ", quando lê, então elas viram uma lista, e o resto fica como texto', () => {
    // Quando
    const b = blocosDoTexto('Levar:\n- RG\n- **CPF**\nAté sexta.');
    // Então
    expect(b).toEqual([
      { tipo: 'texto', linhas: [[so('Levar:')]] },
      { tipo: 'lista', linhas: [[so('RG')], [{ texto: 'CPF', marcas: ['negrito'] }]] },
      { tipo: 'texto', linhas: [[so('Até sexta.')]] }
    ]);
  });

  it('dada uma linha em branco antes e depois da lista, quando lê, então ela só separa, sem virar uma linha vazia a mais', () => {
    // Quando
    const b = blocosDoTexto('Levar:\n\n- RG\n\nAté sexta.\n\n\nFim');
    // Então
    expect(b).toEqual([
      { tipo: 'texto', linhas: [[so('Levar:')]] },
      { tipo: 'lista', linhas: [[so('RG')]] },
      { tipo: 'texto', linhas: [[so('Até sexta.')], [], [], [so('Fim')]] }
    ]);
  });

  it('dada uma descrição antiga com linhas em branco, quando lê, então as quebras ficam iguais', () => {
    // Quando
    const b = blocosDoTexto('Primeira\r\n\r\nTerceira');
    // Então
    expect(b).toEqual([{ tipo: 'texto', linhas: [[so('Primeira')], [], [so('Terceira')]] }]);
  });
});

/** Escreve a escolha como texto: [ e ] marcam o trecho escolhido. */
const ver = ({ texto, inicio, fim }: Escolha) => texto.slice(0, inicio) + '[' + texto.slice(inicio, fim) + ']' + texto.slice(fim);
const escolha = (comColchetes: string): Escolha => {
  const inicio = comColchetes.indexOf('['), fim = comColchetes.indexOf(']') - 1;
  return { texto: comColchetes.replace('[', '').replace(']', ''), inicio, fim };
};

describe('Botões B, I e lista (#293)', () => {
  it.each([
    ['negrito', 'Juntar [procuração] já', 'Juntar **[procuração]** já'],
    ['negrito', 'Juntar **[procuração]** já', 'Juntar [procuração] já'],
    ['negrito', 'Juntar [**procuração**] já', 'Juntar [procuração] já'],
    ['italico', 'Juntar [comprovante]', 'Juntar *[comprovante]*'],
    ['italico', 'Juntar *[comprovante]*', 'Juntar [comprovante]'],
    ['italico', '**[forte]**', '***[forte]***'],
    ['negrito', 'Nada escolhido: []', 'Nada escolhido: **[]**']
  ] as const)('dada a marca %s e "%s", quando aperta o botão, então fica "%s"', (marca, antes, depois) => {
    // Quando
    const r = alternarMarca(escolha(antes), marca);
    // Então
    expect(ver(r)).toBe(depois);
  });

  it('dadas duas linhas escolhidas, quando aperta o botão de lista, então as duas viram itens; apertando de novo, voltam', () => {
    // Dado
    const antes = escolha('Levar:\n[RG\nCPF]');
    // Quando
    const lista = alternarLista(antes);
    // Então
    expect(lista.texto).toBe('Levar:\n- RG\n- CPF');
    // Quando
    const volta = alternarLista(lista);
    // Então
    expect(volta.texto).toBe('Levar:\nRG\nCPF');
  });

  it('dado o cursor numa linha, sem trecho escolhido, quando aperta o botão de lista, então só essa linha vira item', () => {
    // Quando
    const r = alternarLista(escolha('Um\nDo[]is\nTrês'));
    // Então
    expect(r.texto).toBe('Um\n- Dois\nTrês');
  });
});

describe('Casos achados na revisão (#293)', () => {
  it('dado itálico com um negrito dentro, quando lê, então o negrito fica dentro do itálico, sem marcas cruas', () => {
    // Então
    expect(pedacosDaLinha('*Atenção: **prazo** amanhã*')).toEqual([
      { texto: 'Atenção: ', marcas: ['italico'] }, { texto: 'prazo', marcas: ['italico', 'negrito'] }, { texto: ' amanhã', marcas: ['italico'] }
    ]);
  });

  it('dada uma descrição do tamanho máximo, cheia de marcas soltas, quando lê, então termina logo, sem travar o cartão', () => {
    // Dado
    const texto = '**a* '.repeat(800) + '**a _b_ '.repeat(500);
    // Quando
    const comeco = performance.now();
    const blocos = blocosDoTexto(texto);
    // Então: a leitura antiga levava segundos
    expect(performance.now() - comeco).toBeLessThan(300);
    expect(blocos).toHaveLength(1);
  });

  it.each([
    ['italico', 'Ver [o prazo ]agora', 'Ver *[o prazo]* agora'],
    ['negrito', 'Ver[ o prazo] agora', 'Ver **[o prazo]** agora'],
    ['italico', '***[forte]***', '**[forte]**'],
    ['negrito', '***[forte]***', '*[forte]*'],
    ['italico', '[*Atenção: **prazo***]', '[Atenção: **prazo**]']
  ] as const)('dada a marca %s e "%s", quando aperta o botão, então fica "%s"', (marca, antes, depois) => {
    // Então
    expect(ver(alternarMarca(escolha(antes), marca))).toBe(depois);
  });

  it('dado um trecho de duas linhas, quando aperta B, então cada linha ganha a sua marca, e as duas aparecem em negrito', () => {
    // Quando
    const r = alternarMarca(escolha('[RG\n\nCPF]'), 'negrito');
    // Então
    expect(r.texto).toBe('**RG**\n\n**CPF**');
    expect(blocosDoTexto(r.texto)[0].linhas.flat().every(p => p.marcas.includes('negrito'))).toBe(true);
  });

  it('dado o cursor no meio de uma linha, quando aperta o botão de lista, então o cursor só anda junto, sem escolher o resto da linha', () => {
    // Então
    expect(ver(alternarLista(escolha('Um\nDo[]is\nTrês')))).toBe('Um\n- Do[]is\nTrês');
  });

  it('dada uma descrição que começa com uma linha em branco e o cursor no começo, quando aperta o botão de lista, então só a primeira linha vira item', () => {
    // Então
    expect(ver(alternarLista(escolha('[]\nabc')))).toBe('- []\nabc');
  });
});

describe('Títulos (#303)', () => {
  it('dadas linhas que começam com "# ", "## " e "### ", quando lê, então cada uma vira um título do seu nível, sem as marcas', () => {
    // Quando
    const b = blocosDoTexto('# Resumo\n## Fatos\n### Detalhe com **prazo**\nTexto.');
    // Então
    expect(b).toEqual([
      { tipo: 'titulo', nivel: 1, linhas: [[so('Resumo')]] },
      { tipo: 'titulo', nivel: 2, linhas: [[so('Fatos')]] },
      { tipo: 'titulo', nivel: 3, linhas: [[so('Detalhe com '), { texto: 'prazo', marcas: ['negrito'] }]] },
      { tipo: 'texto', linhas: [[so('Texto.')]] }
    ]);
  });

  it.each([['#hashtag'], ['#### quatro'], [' # com espaço antes']])('dado "%s", quando lê, então fica como texto', texto => {
    // Então
    expect(blocosDoTexto(texto)).toEqual([{ tipo: 'texto', linhas: [[so(texto)]] }]);
  });

  it('dada uma linha em branco antes e depois de um título, quando lê, então ela só separa', () => {
    // Então
    expect(blocosDoTexto('Antes\n\n# Título\n\nDepois')).toEqual([
      { tipo: 'texto', linhas: [[so('Antes')]] },
      { tipo: 'titulo', nivel: 1, linhas: [[so('Título')]] },
      { tipo: 'texto', linhas: [[so('Depois')]] }
    ]);
  });

  it('dada uma descrição antiga com uma linha começando por "# ", quando lê, então ela passa a aparecer como título (a regra mudou na #303)', () => {
    // Então
    expect(blocosDoTexto('# 1 via do contrato')).toEqual([{ tipo: 'titulo', nivel: 1, linhas: [[so('1 via do contrato')]] }]);
  });
});

const comLink = (texto: string, link: string, marcas: Marca[] = []) => ({ texto, marcas, link });
const SITE = 'https://exemplo.com/';

describe('Links (#303)', () => {
  it.each([
    ['https://exemplo.com.br/a', 'https://exemplo.com.br/a'],
    ['http://exemplo.com', 'http://exemplo.com/'],
    ['mailto:contato@exemplo.com', 'mailto:contato@exemplo.com']
  ])('dado um link para "%s", quando lê, então vira link para "%s", sem as marcas', (endereco, href) => {
    // Então
    expect(pedacosDaLinha(`Ver [o site](${endereco}) hoje`)).toEqual([so('Ver '), comLink('o site', href), so(' hoje')]);
  });

  it.each([
    ['[x](javascript:alert)'], ['[x](JAVASCRIPT:alert)'], ['[x](data:text/html,oi)'], ['[x](/relativo)'], ['[x](www.exemplo.com)'],
    ['[x](https://)'], ['[x]()'], ['[sem endereço]'], ['texto] solto [aqui'], ['[a] (https://exemplo.com)'], ['\\[x](https://exemplo.com)']
  ])('dado "%s", quando lê, então fica como foi escrito, sem link', texto => {
    // Então
    expect(pedacosDaLinha(texto)).toEqual([so(texto)]);
  });

  it('dado um endereço com "*" e "_", quando lê, então eles ficam no endereço e não viram marca', () => {
    // Então
    expect(pedacosDaLinha('[doc](https://exemplo.com/a_b*c_d*)')).toEqual([comLink('doc', 'https://exemplo.com/a_b*c_d*')]);
  });

  it('dado um link em negrito, quando lê, então o pedaço tem o negrito e o link', () => {
    // Então
    expect(pedacosDaLinha('**[prazo](https://exemplo.com)**')).toEqual([comLink('prazo', SITE, ['negrito'])]);
  });

  it('dado negrito dentro do texto do link, quando lê, então os dois pedaços têm o mesmo link e só um é negrito', () => {
    // Então
    expect(pedacosDaLinha('[**leia** antes](https://exemplo.com)')).toEqual([comLink('leia', SITE, ['negrito']), comLink(' antes', SITE)]);
  });

  it('dado um negrito que começa dentro do link e termina fora, quando lê, então o link vale e as marcas ficam como texto', () => {
    // Então
    expect(pedacosDaLinha('[**a](https://exemplo.com) b**')).toEqual([comLink('**a', SITE), so(' b**')]);
  });

  it('dado um negrito que começa fora do link e termina dentro, quando lê, então o link vale e as marcas ficam como texto', () => {
    // Então
    expect(pedacosDaLinha('**a [b**](https://exemplo.com)')).toEqual([so('**a '), comLink('b**', SITE)]);
  });

  it('dado um link dentro de outro, quando lê, então só o de dentro vale', () => {
    // Então
    expect(pedacosDaLinha('[a [b](https://um.com) c](https://dois.com)')).toEqual([
      so('[a '), comLink('b', 'https://um.com/'), so(' c](https://dois.com)')
    ]);
  });

  it('dado um link sem texto, quando lê, então mostra o endereço, para o link não sumir', () => {
    // Então
    expect(pedacosDaLinha('[](https://exemplo.com)')).toEqual([comLink(SITE, SITE)]);
  });

  it('dado um item de lista e um título com link, quando lê, então o link vale dentro deles', () => {
    // Então
    expect(blocosDoTexto('- [a](https://exemplo.com)\n## [b](https://exemplo.com)')).toEqual([
      { tipo: 'lista', linhas: [[comLink('a', SITE)]] },
      { tipo: 'titulo', nivel: 2, linhas: [[comLink('b', SITE)]] }
    ]);
  });

  it.each([
    ['https://exemplo.com', SITE], ['MAILTO:a@exemplo.com', 'mailto:a@exemplo.com'],
    ['javascript:alert(1)', null], ['JavaScript:alert(1)', null], ['data:text/html,oi', null], ['/relativo', null], ['ftp://exemplo.com', null],
    [SITE + 'a'.repeat(TAMANHO_DO_ENDERECO), null]
  ])('dado o endereço "%s", quando confere, então dá %s', (endereco, esperado) => {
    // Então
    expect(linkPermitido(endereco)).toBe(esperado);
  });

  it('dada uma descrição do tamanho máximo, cheia de colchetes e parênteses soltos, quando lê, então termina logo, sem travar o cartão', () => {
    // Dado
    const texto = '[a](b '.repeat(400) + '[[[['.repeat(200) + ']((' .repeat(200) + '[**a](https://e.com)**'.repeat(40);
    // Quando
    const comeco = performance.now();
    const blocos = blocosDoTexto(texto);
    // Então
    expect(performance.now() - comeco).toBeLessThan(300);
    expect(blocos).toHaveLength(1);
  });
});

/** Como ver e escolha, mas com « e » marcando o trecho escolhido, para os textos que têm colchetes de verdade. */
const verLink = ({ texto, inicio, fim }: Escolha) => texto.slice(0, inicio) + '«' + texto.slice(inicio, fim) + '»' + texto.slice(fim);
const escolhaLink = (marcado: string): Escolha => {
  const inicio = marcado.indexOf('«'), fim = marcado.indexOf('»') - 1;
  return { texto: marcado.replace('«', '').replace('»', ''), inicio, fim };
};

describe('Botões Cabeçalho e Link (#303)', () => {
  it('dado o cursor numa linha, quando aperta Cabeçalho, então ela vira título "## "; apertando de novo, volta a texto', () => {
    // Quando
    const titulo = alternarTitulo(escolha('Um\nFa[]tos\nTrês'));
    // Então
    expect(ver(titulo)).toBe('Um\n## Fa[]tos\nTrês');
    // Quando
    const volta = alternarTitulo(titulo);
    // Então
    expect(ver(volta)).toBe('Um\nFa[]tos\nTrês');
  });

  it.each([
    ['[- RG]', 'titulo', '## [RG]'],
    ['[# Fatos]', 'titulo', '## [Fatos]'],
    ['[## Fatos]', 'lista', '- [Fatos]'],
    ['[### Fatos\n- RG]', 'titulo', '## [Fatos\n## RG]']
  ] as const)('dado "%s", quando aperta o botão de %s, então o começo antigo sai e fica "%s"', (antes, tipo, depois) => {
    // Então
    expect(ver(alternarInicioDeLinha(escolha(antes), tipo))).toBe(depois);
  });

  it('dado um trecho escolhido, quando põe o link, então ele fica entre colchetes com o endereço, e continua escolhido', () => {
    // Quando
    const r = postoComLink(escolhaLink('Ver «o site »hoje'), SITE);
    // Então
    expect(verLink(r)).toBe('Ver [«o site»](https://exemplo.com/) hoje');
    expect(pedacosDaLinha(r.texto)).toEqual([so('Ver '), comLink('o site', SITE), so(' hoje')]);
  });

  it('dado nenhum trecho escolhido, quando põe o link, então o endereço vira o texto do link, escolhido para escrever por cima', () => {
    // Então
    expect(verLink(postoComLink(escolhaLink('Ver: «»'), SITE))).toBe('Ver: [«https://exemplo.com/»](https://exemplo.com/)');
  });

  it('dado um endereço com parênteses, quando põe o link, então eles vão codificados e o link continua valendo', () => {
    // Quando
    const r = postoComLink(escolhaLink('«verbete»'), 'https://exemplo.com/A_(b)');
    // Então
    expect(r.texto).toBe('[verbete](https://exemplo.com/A_%28b%29)');
    expect(pedacosDaLinha(r.texto)).toEqual([comLink('verbete', 'https://exemplo.com/A_%28b%29')]);
  });

  it('dado o trecho escolhido dentro de um link, quando tira o link, então fica só o texto, ainda escolhido', () => {
    // Quando
    const r = tirarLink(escolhaLink('Ver [«o site»](https://exemplo.com/) hoje'));
    // Então
    expect(r && verLink(r)).toBe('Ver «o site» hoje');
  });

  it('dado o cursor dentro do texto de um link, quando tira o link, então fica só o texto', () => {
    // Então
    expect(tirarLink(escolhaLink('[o s«»ite](mailto:a@exemplo.com)'))?.texto).toBe('o site');
  });

  it.each([['Ver «o site» hoje'], ['Ver [«x»](javascript:alert) hoje'], ['«Ver» [x](https://exemplo.com/)']])('dado "%s", quando procura o link para tirar, então não há', antes => {
    // Então
    expect(tirarLink(escolhaLink(antes))).toBeNull();
  });
});

/** O link posto pelo botão; falha o teste se o botão recusar. */
function postoComLink(e: Escolha, endereco: string): Escolha {
  const r = porLink(e, endereco);
  if (!r) throw new Error('o botão recusou o link');
  return r;
}

describe('O que o botão Link grava sempre vira link (#303)', () => {
  it.each([['mailto:a@exemplo.com, b@exemplo.com'], ['mailto: a@exemplo.com']])('dado o endereço com espaço "%s", quando confere, então não vira link', endereco => {
    // Então
    expect(linkPermitido(endereco)).toBeNull();
  });

  it('dado um endereço curto que cresce ao ser escrito como o navegador o entende (acentos), quando confere, então passa do limite e não vira link', () => {
    // Dado: 1020 caracteres escritos, mais de 6000 depois de "ç" virar "%C3%A7"
    const endereco = SITE + 'ç'.repeat(1000);
    // Então
    expect(endereco.length).toBeLessThan(TAMANHO_DO_ENDERECO);
    expect(linkPermitido(endereco)).toBeNull();
  });

  it('dado um endereço do tamanho máximo que ganha a "/" do fim, quando confere, então não vira link', () => {
    // Dado
    const endereco = 'https://' + 'a'.repeat(TAMANHO_DO_ENDERECO - 'https://'.length - '.com'.length) + '.com';
    // Então
    expect(endereco.length).toBe(TAMANHO_DO_ENDERECO);
    expect(linkPermitido(endereco)).toBeNull();
  });

  it('dado um endereço com parênteses, quando confere, então ele já sai como vai no texto, e o que é gravado é lido como o mesmo link', () => {
    // Quando
    const endereco = linkPermitido('https://exemplo.com/A_(b)');
    // Então
    expect(endereco).toBe('https://exemplo.com/A_%28b%29');
    expect(pedacosDaLinha(postoComLink(escolhaLink('«verbete»'), endereco ?? '').texto)).toEqual([comLink('verbete', 'https://exemplo.com/A_%28b%29')]);
  });
});

describe('Botão Link sobre um link já escrito (#303)', () => {
  it.each([
    ['o cursor no endereço', 'Veja [site](htt«»ps://x.com) agora'],
    ['o cursor entre "]" e "("', 'Veja [site]«»(https://x.com) agora'],
    ['a marcação toda escolhida', 'Veja «[site](https://x.com)» agora']
  ])('dado %s, quando aperta Link, então o link sai e fica o texto dele, escolhido', (_caso, antes) => {
    // Quando
    const r = tirarLink(escolhaLink(antes));
    // Então
    expect(r && verLink(r)).toBe('Veja «site» agora');
  });

  it.each([
    ['começa antes do link e termina dentro', 'V«eja [si»te](https://x.com) agora'],
    ['começa no endereço e termina depois', 'Veja [site](https://«x.com) ag»ora'],
    ['tem um link inteiro e mais texto', '«Veja [site](https://x.com) agora»']
  ])('dado um trecho que %s, quando põe outro link, então o botão recusa e o texto não muda', (_caso, antes) => {
    // Então
    expect(porLink(escolhaLink(antes), SITE)).toBeNull();
  });
});

describe('O botão Link lê os links como a leitura (#303)', () => {
  it('dado "\\[a](u)", que aparece como texto, quando procura o link para tirar, então não há', () => {
    // Então
    expect(pedacosDaLinha('\\[a](https://x.com)')).toEqual([so('\\[a](https://x.com)')]);
    expect(tirarLink(escolhaLink('\\[«a»](https://x.com)'))).toBeNull();
  });

  it('dado um link cujo texto tem "]", quando tira o link com o cursor dentro, então fica o texto dele', () => {
    // Dado
    expect(pedacosDaLinha('[nota ] importante](https://x.com/)')).toEqual([comLink('nota ] importante', 'https://x.com/')]);
    // Então
    expect(tirarLink(escolhaLink('[no«»ta ] importante](https://x.com/)'))?.texto).toBe('nota ] importante');
  });

  it.each([['«[nota] importante»'], ['C:\\«pasta»']])('dado o trecho "%s", que não seria lido como link, quando põe o link, então o botão recusa', antes => {
    // Então
    expect(porLink(escolhaLink(antes), SITE)).toBeNull();
  });
});
