// Os textos da sincronização das pessoas com o Google Contatos (#164), em Configurações: a situação da fila, o problema
// que a impede (com o que fazer) e o resultado do "Sincronizar agora". Puro: a tela só mostra.
import type { ProblemaDaSincronizacao, ResultadoDaSincronizacao, SincronizacaoGoogle } from '../dados/tipos';

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

/** A situação da fila numa frase: em dia, ou quantas pessoas esperam (e quantas já falharam). */
export function situacaoDaFila(s: Pick<SincronizacaoGoogle, 'pendentes' | 'com_falha'>) {
  if (!s.pendentes) return 'Tudo em dia: não há ninguém esperando para ir ao Google.';
  const falhas = s.com_falha ? ` (${s.com_falha} com falha)` : '';
  return `${pessoas(s.pendentes)} esperando para ir ao Google${falhas}.`;
}

/** O resultado do "Sincronizar agora", como aviso. */
export const RESULTADO_DO_AGORA: Record<ResultadoDaSincronizacao['resultado'], (r: ResultadoDaSincronizacao) => { ok: boolean; texto: string }> = {
  ok: r => ({
    ok: !r.falhas,
    texto: !r.sincronizados && !r.falhas ? 'Nada esperando: os contatos já estavam em dia.'
      : [r.sincronizados ? `${pessoas(r.sincronizados)} ${r.sincronizados === 1 ? 'foi' : 'foram'} ao Google.` : '',
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
