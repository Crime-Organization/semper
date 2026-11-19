// Regras da anotação (módulo Documentos, #303): os módulos a que ela se liga, o nome e o endereço de cada item ligado, e quem
// vê e quem altera. Tudo puro, sem tela nem banco. As regras do banco são as mesmas (supabase/migrations/…_anotacoes.sql);
// o banco fictício (dados/falso.ts) usa estas funções para se comportar igual.
import type { Anotacao, AnotacaoParaLigar, Compromisso, Contrato, DadosAnotacao, Demanda, ItemDaAnotacao, ItemParaLigar, Membro, ModuloDaAnotacao, Pessoa, Processo, Tarefa } from '../dados/tipos';
import { ITENS_DA_ANOTACAO, TAMANHO_ANOTACAO } from '../dados/limites';
import { TIPOS_COMPROMISSO } from './compromisso';
import { clientesPorExtenso } from './contrato';
import { ativoNaEquipe } from './equipe';
import { fmtData } from './pessoa';
import { equipeVeTudo } from './equipeVeTudo';
import { TIPOS_PROCESSO } from './processo';
import { gravaForaDoCartao, pessoasAoGravar, type CartaoAntes } from './sairDoCartao';

/**
 * O que cada módulo ligado tem de próprio. "rotulo" e "plural": como a tela fala do item. "endereco": o começo do endereço do
 * cartão do item, que termina com o id (o processo vai para a página do tipo dele: use enderecoDoItem). "parametro": o nome
 * do parâmetro no cadastro de anotação (/documentos/nova/?demanda=<id>), que diz a que item a anotação nova fica ligada.
 */
export const ITEM_DA_ANOTACAO: Record<ModuloDaAnotacao, { rotulo: string; plural: string; endereco: string; parametro: string }> = {
  pessoas: { rotulo: 'Pessoa', plural: 'Pessoas', endereco: '/pessoas/?id=', parametro: 'pessoa' },
  processos: { rotulo: 'Processo', plural: 'Processos', endereco: TIPOS_PROCESSO.judicial.caminho + '?id=', parametro: 'processo' },
  contratos: { rotulo: 'Contrato', plural: 'Contratos', endereco: '/contratos/?id=', parametro: 'contrato' },
  demandas: { rotulo: 'Demanda', plural: 'Demandas', endereco: '/demandas/?id=', parametro: 'demanda' },
  tarefas: { rotulo: 'Tarefa', plural: 'Tarefas', endereco: '/tarefas/?id=', parametro: 'tarefa' },
  compromissos: { rotulo: 'Compromisso', plural: 'Compromissos', endereco: '/agenda/?id=', parametro: 'compromisso' }
};
/** Os módulos na ordem da tabela acima (a ordem dos filtros e da escolha do módulo ao ligar). */
export const MODULOS_DA_ANOTACAO = Object.keys(ITEM_DA_ANOTACAO) as ModuloDaAnotacao[];

/** O endereço do cartão do item: o processo abre na página do tipo dele (judicial ou administrativo). */
export const enderecoDoItem = (i: Pick<ItemDaAnotacao, 'modulo' | 'id' | 'tipo'>) =>
  i.modulo === 'processos' && i.tipo ? `${TIPOS_PROCESSO[i.tipo].caminho}?id=${i.id}` : ITEM_DA_ANOTACAO[i.modulo].endereco + i.id;

/** O que cada módulo precisa trazer para dar o nome do item. */
export interface ParaNomearOItem {
  pessoas: Pick<Pessoa, 'nome'>;
  processos: Pick<Processo, 'numero' | 'titulo' | 'cliente_nome'>;
  contratos: Pick<Contrato, 'servico'>;
  demandas: Pick<Demanda, 'titulo'>;
  tarefas: Pick<Tarefa, 'titulo'>;
  compromissos: Pick<Compromisso, 'titulo' | 'tipo' | 'data'>;
}
/**
 * O nome do item ligado, como aparece no cartão da anotação. Pessoa: o nome. Processo: o número; sem ele, o título (e, sem os
 * dois, os clientes). Contrato: o serviço, como nos outros cartões. Demanda e tarefa: o título. Compromisso: o título; sem ele,
 * o tipo e a data.
 */
