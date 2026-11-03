// Partes puras do aviso de troca de e-mail pelo administrador (#224), usadas pela função do servidor equipe-trocar-email.
// Sem Deno e sem rede: dá para testar no app (app/src/regras/avisoDaTroca.test.ts).

/** A quem o aviso vai: o e-mail antigo de quem teve a conta trocada, ou a administração do escritório. */
export type DestinoDoAviso = 'antigo' | 'gestao';
/** 'nao-confirmada': o login falhou sem resposta certa, e a troca pode ter acontecido. */
export type SituacaoDaTroca = 'trocada' | 'nao-confirmada';
/** O que o banco conta sobre a troca (public.equipe_email_aviso_dados). Não traz o e-mail novo. */
export interface DadosDoAviso { escritorio: string; alvo: string; autor: string; autor_email: string; em: string; email_antigo: string; gestao: string[] }
export interface MensagemDoAviso { destino: DestinoDoAviso; para: string; assunto: string; texto: string; html: string }
/** Um aviso a reenviar (public.equipe_email_avisos_pendentes). */
export interface AvisoPendente { registro: number; situacao: SituacaoDaTroca; destinos: DestinoDoAviso[] }
export interface PassosDoAviso {
  dados(registro: number): Promise<DadosDoAviso | null>;
  enviar(mensagem: MensagemDoAviso): Promise<void>;
  /** `gestaoSemAviso`: os endereços da administração que não receberam; null quando não se sabe, porque os dados não vieram. */
  registrar(registro: number, falhas: DestinoDoAviso[], gestaoSemAviso: string[] | null): Promise<void>;
}

/** Os horários do aviso saem no fuso de Brasília, e o texto diz isso. */
const FUSO = 'America/Sao_Paulo';
const quando = (em: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: FUSO }).format(new Date(em));

/** Quem trocou: o nome pode ter sido mudado para imitar outra pessoa, o e-mail de acesso diz quem é de fato. */
const autor = (d: DadosDoAviso) => `${d.autor} (${d.autor_email})`;

/** O fato, nas palavras de cada situação. `de` diz de quem é a conta. */
const FATO: Record<SituacaoDaTroca, (d: DadosDoAviso, de: string) => string> = {
  trocada: (d, de) => `${autor(d)}, do escritório ${d.escritorio}, trocou o e-mail de acesso ${de} em ${quando(d.em)} (horário de Brasília).`,
  'nao-confirmada': (d, de) => `${autor(d)}, do escritório ${d.escritorio}, pediu a troca do e-mail de acesso ${de} em ${quando(d.em)} (horário de Brasília). O sistema não confirmou se ela foi concluída.`
};

/**
 * A troca encerra as sessões da conta, e as regras do banco só aceitam um token cuja sessão ainda existe (privado.sessao_ok), então
 * quem já estava conectado perde o acesso na hora. Vale também quando o login não confirmou a troca: as sessões saem antes de chamá-lo.
 */
const CONECTADOS = 'Quem já estava conectado perdeu o acesso na hora.';

/** O que a troca muda na conta: o e-mail antigo e a senha antiga deixam de valer (trocarEmailNoLogin em servidor.ts). */
const EFEITO: Record<SituacaoDaTroca, Record<DestinoDoAviso, string>> = {
  trocada: {
    antigo: `Este endereço e a senha antiga não dão mais acesso à conta. ${CONECTADOS} Quem pediu a troca cria uma senha nova em "Esqueci minha senha", com o e-mail novo.`,
    gestao: `A senha antiga deixou de valer. ${CONECTADOS} A pessoa cria uma senha nova em "Esqueci minha senha", com o e-mail novo.`
  },
  'nao-confirmada': {
    antigo: `${CONECTADOS} Se a troca foi concluída, este endereço e a senha antiga não dão mais acesso à conta.`,
    gestao: `${CONECTADOS} Se a troca foi concluída, a senha antiga deixou de valer, e a pessoa cria uma senha nova em "Esqueci minha senha", com o e-mail novo.`
  }
};

