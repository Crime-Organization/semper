// Andamentos e prazos de um processo: o que cada tipo pede, a conferência dos formulários, a situação de cada prazo e a
// tarefa que nasce de uma intimação ou de um prazo. Tudo puro, sem tela nem banco. As datas são "aaaa-mm-dd".
// A contagem dos dias em si está em regras/prazos.ts; os dias sem expediente de cada órgão, em regras/calendario.ts.
import type { AndamentoDeProcesso, CategoriaDeAndamento, DadosAndamento, DadosPrazo, DadosTarefa, MudancaNoAndamento, Processo, PrazoDeProcesso, TipoDeAndamento } from '../dados/tipos';
import { ANOS_DO_CALENDARIO, TAMANHO_ANDAMENTO, TAMANHO_PRAZO, TAMANHO_TAREFA } from '../dados/limites';
import { anoAceito, dataExiste } from './calendario';
import { fmtData } from './pessoa';
import { CONTAGEM_PADRAO, erroDoPrazo, type Contagem } from './prazos';
import { nomeDoProcesso } from './processo';

// ---------- andamentos ----------
/** Cada tipo de andamento: o nome na tela, como a data se chama e se tem hora e local. Tipo novo = uma entrada nova. */
export const TIPOS_DE_ANDAMENTO: Record<TipoDeAndamento, { nome: string; lancado: string; rotuloData: string; marcado: boolean }> = {
  andamento: { nome: 'Andamento', lancado: 'Andamento lançado.', rotuloData: 'Data', marcado: false },
  intimacao: { nome: 'Intimação', lancado: 'Intimação lançada.', rotuloData: 'Data da intimação', marcado: false },
  audiencia: { nome: 'Audiência', lancado: 'Audiência lançada.', rotuloData: 'Data da audiência', marcado: true },
  pericia: { nome: 'Perícia', lancado: 'Perícia lançada.', rotuloData: 'Data da perícia', marcado: true }
};

/**
 * A lista pronta dos tipos de andamento (#362, decisão do dono: a mesma para todos os escritórios), na ordem da tela: o nome, o
 * aviso de quando é lançado e o tipo de sempre com que cada um combina (é ele que diz se o andamento fica "a tratar" ou tem hora e
 * local). Tipo novo = uma entrada nova aqui e o valor novo na regra processo_andamentos_categoria_da_lista do banco
 * (supabase/migrations/20261119103649_andamentos_tipo_e_comentarios_de_processos.sql), onde também está o par que combina.
 */
export const CATEGORIAS_DE_ANDAMENTO: Record<CategoriaDeAndamento, { nome: string; lancado: string; tipo: TipoDeAndamento }> = {
  despacho: { nome: 'Despacho', lancado: 'Despacho lançado.', tipo: 'andamento' },
  decisao: { nome: 'Decisão', lancado: 'Decisão lançada.', tipo: 'andamento' },
  sentenca: { nome: 'Sentença', lancado: 'Sentença lançada.', tipo: 'andamento' },
  intimacao: { nome: 'Intimação', lancado: 'Intimação lançada.', tipo: 'intimacao' },
  peticao: { nome: 'Petição', lancado: 'Petição lançada.', tipo: 'andamento' },
  audiencia: { nome: 'Audiência', lancado: 'Audiência lançada.', tipo: 'audiencia' }
};

/**
 * O que a lista "Tipo" do formulário pode mostrar: os seis da lista pronta e, só ao mudar um andamento de antes que não tem tipo da
 * lista, o tipo de sempre que ele já tem (a perícia ou o andamento comum), para ele não mudar sem querer. Quem lança um andamento
 * novo escolhe sempre um dos seis (decisão do dono). Cada escolha diz o que vai para o banco.
 */
