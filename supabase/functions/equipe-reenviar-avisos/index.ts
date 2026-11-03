// Reenvio dos avisos de troca de e-mail que falharam ou não foram confirmados (#226). Quem chama é a rotina do banco, a cada 15
// minutos (privado.chamar_reenvio_de_avisos), com a senha da rotina: o segredo SENHA_DA_ROTINA aqui, e o mesmo valor no Vault.
// Não há login de pessoa (verify_jwt = false no config.toml), então, sem a senha certa, nada acontece.
import { reenviarAvisos, senhaDaRotinaConfere, type AvisoPendente } from '../_compartilhado/avisoDaTroca.ts';
import { PASSOS_DO_AVISO } from '../_compartilhado/avisoNoServidor.ts';
import { json, rpc } from '../_compartilhado/servidor.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ resultado: 'erro' }, 405);
  if (!senhaDaRotinaConfere(req.headers.get('x-senha-da-rotina'), Deno.env.get('SENHA_DA_ROTINA'))) return json({ resultado: 'sem-permissao' }, 401);
  try {
    const pendentes = await rpc<AvisoPendente[]>('equipe_email_avisos_pendentes', {});
    return json({ resultado: 'ok', reenviados: await reenviarAvisos(pendentes, PASSOS_DO_AVISO) });
  } catch (e) {
    console.error('equipe-reenviar-avisos', (e as Error).message);
    return json({ resultado: 'erro' }, 500);
  }
});
