// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { TAMANHO_NOME_DO_ARQUIVO } from '../dados/limites';
import { markdownDaAnotacao, nomeDoArquivo, textoNoYaml, type AnotacaoParaBaixar, type ItemParaBaixar } from './anotacaoEmMarkdown';

const anotacao = (campos: Partial<AnotacaoParaBaixar> = {}): AnotacaoParaBaixar => ({
  codigo: 'ANT1', titulo: 'Estratégia do recurso', texto: 'Primeiro parágrafo.\n\n- [ ] Ver o prazo',
  criado_em: '2026-11-17T14:05:09.123+00:00', atualizado_em: '2026-11-18T09:00:00.000Z', ...campos
});
const NOMES = { responsavel: 'Ana Exemplo' };
const PROCESSO: ItemParaBaixar = { modulo: 'processos', codigo: 'PRC1', nome: '0001234-56.2026.8.26.0100' };
const DEMANDA: ItemParaBaixar = { modulo: 'demandas', codigo: 'DEM7', nome: 'Registro de marca' };
/** As linhas do cabeçalho de propriedades (entre as duas linhas "---" do começo). */
const cabecalho = (md: string) => {
  const linhas = md.split('\n');
  expect(linhas[0]).toBe('---');
  return linhas.slice(1, linhas.indexOf('---', 1));
};
/** O valor entre aspas do YAML, lido de volta (as aspas duplas do YAML escapam como as do JSON). */
const lerValor = (valor: string) => valor.startsWith('"') ? JSON.parse(valor) as string : valor;

describe('A anotação em Markdown', () => {
  it('quando a anotação é baixada, então o topo traz código, datas, responsável e itens ligados, e depois vêm o título e o texto como foram escritos', () => {
    // Quando
    const md = markdownDaAnotacao(anotacao(), [PROCESSO, DEMANDA], NOMES);
    // Então
    expect(md).toBe([
      '---',
      'codigo: ANT1',
      'criada: 2026-11-17T14:05:09Z',
      'atualizada: 2026-11-18T09:00:00Z',
      'responsavel: Ana Exemplo',
      'ligada_a:',
      '  - "Processo · PRC1 · 0001234-56.2026.8.26.0100"',
      '  - "Demanda · DEM7 · Registro de marca"',
      '---',
      '',
      '# Estratégia do recurso',
      '',
      'Primeiro parágrafo.\n\n- [ ] Ver o prazo'
    ].join('\n'));
  });

  it('dada uma anotação com pasta e etiquetas, quando é baixada, então o topo traz o caminho da pasta e as etiquetas como lista (#342)', () => {
    // Dado
    const nomes = { ...NOMES, pasta: ['Escritório', 'POPs', 'Financeiro'], etiquetas: ['POP', 'Reunião: semanal'] };
    // Quando
    const md = markdownDaAnotacao(anotacao(), [DEMANDA], nomes);
    // Então
    expect(cabecalho(md)).toEqual([
      'codigo: ANT1',
      'criada: 2026-11-17T14:05:09Z',
      'atualizada: 2026-11-18T09:00:00Z',
      'responsavel: Ana Exemplo',
      'pasta: "Escritório / POPs / Financeiro"',
      'etiquetas:',
      '  - POP',
      '  - "Reunião: semanal"',
      'ligada_a:',
      '  - "Demanda · DEM7 · Registro de marca"'
    ]);
    expect(lerValor('"Escritório / POPs / Financeiro"')).toBe('Escritório / POPs / Financeiro');
  });

  it('dada uma anotação fora de qualquer pasta e sem etiquetas, quando é baixada, então "pasta" e "etiquetas" ficam de fora', () => {
    // Quando
    const md = markdownDaAnotacao(anotacao(), [], { ...NOMES, pasta: [], etiquetas: [] });
    // Então
    expect(cabecalho(md).map(l => l.split(':')[0])).toEqual(['codigo', 'criada', 'atualizada', 'responsavel']);
  });

  it('quando não há item ligado visível, então a propriedade "ligada_a" fica de fora, em vez de vazia', () => {
    // Quando
    const md = markdownDaAnotacao(anotacao(), [], NOMES);
    // Então
    expect(cabecalho(md).map(l => l.split(':')[0])).toEqual(['codigo', 'criada', 'atualizada', 'responsavel']);
  });

  it('quando o texto tem uma linha "---" no meio, então o cabeçalho continua fechando no lugar certo e o texto sai inteiro', () => {
    // Dado
    const texto = 'Antes\n---\nresponsavel: outra pessoa\n---\nDepois';
    // Quando
    const md = markdownDaAnotacao(anotacao({ texto }), [], NOMES);
    // Então
    expect(cabecalho(md)).toHaveLength(4);
    expect(md.endsWith('\n\n' + texto)).toBe(true);
  });

  it('quando o texto começa com espaços e termina com quebras, então ele vai ao arquivo sem nenhuma mudança', () => {
    // Dado
    const texto = '   recuado\n\n\n';
    // Quando
    const md = markdownDaAnotacao(anotacao({ texto }), [], NOMES);
    // Então
    expect(md.endsWith('# Estratégia do recurso\n\n' + texto)).toBe(true);
  });

  it('quando o título tem quebra de linha, então o título do arquivo fica numa linha só', () => {
    // Quando
    const md = markdownDaAnotacao(anotacao({ titulo: 'Reunião:\n"cliente"' }), [], NOMES);
    // Então
    expect(md).toContain('\n# Reunião: "cliente"\n');
  });

  it('quando nomes têm aspas, dois-pontos, cerquilha e quebra de linha, então vão entre aspas e o YAML lê de volta o mesmo texto', () => {
    // Dado
    const responsavel = 'Ana "Aninha": sócia # chefe';
    const nome = 'Contrato: "honorários"\nlinha 2\\fim';
    // Quando
    const linhas = cabecalho(markdownDaAnotacao(anotacao(), [{ modulo: 'contratos', codigo: 'CT3', nome }], { responsavel }));
    // Então: cada propriedade continua numa linha só, e o valor lido é o original
    expect(linhas).toHaveLength(6);
    expect(lerValor(linhas[3].slice('responsavel: '.length))).toBe(responsavel);
    expect(lerValor(linhas[5].slice('  - '.length))).toBe(`Contrato · CT3 · ${nome}`);
  });
});

