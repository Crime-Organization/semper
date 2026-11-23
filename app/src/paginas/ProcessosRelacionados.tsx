// Os processos ligados ao processo aberto (#316): o de origem (se este é um recurso ou incidental) e os recursos e incidentais que
// nasceram dele, cada um num quadrinho que abre o cartão dele, com a relação, o tipo, o número e a situação. Embaixo, "Novo recurso" e
// "Novo incidental": o cadastro abre com o que este processo tem (clientes, equipe, polo...), e o novo tem o próprio número e os
// próprios andamentos. Quem não pode criar itens ligados (cartão arquivado, ou só para ler) não vê os botões.
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoRelacionado } from '../dados';
import { cadastroDoDerivado, LIGACOES, nomeDoProcesso, RELACOES, SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_DE_LIGACAO, TIPOS_PROCESSO } from '../regras/processo';
import { situacaoDoItem } from '../regras/quadro';
import { BotaoLink, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados, ItensLigados, useNovoNoCartao, type NovoLigado } from '../ui/ItensLigados';

/** O "+" do título da seção: o cadastro pergunta se é recurso ou incidental. */
export const novoDerivado = (processoId: string): NovoLigado => ({ para: cadastroDoDerivado(processoId), rotulo: 'Novo recurso ou incidental deste processo' });

interface Props {
  /** undefined: ainda lendo. */
  lista: ProcessoRelacionado[] | undefined;
  processoId: string;
}

export function ProcessosRelacionados({ lista, processoId }: Props) {
  // A situação de cada um é o nome da coluna dele no quadro do tipo dele: as colunas dos quadros de cada tipo servem.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(q => setColunas(q.flat())).catch(() => {});
  }, []);
  // Os botões seguem a regra do cartão (CriarNoCartao): nenhum com o processo arquivado ou para quem só lê.
  const pode = !!useNovoNoCartao(novoDerivado(processoId));
  if (!lista) return <Carregando />;
  return <>
    <ItensLigados rotulo="Processos ligados" vazio="Nenhum recurso ou incidental ligado a este processo." itens={lista.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [RELACOES[p.relacao], TIPOS_PROCESSO[p.tipo].nome, p.numero, situacaoDoItem(colunas, p.etapa_id, SEM_SITUACAO_PROCESSO)].filter(Boolean).join(' · ')
    }))} />
    {pode && <AcoesDosLigados>
      {TIPOS_DE_LIGACAO.map(l => <BotaoLink key={l} forma="mini" to={cadastroDoDerivado(processoId, l)}><Icone nome="mais" tam={13} /> {LIGACOES[l].novo}</BotaoLink>)}
    </AcoesDosLigados>}
  </>;
}
