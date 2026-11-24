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

/** O calendário do INPI nos anos pedidos; enquanto ele não chega (ou se a leitura falhar), só os feriados nacionais. */
export function useCalendarioDoInpi(anos: readonly number[]): CalendarioDoInpi {
  const chave = anos.join(',');
  const [lido, setLido] = useState<{ chave: string; calendario: CalendarioDoInpi } | null>(null);
  useEffect(() => {
    if (!chave) return;
    let vale = true;
    lerCalendarioDoInpi(chave.split(',').map(Number))
      .then(calendario => { if (vale) setLido({ chave, calendario }); })
      .catch(falha);
    return () => { vale = false; };
  }, [chave]);
  return lido?.chave === chave ? lido.calendario : SO_FERIADOS_NACIONAIS;
}
