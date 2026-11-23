// No cartão do processo de propriedade intelectual (#317), a seção "Validade e anuidades": a validade, o próximo prazo a cumprir e a
// lista de todos os prazos (anuidades, quinquênio, prorrogações, pedido de exame), cada um com a situação de hoje. As contas são as
// de regras/propriedadeIntelectual.ts; aqui só se mostra. As datas são estimativas: o cartão manda conferir na RPI. Embaixo, o
// "Acompanhar na agenda" (parte C, com a #307) abre o cadastro do compromisso que se repete, já preenchido com os prazos; se o processo
// já tem esse compromisso, o cartão diz qual, em vez de oferecer outro. O prazo que já está no prazo extra (com taxa), mais urgente, ganha
// antes o seu atalho: um compromisso só, no último dia do prazo extra (a série começa no prazo seguinte).
import { Fragment, useEffect, useState } from 'react';
import { SD, type CompromissoLigado } from '../../dados';
import {
  compromissoDoAcompanhamento, descreverAcompanhamento, descreverPrazoExtra, prazoPorExtenso, proximoPrazo, situacaoDoPrazo, SITUACOES_DO_PRAZO,
  type AcompanhamentoDaProtecao, type PrazoExtraDaProtecao, type PrazosDaProtecao
} from '../../regras/propriedadeIntelectual';
import { nomeDoCompromisso } from '../../regras/compromisso';
import { fmtData } from '../../regras/pessoa';
import { Nota, Selo } from '../../ui/base';
import { AcoesDosLigados } from '../../ui/ItensLigados';

/** O aviso de que as datas são da lei e precisam ser conferidas. */
export const AVISO_DAS_DATAS_DO_INPI = 'Datas calculadas pela lei, para acompanhar: confira sempre na Revista da Propriedade Industrial (RPI). '
  + 'O prazo que vence em dia sem expediente no INPI passa para o próximo dia útil.';

/**
 * O que o cartão passa para oferecer os compromissos dos prazos: o processo, se gera demanda e, cada um com o endereço do cadastro, a série
 * dos prazos e o prazo que está no prazo extra (null: não há).
 */
export interface AcompanharNaAgenda {
  processoId: string;
  comDemanda: boolean;
  serie: { acompanhamento: AcompanhamentoDaProtecao; para: string } | null;
  extra: { prazo: PrazoExtraDaProtecao; para: string } | null;
}

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

/** Os atalhos para acompanhar os prazos na agenda (o prazo extra e a série), ou os compromissos que já os acompanham. */
function AcompanharOsPrazos({ processoId, comDemanda, serie, extra }: AcompanharNaAgenda) {
  // undefined: ainda lendo os compromissos do processo (o atalho só aparece depois, para não oferecer um segundo).
  const [ligados, setLigados] = useState<CompromissoLigado[] | undefined>();
  useEffect(() => {
    let vale = true;
    SD.compromissosDoProcesso(processoId).then(l => { if (vale) setLigados(l); }).catch(() => { if (vale) setLigados([]); });
    return () => { vale = false; };
  }, [processoId]);
  if (!ligados) return null;
  const jaExtra = extra && compromissoDoAcompanhamento(ligados, extra.prazo), ja = serie && compromissoDoAcompanhamento(ligados, serie.acompanhamento);
  return <>
    {extra && (jaExtra
      ? <Nota>O prazo extra já está na agenda: {nomeDoCompromisso(jaExtra)}, na seção "Compromissos".</Nota>
      : <>
        <Nota>{descreverPrazoExtra(extra.prazo)}</Nota>
        <AcoesDosLigados novo={{ para: extra.para, rotulo: 'Pôr o prazo extra na agenda' }} />
      </>)}
    {serie && (ja
      ? <Nota>Estes prazos já estão na agenda: {nomeDoCompromisso(ja)}, na seção "Compromissos".</Nota>
      : <>
        <Nota>{descreverAcompanhamento(serie.acompanhamento, comDemanda)}</Nota>
        <AcoesDosLigados novo={{ para: serie.para, rotulo: 'Acompanhar na agenda' }} />
      </>)}
  </>;
}
