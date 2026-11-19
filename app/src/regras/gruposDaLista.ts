// Checklists com grupos e subgrupos numerados (#309): 1. Documentos pessoais › 1.1 RG; 2. Benefício › 2.1 Aposentadoria por
// idade › 2.1.1 CNIS. A árvore montada a partir das linhas do banco, a numeração (que nunca é guardada), as contagens, o subir,
// descer e mover para grupo, as posições a gravar, os modelos (a árvore guardada em lista_modelos.arvore) e a lista colada.
// Regras puras: sem tela, sem banco. O banco fictício (dados/falso.ts) usa estas funções para se comportar como o de verdade
// (supabase/migrations/20261119142702_checklists_com_grupos.sql).
import type { GrupoDaLista, ItemDaLista, ListaDoCartao, NoDoModelo, PosicaoNaLista } from '../dados/tipos';
import { GRUPOS_DO_MODELO, ITENS_DO_MODELO, NIVEIS_DO_CHECKLIST, TAMANHO_ITEM, TAMANHO_LISTA } from '../dados/limites';
import type { NomeIcone } from '../ui/Icone';

/** Abaixo deste vão entre duas posições, o novo não cabe entre elas e o checklist é renumerado. */
const MENOR_VAO_DA_ORDEM = 1e-6;
/** Acima desta fração das linhas coladas começando com número (1., 2.1), a tela oferece usar os números como grupos. */
const PARTE_NUMERADA_PARA_SUGERIR = 0.5;
/** Uma linha que começa com número: "2.1.1 CNIS", "3. Procuração". */
const NUMERO_NO_COMECO = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/;

// As mensagens são as mesmas do banco.
export const NIVEIS_DEMAIS = `O checklist vai até ${NIVEIS_DO_CHECKLIST} níveis (como 2.1.1).`;
export const GRUPO_DENTRO_DELE = 'Um grupo não pode ir para dentro dele mesmo nem de um subgrupo dele.';
export const GRUPO_DE_OUTRO_CHECKLIST = 'Esse grupo é de outro checklist.';
export const CHECKLIST_MUDOU = 'O checklist mudou enquanto você mexia nele. Ele foi recarregado: tente de novo.';
/** O destino de "Mover para grupo" que tira o nó dos grupos. */
export const FORA_DOS_GRUPOS = 'Fora dos grupos';

/** O que a árvore precisa de um checklist. */
export type ChecklistDaArvore = Pick<ListaDoCartao, 'grupos' | 'itens'>;
/** Um nó da árvore do checklist na tela: grupo (com o que está dentro) ou item. "numero", "nivel" e "caminho" são calculados. */
export type NoDaLista =
  | { tipo: 'grupo'; id: string; grupo: GrupoDaLista; numero: string; nivel: number; caminho: string; filhos: NoDaLista[]; feitos: number; total: number }
  | { tipo: 'item'; id: string; item: ItemDaLista; numero: string; nivel: number; caminho: string };
// caminho: o número e o nome dos grupos de cima ("2. Benefício › 2.1 Aposentadoria por idade"), para o leitor de tela.
export type AcaoDoNo = 'subir' | 'descer';
/** O resultado de uma ação: a árvore nova ou o motivo de não dar. */
export type ResultadoDaAcao = { arvore: NoDaLista[] } | { motivo: string };
/** Um destino de "Mover para grupo": o grupo (null: fora dos grupos) e o texto da opção ("2.1 Aposentadoria por idade"). */
export interface DestinoDoNo { grupoId: string | null; nome: string }

/** A forma da árvore, antes de numerar: o que as ações mexem. */
type Esqueleto = { tipo: 'grupo'; grupo: GrupoDaLista; filhos: Esqueleto[] } | { tipo: 'item'; item: ItemDaLista };

const SEPARADOR = ' › ';

// ---------- montar, numerar, contar ----------

