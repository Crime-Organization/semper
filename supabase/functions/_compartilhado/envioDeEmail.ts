// O envio de e-mail pelas funções do servidor (Deno), pelo mesmo SMTP dos e-mails de acesso (veja "SMTP" no README.md).
// O Supabase bloqueia as portas 25 e 587 nas funções; a 465 (TLS direto) é a que a Hostinger usa e fica liberada.
// A versão do nodemailer vem fixa aqui: as funções do servidor não têm package.json.
import nodemailer from 'npm:nodemailer@10.1.7';

/** O servidor de envio; o segredo SMTP_SERVIDOR só é preciso para trocar de serviço ou testar sem a Hostinger. */
const SERVIDOR_PADRAO = 'smtp.hostinger.com';
const PORTA_COM_TLS = 465;
/** `nao-responda@` é um alias: o login (SMTP_USUARIO) é o da caixa principal, e o alias entra só como remetente. */
const REMETENTE = 'SEMPER <nao-responda@semper.app.br>';
/** Como o servidor se apresenta ao SMTP. Sem isto, o nodemailer tentaria descobrir o nome da máquina. */
const NOME_NO_SMTP = 'semper.app.br';
/** Quanto esperar o SMTP em cada passo (milissegundos): quem pediu a troca está esperando a resposta, e a troca já valeu. */
const ESPERA_DO_SMTP = 10_000;

/** Envia uma mensagem. Sem os segredos SMTP_USUARIO e SMTP_SENHA (o código SEM_SEGREDO_SMTP diz isso nos registros), ou se o SMTP recusar, lança um erro. */
export async function enviarEmail({ para, assunto, texto, html }: { para: string; assunto: string; texto: string; html: string }) {
  const user = Deno.env.get('SMTP_USUARIO'), pass = Deno.env.get('SMTP_SENHA');
  if (!user || !pass) throw Object.assign(new Error('Faltam os segredos do SMTP nas Edge Functions do Supabase.'), { code: 'SEM_SEGREDO_SMTP' });
  const transporte = nodemailer.createTransport({
    host: Deno.env.get('SMTP_SERVIDOR') ?? SERVIDOR_PADRAO, port: PORTA_COM_TLS, secure: true, name: NOME_NO_SMTP,
    auth: { user, pass },
    connectionTimeout: ESPERA_DO_SMTP, greetingTimeout: ESPERA_DO_SMTP, socketTimeout: ESPERA_DO_SMTP
  });
  await transporte.sendMail({ from: REMETENTE, to: para, subject: assunto, text: texto, html });
}
