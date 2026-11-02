// No cartão da demanda, os processos ligados a ela e o atalho para criar um, já com os clientes e a equipe da demanda.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoLigado } from '../dados';
import { plural } from './importarPessoas/textos';
import { nomeDoProcesso, SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO } from '../regras/processo';
import { Aviso, BotaoLink, Carregando, Nota } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';

const TIPOS = Object.keys(TIPOS_PROCESSO) as (keyof typeof TIPOS_PROCESSO)[];

export function ProcessosDaDemanda({ demandaId, somenteLer, versao }: { demandaId: string; somenteLer: boolean; versao: number }) {
  const [lista, setLista] = useState<{ visiveis: ProcessoLigado[]; ocultos: number } | string | null>(null);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    SD.processosDaDemanda(demandaId).then(setLista).catch(e => setLista((e as Error).message));
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(c => setColunas(c.flat())).catch(() => {});
  }, [demandaId, versao]);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO_PROCESSO;
  return <>
    {lista.ocultos > 0 && <Nota>Há {plural(lista.ocultos, 'processo ligado', 'processos ligados')} a esta demanda que você não tem acesso para abrir.</Nota>}
    <ItensLigados vazio={lista.ocultos ? undefined : 'Nenhum processo ligado a esta demanda.'} itens={lista.visiveis.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [TIPOS_PROCESSO[p.tipo].nome, p.numero, situacao(p.etapa_id)].filter(Boolean).join(' · ')
    }))} />
    {!somenteLer && <div><BotaoLink forma="mini" to={'/processos/novo/?demanda=' + demandaId}><Icone nome="mais" tam={13} /> Criar processo</BotaoLink></div>}
  </>;
}
