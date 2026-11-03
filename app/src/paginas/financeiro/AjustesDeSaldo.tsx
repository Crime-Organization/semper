// Todos os ajustes de saldo do escritório, de todas as contas e meses: é por aqui que se confere a diferença na auditoria.
import { useEffect, useState } from 'react';
import { SD, type ContaFinanceira, type Lancamento } from '../../dados';
import { valorDoAjuste } from '../../regras/caixa';
import { fmtData } from '../../regras/pessoa';
import { Aviso, Carregando, Nota } from '../../ui/base';

export function AjustesDeSaldo({ contas, versao }: { contas: ContaFinanceira[]; versao: number }) {
  const [lista, setLista] = useState<Lancamento[] | string | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.financeiroAjustesDeSaldo().then(a => { if (vivo) setLista(a); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [versao]);

  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  if (!lista.length) return <Nota>Nenhum ajuste de saldo lançado.</Nota>;
  return <div className="tabela"><table aria-label="Todos os ajustes de saldo">
    <thead><tr>
      <th scope="col">Data</th><th scope="col">Conta</th><th scope="col">Motivo</th><th scope="col" className="financeiro-num">Ajuste</th>
    </tr></thead>
    <tbody>{lista.map(l => <tr key={l.id}>
      <td>{fmtData(l.data)}</td><td>{contas.find(c => c.id === l.conta_id)?.nome}</td><td>{l.descricao}</td><td className="financeiro-num">{valorDoAjuste(l)}</td>
    </tr>)}</tbody>
  </table></div>;
}
