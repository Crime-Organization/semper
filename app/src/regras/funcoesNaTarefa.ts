// As funções dos participantes da tarefa (#313, decisão do dono): cada participante tem uma função que diz por que ele está na tarefa
// ("Executa": recebeu a tarefa para fazer). A lista é de cada escritório, editada nas Configurações por quem administra; de fábrica, só
// "Executa" (#421). O participante pode ficar sem função: ninguém ganha uma sozinho. A função é só um rótulo: não muda quem vê nem quem
// altera a tarefa. Tudo puro, sem tela nem banco; as mesmas contas do banco (supabase/migrations/20261122232702_tarefa_solicitante_e_funcoes.sql
// e 20261123233405_funcoes_so_executa_de_fabrica.sql).
import type { FuncaoNaTarefa } from '../dados/tipos';
import { TAMANHO_FUNCAO_NA_TAREFA } from '../dados/limites';
import { normal } from './texto';

/** As funções na ordem da lista (a ordem que o banco dá, a da criação). */
export const funcoesNaOrdem = (funcoes: readonly FuncaoNaTarefa[]) => funcoes.toSorted((a, b) => a.ordem - b.ordem);

/** O participante sem função, como as escolhas e o histórico o mostram (#421). */
export const SEM_FUNCAO = 'Sem função';

/**
 * As funções gravadas com os participantes (como o gatilho preparar_pedido): a escolhida de cada participante (sem ela, nenhuma: ninguém
 * ganha função sozinho, #421), e quem não é participante sai. A função que não existe no escritório é recusada; a de quem já estava não é
 * conferida de novo.
 */
export function funcoesAoGravar(participantes: readonly string[], escolhidas: Readonly<Record<string, string>>, funcoes: readonly FuncaoNaTarefa[],
  antes: Readonly<Record<string, string>> = {}): Record<string, string> {
  const r: Record<string, string> = {};
  for (const p of participantes) {
    const f = escolhidas[p];
    if (!f) continue;
    if (f !== antes[p] && !funcoes.some(x => x.id === f)) throw new Error(FUNCAO_DE_FORA);
    r[p] = f;
  }
  return r;
}

/** A lista que os filtros usam ("participante:função"), como a coluna participantes_com_funcao do banco. */
export const participantesComFuncao = (funcoes: Readonly<Record<string, string>>) =>
  Object.entries(funcoes).map(([p, f]) => `${p}:${f}`).sort();

/** A tarefa passa no filtro de função: `de` é participante com uma das funções pedidas. */
export const temAFuncao = (funcoesDaTarefa: Readonly<Record<string, string>> | undefined, filtro: { de: string; ids: readonly string[] }) =>
  !!funcoesDaTarefa && filtro.ids.includes(funcoesDaTarefa[filtro.de]);

/** A função de um participante, pelo nome e se é de execução (null: sem função, ou ela foi apagada). */
export const funcaoDe = (funcoes: readonly FuncaoNaTarefa[], funcoesDaTarefa: Readonly<Record<string, string>> | undefined, perfil: string) =>
  funcoes.find(f => f.id === funcoesDaTarefa?.[perfil]) ?? null;

// ---------- o filtro "Função" da lista de tarefas ----------
/** O valor do filtro que junta as funções de execução: "Delegadas a mim" (ou à pessoa escolhida no filtro de pessoa). */
export const FILTRO_DELEGADAS = 'delegadas';
/** As funções que o valor do filtro pede: as de execução, ou uma só. Vazio: sem filtro. */
export const idsDoFiltroDeFuncao = (valor: string, funcoes: readonly FuncaoNaTarefa[]): string[] =>
  !valor ? [] : valor === FILTRO_DELEGADAS ? funcoes.filter(f => f.executa).map(f => f.id) : [valor];
/**
 * As opções do filtro "Função": a função vale para a pessoa escolhida no filtro de pessoa ou, sem ela, para quem está logado.
 * `quem` é o nome de quem o filtro olha (null: quem está logado).
 */
