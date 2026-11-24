// Os compromissos ligados a outro cartão (da pessoa ou do processo), cada um num quadrinho que abre o cartão dele, com a data,
// o papel da pessoa nele e a situação. O "+" para um novo já ligado a este cartão fica no título da seção (#427).
import { useEffect, useState } from 'react';
import { SD, type Coluna, type CompromissoLigado } from '../dados';
import { detalheDoLigado, nomeDoCompromisso, SEM_SITUACAO_COMPROMISSO, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { situacaoDoItem } from '../regras/quadro';
import { Aviso, Carregando } from '../ui/base';
import { ItensLigados } from '../ui/ItensLigados';

interface Props {
  carregar: () => Promise<CompromissoLigado[]>;
  vazio: string;
}

export function CompromissosLigados({ carregar, vazio }: Props) {
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
  const situacao = (etapa: string | null) => situacaoDoItem(colunas, etapa, SEM_SITUACAO_COMPROMISSO);
  return <>
    <ItensLigados vazio={vazio} itens={lista.map(c => ({
      id: c.id, para: '/agenda/?id=' + c.id, codigo: `${TIPOS_COMPROMISSO[c.tipo].nome} · ${c.codigo}`, titulo: nomeDoCompromisso(c), selo: c.arquivado_em ? 'Arquivado' : undefined,
      detalhe: detalheDoLigado(c, situacao(c.etapa_id))
    }))} />
  </>;
}
