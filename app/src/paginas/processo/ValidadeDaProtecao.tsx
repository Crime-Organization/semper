// No cartão do processo de propriedade intelectual (#317), a seção "Validade e anuidades": a validade, o próximo prazo a cumprir e a
// lista de todos os prazos (anuidades, quinquênio, prorrogações, pedido de exame e, na marca ainda não concedida, o prazo após o
// deferimento, #418), cada um com a situação de hoje. As contas são as de regras/propriedadeIntelectual.ts; aqui só se mostra. As datas
// são estimativas: o cartão manda conferir na RPI. Embaixo, o "Acompanhar na agenda" (parte C, com a #307) abre o cadastro do
// compromisso que se repete, já preenchido com os prazos; se o processo já tem esse compromisso, o cartão diz qual, em vez de oferecer
// outro. O prazo que já está no prazo extra (com taxa), mais urgente, ganha antes o seu atalho: um compromisso só, no último dia do prazo
// extra (a série começa no prazo seguinte). O prazo após o deferimento também ganha o seu (um compromisso só, sem falar em taxa).
// Os compromissos já criados acompanham as datas (#418): quando o depósito, a concessão ou o deferimento mudam e a conta dá outra data,
// o cartão oferece atualizar esta e as seguintes; com a concessão informada, oferece concluir o compromisso do prazo após o deferimento.
import { Fragment, useEffect, useState } from 'react';
import { SD, type Coluna, type CompromissoLigado, type Historico } from '../../dados';
import {
  compromissoAConcluir, compromissoDoAcompanhamento, dataParaAtualizar, descreverAcompanhamento, descreverDataParaAtualizar, descreverPrazoAposODeferimento,
  descreverPrazoExtra, extraNaTabela, prazoPorExtenso, proximoPrazo, situacaoDoPrazo, SITUACOES_DO_PRAZO,
  type AcompanhamentoDaProtecao, type DataParaAtualizar, type PrazoExtraDaProtecao, type PrazosDaProtecao
} from '../../regras/propriedadeIntelectual';
import { nomeDoCompromisso } from '../../regras/compromisso';
import { fmtData } from '../../regras/pessoa';
import { avisar, falha } from '../../ui/avisos';
import { Aviso, BotaoLink, Carregando, Nota, Selo } from '../../ui/base';
import { Botao } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { AcoesDosLigados } from '../../ui/ItensLigados';
import type { SituacaoDoCalendario } from './useCalendarioDoInpi';

/** O aviso de que as datas são da lei e precisam ser conferidas. */
export const AVISO_DAS_DATAS_DO_INPI = 'Datas calculadas pela lei, para acompanhar: confira sempre na Revista da Propriedade Industrial (RPI). '
  + 'O prazo que vence em dia sem expediente no INPI passa para o próximo dia útil; os prazos em dias contam só os dias úteis.';

/**
 * O que o cartão passa para oferecer os compromissos dos prazos: o processo, se gera demanda e, cada um com o endereço do cadastro, a série
 * dos prazos, o prazo que está no prazo extra e o prazo após o deferimento (null: não há). `concluir`: com a concessão informada, o título
 * do compromisso do prazo após o deferimento que o cartão oferece concluir.
 */
export interface AcompanharNaAgenda {
  processoId: string;
  comDemanda: boolean;
  hoje: string;
  serie: { acompanhamento: AcompanhamentoDaProtecao; para: string } | null;
  extra: { prazo: PrazoExtraDaProtecao; para: string } | null;
  deferimento: { prazo: PrazoExtraDaProtecao; para: string } | null;
  concluir: string | null;
  /** Depois de mudar um compromisso (atualizar as datas ou concluir): o cartão relê o que mostra. */
  aoMudar?: () => void;
  /**
   * A versão do cartão (a que as outras seções usam): muda quando algo do cartão mudou fora desta seção (um compromisso tirado do processo na
   * seção "Compromissos", um desfazer). A seção relê os compromissos, para não oferecer o que já foi feito.
   */
  versaoDoCartao?: number;
}

/** O aviso de quando o calendário do INPI não pôde ser lido: a conta fica só com os feriados nacionais. */
export const CALENDARIO_DO_INPI_FALHOU = 'Não foi possível ler os dias sem expediente do INPI em Feriados e prazos: as datas abaixo contam só os feriados '
  + 'nacionais, e o cartão não põe nem atualiza datas na agenda com elas. Atualize a página para tentar de novo.';

interface Props {
  prazos: PrazosDaProtecao;
  hoje: string;
  acompanhar?: AcompanharNaAgenda | null;
  /** O calendário do INPI (#418): enquanto ele é lido, a seção espera; se a leitura falhou, mostra a conta sem oferecer a agenda. */
  calendario?: SituacaoDoCalendario;
}

