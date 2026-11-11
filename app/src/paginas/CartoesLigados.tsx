// As demandas ou as tarefas ligadas a outro cartão (da pessoa, do contrato ou da demanda), cada uma num quadrinho que
// abre o cartão dela, com o papel da pessoa nela, a situação e o prazo. Ao lado, o "+" para uma nova já ligada a este
// cartão (sem nenhuma, o texto de vazio e o botão com o nome, na mesma linha).
import { useEffect, useState } from 'react';
import { SD, type Coluna, type DemandaLigada, type TarefaLigada } from '../dados';
import { PAPEIS_NA_DEMANDA, rotuloDoPrazoComHora, SEM_SITUACAO_DEMANDA } from '../regras/demanda';
import { colunaComMarco } from '../regras/quadro';
import { PAPEIS_NA_TAREFA, SEM_SITUACAO_TAREFA } from '../regras/tarefa';
import { Aviso, Carregando } from '../ui/base';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
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
  /** Endereço do cadastro já ligado a este cartão, e o texto do atalho. Sem ele, a seção só mostra o que há. */
  nova?: { para: string; rotulo: string };
  /** Muda quando o cartão muda (ex.: o contrato foi para a coluna do assinado e gerou demandas): recarrega a lista. */
  versao?: number;
  /** Itens que vêm antes dos cartões (ex.: os objetos do contrato que ainda não viraram demanda). */
  antes?: ItemLigado[];
  /** Nome da lista para o leitor de tela. */
  rotulo?: string;
}

export function CartoesLigados({ modulo, carregar, vazio, nova, versao = 0, antes = [], rotulo }: Props) {
  const [lista, setLista] = useState<Ligado[] | string | null>(null);
  // A situação de cada um é o nome da coluna dele no quadro do módulo.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    // A lista só aparece com as colunas na mão: sem elas, o concluído pareceria vencido por um instante.
    Promise.all([carregar(), SD.colunasListar(modulo).catch(() => [] as Coluna[])])
      .then(([itens, cols]) => { setColunas(cols); setLista(itens); })
      .catch(e => setLista((e as Error).message));
  // oxlint-disable-next-line react/exhaustive-deps -- carrega quando a seção abre e quando o cartão muda (versao)
  }, [versao]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const { endereco, papeis, semSituacao } = MODULOS[modulo];
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || semSituacao;
  // Concluído (na coluna-marco das concluídas), o prazo não aparece como vencido: a situação já diz que terminou.
  const prazo = (x: Ligado) => {
    const r = rotuloDoPrazoComHora(x.prazo, x.prazo_hora, hojeISO(), colunaComMarco(colunas, x.etapa_id, 'concluido'));
    return r ? ` · ${r}` : '';
  };
  return <>
    <ItensLigados rotulo={rotulo} vazio={vazio} novo={nova} itens={[...antes, ...lista.map(x => ({
      id: x.id, para: endereco + x.id, codigo: x.codigo, titulo: x.titulo, selo: x.arquivado_em ? 'Arquivada' : undefined,
      detalhe: [x.papeis.map(p => papeis[p]).join(', '), situacao(x.etapa_id)].filter(Boolean).join(' · ') + prazo(x)
    }))]} />
  </>;
}
