// E-mails de prazo (#113): o aviso diário e o resumo de sexta-feira. Quem chama é a rotina do banco, de 5 em 5 minutos nos horários
// combinados (privado.chamar_emails_de_prazo), com a senha da rotina: o segredo SENHA_DA_ROTINA aqui, e o mesmo valor no Vault.
// Não há login de pessoa (verify_jwt = false no config.toml), então, sem a senha certa, nada acontece.
import { senhaDaRotinaConfere } from '../_compartilhado/avisoDaTroca.ts';
import { enviarEmail } from '../_compartilhado/envioDeEmail.ts';
import { enviarEmailsDePrazo, ITENS_POR_SECAO, PESSOAS_POR_CHAMADA, tipoDeEnvioValido, type EmailDiario, type PassosDosEmails, type ResumoSemanal } from '../_compartilhado/emailsDePrazo.ts';
import { json, rpc } from '../_compartilhado/servidor.ts';

const PASSOS: PassosDosEmails = {
  diarios: () => rpc<EmailDiario[]>('prazos_emails_a_enviar', { p_limite: PESSOAS_POR_CHAMADA }),
  resumos: () => rpc<ResumoSemanal[]>('prazos_resumos_a_enviar', { p_limite: PESSOAS_POR_CHAMADA, p_itens: ITENS_POR_SECAO }),
  enviar: enviarEmail,
  marcarDiario: ids => rpc<void>('prazos_emails_enviados', { p_ids: ids }),
  marcarResumo: id => rpc<void>('prazos_resumo_enviado', { p_id: id })
};

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ resultado: 'erro' }, 405);
  if (!senhaDaRotinaConfere(req.headers.get('x-senha-da-rotina'), Deno.env.get('SENHA_DA_ROTINA'))) return json({ resultado: 'sem-permissao' }, 401);
  const { tipo } = await req.json().catch(() => ({})) as { tipo?: unknown };
  if (!tipoDeEnvioValido(tipo)) return json({ resultado: 'erro' }, 400);
  try {
    const feito = await enviarEmailsDePrazo(PASSOS, tipo);
    // Falhou tudo o que havia para enviar: a resposta mostra, em net._http_response, que algo está errado (senha do SMTP, por exemplo).
    return json({ resultado: feito.falhas && !feito.enviados ? 'falhou' : 'ok', ...feito }, feito.falhas && !feito.enviados ? 502 : 200);
  } catch (e) {
    console.error('prazos-enviar-emails', (e as Error).message);
    return json({ resultado: 'erro' }, 500);
  }
});
