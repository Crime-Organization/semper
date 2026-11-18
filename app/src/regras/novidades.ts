// Novidades de cada versão do SEMPER (#353): o que mudou para quem usa, em português simples, e onde achar.
//
// Cada novidade é um arquivo JSON em app/novidades/<pasta>/, escrito junto com a mudança (um arquivo por mudança, para
// duas mudanças feitas ao mesmo tempo não brigarem pelo mesmo arquivo). Quem escreve ainda não sabe o número da versão,
// então a novidade nasce na pasta "proxima". O site publicado mostra a "proxima" com o número e a data da publicação
// (embutidos ao compilar), e a rotina "Publicar o SEMPER" depois passa esses arquivos para a pasta da versão
// (ex.: app/novidades/v1.30.0/, com a data em versao.json), para a versão seguinte não mostrá-los como dela.
//
// Aqui ficam as regras, sem tela: conferir os arquivos, montar a lista das versões (da mais nova para a mais antiga) e
// saber se há novidade que a pessoa ainda não viu.
import { compararVersoes, versaoValida } from './versao';

/** A pasta das novidades da versão que ainda não saiu. */
export const PASTA_DA_PROXIMA = 'proxima';
/** Em cada pasta de versão, o arquivo com a data em que ela saiu ({ "data": "2026-11-18" }). */
export const ARQUIVO_DA_VERSAO = 'versao.json';
/** O tamanho máximo de cada parte de uma novidade: ela é curta, para ler de passagem. */
export const TAMANHOS_DA_NOVIDADE = { titulo: 80, texto: 400, ondeAchar: 200, rotuloDoLink: 80 } as const;
/** O nome do arquivo de uma novidade: o número da tarefa e algumas palavras, sem espaços nem acentos (ex.: 353-novidades.json). */
const NOME_DA_NOVIDADE = /^\d+-[a-z0-9-]+\.json$/;
const FORMATO_DA_DATA = /^\d{4}-\d{2}-\d{2}$/;

export interface Novidade {
  /** O nome da novidade, em poucas palavras (ex.: "Pastas nos Documentos"). */
  titulo: string;
  /** O que mudou, para quem usa, em uma ou duas frases. */
  texto: string;
  /** Onde achar: a tela e o botão (ex.: "Em Documentos, no botão “Nova pasta”."). */
  ondeAchar: string;
  /** Um artigo ou vídeo que explica mais (opcional). */
  link?: { rotulo: string; endereco: string };
}
/** Uma novidade na lista de uma versão, com o nome do arquivo de onde veio. */
export interface NovidadeDaVersao extends Novidade {
  /** A pasta e o nome do arquivo (ex.: "proxima/353-novidades.json"): únicos na lista, mesmo que dois títulos sejam iguais. */
  arquivo: string;
}
export interface VersaoComNovidades {
  /** O número (v1.30.0); null para a próxima versão, ainda sem número (só fora do site publicado). */
  versao: string | null;
  /** A data em que saiu (aaaa-mm-dd); null quando ainda não saiu. */
  data: string | null;
  novidades: NovidadeDaVersao[];
}
/** O número e a data da versão que está sendo compilada (vazios fora da publicação: npm run teste, npm run dev, testes). */
export interface Carimbo { versao: string; data: string }

/** Os arquivos lidos, pelo caminho (ex.: "../../novidades/proxima/353-novidades.json") e com o conteúdo já lido do JSON. */
export type ArquivosDeNovidades = Record<string, unknown>;

/** A pasta e o nome de um arquivo, a partir do caminho (só os dois últimos pedaços contam). */
function pastaEArquivo(caminho: string) {
  const pedacos = caminho.split(/[\\/]/);
  return { pasta: pedacos.at(-2) ?? '', arquivo: pedacos.at(-1) ?? '' };
}

