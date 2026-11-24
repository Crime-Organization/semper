// O calendário do INPI para os prazos de propriedade intelectual em dias úteis (#418): busca o órgão INPI de Feriados e prazos e os dias
// que o escritório lançou nos anos que os prazos atravessam. Serve ao cartão do processo e ao cadastro do compromisso que nasce do prazo.
// As contas ficam em regras/propriedadeIntelectual.ts; aqui só se busca.
import { useEffect, useState } from 'react';
import { SD } from '../../dados';
import { calendarioDoInpi, SO_FERIADOS_NACIONAIS, type CalendarioDoInpi } from '../../regras/propriedadeIntelectual';
import { falha } from '../../ui/avisos';

/** Lê o calendário do INPI nos anos pedidos (sem anos, não há o que buscar: só os feriados nacionais). */
export async function lerCalendarioDoInpi(anos: readonly number[]): Promise<CalendarioDoInpi> {
  if (!anos.length) return SO_FERIADOS_NACIONAIS;
  const [orgaos, dias] = await Promise.all([SD.orgaosListar(), SD.diasListar(`${anos[0]}-01-01`, `${anos[anos.length - 1]}-12-31`)]);
  return calendarioDoInpi(orgaos, dias);
}

/**
 * Se o calendário já chegou: "lendo" enquanto busca, "falhou" se a leitura deu erro (a conta fica só com os feriados nacionais, e o cartão
 * não oferece pôr nem atualizar datas na agenda com ela), "pronto" quando chegou ou quando não havia o que buscar.
 */
export type SituacaoDoCalendario = 'lendo' | 'pronto' | 'falhou';
/** O calendário e a situação dele: enquanto não chega (ou se falhar), o calendário é só o dos feriados nacionais. */
export interface CalendarioLido { calendario: CalendarioDoInpi; situacao: SituacaoDoCalendario }

/** O calendário do INPI nos anos pedidos (#418): o cartão só põe ou atualiza datas na agenda com ele pronto. */
export function useCalendarioDoInpi(anos: readonly number[]): CalendarioLido {
  const chave = anos.join(',');
  const [lido, setLido] = useState<{ chave: string } & CalendarioLido | null>(null);
  useEffect(() => {
    if (!chave) return;
    let vale = true;
    lerCalendarioDoInpi(chave.split(',').map(Number))
      .then(calendario => { if (vale) setLido({ chave, calendario, situacao: 'pronto' }); })
      .catch(e => { if (vale) setLido({ chave, calendario: SO_FERIADOS_NACIONAIS, situacao: 'falhou' }); falha(e); });
    return () => { vale = false; };
  }, [chave]);
  if (!chave) return { calendario: SO_FERIADOS_NACIONAIS, situacao: 'pronto' };
  return lido?.chave === chave ? { calendario: lido.calendario, situacao: lido.situacao } : { calendario: SO_FERIADOS_NACIONAIS, situacao: 'lendo' };
}
