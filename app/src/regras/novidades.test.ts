// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { haNovidadeNaoVista, marcaDaVersao, montarVersoes, problemasDaNovidade, problemasDasNovidades, TAMANHOS_DA_NOVIDADE, type Novidade } from './novidades';

const novidade = (titulo: string, extra: Partial<Novidade> = {}): Novidade =>
  ({ titulo, texto: `O que mudou em ${titulo}.`, ondeAchar: `Na tela de ${titulo}.`, ...extra });
const SEM_CARIMBO = { versao: '', data: '' };
/** Arquivos como o Vite os entrega: pelo caminho, com o JSON já lido. */
const ARQUIVOS = {
  '../../novidades/v1.9.0/versao.json': { data: '2026-10-31' },
  '../../novidades/v1.9.0/168-aviso.json': novidade('Aviso de versão nova'),
  '../../novidades/v1.10.0/versao.json': { data: '2026-11-01' },
  '../../novidades/v1.10.0/200-cronometro.json': novidade('Cronômetro'),
  '../../novidades/proxima/353-novidades.json': novidade('Novidades'),
  '../../novidades/proxima/40-pastas.json': novidade('Pastas')
};

describe('Lista das versões', () => {
  it('dados arquivos de três versões, quando monta a lista fora da publicação, então vem da mais nova para a mais antiga, com a próxima sem número', () => {
    // Quando
    const versoes = montarVersoes(ARQUIVOS, SEM_CARIMBO);
    // Então: v1.10.0 vem depois de v1.9.0 (pelo número, não pelo texto)
    expect(versoes.map(v => [v.versao, v.data])).toEqual([[null, null], ['v1.10.0', '2026-11-01'], ['v1.9.0', '2026-10-31']]);
  });

  it('dadas duas novidades na mesma versão, quando monta a lista, então ficam na ordem do número da tarefa (40 antes de 353)', () => {
    // Quando
    const [proxima] = montarVersoes(ARQUIVOS, SEM_CARIMBO);
    // Então
    expect(proxima.novidades.map(n => n.titulo)).toEqual(['Pastas', 'Novidades']);
  });

  it('dado o site publicado na v1.11.0, quando monta a lista, então a próxima versão leva o número e a data da publicação', () => {
    // Quando
    const [maisNova] = montarVersoes(ARQUIVOS, { versao: 'v1.11.0', data: '2026-11-18' });
    // Então
    expect(maisNova).toMatchObject({ versao: 'v1.11.0', data: '2026-11-18' });
    expect(maisNova.novidades).toHaveLength(2);
  });

  it('dada uma versão só com a data (sem novidade) e um arquivo errado, quando monta a lista, então os dois ficam de fora', () => {
    // Dado
    const arquivos = {
      '../../novidades/v1.12.0/versao.json': { data: '2026-11-02' },
      '../../novidades/v1.13.0/versao.json': { data: '2026-11-03' },
      '../../novidades/v1.13.0/10-sem-texto.json': { titulo: 'Sem texto', ondeAchar: 'Em lugar nenhum.' }
    };
    // Quando
    const versoes = montarVersoes(arquivos, SEM_CARIMBO);
    // Então
    expect(versoes).toEqual([]);
  });

  it('dadas duas novidades da mesma versão com o mesmo título, quando monta a lista, então cada uma leva a pasta e o arquivo de onde veio, que não se repetem', () => {
    // Dado
    const arquivos = {
      '../../novidades/v1.12.0/versao.json': { data: '2026-11-02' },
      '../../novidades/v1.12.0/10-ajustes.json': novidade('Ajustes no cartão'),
      '../../novidades/v1.12.0/11-ajustes.json': novidade('Ajustes no cartão')
    };
    // Quando
    const [versao] = montarVersoes(arquivos, SEM_CARIMBO);
    // Então
    expect(versao.novidades.map(n => n.arquivo)).toEqual(['v1.12.0/10-ajustes.json', 'v1.12.0/11-ajustes.json']);
  });

  it('dado o site publicado numa versão que já tem pasta, quando monta a lista, então as novidades se juntam numa versão só', () => {
    // Quando
    const versoes = montarVersoes(ARQUIVOS, { versao: 'v1.10.0', data: '2026-11-01' });
    // Então
    expect(versoes.map(v => v.versao)).toEqual(['v1.10.0', 'v1.9.0']);
    expect(versoes[0].novidades.map(n => n.titulo)).toEqual(['Pastas', 'Cronômetro', 'Novidades']);
  });
});

