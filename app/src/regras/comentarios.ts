// Comentários dos cartões: as menções de pessoas da equipe, com @ (achar no texto, a lista do @ enquanto se digita e quem pode ser
// mencionado em cada módulo), e as de itens, com ! seguido do código (#297: "!D3A1F09C" chama a demanda D3A1F09C). O texto aparece com
// as duas em destaque. O banco acha as menções de pessoas do mesmo jeito (supabase/migrations/20261027000016_comentarios.sql); as de
// itens não vão ao banco: quem lê o comentário consulta os itens pelas regras de leitura de cada módulo e só vê o título do que já vê.
import type { ItemDaAnotacao, Membro, ModuloComentado, ModuloMencionavel } from '../dados/tipos';
import { ITEM_DA_ANOTACAO } from './anotacao';
import { MODULOS_DA_BUSCA } from './buscaGeral';
import { normal } from './texto';

/** "@usuario" no começo ou depois de espaço ou pontuação: um e-mail como joao@exemplo.com não conta. */
const MENCAO = /(^|[^a-z0-9._-])@([a-z0-9._-]+)/gi;
/** "@termo" logo antes do cursor (o termo pode estar vazio: acabou de digitar o @). */
const MENCAO_NO_CURSOR = /(^|[^a-z0-9._-])@([a-z0-9._-]*)$/i;
/** O @usuario sem o ponto final da frase ("falei com @ana." marca @ana). */
const usuarioDe = (bruto: string) => bruto.toLowerCase().replace(/\.+$/, '');
const ativo = (m: Membro) => m.ativo !== false;

/**
 * "!CODIGO": o ! no começo ou depois de espaço ou pontuação, seguido do código de um item (8 letras de A a F e algarismos, como
 * D3A1F09C) ou do número de um contrato (HE62-0163-2026), os mesmos formatos da busca geral (regras/buscaGeral.ts). O ! do fim
 * de uma frase ("Urgente!") vem depois de uma letra e não conta; seguido de espaço, também não.
 */
const ITEM_NO_TEXTO = /(?<![\p{L}\p{N}_])!([0-9A-F]{8}|[A-Z]{2}\d{2}-\d{4,}-\d{4})(?![\p{L}\p{N}_-])/giu;
/** "!termo" logo antes do cursor: o termo é o começo do código ou uma palavra do título (sem espaço). */
const MENCAO_DE_ITEM_NO_CURSOR = /(?<![\p{L}\p{N}_])!([\p{L}\p{N}-]*)$/u;
/** O código como o banco o guarda: em maiúsculas. */
const codigoDe = (bruto: string) => bruto.toUpperCase();

/** Quem está ativo na equipe e foi marcado no texto, sem repetir. */
export function mencoesNoTexto(texto: string, equipe: Membro[]): Membro[] {
  const usuarios = new Set([...texto.matchAll(MENCAO)].map(m => usuarioDe(m[2])));
  return equipe.filter(m => ativo(m) && m.usuario && usuarios.has(m.usuario));
}

/** Os códigos dos itens chamados com ! nos textos, em maiúsculas, sem repetir e em ordem (os mesmos textos dão a mesma consulta). */
export const codigosNoTexto = (...textos: string[]) =>
  [...new Set(textos.flatMap(t => [...t.matchAll(ITEM_NO_TEXTO)].map(m => codigoDe(m[1]))))].sort();

