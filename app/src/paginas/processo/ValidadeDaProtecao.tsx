// No cartão do processo de propriedade intelectual (#317), a seção "Validade e anuidades": a validade, o próximo prazo a cumprir e a
// lista de todos os prazos (anuidades, quinquênio, prorrogações, pedido de exame), cada um com a situação de hoje. As contas são as
// de regras/propriedadeIntelectual.ts; aqui só se mostra. As datas são estimativas: o cartão manda conferir na RPI. Embaixo, o
// "Acompanhar na agenda" (parte C, com a #307) abre o cadastro do compromisso que se repete, já preenchido com os prazos; se o processo
// já tem esse compromisso, o cartão diz qual, em vez de oferecer outro.
import { Fragment, useEffect, useState } from 'react';
import { SD, type CompromissoLigado } from '../../dados';
import {
  compromissoDoAcompanhamento, descreverAcompanhamento, prazoPorExtenso, proximoPrazo, situacaoDoPrazo, SITUACOES_DO_PRAZO,
  type AcompanhamentoDaProtecao, type PrazosDaProtecao
} from '../../regras/propriedadeIntelectual';
import { nomeDoCompromisso } from '../../regras/compromisso';
import { fmtData } from '../../regras/pessoa';
import { Nota, Selo } from '../../ui/base';
import { AcoesDosLigados } from '../../ui/ItensLigados';

/** O aviso de que as datas são da lei e precisam ser conferidas. */
export const AVISO_DAS_DATAS_DO_INPI = 'Datas calculadas pela lei, para acompanhar: confira sempre na Revista da Propriedade Industrial (RPI). '
  + 'O prazo que vence em dia sem expediente no INPI passa para o próximo dia útil.';

/** O que o cartão passa para oferecer o compromisso que se repete: o processo, o que será criado, o endereço do cadastro e se gera demanda. */
export interface AcompanharNaAgenda { processoId: string; acompanhamento: AcompanhamentoDaProtecao; para: string; comDemanda: boolean }

export function ValidadeDaProtecao({ prazos, hoje, acompanhar }: { prazos: PrazosDaProtecao; hoje: string; acompanhar?: AcompanharNaAgenda | null }) {
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
    {acompanhar && <AcompanharOsPrazos {...acompanhar} />}
  </>;
}

/** O atalho para acompanhar os prazos na agenda, ou o compromisso que já os acompanha. */
function AcompanharOsPrazos({ processoId, acompanhamento, para, comDemanda }: AcompanharNaAgenda) {
  // undefined: ainda lendo os compromissos do processo (o atalho só aparece depois, para não oferecer um segundo).
  const [ligados, setLigados] = useState<CompromissoLigado[] | undefined>();
  useEffect(() => {
    let vale = true;
    SD.compromissosDoProcesso(processoId).then(l => { if (vale) setLigados(l); }).catch(() => { if (vale) setLigados([]); });
    return () => { vale = false; };
  }, [processoId]);
  if (!ligados) return null;
  const ja = compromissoDoAcompanhamento(ligados, acompanhamento);
  if (ja) return <Nota>Estes prazos já estão na agenda: {nomeDoCompromisso(ja)}, na seção "Compromissos".</Nota>;
  return <>
    <Nota>{descreverAcompanhamento(acompanhamento, comDemanda)}</Nota>
    <AcoesDosLigados novo={{ para, rotulo: 'Acompanhar na agenda' }} />
  </>;
}
