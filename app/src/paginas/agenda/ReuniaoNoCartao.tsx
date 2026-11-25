// A reunião do Google Meet no cartão do compromisso (#437), como uma linha dos "Dados do compromisso": o link (que abre o Meet
// numa aba nova) com a gravação, ou o que está acontecendo com ela (o link sendo criado, a reunião cancelada). O que mostrar é
// decidido em regras/reuniaoGoogle.ts.
import type { ReuniaoNoCartao as Reuniao } from '../../regras/reuniaoGoogle';
import { Nota } from '../../ui/base';

/** Dentro do <dl> dos dados do compromisso: nada sem a opção marcada. */
export function ReuniaoNoCartao({ reuniao }: { reuniao: Reuniao }) {
  if (!reuniao) return null;
  return <>
    <dt>Google Meet</dt>
    <dd>{'link' in reuniao
      ? <>
        <a href={reuniao.link} target="_blank" rel="noopener noreferrer">{reuniao.link}</a>
        {reuniao.gravacao && <Nota>{reuniao.gravacao}</Nota>}
      </>
      : reuniao.texto}</dd>
  </>;
}