export function opcoesDoFiltroDeFuncao(funcoes: readonly FuncaoNaTarefa[], quem: string | null): [string, string][] {
  const a = quem ? ` a ${quem}` : ' a mim';
  const como = quem ? `${quem} como` : 'Eu como';
  return [['', 'Qualquer função'], [FILTRO_DELEGADAS, `Delegadas${a}`], ...funcoesNaOrdem(funcoes).map(f => [f.id, `${como} "${f.nome}"`] as [string, string])];
}

// ---------- o cadastro das funções (Configurações) ----------
/** A recusa da função de outro escritório (a mesma do banco). */
export const FUNCAO_DE_FORA = 'Função não encontrada neste escritório.';
/** A recusa do nome repetido. */
export const FUNCAO_REPETIDA = 'Já existe uma função com este nome.';
/** A recusa de apagar a função em uso (a mesma do banco). */
export const funcaoEmUso = (nome: string, tarefas: number) =>
  `A função "${nome}" está em ${tarefas} ${tarefas === 1 ? 'tarefa' : 'tarefas'}. Troque a função dessas pessoas antes de apagá-la.`;

/** O formulário de uma função, como digitado. */
export interface FormDaFuncao { nome: string; executa: boolean }
export const FUNCAO_NOVA: FormDaFuncao = { nome: '', executa: false };
export const formDaFuncao = (f: FuncaoNaTarefa): FormDaFuncao => ({ nome: f.nome, executa: f.executa });
export const dadosDaFuncao = (f: FormDaFuncao) => ({ nome: f.nome.trim(), executa: f.executa });
/** O nome é repetido: maiúsculas e acentos não contam (como o índice do banco). `fora`: a função que está sendo mudada. */
export const nomeRepetido = (nome: string, funcoes: readonly FuncaoNaTarefa[], fora?: string) =>
  funcoes.some(f => f.id !== fora && normal(f.nome.trim()) === normal(nome.trim()));
/** Os erros do formulário, por campo (vazio: pode salvar). */
export function errosDaFuncao(f: FormDaFuncao, funcoes: readonly FuncaoNaTarefa[], fora?: string): Partial<Record<keyof FormDaFuncao, string>> {
  const nome = f.nome.trim();
  // As conferências do nome, na ordem: a primeira que falhar dá a mensagem.
  const conferencias: (() => string | null)[] = [
    () => nome ? null : 'Dê um nome à função.',
    () => nome.length > TAMANHO_FUNCAO_NA_TAREFA.nome ? `O nome pode ter até ${TAMANHO_FUNCAO_NA_TAREFA.nome} caracteres.` : null,
    () => nomeRepetido(nome, funcoes, fora) ? FUNCAO_REPETIDA : null
  ];
  const erro = conferencias.map(c => c()).find(Boolean);
  return erro ? { nome: erro } : {};
}

/**
 * As funções a gravar quando alguém entra na tarefa pelo "+" com a função escolhida (#313): as de agora e a dele. O banco confere a
 * função; quem ficou sem continua sem.
 */
export const comAFuncaoDeQuemEntra = (atuais: Readonly<Record<string, string>> | undefined, perfil: string, funcao: string): Record<string, string> =>
  ({ ...atuais, [perfil]: funcao });

/** As funções a gravar quando a de um participante é trocada no menu da bolinha: a nova, ou nenhuma (null: "Sem função", #421). */
export const comAFuncaoTrocada = (atuais: Readonly<Record<string, string>> | undefined, perfil: string, funcao: string | null): Record<string, string> =>
  Object.fromEntries([...Object.entries(atuais ?? {}).filter(([p]) => p !== perfil), ...(funcao ? [[perfil, funcao]] : [])]);

/** O aviso depois da troca no menu da bolinha: com o nome da função nova, ou sem função (null, #421). */
export const avisoDaFuncaoTrocada = (quem: string, funcao: string | null) =>
  funcao === null ? `${quem} agora sem função.` : `${quem} agora com a função "${funcao}".`;

/**
 * Para o histórico (como privado.funcoes_trocadas_no_historico): quem continua na tarefa (`ficaram`) e trocou de função, também de e
 * para nenhuma. Quem entrou ou saiu vem com os participantes.
 */
export const quemTrocouDeFuncao = (antes: Readonly<Record<string, string>>, depois: Readonly<Record<string, string>>, ficaram: readonly string[]) =>
  ficaram.filter(p => (antes[p] ?? null) !== (depois[p] ?? null));
