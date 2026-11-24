// No cartão da demanda, os processos ligados a ela: ligar um que já existe, desligar e o atalho para criar um (o "+" do título da seção),
// já com os clientes e a equipe da demanda (#376). Uma demanda pode ter vários processos.
import { useCallback } from 'react';
import { SD } from '../dados';
import { cadastroComVolta } from '../regras/origemDoCadastro';
import type { NovoLigado } from '../ui/ItensLigados';
import { ProcessosDoCartao } from './ProcessosDoCartao';

interface Props {
  demandaId: string;
  somenteLer: boolean;
  versao: number;
  aoMudar: () => void;
}

/** O processo novo desta demanda: nasce ligado a ela, e o cadastro volta ao cartão dela depois de gravar. */
export const novoProcessoDaDemanda = (demandaId: string, rotulo: string): NovoLigado => ({ para: cadastroComVolta('/processos/novo/', 'demanda', demandaId), rotulo });

export function ProcessosDaDemanda({ demandaId, somenteLer, versao, aoMudar }: Props) {
  const carregar = useCallback(() => SD.processosDaDemanda(demandaId), [demandaId]);
  return <ProcessosDoCartao carregar={carregar} versao={versao} somenteLer={somenteLer} aoMudar={aoMudar} vazio="Nenhum processo ligado a esta demanda."
    ligar={id => SD.processoDemandaLigar(id, demandaId, 'atua')} desligar={id => SD.processoDemandaDesligar(id, demandaId)} />;
}
