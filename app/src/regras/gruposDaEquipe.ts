// Grupos da equipe (#378): regras puras de quem está num grupo, o que se mostra de cada grupo e o aviso antes de excluir.
// As regras de quem vê e altera cada item ficam no banco (supabase/migrations/20261119233811_grupos_da_equipe.sql); estas são as
// mesmas, para a tela saber o que mostrar e para o banco fictício se comportar igual.
import { GRUPOS_POR_ITEM } from '../dados/limites';
import type { GrupoDaEquipe, ItensDoGrupo, Membro, ModuloDoPedido } from '../dados/tipos';
import { normal } from './texto';

/** Nomes por extenso, como se fala: "A, B e C" (como nomesPorExtenso, em regras/contrato.ts, sem depender dele). */
const porExtenso = (nomes: string[]) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(nomes);

/** O valor do filtro "Grupo da equipe" que junta os grupos de quem está logado ("Dos meus grupos"). */
export const FILTRO_DOS_MEUS_GRUPOS = 'meus';
/** Até quantos nomes a dica de um grupo mostra; os outros viram "e mais N". */
export const INTEGRANTES_NA_DICA = 5;

/** Os grupos em que a pessoa está (como privado.meus_grupos, para quem está logado). */
export const meusGrupos = (grupos: readonly GrupoDaEquipe[] | undefined, perfilId: string) =>
  (grupos ?? []).filter(g => g.integrantes.includes(perfilId)).map(g => g.id);

/** A pessoa está num dos grupos do item? Item sem grupo, nunca. */
export const estaPeloGrupo = (doItem: readonly string[] | undefined, meus: readonly string[]) =>
  !!doItem?.length && doItem.some(id => meus.includes(id));

/** Quem participa pelo grupo: os integrantes ativos, sem a conta reservada e sem quem foi excluído (como privado.integrantes_dos_grupos). */
export const integrantesAtivos = (grupo: Pick<GrupoDaEquipe, 'integrantes'>, equipe: readonly Membro[]) =>
  equipe.filter(m => grupo.integrantes.includes(m.id) && m.ativo !== false && !m.reservada && !m.excluido);

/** "1 pessoa", "4 pessoas". */
export const quantasPessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
const pessoas = quantasPessoas;

/** O nome do grupo com quantas pessoas participam por ele: "Núcleo A · 4 pessoas". */
export const textoDoGrupo = (grupo: GrupoDaEquipe, equipe: readonly Membro[]) => `${grupo.nome} · ${pessoas(integrantesAtivos(grupo, equipe).length)}`;

/**
 * A dica do grupo, com os nomes de quem participa por ele: "Núcleo A · 4 pessoas: Ana, Beto, Caio e Davi". Passando de
 * INTEGRANTES_NA_DICA, os primeiros e "e mais N". Sem ninguém: "Núcleo A · ninguém ainda".
 */