export type EscolhaDoTipo = CategoriaDeAndamento | TipoDeAndamento;
interface Escolha { nome: string; lancado: string; tipo: TipoDeAndamento; categoria: CategoriaDeAndamento | null }
const comoEscolha = (categoria: CategoriaDeAndamento): Escolha => ({ ...CATEGORIAS_DE_ANDAMENTO[categoria], categoria });
const deAntes = (tipo: Extract<TipoDeAndamento, 'pericia' | 'andamento'>): Escolha => ({ nome: TIPOS_DE_ANDAMENTO[tipo].nome, lancado: TIPOS_DE_ANDAMENTO[tipo].lancado, tipo, categoria: null });
export const ESCOLHAS_DO_TIPO: Record<EscolhaDoTipo, Escolha> = {
  despacho: comoEscolha('despacho'), decisao: comoEscolha('decisao'), sentenca: comoEscolha('sentenca'),
  intimacao: comoEscolha('intimacao'), peticao: comoEscolha('peticao'), audiencia: comoEscolha('audiencia'),
  pericia: deAntes('pericia'), andamento: deAntes('andamento')
};
/** A lista pronta, na ordem da tela: é o que o formulário oferece a quem lança um andamento. */
export const LISTA_PRONTA_DE_ANDAMENTOS = Object.keys(CATEGORIAS_DE_ANDAMENTO) as CategoriaDeAndamento[];
/** O que a lista "Tipo" oferece: a lista pronta e, ao mudar um andamento de antes, o tipo que ele já tem, se não estiver nela. */
export const escolhasDoFormulario = (f: Pick<FormDoAndamento, 'tipoDeAntes'>): EscolhaDoTipo[] =>
  f.tipoDeAntes && !(LISTA_PRONTA_DE_ANDAMENTOS as EscolhaDoTipo[]).includes(f.tipoDeAntes) ? [...LISTA_PRONTA_DE_ANDAMENTOS, f.tipoDeAntes] : LISTA_PRONTA_DE_ANDAMENTOS;
/**
 * A escolha que o formulário mostra: o tipo da lista, quando há; senão, o tipo de sempre do andamento de antes que está sendo
 * mudado. O andamento novo começa sem escolha (null), e a pessoa precisa escolher.
 */
export const escolhaDoTipo = (f: Pick<FormDoAndamento, 'categoria' | 'tipoDeAntes'>): EscolhaDoTipo | null => f.categoria ?? f.tipoDeAntes;
/** O par que a escolha grava: o tipo de sempre e o da lista. */
export const tipoDaEscolha = (e: EscolhaDoTipo): Pick<FormDoAndamento, 'tipo' | 'categoria'> => ({ tipo: ESCOLHAS_DO_TIPO[e].tipo, categoria: ESCOLHAS_DO_TIPO[e].categoria });
/** O nome na caixa do andamento: o tipo da lista, quando há; senão, o tipo de sempre (os andamentos de antes continuam iguais). */
export const nomeDoAndamento = (a: Pick<AndamentoDeProcesso, 'tipo' | 'categoria'>) =>
  a.categoria ? CATEGORIAS_DE_ANDAMENTO[a.categoria].nome : TIPOS_DE_ANDAMENTO[a.tipo].nome;
/** O aviso de quando o andamento é lançado, com o mesmo nome da caixa. */
export const avisoDoLancamento = (f: Pick<FormDoAndamento, 'tipo' | 'categoria'>) =>
  f.categoria ? CATEGORIAS_DE_ANDAMENTO[f.categoria].lancado : TIPOS_DE_ANDAMENTO[f.tipo].lancado;

/**
 * O que a pessoa preenche no formulário do andamento. tipoDeAntes é o tipo de sempre do andamento de antes, sem tipo da lista, que
 * está sendo mudado (é o que a lista "Tipo" mostra para ele); no andamento novo e nos que têm tipo da lista, é null.
 */
export interface FormDoAndamento {
  tipo: TipoDeAndamento; categoria: CategoriaDeAndamento | null; tipoDeAntes: TipoDeAndamento | null; data: string; hora: string; local: string; texto: string;
}
export const andamentoNovo = (hoje: string): FormDoAndamento => ({ tipo: 'andamento', categoria: null, tipoDeAntes: null, data: hoje, hora: '', local: '', texto: '' });
export const formDoAndamento = (a: AndamentoDeProcesso): FormDoAndamento =>
  ({ tipo: a.tipo, categoria: a.categoria, tipoDeAntes: a.categoria ? null : a.tipo, data: a.data, hora: a.hora ?? '', local: a.local ?? '', texto: a.texto });

