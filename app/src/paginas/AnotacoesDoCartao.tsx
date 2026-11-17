// A seção "Anotações" do cartão de uma pessoa, um processo, um contrato, uma demanda, uma tarefa ou um compromisso (#303):
// as anotações ligadas ao item que quem lê pode ver, cada uma num quadrinho que abre o cartão dela em Documentos, e o "+"
// para escrever uma nova já ligada a este item. A lista é lida ao abrir o cartão (para o número aparecer com a seção
// fechada) e de novo quando algo muda (a janela do cadastro fechou, desfizeram algo).
import { useCallback, useEffect, useState } from 'react';
import { SD, type AnotacaoLigada, type ModuloDaAnotacao } from '../dados';
import { ITEM_DA_ANOTACAO } from '../regras/anotacao';
import { useMudancas } from '../ui/avisos';
import { Aviso, Carregando } from '../ui/base';
import { ItensLigados } from '../ui/ItensLigados';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { relativo } from '../ui/util';

/** Onde fica o cartão de cada anotação, e o cadastro de uma nova. */
export const ENDERECO_DA_ANOTACAO = '/documentos/?id=';
export const CADASTRO_DE_ANOTACAO = '/documentos/nova/';

/** O texto da seção vazia, no gênero de cada item. */
const VAZIO: Record<ModuloDaAnotacao, string> = {
  pessoas: 'Nenhuma anotação ligada a esta pessoa.',
  processos: 'Nenhuma anotação ligada a este processo.',
  contratos: 'Nenhuma anotação ligada a este contrato.',
  demandas: 'Nenhuma anotação ligada a esta demanda.',
  tarefas: 'Nenhuma anotação ligada a esta tarefa.',
  compromissos: 'Nenhuma anotação ligada a este compromisso.'
};

interface Props {
  modulo: ModuloDaAnotacao;
  id: string;
  /** Quem só lê o cartão (ou o cartão arquivado) não vê o "+". */
  somenteLer?: boolean;
}

export function AnotacoesDoCartao({ modulo, id, somenteLer = false }: Props) {
  const ctx = useCtx();
  const ligado = !!ctx.escritorio?.modulos?.anotacoes;
  const [lista, setLista] = useState<AnotacaoLigada[] | string | null>(null);
  const carregar = useCallback(() => SD.anotacoesDoItem(modulo, id).then(setLista).catch(e => setLista((e as Error).message)), [modulo, id]);
  useEffect(() => { if (ligado) void carregar(); }, [ligado, carregar]);
  useMudancas(() => { if (ligado) void carregar(); });
  if (!ligado) return null;

  const novo = somenteLer ? undefined : { para: `${CADASTRO_DE_ANOTACAO}?${ITEM_DA_ANOTACAO[modulo].parametro}=${id}`, rotulo: 'Nova anotação ligada a este item' };
  return <Recolhivel titulo="Anotações" icone="documentos" preferencia={`${modulo}.cartao.anotacoes`} contador={Array.isArray(lista) ? lista.length : undefined} novo={novo}>
    {lista === null ? <Carregando />
      : typeof lista === 'string' ? <Aviso tipo="erro">{lista}</Aviso>
      : <ItensLigados rotulo="Anotações ligadas" vazio={VAZIO[modulo]} itens={lista.map(a => ({
        id: a.id, para: ENDERECO_DA_ANOTACAO + a.id, codigo: a.codigo, titulo: a.titulo, selo: a.arquivado_em ? 'Arquivada' : undefined,
        detalhe: `Atualizada ${relativo(a.atualizado_em)}`
      }))} />}
  </Recolhivel>;
}
