// Regras da página pública (semper.app.br, rota "/"): quem vai direto para a entrada e como o pedido de demonstração
// vira uma conversa (e-mail ou WhatsApp). Puras: a tela só chama e abre o endereço.

/** Parâmetros dos links do sistema (convite, e-mails, volta depois do login): quem chega com um deles vai para a entrada. */
export const PARAMETROS_DA_ENTRADA = ['primeiro-acesso', 'token_hash', 'nova-senha', 'recuperar', 'volta', 'desativado', 'encerrada', 'cliente'] as const;
/** O que o Supabase põe depois do # num link de convite ou de recuperação de senha. */
const NO_ENDERECO_DA_ENTRADA = /access_token|convite=|error_description/;

/** O endereço (a parte depois do ? e a depois do #) é de um link do sistema, que deve abrir a entrada, e não a página pública. */
export function levaParaEntrada(busca: string, ancora: string) {
  const parametros = new URLSearchParams(busca);
  return PARAMETROS_DA_ENTRADA.some(p => parametros.has(p)) || NO_ENDERECO_DA_ENTRADA.test(ancora);
}

/** O tamanho da equipe, como a pessoa escolhe no pedido de demonstração. */
export const TAMANHOS_DA_EQUIPE = ['até 5 pessoas', 'mais de 5 pessoas'] as const;
export type TamanhoDaEquipe = (typeof TAMANHOS_DA_EQUIPE)[number];

/** O assunto do e-mail do pedido. */
export const ASSUNTO_DO_PEDIDO = 'Quero uma demonstração do SEMPER';

/** O texto que abre a conversa: com o nome do escritório e, se a pessoa disse, o tamanho da equipe. */
export function mensagemDoPedido(escritorio: string, equipe?: TamanhoDaEquipe) {
  const nome = escritorio.trim().replace(/\s+/g, ' ');
  const quem = nome ? `o escritório ${nome}` : 'o meu escritório';
  return `Olá! Quero uma demonstração do SEMPER para ${quem}${equipe ? ` (equipe de ${equipe})` : ''}.`;
}

export interface CanaisDeContato { whatsapp: string; email: string }
export interface Conversa { endereco: string; novaAba: boolean; canal: 'WhatsApp' | 'e-mail' }

/** Onde a conversa abre: no WhatsApp, se o número estiver preenchido (só os algarismos); senão, no e-mail. */
export function conversaDoPedido(canais: CanaisDeContato, mensagem: string): Conversa {
  const numero = canais.whatsapp.replace(/\D/g, '');
  if (numero) return { endereco: `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, novaAba: true, canal: 'WhatsApp' };
  return {
    endereco: `mailto:${canais.email}?subject=${encodeURIComponent(ASSUNTO_DO_PEDIDO)}&body=${encodeURIComponent(mensagem)}`,
    novaAba: false, canal: 'e-mail'
  };
}