/** Data que o banco aceita: existe e está nos anos do calendário. */
const dataBoa = (iso: string) => dataExiste(iso) && anoAceito(iso);

export function errosDoAndamento(f: FormDoAndamento): Partial<Record<keyof FormDoAndamento, string>> {
  const erros: Partial<Record<keyof FormDoAndamento, string>> = {};
  if (!escolhaDoTipo(f)) erros.tipo = 'Escolha o tipo do andamento.';
  if (!dataBoa(f.data)) erros.data = 'Informe uma data válida.';
  if (!f.texto.trim()) erros.texto = 'Escreva o que aconteceu.';
  else if (f.texto.trim().length > TAMANHO_ANDAMENTO.texto) erros.texto = `Use até ${TAMANHO_ANDAMENTO.texto} caracteres.`;
  if (TIPOS_DE_ANDAMENTO[f.tipo].marcado && f.local.trim().length > TAMANHO_ANDAMENTO.local) erros.local = `Use até ${TAMANHO_ANDAMENTO.local} caracteres.`;
  return erros;
}

/** O que vai para o banco. Hora e local só valem em audiência e perícia. */
export function dadosDoAndamento(f: FormDoAndamento): DadosAndamento {
  const marcado = TIPOS_DE_ANDAMENTO[f.tipo].marcado;
  return { tipo: f.tipo, categoria: f.categoria, data: f.data, hora: marcado && f.hora ? f.hora : null, local: marcado && f.local.trim() ? f.local.trim() : null, texto: f.texto.trim() };
}

/** Se o tipo da lista combina com o tipo de sempre (como a regra processo_andamentos_categoria_do_tipo do banco). Sem tipo da lista, sempre. */
export const categoriaCombina = (a: Pick<AndamentoDeProcesso, 'tipo' | 'categoria'>) => !a.categoria || CATEGORIAS_DE_ANDAMENTO[a.categoria].tipo === a.tipo;
/**
 * O andamento depois de uma mudança, como o gatilho acertar_categoria do banco: quem muda só o tipo de sempre (a versão anterior
 * do site, que não conhece o tipo da lista) deixa sem tipo da lista o andamento cujo tipo da lista não combina mais.
 */
export function comCategoriaAcertada<A extends Pick<AndamentoDeProcesso, 'tipo' | 'categoria'>>(antes: A, mudanca: Partial<NoInfer<A>>): A {
  const novo = { ...antes, ...mudanca };
  const soOTipo = mudanca.tipo !== undefined && mudanca.tipo !== antes.tipo && mudanca.categoria === undefined;
  return soOTipo && !categoriaCombina(novo) ? { ...novo, categoria: null } : novo;
}

/** O que muda ao salvar a edição: quem deixa de ser intimação deixa de estar "tratada" (o banco não aceita as duas coisas). */
export const mudancaDoAndamento = (f: FormDoAndamento): MudancaNoAndamento =>
  ({ ...dadosDoAndamento(f), ...(f.tipo === 'intimacao' ? {} : { tratada_em: null }) });

/** Intimação que ainda não virou tarefa nem foi marcada como sem tarefa. */
export const aTratar = (a: Pick<AndamentoDeProcesso, 'tipo' | 'tratada_em' | 'tarefa_id'>) => a.tipo === 'intimacao' && !a.tratada_em && !a.tarefa_id;

/** Os mais novos primeiro: pela data e, no mesmo dia, por quando foi lançado. */
export const porDataDoAndamento = (a: Pick<AndamentoDeProcesso, 'data' | 'criado_em'>, b: Pick<AndamentoDeProcesso, 'data' | 'criado_em'>) =>
  b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em);

/** Quando o andamento acontece, em palavras: "10/11/2026 às 14:30 em Fórum". */
export const quandoDoAndamento = (a: Pick<AndamentoDeProcesso, 'data' | 'hora' | 'local'>) =>
  fmtData(a.data) + (a.hora ? ` às ${a.hora}` : '') + (a.local ? ` em ${a.local}` : '');