describe('Arquivos de novidades', () => {
  it('dados arquivos certos, quando confere, então não há problema', () => {
    // Quando / Então
    expect(problemasDasNovidades(ARQUIVOS)).toEqual([]);
  });

  it.each([
    ['uma pasta que não é versão', { '../../novidades/v1.9/versao.json': { data: '2026-10-31' } }, 'v1.9/versao.json: a pasta precisa ser'],
    ['uma versão sem data', { '../../novidades/v1.9.0/1-x.json': novidade('X') }, 'v1.9.0: falta o versao.json'],
    ['uma data que não existe', { '../../novidades/v1.9.0/versao.json': { data: '2026-02-30' } }, 'v1.9.0/versao.json: precisa ser'],
    ['uma data na próxima versão', { '../../novidades/proxima/versao.json': { data: '2026-10-31' } }, 'proxima/versao.json: a próxima versão não tem data'],
    ['um nome com espaço', { '../../novidades/proxima/353 novidades.json': novidade('X') }, 'proxima/353 novidades.json: o nome precisa ser'],
    ['um nome sem o número da tarefa', { '../../novidades/proxima/novidades.json': novidade('X') }, 'proxima/novidades.json: o nome precisa ser']
  ])('dada %s, quando confere, então aponta o problema', (_caso, arquivos, problema) => {
    // Quando
    const problemas = problemasDasNovidades(arquivos);
    // Então
    expect(problemas.join('\n')).toContain(problema);
  });
});

describe('Uma novidade', () => {
  it.each([
    ['sem o onde achar', { titulo: 'X', texto: 'Y' }, 'ondeAchar está faltando'],
    ['com o título em branco', { titulo: '  ', texto: 'Y', ondeAchar: 'Z' }, 'titulo está faltando'],
    ['com o texto longo demais', { titulo: 'X', texto: 'a'.repeat(TAMANHOS_DA_NOVIDADE.texto + 1), ondeAchar: 'Z' }, `texto passa de ${TAMANHOS_DA_NOVIDADE.texto} letras`],
    ['com uma parte de nome errado', { titulo: 'X', texto: 'Y', onde_achar: 'Z' }, '"onde_achar" não é uma parte de novidade'],
    ['com um link sem https', { ...novidade('X'), link: { rotulo: 'Artigo', endereco: 'http://exemplo.com' } }, 'link o endereço precisa começar com https://'],
    ['que não é um objeto', ['X'], 'não é um objeto JSON { "titulo", "texto", "ondeAchar" }']
  ])('dada uma novidade %s, quando confere, então aponta o problema', (_caso, conteudo, problema) => {
    // Quando
    const problemas = problemasDaNovidade(conteudo);
    // Então
    expect(problemas).toContain(problema);
  });

  it('dada uma novidade com um link https, quando confere, então está certa', () => {
    // Quando / Então
    expect(problemasDaNovidade(novidade('X', { link: { rotulo: 'Como funciona', endereco: 'https://semper.app.br/ajuda' } }))).toEqual([]);
  });
});

describe('Ponto de novidade não vista', () => {
  const publicadas = montarVersoes(ARQUIVOS, { versao: 'v1.11.0', data: '2026-11-18' });
  const foraDaPublicacao = montarVersoes(ARQUIVOS, SEM_CARIMBO);

  it.each([
    ['nunca abriu as novidades', null, true],
    ['viu a v1.10.0', 'v1.10.0', true],
    ['viu a v1.11.0', 'v1.11.0', false],
    ['viu a v1.12.0 (o site voltou para uma versão anterior)', 'v1.12.0', false],
    ['guardou algo que não é versão', 42, true]
  ])('dado o site na v1.11.0 e alguém que %s, quando confere, então o ponto aparece: %s', (_caso, vista, esperado) => {
    // Quando / Então
    expect(haNovidadeNaoVista(publicadas, vista)).toBe(esperado);
  });

  it('dada a próxima versão sem número (npm run teste), quando a pessoa já a viu, então o ponto não aparece', () => {
    // Dado
    const vista = marcaDaVersao(foraDaPublicacao[0]);
    // Quando / Então
    expect(vista).toBe('proxima');
    expect(haNovidadeNaoVista(foraDaPublicacao, vista)).toBe(false);
    expect(haNovidadeNaoVista(foraDaPublicacao, 'v1.10.0')).toBe(true);
  });

  it('dada uma lista sem nenhuma versão, quando confere, então não há ponto', () => {
    // Quando / Então
    expect(haNovidadeNaoVista([], null)).toBe(false);
  });
});
