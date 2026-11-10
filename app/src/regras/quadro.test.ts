// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { antesDeAoAndar, blocosDoQuadro, cartoesEmPalavras, colunaComMarco, colunaDoCartaoNovo, grupoEstaAberto, MARCOS, ordemAoPosicionar, ordemEntre, podeExcluirColuna } from './quadro';

describe('Colunas-marco', () => {
  it.each([
    ['um administrador', 'uma coluna comum', true, null, true],
    ['um administrador', 'a coluna-marco do contrato assinado', true, 'assinado', false],
    ['um usuário comum', 'uma coluna comum', false, null, false]
  ] as const)('quando %s tenta excluir %s, então a exclusão é %s', (_quem, _coluna, ehAdmin, marco, esperado) => {
    // Quando
    const pode = podeExcluirColuna({ marco }, ehAdmin);
    // Então
    expect(pode).toBe(esperado);
  });

  it.each([
    ['a coluna "Contrato fechado"', 'c2', true],
    ['outra coluna', 'c1', false],
    ['nenhuma coluna', null, false]
  ] as const)('dado um cartão em %s, quando confere o marco "Contrato fechado", então é %s', (_onde, etapa, esperado) => {
    // Dado
    const colunas = [{ id: 'c1', marco: null }, { id: 'c2', marco: 'contrato_fechado' as const }];
    // Quando
    const chegou = colunaComMarco(colunas, etapa, 'contrato_fechado');
    // Então
    expect(chegou).toBe(esperado);
  });

  it('quando o quadro mostra uma coluna-marco, então há um nome e uma explicação para cada marco', () => {
    // Então
    expect(Object.values(MARCOS).every(m => m.rotulo && m.explicacao.includes('não excluída'))).toBe(true);
  });
});

describe('Grupos de colunas', () => {
  const grupo = (id: string, ordem: number, comeca_fechado = false) => ({ id, nome: id, ordem, comeca_fechado });
  const coluna = (id: string, ordem: number, grupo_id: string | null = null) => ({ id, ordem, grupo_id });

  it('quando o quadro não tem grupos, então fica um trecho só, com as colunas na ordem de antes', () => {
    // Quando
    const blocos = blocosDoQuadro([coluna('b', 2), coluna('a', 1)], []);
    // Então
    expect(blocos).toEqual([{ grupo: null, colunas: [coluna('a', 1), coluna('b', 2)] }]);
  });

  it('quando há grupos, então vêm primeiro as colunas sem grupo e depois cada grupo, na ordem dele', () => {
    // Dado
    const inicio = grupo('inicio', 1), fim = grupo('fim', 2), vazio = grupo('vazio', 3);
    // Quando
    const blocos = blocosDoQuadro([coluna('c3', 5, 'fim'), coluna('c2', 9, 'inicio'), coluna('c1', 1, 'inicio'), coluna('solta', 7)], [vazio, fim, inicio]);
    // Então
    expect(blocos.map(b => [b.grupo?.id ?? null, b.colunas.map(c => c.id)])).toEqual([
      [null, ['solta']], ['inicio', ['c1', 'c2']], ['fim', ['c3']], ['vazio', []]
    ]);
  });

  it('quando a coluna aponta para um grupo que não existe mais, então ela fica entre as sem grupo', () => {
    // Quando
    const blocos = blocosDoQuadro([coluna('c', 1, 'sumiu')], [grupo('g', 1)]);
    // Então
    expect(blocos[0].colunas.map(c => c.id)).toEqual(['c']);
  });

  it.each([
    ['sem escolha, um grupo comum', false, {}, true],
    ['sem escolha, o grupo que começa fechado', true, {}, false],
    ['a pessoa fechou um grupo comum', false, { g: false }, false],
    ['a pessoa abriu o grupo que começa fechado', true, { g: true }, true]
  ])('quando %s, então o grupo aparece como deve', (_caso, comecaFechado, escolhas, aberto) => {
    // Então
    expect(grupoEstaAberto(grupo('g', 1, comecaFechado), escolhas as Record<string, boolean>)).toBe(aberto);
  });

  describe('Coluna do cartão novo', () => {
    it('quando o quadro não tem grupos nem marco, então é a de menor ordem', () => {
      // Então
      expect(colunaDoCartaoNovo([coluna('b', 2), coluna('a', 1)], [])?.id).toBe('a');
    });

    it('quando há grupos, então é a primeira da tela: as sem grupo vêm antes, mesmo com ordem maior', () => {
      // Dado
      const colunas = [coluna('no-grupo', 1, 'g'), coluna('solta', 9)];
      // Então
      expect(colunaDoCartaoNovo(colunas, [grupo('g', 1)])?.id).toBe('solta');
    });

    it('quando os grupos mudam de lugar, então vale a ordem dos grupos, não a das colunas', () => {
      // Dado
      const colunas = [coluna('em-a', 1, 'a'), coluna('em-b', 2, 'b')];
      // Então
      expect(colunaDoCartaoNovo(colunas, [grupo('a', 2), grupo('b', 1)])?.id).toBe('em-b');
    });

    it('quando o quadro tem coluna-marco de início, então é ela, onde quer que esteja', () => {
      // Dado
      const colunas = [coluna('solta', 1), { ...coluna('para-fazer', 5, 'g'), marco: 'inicio' as const }];
      // Então
      expect(colunaDoCartaoNovo(colunas, [grupo('g', 1)])?.id).toBe('para-fazer');
    });

    it('quando o quadro não tem colunas, então não há coluna', () => {
      // Então
      expect(colunaDoCartaoNovo([], [grupo('g', 1)])).toBeNull();
    });
  });

  it.each([
    [null, 'carregando'], [0, '0 cartões'], [1, '1 cartão'], [2, '2 cartões'], [1200, '1.200 cartões']
  ])('quando o total é %s, então o texto é "%s"', (total, texto) => {
    // Então
    expect(cartoesEmPalavras(total, n => n.toLocaleString('pt-BR'))).toBe(texto);
  });

  it.each([
    [{ ordem: 1 }, { ordem: 2 }, 1.5],
    [{ ordem: 4 }, undefined, 5],
    [undefined, { ordem: 4 }, 3],
    [undefined, undefined, 7]
  ])('quando os vizinhos são %j e %j, então a ordem é %d', (anterior, seguinte, ordem) => {
    // Então
    expect(ordemEntre(anterior, seguinte, 7)).toBe(ordem);
  });
});