export function dicaDosIntegrantes(grupo: GrupoDaEquipe, equipe: readonly Membro[]) {
  const nomes = integrantesAtivos(grupo, equipe).map(m => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (!nomes.length) return `${grupo.nome} · ninguém ainda`;
  const lista = nomes.length > INTEGRANTES_NA_DICA
    ? `${nomes.slice(0, INTEGRANTES_NA_DICA).join(', ')} e mais ${nomes.length - INTEGRANTES_NA_DICA}`
    : porExtenso(nomes);
  return `${grupo.nome} · ${pessoas(nomes.length)}: ${lista}`;
}

/**
 * Os grupos que ainda podem entrar no item, pelo termo digitado (sem acento nem maiúsculas): os que ainda não estão nele, até o
 * limite de grupos por item (cheio, nenhum).
 */
export function candidatosDeGrupo(grupos: readonly GrupoDaEquipe[] | undefined, termo: string, jaNoItem: readonly string[], limite = GRUPOS_POR_ITEM) {
  if (jaNoItem.length >= limite) return [];
  const t = normal(termo);
  return (grupos ?? []).filter(g => !jaNoItem.includes(g.id) && normal(g.nome).includes(t));
}

/** O filtro "Grupo da equipe" em ids: 'meus' são os grupos de quem está logado; um id, ele mesmo; vazio, nenhum filtro (null). */
export const gruposDoFiltro = (filtro: string | undefined, meus: readonly string[]) =>
  !filtro ? null : filtro === FILTRO_DOS_MEUS_GRUPOS ? [...meus] : [filtro];

/** O filtro guardado só vale se o grupo ainda existe (ou é "Dos meus grupos"); senão volta a "Todos os grupos" (undefined). */
export const filtroQueVale = (filtro: string | undefined, grupos: readonly GrupoDaEquipe[] | undefined) =>
  filtro && (filtro === FILTRO_DOS_MEUS_GRUPOS || (grupos ?? []).some(g => g.id === filtro)) ? filtro : undefined;

/** O nome de cada módulo, no singular e no plural, para contar os itens do grupo. */
const NOME_DO_MODULO: Record<ModuloDoPedido, [string, string]> = {
  demandas: ['demanda', 'demandas'],
  tarefas: ['tarefa', 'tarefas'],
  processos: ['processo', 'processos'],
  compromissos: ['compromisso', 'compromissos'],
  contratos: ['contrato', 'contratos'],
  anotacoes: ['documento', 'documentos']
};
/** "5 demandas e 1 tarefa": os itens de cada módulo, na ordem em que vieram. */
export const itensPorModulo = (contagem: readonly ItensDoGrupo[]) =>
  porExtenso(contagem.filter(c => c.quantos > 0).map(c => `${c.quantos} ${NOME_DO_MODULO[c.modulo][c.quantos === 1 ? 0 : 1]}`));

/** O título da pergunta antes de excluir o grupo. */
export const tituloDaExclusao = (nome: string) => `Excluir o grupo ${nome}?`;
/** O corpo da pergunta antes de excluir o grupo (avisoDaExclusao sem o título), para a janela de confirmação. */
export const corpoDaExclusao = (nome: string, contagem: readonly ItensDoGrupo[]) => avisoDaExclusao(nome, contagem).slice(tituloDaExclusao(nome).length + 1);
/** Onde o grupo está, na linha da tabela e no painel dele: "5 demandas e 1 tarefa", ou "Nenhum item". */
export const ondeOGrupoEsta = (contagem: readonly ItensDoGrupo[]) => contagem.some(c => c.quantos > 0) ? itensPorModulo(contagem) : 'Nenhum item';
/** Quando a contagem dos itens do grupo não veio (rede, permissão): a tabela e o painel dizem isso, em vez de esperar para sempre. */
export const NAO_FOI_POSSIVEL_CONTAR = 'Não foi possível contar os itens.';
/** A contagem no painel do grupo: ainda contando (null), não veio ('falhou') ou quantos itens, contando os arquivados. */
export const notaDaContagem = (contagem: readonly ItensDoGrupo[] | null | 'falhou') =>
  contagem === 'falhou' ? NAO_FOI_POSSIVEL_CONTAR : contagem ? `${ondeOGrupoEsta(contagem)}, contando os arquivados.` : 'Contando os itens…';

/** A pergunta antes de excluir o grupo, com em quantos itens ele está (contando os arquivados). */
export function avisoDaExclusao(nome: string, contagem: readonly ItensDoGrupo[]) {
  const total = contagem.reduce((s, c) => s + c.quantos, 0);
  const onde = total
    ? `Ele está em ${total} ${total === 1 ? 'item' : 'itens'}, contando os arquivados (${itensPorModulo(contagem)}). Quem participa só pelo grupo deixa de ver ${total === 1 ? 'esse item' : 'esses itens'}.`
    : 'Ele não está em nenhum item.';
  return `${tituloDaExclusao(nome)} ${onde} As pessoas continuam na equipe. Não dá para desfazer.`;
}

// ---------- os grupos na tela (#378) ----------
/** Quantas pílulas de grupo cabem no topo do cartão; as outras viram "+N grupos", que abre a mesma lista. */
export const PILULAS_NO_TOPO = 3;
/** Quantas pílulas de grupo cabem no cartão do quadro e na linha da tabela; as outras viram "+N". */
export const PILULAS_NO_QUADRO = 2;
/** A recusa de pôr mais um grupo num item cheio (a mesma frase do banco). */
export const GRUPOS_DEMAIS = `Um item pode ter até ${GRUPOS_POR_ITEM} grupos.`;
/** O que a dica da pílula acrescenta quando quem está logado está no grupo. */
export const ESTOU_NESTE_GRUPO = 'Você está neste grupo';

/** Os grupos do item, na ordem em que foram postos, como estão no escritório (o que foi excluído não aparece). */
export const gruposDoItem = (doEscritorio: readonly GrupoDaEquipe[] | undefined, doItem: readonly string[] | undefined) =>
  (doItem ?? []).flatMap(id => (doEscritorio ?? []).filter(g => g.id === id));

/** O que a pílula mostra: o nome e quantas pessoas participam pelo grupo ("Núcleo A · 4"). */
export const numeroDoGrupo = (grupo: Pick<GrupoDaEquipe, 'integrantes'>, equipe: readonly Membro[]) => integrantesAtivos(grupo, equipe).length;

/** O nome do grupo para o leitor de tela, com quantas pessoas: "Grupo Núcleo A, 4 pessoas". */
export const nomeDoGrupo = (grupo: GrupoDaEquipe, equipe: readonly Membro[]) => `Grupo ${grupo.nome}, ${pessoas(numeroDoGrupo(grupo, equipe))}`;

/** A dica da pílula: os integrantes e, se quem está logado é um deles, "Você está neste grupo". */
export const dicaDaPilula = (grupo: GrupoDaEquipe, equipe: readonly Membro[], eu: string) =>
  dicaDosIntegrantes(grupo, equipe) + (grupo.integrantes.includes(eu) ? `. ${ESTOU_NESTE_GRUPO}` : '');

/** O texto do "+N grupos" do topo do cartão e o "+N" do quadro. */
export const maisGrupos = (n: number) => `+${n} ${n === 1 ? 'grupo' : 'grupos'}`;

/** O que pôr e tirar um grupo do item faz: o que gravar, ou o aviso de por que nada se grava. */
export type MudancaNosGrupos = { gravar: string[] } | { aviso: string; tipo: 'info' | 'erro' };
export type TipoDeMudancaNosGrupos = 'porGrupo' | 'tirarGrupo';
/** Cada mudança sobre os grupos gravados agora (`atual`). Tipo novo = entrada nova. `noItem`: "na demanda". */
export const MUDANCAS_NOS_GRUPOS: Record<TipoDeMudancaNosGrupos, (atual: readonly string[], grupo: { id: string; nome: string }, noItem: string) => MudancaNosGrupos> = {
  porGrupo: (atual, g, noItem) => atual.includes(g.id) ? { aviso: `O grupo ${g.nome} já estava ${noItem}.`, tipo: 'info' }
    : atual.length >= GRUPOS_POR_ITEM ? { aviso: GRUPOS_DEMAIS, tipo: 'erro' } : { gravar: [...atual, g.id] },
  tirarGrupo: (atual, g, noItem) => atual.includes(g.id) ? { gravar: atual.filter(x => x !== g.id) }
    : { aviso: `O grupo ${g.nome} já não estava ${noItem}.`, tipo: 'info' }
};
/** O aviso de cada mudança gravada: "Grupo Núcleo A posto na demanda." */
export const AVISO_DOS_GRUPOS: Record<TipoDeMudancaNosGrupos, (nome: string, noItem: string, doItem: string) => string> = {
  porGrupo: (nome, noItem) => `Grupo ${nome} posto ${noItem}.`,
  tirarGrupo: (nome, _noItem, doItem) => `Grupo ${nome} tirado ${doItem}.`
};
/**
 * O que o Desfazer grava, sobre os grupos lidos de novo: volta só o que esta mudança fez (pôr: tira o grupo, se ainda está; tirar:
 * põe de volta no fim, se ainda não voltou e cabe). null quando não há o que voltar.
 */
export function desfazerNosGrupos(tipo: TipoDeMudancaNosGrupos, atual: readonly string[], grupoId: string): string[] | { aviso: string } | null {
  const DESFAZER: Record<TipoDeMudancaNosGrupos, () => string[] | { aviso: string } | null> = {
    porGrupo: () => atual.includes(grupoId) ? atual.filter(x => x !== grupoId) : null,
    tirarGrupo: () => atual.includes(grupoId) ? null : atual.length >= GRUPOS_POR_ITEM ? { aviso: GRUPOS_DEMAIS } : [...atual, grupoId]
  };
  return DESFAZER[tipo]();
}

/** Como a pessoa está no cartão, para saber se ela continua nele sem um grupo. */
export interface QuemEstaNoCartao {
  eu: string;
  responsavel_id: string | null;
  lista: readonly string[];
  /** Os grupos do item. */
  grupos: readonly string[];
  /** Os grupos de quem está logado. */
  meus: readonly string[];
  /** O banco a deixa gravar fora do cartão (administradora, quem criou, a fase de adaptação): ela não sai. */
  podeSair: boolean;
  /** Ela continua vendo o cartão pelo item ligado (a demanda da tarefa, o processo do compromisso). */
  peloLigado?: boolean;
}
/** Tirar este grupo deixaria a pessoa fora do cartão? Só quando ele é o único caminho dela até o item (aí a tela não oferece o "Tirar"). */
export const saiComOGrupo = (q: QuemEstaNoCartao, grupoId: string) =>
  !q.podeSair && !q.peloLigado && q.responsavel_id !== q.eu && !q.lista.includes(q.eu) && q.meus.includes(grupoId)
  && !q.grupos.some(g => g !== grupoId && q.meus.includes(g));

/** A pessoa está no cartão só por grupos (não é a responsável nem está na lista)? O primeiro desses grupos; senão, null. */
export const soPeloGrupo = (q: Pick<QuemEstaNoCartao, 'eu' | 'responsavel_id' | 'lista' | 'meus'>, grupos: readonly GrupoDaEquipe[]) =>
  q.responsavel_id === q.eu || q.lista.includes(q.eu) ? null : grupos.find(g => q.meus.includes(g.id)) ?? null;

/**
 * Como sai do cartão quem está nele só por um grupo (#274): ele não está na lista, então não se tira dela. Quem altera o item (outra
 * pessoa do cartão) tira o grupo do cartão, e com ele saem todos do grupo; um administrador tira a pessoa do grupo.
 */
export const COMO_SAIR_PELO_GRUPO = 'Para sair, peça a outra pessoa do cartão que tire o grupo dele (saem todos do grupo) ou a um administrador que tire você do grupo.';
/** A nota de quem está no cartão só pelo grupo: não sai sozinho (a mesma ideia da recusa de public.cartao_sair). */
export const notaDeQuemEstaPeloGrupo = (nome: string) => `Você participa deste cartão pelo grupo ${nome}. ${COMO_SAIR_PELO_GRUPO}`;
/**
 * A recusa de sair do cartão (public.cartao_sair) a quem está nele só pelo grupo `nome`. O banco ainda manda pedir só a um
 * administrador, e a tela troca pelo texto daqui (dados/erros.ts); o banco fictício já dá este.
 */
export const recusaDeSairPeloGrupo = (nome: string) => `Você está neste cartão pelo grupo ${nome}. ${COMO_SAIR_PELO_GRUPO}`;
/**
 * A nota do grupo no topo do cartão: só para quem está no cartão só por grupos, está neste grupo e de fato não sai sozinho. Quem grava
 * fora do cartão (administradora, quem criou, a fase de adaptação) ou continua nele pelo item ligado tira o grupo pelo botão: a nota
 * mandaria pedir a um administrador o que ela mesma faz.
 */
export const notaDoGrupoNoTopo = (q: Omit<QuemEstaNoCartao, 'grupos'>, grupo: GrupoDaEquipe, doItem: readonly GrupoDaEquipe[]) =>
  !q.podeSair && !q.peloLigado && grupo.integrantes.includes(q.eu) && soPeloGrupo(q, doItem) ? notaDeQuemEstaPeloGrupo(grupo.nome) : null;
/**
 * Por que a pessoa não tira o grupo que é o único caminho dela até o cartão: ela deixaria de participar (e o banco recusa, porque ela
 * deixaria de ver o item). Como sair do cartão, quem está só pelo grupo pede a outra pessoa do cartão ou a um administrador.
 */
export const SAIRIA_SEM_O_GRUPO = `Sem este grupo, você deixaria de participar deste cartão. ${COMO_SAIR_PELO_GRUPO}`;
/** O que o contrato diz a quem está nele só pelo grupo: participa sem os valores (decisão do dono, 19/11). */
export const peloGrupoSemOsValores = (nome: string) =>
  `Você participa deste contrato pelo grupo ${nome}: vê e edita, menos os valores, o responsável, os participantes e os grupos.`;
/** A linha do lápis com os grupos do item, só para ver: "Grupos: Núcleo A e Núcleo B (mude no topo do cartão)". */
export const linhaDosGruposNoLapis = (nomes: readonly string[]) => nomes.length ? `Grupos: ${porExtenso([...nomes])} (mude no topo do cartão)` : null;
/** O nome do grupo no quadro e na tabela, para o leitor de tela, com quem está: "Grupo Núcleo A · 2 pessoas: Ana e Beto". */
export const rotuloDoGrupoNoQuadro = (grupo: GrupoDaEquipe, equipe: readonly Membro[]) => `Grupo ${dicaDosIntegrantes(grupo, equipe)}`;

/** O parâmetro do endereço que abre Demandas e Tarefas filtradas num grupo (o link da mensagem de quem entrou no grupo). */
export const PARAMETRO_DO_GRUPO = 'grupo';
/** Os dois links da mensagem de quem entrou no grupo: as demandas e as tarefas dele. */
export const linksDoGrupo = (grupoId: string) => [
  { texto: 'Ver as demandas do grupo', para: `/demandas/?${new URLSearchParams({ [PARAMETRO_DO_GRUPO]: grupoId })}` },
  { texto: 'Ver as tarefas do grupo', para: `/tarefas/?${new URLSearchParams({ [PARAMETRO_DO_GRUPO]: grupoId })}` }
];
/** A mensagem de quem entrou no grupo: uma só, sem número (o número ficaria velho logo). */
export const textoDaMensagemDeGrupo = (quem: string, grupo: string) => ({
  titulo: `${quem} incluiu você no grupo ${grupo}.`, trecho: 'Você passa a participar dos itens dele.'
});