export function ValidadeDaProtecao({ prazos, hoje, acompanhar, calendario = 'pronto' }: Props) {
  // Com o calendário ainda chegando, a conta mudaria de data diante da pessoa (e o atalho gravaria a data errada).
  if (calendario === 'lendo') return <Carregando />;
  const proximo = proximoPrazo(prazos.datas, hoje);
  const linhas: [string, string][] = [
    ...(prazos.validade ? [[prazos.validade.rotulo, fmtData(prazos.validade.data)] as [string, string]] : []),
    ...(proximo ? [['Próximo prazo', `${proximo.nome}: ${prazoPorExtenso(proximo)}`] as [string, string]] : [])
  ];
  return <>
    {calendario === 'falhou' && <Aviso tipo="erro">{CALENDARIO_DO_INPI_FALHOU}</Aviso>}
    {prazos.falta && <Nota>{prazos.falta}</Nota>}
    {linhas.length > 0 && <dl className="dados">{linhas.map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>}
    {prazos.datas.length > 0 && <div className="tabela"><table aria-label="Prazos do INPI">
      <thead><tr><th scope="col">Prazo</th><th scope="col">De</th><th scope="col">Até</th><th scope="col">Prazo extra até</th><th scope="col">Situação</th></tr></thead>
      <tbody>{prazos.datas.map(x => {
        const situacao = SITUACOES_DO_PRAZO[situacaoDoPrazo(x, hoje)];
        return <tr key={x.nome}>
          <td>{x.nome}</td><td>{fmtData(x.inicio)}</td><td>{fmtData(x.fim)}</td><td>{extraNaTabela(x)}</td>
          <td><Selo tipo={situacao.selo}>{situacao.nome}</Selo></td>
        </tr>;
      })}</tbody>
    </table></div>}
    {(linhas.length > 0 || prazos.datas.length > 0) && <Nota>{AVISO_DAS_DATAS_DO_INPI}</Nota>}
    {acompanhar && calendario === 'pronto' && <AcompanharOsPrazos {...acompanhar} />}
  </>;
}

/**
 * O que os compromissos do processo já são: a lista, a coluna de concluído do quadro de compromissos (só lida quando há o que concluir) e o
 * histórico do processo (para saber se as datas dele mudaram depois da última mudança do compromisso, #418).
 */
interface NaAgenda { ligados: CompromissoLigado[]; concluida: string | null; historico: Historico[] }

/** Os atalhos para acompanhar os prazos na agenda (o prazo extra, o prazo após o deferimento e a série), ou os compromissos que já os acompanham. */
function AcompanharOsPrazos({ processoId, comDemanda, hoje, serie, extra, deferimento, concluir, aoMudar, versaoDoCartao }: AcompanharNaAgenda) {
  // undefined: ainda lendo os compromissos do processo (o atalho só aparece depois, para não oferecer um segundo).
  const [lido, setLido] = useState<NaAgenda | undefined>();
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vale = true;
    const colunas: Promise<Coluna[]> = concluir ? SD.colunasListar('compromissos') : Promise.resolve([]);
    Promise.all([SD.compromissosDoProcesso(processoId), colunas, SD.processoHistorico(processoId)])
      .then(([ligados, cols, historico]) => { if (vale) setLido({ ligados, concluida: cols.find(c => c.marco === 'concluido')?.id ?? null, historico }); })
      .catch(() => { if (vale) setLido({ ligados: [], concluida: null, historico: [] }); });
    return () => { vale = false; };
  }, [processoId, concluir, versao, versaoDoCartao]);
  if (!lido) return null;
  const { ligados, historico } = lido;
  const mudou = () => { setVersao(v => v + 1); aoMudar?.(); };
  const aConcluir = concluir ? compromissoAConcluir(ligados, concluir, lido.concluida) : null;
  return <>
    {aConcluir && <>
      <Nota>A concessão foi informada: o prazo após o deferimento terminou. O compromisso {nomeDoCompromisso(aConcluir)} ainda está em aberto na agenda.</Nota>
      <AcoesDosLigados>
        <Botao forma="mini" ocupadoTexto="Concluindo…" onClick={() => concluirNaAgenda(aConcluir.id, lido.concluida!, mudou)}>Concluir na agenda</Botao>
      </AcoesDosLigados>
    </>}
    {extra && <PrazoNaAgenda ligados={ligados} historico={historico} hoje={hoje} prazo={extra.prazo} para={extra.para} mudou={mudou}
      jaEsta={c => `O prazo extra já está na agenda: ${nomeDoCompromisso(c)}, na seção "Compromissos".`} descricao={descreverPrazoExtra(extra.prazo)}
      atalho="Pôr o prazo extra na agenda" />}
    {deferimento && <PrazoNaAgenda ligados={ligados} historico={historico} hoje={hoje} prazo={deferimento.prazo} para={deferimento.para} mudou={mudou}
      jaEsta={c => `O prazo após o deferimento já está na agenda: ${nomeDoCompromisso(c)}, na seção "Compromissos".`}
      descricao={descreverPrazoAposODeferimento(deferimento.prazo)} atalho="Pôr o prazo na agenda" />}
    {serie && <PrazoNaAgenda ligados={ligados} historico={historico} hoje={hoje} prazo={serie.acompanhamento} para={serie.para} mudou={mudou}
      jaEsta={c => `Estes prazos já estão na agenda: ${nomeDoCompromisso(c)}, na seção "Compromissos".`}
      descricao={descreverAcompanhamento(serie.acompanhamento, comDemanda)} atalho="Acompanhar na agenda" />}
  </>;
}