export const NOME_DO_ITEM: { [M in ModuloDaAnotacao]: (x: ParaNomearOItem[M]) => string } = {
  pessoas: x => x.nome,
  processos: x => x.numero || x.titulo || clientesPorExtenso(x.cliente_nome),
  contratos: x => x.servico,
  demandas: x => x.titulo,
  tarefas: x => x.titulo,
  compromissos: x => x.titulo || `${TIPOS_COMPROMISSO[x.tipo].nome} · ${fmtData(x.data)}`
};
/** O item como aparece no cartão da anotação, a partir da linha lida do módulo dele. */
export function itemDaAnotacao<M extends ModuloDaAnotacao>(modulo: M,
  x: ParaNomearOItem[M] & { id: string; codigo: string; arquivado_em?: string | null; tipo?: unknown }): ItemDaAnotacao {
  const nome = (NOME_DO_ITEM[modulo] as (y: ParaNomearOItem[M]) => string)(x);
  const tipo = modulo === 'processos' ? { tipo: (x as unknown as Pick<Processo, 'tipo'>).tipo } : {};
  return { modulo, id: x.id, codigo: x.codigo, nome, arquivado_em: x.arquivado_em ?? null, ...tipo };
}

/** Os módulos ligados como o banco guarda em ligada_a: em ordem alfabética e sem repetir. */
export const modulosLigados = (modulos: ModuloDaAnotacao[]) => [...new Set(modulos)].sort() as ModuloDaAnotacao[];

/**
 * Se ver o item ligado abre a anotação. A pessoa não abre: todo o escritório vê todas as pessoas, e isso tornaria pública
 * qualquer anotação sobre um cliente.
 */
export const ABRE_A_ANOTACAO: Record<ModuloDaAnotacao, boolean> = {
  pessoas: false, processos: true, contratos: true, demandas: true, tarefas: true, compromissos: true
};

// ---------- quem vê e quem altera ----------
type QuemEstaNaAnotacao = Pick<Anotacao, 'criado_por' | 'responsavel_id' | 'participantes'>;
/** As chaves do escritório que abrem os cartões para toda a equipe. */
export interface ChavesDaEquipe { equipeVeTudo: boolean; equipeEditaTudo: boolean }
const ehAdministrador = (m: Pick<Membro, 'papel'>) => m.papel === 'master' || m.papel === 'admin';
/**
 * Quem altera a anotação (texto, título, responsável, participantes, ligações, arquivar), como a regra do banco: os
 * administradores, toda a equipe com "equipe_edita_tudo", quem criou, o responsável e os participantes.
 */
export const alteraAAnotacao = (a: QuemEstaNaAnotacao, m: Pick<Membro, 'id' | 'papel'>, chaves: Pick<ChavesDaEquipe, 'equipeEditaTudo'>) =>
  ehAdministrador(m) || chaves.equipeEditaTudo || m.id === a.criado_por || m.id === a.responsavel_id || a.participantes.includes(m.id);
/**
 * Quem vê a anotação, como a regra do banco: quem a altera, toda a equipe com "equipe_ve_tudo", e quem vê algum item ligado a
 * ela que a abre (veja ABRE_A_ANOTACAO). Quem a vê só pelo item ligado só lê.
 */
export const veAAnotacao = (a: QuemEstaNaAnotacao, m: Pick<Membro, 'id' | 'papel'>, chaves: ChavesDaEquipe, vejoUmItemQueAbre = false) =>
  alteraAAnotacao(a, m, chaves) || chaves.equipeVeTudo || vejoUmItemQueAbre;
