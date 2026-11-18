// A anotação baixada como arquivo Markdown (.md), para usar fora do SEMPER, no Obsidian por exemplo (#345). No topo do arquivo
// vão as propriedades em YAML entre duas linhas "---" (o "frontmatter", como o Obsidian as lê); depois, o título e o texto
// exatamente como foram escritos. Também o nome do arquivo, que o Windows e o Mac aceitem. Regras puras: sem tela, sem banco.
import { TAMANHO_NOME_DO_ARQUIVO } from '../dados/limites';
import type { Anotacao, ItemDaAnotacao } from '../dados/tipos';
import { ITEM_DA_ANOTACAO } from './anotacao';

/** O que a anotação traz para o arquivo. */
export type AnotacaoParaBaixar = Pick<Anotacao, 'codigo' | 'titulo' | 'texto' | 'criado_em' | 'atualizado_em'>;
/** Os itens ligados que a pessoa vê (os que ela não pode abrir não entram no arquivo). */
export type ItemParaBaixar = Pick<ItemDaAnotacao, 'modulo' | 'codigo' | 'nome'>;
/**
 * Os nomes que a tela conhece e a anotação guarda só pelo id: o do responsável, o caminho da pasta (as pastas do primeiro nível
 * até a dela, em ordem; vazio: fora de qualquer pasta) e os nomes das etiquetas (#342).
 */
export interface NomesDaAnotacao { responsavel: string; pasta?: string[]; etiquetas?: string[] }
/** Como o caminho da pasta vai para o arquivo ("Escritório / POPs / Financeiro"). */
export const SEPARADOR_DA_PASTA_NO_ARQUIVO = ' / ';

/** O valor de uma propriedade: um texto ou uma lista de textos. Vazio (texto ou lista), a propriedade fica de fora. */
type ValorDaPropriedade = string | string[];
interface FonteDasPropriedades { anotacao: AnotacaoParaBaixar; itens: ItemParaBaixar[]; nomes: NomesDaAnotacao }

/** A data e hora em ISO 8601, em UTC e sem os milésimos (2026-11-17T14:05:00Z); o que não for data fica como veio. */
function dataISO(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toISOString().replace(/\.\d+Z$/, 'Z');
}

/**
 * As propriedades do topo do arquivo, na ordem em que aparecem. Propriedade nova é uma
 * linha nova nesta tabela, com o dado novo em AnotacaoParaBaixar ou em NomesDaAnotacao.
 */
const PROPRIEDADES: [chave: string, valor: (f: FonteDasPropriedades) => ValorDaPropriedade][] = [
  ['codigo', f => f.anotacao.codigo],
  ['criada', f => dataISO(f.anotacao.criado_em)],
  ['atualizada', f => dataISO(f.anotacao.atualizado_em)],
  ['responsavel', f => f.nomes.responsavel],
  ['pasta', f => (f.nomes.pasta ?? []).join(SEPARADOR_DA_PASTA_NO_ARQUIVO)],
  ['etiquetas', f => f.nomes.etiquetas ?? []],
  ['ligada_a', f => f.itens.map(i => `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo} · ${i.nome}`)]
];

// ---------- o YAML ----------
/**
 * Texto que o YAML lê como texto sem aspas: começa por letra, só tem letras, números, espaço, ponto, hífen e sublinhado, e
 * não termina em espaço (o YAML descartaria o espaço do fim, e o texto lido de volta não seria o mesmo).
 */