/** O número do nó pela posição em cada nível: [2] → '2.'; [2, 1] → '2.1'; [2, 1, 1] → '2.1.1'. */
export const numeroDoNo = (posicao: readonly number[]) => posicao.length === 1 ? `${posicao[0]}.` : posicao.join('.');

/** A "ordem" guardada no banco. */
const ordemGuardada = (n: Esqueleto) => n.tipo === 'grupo' ? n.grupo.ordem : n.item.ordem;
const criadoEm = (n: Esqueleto) => n.tipo === 'grupo' ? n.grupo.criado_em : n.item.criado_em;
const idDe = (n: Esqueleto) => n.tipo === 'grupo' ? n.grupo.id : n.item.id;

/** A posição do nó entre os irmãos: item, a "ordem" dele; grupo com itens, a menor "ordem" dos itens de dentro (em qualquer
 *  nível); grupo vazio, a "ordem" dele. Assim a renumeração da versão anterior (que só mexe nos itens) não desarruma os grupos. */
function posicaoEntreIrmaos(n: Esqueleto): number {
  if (n.tipo === 'item') return n.item.ordem;
  const dosItens = esqueletoEmOrdem(n.filhos).flatMap(x => x.tipo === 'item' ? [x.item.ordem] : []);
  return dosItens.length ? Math.min(...dosItens) : n.grupo.ordem;
}
const porPosicao = (a: Esqueleto, b: Esqueleto) =>
  posicaoEntreIrmaos(a) - posicaoEntreIrmaos(b) || criadoEm(a).localeCompare(criadoEm(b)) || idDe(a).localeCompare(idDe(b));

function esqueletoEmOrdem(nos: Esqueleto[]): Esqueleto[] {
  return nos.flatMap(n => n.tipo === 'grupo' ? [n, ...esqueletoEmOrdem(n.filhos)] : [n]);
}

/** A árvore pelas ligações do banco, sem ordenar. Grupo ou item cujo pai não veio vai para o primeiro nível; um grupo preso num
 *  ciclo (o banco não deixa) entra uma vez só, no primeiro nível. */
function esqueletoDaLista(lista: ChecklistDaArvore): Esqueleto[] {
  const ids = new Set(lista.grupos.map(g => g.id)), usados = new Set<string>();
  const daqui = (pai: string | null, de: string | null) => pai === null ? de === null || !ids.has(de) : de === pai;
  const montarGrupo = (grupo: GrupoDaLista): Esqueleto => {
    usados.add(grupo.id);
    return { tipo: 'grupo', grupo, filhos: filhosDe(grupo.id) };
  };
  const filhosDe = (pai: string | null): Esqueleto[] => [
    ...lista.grupos.filter(g => daqui(pai, g.pai_id) && !usados.has(g.id)).map(montarGrupo),
    ...lista.itens.filter(i => daqui(pai, i.grupo_id)).map((item): Esqueleto => ({ tipo: 'item', item }))
  ];
  const raiz = filhosDe(null);
  for (const g of lista.grupos) if (!usados.has(g.id)) raiz.push(montarGrupo(g));
  return raiz;
}
const ordenar = (nos: Esqueleto[]): Esqueleto[] =>
  nos.map(n => n.tipo === 'grupo' ? { ...n, filhos: ordenar(n.filhos) } : n).sort(porPosicao);

/** Numera a árvore (na ordem em que está) e conta os itens de cada grupo. */
function numerar(nos: Esqueleto[], acima: number[] = [], caminho = ''): NoDaLista[] {
  return nos.map((n, i): NoDaLista => {
    const posicao = [...acima, i + 1], numero = numeroDoNo(posicao), nivel = posicao.length;
    if (n.tipo === 'item') return { tipo: 'item', id: n.item.id, item: n.item, numero, nivel, caminho };
    const filhos = numerar(n.filhos, posicao, [caminho, `${numero} ${n.grupo.nome}`].filter(Boolean).join(SEPARADOR));
    return { tipo: 'grupo', id: n.grupo.id, grupo: n.grupo, numero, nivel, caminho, filhos, ...contar(filhos) };
  });
}
function contar(nos: NoDaLista[]) {
  const itens = emOrdemDeLeitura(nos).flatMap(n => n.tipo === 'item' ? [n.item] : []);
  return { feitos: itens.filter(i => i.feito_em).length, total: itens.length };
}

