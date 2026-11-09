// Caixa de mensagens (#112): para onde cada mensagem leva e como ela aparece. A tela só chama estas funções.
import { MAIOR_CONTADOR_DE_MENSAGENS, TRECHO_DA_MENSAGEM } from '../dados/limites';
import type { ModuloComentado, ModuloDoPrazo, PrazoDaMensagem, PrazoParado } from '../dados/tipos';
import { rotuloDoPrazo, situacaoDoPrazoNoProcesso, diasAte, type SituacaoDoPrazoNoProcesso } from './andamentos';
import { fmtData } from './pessoa';

/** O parâmetro do endereço que diz qual comentário mostrar quando o cartão abre. */
export const PARAMETRO_DO_COMENTARIO = 'comentario';

/** A página de cada módulo e o nome do cartão dele. Módulo novo com comentários = uma entrada nova. */
export const CARTAO_DO_MODULO: Record<ModuloComentado, { pagina: string; nome: string }> = {
  pessoas: { pagina: '/pessoas/', nome: 'Pessoa' },
  contratos: { pagina: '/contratos/', nome: 'Contrato' },
  demandas: { pagina: '/demandas/', nome: 'Demanda' },
  tarefas: { pagina: '/tarefas/', nome: 'Tarefa' },
  compromissos: { pagina: '/agenda/', nome: 'Compromisso' }
};

/** O endereço que abre o cartão no comentário da mensagem. */
export function enderecoDoComentario(modulo: ModuloComentado, cartaoId: string, comentarioId: string) {
  return `${CARTAO_DO_MODULO[modulo].pagina}?${new URLSearchParams({ id: cartaoId, [PARAMETRO_DO_COMENTARIO]: comentarioId })}`;
}

/** O começo do comentário, numa linha só, para a lista. */
export function trechoDaMensagem(texto: string) {
  const corrido = texto.replace(/\s+/g, ' ').trim();
  return corrido.length > TRECHO_DA_MENSAGEM ? corrido.slice(0, TRECHO_DA_MENSAGEM).trimEnd() + '…' : corrido;
}

/** A página onde o cartão de cada prazo abre. Módulo novo com prazo = uma entrada nova. */
const PAGINA_DO_PRAZO: Record<ModuloDoPrazo, (tipoDoProcesso?: string) => string> = {
  processos: tipo => `processos/${tipo ?? ''}`, demandas: () => 'demandas', tarefas: () => 'tarefas', compromissos: () => 'agenda'
};
export const paginaDoPrazo = (modulo: ModuloDoPrazo, tipoDoProcesso?: string) => PAGINA_DO_PRAZO[modulo](tipoDoProcesso);
/** O nome de cada módulo no aviso, em minúsculas para ir no meio da frase. */
export const NOME_DO_PRAZO: Record<ModuloDoPrazo, string> = { processos: 'prazo de processo', demandas: 'demanda', tarefas: 'tarefa', compromissos: 'compromisso' };

/** O endereço que abre o cartão do prazo. */
export const enderecoDoPrazo = (p: Pick<PrazoDaMensagem, 'pagina' | 'cartao_id'>) => `/${p.pagina}/?${new URLSearchParams({ id: p.cartao_id })}`;

const emDias = (n: number) => n === 1 ? '1 dia' : `${n} dias`;
/** Na agenda não há vencimento: o compromisso é hoje, ou daqui a tantos dias. */
const ROTULO_DO_COMPROMISSO: Record<SituacaoDoPrazoNoProcesso, (dias: number) => string> = {
  cumprido: () => 'Realizado', vencido: d => `Passou há ${emDias(-d)}`, hoje: () => 'É hoje', proximo: d => `Em ${emDias(d)}`, em_dia: d => `Em ${emDias(d)}`
};
/** O que o aviso diz, contando a partir de hoje: um aviso antigo não continua dizendo "vence hoje". */
const ROTULO_DO_PARADO: Record<PrazoParado, string> = { cancelado: 'Cancelado', excluido: 'Excluído', arquivado: 'Arquivado' };
/** "Cancelado" é uma coluna comum do quadro, sem marco: vai pelo nome, como em privado.prazos_da_equipe. */
export const colunaCancelada = (nome: string | null | undefined) => !!nome?.toLowerCase().startsWith('cancelad');

export function rotuloDoAviso(p: Pick<PrazoDaMensagem, 'modulo' | 'data' | 'concluido' | 'parado'>, hoje: string) {
  if (p.parado) return ROTULO_DO_PARADO[p.parado];
  const prazo = { final: p.data, concluido_em: p.concluido ? p.data : null };
  if (p.modulo !== 'compromissos') return rotuloDoPrazo(prazo, hoje);
  return ROTULO_DO_COMPROMISSO[situacaoDoPrazoNoProcesso(prazo, hoje)](diasAte(hoje, p.data));
}
/** A data do aviso, com a hora quando há. */
export const dataDoAviso = (p: Pick<PrazoDaMensagem, 'data' | 'hora'>) => fmtData(p.data) + (p.hora ? ` às ${p.hora}` : '');

/** Quantos dias antes do vencimento vem o primeiro aviso. É o mesmo número da rotina do banco: 20261109085738_avisos_de_prazo.sql. */
export const DIAS_DO_AVISO_DE_PRAZO = 3;

/** Os e-mails de prazo que cada pessoa pode desligar (em Minha conta). As chaves são lidas também pelo banco: 20261109085738_avisos_de_prazo.sql. */
export const EMAILS_DE_PRAZO = [
  { chave: 'email_prazos_diario', rotulo: `Aviso às 7h, quando um prazo seu estiver a ${DIAS_DO_AVISO_DE_PRAZO} dias de vencer e no dia do vencimento` },
  { chave: 'email_prazos_semanal', rotulo: 'Resumo da semana, às sextas, às 16h' }
] as const;

/** O número do contador do menu. */
export const textoDoContador = (naoLidas: number) => naoLidas > MAIOR_CONTADOR_DE_MENSAGENS ? MAIOR_CONTADOR_DE_MENSAGENS + '+' : String(naoLidas);

/** O nome do item do menu para quem usa leitor de tela, com o número de não lidas. */
export const rotuloDoMenu = (naoLidas: number) => ({ 0: 'Mensagens', 1: 'Mensagens, 1 não lida' } as Record<number, string>)[naoLidas] ?? `Mensagens, ${naoLidas} não lidas`;
