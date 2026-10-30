// As demandas ou as tarefas ligadas a outro cartão (da pessoa, do contrato ou da demanda), cada uma num quadrinho que
// abre o cartão dela, com o papel da pessoa nela, a situação e o prazo. Embaixo, o atalho para uma nova já ligada a
// este cartão.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type DemandaLigada, type TarefaLigada } from '../dados';
import { PAPEIS_NA_DEMANDA, ROTULOS_PRAZO, SEM_SITUACAO_DEMANDA, situacaoDoPrazo } from '../regras/demanda';
import { fmtData } from '../regras/pessoa';
import { PAPEIS_NA_TAREFA, SEM_SITUACAO_TAREFA } from '../regras/tarefa';
import { Aviso, BotaoLink, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { hojeISO } from '../ui/util';

type Ligado = DemandaLigada | TarefaLigada;
/** O que muda de um módulo para o outro: onde o cartão abre, o nome de cada papel e o rótulo de quem está fora do quadro. */
const MODULOS = {
  demandas: { endereco: '/demandas/?id=', papeis: PAPEIS_NA_DEMANDA as Record<string, string>, semSituacao: SEM_SITUACAO_DEMANDA },
  tarefas: { endereco: '/tarefas/?id=', papeis: PAPEIS_NA_TAREFA as Record<string, string>, semSituacao: SEM_SITUACAO_TAREFA }
};

interface Props {
  modulo: keyof typeof MODULOS;
  carregar: () => Promise<Ligado[]>;
  vazio: string;
  /** Endereço do cadastro já ligado a este cartão, e o texto do atalho. */
  nova: { para: string; rotulo: string };
  /** Muda quando o cartão muda (ex.: o contrato foi para a coluna do assinado e gerou demandas): recarrega a lista. */
  versao?: number;
}

export function CartoesLigados({ modulo, carregar, vazio, nova, versao = 0 }: Props) {
  const [lista, setLista] = useState<Ligado[] | string | null>(null);
  // A situação de cada um é o nome da coluna dele no quadro do módulo.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    carregar().then(setLista).catch(e => setLista((e as Error).message));
    SD.colunasListar(modulo).then(setColunas).catch(() => {});
  // oxlint-disable-next-line react/exhaustive-deps -- carrega quando a seção abre e quando o cartão muda (versao)
  }, [versao]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const { endereco, papeis, semSituacao } = MODULOS[modulo];
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || semSituacao;
  const prazo = (x: Ligado) => {
    const s = situacaoDoPrazo(x.prazo, hojeISO());
    return s ? ` · ${ROTULOS_PRAZO[s]}: ${fmtData(x.prazo)}` : '';
  };
  return <>
    <ItensLigados vazio={vazio} itens={lista.map(x => ({
      id: x.id, para: endereco + x.id, codigo: x.codigo, titulo: x.titulo, selo: x.arquivado_em ? 'Arquivada' : undefined,
      detalhe: [x.papeis.map(p => papeis[p]).join(', '), situacao(x.etapa_id)].filter(Boolean).join(' · ') + prazo(x)
    }))} />
    <div><BotaoLink forma="mini" to={nova.para}><Icone nome="mais" tam={13} /> {nova.rotulo}</BotaoLink></div>
  </>;
}