/** A árvore do checklist, numerada: 1., 1.1, 2.1.1. Sem grupos, os itens ficam 1., 2., 3. */
export const arvoreDaLista = (lista: ChecklistDaArvore): NoDaLista[] => numerar(ordenar(esqueletoDaLista(lista)));

/** Quantos itens do grupo estão feitos, de quantos (os de dentro, em qualquer nível). Item: ele mesmo. */
export const contagemDoGrupo = (no: NoDaLista) => contar([no]);

/** A árvore achatada, na ordem de leitura: o grupo, o que está dentro dele, o próximo. */
export function emOrdemDeLeitura(arvore: NoDaLista[]): NoDaLista[] {
  return arvore.flatMap(n => n.tipo === 'grupo' ? [n, ...emOrdemDeLeitura(n.filhos)] : [n]);
}

/** Quantos níveis o nó ocupa: item 1; grupo, 1 mais o mais fundo de dentro. */
export const alturaDoNo = (no: NoDaLista): number => no.tipo === 'item' ? 1 : 1 + Math.max(0, ...no.filhos.map(alturaDoNo));
/** Quantos níveis de grupos o nó ocupa: item 0; grupo, 1 mais o grupo mais fundo de dentro. */
const alturaDosGrupos = (no: NoDaLista): number => no.tipo === 'item' ? 0 : 1 + Math.max(0, ...no.filhos.map(alturaDosGrupos));
/** Se o nó cabe dentro de um grupo do nível dado (0: fora dos grupos): o item vai até o último nível; o grupo, até o penúltimo. */
const cabe = (no: NoDaLista, nivelDoDestino: number) =>
  nivelDoDestino + alturaDoNo(no) <= NIVEIS_DO_CHECKLIST && nivelDoDestino + alturaDosGrupos(no) <= NIVEIS_DO_CHECKLIST - 1;

export const acharNo = (arvore: NoDaLista[], id: string) => emOrdemDeLeitura(arvore).find(n => n.id === id) ?? null;

/** O nó anterior na ordem de leitura (para onde vai o foco depois de excluir); o primeiro não tem. */
export function noDeCima(arvore: NoDaLista[], id: string): NoDaLista | null {
  const lidos = emOrdemDeLeitura(arvore), i = lidos.findIndex(n => n.id === id);
  return i > 0 ? lidos[i - 1] : null;
}

/** Se o grupo ainda pode ganhar um subgrupo (o subgrupo vai até o penúltimo nível). */
export const podeTerSubgrupo = (no: NoDaLista) => no.tipo === 'grupo' && no.nivel < NIVEIS_DO_CHECKLIST - 1;

// ---------- subir, descer e mover para grupo ----------

/** Onde o nó está: os irmãos, a posição entre eles e o grupo de cima (null: no primeiro nível). */
function localizar(arvore: NoDaLista[], id: string, pai: string | null = null): { irmaos: NoDaLista[]; indice: number; pai: string | null } | null {
  const indice = arvore.findIndex(n => n.id === id);
  if (indice >= 0) return { irmaos: arvore, indice, pai };
  for (const n of arvore) {
    const achou = n.tipo === 'grupo' ? localizar(n.filhos, id, n.id) : null;
    if (achou) return achou;
  }
  return null;
}
/** A árvore com os filhos do grupo (null: o primeiro nível) trocados. */
function trocarFilhos(arvore: NoDaLista[], pai: string | null, novos: NoDaLista[]): NoDaLista[] {
  if (pai === null) return novos;
  return arvore.map(n => n.tipo !== 'grupo' ? n : { ...n, filhos: n.id === pai ? novos : trocarFilhos(n.filhos, pai, novos) });
}
const filhosDoGrupo = (arvore: NoDaLista[], pai: string | null) => {
  if (pai === null) return arvore;
  const g = acharNo(arvore, pai);
  return g?.tipo === 'grupo' ? g.filhos : [];
};
const dentroDe = (no: NoDaLista, id: string) => no.tipo === 'grupo' && emOrdemDeLeitura(no.filhos).some(n => n.id === id);