describe('Mudar de lugar (colunas de um grupo ou os grupos do quadro)', () => {
  // Dado: três grupos na ordem da tela
  const fila = [{ id: 'a', ordem: 1 }, { id: 'b', ordem: 2 }, { id: 'c', ordem: 3 }];

  it.each([
    ['"c" é solto antes de "a"', 'c', 'a', 0],
    ['"a" é solto no fim', 'a', null, 4],
    ['"a" é solto antes de "c"', 'a', 'c', 2.5],
    ['"c" é solto antes de "b"', 'c', 'b', 1.5]
  ] as const)('quando %s, então a ordem nova é %d', (_caso, id, antesDe, ordem) => {
    // Quando
    const nova = ordemAoPosicionar(fila, id, antesDe);
    // Então
    expect(nova).toBe(ordem);
  });

  it.each([
    ['é solto antes dele mesmo', 'b', 'b'],
    ['é solto antes do vizinho da direita (o lugar onde já está)', 'a', 'b'],
    ['o último é solto no fim', 'c', null],
    ['o grupo não está na fila', 'x', 'a'],
    ['o vizinho não está na fila', 'a', 'x']
  ] as const)('quando o item %s, então nada muda', (_caso, id, antesDe) => {
    // Quando
    const nova = ordemAoPosicionar(fila, id, antesDe);
    // Então
    expect(nova).toBeNull();
  });

  it('quando a ordem nova é aplicada, então a fila fica na ordem pedida', () => {
    // Quando: "c" vai para antes de "a"
    const ordem = ordemAoPosicionar(fila, 'c', 'a')!;
    const depois = fila.map(x => x.id === 'c' ? { ...x, ordem } : x).sort((x, y) => x.ordem - y.ordem);
    // Então
    expect(depois.map(x => x.id)).toEqual(['c', 'a', 'b']);
  });

  it.each([
    ['"b" anda para a esquerda', 'b', -1, 'a'],
    ['"a" anda para a direita', 'a', 1, 'c'],
    ['"b" anda para a direita (vira o último)', 'b', 1, null],
    ['"a" anda para a esquerda (já é o primeiro)', 'a', -1, undefined],
    ['"c" anda para a direita (já é o último)', 'c', 1, undefined]
  ] as const)('quando %s, então fica antes de %s', (_caso, id, passo, antes) => {
    // Quando
    const resultado = antesDeAoAndar(fila, id, passo);
    // Então
    expect(resultado).toBe(antes);
  });
});