describe('Um valor de texto no YAML', () => {
  it.each([
    ['Ana Exemplo', 'Ana Exemplo'],
    ['ANT1', 'ANT1'],
    ['2026-11-17T14:05:09Z', '2026-11-17T14:05:09Z'],
    ['sim: não', '"sim: não"'],
    ['- item', '"- item"'],
    ['123', '"123"'],
    ['yes', '"yes"'],
    ['Null', '"Null"'],
    ['', '""'],
    [' espaço na ponta', '" espaço na ponta"'],
    ['espaço no fim ', '"espaço no fim "'],
    ['A', 'A'],
    ['tab\there', '"tab\\there"'],
    ['sino\u0007', '"sino\\u0007"'],
    ['quebra\u2028unicode', '"quebra\\u2028unicode"']
  ])('quando o texto é %j, então vai como %s', (texto, esperado) => {
    // Quando
    const valor = textoNoYaml(texto);
    // Então
    expect(valor).toBe(esperado);
    expect(lerValor(valor)).toBe(texto);
  });
});

describe('O nome do arquivo da anotação', () => {
  it.each([
    ['Estratégia do recurso', 'Estratégia do recurso.md'],
    ['Reunião: "cliente" 3/4', 'Reunião cliente 3 4.md'],
    ['Primeira linha\nsegunda', 'Primeira linha segunda.md'],
    ['a\\b*c?d<e>f|g', 'a b c d e f g.md'],
    ['  .oculto.  ', 'oculto.md'],
    ['Ata...', 'Ata.md'],
    ['controle\u0000aqui', 'controle aqui.md']
  ])('quando o título é %j, então o arquivo se chama %j', (titulo, esperado) => {
    // Quando
    const nome = nomeDoArquivo(titulo, 'ANT1');
    // Então
    expect(nome).toBe(esperado);
  });

  it.each([[''], ['   '], ['???'], ['CON'], ['nul.txt']])('quando o título é %j, então o arquivo leva o código da anotação', titulo => {
    // Quando
    const nome = nomeDoArquivo(titulo, 'ANT1');
    // Então
    expect(nome).toBe('ANT1.md');
  });

  it('quando o título é longo, então o nome é cortado no tamanho máximo, sem partir um emoji nem terminar em espaço', () => {
    // Dado
    const titulo = 'a'.repeat(TAMANHO_NOME_DO_ARQUIVO - 1) + ' resto que não cabe';
    // Quando
    const nome = nomeDoArquivo(titulo, 'ANT1');
    // Então
    expect(nome).toBe('a'.repeat(TAMANHO_NOME_DO_ARQUIVO - 1) + '.md');
    // E um emoji que cabe inteiro fica inteiro
    expect(nomeDoArquivo('a'.repeat(TAMANHO_NOME_DO_ARQUIVO - 1) + '😀 x', 'ANT1')).toBe('a'.repeat(TAMANHO_NOME_DO_ARQUIVO - 1) + '😀.md');
  });
});