/** Troca o nó com o irmão de cima (passo -1) ou de baixo (1); o grupo leva o que está dentro dele. */
export function moverEntreIrmaos(arvore: NoDaLista[], id: string, passo: 1 | -1): ResultadoDaAcao {
  const onde = localizar(arvore, id);
  if (!onde) return { motivo: CHECKLIST_MUDOU };
  const j = onde.indice + passo;
  if (j < 0) return { motivo: 'Já é o primeiro deste grupo.' };
  if (j >= onde.irmaos.length) return { motivo: 'Já é o último deste grupo.' };
  const irmaos = [...onde.irmaos];
  [irmaos[onde.indice], irmaos[j]] = [irmaos[j], irmaos[onde.indice]];
  return { arvore: numerar(trocarFilhos(arvore, onde.pai, irmaos)) };
}

/** As ações do ⋯ que só mudam a ordem (uma tabela, sem cadeia de if). "Mover para grupo" tem janela própria (destinosDoNo). */
export const ACOES_DO_NO: Record<AcaoDoNo, { rotulo: string; icone: NomeIcone; aplicar: (arvore: NoDaLista[], id: string) => ResultadoDaAcao }> = {
  subir: { rotulo: 'Subir', icone: 'acima', aplicar: (a, id) => moverEntreIrmaos(a, id, -1) },
  descer: { rotulo: 'Descer', icone: 'abaixo', aplicar: (a, id) => moverEntreIrmaos(a, id, 1) },
};

/** Para onde o nó pode ir: "Fora dos grupos" e os grupos em ordem de leitura, com o número, menos ele mesmo, os de dentro dele
 *  e os em que ele passaria do último nível. Inclui o grupo em que ele já está (a janela o mostra marcado). */
export function destinosDoNo(arvore: NoDaLista[], id: string): DestinoDoNo[] {
  const no = acharNo(arvore, id);
  if (!no) return [];
  const grupos = emOrdemDeLeitura(arvore).flatMap(g => g.tipo === 'grupo' && g.id !== id && !dentroDe(no, g.id) && cabe(no, g.nivel)
    ? [{ grupoId: g.id, nome: `${g.numero} ${g.grupo.nome}` }] : []);
  return [{ grupoId: null, nome: FORA_DOS_GRUPOS }, ...grupos];
}

/** Leva o nó (com o que está dentro dele) para o fim do grupo escolhido (null: o fim do primeiro nível). */
export function moverParaGrupo(arvore: NoDaLista[], id: string, grupoId: string | null): ResultadoDaAcao {
  const onde = localizar(arvore, id);
  if (!onde) return { motivo: CHECKLIST_MUDOU };
  if (onde.pai === grupoId) return { motivo: 'Já está nesse grupo.' };
  const no = onde.irmaos[onde.indice];
  const destino = grupoId === null ? null : acharNo(arvore, grupoId);
  if (grupoId !== null && destino?.tipo !== 'grupo') return { motivo: CHECKLIST_MUDOU };
  if (grupoId === id || (grupoId !== null && dentroDe(no, grupoId))) return { motivo: GRUPO_DENTRO_DELE };
  if (!cabe(no, destino?.nivel ?? 0)) return { motivo: NIVEIS_DEMAIS };
  const sem = trocarFilhos(arvore, onde.pai, onde.irmaos.filter(n => n.id !== id));
  return { arvore: numerar(trocarFilhos(sem, grupoId, [...filhosDoGrupo(sem, grupoId), no])) };
}

