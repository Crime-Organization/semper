// Os textos da sincronização das pessoas com o Google Contatos (#164), em Configurações: a situação da fila, o problema
// que a impede (com o que fazer) e o resultado do "Sincronizar agora". Puro: a tela só mostra.
import type { DecisaoDoContato, MotivoParaConferir, ProblemaDaSincronizacao, ResultadoDaSincronizacao, SincronizacaoGoogle } from '../dados/tipos';

/** O problema, para o administrador: o que houve e o que fazer. */
export const PROBLEMAS_DA_SINCRONIZACAO: Record<ProblemaDaSincronizacao, { titulo: string; oQueFazer: string }> = {
  autorizacao: {
    titulo: 'A autorização do Google venceu ou foi retirada.',
    oQueFazer: 'Clique em "Ligar outra conta" e entre de novo com a conta do escritório, deixando os contatos marcados. Nada se perdeu: quem está esperando vai ao Google assim que a conta for ligada.'
  },
  'google-fora': {
    titulo: 'O Google não está respondendo.',
    oQueFazer: 'O SEMPER continua tentando sozinho, com esperas cada vez maiores, e nada se perde. Se durar mais de um dia, clique em "Sincronizar agora"; se não resolver, avise o suporte do SEMPER.'
  },
  recusado: {
    titulo: 'O Google recusou os dados de algumas pessoas.',
    oQueFazer: 'Confira o nome, os telefones, os e-mails e a data de nascimento (ou de abertura) das pessoas cadastradas ou editadas por último e salve de novo: a correção vai ao Google na hora. Se continuar, avise o suporte do SEMPER.'
  }
};

const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
const contatos = (n: number) => `${n} ${n === 1 ? 'contato' : 'contatos'}`;

/** A situação da fila numa frase: em dia, ou quantas pessoas esperam (e quantas já falharam). */
export function situacaoDaFila(s: Pick<SincronizacaoGoogle, 'pendentes' | 'com_falha'>) {
  if (!s.pendentes) return 'Tudo em dia: não há ninguém esperando para ir ao Google.';
  const falhas = s.com_falha ? ` (${s.com_falha} com falha)` : '';
  return `${pessoas(s.pendentes)} esperando para ir ao Google${falhas}.`;
}

/** O resumo da primeira sincronização, quando ela termina no "Sincronizar agora". */
export function resumoDaPrimeira(p: NonNullable<ResultadoDaSincronizacao['primeira']>) {
  const ligados = `${contatos(p.ligados)} do Google ${p.ligados === 1 ? 'ligado' : 'ligados'} a pessoas do SEMPER`;
  return `Primeira sincronização feita: ${ligados}${p.para_conferir ? `, ${contatos(p.para_conferir)} para conferir` : ''}.`;
}

/** O resultado do "Sincronizar agora", como aviso (com o resumo da primeira sincronização, se ela terminou agora). */
export const RESULTADO_DO_AGORA: Record<ResultadoDaSincronizacao['resultado'], (r: ResultadoDaSincronizacao) => { ok: boolean; texto: string }> = {
  ok: r => ({
    ok: !r.falhas,
    texto: [r.primeira ? resumoDaPrimeira(r.primeira) : '',
      !r.sincronizados && !r.falhas && !r.primeira ? 'Nada esperando: os contatos já estavam em dia.' : '',
      r.sincronizados ? `${pessoas(r.sincronizados)} ${r.sincronizados === 1 ? 'foi' : 'foram'} ao Google.` : '',
      r.falhas ? `${pessoas(r.falhas)} não ${r.falhas === 1 ? 'foi' : 'foram'}: o SEMPER tenta de novo sozinho.` : ''].filter(Boolean).join(' ')
  }),
  desligada: () => ({ ok: false, texto: 'A sincronização dos contatos está desligada.' }),
  erro: () => ({ ok: false, texto: 'Não foi possível sincronizar agora. Tente de novo em alguns minutos: nada se perdeu.' })
};

/** Por que desligar a conta não deu certo (a função do servidor google-desligar). */
export const RECUSA_DO_DESLIGAR: Record<'sem-permissao' | 'erro', string> = {
  'sem-permissao': 'Apenas administradores desligam a conta Google do escritório.',
  erro: 'Não foi possível desligar a conta Google agora. Tente de novo em alguns minutos.'
};

// ---------------------------------------------------------------------
// A primeira sincronização e a lista Para conferir (etapa 2)
// ---------------------------------------------------------------------

/** O que a tela diz enquanto a primeira sincronização não terminou. */
export const PRIMEIRA_POR_FAZER = 'A primeira sincronização ainda não terminou: o SEMPER está lendo os contatos que já estão no Google para ligá-los às pessoas do escritório, sem criar cópias. Até ela terminar, nada é criado no Google. Leva alguns minutos; o "Sincronizar agora" a faz na hora.';

/** Por que o contato está na lista: um selo curto e a explicação. */
export const MOTIVOS_PARA_CONFERIR: Record<MotivoParaConferir, { selo: string; texto: string }> = {
  varios: { selo: 'Várias pessoas', texto: 'Pode ser mais de uma pessoa do escritório.' },
  'so-nome': { selo: 'Só o nome', texto: 'Só o nome bate: pode ser a mesma pessoa ou alguém com o mesmo nome.' },
  conflito: { selo: 'Dados diferentes', texto: 'O telefone ou o e-mail é de uma pessoa do escritório, mas o nome ou o aniversário não combina (pode ser um parente, a empresa dela ou um número antigo).' },
  repetido: { selo: 'Repetido', texto: 'A pessoa já está ligada a outro contato do Google: este parece repetido lá.' }
};

/** O que a tela confirma depois de cada decisão. */
export const AO_DECIDIR: Record<DecisaoDoContato['acao'], string> = {
  ligar: 'Contato ligado à pessoa. No Google, ele só muda quando a pessoa for editada no SEMPER.',
  outra: 'Marcado como outra pessoa: o SEMPER cria um contato novo para quem estava sem.',
  ignorar: 'Contato ignorado: ele fica no Google como está.'
};

/** O aniversário do Google para mostrar: "aaaa-mm-dd" vira "dd/mm/aaaa"; "mm-dd" (sem o ano), "dd/mm". */
export function aniversarioParaMostrar(v: string | null) {
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(v ?? '');
  if (!m) return '';
  return [m[3], m[2], m[1]].filter(Boolean).join('/');
}
