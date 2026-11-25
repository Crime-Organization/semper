// O papel escrito pela equipe no processo (#443): no "Papel do cliente" (e no papel das pessoas do processo, que usa a mesma lista),
// a última opção, "+ Escrever outro papel…", abre a janela de texto. O nome escrito é o papel 'outro' com um nome: fica guardado no
// processo (processos.papeis_escritos, processo_partes.papel_escrito) e entra na lista do escritório, que aparece nos próximos
// cadastros. Um nome aparece uma vez só, sem contar maiúsculas, acentos e espaços repetidos (a mesma comparação do banco,
// privado.chave_do_papel, na migração papel_escrito). Tudo puro, sem tela nem banco.
import type { PapeisDosClientes, PapeisEscritos, PapelDaParte } from '../dados/tipos';
import { ehPapelDaParte, PAPEIS_DA_PARTE, PAPEIS_DO_CLIENTE } from './processo';
import { normal } from './texto';

/** O valor da última opção do select, que abre a janela de escrever (nenhum papel tem esse código). */
export const ESCREVER_PAPEL = '__escrever';
/** O nome da última opção do select. */
export const OPCAO_ESCREVER = '+ Escrever outro papel…';
/** O título da janela de escrever. */
export const ESCREVER_OUTRO_PAPEL = 'Escrever outro papel';
/** O nome do grupo do select com os papéis escritos do escritório (como o "Do escritório" dos tipos de vínculo). */
export const GRUPO_DO_ESCRITORIO = 'Do escritório';
/** A recusa de devolver à lista um papel que já está nela (a mesma no banco, pelo índice processo_papeis_unico, e no fictício). */
export const PAPEL_JA_NA_LISTA = 'Esse papel já está na lista.';
/** Como o valor da opção marca um papel escrito ("escrito:Inventariante"). */
const PREFIXO_DO_ESCRITO = 'escrito:';

/** O nome sem os espaços das pontas e com os repetidos juntados ("  Inventariante   do  espólio " vira "Inventariante do espólio"). */
export const limparPapelEscrito = (texto: string) => texto.replace(/\s+/g, ' ').trim();
/** O que torna dois nomes o mesmo papel: sem maiúsculas, acentos e espaços repetidos. */
export const chaveDoPapel = (texto: string) => normal(limparPapelEscrito(texto));
/** O nome da lista que é o mesmo papel do texto, na grafia da lista; null quando não há. */
export const papelNaLista = (lista: readonly string[], texto: string) => lista.find(nome => chaveDoPapel(nome) === chaveDoPapel(texto)) ?? null;

/** O papel escolhido: um da lista fixa ou, com o papel 'outro', o nome escrito. */
export interface PapelEscolhido { papel: PapelDaParte; escrito?: string }

/**
 * O papel do texto que a pessoa escreveu: vazio, nenhum (null); igual ao nome de um papel fixo ("réu"), esse papel; igual a um da
 * lista do escritório, ele, na grafia da lista; senão, o texto limpo, como papel novo.
 */
export function papelDoTexto(texto: string, lista: readonly string[], fixos: readonly PapelDaParte[] = PAPEIS_DO_CLIENTE): PapelEscolhido | null {
  const limpo = limparPapelEscrito(texto);
  if (!limpo) return null;
  const fixo = fixos.find(x => chaveDoPapel(PAPEIS_DA_PARTE[x]) === chaveDoPapel(limpo));
  if (fixo) return { papel: fixo };
  return { papel: 'outro', escrito: papelNaLista(lista, limpo) ?? limpo };
}

/** O valor da opção do select: o código do papel ou, com nome escrito, a marca dele. */
export const valorDoPapel = (papel: PapelDaParte | '' | undefined, escrito?: string | null) =>
  papel === 'outro' && escrito ? PREFIXO_DO_ESCRITO + escrito : papel ?? '';
/** O papel do valor da opção (o contrário de valorDoPapel); a opção vazia (ou a de escrever), nenhum. */
export function papelDoValor(valor: string): PapelEscolhido | null {
  if (valor.startsWith(PREFIXO_DO_ESCRITO)) return { papel: 'outro', escrito: valor.slice(PREFIXO_DO_ESCRITO.length) };
  return ehPapelDaParte(valor) ? { papel: valor } : null;
}

/** Uma opção do grupo "Do escritório". */
export interface OpcaoDoPapel { valor: string; nome: string }
/**
 * As opções do grupo "Do escritório": a lista do escritório e os nomes já escritos no próprio formulário (os de outras linhas e o
 * atual, mesmo que tenha saído da lista: o processo continua com ele até alguém trocar). Cada nome uma vez, em ordem alfabética.
 */
export function opcoesDoPapel(lista: readonly string[], usados: readonly (string | null | undefined)[] = []): OpcaoDoPapel[] {
  const nomes: string[] = [];
  for (const nome of [...lista, ...usados]) if (nome && !papelNaLista(nomes, nome)) nomes.push(nome);
  return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR')).map(nome => ({ valor: valorDoPapel('outro', nome), nome }));
}

/**
 * Como o gatilho preparar_papeis_escritos do banco: só o cliente do processo com o papel 'outro' guarda o nome escrito, limpo;
 * o nome vazio sai.
 */
export const escritosAoGravar = (escritos: PapeisEscritos, papeis: PapeisDosClientes, clientes: readonly string[]): PapeisEscritos =>
  Object.fromEntries(clientes.flatMap(id => {
    const nome = limparPapelEscrito(escritos[id] ?? '');
    return papeis[id] === 'outro' && nome ? [[id, nome]] : [];
  }));
/**
 * Os nomes que entram na lista do escritório ao gravar o processo, como o gatilho: só os novos para este processo. Salvar de novo
 * um processo com um nome que o administrador tirou da lista não o devolve a ela.
 */
export function nomesNovosDoProcesso(antes: PapeisEscritos, depois: PapeisEscritos): string[] {
  const jaTinha = Object.values(antes).filter((x): x is string => !!x);
  const novos: string[] = [];
  for (const nome of Object.values(depois)) if (nome && !papelNaLista(jaTinha, nome) && !papelNaLista(novos, nome)) novos.push(nome);
  return novos;
}
/** O valor que a pergunta do papel já traz escolhido ao pôr um cliente pelo cartão: o do primeiro cliente com papel (veja papelSugeridoDoCliente). */
export function valorSugeridoDoCliente(papeis: PapeisDosClientes | undefined, escritos: PapeisEscritos | undefined): string {
  const primeiro = Object.entries(papeis ?? {}).find(([, papel]) => ehPapelDaParte(papel));
  return primeiro ? valorDoPapel(primeiro[1], escritos?.[primeiro[0]]) : PAPEIS_DO_CLIENTE[0];
}