/** As ações do ⋯ que dão certo para o nó, e se há algum grupo para onde movê-lo além do atual (sem grupos, não há). */
export function acoesPossiveis(arvore: NoDaLista[], id: string): { ordem: AcaoDoNo[]; moverParaGrupo: boolean } {
  const ordem = (Object.keys(ACOES_DO_NO) as AcaoDoNo[]).filter(a => 'arvore' in ACOES_DO_NO[a].aplicar(arvore, id));
  const atual = localizar(arvore, id)?.pai ?? null;
  return { ordem, moverParaGrupo: destinosDoNo(arvore, id).some(d => d.grupoId !== atual) };
}

// ---------- gravar a ordem ----------

/** Cada nó com o grupo de cima e a posição na ordem de leitura (1, 2, 3...). */
export function posicoesDaArvore(arvore: NoDaLista[]): PosicaoNaLista[] {
  const posicoes: PosicaoNaLista[] = [];
  const percorrer = (nos: NoDaLista[], pai: string | null) => nos.forEach(n => {
    posicoes.push({ id: n.id, tipo: n.tipo, pai_id: pai, ordem: posicoes.length + 1 });
    if (n.tipo === 'grupo') percorrer(n.filhos, n.id);
  });
  percorrer(arvore, null);
  return posicoes;
}
/** O que está guardado de cada nó (o grupo de cima e a "ordem"), pelo id. */
const guardadas = (nos: NoDaLista[]) => new Map(emOrdemDeLeitura(nos).map(n =>
  [n.id, n.tipo === 'grupo' ? { pai_id: n.grupo.pai_id, ordem: n.grupo.ordem } : { pai_id: n.item.grupo_id, ordem: n.item.ordem }]));
const queMudaram = (posicoes: PosicaoNaLista[], antes: ReturnType<typeof guardadas>) => posicoes.filter(p => {
  const a = antes.get(p.id);
  return !a || a.pai_id !== p.pai_id || a.ordem !== p.ordem;
});
const crescem = (ordens: number[]) => ordens.every((o, i) => i === 0 || o > ordens[i - 1]);

/** Se as "ordem" guardadas já crescem na ordem de leitura da árvore (grupos e itens). Fica falso depois que a versão anterior
 *  renumerou os itens. */
export const segueALeitura = (lista: ChecklistDaArvore) => crescem(esqueletoEmOrdem(ordenar(esqueletoDaLista(lista))).map(ordemGuardada));

/** As posições a gravar depois de uma ação: os nós cujo grupo de cima ou "ordem" mudou, com a ordem de leitura de 1 a n (se a
 *  versão anterior renumerou os itens, isso regrava o checklist inteiro). */
export const mudancasDePosicao = (lista: ChecklistDaArvore, depois: NoDaLista[]): PosicaoNaLista[] =>
  queMudaram(posicoesDaArvore(depois), guardadas(arvoreDaLista(lista)));

/**
 * Onde entra o grupo ou o item novo: no fim do grupo (null: no fim do checklist, depois da maior "ordem" de grupos e itens).
 * No fim do grupo, a "ordem" fica entre o último nó de dentro dele e o próximo nó; se o vão é pequeno demais, ou se a ordem
 * guardada não segue a leitura, "renumerar" traz o checklist inteiro renumerado com um vão para o novo (gravar antes de criar).
 */
