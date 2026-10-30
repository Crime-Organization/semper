// As demandas ligadas a outro cartão (da pessoa ou do contrato), cada uma num quadrinho que abre a demanda, com o papel
// da pessoa nela, a situação e o prazo. Embaixo, o atalho para uma demanda nova já ligada a este cartão.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type DemandaLigada } from '../dados';
import { PAPEIS_NA_DEMANDA, ROTULOS_PRAZO, SEM_SITUACAO_DEMANDA, situacaoDoPrazo } from '../regras/demanda';
import { fmtData } from '../regras/pessoa';
import { Aviso, BotaoLink, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { hojeISO } from '../ui/util';

interface Props {
  carregar: () => Promise<DemandaLigada[]>;
  vazio: string;
  /** Endereço do cadastro de demanda já ligado a este cartão, e o texto do atalho. */
  nova: { para: string; rotulo: string };
  /** Muda quando o cartão muda (ex.: o contrato foi para a coluna do assinado e gerou demandas): recarrega a lista. */
  versao?: number;
}

export function DemandasLigadas({ carregar, vazio, nova, versao = 0 }: Props) {
  const [lista, setLista] = useState<DemandaLigada[] | string | null>(null);
  // A situação de cada demanda é o nome da coluna dela no quadro de demandas.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    carregar().then(setLista).catch(e => setLista((e as Error).message));
    SD.colunasListar('demandas').then(setColunas).catch(() => {});
  // oxlint-disable-next-line react/exhaustive-deps -- carrega quando a seção abre e quando o cartão muda (versao)
  }, [versao]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO_DEMANDA;
  const prazo = (d: DemandaLigada) => {
    const s = situacaoDoPrazo(d.prazo, hojeISO());
    return s ? ` · ${ROTULOS_PRAZO[s]}: ${fmtData(d.prazo)}` : '';
  };
  return <>
    <ItensLigados vazio={vazio} itens={lista.map(d => ({
      id: d.id, para: '/demandas/?id=' + d.id, codigo: d.codigo, titulo: d.titulo, selo: d.arquivado_em ? 'Arquivada' : undefined,
      detalhe: [d.papeis.map(x => PAPEIS_NA_DEMANDA[x]).join(', '), situacao(d.etapa_id)].filter(Boolean).join(' · ') + prazo(d)
    }))} />
    <div><BotaoLink forma="mini" to={nova.para}><Icone nome="mais" tam={13} /> {nova.rotulo}</BotaoLink></div>
  </>;
}