/** Um pedaço do texto: o texto comum, a menção de alguém da equipe (membro) ou a de um item (codigo, em maiúsculas). */
export interface Trecho { texto: string; membro?: Membro; codigo?: string }
type Achado = Trecho & { inicio: number };
/** Cada tipo de menção, achado no texto: a de alguém da equipe (só quem é dela) e a de um item (todo código; quem lê vê se abre). */
const ACHAR_MENCOES: ((texto: string, equipe: Membro[]) => Achado[])[] = [
  (texto, equipe) => [...texto.matchAll(MENCAO)].flatMap(m => {
    const usuario = usuarioDe(m[2]), membro = equipe.find(x => x.usuario === usuario);
    const inicio = m.index + m[1].length;
    return membro ? [{ inicio, texto: texto.slice(inicio, inicio + 1 + usuario.length), membro }] : [];
  }),
  texto => [...texto.matchAll(ITEM_NO_TEXTO)].map(m => ({ inicio: m.index, texto: m[0], codigo: codigoDe(m[1]) }))
];
/** O tipo de cada trecho: texto comum, menção de alguém da equipe ou de um item. */
export type TipoDoTrecho = 'texto' | 'pessoa' | 'item';
export const tipoDoTrecho = (t: Trecho): TipoDoTrecho => t.membro ? 'pessoa' : t.codigo ? 'item' : 'texto';
/** O texto em trechos, com cada menção (de alguém da equipe ou de um item) num trecho próprio, para destacar na tela. */
export function trechosDoComentario(texto: string, equipe: Membro[]): Trecho[] {
  const achados = ACHAR_MENCOES.flatMap(achar => achar(texto, equipe)).sort((a, b) => a.inicio - b.inicio);
  const trechos: Trecho[] = [];
  let desde = 0;
  for (const { inicio, ...mencao } of achados) {
    if (inicio < desde) continue;
    if (inicio > desde) trechos.push({ texto: texto.slice(desde, inicio) });
    trechos.push(mencao);
    desde = inicio + mencao.texto.length;
  }
  if (desde < texto.length) trechos.push({ texto: texto.slice(desde) });
  return trechos;
}

/**
 * Por que o membro não pode ser mencionado nos cartões do módulo (null se pode). Os contratos servem ao controle
 * financeiro: neles, só advogados são mencionados.
 */
export const MOTIVO_SEM_MENCAO: Record<ModuloComentado, (m: Membro) => string | null> = {
  pessoas: () => null,
  contratos: m => (m.funcao ?? 'advogado') === 'advogado' ? null : 'em contratos, só advogados',
  // Nas demandas, nas tarefas, nos compromissos, nas anotações e nos processos, a regra depende do cartão (só quem o vê): o cartão passa a dele à
  // seção de comentários.
  demandas: () => null,
  tarefas: () => null,
  compromissos: () => null,
  anotacoes: () => null,
  processos: () => null
};
/** A mensagem de quando alguém que não pode ser mencionado aparece num comentário de contrato (a mesma do banco). */
export const mencaoNegada = (nome: string) => `Não é possível mencionar ${nome} em contratos: só advogados podem ser mencionados.`;

/** Se o cursor está logo depois de "@termo": onde o @ começa e o termo (para mostrar a lista do @). */
export function mencaoSendoDigitada(texto: string, cursor: number): { inicio: number; termo: string } | null {
  const m = MENCAO_NO_CURSOR.exec(texto.slice(0, cursor));
  return m ? { inicio: cursor - m[2].length - 1, termo: m[2] } : null;
}

/** Quem da equipe ativa combina com o termo, pelo @usuario ou pelo nome, sem acento. */
export function membrosParaMencionar(equipe: Membro[], termo: string, limite: number): Membro[] {
  const t = normal(termo);
  return equipe.filter(m => ativo(m) && m.usuario && (m.usuario.includes(t) || normal(m.nome).includes(t))).slice(0, limite);
}

/** O sinal que chama cada tipo de menção: @ para alguém da equipe, ! para um item. */
export type SinalDaMencao = '@' | '!';
/** O texto com o "@termo" (ou "!termo") trocado por "@usuario " (ou "!CODIGO "), sem dobrar o espaço que já houver, e o cursor logo depois. */
export function inserirMencao(texto: string, inicio: number, cursor: number, nome: string, sinal: SinalDaMencao = '@') {
  const resto = texto.slice(cursor), mencao = sinal + nome + (resto.startsWith(' ') ? '' : ' ');
  return { texto: texto.slice(0, inicio) + mencao + resto, cursor: inicio + `${sinal}${nome} `.length };
}

// ---------- menções de itens, com ! (#297) ----------
/** Os módulos cujos itens se chamam com !, na ordem da lista de sugestões. */
export const MODULOS_MENCIONAVEIS: readonly ModuloMencionavel[] = ['tarefas', 'demandas', 'contratos', 'processos', 'pessoas'];
/** Os módulos mencionáveis que o escritório tem ligados (as pessoas existem em todos). */
export const modulosParaMencionar = (modulosDoEscritorio: Record<string, boolean> | undefined) =>
  MODULOS_MENCIONAVEIS.filter(m => MODULOS_DA_BUSCA[m].ligado(modulosDoEscritorio));