export function ondeEntraONovo(arvore: NoDaLista[], grupoId: string | null): { pai_id: string | null; ordem: number; renumerar: PosicaoNaLista[] } {
  const lidos = emOrdemDeLeitura(arvore), g = grupoId === null ? -1 : lidos.findIndex(n => n.id === grupoId);
  const grupo = lidos[g];
  if (grupo?.tipo !== 'grupo') return { pai_id: null, ordem: Math.max(0, ...lidos.map(ordemGuardada)) + 1, renumerar: [] };
  const fim = g + emOrdemDeLeitura(grupo.filhos).length, a = ordemGuardada(lidos[fim]), proximo = lidos[fim + 1];
  if (crescem(lidos.map(ordemGuardada)) && (!proximo || ordemGuardada(proximo) - a >= MENOR_VAO_DA_ORDEM)) {
    return { pai_id: grupo.id, ordem: proximo ? (a + ordemGuardada(proximo)) / 2 : a + 1, renumerar: [] };
  }
  // Renumera de 1 a n, pulando a posição logo depois do fim do grupo: é a do novo.
  const renumeradas = posicoesDaArvore(arvore).map((p, i) => ({ ...p, ordem: i + 1 + (i > fim ? 1 : 0) }));
  return { pai_id: grupo.id, ordem: fim + 2, renumerar: queMudaram(renumeradas, guardadas(arvore)) };
}

/** O erro que o banco daria para esta árvore ('' = está certa): grupo de outro checklist, grupo dentro dele mesmo, níveis demais. */
export function erroDaArvore(lista: ChecklistDaArvore): string {
  const ids = new Set(lista.grupos.map(g => g.id));
  if (lista.grupos.some(g => g.pai_id !== null && !ids.has(g.pai_id)) || lista.itens.some(i => i.grupo_id !== null && !ids.has(i.grupo_id))) {
    return GRUPO_DE_OUTRO_CHECKLIST;
  }
  const nivel = new Map<string, number>();
  let atuais = lista.grupos.filter(g => g.pai_id === null);
  for (let n = 1; atuais.length; n++) {
    atuais.forEach(g => nivel.set(g.id, n));
    atuais = lista.grupos.filter(g => g.pai_id !== null && atuais.some(x => x.id === g.pai_id));
  }
  if (nivel.size < lista.grupos.length) return GRUPO_DENTRO_DELE;
  const maisFundo = Math.max(0, ...nivel.values()), itemMaisFundo = Math.max(1, ...lista.itens.map(i => i.grupo_id === null ? 1 : nivel.get(i.grupo_id)! + 1));
  return maisFundo > NIVEIS_DO_CHECKLIST - 1 || itemMaisFundo > NIVEIS_DO_CHECKLIST ? NIVEIS_DEMAIS : '';
}

// ---------- modelos ----------

/** As folhas (os itens) do modelo, na ordem de leitura (como privado.itens_da_arvore). */
export const itensDaArvore = (arvore: NoDoModelo[]): string[] => arvore.flatMap(n => n.filhos ? itensDaArvore(n.filhos) : [n.texto]);
/** O modelo de antes, sem grupos: um item por texto. */
export const arvoreDosItens = (itens: string[]): NoDoModelo[] => itens.map(texto => ({ texto }));
const contarGrupos = (arvore: NoDoModelo[]): number => arvore.reduce((n, no) => n + (no.filhos ? 1 + contarGrupos(no.filhos) : 0), 0);

/**
 * A árvore guardada, ajustada aos "itens" que a versão anterior mudou: a k-ésima folha com um texto liga-se à k-ésima vez que
 * ele aparece em "itens"; as folhas sem par saem (e os grupos que ficam vazios); em cada lista de irmãos, as folhas ocupam os
 * mesmos lugares, na ordem nova; os itens sem folha vão para o fim do primeiro nível. Sem mudança, devolve a mesma árvore.
 */
