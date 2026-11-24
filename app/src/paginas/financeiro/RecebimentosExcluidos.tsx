// A seção "Recebimentos excluídos" de "Contas, DAS e sócios" (#413): o que saiu do Caixa com os contratos excluídos (#284), lido da
// cópia escondida. Só para administradores: para os outros, nem aparece (e o banco devolve a lista vazia). Só leitura: ninguém muda
// nem apaga estas linhas. A lista é lida ao abrir a página, para o título mostrar a contagem mesmo com a seção fechada.
import { useEffect, useState } from 'react';
import { SD, type RecebimentoExcluido } from '../../dados';
import { linhaDoExcluido } from '../../regras/recebimentosExcluidos';
import { Aviso, Carregando, Nota, Selo } from '../../ui/base';
import { Recolhivel } from '../../ui/Recolhivel';
import { useCtx } from '../../ui/sessao';

export const TITULO_DOS_EXCLUIDOS = 'Recebimentos excluídos';

export function RecebimentosExcluidos() {
  const ctx = useCtx();
  const [lista, setLista] = useState<RecebimentoExcluido[] | string | null>(null);
  useEffect(() => {
    if (!ctx.ehAdmin) return;
    let vivo = true;
    SD.financeiroExcluidos().then(l => { if (vivo) setLista(l); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [ctx.ehAdmin]);

  if (!ctx.ehAdmin) return null;
  return <Recolhivel titulo={TITULO_DOS_EXCLUIDOS} icone="lixeira" preferencia="financeiro.excluidos" contador={Array.isArray(lista) ? lista.length : undefined}>
    <ListaDosExcluidos lista={lista} equipe={ctx.equipe} />
  </Recolhivel>;
}

function ListaDosExcluidos({ lista, equipe }: { lista: RecebimentoExcluido[] | string | null; equipe: readonly { id: string; nome: string }[] }) {
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  if (!lista.length) return <Nota>Nenhum recebimento saiu com um contrato excluído.</Nota>;
  // Lista empilhada, como a dos ajustes de saldo: no celular, o valor continua à vista.
  return <>
    <Nota>Cópia do que saiu do Caixa quando o contrato foi excluído. Só para conferir: nada aqui muda os saldos.</Nota>
    <ul className="financeiro-lista" aria-label={TITULO_DOS_EXCLUIDOS}>{lista.map(r => {
      const l = linhaDoExcluido(r, equipe);
      return <li key={l.id}>
        <span>{[l.data, l.contrato, l.parcela, l.conta].filter(Boolean).join(' · ')} {l.selos.map(s => <Selo key={s} tipo="arq">{s}</Selo>)}</span>
        <b className="financeiro-num">{l.valor}</b>
        <Nota className="financeiro-linha-inteira">Excluído por {l.quem} em {l.excluidoEm}</Nota>
      </li>;
    })}</ul>
  </>;
}