/**
 * Por que o membro não pode ser mencionado nos comentários da anotação (null se pode), como o gatilho privado.mencao_na_anotacao:
 * só quem a vê sem depender de um item ligado (quem a altera, ou toda a equipe com uma das chaves). Quem a vê só por um item ligado
 * fica de fora: nem o banco nem a tela sabem o que outra pessoa vê nos outros módulos.
 */
export const motivoSemMencaoNaAnotacao = (a: QuemEstaNaAnotacao, chaves: ChavesDaEquipe) =>
  (m: Pick<Membro, 'id' | 'papel'>) => veAAnotacao(a, m, chaves) ? null : 'não participa; inclua como participante';
/** A mensagem de quando alguém que não pode ser mencionado aparece num comentário da anotação (a mesma do banco). */
export const mencaoNegadaNaAnotacao = (nome: string) => `Não é possível mencionar ${nome} nesta anotação: inclua essa pessoa como participante antes.`;
/** Ligar e desligar itens: quem altera, e só com a anotação ativa (a arquivada fica como está). */
export const ligaNaAnotacao = (a: QuemEstaNaAnotacao & Pick<Anotacao, 'arquivado_em'>, m: Pick<Membro, 'id' | 'papel'>, chaves: Pick<ChavesDaEquipe, 'equipeEditaTudo'>) =>
  !a.arquivado_em && alteraAAnotacao(a, m, chaves);
/** Excluir de vez: só a anotação arquivada, por quem criou ou por um administrador (o padrão de todos os módulos). */
export const excluiAAnotacao = (a: Pick<Anotacao, 'criado_por' | 'arquivado_em'>, m: Pick<Membro, 'id' | 'papel'>) =>
  !!a.arquivado_em && (ehAdministrador(m) || m.id === a.criado_por);

// ---------- ligar, no cartão de um item, uma anotação que já existe (#341) ----------
/** Por que a anotação não aceita mais um item ('' = aceita): a cheia já está ligada a ITENS_DA_ANOTACAO, o máximo do banco. */
export const motivoDeNaoLigarAAnotacao = (a: Pick<AnotacaoParaLigar, 'itens'>) =>
  a.itens >= ITENS_DA_ANOTACAO ? `Já está ligada a ${ITENS_DA_ANOTACAO} itens, o máximo.` : '';
/**
 * O aviso embaixo da busca, no cartão de cada tipo de item: quem passa a ler a anotação ligada a ele (as regras de
 * privado.anotacoes_pelos_itens). A pessoa não abre a anotação (ABRE_A_ANOTACAO): nada a avisar.
 */
export const QUEM_PASSA_A_LER: Record<ModuloDaAnotacao, string> = {
  pessoas: '',
  processos: 'Quem vê este processo passa a ler a anotação que você ligar.',
  contratos: 'Quem vê este contrato passa a ler a anotação que você ligar, inclusive quem foi mencionado nele.',
  demandas: 'Quem vê esta demanda passa a ler a anotação que você ligar, inclusive quem está no contrato dela.',
  tarefas: 'Quem vê esta tarefa passa a ler a anotação que você ligar, inclusive quem está na demanda e no contrato dela.',
  compromissos: 'Quem vê este compromisso passa a ler a anotação que você ligar. Se ele está na Agenda geral, é todo o escritório.'
};

// ---------- o filtro "Data" da página Documentos ----------
/** Quanto cada período volta a partir de hoje. */
const DIAS_DA_SEMANA = 7, DIAS_DO_MES = 30, MESES_DO_ANO = 12;
/** Os períodos do filtro "Data" ('' = qualquer data). */
export type PeriodoDaAnotacao = '' | 'semana' | 'mes' | 'ano';
export const PERIODOS_DA_ANOTACAO: Record<PeriodoDaAnotacao, { rotulo: string; volta: { dias: number; meses: number } | null }> = {
  '': { rotulo: 'Qualquer data', volta: null },
  semana: { rotulo: `Últimos ${DIAS_DA_SEMANA} dias`, volta: { dias: DIAS_DA_SEMANA, meses: 0 } },
  mes: { rotulo: `Últimos ${DIAS_DO_MES} dias`, volta: { dias: DIAS_DO_MES, meses: 0 } },
  ano: { rotulo: `Últimos ${MESES_DO_ANO} meses`, volta: { dias: 0, meses: MESES_DO_ANO } }
};
/** O primeiro dia do período (AAAA-MM-DD), contado a partir de hoje (AAAA-MM-DD); sem período, nenhum. */
export function desdeDoPeriodo(periodo: PeriodoDaAnotacao, hoje: string): string | undefined {
  const volta = PERIODOS_DA_ANOTACAO[periodo].volta;
  if (!volta) return undefined;
  const [ano, mes, dia] = hoje.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1 - volta.meses, dia - volta.dias)).toISOString().slice(0, 10);
}

