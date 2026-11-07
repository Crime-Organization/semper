// Os compromissos ligados a outro cartão (da pessoa ou do processo), cada um num quadrinho que abre o cartão dele, com a data,
// o papel da pessoa nele e a situação. Ao lado, o "+" para um novo já ligado a este cartão.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type CompromissoLigado } from '../dados';
import { detalheDoLigado, nomeDoCompromisso, SEM_SITUACAO_COMPROMISSO, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { Aviso, Carregando } from '../ui/base';
import { ItensLigados } from '../ui/ItensLigados';

interface Props {
  carregar: () => Promise<CompromissoLigado[]>;
  vazio: string;
  /** Endereço do cadastro já ligado a este cartão, e o texto do atalho. */
  novo: { para: string; rotulo: string };
}

export function CompromissosLigados({ carregar, vazio, novo }: Props) {
  const [lista, setLista] = useState<CompromissoLigado[] | string | null>(null);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  // A seção só monta ao abrir, e os cartões são outros a cada id: basta ler uma vez.
  const [leitura] = useState(() => carregar);
  useEffect(() => {
    leitura().then(setLista).catch(e => setLista((e as Error).message));
    SD.colunasListar('compromissos').then(setColunas).catch(() => {});
  }, [leitura]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO_COMPROMISSO;
  return <>
    <ItensLigados vazio={vazio} novo={novo} itens={lista.map(c => ({
      id: c.id, para: '/agenda/?id=' + c.id, codigo: `${TIPOS_COMPROMISSO[c.tipo].nome} · ${c.codigo}`, titulo: nomeDoCompromisso(c), selo: c.arquivado_em ? 'Arquivado' : undefined,
      detalhe: detalheDoLigado(c, situacao(c.etapa_id))
    }))} />
  </>;
}