/** O texto de cada destino. */
const MODELOS: Record<DestinoDoAviso, { assunto: string; titulo: string; paragrafos(d: DadosDoAviso, s: SituacaoDaTroca): string[] }> = {
  antigo: {
    assunto: 'Aviso de segurança: troca do seu e-mail de acesso ao SEMPER',
    titulo: 'Troca do seu e-mail de acesso',
    paragrafos: (d, s) => [
      FATO[s](d, 'da sua conta no SEMPER'),
      EFEITO[s].antigo,
      'Se você não pediu ou não combinou essa troca, fale agora com a administração do escritório.'
    ]
  },
  gestao: {
    assunto: 'Aviso de segurança: troca do e-mail de acesso de um colega no SEMPER',
    titulo: 'Troca do e-mail de um colega',
    paragrafos: (d, s) => [
      FATO[s](d, `de ${d.alvo} no SEMPER`),
      EFEITO[s].gestao,
      'Se essa troca não foi combinada, confira o registro de ações em Equipe e acessos e fale com a pessoa. Se houver suspeita de invasão, desative nessa mesma tela o acesso da pessoa e, se a suspeita for da conta de quem fez a troca, o dessa conta também: desativar corta o acesso na hora. Só o master desativa um administrador, e um master não pode ser desativado.'
    ]
  }
};

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Os nomes vêm de quem os digitou: no HTML, viram só texto. */
const escapar = (v: string) => v.replace(/[&<>"']/g, c => ESCAPES[c]);

// As cores são as dos modelos de banco/emails: e-mail não lê as variáveis de estilo.
const emHtml = (titulo: string, paragrafos: string[]) => `<div style="margin:0;padding:16px 0;font-family:Lato,Arial,Helvetica,sans-serif;color:#1A1916">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #EBEBE6;border-radius:14px;overflow:hidden">
    <div style="background:#1A1916;padding:22px 28px">
      <span style="font-size:20px;font-weight:900;color:#FFFFFF;letter-spacing:.01em">SEMPER<span style="color:#5FAE3E">.</span></span>
    </div>
    <div style="padding:32px 28px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.18em;color:#6B6A63;text-transform:uppercase">Aviso de segurança</p>
      <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;font-weight:900">${titulo}</h1>
      ${paragrafos.map(p => `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#3D3B36">${escapar(p)}</p>`).join('\n      ')}
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EBEBE6;font-size:12px;color:#8A8981;line-height:1.6">
      SEMPER · semper.app.br<br>
      Este é um aviso automático. Não responda a este e-mail.
    </div>
  </div>
</div>`;

function mensagem(destino: DestinoDoAviso, para: string, dados: DadosDoAviso, situacao: SituacaoDaTroca): MensagemDoAviso {
  const { assunto, titulo, paragrafos } = MODELOS[destino];
  const corpo = paragrafos(dados, situacao);
  return { destino, para, assunto, texto: corpo.join('\n\n'), html: emHtml(titulo, corpo) };
}

/** Uma mensagem para cada endereço: quem recebe não vê quem mais recebeu. */
export const mensagensDoAviso = (dados: DadosDoAviso, situacao: SituacaoDaTroca): MensagemDoAviso[] => [
  mensagem('antigo', dados.email_antigo, dados, situacao),
  ...dados.gestao.map(para => mensagem('gestao', para, dados, situacao))
];

/** Só o código do erro vai para os registros do servidor: a mensagem de um erro de envio pode trazer o endereço de alguém. */
const registrarErro = (etapa: string, e: unknown) => console.error('aviso da troca de e-mail', etapa, (e as { code?: string } | null)?.code ?? 'sem código');

const TODOS_OS_DESTINOS: DestinoDoAviso[] = ['antigo', 'gestao'];

/**
 * Envia o aviso e guarda no registro de ações para quem ele não saiu. Nunca lança um erro: a troca já valeu e o aviso não a
 * desfaz. Se nem os dados do aviso vierem, ele não saiu para ninguém. No reenvio, `destinos` diz quem ainda falta.
 */
export async function avisarDaTroca(registro: number, situacao: SituacaoDaTroca, passos: PassosDoAviso, destinos = TODOS_OS_DESTINOS): Promise<void> {
  let falhas = destinos;
  let gestaoSemAviso: string[] | null = null;
  try {
    const dados = await passos.dados(registro);
    if (dados) {
      const mensagens = mensagensDoAviso(dados, situacao).filter(m => destinos.includes(m.destino));
      const envios = await Promise.allSettled(mensagens.map(m => passos.enviar(m)));
      const falhou = envios.flatMap((envio, i) => {
        if (envio.status === 'fulfilled') return [];
        registrarErro('envio', envio.reason);
        return [mensagens[i]];
      });
      falhas = [...new Set(falhou.map(m => m.destino))];
      gestaoSemAviso = falhou.filter(m => m.destino === 'gestao').map(m => m.para);
    } else {
      registrarErro('dados', null);
    }
  } catch (e) {
    registrarErro('dados', e);
  }
  try {
    await passos.registrar(registro, falhas, gestaoSemAviso);
  } catch (e) {
    registrarErro('registro', e);
  }
}

/** Reenvia os avisos pendentes, ao mesmo tempo, para caber no tempo máximo da função. Devolve quantos tentou. */
export async function reenviarAvisos(pendentes: AvisoPendente[], passos: PassosDoAviso): Promise<number> {
  await Promise.all(pendentes.map(p => avisarDaTroca(p.registro, p.situacao, passos, p.destinos)));
  return pendentes.length;
}

/** Confere a senha da rotina sem parar na primeira letra diferente, para o tempo da resposta não dar pistas. Sem senha certa, recusa. */
export function senhaDaRotinaConfere(recebida: string | null, certa: string | undefined): boolean {
  if (!recebida || !certa) return false;
  const a = new TextEncoder().encode(recebida), b = new TextEncoder().encode(certa);
  let diferenca = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferenca |= b[i] ^ (a[i] ?? 0);
  return diferenca === 0;
}
