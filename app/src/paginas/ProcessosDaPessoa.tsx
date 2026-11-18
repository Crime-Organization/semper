// Os processos ligados ao cartão da pessoa, cada um num quadrinho que abre o cartão dele, com o papel dela, o tipo e a
// situação. Embaixo, "Ligar processo existente" (ela entra como cliente de um processo que já existe, #341) e o atalho para um
// processo novo com ela como cliente.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoLigado } from '../dados';
import { nomeDoProcesso, PAPEIS_NO_PROCESSO, SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO } from '../regras/processo';
import { Aviso, Carregando } from '../ui/base';
import { AcoesDosLigados, ItensLigados } from '../ui/ItensLigados';
import { LigarAPessoa } from './PessoasNosItens';

interface Props {
  pessoaId: string;
  perfilId: string | null;
  /** Muda quando o cartão muda (ao ligar, ao desfazer): a lista lê de novo. */
  versao?: number;
  /** A pessoa arquivada: sem ligar. */
  somenteLer?: boolean;
  /** Depois de ligar: o cartão atualiza a lista e o contador. */
  aoMudar?: () => void;
}

const NOVO_PROCESSO = (pessoaId: string) => ({ para: '/processos/novo/?cliente=' + pessoaId, rotulo: 'Novo processo com esta pessoa como cliente' });

export function ProcessosDaPessoa({ pessoaId, perfilId, versao = 0, somenteLer = false, aoMudar = () => {} }: Props) {
  const [lista, setLista] = useState<ProcessoLigado[] | string | null>(null);
  // A situação de cada um é o nome da coluna dele no quadro do tipo dele: as colunas dos dois quadros servem.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    let vivo = true;
    SD.processosDaPessoa(pessoaId, perfilId).then(x => { if (vivo) setLista(x); }).catch(e => { if (vivo) setLista((e as Error).message); });
    return () => { vivo = false; };
  }, [pessoaId, perfilId, versao]);
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(q => setColunas(q.flat())).catch(() => {});
  }, []);
  if (lista === null) return <Carregando />;
  if (typeof lista === 'string') return <Aviso tipo="erro">{lista}</Aviso>;
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO_PROCESSO;
  return <>
    <ItensLigados vazio="Nenhum processo ligado a esta pessoa." itens={lista.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [TIPOS_PROCESSO[p.tipo].nome, p.numero, p.papeis.map(x => PAPEIS_NO_PROCESSO[x]).join(', '), situacao(p.etapa_id)].filter(Boolean).join(' · ')
    }))} />
    {somenteLer ? <AcoesDosLigados novo={NOVO_PROCESSO(pessoaId)} />
      : <LigarAPessoa modulo="processos" pessoaId={pessoaId} depois={aoMudar} novo={NOVO_PROCESSO(pessoaId)} />}
  </>;
}