/** Quantos caracteres do texto da intimação entram no título da tarefa. */
const TEXTO_NO_TITULO = 120;
/**
 * A linha do andamento no histórico do processo (igual à função privado.linha_do_andamento do banco, a de sete argumentos, de
 * 20261119103649_andamentos_tipo_e_comentarios_de_processos.sql): começa pelo tipo da lista, quando há.
 */
export const linhaDoAndamento = (a: Pick<AndamentoDeProcesso, 'tipo' | 'categoria' | 'data' | 'hora' | 'local' | 'texto' | 'tratada_em'>) =>
  `${nomeDoAndamento(a)} de ${quandoDoAndamento(a)}: ${a.texto}${a.tratada_em ? ' (tratada)' : ''}`;

// ---------- prazos ----------
/** Como a data do prazo é definida: calculada pelo calendário ou digitada à mão. */
export type ModoDoPrazo = 'calcular' | 'digitar';
export const MODOS_DO_PRAZO: Record<ModoDoPrazo, string> = { calcular: 'Calcular pelo calendário', digitar: 'Digitar a data' };
/** Quantos dias o prazo tem quando o formulário abre (o prazo mais comum do CPC, art. 1.003, § 5º). */
export const DIAS_INICIAIS_DO_PRAZO = 15;

/** O que a pessoa preenche no formulário do prazo. */
export interface FormDoPrazo {
  descricao: string; modo: ModoDoPrazo; intimacao: string; dias: string; contagem: Contagem;
  disponibilizacao: boolean; semRecesso: boolean; final: string; andamentoId: string | null;
}
/** O prazo novo: a contagem vem do órgão do processo, e a data, da intimação de que ele nasce. */
export const prazoNovo = (hoje: string, contagem: Contagem = CONTAGEM_PADRAO, intimacao?: Pick<AndamentoDeProcesso, 'id' | 'data'>): FormDoPrazo => ({
  descricao: '', modo: 'calcular', intimacao: intimacao?.data ?? hoje, dias: String(DIAS_INICIAIS_DO_PRAZO), contagem,
  disponibilizacao: false, semRecesso: false, final: '', andamentoId: intimacao?.id ?? null
});
export const formDoPrazo = (p: PrazoDeProcesso, hoje: string, contagemDoOrgao: Contagem = CONTAGEM_PADRAO): FormDoPrazo => ({
  descricao: p.descricao, modo: p.dias === null ? 'digitar' : 'calcular', intimacao: p.intimacao ?? hoje, dias: String(p.dias ?? DIAS_INICIAIS_DO_PRAZO),
  contagem: p.contagem ?? contagemDoOrgao, disponibilizacao: p.disponibilizacao, semRecesso: p.sem_recesso, final: p.final, andamentoId: p.andamento_id
});

/** finalCalculado: o último dia que a contagem deu, quando ela já terminou. */
export function errosDoPrazo(f: FormDoPrazo, finalCalculado: string | null): Partial<Record<'descricao' | 'final' | 'calculo', string>> {
  const erros: Partial<Record<'descricao' | 'final' | 'calculo', string>> = {};
  if (!f.descricao.trim()) erros.descricao = 'Diga que prazo é este (ex.: Contestação).';
  else if (f.descricao.trim().length > TAMANHO_PRAZO.descricao) erros.descricao = `Use até ${TAMANHO_PRAZO.descricao} caracteres.`;
  if (f.modo === 'digitar') {
    if (!dataBoa(f.final)) erros.final = 'Informe uma data válida.';
    return erros;
  }
  const erro = erroDoPrazo({ intimacao: f.intimacao, dias: Number(f.dias) });
  if (erro) erros.calculo = erro;
  else if (!anoAceito(f.intimacao)) erros.calculo = 'Informe uma data válida.';
  else if (!finalCalculado) erros.calculo = 'Espere o cálculo terminar ou digite a data.';
  else if (!anoAceito(finalCalculado)) erros.calculo = `O último dia precisa ser até ${ANOS_DO_CALENDARIO.ate}.`;
  return erros;
}

