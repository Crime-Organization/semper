// O papel do cliente escrito pela equipe no processo (#443): no "Papel do cliente", a última opção, "+ Escrever o nome do papel…",
// abre a janela de texto. O nome escrito é o papel 'outro' com um nome: fica guardado no processo (processos.papeis_escritos) e,
// porque a pessoa o escreveu agora, entra na lista do escritório, que aparece nos próximos cadastros. O nome copiado (o recurso
// que nasce do processo), devolvido (o Desfazer) ou escolhido da lista não entra de novo: o que o administrador tirou não volta
// sozinho. Um nome aparece uma vez só, sem contar maiúsculas, acentos e espaços repetidos (a mesma comparação do banco,
// privado.chave_do_papel, na migração papel_escrito). Tudo puro, sem tela nem banco.
import type { PapeisDosClientes, PapeisEscritos, PapelDaParte } from '../dados/tipos';
import { ehPapelDaParte, limparPapelEscrito, PAPEIS, PAPEIS_DA_PARTE, PAPEIS_DO_CLIENTE } from './processo';
import { normal } from './texto';

export { escritosAoGravar, limparPapelEscrito } from './processo';

/** O valor da última opção do select, que abre a janela de escrever (nenhum papel tem esse código). */
export const ESCREVER_PAPEL = '__escrever';
/** O nome da última opção do select (sem a palavra "outro", para não se confundir com o "Outro papel" da lista fixa). */
export const OPCAO_ESCREVER = '+ Escrever o nome do papel…';
/** O título da janela de escrever. */
export const ESCREVER_O_PAPEL = 'Escrever o nome do papel';
/** O título da janela quando o processo tem mais de um cliente: diz de quem é o papel. */
export const escreverOPapelDe = (cliente?: string | null) => cliente ? `${ESCREVER_O_PAPEL} de ${cliente}` : ESCREVER_O_PAPEL;
/** A nota da janela de escrever: um exemplo e o que acontece com o nome. */
export const NOTA_DA_ESCRITA = 'Ex.: Inventariante. O nome fica na lista do escritório para os próximos processos.';
/** O botão que confirma a janela (o processo ainda não é salvo aqui). */
export const USAR_ESTE_PAPEL = 'Usar este papel';
/** O nome do grupo do select com os papéis escritos do escritório (como o "Do escritório" dos tipos de vínculo). */
export const GRUPO_DO_ESCRITORIO = 'Do escritório';
/** Como o valor da opção marca um papel escrito ("escrito:Inventariante"). */
const PREFIXO_DO_ESCRITO = 'escrito:';

/** O que torna dois nomes o mesmo papel: sem maiúsculas, acentos e espaços repetidos. */
export const chaveDoPapel = (texto: string) => normal(limparPapelEscrito(texto));
/** O nome da lista que é o mesmo papel do texto, na grafia da lista; null quando não há. */
export const papelNaLista = (lista: readonly string[], texto: string) => lista.find(nome => chaveDoPapel(nome) === chaveDoPapel(texto)) ?? null;

/**
 * O papel escolhido: um da lista fixa ou, com o papel 'outro', o nome escrito. `escritoAgora` diz que a pessoa acabou de escrever o
 * nome na janela: só esse vai para a lista do escritório.
 */
export interface PapelEscolhido { papel: PapelDaParte; escrito?: string; escritoAgora?: true }

/**
 * O papel do texto que a pessoa escreveu: vazio, nenhum (null); igual ao nome de um papel fixo ("réu"), esse papel; igual a um da
 * lista do escritório, ele, na grafia da lista; senão, o texto limpo, como papel novo.
 */
export function papelDoTexto(texto: string, lista: readonly string[]): PapelEscolhido | null {
  const limpo = limparPapelEscrito(texto);
  if (!limpo) return null;
  const fixo = PAPEIS.find(x => chaveDoPapel(PAPEIS_DA_PARTE[x]) === chaveDoPapel(limpo));
  if (fixo) return { papel: fixo };
  return { papel: 'outro', escrito: papelNaLista(lista, limpo) ?? limpo, escritoAgora: true };
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
 * As opções do grupo "Do escritório": a lista do escritório e os nomes já escritos no próprio processo (os de outras linhas e o
 * atual, mesmo que tenha saído da lista: o processo continua com ele até alguém trocar). Cada nome uma vez, em ordem alfabética.
 */
export function opcoesDoPapel(lista: readonly string[], usados: readonly (string | null | undefined)[] = []): OpcaoDoPapel[] {
  const nomes: string[] = [];
  for (const nome of [...lista, ...usados]) if (nome && !papelNaLista(nomes, nome)) nomes.push(nome);
  return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR')).map(nome => ({ valor: valorDoPapel('outro', nome), nome }));
}

/**
 * Os nomes que vão para a lista do escritório depois de gravar o processo: os que a pessoa escreveu agora e que o processo gravado
 * ainda usa (escreveu e depois trocou: não vai), cada um uma vez.
 */
export function nomesParaALista(escritosAgora: readonly string[], gravados: PapeisEscritos): string[] {
  const usados = Object.values(gravados).filter((x): x is string => !!x);
  const nomes: string[] = [];
  for (const nome of escritosAgora) if (papelNaLista(usados, nome) && !papelNaLista(nomes, nome)) nomes.push(nome);
  return nomes;
}
/** O valor que a pergunta do papel já traz escolhido ao pôr um cliente pelo cartão: o do primeiro cliente com papel (veja papelSugeridoDoCliente). */
export function valorSugeridoDoCliente(papeis: PapeisDosClientes | undefined, escritos: PapeisEscritos | undefined): string {
  const primeiro = Object.entries(papeis ?? {}).find(([, papel]) => ehPapelDaParte(papel));
  return primeiro ? valorDoPapel(primeiro[1], escritos?.[primeiro[0]]) : PAPEIS_DO_CLIENTE[0];
}