export function reconciliarArvore(arvore: NoDoModelo[], itens: string[]): NoDoModelo[] {
  const folhas = itensDaArvore(arvore);
  if (folhas.length === itens.length && folhas.every((f, i) => f === itens[i])) return arvore;
  const lugares = new Map<string, number[]>();
  itens.forEach((texto, i) => lugares.set(texto, [...(lugares.get(texto) ?? []), i]));
  const par = new Map<NoDoModelo, number>(), usados = new Set<number>();
  const ligar = (nos: NoDoModelo[]): void => nos.forEach(n => {
    if (n.filhos) return ligar(n.filhos);
    const i = lugares.get(n.texto)?.shift();
    if (i !== undefined) { par.set(n, i); usados.add(i); }
  });
  ligar(arvore);
  const montar = (nos: NoDoModelo[]): NoDoModelo[] => {
    const naOrdemNova = nos.flatMap(n => !n.filhos && par.has(n) ? [par.get(n)!] : []).sort((a, b) => a - b);
    return nos.flatMap((n): NoDoModelo[] => {
      if (!n.filhos) return par.has(n) ? [{ texto: itens[naOrdemNova.shift()!] }] : [];
      const filhos = montar(n.filhos);
      return filhos.length ? [{ texto: n.texto, filhos }] : [];
    });
  };
  return [...montar(arvore), ...itens.filter((_, i) => !usados.has(i)).map(texto => ({ texto }))];
}

/** A árvore de um modelo como a tela usa: a dos itens, se o modelo é de antes; senão, a guardada, ajustada aos itens. */
export const arvoreDoModelo = (m: { itens: string[]; arvore: NoDoModelo[] | null }) => m.arvore ? reconciliarArvore(m.arvore, m.itens) : arvoreDosItens(m.itens);

function limparNivel(nos: NoDoModelo[], nivel: number): NoDoModelo[] | string {
  const saida: NoDoModelo[] = [];
  for (const no of nos) {
    const texto = (no.texto ?? '').trim();
    if (!texto) continue;
    if (!no.filhos) { saida.push({ texto }); continue; }
    if (nivel >= NIVEIS_DO_CHECKLIST) return NIVEIS_DEMAIS;
    if (texto.length > TAMANHO_LISTA) return `O nome de cada grupo pode ter até ${TAMANHO_LISTA} caracteres.`;
    const filhos = limparNivel(no.filhos, nivel + 1);
    if (typeof filhos === 'string') return filhos;
    if (filhos.length) saida.push({ texto, filhos });
  }
  return saida;
}
/** A árvore do modelo limpa, como o banco guarda (textos sem espaços nas pontas, sem itens vazios nem grupos sem nada dentro),
 *  ou a mensagem do que passou dos limites (níveis, tamanhos, quantos grupos, quantos itens). */
export function limparArvore(arvore: NoDoModelo[]): NoDoModelo[] | string {
  const limpa = limparNivel(arvore, 1);
  if (typeof limpa === 'string') return limpa;
  const folhas = itensDaArvore(limpa);
  if (contarGrupos(limpa) > GRUPOS_DO_MODELO) return `Um modelo pode ter até ${GRUPOS_DO_MODELO} grupos.`;
  if (folhas.length > ITENS_DO_MODELO) return `Um modelo pode ter até ${ITENS_DO_MODELO} itens.`;
  if (folhas.some(i => i.length > TAMANHO_ITEM)) return `Cada item do modelo pode ter até ${TAMANHO_ITEM} caracteres.`;
  return limpa;
}

/** O checklist como árvore de modelo (para "Salvar como modelo" e para o editor de modelos). Os grupos vazios vêm junto: o
 *  limparArvore os tira. */
export function arvoreDoChecklist(lista: ChecklistDaArvore): NoDoModelo[] {
  const converter = (nos: NoDaLista[]): NoDoModelo[] =>
    nos.map(n => n.tipo === 'grupo' ? { texto: n.grupo.nome, filhos: converter(n.filhos) } : { texto: n.item.texto });
  return converter(arvoreDaLista(lista));
}

/** A árvore do modelo como um checklist em memória (ids g1, i1…, "ordem" na leitura), para o editor de modelos usar as mesmas
 *  regras e a mesma árvore da tela. */
