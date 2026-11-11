// No cartão da demanda, os processos ligados a ela: ligar um que já existe, desligar e o atalho para criar um, já com os
// clientes e a equipe da demanda. Uma demanda pode ter vários processos.
import { useCallback } from 'react';
import { SD } from '../dados';
import { BotaoLink } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ProcessosDoCartao } from './ProcessosDoCartao';

interface Props {
  demandaId: string;
  somenteLer: boolean;
  versao: number;
  aoMudar: () => void;
}

export function ProcessosDaDemanda({ demandaId, somenteLer, versao, aoMudar }: Props) {
  const carregar = useCallback(() => SD.processosDaDemanda(demandaId), [demandaId]);
  return <ProcessosDoCartao carregar={carregar} versao={versao} somenteLer={somenteLer} aoMudar={aoMudar} vazio="Nenhum processo ligado a esta demanda."
    ligar={id => SD.processoDemandaLigar(id, demandaId, 'atua')} desligar={id => SD.processoDemandaDesligar(id, demandaId)}
    outrasAcoes={<BotaoLink forma="mini" to={'/processos/novo/?demanda=' + demandaId}><Icone nome="mais" tam={13} /> Criar processo</BotaoLink>} />;
}
