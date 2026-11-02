// No cartão do processo: o alerta dos prazos vencidos e dos que vencem hoje, e as seções de prazos e de andamentos.
// Lê tudo ao abrir o cartão, para o alerta e os contadores aparecerem mesmo com as seções fechadas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SD, type AndamentoDeProcesso, type Orgao, type PrazoDeProcesso, type Processo } from '../../dados';
import { alertaDosPrazos, aTratar } from '../../regras/andamentos';
import { falha, useMudancas } from '../../ui/avisos';
import { Aviso, Carregando } from '../../ui/base';
import { Recolhivel } from '../../ui/Recolhivel';
import { hojeISO } from '../../ui/util';
import { Andamentos } from './Andamentos';
import { Prazos } from './Prazos';
import './AndamentosEPrazos.css';

interface Lido { andamentos: AndamentoDeProcesso[]; prazos: PrazoDeProcesso[]; orgaos: Orgao[] }

export function AndamentosEPrazos({ processo: p, aoMudar }: { processo: Processo; aoMudar: () => void }) {
  const [lido, setLido] = useState<Lido | string | null>(null);
  // Só vale a leitura mais recente: uma resposta atrasada não pode trocar o que já está na tela por algo mais velho.
  const ultimaLeitura = useRef(0);
  const jaLeu = useRef(false);
  const carregar = useCallback(async () => {
    const esta = ++ultimaLeitura.current;
    try {
      const [andamentos, prazos, orgaos] = await Promise.all([SD.processoAndamentos(p.id), SD.processoPrazos(p.id), SD.orgaosListar()]);
      if (esta !== ultimaLeitura.current) return;
      jaLeu.current = true;
      setLido({ andamentos, prazos, orgaos });
    } catch (e) {
      if (esta !== ultimaLeitura.current) return;
      // Numa releitura que falhou, a tela fica com o que já tinha (e o formulário aberto não some).
      if (jaLeu.current) falha(e); else setLido((e as Error).message);
    }
  }, [p.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra como ficou.
  useMudancas(() => { void carregar(); aoMudar(); });

  if (lido === null) return <Carregando />;
  if (typeof lido === 'string') return <Aviso tipo="erro">{lido}</Aviso>;
  const { andamentos, prazos, orgaos } = lido;
  const mudou = async () => { aoMudar(); await carregar(); };
  const somenteLer = !!p.arquivado_em;
  const orgao = orgaos.find(o => o.sigla === p.orgao) ?? null;
  const alerta = alertaDosPrazos(prazos, hojeISO());
  const abertos = prazos.filter(z => !z.concluido_em).length, aTratarAgora = andamentos.filter(aTratar).length;

  return <>
    {alerta && <Aviso tipo="erro">{alerta}</Aviso>}
    <Recolhivel titulo="Prazos" icone="calendario" preferencia="processos.cartao.prazos" contador={abertos}>
      <Prazos processo={p} prazos={prazos} orgao={orgao} somenteLer={somenteLer} aoMudar={mudou} />
    </Recolhivel>
    <Recolhivel titulo={aTratarAgora ? `Andamentos (${aTratarAgora} a tratar)` : 'Andamentos'} icone="relogio" preferencia="processos.cartao.andamentos" contador={andamentos.length}>
      <Andamentos processo={p} andamentos={andamentos} prazos={prazos} orgao={orgao} somenteLer={somenteLer} aoMudar={mudou} />
    </Recolhivel>
  </>;
}