// ---------- o cadastro ----------
/** A dica dentro da caixa do texto vazia: o Markdown que se pode escrever (a barra de botões faz o mesmo). */
export const DICA_DO_TEXTO = 'Escreva aqui. # título, - lista, - [ ] tarefa, **negrito**, [link](https://…)';
/** Os campos do cadastro de anotação, como a tela os guarda. */
export interface CamposAnotacao { titulo: string; texto: string; responsavelId: string; participantes: string[] }
type CampoConferido = 'titulo' | 'texto' | 'responsavelId';
/** O que o título confere ('' = está certo): não fica vazio e cabe no banco. Vale no cadastro e na edição no próprio título (#339). */
export const erroDoTitulo = (titulo: string) => !titulo.trim() ? 'Dê um título à anotação.'
  : titulo.length > TAMANHO_ANOTACAO.titulo ? `O título pode ter até ${TAMANHO_ANOTACAO.titulo} caracteres.` : '';
/** O que o texto confere ('' = está certo): cabe no banco. Pode ficar vazio. */
export const erroDoTexto = (texto: string) =>
  texto.length > TAMANHO_ANOTACAO.texto ? `O texto pode ter até ${TAMANHO_ANOTACAO.texto.toLocaleString('pt-BR')} caracteres.` : '';
/** O que cada campo confere ('' = está certo). Os tamanhos são os do banco. */
export const VALIDACAO_DA_ANOTACAO: Record<CampoConferido, (c: CamposAnotacao) => string> = {
  titulo: c => erroDoTitulo(c.titulo),
  texto: c => erroDoTexto(c.texto),
  responsavelId: c => c.responsavelId ? '' : 'Escolha o responsável.'
};
/** Os erros do cadastro, só dos campos errados. */
export const errosDaAnotacao = (c: CamposAnotacao): Partial<Record<CampoConferido, string>> =>
  Object.fromEntries((Object.keys(VALIDACAO_DA_ANOTACAO) as CampoConferido[]).map(k => [k, VALIDACAO_DA_ANOTACAO[k](c)]).filter(([, erro]) => erro));
/** O que o cadastro grava: o título sem os espaços das pontas, e o responsável fora dos participantes. */
export const dadosDaAnotacao = (c: CamposAnotacao) => ({
  titulo: c.titulo.trim(), texto: c.texto, responsavel_id: c.responsavelId, participantes: c.participantes.filter(p => p !== c.responsavelId)
});
/** Os campos do cadastro a partir de uma anotação gravada (para editar). */
export const camposDaAnotacao = (a: Pick<Anotacao, 'titulo' | 'texto' | 'responsavel_id' | 'participantes'>): CamposAnotacao => ({
  titulo: a.titulo, texto: a.texto, responsavelId: a.responsavel_id, participantes: a.participantes
});

