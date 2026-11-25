// Os textos das agendas do escritório no Google Agenda (#166), em Configurações, no cartão Conta Google: o que falta
// autorizar, a situação, o problema que impede (com o que fazer) e o resultado do "Sincronizar agora". Puro: a tela só mostra.
import type { AgendasGoogle, ProblemaDasAgendas, ResultadoDasAgendas } from '../dados/tipos';

/** O que a tela diz enquanto a conta não deu a permissão da agenda. */
export const FALTA_AUTORIZAR_A_AGENDA = 'Falta autorizar a agenda: o Google ainda não deixou o SEMPER criar e compartilhar agendas nesta conta. Os contatos continuam como estão.';

/** O que cada agenda é, para quem liga. */
export const AGENDAS_QUE_O_SEMPER_CRIA = 'O SEMPER cria nesta conta uma agenda para cada pessoa ativa da equipe ("Agenda – nome"), a Geral, uma para cada sala ativa e a Administrativo, '
  + 'e as compartilha só para ver: cada pessoa recebe pelo e-mail do Google dela a própria agenda, a Geral e as das salas; os administradores, também a Administrativo. '
  + 'Quem é desativado perde o acesso (a agenda fica com o escritório). Nelas vão os compromissos (do responsável e dos participantes; na Geral, os da Agenda geral; '
  + 'na da sala, os que têm sala), os prazos das tarefas e das demandas, os feriados e as suspensões do escritório (na Geral) e as parcelas a receber '
  + '(na agenda do responsável pelo contrato). Ao ligar, vai o que está em aberto de hoje em diante. Tudo se muda no SEMPER: no Google, é só para ver.';

/** O problema, para o administrador: o que houve e o que fazer. */
export const PROBLEMAS_DAS_AGENDAS: Record<ProblemaDasAgendas, { titulo: string; oQueFazer: string }> = {
  autorizacao: {
    titulo: 'A autorização da agenda no Google venceu ou foi retirada.',
    oQueFazer: 'Clique em "Autorizar a agenda" e entre com a conta do escritório, deixando a agenda marcada. Nada se perdeu: o SEMPER arruma as agendas assim que a autorização voltar.'
  },
  'google-fora': {
    titulo: 'O Google não está respondendo.',
    oQueFazer: 'O SEMPER continua tentando sozinho, com esperas cada vez maiores, e nada se perde. Se durar mais de um dia, clique em "Sincronizar agora"; se não resolver, avise o suporte do SEMPER.'
  },
  recusado: {
    titulo: 'O Google recusou uma mudança nas agendas.',
    oQueFazer: 'Confira o e-mail do Google de quem entrou ou mudou na equipe (em Equipe e acessos) e salve de novo: a correção vai ao Google na hora. Se continuar, avise o suporte do SEMPER.'
  }
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A situação numa frase: quantas agendas e compartilhamentos já existem, e se há mudanças esperando. */
export function situacaoDasAgendas(s: Pick<AgendasGoogle, 'agendas' | 'compartilhamentos' | 'pendentes' | 'com_falha'>) {
  const feito = `${plural(s.agendas, 'agenda criada', 'agendas criadas')}, ${plural(s.compartilhamentos, 'compartilhamento', 'compartilhamentos')}.`;
  if (!s.pendentes) return `Tudo em dia: ${feito}`;
  const falhas = s.com_falha ? ` (${s.com_falha} com falha)` : '';
  return `Há mudanças esperando para ir ao Google${falhas}. Até agora: ${feito}`;
}

/** Cada tipo de mudança feita no Google, numa frase curta. */
const FEITO: Record<keyof ResultadoDasAgendas['feitas'], (n: number) => string> = {
  criar: n => plural(n, 'agenda criada', 'agendas criadas'),
  renomear: n => plural(n, 'agenda com o nome atualizado', 'agendas com o nome atualizado'),
  compartilhar: n => plural(n, 'compartilhamento feito', 'compartilhamentos feitos'),
  retirar: n => plural(n, 'compartilhamento retirado', 'compartilhamentos retirados'),
  gravar_evento: n => plural(n, 'evento levado à agenda', 'eventos levados às agendas'),
  apagar_evento: n => plural(n, 'evento tirado da agenda', 'eventos tirados das agendas')
};

/** O resumo do que foi feito, só com o que aconteceu ("2 agendas criadas, 5 compartilhamentos feitos"). */
export function resumoDasAgendas(feitas: ResultadoDasAgendas['feitas']) {
  return (Object.keys(FEITO) as (keyof typeof FEITO)[]).filter(k => feitas[k]).map(k => FEITO[k](feitas[k])).join(', ');
}

/** O resultado do "Sincronizar agora" das agendas, como aviso. */
export const RESULTADO_DAS_AGENDAS: Record<ResultadoDasAgendas['resultado'], (r: ResultadoDasAgendas) => { ok: boolean; texto: string }> = {
  ok: r => {
    const resumo = resumoDasAgendas(r.feitas);
    return {
      ok: !r.falhas,
      texto: [resumo ? `${resumo}.` : !r.falhas ? 'Nada a mudar: as agendas já estavam em dia.' : '',
        r.restam ? 'O resto vai ao Google sozinho em alguns minutos.' : '',
        r.falhas ? 'Uma parte não foi: o SEMPER tenta de novo sozinho, e nada se perdeu.' : ''].filter(Boolean).join(' ')
    };
  },
  desligada: () => ({ ok: false, texto: 'As agendas no Google estão desligadas.' }),
  erro: () => ({ ok: false, texto: 'Não foi possível sincronizar as agendas agora. Tente de novo em alguns minutos: nada se perdeu.' })
};

/** O que a tela confirma depois de ligar ou desligar. */
export const AO_MUDAR_AS_AGENDAS: Record<'ligadas' | 'desligadas', string> = {
  ligadas: 'Agendas ligadas: em alguns minutos o SEMPER cria as agendas do escritório no Google e as compartilha com a equipe.',
  desligadas: 'Agendas desligadas: o SEMPER deixou de mexer nas agendas do Google. Nada foi apagado lá.'
};

const contar = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
/** A resposta da função do servidor google-agendas, conferida (o que não vier certo conta como zero, ou como erro). */
export function lerResultadoDasAgendas(corpo: unknown): ResultadoDasAgendas {
  const c = (corpo ?? {}) as Partial<Record<keyof ResultadoDasAgendas, unknown>>;
  const resultado = c.resultado === 'ok' || c.resultado === 'desligada' ? c.resultado : 'erro';
  const f = (c.feitas ?? {}) as Partial<Record<keyof ResultadoDasAgendas['feitas'], unknown>>;
  return {
    resultado,
    feitas: { criar: contar(f.criar), renomear: contar(f.renomear), compartilhar: contar(f.compartilhar), retirar: contar(f.retirar),
      gravar_evento: contar(f.gravar_evento), apagar_evento: contar(f.apagar_evento) },
    falhas: contar(c.falhas), restam: c.restam === true
  };
}