/** Uma pasta de novidades: a da próxima versão ou a de uma versão (v1.30.0). */
const pastaValida = (pasta: string): boolean => pasta === PASTA_DA_PROXIMA || versaoValida(pasta);

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Uma data aaaa-mm-dd que existe no calendário (30/02 não). */
export function dataValida(data: unknown): data is string {
  if (!ehTexto(data) || !FORMATO_DA_DATA.test(data)) return false;
  const [a, m, d] = data.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  return dia.getUTCFullYear() === a && dia.getUTCMonth() === m - 1 && dia.getUTCDate() === d;
}

/** Um texto obrigatório de até "maximo" letras: o problema, ou null se está certo. */
const textoObrigatorio = (maximo: number) => (v: unknown) =>
  !ehTexto(v) || !v.trim() ? 'está faltando' : v.length > maximo ? `passa de ${maximo} letras` : null;

/** O link, se houver: um rótulo e um endereço https. */
function problemaDoLink(v: unknown) {
  if (v === undefined) return null;
  if (!ehObjeto(v)) return 'precisa ter "rotulo" e "endereco"';
  const rotulo = textoObrigatorio(TAMANHOS_DA_NOVIDADE.rotuloDoLink)(v.rotulo);
  if (rotulo) return `rotulo ${rotulo}`;
  return ehTexto(v.endereco) && /^https:\/\/\S+$/.test(v.endereco) ? null : 'o endereço precisa começar com https://';
}

/** Cada parte de uma novidade e como conferir. Parte nova = uma entrada nova aqui (e no tipo Novidade). */
const PARTES: Record<keyof Novidade, (v: unknown) => string | null> = {
  titulo: textoObrigatorio(TAMANHOS_DA_NOVIDADE.titulo),
  texto: textoObrigatorio(TAMANHOS_DA_NOVIDADE.texto),
  ondeAchar: textoObrigatorio(TAMANHOS_DA_NOVIDADE.ondeAchar),
  link: problemaDoLink
};

/** O que está errado numa novidade (vazio se está certa). Uma parte com outro nome (ex.: "onde_achar") também é erro. */
export function problemasDaNovidade(conteudo: unknown): string[] {
  if (!ehObjeto(conteudo)) return ['não é um objeto JSON { "titulo", "texto", "ondeAchar" }'];
  const estranhas = Object.keys(conteudo).filter(k => !(k in PARTES)).map(k => `"${k}" não é uma parte de novidade`);
  const erradas = Object.entries(PARTES).flatMap(([parte, conferir]) => {
    const problema = conferir(conteudo[parte]);
    return problema ? [`${parte} ${problema}`] : [];
  });
  return [...estranhas, ...erradas];
}

const ehNovidade = (conteudo: unknown): conteudo is Novidade => problemasDaNovidade(conteudo).length === 0;

/** O que está errado num arquivo, conforme a pasta e o nome dele (vazio se está certo). */
function problemasDoArquivo(pasta: string, arquivo: string, conteudo: unknown): string[] {
  if (arquivo === ARQUIVO_DA_VERSAO) {
    if (pasta === PASTA_DA_PROXIMA) return ['a próxima versão não tem data: ela é posta na publicação'];
    return ehObjeto(conteudo) && dataValida(conteudo.data) ? [] : ['precisa ser { "data": "aaaa-mm-dd" }, com uma data que existe'];
  }
  if (!NOME_DA_NOVIDADE.test(arquivo)) return ['o nome precisa ser o número da tarefa e palavras sem acento, com hífens (ex.: 353-novidades.json)'];
  return problemasDaNovidade(conteudo);
}

/**
 * Tudo o que está errado nos arquivos de novidades, um texto por problema, começando pelo caminho (vazio se estão
 * todos certos). Confere a pasta (só "proxima" ou uma versão, como v1.30.0), a data de cada versão, o nome e o
 * conteúdo de cada novidade.
 */
