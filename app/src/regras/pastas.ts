// Pastas dos documentos (#342), como no Obsidian: a árvore montada a partir da lista que o banco devolve, o caminho de uma
// pasta ("Escritório › POPs › Financeiro"), as pastas que ficam dentro de outra (para filtrar a lista pela pasta e pelas
// subpastas) e o que o banco recusa (nome vazio, longo ou repetido entre irmãs; pasta dentro dela mesma). Regras puras: sem
// tela, sem banco. O banco fictício (dados/falso.ts) usa estas funções para se comportar como o de verdade.
import type { Pasta } from '../dados/tipos';
import { TAMANHO_PASTA } from '../dados/limites';
import { normal } from './texto';

/** O que a árvore e o caminho precisam de cada pasta. */
export type PastaDaArvore = Pick<Pasta, 'id' | 'nome' | 'pasta_mae_id'>;
/** Uma pasta na árvore, com as filhas dela (em ordem alfabética). */
export interface NoDaPasta<P extends PastaDaArvore = PastaDaArvore> { pasta: P; filhas: NoDaPasta<P>[]; nivel: number }

/** O separador do caminho na tela e no histórico ("Escritório › POPs"). */
export const SEPARADOR_DO_CAMINHO = ' › ';

const porNome = (a: PastaDaArvore, b: PastaDaArvore) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });

/**
 * A árvore das pastas, a partir da lista plana: no primeiro nível as que não têm mãe (ou cuja mãe não veio), e, dentro de
 * cada uma, as filhas, sempre em ordem alfabética. Uma pasta presa num ciclo (o banco não deixa, mas uma lista errada não
 * pode travar a tela) entra uma vez só, no primeiro nível.
 */
export function arvoreDePastas<P extends PastaDaArvore>(pastas: P[]): NoDaPasta<P>[] {
  const ids = new Set(pastas.map(p => p.id));
  const filhasDe = (id: string | null) => pastas.filter(p => (id === null ? !p.pasta_mae_id || !ids.has(p.pasta_mae_id) : p.pasta_mae_id === id)).sort(porNome);
  const usadas = new Set<string>();
  const montar = (p: P, nivel: number): NoDaPasta<P> => {
    usadas.add(p.id);
    return { pasta: p, nivel, filhas: filhasDe(p.id).filter(f => !usadas.has(f.id)).map(f => montar(f, nivel + 1)) };
  };
  const raiz = filhasDe(null).map(p => montar(p, 0));
  // As presas num ciclo: cada volta entra pela primeira pasta dela, em ordem alfabética.
  for (const p of pastas.filter(x => !usadas.has(x.id)).sort(porNome)) if (!usadas.has(p.id)) raiz.push(montar(p, 0));
  return raiz;
}

/** As pastas da árvore em ordem de leitura (a mãe, depois as filhas), cada uma com o nível dela: para um seletor numa linha só. */
export function pastasEmOrdem<P extends PastaDaArvore>(pastas: P[]): NoDaPasta<P>[] {
  const lista: NoDaPasta<P>[] = [];
  const percorrer = (nos: NoDaPasta<P>[]) => nos.forEach(n => { lista.push(n); percorrer(n.filhas); });
  percorrer(arvoreDePastas(pastas));
  return lista;
}

/** O caminho até a pasta: do primeiro nível até ela mesma. Pasta que não está na lista: caminho vazio. */
export function caminhoDaPasta<P extends PastaDaArvore>(pastas: P[], id: string | null): P[] {
  const caminho: P[] = [];
  const vistas = new Set<string>();
  let atual = id ? pastas.find(p => p.id === id) : undefined;
  while (atual && !vistas.has(atual.id)) {
    vistas.add(atual.id);
    caminho.unshift(atual);
    const mae = atual.pasta_mae_id;
    atual = mae ? pastas.find(p => p.id === mae) : undefined;
  }
  return caminho;
}

/** O caminho escrito ("Escritório › POPs › Financeiro"); sem pasta, ''. */
export const textoDoCaminho = (pastas: PastaDaArvore[], id: string | null, separador = SEPARADOR_DO_CAMINHO) =>
  caminhoDaPasta(pastas, id).map(p => p.nome).join(separador);

