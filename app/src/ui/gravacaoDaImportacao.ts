// Gravação da importação de pessoas, fora dos componentes (uma loja, padrão Observer): fechar a janela não interrompe
// a gravação nem perde o resumo, que reaparece ao reabrir a importação. A tela entrega os lotes e as funções que gravam
// (as de dados: importacaoIniciar, pessoasImportar e importacaoConcluir) e mostra o estado com gravacao.usar().
// Enquanto grava, o navegador pergunta antes de sair da página; no fim, as listas recarregam (a de Pessoas pode ter
// recarregado no meio, se a janela foi fechada antes do fim) e um aviso no pé da tela conta o resultado.
import { avisar, sinalizarMudanca } from './avisos';
import { criarLoja } from './loja';

/** O que cada lote gravado devolve (o ResultadoLote do contrato de dados). */
export interface TotaisDoLote { criadas: number; completadas: number }
/** Os números da importação registrada (a Importacao do contrato de dados): criadas e incompletas, o banco conta. */
export interface TotaisDaImportacao extends TotaisDoLote { incompletas: number }
/** As linhas que não foram gravadas: do lote que falhou até a última, e o motivo. */
export interface FalhaDaGravacao { primeira: number; ultima: number; quantas: number; mensagem: string }

export interface GravacaoConcluida {
  fase: 'concluida';
  /** Itens entregues para gravar e quantos foram gravados. */
  total: number;
  gravadas: number;
  /** Do registro da importação; se ele não pôde ser concluído, a soma dos lotes (sem as incompletas). */
  totais: TotaisDoLote & { incompletas: number | null };
  /** A primeira falha (a gravação para nela); null se tudo foi gravado. */
  falha: FalhaDaGravacao | null;
  /** O motivo de o registro da importação não ter sido concluído (as pessoas gravadas continuam gravadas). */
  erroAoRegistrar: string | null;
}
export type EstadoGravacao = { fase: 'ocioso' } | { fase: 'gravando'; gravadas: number; total: number } | GravacaoConcluida;

export interface PedidoDeGravacao<I extends { linha: number }> {
  /** Os itens já divididos em lotes (emLotes, de regras/importacao.ts), na ordem das linhas. */
  lotes: I[][];
  /** Abre o registro da importação e devolve o id dele. */
  iniciar: () => Promise<string>;
  gravarLote: (importacaoId: string, lote: I[]) => Promise<TotaisDoLote>;
  /** Fecha o registro com as completadas (contadas aqui); é chamado também depois de uma falha. */
  concluir: (importacaoId: string, completadas: number) => Promise<TotaisDaImportacao>;
  /** O texto do aviso no pé da tela ao terminar (a janela pode já estar fechada). */
  avisoFinal: (fim: GravacaoConcluida) => string;
}

export const gravacao = criarLoja<EstadoGravacao>({ fase: 'ocioso' });

const mensagemDe = (e: unknown) => (e as Error)?.message || 'Não foi possível gravar agora.';
/** Pede ao navegador que confirme antes de sair da página (recarregar ou fechar a aba interromperia a gravação). */
function segurarSaida(e: BeforeUnloadEvent) { e.preventDefault(); }

/** Os itens que ficaram sem gravar, a partir do lote que falhou. */
function falhaDesde(restantes: { linha: number }[], e: unknown): FalhaDaGravacao {
  const linhas = restantes.map(i => i.linha);
  const [primeira, ultima] = linhas.length ? [Math.min(...linhas), Math.max(...linhas)] : [0, 0];
  return { primeira, ultima, quantas: linhas.length, mensagem: mensagemDe(e) };
}

/**
 * Cada gravação ganha um número; abandonarGravacao() passa ao seguinte, e a gravação antiga, ao ver que não é mais a
 * atual, para antes do próximo lote e tenta fechar o registro, sem mexer na loja nem avisar (a pessoa saiu do sistema).
 */
let gravacaoAtual = 0;
const ABANDONADA = 'A importação foi interrompida ao sair do sistema.';

/** Grava os lotes um por um, contando o progresso na loja; na primeira falha, para, e conclui o registro mesmo assim. */
async function gravarTudo<I extends { linha: number }>(pedido: PedidoDeGravacao<I>, itens: I[], ativa: () => boolean): Promise<GravacaoConcluida> {
  const total = itens.length;
  const somados: TotaisDoLote = { criadas: 0, completadas: 0 };
  let id: string;
  try { id = await pedido.iniciar(); }
  catch (e) { return { fase: 'concluida', total, gravadas: 0, totais: { ...somados, incompletas: null }, falha: falhaDesde(itens, e), erroAoRegistrar: null }; }
  let gravadas = 0;
  let falha: FalhaDaGravacao | null = null;
  for (const lote of pedido.lotes) {
    if (!ativa()) { falha = falhaDesde(itens.slice(gravadas), new Error(ABANDONADA)); break; }
    try {
      const r = await pedido.gravarLote(id, lote);
      somados.criadas += r.criadas;
      somados.completadas += r.completadas;
      gravadas += lote.length;
      if (ativa()) gravacao.mudar({ fase: 'gravando', gravadas, total });
    } catch (e) { falha = falhaDesde(itens.slice(gravadas), e); break; }
  }
  try {
    const { criadas, completadas, incompletas } = await pedido.concluir(id, somados.completadas);
    return { fase: 'concluida', total, gravadas, totais: { criadas, completadas, incompletas }, falha, erroAoRegistrar: null };
  } catch (e) {
    return { fase: 'concluida', total, gravadas, totais: { ...somados, incompletas: null }, falha, erroAoRegistrar: mensagemDe(e) };
  }
}

/**
 * Começa a gravação (só uma por vez: com outra em andamento, rejeita). Depois de começar, não rejeita: o resultado,
 * também o de falha, fica na loja, vira um aviso no pé da tela e é devolvido.
 */
export async function gravarImportacao<I extends { linha: number }>(pedido: PedidoDeGravacao<I>): Promise<GravacaoConcluida> {
  if (gravacao.ler().fase === 'gravando') throw new Error('Já há uma importação gravando. Espere terminar.');
  const itens = pedido.lotes.flat();
  const minha = ++gravacaoAtual;
  const ativa = () => minha === gravacaoAtual;
  gravacao.mudar({ fase: 'gravando', gravadas: 0, total: itens.length });
  window.addEventListener('beforeunload', segurarSaida);
  try {
    const fim = await gravarTudo(pedido, itens, ativa);
    if (!ativa()) return fim;
    gravacao.mudar(fim);
    sinalizarMudanca();
    avisar(pedido.avisoFinal(fim), fim.falha || fim.erroAoRegistrar ? 'erro' : 'ok');
    return fim;
  } finally {
    // A abandonada já soltou a página (e outra gravação pode ter começado depois dela).
    if (ativa()) window.removeEventListener('beforeunload', segurarSaida);
  }
}

/** Volta ao começo (ao fechar o resumo ou começar outra importação); durante a gravação, não faz nada. */
export function esquecerGravacao() {
  if (gravacao.ler().fase !== 'gravando') gravacao.reiniciar();
}

/** Há uma gravação em andamento (sair do sistema agora a interromperia). */
export const estaGravando = () => gravacao.ler().fase === 'gravando';

/**
 * Ao sair do sistema: a loja volta ao começo, para quem entrar depois na mesma aba não ver o resumo de outra pessoa;
 * uma gravação em andamento para antes do próximo lote (o que já foi gravado continua gravado), sem avisar.
 */
export function abandonarGravacao() {
  gravacaoAtual++;
  window.removeEventListener('beforeunload', segurarSaida);
  gravacao.reiniciar();
}
