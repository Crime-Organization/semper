// Andamentos e prazos de um processo: o que cada tipo pede, a conferência dos formulários, a situação de cada prazo e a
// tarefa que nasce de uma intimação ou de um prazo. Tudo puro, sem tela nem banco. As datas são "aaaa-mm-dd".
// A contagem dos dias em si está em regras/prazos.ts; os dias sem expediente de cada órgão, em regras/calendario.ts.
import type { AndamentoDeProcesso, DadosAndamento, DadosPrazo, DadosTarefa, MudancaNoAndamento, Processo, PrazoDeProcesso, TipoDeAndamento } from '../dados/tipos';
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
export const TIPOS_DE_ANDAMENTO_EM_ORDEM = Object.keys(TIPOS_DE_ANDAMENTO) as TipoDeAndamento[];

/** O que a pessoa preenche no formulário do andamento. */
export interface FormDoAndamento { tipo: TipoDeAndamento; data: string; hora: string; local: string; texto: string }
export const andamentoNovo = (hoje: string): FormDoAndamento => ({ tipo: 'andamento', data: hoje, hora: '', local: '', texto: '' });
export const formDoAndamento = (a: AndamentoDeProcesso): FormDoAndamento =>
  ({ tipo: a.tipo, data: a.data, hora: a.hora ?? '', local: a.local ?? '', texto: a.texto });

/** Data que o banco aceita: existe e está nos anos do calendário. */
const dataBoa = (iso: string) => dataExiste(iso) && anoAceito(iso);

export function errosDoAndamento(f: FormDoAndamento): Partial<Record<keyof FormDoAndamento, string>> {
  const erros: Partial<Record<keyof FormDoAndamento, string>> = {};
  if (!dataBoa(f.data)) erros.data = 'Informe uma data válida.';
  if (!f.texto.trim()) erros.texto = 'Escreva o que aconteceu.';
  else if (f.texto.trim().length > TAMANHO_ANDAMENTO.texto) erros.texto = `Use até ${TAMANHO_ANDAMENTO.texto} caracteres.`;
  if (TIPOS_DE_ANDAMENTO[f.tipo].marcado && f.local.trim().length > TAMANHO_ANDAMENTO.local) erros.local = `Use até ${TAMANHO_ANDAMENTO.local} caracteres.`;
  return erros;
}

/** O que vai para o banco. Hora e local só valem em audiência e perícia. */
export function dadosDoAndamento(f: FormDoAndamento): DadosAndamento {
  const marcado = TIPOS_DE_ANDAMENTO[f.tipo].marcado;
  return { tipo: f.tipo, data: f.data, hora: marcado && f.hora ? f.hora : null, local: marcado && f.local.trim() ? f.local.trim() : null, texto: f.texto.trim() };
}

/** O que muda ao salvar a edição: quem deixa de ser intimação deixa de estar "tratada" (o banco não aceita as duas coisas). */
export const mudancaDoAndamento = (f: FormDoAndamento): MudancaNoAndamento =>
  ({ ...dadosDoAndamento(f), ...(f.tipo === 'intimacao' ? {} : { tratada_em: null }) });

/** Intimação que ainda não virou tarefa nem foi marcada como sem tarefa. */
export const aTratar = (a: Pick<AndamentoDeProcesso, 'tipo' | 'tratada_em'>) => a.tipo === 'intimacao' && !a.tratada_em;

/** Os mais novos primeiro: pela data e, no mesmo dia, por quando foi lançado. */
export const porDataDoAndamento = (a: Pick<AndamentoDeProcesso, 'data' | 'criado_em'>, b: Pick<AndamentoDeProcesso, 'data' | 'criado_em'>) =>
  b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em);

/** Quando o andamento acontece, em palavras: "10/11/2026 às 14:30 em Fórum". */
export const quandoDoAndamento = (a: Pick<AndamentoDeProcesso, 'data' | 'hora' | 'local'>) =>
  fmtData(a.data) + (a.hora ? ` às ${a.hora}` : '') + (a.local ? ` em ${a.local}` : '');