/**
 * Se o cursor está logo depois de "!termo": onde o ! começa e o termo (para mostrar a lista de itens). O ! sozinho, o do fim de
 * uma frase ("Urgente!") e o seguido de espaço não dão nada.
 */
export function itemSendoDigitado(texto: string, cursor: number): { inicio: number; termo: string } | null {
  const m = MENCAO_DE_ITEM_NO_CURSOR.exec(texto.slice(0, cursor));
  return m?.[1] ? { inicio: cursor - m[1].length - 1, termo: m[1] } : null;
}

/** Quão perto o código do item está do termo: 0, igual; 1, começa com ele; 2, achado pelo título ou por outro dado. */
const pertoDoCodigo = (codigo: string, termo: string) => {
  const c = normal(codigo);
  return c === termo ? 0 : c.startsWith(termo) ? 1 : 2;
};
/**
 * Os itens achados para o "!termo", sem repetir: primeiro o de código igual ao termo, depois os de código que começa com ele, depois
 * os outros (achados pelo título), cada grupo na ordem em que veio. Até o limite.
 */
export function ordenarItensParaMencionar(itens: readonly ItemDaAnotacao[], termo: string, limite: number): ItemDaAnotacao[] {
  const t = normal(termo);
  const unicos = itens.filter((i, n) => itens.findIndex(x => x.modulo === i.modulo && x.id === i.id) === n);
  return unicos.map((item, n) => ({ item, n, p: pertoDoCodigo(item.codigo, t) })).sort((a, b) => a.p - b.p || a.n - b.n)
    .slice(0, limite).map(x => x.item);
}

/** "Demanda D3A1F09C: Registro de marca". */
export const nomeDoItemMencionado = (i: ItemDaAnotacao) => `${ITEM_DA_ANOTACAO[i.modulo].rotulo} ${i.codigo}: ${i.nome}`;
/** Cada código consultado (em maiúsculas) com o item que veio da consulta, ou null se não veio (quem lê não o vê, ou ele não existe mais). */
export const itensPeloCodigo = (codigos: readonly string[], itens: readonly ItemDaAnotacao[]) =>
  new Map<string, ItemDaAnotacao | null>(codigos.map(c => [codigoDe(c), itens.find(i => codigoDe(i.codigo) === codigoDe(c)) ?? null]));

/** Como o item chamado com ! aparece para quem lê o comentário. */
export type SituacaoDaMencaoDeItem = 'semConsulta' | 'aberto' | 'arquivado' | 'indisponivel';
/**
 * A situação do item: sem a consulta (ainda, ou fora dos comentários, como na caixa de Mensagens), "semConsulta"; não veio na consulta (quem lê não o vê, ou ele foi excluído: a tela não
 * diz qual dos dois, para não revelar que o item existe), "indisponivel"; senão, "arquivado" ou "aberto".
 */
export function situacaoDaMencaoDeItem(consultados: ReadonlyMap<string, ItemDaAnotacao | null> | undefined, codigo: string): SituacaoDaMencaoDeItem {
  if (!consultados?.has(codigoDe(codigo))) return 'semConsulta';
  const item = consultados.get(codigoDe(codigo));
  if (!item) return 'indisponivel';
  return item.arquivado_em ? 'arquivado' : 'aberto';
}
/**
 * O que cada situação mostra: se a menção abre o cartão, o aviso que vem depois do código e a explicação (para o leitor de tela e
 * ao passar o mouse). O título do item só aparece para quem o vê.
 */
export const MOSTRAR_ITEM_MENCIONADO: Record<SituacaoDaMencaoDeItem, { abre: boolean; aviso: string | null; explicacao: (i: ItemDaAnotacao | undefined) => string }> = {
  semConsulta: { abre: false, aviso: null, explicacao: () => 'Item mencionado' },
  aberto: { abre: true, aviso: null, explicacao: i => `Abrir ${i ? nomeDoItemMencionado(i) : 'o item'}` },
  arquivado: { abre: true, aviso: 'arquivado', explicacao: i => `Abrir ${i ? nomeDoItemMencionado(i) : 'o item'}, que está arquivado` },
  indisponivel: { abre: false, aviso: 'sem acesso ou excluído', explicacao: () => 'Você não tem acesso a este item, ou ele não existe mais' }
};
