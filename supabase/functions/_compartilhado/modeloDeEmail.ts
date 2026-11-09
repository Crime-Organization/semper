// A moldura dos e-mails das funções do servidor. Sem Deno e sem rede: dá para testar no app.

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Nomes e títulos vêm de quem os digitou: no HTML, viram só texto. */
export const escapar = (v: string) => v.replace(/[&<>"']/g, c => ESCAPES[c]);

/**
 * O e-mail pronto. As cores são as dos modelos de banco/emails: e-mail não lê as variáveis de estilo.
 * `chapeu` e `titulo` são textos nossos; `corpo` já vem em HTML, com o que veio de quem digitou já escapado.
 */
export const molduraDoEmail = (chapeu: string, titulo: string, corpo: string) => `<div style="margin:0;padding:16px 0;font-family:Lato,Arial,Helvetica,sans-serif;color:#1A1916">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #EBEBE6;border-radius:14px;overflow:hidden">
    <div style="background:#1A1916;padding:22px 28px">
      <span style="font-size:20px;font-weight:900;color:#FFFFFF;letter-spacing:.01em">SEMPER<span style="color:#5FAE3E">.</span></span>
    </div>
    <div style="padding:32px 28px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.18em;color:#6B6A63;text-transform:uppercase">${chapeu}</p>
      <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;font-weight:900">${titulo}</h1>
      ${corpo}
    </div>
    <div style="padding:18px 28px;border-top:1px solid #EBEBE6;font-size:12px;color:#8A8981;line-height:1.6">
      SEMPER · semper.app.br<br>
      Este é um aviso automático. Não responda a este e-mail.
    </div>
  </div>
</div>`;

/** Um parágrafo de texto, já escapado. */
export const paragrafoDoEmail = (texto: string) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#3D3B36">${escapar(texto)}</p>`;
