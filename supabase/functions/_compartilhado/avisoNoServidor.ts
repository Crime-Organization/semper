// Os passos reais do aviso de troca de e-mail: o banco conta o que houve e guarda o resultado, o SMTP envia.
// Usados pelas funções equipe-trocar-email (o primeiro envio) e equipe-reenviar-avisos (os reenvios).
import type { DadosDoAviso, PassosDoAviso } from './avisoDaTroca.ts';
import { enviarEmail } from './envioDeEmail.ts';
import { rpc } from './servidor.ts';

export const PASSOS_DO_AVISO: PassosDoAviso = {
  dados: registro => rpc<DadosDoAviso | null>('equipe_email_aviso_dados', { p_registro: registro }),
  enviar: enviarEmail,
  registrar: (registro, falhas) => rpc<void>('equipe_email_aviso_resultado', { p_registro: registro, p_falhas: falhas })
};
