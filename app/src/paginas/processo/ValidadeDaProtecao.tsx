// No cartão do processo de propriedade intelectual (#317), a seção "Validade e anuidades": a validade, o próximo prazo a cumprir e a
// lista de todos os prazos (anuidades, quinquênio, prorrogações, pedido de exame), cada um com a situação de hoje. As contas são as
// de regras/propriedadeIntelectual.ts; aqui só se mostra. As datas são estimativas: o cartão manda conferir na RPI.
import { Fragment } from 'react';
import { prazoPorExtenso, proximoPrazo, situacaoDoPrazo, SITUACOES_DO_PRAZO, type PrazosDaProtecao } from '../../regras/propriedadeIntelectual';
import { fmtData } from '../../regras/pessoa';
import { Nota, Selo } from '../../ui/base';

/** O aviso de que as datas são da lei e precisam ser conferidas. */
export const AVISO_DAS_DATAS_DO_INPI = 'Datas calculadas pela lei, para acompanhar: confira sempre na Revista da Propriedade Industrial (RPI). '
  + 'O prazo que vence em dia sem expediente no INPI passa para o próximo dia útil.';

export function ValidadeDaProtecao({ prazos, hoje }: { prazos: PrazosDaProtecao; hoje: string }) {
  if (prazos.falta) return <Nota>{prazos.falta}</Nota>;
  const proximo = proximoPrazo(prazos.datas, hoje);
  const linhas: [string, string][] = [
    ...(prazos.validade ? [[prazos.validade.rotulo, fmtData(prazos.validade.data)] as [string, string]] : []),
    ...(proximo ? [['Próximo prazo', `${proximo.nome}: ${prazoPorExtenso(proximo)}`] as [string, string]] : [])
  ];
  return <>
    <dl className="dados">{linhas.map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
    {prazos.datas.length > 0 && <div className="tabela"><table aria-label="Prazos do INPI">
      <thead><tr><th scope="col">Prazo</th><th scope="col">De</th><th scope="col">Até</th><th scope="col">Com taxa extra até</th><th scope="col">Situação</th></tr></thead>
      <tbody>{prazos.datas.map(x => {
        const situacao = SITUACOES_DO_PRAZO[situacaoDoPrazo(x, hoje)];
        return <tr key={x.nome}>
          <td>{x.nome}</td><td>{fmtData(x.inicio)}</td><td>{fmtData(x.fim)}</td><td>{x.fimExtra ? fmtData(x.fimExtra) : '—'}</td>
          <td><Selo tipo={situacao.selo}>{situacao.nome}</Selo></td>
        </tr>;
      })}</tbody>
    </table></div>}
    <Nota>{AVISO_DAS_DATAS_DO_INPI}</Nota>
  </>;
}
