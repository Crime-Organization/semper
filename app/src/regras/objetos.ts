// Regras da lista de objetos de contrato nas Configurações (#281): conferir o nome corrigido, achar os parecidos para sugerir a
// junção, contar o uso e montar os avisos. Puras, sem tela nem banco. O banco confere o mesmo nome e dá as mesmas mensagens
// (supabase/migrations/20261122232558_editar_objetos_de_contrato.sql): mudou aqui, muda lá.
import type { ObjetoDoEscritorio, TrocaDeObjetos } from '../dados/tipos';
import { TAMANHO_CONTRATO } from '../dados/limites';
import { OBJETO_A_DEFINIR } from './contrato';
import { normal } from './texto';

// ---------- as mensagens (as mesmas do banco) ----------
export const OBJETO_SEM_NOME = 'Escreva o nome do objeto.';
export const OBJETO_LONGO = `O objeto pode ter até ${TAMANHO_CONTRATO.objeto} caracteres.`;
export const OBJETO_RESERVADO = `"${OBJETO_A_DEFINIR}" não pode ser o nome de um objeto.`;
export const OBJETO_REPETIDO = 'Já existe um objeto com esse nome. Para unir os dois, marque-os e use Juntar.';
export const JUNTAR_SO_UM = 'Marque ao menos dois objetos para juntar.';
/** O "A definir" antigo que tenha ficado na lista: mudá-lo trocaria o "A definir" de todos os contratos do escritório. */
export const OBJETO_A_DEFINIR_FIXO = `"${OBJETO_A_DEFINIR}" não pode ser corrigido, juntado nem apagado.`;

/** Quantos contratos, por extenso: "1 contrato", "3 contratos". */
export const quantosContratos = (n: number) => `${n} ${n === 1 ? 'contrato' : 'contratos'}`;
/** Quantas demandas, por extenso: "1 demanda", "3 demandas". */
export const quantasDemandas = (n: number) => `${n} ${n === 1 ? 'demanda' : 'demandas'}`;

/** O aviso de quem tenta apagar um objeto em uso: em quantos contratos ele está e o que fazer (o banco recusa com o mesmo texto). */
export const avisoDoObjetoEmUso = (contratos: number) =>
  `Este objeto está em ${quantosContratos(contratos)}. Troque-o por outro antes de apagar: marque os dois e use Juntar.`;

// ---------- o uso ----------
/** Em quantos contratos o objeto está, ativos e arquivados. */
export const contratosDoObjeto = (o: Pick<ObjetoDoEscritorio, 'contratos_ativos' | 'contratos_arquivados'>) => o.contratos_ativos + o.contratos_arquivados;
/** Os contratos do objeto como a tabela mostra: "3", ou "3 + 1 arquivado" quando há arquivados. */
export const textoDosContratos = (o: Pick<ObjetoDoEscritorio, 'contratos_ativos' | 'contratos_arquivados'>) =>
  o.contratos_arquivados ? `${o.contratos_ativos} + ${o.contratos_arquivados} ${o.contratos_arquivados === 1 ? 'arquivado' : 'arquivados'}` : String(o.contratos_ativos);
/** O objeto que nenhum contrato usa (o único que pode ser apagado). */
export const semUso = (o: Pick<ObjetoDoEscritorio, 'contratos_ativos' | 'contratos_arquivados'>) => contratosDoObjeto(o) === 0;

// ---------- o nome corrigido ----------
type NaLista = Pick<ObjetoDoEscritorio, 'id' | 'descricao'>;
type ConferenciaDoNome = (nome: string, objetos: readonly NaLista[], id?: string) => string | null;
/** As regras do nome, na ordem (a primeira que falhar dá a mensagem). Regra nova = entrada nova aqui. */
const CONFERENCIAS_DO_NOME: ConferenciaDoNome[] = [
  nome => nome.trim() ? null : OBJETO_SEM_NOME,
  nome => nome.trim().length > TAMANHO_CONTRATO.objeto ? OBJETO_LONGO : null,
  nome => normal(nome) === normal(OBJETO_A_DEFINIR) ? OBJETO_RESERVADO : null,
  // Como o banco: maiúsculas, acentos e espaços nas pontas não contam.
  (nome, objetos, id) => objetos.some(o => o.id !== id && normal(o.descricao) === normal(nome)) ? OBJETO_REPETIDO : null
];
/** O erro do nome corrigido (null: pode salvar). `id`: o objeto sendo corrigido, que não conta como repetido. */
export const erroDoNomeDoObjeto = (nome: string, objetos: readonly NaLista[], id?: string) =>
  CONFERENCIAS_DO_NOME.map(r => r(nome, objetos, id)).find(Boolean) ?? null;