/** Quantos caracteres do texto entram na linha do histórico e no título da tarefa. */
const TEXTO_CURTO = 120;
/** A linha do andamento no histórico do processo (igual à função privado.linha_do_andamento do banco). */
export const linhaDoAndamento = (a: Pick<AndamentoDeProcesso, 'tipo' | 'data' | 'hora' | 'local' | 'texto'>) =>
  `${TIPOS_DE_ANDAMENTO[a.tipo].nome} de ${quandoDoAndamento(a)}: ${a.texto.slice(0, TEXTO_CURTO)}`;

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
export const formDoPrazo = (p: PrazoDeProcesso, hoje: string): FormDoPrazo => ({
  descricao: p.descricao, modo: p.dias === null ? 'digitar' : 'calcular', intimacao: p.intimacao ?? hoje, dias: String(p.dias ?? DIAS_INICIAIS_DO_PRAZO),
  contagem: p.contagem ?? CONTAGEM_PADRAO, disponibilizacao: p.disponibilizacao, semRecesso: p.sem_recesso, final: p.final, andamentoId: p.andamento_id
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

/** Quantos dias antes do fim o prazo aparece como próximo (os "próximos 7 dias" do painel de Processos). */
export const DIAS_DE_PRAZO_PROXIMO = 7;
export type SituacaoDoPrazoNoProcesso = 'cumprido' | 'vencido' | 'hoje' | 'proximo' | 'em_dia';
/** A cor do selo de cada situação (os tipos de Selo em ui/base). */
export const SELO_DO_PRAZO: Record<SituacaoDoPrazoNoProcesso, 'ok' | 'erro' | 'pend' | 'arq'> = { cumprido: 'ok', vencido: 'erro', hoje: 'erro', proximo: 'pend', em_dia: 'arq' };

/** Um dia, em milissegundos (as datas são contadas em UTC: o dia tem sempre 24 horas). */
const UM_DIA = 24 * 60 * 60 * 1000;
const diasAte = (de: string, ate: string) => {
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
export const linhaDoPrazo = (p: Pick<PrazoDeProcesso, 'descricao' | 'final' | 'concluido_em'>) =>
  `${p.descricao}: ${fmtData(p.final)}${p.concluido_em ? ' (cumprido)' : ''}`;

/** Os nomes dessas linhas no histórico de alterações do cartão. */
export const CAMPOS_NO_HISTORICO: Record<string, string> = { andamento: 'Andamento', prazo: 'Prazo' };

// ---------- a tarefa que nasce ----------
type ProcessoDaTarefa = Pick<Processo, 'id' | 'numero' | 'titulo' | 'cliente_nome' | 'responsavel_id' | 'colaboradores'> & { clientes: { id: string }[] };

/** Ligada ao processo, com o responsável, os colaboradores que ainda estão na equipe e os clientes dele. */
const tarefaLigada = (p: ProcessoDaTarefa, equipe: string[], titulo: string, detalhe: string, prazo: string | null): DadosTarefa => ({
  titulo: titulo.slice(0, TAMANHO_TAREFA.titulo),
  descricao: `Processo ${p.numero} (${nomeDoProcesso(p)})\n\n${detalhe}`.slice(0, TAMANHO_TAREFA.descricao),
  prazo,
  responsavel_id: p.responsavel_id,
  participantes: p.colaboradores.filter(id => equipe.includes(id)),
  pessoas: p.clientes.map(c => c.id),
  processo_id: p.id
});

/** A tarefa de cumprir uma intimação. */
export const tarefaDaIntimacao = (p: ProcessoDaTarefa, a: Pick<AndamentoDeProcesso, 'data' | 'texto'>, equipe: string[]) =>
  tarefaLigada(p, equipe, `Intimação: ${a.texto.slice(0, TEXTO_CURTO)}`, `Intimação de ${fmtData(a.data)}:\n${a.texto}`, null);

/** A tarefa de cumprir um prazo: o prazo da tarefa é o último dia dele. */
export const tarefaDoPrazo = (p: ProcessoDaTarefa, z: Pick<PrazoDeProcesso, 'descricao' | 'final' | 'dias' | 'contagem' | 'intimacao'>, equipe: string[]) =>
  tarefaLigada(p, equipe, `Prazo: ${z.descricao}`, `Último dia: ${fmtData(z.final)}. ${comoFoiContado(z)}.`, z.final);