export function listaDoModelo(arvore: NoDoModelo[]): ChecklistDaArvore {
  const grupos: GrupoDaLista[] = [], itens: ItemDaLista[] = [];
  const percorrer = (nos: NoDoModelo[], pai: string | null) => nos.forEach(n => {
    const ordem = grupos.length + itens.length + 1;
    if (!n.filhos) {
      itens.push({ id: `i${itens.length + 1}`, texto: n.texto, prazo: null, feito_em: null, feito_por: null, ordem, grupo_id: pai, criado_em: '' });
      return;
    }
    const id = `g${grupos.length + 1}`;
    grupos.push({ id, nome: n.texto, pai_id: pai, ordem, criado_em: '' });
    percorrer(n.filhos, id);
  });
  percorrer(arvore, null);
  return { grupos, itens };
}

/** O que vai para o banco criar o checklist de uma vez (checklist_criar): chaves g1, g2…, o grupo de cima antes dos de dentro,
 *  "ordem" na leitura. */
export function planoDoChecklist(arvore: NoDoModelo[]) {
  const grupos: { chave: string; pai: string | null; nome: string; ordem: number }[] = [];
  const itens: { pai: string | null; texto: string; ordem: number }[] = [];
  const percorrer = (nos: NoDoModelo[], pai: string | null) => nos.forEach(n => {
    const ordem = grupos.length + itens.length + 1;
    if (!n.filhos) { itens.push({ pai, texto: n.texto, ordem }); return; }
    const chave = `g${grupos.length + 1}`;
    grupos.push({ chave, pai, nome: n.texto, ordem });
    percorrer(n.filhos, chave);
  });
  percorrer(arvore, null);
  return { grupos, itens };
}

// ---------- colar uma lista ----------

/** As linhas coladas (sem espaços nas pontas e sem as vazias), e se a maioria delas começa com número (1., 2.1): aí a tela
 *  oferece usar os números como grupos. */
export function linhasColadas(texto: string): { linhas: string[]; numeradas: boolean } {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const comNumero = linhas.filter(l => NUMERO_NO_COMECO.test(l)).length;
  return { linhas, numeradas: linhas.length > 1 && comNumero / linhas.length > PARTE_NUMERADA_PARA_SUGERIR };
}

/**
 * A árvore das linhas coladas. Sem usar os números: um item por linha, com o texto como veio. Usando: o número diz o nível e sai
 * do texto ("2.1.1 CNIS" fica dentro do 2.1); a linha com linhas dentro vira grupo; o número que pula (3.1 sem 3.) entra na linha
 * de nível menor mais próxima de cima; a linha sem número fica ao lado da anterior. Passar do último nível dá o erro.
 */
export function arvoreDasLinhas(linhas: string[], usarNumeros: boolean): { arvore: NoDoModelo[]; erro: string } {
  if (!usarNumeros) return { arvore: arvoreDosItens(linhas), erro: '' };
  type Linha = { texto: string; nivel: number; filhos: Linha[] };
  const raiz: Linha[] = [], pilha: Linha[] = [];
  for (const linha of linhas) {
    const numero = NUMERO_NO_COMECO.exec(linha);
    const nivel = numero ? numero[1].split('.').length : pilha.at(-1)?.nivel ?? 1;
    while (pilha.length && pilha.at(-1)!.nivel >= nivel) pilha.pop();
    const no: Linha = { texto: numero ? numero[2].trim() : linha, nivel, filhos: [] };
    (pilha.at(-1)?.filhos ?? raiz).push(no);
    pilha.push(no);
    if (pilha.length > NIVEIS_DO_CHECKLIST) return { arvore: [], erro: `A linha "${linha}" passa de ${NIVEIS_DO_CHECKLIST} níveis (como 2.1.1).` };
  }
  const converter = (nos: Linha[]): NoDoModelo[] => nos.map(n => n.filhos.length ? { texto: n.texto, filhos: converter(n.filhos) } : { texto: n.texto });
  return { arvore: converter(raiz), erro: '' };
}