/** O que vai para o banco. Digitado à mão, o prazo não guarda cálculo nenhum. */
export function dadosDoPrazo(f: FormDoPrazo, finalCalculado: string | null): DadosPrazo {
  const comum = { descricao: f.descricao.trim(), andamento_id: f.andamentoId };
  return f.modo === 'digitar'
    ? { ...comum, final: f.final, intimacao: null, dias: null, contagem: null, disponibilizacao: false, sem_recesso: false }
    : { ...comum, final: finalCalculado!, intimacao: f.intimacao, dias: Number(f.dias), contagem: f.contagem, disponibilizacao: f.disponibilizacao, sem_recesso: f.semRecesso };
}

/** Quantos dias antes do fim o prazo aparece como próximo (os "próximos 15 dias" do painel de Processos, #292). */
export const DIAS_DE_PRAZO_PROXIMO = 15;
export type SituacaoDoPrazoNoProcesso = 'cumprido' | 'vencido' | 'hoje' | 'proximo' | 'em_dia';
/** A cor do selo de cada situação (os tipos de Selo em ui/base). */
export const SELO_DO_PRAZO: Record<SituacaoDoPrazoNoProcesso, 'ok' | 'erro' | 'pend' | 'arq'> = { cumprido: 'ok', vencido: 'erro', hoje: 'erro', proximo: 'pend', em_dia: 'arq' };

/** Um dia, em milissegundos (as datas são contadas em UTC: o dia tem sempre 24 horas). */
const UM_DIA = 24 * 60 * 60 * 1000;
export const diasAte = (de: string, ate: string) => {
  const dia = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((dia(ate) - dia(de)) / UM_DIA);
};
export function situacaoDoPrazoNoProcesso(p: Pick<PrazoDeProcesso, 'final' | 'concluido_em'>, hoje: string): SituacaoDoPrazoNoProcesso {
  if (p.concluido_em) return 'cumprido';
  if (p.final < hoje) return 'vencido';
  if (p.final === hoje) return 'hoje';
  return diasAte(hoje, p.final) <= DIAS_DE_PRAZO_PROXIMO ? 'proximo' : 'em_dia';
}
const emDias = (n: number) => n === 1 ? '1 dia' : `${n} dias`;
const faltam = (d: number) => `${d === 1 ? 'Falta' : 'Faltam'} ${emDias(d)}`;
/** O texto do selo de cada situação. */
const ROTULOS: Record<SituacaoDoPrazoNoProcesso, (dias: number) => string> = {
  cumprido: () => 'Cumprido',
  vencido: d => `Vencido há ${emDias(-d)}`,
  hoje: () => 'Vence hoje',
  proximo: faltam,
  em_dia: faltam
};
export const rotuloDoPrazo = (p: Pick<PrazoDeProcesso, 'final' | 'concluido_em'>, hoje: string) =>
  ROTULOS[situacaoDoPrazoNoProcesso(p, hoje)](diasAte(hoje, p.final));

/** Cada contagem no singular e no plural. */
const NOME_DA_CONTAGEM: Record<Contagem, [string, string]> = { corridos: ['corrido', 'corridos'], uteis: ['útil', 'úteis'] };
/** Como o prazo foi definido, em palavras: "15 dias úteis desde 10/11/2026" ou "Data digitada". */
export function comoFoiContado(p: Pick<PrazoDeProcesso, 'dias' | 'contagem' | 'intimacao'>) {
  if (p.dias === null || !p.contagem || !p.intimacao) return 'Data digitada';
  return `${emDias(p.dias)} ${NOME_DA_CONTAGEM[p.contagem][p.dias === 1 ? 0 : 1]} desde ${fmtData(p.intimacao)}`;
}