interface PropsDoPrazoNaAgenda {
  /** O histórico do processo: o "Atualizar" só aparece se as datas dele mudaram depois do compromisso. */
  historico: Historico[];
  ligados: CompromissoLigado[];
  hoje: string;
  /** O título e a primeira data que a conta dá. */
  prazo: { titulo: string; data: string };
  para: string;
  jaEsta: (c: CompromissoLigado) => string;
  descricao: string;
  atalho: string;
  mudou: () => void;
}
/** Um prazo na agenda: o atalho para criar o compromisso ou, se ele já existe, qual é e, se as datas do processo mudaram, o "Atualizar as datas". */
function PrazoNaAgenda({ ligados, historico, hoje, prazo, para, jaEsta, descricao, atalho, mudou }: PropsDoPrazoNaAgenda) {
  const ja = compromissoDoAcompanhamento(ligados, prazo);
  if (!ja) return <>
    <Nota>{descricao}</Nota>
    <AtalhoParaAAgenda para={para}>{atalho}</AtalhoParaAAgenda>
  </>;
  const atualizar = dataParaAtualizar(ligados, prazo, hoje, historico);
  return <>
    <Nota>{jaEsta(ja)}</Nota>
    {atualizar && <>
      <Nota>{descreverDataParaAtualizar(atualizar)}</Nota>
      <AcoesDosLigados>
        <Botao forma="mini" ocupadoTexto="Atualizando…" onClick={() => atualizarNaAgenda(atualizar, mudou)}>Atualizar as datas na agenda</Botao>
      </AcoesDosLigados>
    </>}
  </>;
}

/**
 * Leva o compromisso para a data da conta: no que se repete, esta data e as seguintes em aberto (a série recomeça dali, como o "esta e as
 * seguintes" do cartão do compromisso); no que não se repete, só ele.
 */
async function atualizarNaAgenda(x: DataParaAtualizar, mudou: () => void) {
  try {
    const c = await SD.compromissoObter(x.id);
    if (!c) throw new Error('O compromisso não foi encontrado: atualize a página e confira.');
    if (c.repeticao_id) {
      await SD.compromissoMudarSeguintes(c.id, { data: x.para, hora: c.hora, hora_fim: c.hora_fim });
      avisar(`Na agenda, esta data e as seguintes passaram a contar de ${fmtData(x.para)}.`);
    } else {
      await SD.compromissoAtualizar(c.id, { data: x.para });
      avisar(`A data passou para ${fmtData(x.para)} na agenda.`);
    }
    mudou();
  } catch (e) { falha(e); }
}

/** Leva o compromisso do prazo após o deferimento para a coluna de concluído do quadro de compromissos. */
async function concluirNaAgenda(id: string, concluida: string, mudou: () => void) {
  try {
    await SD.compromissoMover(id, concluida, null);
    avisar('O compromisso do prazo após o deferimento foi concluído.');
    mudou();
  } catch (e) { falha(e); }
}

/** O tamanho do "+" no atalho (o dos botões pequenos embaixo das listas das seções). */
const ICONE_DO_ATALHO = 13;
/** O atalho que abre o cadastro do compromisso já preenchido com os prazos: uma ação própria deste prazo, e não o "+" da seção. */
function AtalhoParaAAgenda({ para, children }: { para: string; children: string }) {
  return <AcoesDosLigados><BotaoLink forma="mini" to={para}><Icone nome="mais" tam={ICONE_DO_ATALHO} /> {children}</BotaoLink></AcoesDosLigados>;
}