const TEXTO_SIMPLES = /^\p{L}(?:[\p{L}\p{N} ._-]*[\p{L}\p{N}._-])?$/u;
/** A data e hora que dataISO escreve: vai sem aspas, para o Obsidian a ler como data. */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
/** Palavras que o YAML leria como sim, não ou nada, e não como texto: vão entre aspas. */
const PALAVRAS_DO_YAML = new Set(['true', 'false', 'yes', 'no', 'y', 'n', 'on', 'off', 'null']);
/** O que não pode ficar como está dentro das aspas: a barra invertida, as aspas, os caracteres de controle e as quebras. */
const PARA_ESCAPAR = /[\\"\p{Cc}\p{Zl}\p{Zp}]/gu;
/** Como cada um deles é escrito dentro das aspas; os outros viram o código \uXXXX. */
const ESCAPES: Record<string, string> = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
/** Quantos dígitos hexadecimais tem o código \uXXXX. */
const DIGITOS_DO_CODIGO = 4;
const escapar = (c: string) => ESCAPES[c] ?? '\\u' + c.charCodeAt(0).toString(16).padStart(DIGITOS_DO_CODIGO, '0');

/** Um valor de texto no YAML: sem aspas quando é simples; senão, entre aspas duplas, com o que for preciso escapado. */
export const textoNoYaml = (s: string) =>
  (TEXTO_SIMPLES.test(s) && !PALAVRAS_DO_YAML.has(s.toLowerCase())) || DATA_ISO.test(s) ? s : `"${s.replace(PARA_ESCAPAR, escapar)}"`;

/** As linhas de uma propriedade: "chave: valor", ou a chave e um item da lista por linha. Sem valor, nenhuma linha. */
function linhasDaPropriedade(chave: string, valor: ValorDaPropriedade): string[] {
  if (Array.isArray(valor)) return valor.length ? [`${chave}:`, ...valor.map(v => `  - ${textoNoYaml(v)}`)] : [];
  return valor ? [`${chave}: ${textoNoYaml(valor)}`] : [];
}

/** O texto numa linha só (o título é uma linha de Markdown: uma quebra o cortaria). */
const umaLinha = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * O arquivo .md da anotação: as propriedades entre as linhas "---", uma linha em branco, "# " e o título, outra linha em
 * branco e o texto exatamente como foi escrito. Os itens ligados são só os que a pessoa vê; os outros ficam de fora.
 */
export function markdownDaAnotacao(anotacao: AnotacaoParaBaixar, itensVisiveis: ItemParaBaixar[], nomes: NomesDaAnotacao) {
  const fonte = { anotacao, itens: itensVisiveis, nomes };
  const propriedades = PROPRIEDADES.flatMap(([chave, valor]) => linhasDaPropriedade(chave, valor(fonte)));
  return ['---', ...propriedades, '---', '', `# ${umaLinha(anotacao.titulo) || anotacao.codigo}`, '', anotacao.texto].join('\n');
}

// ---------- o nome do arquivo ----------
/** O que o Windows ou o Mac não aceitam num nome de arquivo: \ / : * ? " < > | e os caracteres de controle. */
const PROIBIDOS_NO_NOME = /[\\/:*?"<>|\p{Cc}]/gu;
/** Nomes que o Windows reserva para os aparelhos, com ou sem extensão (CON, NUL, COM1, LPT1…). */
const RESERVADOS_DO_WINDOWS = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
/** Pontos e espaços nas pontas: o Windows tira os do fim, e o ponto no começo esconde o arquivo no Mac. */
const PONTAS = /^[\s.]+|[\s.]+$/g;

/** O nome sem o que é proibido, numa linha só, com até TAMANHO_NOME_DO_ARQUIVO caracteres; '' se não sobrar um nome que sirva. */
function nomeQueServe(s: string) {
  const limpo = umaLinha(s.replace(PROIBIDOS_NO_NOME, ' '));
  const cortado = Array.from(limpo).slice(0, TAMANHO_NOME_DO_ARQUIVO).join('').replace(PONTAS, '');
  return RESERVADOS_DO_WINDOWS.test(cortado) ? '' : cortado;
}

/** O nome do arquivo .md da anotação: o título, sem o que o Windows e o Mac recusam; sem título que sirva, o código. */
export const nomeDoArquivo = (titulo: string, codigo: string) => `${nomeQueServe(titulo) || nomeQueServe(codigo)}.md`;
