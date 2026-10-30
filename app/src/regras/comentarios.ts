// Comentários dos cartões, com @: achar as menções no texto, mostrar o texto com elas destacadas, a lista do @ enquanto
// se digita e quem pode ser mencionado em cada módulo. O banco acha as menções do mesmo jeito (banco/016_comentarios.sql).
import type { Membro, ModuloComentado } from '../dados/tipos';
import { normal } from './texto';

/** "@usuario" no começo ou depois de espaço ou pontuação: um e-mail como joao@exemplo.com não conta. */
const MENCAO = /(^|[^a-z0-9._-])@([a-z0-9._-]+)/gi;
/** "@termo" logo antes do cursor (o termo pode estar vazio: acabou de digitar o @). */
const MENCAO_NO_CURSOR = /(^|[^a-z0-9._-])@([a-z0-9._-]*)$/i;
/** O @usuario sem o ponto final da frase ("falei com @ana." marca @ana). */
const usuarioDe = (bruto: string) => bruto.toLowerCase().replace(/\.+$/, '');
const ativo = (m: Membro) => m.ativo !== false;

/** Quem está ativo na equipe e foi marcado no texto, sem repetir. */
export function mencoesNoTexto(texto: string, equipe: Membro[]): Membro[] {
  const usuarios = new Set([...texto.matchAll(MENCAO)].map(m => usuarioDe(m[2])));
  return equipe.filter(m => ativo(m) && m.usuario && usuarios.has(m.usuario));
}

export interface Trecho { texto: string; membro?: Membro }
/** O texto em trechos, com cada menção de alguém da equipe num trecho próprio (para destacar na tela). */
export function trechosDoComentario(texto: string, equipe: Membro[]): Trecho[] {
  const trechos: Trecho[] = [];
  let desde = 0;
  for (const m of texto.matchAll(MENCAO)) {
    const usuario = usuarioDe(m[2]), membro = equipe.find(x => x.usuario === usuario);
    if (!membro) continue;
    const inicio = m.index + m[1].length, fim = inicio + 1 + usuario.length;
    if (inicio > desde) trechos.push({ texto: texto.slice(desde, inicio) });
    trechos.push({ texto: texto.slice(inicio, fim), membro });
    desde = fim;
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
  // Nas demandas e nas tarefas, a regra depende do cartão (só quem o vê): o cartão passa a dele à seção de comentários.
  demandas: () => null,
  tarefas: () => null
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

/** O texto com o "@termo" trocado por "@usuario " (sem dobrar o espaço que já houver) e o cursor logo depois. */
export function inserirMencao(texto: string, inicio: number, cursor: number, usuario: string) {
  const resto = texto.slice(cursor), mencao = `@${usuario}` + (resto.startsWith(' ') ? '' : ' ');
  return { texto: texto.slice(0, inicio) + mencao + resto, cursor: inicio + `@${usuario} `.length };
}