// ---------- busca e parecidos ----------
/** Os objetos cujo nome contém o termo (sem acento nem maiúscula fazer diferença). Sem termo, todos. */
export const objetosNaBusca = (objetos: readonly ObjetoDoEscritorio[], termo: string) => {
  const t = normal(termo);
  return t ? objetos.filter(o => normal(o.descricao).includes(t)) : [...objetos];
};

/** Palavras pequenas que não mudam o objeto ("Registro de marca" e "Registro da marca" são o mesmo). */
const PALAVRAS_DE_LIGACAO = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'p']);
/**
 * A chave que aproxima nomes escritos de jeitos diferentes: sem acento, pontuação, palavras de ligação e o "s" do plural.
 * "Registro da marca." e "registros de marcas" dão a mesma chave.
 */
export const chaveParecida = (nome: string) => normal(nome)
  .replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(p => p && !PALAVRAS_DE_LIGACAO.has(p))
  .map(p => p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p)
  .join(' ');
/** Para cada objeto que tem parecidos na lista, os nomes deles (para sugerir juntar). Quem não tem parecido não aparece. */
export function parecidos(objetos: readonly ObjetoDoEscritorio[]): Map<string, string[]> {
  const porChave = new Map<string, ObjetoDoEscritorio[]>();
  objetos.forEach(o => {
    const chave = chaveParecida(o.descricao);
    if (chave) porChave.set(chave, [...porChave.get(chave) ?? [], o]);
  });
  const r = new Map<string, string[]>();
  porChave.forEach(grupo => {
    if (grupo.length > 1) grupo.forEach(o => r.set(o.id, grupo.filter(x => x.id !== o.id).map(x => x.descricao)));
  });
  return r;
}

// ---------- juntar ----------
/** O objeto que fica, por padrão, entre os marcados: o mais usado (no empate, o primeiro da lista). */
export const quemFica = (marcados: readonly ObjetoDoEscritorio[]) =>
  marcados.reduce<ObjetoDoEscritorio | null>((melhor, o) => !melhor || contratosDoObjeto(o) > contratosDoObjeto(melhor) ? o : melhor, null);
/** O que a junção vai mexer, antes de confirmar: os contratos e as demandas dos que saem. */
export function alcanceDaJuncao(marcados: readonly ObjetoDoEscritorio[], fica: string) {
  const saem = marcados.filter(o => o.id !== fica);
  const [quais, usados, passam] = saem.length === 1 ? ['Sai 1 objeto', 'usado', 'Ele passa'] : [`Saem ${saem.length} objetos`, 'usados', 'Eles passam'];
  return `${quais}, ${usados} em ${quantosContratos(saem.reduce((n, o) => n + contratosDoObjeto(o), 0))} `
    + `e ${quantasDemandas(saem.reduce((n, o) => n + o.demandas, 0))}. ${passam} a ter o nome do que fica. Não dá para desfazer.`;
}

// ---------- o aviso do que mudou ----------
/** O que o administrador fez, no aviso do pé da tela. */
export type TrocaFeita = 'corrigir' | 'juntar';
const INICIO_DO_AVISO: Record<TrocaFeita, (nome: string) => string> = {
  corrigir: nome => `Objeto corrigido: "${nome}".`,
  juntar: nome => `Objetos juntados em "${nome}".`
};
/**
 * O aviso depois de corrigir ou juntar: em quantos contratos e demandas o nome mudou e, se for o caso, o modelo de lista e os
 * contratos que ficaram com duas demandas do mesmo objeto (para a pessoa conferir).
 */
export function avisoDaTroca(acao: TrocaFeita, nome: string, r: TrocaDeObjetos) {
  const partes = [INICIO_DO_AVISO[acao](nome), `Mudou em ${quantosContratos(r.contratos)} e ${quantasDemandas(r.demandas)}.`];
  if (r.modelos) partes.push('O modelo de lista mudou junto.');
  if (r.contratos_com_duas_demandas) {
    partes.push(`${r.contratos_com_duas_demandas === 1 ? '1 contrato ficou' : `${r.contratos_com_duas_demandas} contratos ficaram`} com duas demandas do mesmo objeto: confira.`);
  }
  return partes.join(' ');
}