export function problemasDasNovidades(arquivos: ArquivosDeNovidades): string[] {
  const porPasta = new Map<string, string[]>();
  const problemas = Object.entries(arquivos).flatMap(([caminho, conteudo]) => {
    const { pasta, arquivo } = pastaEArquivo(caminho);
    porPasta.set(pasta, [...porPasta.get(pasta) ?? [], arquivo]);
    if (!pastaValida(pasta)) return [`${pasta}/${arquivo}: a pasta precisa ser "${PASTA_DA_PROXIMA}" ou uma versão (ex.: v1.30.0)`];
    return problemasDoArquivo(pasta, arquivo, conteudo).map(p => `${pasta}/${arquivo}: ${p}`);
  });
  const semData = [...porPasta].filter(([pasta, nomes]) => versaoValida(pasta) && !nomes.includes(ARQUIVO_DA_VERSAO))
    .map(([pasta]) => `${pasta}: falta o ${ARQUIVO_DA_VERSAO}, com a data em que a versão saiu`);
  return [...problemas, ...semData];
}

/** Os nomes de arquivo na ordem em que as novidades aparecem: pelo número da tarefa (2 antes de 10). */
const pelaTarefa = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/**
 * A lista das versões, da mais nova para a mais antiga, cada uma com as suas novidades (na ordem das tarefas). A próxima
 * versão leva o número e a data do carimbo, se houver (o site publicado), e fica sem número fora da publicação. Arquivos
 * com problema e versões sem nenhuma novidade ficam de fora (o teste das novidades não deixa um arquivo errado chegar aqui).
 */
export function montarVersoes(arquivos: ArquivosDeNovidades, carimbo: Carimbo): VersaoComNovidades[] {
  const carimbada = versaoValida(carimbo.versao);
  const versoes = new Map<string | null, VersaoComNovidades>();
  const daVersao = (versao: string | null) => {
    const ja = versoes.get(versao);
    if (ja) return ja;
    const nova: VersaoComNovidades = { versao, data: null, novidades: [] };
    versoes.set(versao, nova);
    return nova;
  };
  const emOrdem = Object.entries(arquivos)
    .map(([caminho, conteudo]) => ({ ...pastaEArquivo(caminho), conteudo }))
    .sort((a, b) => pelaTarefa(a.arquivo, b.arquivo));
  for (const { pasta, arquivo, conteudo } of emOrdem) {
    const ehProxima = pasta === PASTA_DA_PROXIMA;
    if (!pastaValida(pasta)) continue;
    const versao = daVersao(ehProxima ? (carimbada ? carimbo.versao : null) : pasta);
    if (ehProxima && carimbada && dataValida(carimbo.data)) versao.data = carimbo.data;
    if (arquivo === ARQUIVO_DA_VERSAO && !ehProxima && ehObjeto(conteudo) && dataValida(conteudo.data)) versao.data = conteudo.data;
    else if (NOME_DA_NOVIDADE.test(arquivo) && ehNovidade(conteudo)) versao.novidades.push({ ...conteudo, arquivo: `${pasta}/${arquivo}` });
  }
  return [...versoes.values()].filter(v => v.novidades.length > 0).sort((a, b) => {
    if (a.versao === null || b.versao === null) return a.versao === null ? -1 : 1;
    return compararVersoes(b.versao, a.versao);
  });
}

/** O que fica guardado como "a última versão que a pessoa viu": o número, ou "proxima" para a versão ainda sem número. */
export const marcaDaVersao = (v: VersaoComNovidades) => v.versao ?? PASTA_DA_PROXIMA;

/**
 * Se a versão mais nova da lista é mais nova do que a última que a pessoa viu (o ponto no botão Novidades). Quem nunca
 * abriu as novidades (ou guardou algo que não é uma versão) tem novidade; quem voltou para uma versão anterior, não.
 */
export function haNovidadeNaoVista(versoes: VersaoComNovidades[], vista: unknown): boolean {
  const maisNova = versoes[0];
  if (!maisNova) return false;
  const marca = marcaDaVersao(maisNova);
  if (marca === vista) return false;
  if (!versaoValida(marca) || !ehTexto(vista) || !versaoValida(vista)) return true;
  return compararVersoes(marca, vista) > 0;
}
