// Os processos ligados ao cartão da pessoa, cada um num quadrinho que abre o cartão dele, com o papel dela, o tipo e a
// situação. Embaixo, o atalho para um processo novo com ela como cliente.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoLigado } from '../dados';
import { nomeDoProcesso, PAPEIS_NO_PROCESSO, SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO } from '../regras/processo';
import { Aviso, BotaoLink, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';

export function ProcessosDaPessoa({ pessoaId, perfilId }: { pessoaId: string; perfilId: string | null }) {
  const [lista, setLista] = useState<ProcessoLigado[] | string | null>(null);
  // A situação de cada um é o nome da coluna dele no quadro do tipo dele: as colunas dos dois quadros servem.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    SD.processosDaPessoa(pessoaId, perfilId).then(setLista).catch(e => setLista((e as Error).message));
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(q => setColunas(q.flat())).catch(() => {});
  }, [pessoaId, perfilId]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO_PROCESSO;
  return <>
    <ItensLigados vazio="Nenhum processo ligado a esta pessoa." itens={lista.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [TIPOS_PROCESSO[p.tipo].nome, p.numero, p.papeis.map(x => PAPEIS_NO_PROCESSO[x]).join(', '), situacao(p.etapa_id)].filter(Boolean).join(' · ')
    }))} />
    <div><BotaoLink forma="mini" to={'/processos/novo/?cliente=' + pessoaId}><Icone nome="mais" tam={13} /> Novo processo com esta pessoa como cliente</BotaoLink></div>
  </>;
}