/** Os abertos primeiro, do que vence antes ao que vence depois; depois os cumpridos, dos mais novos aos mais antigos. */
export function naOrdemDosPrazos<P extends Pick<PrazoDeProcesso, 'final' | 'concluido_em'>>(prazos: P[]): P[] {
  const abertos = prazos.filter(p => !p.concluido_em).toSorted((a, b) => a.final.localeCompare(b.final));
  const cumpridos = prazos.filter(p => p.concluido_em).toSorted((a, b) => b.final.localeCompare(a.final));
  return [...abertos, ...cumpridos];
}

/** O alerta no alto do cartão: os prazos vencidos e os que vencem hoje, ou null se não há nenhum. */
export function alertaDosPrazos(prazos: Pick<PrazoDeProcesso, 'final' | 'concluido_em'>[], hoje: string): string | null {
  const conta = (s: SituacaoDoPrazoNoProcesso) => prazos.filter(p => situacaoDoPrazoNoProcesso(p, hoje) === s).length;
  const vencidos = conta('vencido'), deHoje = conta('hoje');
  const partes = [
    vencidos && (vencidos === 1 ? '1 prazo vencido' : `${vencidos} prazos vencidos`),
    deHoje && (deHoje === 1 ? '1 prazo que vence hoje' : `${deHoje} prazos que vencem hoje`)
  ].filter(Boolean);
  return partes.length ? `Este processo tem ${partes.join(' e ')}.` : null;
}

/** A linha do prazo no histórico do processo (igual à função privado.linha_do_prazo do banco). */
export const linhaDoPrazo = (p: Pick<PrazoDeProcesso, 'descricao' | 'final' | 'dias' | 'contagem' | 'intimacao' | 'concluido_em'>) =>
  `${p.descricao}: ${fmtData(p.final)}${p.dias === null ? '' : ` (${comoFoiContado(p)})`}${p.concluido_em ? ' (cumprido)' : ''}`;

/** Os nomes dessas linhas no histórico de alterações do cartão. */
export const CAMPOS_NO_HISTORICO: Record<string, string> = { andamento: 'Andamento', prazo: 'Prazo' };

// ---------- a tarefa que nasce ----------
type ProcessoDaTarefa = Pick<Processo, 'id' | 'numero' | 'titulo' | 'cliente_nome' | 'responsavel_id' | 'colaboradores'> & { clientes: { id: string }[] };

/** Quem pode receber a tarefa: quem cria e quem da equipe está ativo. */
export interface QuemRecebe { eu: string; ativos: string[] }
/** Ligada ao processo, com os clientes dele. O responsável é o do processo; se ele não está mais ativo, quem está criando.
 *  Os participantes são os colaboradores ainda ativos. */
const tarefaLigada = (p: ProcessoDaTarefa, { eu, ativos }: QuemRecebe, titulo: string, detalhe: string, prazo: string | null): DadosTarefa => ({
  titulo: titulo.slice(0, TAMANHO_TAREFA.titulo),
  descricao: `Processo ${p.numero} (${nomeDoProcesso(p)})\n\n${detalhe}`.slice(0, TAMANHO_TAREFA.descricao),
  prazo,
  responsavel_id: ativos.includes(p.responsavel_id) ? p.responsavel_id : eu,
  participantes: p.colaboradores.filter(id => ativos.includes(id)),
  pessoas: p.clientes.map(c => c.id),
  processo_id: p.id
});

/** A tarefa de cumprir uma intimação. */
export const tarefaDaIntimacao = (p: ProcessoDaTarefa, a: Pick<AndamentoDeProcesso, 'data' | 'texto'>, quem: QuemRecebe) =>
  tarefaLigada(p, quem, `Intimação: ${a.texto.slice(0, TEXTO_NO_TITULO)}`, `Intimação de ${fmtData(a.data)}:\n${a.texto}`, null);

/** A tarefa de cumprir um prazo: o prazo da tarefa é o último dia dele (a data fica só no campo, que acompanha o prazo). */
export const tarefaDoPrazo = (p: ProcessoDaTarefa, z: Pick<PrazoDeProcesso, 'descricao' | 'final'>, quem: QuemRecebe) =>
  tarefaLigada(p, quem, `Prazo: ${z.descricao}`, `Cumprir o prazo: ${z.descricao}.`, z.final);
