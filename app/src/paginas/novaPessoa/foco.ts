// O cursor ao abrir uma etapa do cadastro de pessoa (#405): vai ao primeiro campo da etapa, logo depois de ela ser desenhada,
// mas só se a pessoa ainda não estiver num campo dela. Sem essa conferência, quem clicava ou digitava num campo nesse instante
// tinha o cursor puxado de volta ao primeiro, e o texto ia para o lugar errado (o CNPJ no fim do Nome).
import { SEGUNDO } from '../../ui/tempos';

/** Quanto o cadastro espera, depois de abrir a etapa, para pôr o cursor no primeiro campo dela. */
export const ESPERA_PARA_FOCAR_A_ETAPA = 0.05 * SEGUNDO;

/** O primeiro campo de digitar ou de escolher da etapa (sem as bolinhas e as caixas de marcar). */
const PRIMEIRO_CAMPO = 'input:not([type="radio"]):not([type="checkbox"]), select';

/** Põe o cursor no primeiro campo da etapa, a não ser que o cursor já esteja dentro dela. */
export function focarPrimeiroCampo(etapa: Element | null, ativo: Element | null = document.activeElement): void {
  if (!etapa || (ativo && ativo !== etapa && etapa.contains(ativo))) return;
  etapa.querySelector<HTMLElement>(PRIMEIRO_CAMPO)?.focus({ preventScroll: true });
}