// ---------- a equipe da anotação (o lápis do cartão, desde a #339) ----------
/** Os campos da equipe: quem responde pela anotação e com quem ela é compartilhada. */
export type CamposDaEquipe = Pick<CamposAnotacao, 'responsavelId' | 'participantes'>;
/** O erro da equipe ('' = está certa): só o responsável é obrigatório. */
export const erroDaEquipe = (c: CamposDaEquipe) => c.responsavelId ? '' : 'Escolha o responsável.';
/** O que a edição da equipe grava: só o responsável e os participantes (sem ele), nunca o título e o texto. */
export const dadosDaEquipe = (c: CamposDaEquipe) => ({
  responsavel_id: c.responsavelId, participantes: c.participantes.filter(p => p !== c.responsavelId)
});
/** Os campos da equipe a partir de uma anotação gravada. */
export const equipeDaAnotacao = (a: Pick<Anotacao, 'responsavel_id' | 'participantes'>): CamposDaEquipe => ({
  responsavelId: a.responsavel_id, participantes: a.participantes
});

// ---------- a edição no próprio cartão (#339) ----------
/** O que está aberto para editar no cartão: o título, o texto e a equipe (null ou ausente: fechado). */
export interface RascunhosDaAnotacao { titulo?: string | null; texto?: string | null; equipe?: CamposDaEquipe | null }
/**
 * Há edição por salvar no cartão? Só quando algum rascunho aberto ficou diferente do que está gravado: abrir e não mudar nada
 * não conta (o título, sem os espaços das pontas, como ele é gravado; a equipe, como a edição a gravaria).
 */
export function edicaoPorSalvar(a: Pick<Anotacao, 'titulo' | 'texto' | 'responsavel_id' | 'participantes'>, r: RascunhosDaAnotacao) {
  const equipe = (c: CamposDaEquipe) => JSON.stringify(dadosDaEquipe(c));
  return (r.titulo != null && r.titulo.trim() !== a.titulo.trim())
    || (r.texto != null && r.texto !== a.texto)
    || (r.equipe != null && equipe(r.equipe) !== equipe(equipeDaAnotacao(a)));
}

// ---------- os itens escolhidos antes de salvar (#339) ----------
/** O mesmo item: o mesmo módulo e o mesmo id. */
export const mesmoItem = (a: ItemParaLigar, b: ItemParaLigar) => a.modulo === b.modulo && a.id === b.id;
/**
 * A lista dos itens escolhidos para a anotação nova, com mais um: ele entra no fim (a ordem em que a anotação nasce ligada);
 * o que já está na lista não se repete, e a lista não passa de ITENS_DA_ANOTACAO (o máximo do banco).
 */
export function comMaisUmItem<I extends ItemParaLigar>(lista: I[], item: I): I[] {
  return lista.some(i => mesmoItem(i, item)) || lista.length >= ITENS_DA_ANOTACAO ? lista : [...lista, item];
}
/** A lista dos itens escolhidos sem este. */
export const semOItem = <I extends ItemParaLigar>(lista: I[], item: ItemParaLigar) => lista.filter(i => !mesmoItem(i, item));
/** O que a anotação nova manda ligar ao banco: o módulo e o id de cada item escolhido, na ordem. */
export const ligacoesDaAnotacaoNova = (itens: ItemParaLigar[]): ItemParaLigar[] => itens.map(({ modulo, id }) => ({ modulo, id }));

/**
 * O banco aceita a gravação que deixa a pessoa fora da anotação? Aceita para quem continua a vê-la sem estar nela: o administrador,
 * quem a criou e, com qualquer das chaves da equipe, todos (a regra de leitura das anotações abre com as duas). Quem só a vê por um
 * item ligado não altera, então não chega a gravar.
 */
export const gravaForaDaAnotacao = (ctx: Parameters<typeof gravaForaDoCartao>[0], criou: boolean) => gravaForaDoCartao(ctx, criou) || equipeVeTudo(ctx.escritorio);

/**
 * Quem não pode gravar fora da anotação deixaria de vê-la ao se tirar dos participantes ou passá-la a outra pessoa, e o banco recusa
 * essa gravação. Por isso esta gravação ainda a mantém como participante, e a saída vem depois, por SD.cartaoSair (padrão da #276).
 */