/** A pasta e todas as que ficam dentro dela, em qualquer nível (a lista filtrada pela pasta mostra o que está em todas). */
export function pastasDescendentes(pastas: PastaDaArvore[], id: string): string[] {
  const achadas = [id];
  for (let i = 0; i < achadas.length; i++) {
    pastas.forEach(p => { if (p.pasta_mae_id === achadas[i] && !achadas.includes(p.id)) achadas.push(p.id); });
  }
  return achadas;
}

/** O nome como fica guardado: sem espaços sobrando. */
export const nomeDaPasta = (nome: string) => nome.trim().replace(/\s+/g, ' ');

/** A mensagem quando a pasta a apagar ainda tem subpastas ou anotações (o banco recusa). */
export const PASTA_COM_CONTEUDO = 'Esvazie a pasta antes de apagá-la: tire dela as anotações e as subpastas.';
/** A mensagem quando a pasta escolhida (para a anotação, para a subpasta nova ou para mover outra) já não existe: um colega a apagou. */
export const PASTA_SUMIU = 'Essa pasta não existe mais: um colega pode tê-la apagado. Escolha outra.';
/**
 * A mensagem quando a própria pasta que se renomeia, move ou apaga já não existe (um colega a apagou com a lista desta tela já
 * lida). Todo o escritório pode mexer nas pastas, então, dentro do escritório, nenhuma linha mudar quer dizer isso.
 */
export const PASTA_APAGADA = 'Essa pasta não existe mais: um colega pode tê-la apagado.';
/** A mensagem quando a pasta iria para dentro dela mesma ou de uma subpasta dela. */
export const PASTA_DENTRO_DELA = 'Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela.';
/** A mensagem quando já há uma irmã com o mesmo nome. */
export const PASTA_REPETIDA = 'Já existe uma pasta com esse nome aqui.';
/** A mensagem do nome vazio (no banco, a regra anotacao_pastas_nome_preenchido). */
export const PASTA_SEM_NOME = 'Dê um nome à pasta.';
/** A mensagem do nome longo demais (no banco, a regra anotacao_pastas_nome_tamanho). */
export const PASTA_NOME_LONGO = `O nome da pasta pode ter até ${TAMANHO_PASTA} caracteres.`;

/**
 * O que há de errado no nome da pasta que fica dentro de "pastaMaeId" (null: no primeiro nível), ou ''. "id": a que está
 * sendo renomeada ou movida (não conta como repetida). Maiúsculas e acentos não contam, como no índice único do banco.
 */
export function erroDoNomeDaPasta(nome: string, pastas: PastaDaArvore[], pastaMaeId: string | null, id?: string): string {
  const limpo = nomeDaPasta(nome);
  if (!limpo) return PASTA_SEM_NOME;
  if (limpo.length > TAMANHO_PASTA) return PASTA_NOME_LONGO;
  const irmas = pastas.filter(p => p.id !== id && (p.pasta_mae_id ?? null) === pastaMaeId);
  return irmas.some(p => normal(nomeDaPasta(p.nome)) === normal(limpo)) ? PASTA_REPETIDA : '';
}

/** O que há de errado em levar a pasta para dentro de "novaMaeId" (null: o primeiro nível), ou ''. */
export function erroAoMoverPasta(pastas: PastaDaArvore[], id: string, novaMaeId: string | null): string {
  if (novaMaeId && pastasDescendentes(pastas, id).includes(novaMaeId)) return PASTA_DENTRO_DELA;
  const pasta = pastas.find(p => p.id === id);
  return pasta ? erroDoNomeDaPasta(pasta.nome, pastas, novaMaeId, id) : '';
}

/** Para onde a pasta pode ir: o primeiro nível e todas as outras pastas, menos ela mesma e as que ficam dentro dela. */
export function destinosDaPasta<P extends PastaDaArvore>(pastas: P[], id: string): NoDaPasta<P>[] {
  const fora = new Set(pastasDescendentes(pastas, id));
  return pastasEmOrdem(pastas).filter(n => !fora.has(n.pasta.id));
}

/** O parâmetro do endereço da página Documentos que escolhe a pasta (/documentos/?pasta=<id>). */
export const PARAMETRO_DA_PASTA = 'pasta';
/** O endereço da página Documentos já mostrando a pasta (e as subpastas dela): é para onde leva cada pedaço do caminho. */
export const enderecoDaPasta = (id: string) => `/documentos/?${new URLSearchParams({ [PARAMETRO_DA_PASTA]: id })}`;
