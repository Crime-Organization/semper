// Os processos ligados ao processo aberto (#316), na seção "Processos relacionados": o de origem (se este é um recurso, um incidental
// ou o judicial que nasceu de um administrativo, #425) e os que nasceram dele, cada um num quadrinho que abre o cartão dele, com a
// relação, o tipo, o número e a situação. Embaixo, os atalhos de cada ligação que o tipo do processo oferece (ligacoesDaOrigem):
// "Novo recurso", "Novo incidental" e, no administrativo de qualquer área, "Novo processo judicial a partir deste" e "Ligar processo
// judicial existente". O cadastro do novo abre com o que este processo tem (clientes com o papel de cada um, equipe...), e o novo tem o
// próprio número e os próprios andamentos. A ligação do judicial ao administrativo é sempre do processo inteiro e se desfaz pelo "x",
// nos dois cartões, depois de confirmar. Quem não pode criar itens ligados (cartão arquivado, ou só para ler) não vê os botões nem o "x".
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoRelacionado, type TipoProcesso } from '../dados';
import {
  cadastroDoDerivado, judicialParaDesligar, LIGACOES, ligacoesDaOrigem, nomeDoProcesso, RELACOES, ROTULO_DO_NOVO_DERIVADO, SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO
} from '../regras/processo';
import { situacaoDoItem } from '../regras/quadro';
import { falha, feito } from '../ui/avisos';
import { BotaoLink, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados, ItensLigados, useNovoNoCartao, type NovoLigado } from '../ui/ItensLigados';
import { confirmar } from '../ui/janela';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { ligarEAvisar, ligarJudicialNoAdministrativo } from './ligarNoCartao';

/** O tamanho do "x" que desfaz a ligação (o mesmo dos processos e das demandas relacionadas). */
const ICONE_DO_DESFAZER = 14;
/** O que a busca explica enquanto está aberta. */
export const AVISO_AO_LIGAR_JUDICIAL = 'O processo judicial inteiro fica ligado a este administrativo e aparece nos dois cartões.';

/** O "+" do título da seção: o cadastro pergunta qual ligação (recurso, incidental e, no administrativo, o judicial). */
export const novoDerivado = (processoId: string, tipo: TipoProcesso): NovoLigado => ({ para: cadastroDoDerivado(processoId), rotulo: ROTULO_DO_NOVO_DERIVADO[tipo] });

interface Props {
  /** undefined: ainda lendo. */
  lista: ProcessoRelacionado[] | undefined;
  processoId: string;
  tipo: TipoProcesso;
  /** Depois de ligar ou desfazer: o cartão lê de novo. */
  aoMudar: () => void;
}

export function ProcessosRelacionados({ lista, processoId, tipo, aoMudar }: Props) {
  // A situação de cada um é o nome da coluna dele no quadro do tipo dele: as colunas dos quadros de cada tipo servem.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(q => setColunas(q.flat())).catch(() => {});
  }, []);
  // Os botões e o "x" seguem a regra do cartão (CriarNoCartao): nenhum com o processo arquivado ou para quem só lê.
  const pode = !!useNovoNoCartao(novoDerivado(processoId, tipo));
  if (!lista) return <Carregando />;
  const ligacoes = ligacoesDaOrigem(tipo);

  async function desfazer(p: ProcessoRelacionado, judicialId: string) {
    const nome = nomeDoProcesso(p);
    if (!await confirmar('Desfazer a ligação?', <>O processo <b>{p.codigo}</b> ({nome}) deixa de aparecer em "Processos relacionados" deste cartão, e este no dele.</>,
      'Desfazer a ligação')) return;
    try {
      await SD.processoJudicialDesligar(judicialId);
      const administrativoId = judicialId === processoId ? p.id : processoId;
      feito(`Ligação desfeita com o processo ${p.codigo}.`, 'ligação desfeita', async () => { await SD.processoJudicialLigar(administrativoId, judicialId); });
      aoMudar();
    } catch (e) { falha(e); }
  }

  return <>
    <ItensLigados rotulo="Processos ligados" vazio="Nenhum processo relacionado a este." itens={lista.map(p => {
      const judicialId = pode ? judicialParaDesligar(p, processoId) : null;
      return {
        id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
        detalhe: [RELACOES[p.relacao], TIPOS_PROCESSO[p.tipo].nome, p.numero, situacaoDoItem(colunas, p.etapa_id, SEM_SITUACAO_PROCESSO)].filter(Boolean).join(' · '),
        acao: judicialId ? <button type="button" className="icone-btn" title="Desfazer a ligação" aria-label={`Desfazer a ligação com o processo ${p.codigo}`}
          onClick={() => desfazer(p, judicialId)}><Icone nome="fechar" tam={ICONE_DO_DESFAZER} /></button> : undefined
      };
    })} />
    {pode && <AcoesDosLigados>
      {ligacoes.map(l => <BotaoLink key={l} forma="mini" to={cadastroDoDerivado(processoId, l)}><Icone nome="mais" tam={13} /> {LIGACOES[l].novo}</BotaoLink>)}
      {ligacoes.includes('judicial') && <LigarDoModulo modulo="processos" rotulo="Ligar processo judicial existente" aviso={AVISO_AO_LIGAR_JUDICIAL}
        filtro={{ judicialSemOrigem: true }}
        aoEscolher={x => ligarEAvisar(() => ligarJudicialNoAdministrativo(processoId, x.id),
          { feito: `Processo judicial ligado: ${x.codigo}.`, oQue: 'ligação do processo judicial', ja: 'Este processo judicial já estava ligado.' }, aoMudar)} />}
    </AcoesDosLigados>}
  </>;
}