export function semSairDaAnotacao<D extends DadosAnotacao>(d: D, eu: string, podeSair: boolean, antes: CartaoAntes): { dados: D; ficou: boolean } {
  const participantes = d.participantes ?? [];
  const r = pessoasAoGravar(participantes, d.responsavel_id, eu, antes, podeSair);
  return { dados: r.lista === participantes ? d : { ...d, participantes: r.lista }, ficou: r.ficou };
}

// ---------- a cópia (#343) ----------
/** O que vai no fim do título da cópia. */
export const SUFIXO_DA_COPIA = ' (cópia)';
/** Separa o texto no que a pessoa vê como um caractere só: letra com acento, emoji, bandeira, emoji de família, tom de pele. */
const GRAFEMAS = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
/**
 * O título da cópia: o da original com " (cópia)" no fim. Se não couber no tamanho do banco, a original é cortada antes do
 * sufixo, sem partir nenhum caractere ao meio (nem emoji, bandeira ou emoji de família) e sem deixar espaço antes dele.
 */
export function tituloDaCopia(titulo: string) {
  const cabe = TAMANHO_ANOTACAO.titulo - SUFIXO_DA_COPIA.length;
  let base = '';
  for (const { segment } of GRAFEMAS.segment(titulo.trim())) {
    if (base.length + segment.length > cabe) break;
    base += segment;
  }
  return base.trimEnd() + SUFIXO_DA_COPIA;
}
/** Quem duplica: quem é, o que pode na anotação original e a equipe do escritório. */
export interface QuemCopia {
  id: string;
  /** Altera a original (veja alteraAAnotacao): aí escolhe o responsável, e a cópia fica com o mesmo. */
  alteraAOriginal: boolean;
  /** A equipe do escritório: só quem está ativo nela (veja ativoNaEquipe) vai como responsável ou participante da cópia. */
  equipe: Pick<Membro, 'id' | 'ativo' | 'excluido'>[];
}
/**
 * O que a cópia grava, num lugar só: o título com " (cópia)", o mesmo texto, o mesmo responsável e os mesmos participantes.
 * A cópia é de quem a faz (ela é a autora). Quem só lê a original não escolhe o responsável dela: a cópia fica com ela mesma.
 * Responsável ou participante que saiu da equipe não vai para a cópia (no lugar do responsável, fica quem copia). As ligações
 * são copiadas pelo banco (SD.anotacaoDuplicar), e as etiquetas também (#342). A cópia fica na mesma pasta da original (#342).
 */
export function dadosDaCopia(a: Pick<Anotacao, 'titulo' | 'texto' | 'responsavel_id' | 'participantes' | 'pasta_id'>, quem: QuemCopia) {
  const ativo = (id: string) => quem.equipe.some(m => m.id === id && ativoNaEquipe(m));
  const responsavel_id = quem.alteraAOriginal && ativo(a.responsavel_id) ? a.responsavel_id : quem.id;
  return {
    titulo: tituloDaCopia(a.titulo), texto: a.texto, responsavel_id,
    participantes: a.participantes.filter(p => p !== responsavel_id && ativo(p)),
    pasta_id: a.pasta_id ?? null
  };
}

/** Por que a lista da página Documentos está vazia: cada motivo tem a mensagem dele (#342). */
export type MotivoDaListaVazia = 'filtrada' | 'arquivadas' | 'pasta' | 'nenhuma';
/** A situação da lista: com filtros, a das arquivadas, mostrando uma pasta. */
export interface SituacaoDaLista { filtrada: boolean; arquivadas: boolean; pasta: boolean }
/** Os motivos na ordem em que valem: o primeiro que vale explica a lista vazia; sem nenhum, ainda não há anotação. */
const ORDEM_DOS_MOTIVOS: (keyof SituacaoDaLista)[] = ['filtrada', 'arquivadas', 'pasta'];
export const motivoDaListaVazia = (s: SituacaoDaLista): MotivoDaListaVazia => ORDEM_DOS_MOTIVOS.find(m => s[m]) ?? 'nenhuma';
