// No cartão do processo: o alerta dos prazos vencidos e dos que vencem hoje, a seção de prazos (no corpo do cartão) e a de
// andamentos (desde a #362, na coluna da direita, entre os comentários e as anotações; ao lado, no pé do cartão).
// As duas seções leem juntas, uma vez, ao abrir o cartão (useAcompanhamento): o alerta e os contadores aparecem mesmo com as
// seções fechadas, e a intimação dos andamentos sabe dos prazos que nasceram dela.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SD, type AndamentoDeProcesso, type Orgao, type PrazoDeProcesso, type Processo } from '../../dados';
import { alertaDosPrazos, aTratar } from '../../regras/andamentos';
import { falha, useMudancas } from '../../ui/avisos';
import { Aviso, Carregando } from '../../ui/base';
import { Recolhivel } from '../../ui/Recolhivel';
import { hojeISO } from '../../ui/util';
import { Andamentos, ROTULO_DO_NOVO_ANDAMENTO } from './Andamentos';
import { Prazos, ROTULO_DO_NOVO_PRAZO } from './Prazos';
import './AndamentosEPrazos.css';

interface Lido { andamentos: AndamentoDeProcesso[]; prazos: PrazoDeProcesso[]; orgaos: Orgao[] }
/** O que as duas seções recebem: o que foi lido (null: lendo; texto: o erro da primeira leitura) e como reler. */
export interface Acompanhamento { lido: Lido | string | null; mudou: () => Promise<void> }

/** Lê os andamentos, os prazos e os órgãos do processo; aoMudar avisa o cartão (o histórico) depois de cada mudança. */
export function useAcompanhamento(processoId: string, aoMudar: () => void): Acompanhamento {
  const [lido, setLido] = useState<Lido | string | null>(null);
  // Só vale a leitura mais recente: uma resposta atrasada não pode trocar o que já está na tela por algo mais velho.
  const ultimaLeitura = useRef(0);
  const jaLeu = useRef(false);
  const avisar = useRef(aoMudar);
  avisar.current = aoMudar;
  const carregar = useCallback(async () => {
    const esta = ++ultimaLeitura.current;
    try {
      const [andamentos, prazos, orgaos] = await Promise.all([SD.processoAndamentos(processoId), SD.processoPrazos(processoId), SD.orgaosListar()]);
      if (esta !== ultimaLeitura.current) return;
      jaLeu.current = true;
      setLido({ andamentos, prazos, orgaos });
    } catch (e) {
      if (esta !== ultimaLeitura.current) return;
      // Numa releitura que falhou, a tela fica com o que já tinha (e o formulário aberto não some).
      if (jaLeu.current) falha(e); else setLido((e as Error).message);
    }
  }, [processoId]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra como ficou.
  useMudancas(() => { void carregar(); avisar.current(); });
  const mudou = useCallback(async () => { avisar.current(); await carregar(); }, [carregar]);
  return { lido, mudou };
}

/** O que a seção mostra enquanto lê (o carregando), se a primeira leitura falhou (o erro) e, com tudo lido, o conteúdo dela. */
function ConformeLido({ lido, children }: { lido: Acompanhamento['lido']; children: (l: Lido) => ReactNode }) {
  if (lido === null) return <Carregando />;
  if (typeof lido === 'string') return <Aviso tipo="erro">{lido}</Aviso>;
  return children(lido);
}

/** O órgão do processo, para a contagem dos prazos. */
const orgaoDe = (p: Processo, orgaos: Orgao[]) => orgaos.find(o => o.sigla === p.orgao) ?? null;

/**
 * O alerta dos prazos e a seção de prazos, no corpo do cartão. A seção aparece já enquanto lê (com o "carregando" dentro), para ficar
 * em primeiro lugar no grupo do cartão: o "Expandir tudo" fica acima dela, e não da seção seguinte.
 */
export function PrazosDoProcesso({ processo: p, acompanhamento: { lido, mudou }, soLeitura = false, aoMudarRascunho }: {
  processo: Processo; acompanhamento: Acompanhamento; soLeitura?: boolean;
  /** Avisa o cartão do prazo escrito e ainda não lançado (#395), para perguntar antes de fechar. */
  aoMudarRascunho?: (rascunho: string | null) => void;
}) {
  const prazos = lido && typeof lido !== 'string' ? lido.prazos : null;
  const alerta = prazos && alertaDosPrazos(prazos, hojeISO());
  const somenteLer = !!p.arquivado_em || soLeitura;
  return <>
    {alerta && <Aviso tipo="erro">{alerta}</Aviso>}
    <Recolhivel titulo="Prazos" icone="calendario" preferencia="processos.cartao.prazos" contador={prazos?.filter(z => !z.concluido_em).length}
      novo={somenteLer ? undefined : { rotulo: ROTULO_DO_NOVO_PRAZO }}>
      <ConformeLido lido={lido}>
        {l => <Prazos processo={p} prazos={l.prazos} orgao={orgaoDe(p, l.orgaos)} somenteLer={somenteLer} aoMudar={mudou} aoMudarRascunho={aoMudarRascunho} />}
      </ConformeLido>
    </Recolhivel>
  </>;
}

/**
 * A seção dos andamentos, na coluna da direita (#362): a linha do tempo, com o número mesmo fechada e, no título, quantas intimações
 * estão a tratar. Como as outras seções da coluna, começa recolhida, e a escolha fica guardada com a chave da coluna.
 */
export function AndamentosDoProcesso({ processo: p, acompanhamento: { lido, mudou }, soLeitura = false }: { processo: Processo; acompanhamento: Acompanhamento; soLeitura?: boolean }) {
  const andamentos = lido && typeof lido !== 'string' ? lido.andamentos : null;
  const aTratarAgora = andamentos?.filter(aTratar).length ?? 0;
  const somenteLer = !!p.arquivado_em || soLeitura;
  return <Recolhivel titulo={aTratarAgora ? `Andamentos (${aTratarAgora} a tratar)` : 'Andamentos'} icone="relogio" preferencia="processos.coluna.andamentos" contador={andamentos?.length}
    novo={somenteLer ? undefined : { rotulo: ROTULO_DO_NOVO_ANDAMENTO }}>
    <ConformeLido lido={lido}>
      {l => <Andamentos processo={p} andamentos={l.andamentos} prazos={l.prazos} orgao={orgaoDe(p, l.orgaos)} somenteLer={somenteLer} aoMudar={mudou} />}
    </ConformeLido>
  </Recolhivel>;
}
