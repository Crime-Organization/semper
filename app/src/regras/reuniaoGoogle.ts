// O Google Meet no compromisso (#437): os textos da opção "Criar link do Google Meet" no cadastro e no lápis, o que o cartão
// mostra da reunião e o que Configurações diz das permissões do Meet. Puro: a tela só mostra. Quem cria, muda e cancela a
// reunião é o servidor (supabase/functions/_compartilhado/reunioesGoogle.ts), pela conta Google do escritório.
import type { Compromisso, SituacaoDasReunioes } from '../dados/tipos';

/** O rótulo da opção, no cadastro e no lápis do compromisso (o nome que o dono deu). */
export const OPCAO_DO_MEET = 'Criar link do Google Meet';

/** A dica da opção: com o Meet ligado no escritório, o que acontece; sem ele (a opção já marcada), quando a reunião nasce. */
export const DICA_DO_MEET: Record<'disponivel' | 'indisponivel', string> = {
  disponivel: 'A reunião é criada pela conta Google do escritório, que manda o convite por e-mail à equipe do compromisso e às pessoas ligadas que têm e-mail. '
    + 'O link aparece no cartão em alguns minutos; mudar a data ou a hora mantém o link, e arquivar ou cancelar o compromisso cancela a reunião.',
  indisponivel: 'O Google Meet não está ligado no escritório agora: a reunião é criada quando um administrador o ligar em Configurações, na Conta Google.'
};
/** A dica que vale: a opção aparece com o Meet disponível, ou, sem ele, só para quem já a marcou (para poder desmarcar). */
export const dicaDoMeet = (situacao: SituacaoDasReunioes | null | undefined) => DICA_DO_MEET[situacao?.disponivel ? 'disponivel' : 'indisponivel'];
/** O cadastro e o lápis mostram a opção? Com o Meet disponível, ou com ela já marcada. */
export const mostraOpcaoDoMeet = (situacao: SituacaoDasReunioes | null | undefined, marcada: boolean) => !!situacao?.disponivel || marcada;

/** Como está a reunião do compromisso: sem a opção; cancelada (arquivado ou cancelado); o link ainda sendo criado; pronta. */
export type EstadoDaReuniao = 'sem' | 'cancelada' | 'criando' | 'pronta';
export function estadoDaReuniao(c: Pick<Compromisso, 'reuniao_google' | 'reuniao' | 'arquivado_em'>, cancelado: boolean): EstadoDaReuniao {
  if (!c.reuniao_google) return 'sem';
  if (c.arquivado_em || cancelado) return 'cancelada';
  return c.reuniao?.link ? 'pronta' : 'criando';
}
/** O texto de cada estado no cartão (o da reunião pronta é o próprio link). */
export const TEXTO_DA_REUNIAO: Record<Exclude<EstadoDaReuniao, 'sem' | 'pronta'>, string> = {
  cancelada: 'A reunião é cancelada no Google: o compromisso está arquivado ou cancelado, e cada convidado recebe o aviso.',
  criando: 'O link está sendo criado pela conta Google do escritório e aparece aqui em alguns minutos.'
};
/** A gravação e a transcrição automáticas da reunião pronta: ligadas, ou o Google não deixou (quem grava é a conta do escritório). */
export const GRAVACAO_DA_REUNIAO: Record<NonNullable<NonNullable<Compromisso['reuniao']>['gravacao']>, string> = {
  ligada: 'A gravação e a transcrição começam sozinhas e ficam no Google Drive da conta do escritório.',
  recusada: 'O Google não deixou ligar a gravação automática: quem grava é a conta do escritório, na própria reunião.'
};

/** O que o cartão mostra da reunião: nada (sem a opção), o link (com a gravação, se já se sabe) ou o texto do estado. */
export type ReuniaoNoCartao = null | { link: string; gravacao: string | null } | { texto: string };
const NO_CARTAO: Record<EstadoDaReuniao, (c: Pick<Compromisso, 'reuniao'>) => ReuniaoNoCartao> = {
  sem: () => null,
  cancelada: () => ({ texto: TEXTO_DA_REUNIAO.cancelada }),
  criando: () => ({ texto: TEXTO_DA_REUNIAO.criando }),
  pronta: c => ({ link: c.reuniao!.link!, gravacao: c.reuniao?.gravacao ? GRAVACAO_DA_REUNIAO[c.reuniao.gravacao] : null })
};
export const reuniaoNoCartao = (c: Pick<Compromisso, 'reuniao_google' | 'reuniao' | 'arquivado_em'>, cancelado: boolean): ReuniaoNoCartao =>
  NO_CARTAO[estadoDaReuniao(c, cancelado)](c);

/** Em Configurações, nas Agendas no Google: o que o Meet faz, antes e depois de autorizar. */
export const MEET_NAS_AGENDAS: Record<'falta' | 'autorizado', string> = {
  falta: 'Google Meet: para o SEMPER criar a reunião dos compromissos marcados com "Criar link do Google Meet", autorize o Meet nesta conta. '
    + 'A conta do escritório fica sendo a organizadora: o convite sai pelo e-mail dela, e ela grava e transcreve (o SEMPER liga a gravação automática quando o Google deixa).',
  autorizado: 'Google Meet autorizado: o SEMPER cria nesta conta a reunião dos compromissos marcados com "Criar link do Google Meet" e convida a equipe e as pessoas ligadas.'
};
