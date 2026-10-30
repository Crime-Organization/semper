// O histórico de alterações de um cartão (demanda, tarefa...): quando, quem e o que mudou, campo a campo, com o valor
// de antes riscado. Cada módulo passa como ler o histórico, o nome de cada campo e como mostrar os valores.
import { useEffect, useState } from 'react';
import type { Historico } from '../dados';
import { Aviso, Carregando, Nota } from '../ui/base';
import { useCtx } from '../ui/sessao';
import { dataHora } from '../ui/util';

interface Props {
  carregar: () => Promise<Historico[]>;
  /** Nome de cada campo (o que não está aqui aparece como foi guardado). */
  campos: Record<string, string>;
  /** Como o valor de cada campo aparece (ex.: a data como dia/mês/ano, vazio como traço). */
  valor: (campo: string, v: unknown) => string;
  /** Muda quando o cartão muda: recarrega o histórico. */
  versao: number;
}

export function HistoricoDoCartao({ carregar, campos, valor, versao }: Props) {
  const ctx = useCtx();
  const [hist, setHist] = useState<Historico[] | string | null>(null);
  const nomeDe = (pid: string) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  useEffect(() => {
    let vivo = true;
    carregar().then(h => { if (vivo) setHist(h); }).catch(e => { if (vivo) setHist((e as Error).message); });
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- recarrega quando o cartão muda (versao), não a cada desenho
  }, [versao]);

  if (hist === null) return <Carregando />;
  if (typeof hist === 'string') return <Aviso tipo="erro">{hist}</Aviso>;
  if (!hist.length) return <Nota>Nenhuma alteração desde o cadastro.</Nota>;
  return <ol className="hist">{hist.map(h => <li key={h.id}>
    <span className="quando">{dataHora(h.em)} · {h.feito_por ? nomeDe(h.feito_por) : 'Sistema'}</span>
    {Object.entries(h.alteracoes).map(([campo, v]) => {
      if (campo === 'arquivado_em') return <div key={campo}>{v.para ? 'Arquivada' : 'Desarquivada'}</div>;
      const de = valor(campo, v.de), para = valor(campo, v.para);
      return <div key={campo}><b>{campos[campo] || campo}:</b> {de !== '—' && <><span className="de">{de}</span> → </>}{para}</div>;
    })}
  </li>)}</ol>;
}
