// Preferências de cada usuário (tema, visualização escolhida, seções abertas do cartão...).
// Ficam no perfil, valem em qualquer aparelho, e esta cópia em memória é a que as telas leem:
// assim uma escolha feita agora já vale ao voltar para a tela, sem reler o banco.
import { SD } from '../dados';

let atuais: Record<string, unknown> = {};

/** Chamado pela sessão sempre que o perfil é lido. */
export function iniciarPreferencias(preferencias: Record<string, unknown> | null | undefined) {
  atuais = { ...preferencias };
}

export function lerPreferencia<T>(chave: string, padrao: T): T {
  return chave in atuais ? atuais[chave] as T : padrao;
}

/** Para escolhas que o servidor lê (os e-mails de prazo): espera gravar e, se o banco falhar, lança o erro e nada muda. */
export async function gravarPreferencia(chave: string, valor: unknown) {
  await SD.salvarPreferencia(chave, valor);
  atuais = { ...atuais, [chave]: valor };
}

/** Vale na hora; gravar no perfil é em segundo plano: se o banco falhar, a escolha só não fica para a próxima visita. */
export function salvarPreferencia(chave: string, valor: unknown) {
  atuais = { ...atuais, [chave]: valor };
  SD.salvarPreferencia(chave, valor).catch(() => { /* fica só nesta visita */ });
}
