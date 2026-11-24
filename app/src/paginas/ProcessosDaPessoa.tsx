// Os processos ligados ao cartão da pessoa, cada um num quadrinho que abre o cartão dele, com o papel dela (cliente, equipe ou
// um papel como testemunha ou perito, #316), o tipo e a
// situação. Embaixo, a busca "Ligar processo existente", que a corrente do título abre (ela entra como cliente de um processo que já existe, #341, #427); o atalho para um
// processo novo com ela como cliente fica no "+" do título da seção (#376). Com a pessoa arquivada, nenhum dos dois.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoLigado } from '../dados';
import { nomeDoProcesso, papeisPorExtenso, SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO } from '../regras/processo';
import { cadastroComVolta } from '../regras/origemDoCadastro';
import { situacaoDoItem } from '../regras/quadro';
import { Aviso, Carregando } from '../ui/base';
import { ItensLigados, type NovoLigado } from '../ui/ItensLigados';
import { LigarAPessoa, tirarAPessoaDoItem } from './PessoasNosItens';

interface Props {
  pessoaId: string;
  perfilId: string | null;
  /** Muda quando o cartão muda (ao ligar, ao desfazer): a lista lê de novo. */
  versao?: number;
  /** A pessoa arquivada: sem ligar e sem criar. */
  somenteLer?: boolean;
  /** Depois de ligar ou tirar: o cartão atualiza a lista e o contador. */
  aoMudar?: () => void;
  /** A pessoa como o "x" a nomeia (#424): ela sai do processo em que é cliente. Sem isto, nenhum "x". */
  pessoa?: { id: string; nome: string };
}

/** O processo novo com a pessoa como cliente: o cadastro volta ao cartão dela depois de gravar (#376). */
export const novoProcessoDaPessoa = (pessoaId: string, rotulo: string): NovoLigado => ({ para: cadastroComVolta('/processos/novo/', 'cliente', pessoaId), rotulo });

export function ProcessosDaPessoa({ pessoaId, perfilId, versao = 0, somenteLer = false, aoMudar = () => {}, pessoa }: Props) {
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
  const situacao = (etapa: string | null) => situacaoDoItem(colunas, etapa, SEM_SITUACAO_PROCESSO);
  return <>
    <ItensLigados vazio="Nenhum processo ligado a esta pessoa." itens={lista.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [TIPOS_PROCESSO[p.tipo].nome, p.numero, papeisPorExtenso(p), situacao(p.etapa_id)].filter(Boolean).join(' · '),
      tirar: pessoa && !somenteLer ? tirarAPessoaDoItem('processos', pessoa, p, `do processo ${nomeDoProcesso(p)}`, aoMudar) : undefined
    }))} />
    {!somenteLer && <LigarAPessoa modulo="processos" pessoaId={pessoaId} depois={aoMudar} />}
  </>;
}
