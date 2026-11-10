// Caixa de mensagens (#112): para onde cada mensagem leva e como ela aparece. A tela só chama estas funções.
import { MAIOR_CONTADOR_DE_MENSAGENS, TRECHO_DA_MENSAGEM } from '../dados/limites';
import type { AvisoDePrazo, ModuloComentado, ModuloDoPrazo, PrazoDaMensagem, PrazoParado } from '../dados/tipos';
import { rotuloDoPrazo, situacaoDoPrazoNoProcesso, diasAte, type SituacaoDoPrazoNoProcesso } from './andamentos';
import { prazoComHora, rotuloDoLembrete } from './lembrete';

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

type PrazoDoAviso = Pick<PrazoDaMensagem, 'modulo' | 'data' | 'concluido' | 'parado'> & Partial<Pick<PrazoDaMensagem, 'aviso' | 'antecedencia'>>;
/** A situação do prazo contada de hoje: "Vence hoje", "Vencido há 2 dias", "Em 3 dias" (no compromisso, sem vencimento). */
function situacaoContadaDeHoje(p: PrazoDoAviso, hoje: string) {
  const prazo = { final: p.data, concluido_em: p.concluido ? p.data : null };
  if (p.modulo !== 'compromissos') return rotuloDoPrazo(prazo, hoje);
  return ROTULO_DO_COMPROMISSO[situacaoDoPrazoNoProcesso(prazo, hoje)](diasAte(hoje, p.data));
}
/**
 * O título de cada aviso. Os de 3 dias e do dia contam a partir de hoje: um aviso antigo não continua dizendo "vence hoje".
 * O lembrete diz que é lembrete e com que antecedência, até o prazo ser concluído. Aviso novo = uma entrada nova.
 */
const ROTULO_DO_AVISO: Record<AvisoDePrazo, (p: PrazoDoAviso, hoje: string) => string> = {
  proximo: situacaoContadaDeHoje,
  hoje: situacaoContadaDeHoje,
  lembrete: (p, hoje) => p.concluido ? situacaoContadaDeHoje(p, hoje) : rotuloDoLembrete(p.antecedencia)
};
export function rotuloDoAviso(p: PrazoDoAviso, hoje: string) {
  if (p.parado) return ROTULO_DO_PARADO[p.parado];
  return ROTULO_DO_AVISO[p.aviso ?? 'proximo'](p, hoje);
}
/** O nome de cada aviso para quem usa leitor de tela ("Lembrete não lido: …"). */
export const NOME_DO_AVISO: Record<AvisoDePrazo, string> = { proximo: 'Aviso de prazo', hoje: 'Aviso de prazo', lembrete: 'Lembrete' };
/** A data do aviso, com a hora quando há: "15/11/2030 às 14:00". */
export const dataDoAviso = (p: Pick<PrazoDaMensagem, 'data' | 'hora'>) => prazoComHora(p.data, p.hora);

/** Quantos dias antes do vencimento vem o primeiro aviso. É o mesmo número da rotina do banco: 20261109085738_avisos_de_prazo.sql. */
export const DIAS_DO_AVISO_DE_PRAZO = 3;

/** Os e-mails de prazo que cada pessoa pode desligar (em Minha conta). As chaves são lidas também pelo banco: 20261109085738_avisos_de_prazo.sql e, a dos lembretes, lembretes_dos_prazos (#286). */
export const EMAILS_DE_PRAZO = [
  { chave: 'email_prazos_diario', rotulo: `Aviso às 7h, quando um prazo seu estiver a ${DIAS_DO_AVISO_DE_PRAZO} dias de vencer e no dia do vencimento` },
  { chave: 'email_prazos_semanal', rotulo: 'Resumo da semana, às sextas, às 16h' },
  { chave: 'email_lembretes', rotulo: 'Lembretes que eu marcar nas tarefas e demandas, na hora escolhida' }
] as const;

/** O número do contador do menu. */
export const textoDoContador = (naoLidas: number) => naoLidas > MAIOR_CONTADOR_DE_MENSAGENS ? MAIOR_CONTADOR_DE_MENSAGENS + '+' : String(naoLidas);

/** O nome do item do menu para quem usa leitor de tela, com o número de não lidas. */
export const rotuloDoMenu = (naoLidas: number) => ({ 0: 'Mensagens', 1: 'Mensagens, 1 não lida' } as Record<number, string>)[naoLidas] ?? `Mensagens, ${naoLidas} não lidas`;
