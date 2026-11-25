// Os processos ligados ao processo aberto (#316), na seção "Processos relacionados": o de origem (se este é um recurso, um incidental
// ou o judicial que nasceu de um administrativo, #425) e os que nasceram dele, cada um num quadrinho que abre o cartão dele, com a
// relação, o tipo, o número e a situação. No título da seção (#427), o "+" abre um menu pequeno com as ligações que o tipo do processo
// oferece (ligacoesDaOrigem): "Novo recurso", "Novo incidental" e, no administrativo de qualquer área, "Novo processo judicial a partir
// deste". O cadastro do novo abre com o que este processo tem (clientes com o papel de cada um, equipe...), e o novo tem o próprio
// número e os próprios andamentos. Desde a #440, a corrente de todo processo liga outro que já existe, de qualquer tipo (judicial ou
// administrativo), que aparece nos dois cartões como "Relacionado". A ligação do judicial ao administrativo e a do relacionado saem pelo
// "x" (#424), nos dois cartões, depois da pergunta. Quem não pode criar itens ligados (cartão arquivado, ou só para ler) não vê o "+",
// a corrente nem o "x".
import { useEffect, useState } from 'react';
import { SD, type Coluna, type ProcessoRelacionado, type TipoProcesso } from '../dados';
import {
  AVISO_AO_RELACIONAR_PROCESSO, cadastroDoDerivado, foraDaBuscaDeProcessos, judicialParaDesligar, LIGACOES, ligacoesDaOrigem, nomeDoProcesso, RELACOES, ROTULO_DO_NOVO_DERIVADO,
  SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO
} from '../regras/processo';
import { situacaoDoItem } from '../regras/quadro';
import { Carregando, type PedidoDeTirar } from '../ui/base';
import { AcoesDosLigados, ItensLigados, useNovoNoCartao, type NovoLigado } from '../ui/ItensLigados';
import { LigarDoModulo, ligarDoModulo } from '../ui/LigarDoModulo';
import type { LigarNaSecao, VariosNaSecao } from '../ui/Recolhivel';
import { ligarEAvisar, relacionarProcessos, tirarEAvisar } from './ligarNoCartao';

/** O "+" do título da seção: um menu com uma opção por ligação que o tipo oferece, cada uma com o cadastro já nela. */
export const novoDerivado = (processoId: string, tipo: TipoProcesso): VariosNaSecao<NovoLigado> => ({
  rotulo: ROTULO_DO_NOVO_DERIVADO[tipo],
  opcoes: ligacoesDaOrigem(tipo).map(l => ({ para: cadastroDoDerivado(processoId, l), rotulo: LIGACOES[l].novo }))
});
/** A corrente do título da seção (#440): em todo processo, ligar outro que já existe, de qualquer tipo. */
export const ligarProcessoNaSecao = (): LigarNaSecao => ligarDoModulo('processos');

interface Props {
  /** undefined: ainda lendo. */
  lista: ProcessoRelacionado[] | undefined;
  processoId: string;
  /** Depois de ligar ou tirar: o cartão lê de novo. */
  aoMudar: () => void;
}

export function ProcessosRelacionados({ lista, processoId, aoMudar }: Props) {
  // A situação de cada um é o nome da coluna dele no quadro do tipo dele: as colunas dos quadros de cada tipo servem.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro))).then(q => setColunas(q.flat())).catch(() => {});
  }, []);
  // A busca segue a regra do cartão (CriarNoCartao): nenhuma com o processo arquivado ou para quem só lê. O "x" também
  // (o BotaoTirar já pergunta ao cartão).
  const pode = !!useNovoNoCartao(true);
  if (!lista) return <Carregando />;

  /** O "x" do relacionado (#440): a ligação sai dos dois cartões, com o Desfazer. */
  const tirarRelacionado = (p: ProcessoRelacionado): PedidoDeTirar => ({
    oQue: `a ligação com o processo ${p.codigo}`,
    explicacao: <>O processo <b>{p.codigo}</b> ({nomeDoProcesso(p)}) continua no SEMPER: deixa de aparecer em "Processos relacionados" deste
      cartão, e este no dele. Dá para desfazer logo depois, no aviso do pé da tela.</>,
    aoTirar: () => tirarEAvisar(async () => {
      await SD.processoDesrelacionar(processoId, p.id);
      return async () => { await SD.processoRelacionar(processoId, p.id); };
    }, `Ligação desfeita com o processo ${p.codigo}.`, 'ligação desfeita', aoMudar)
  });
  /** O "x" do judicial ligado ao administrativo (#424): a ligação sai dos dois cartões, com o Desfazer. */
  const tirar = (p: ProcessoRelacionado): PedidoDeTirar | undefined => {
    if (p.relacao === 'relacionado') return tirarRelacionado(p);
    const judicialId = judicialParaDesligar(p, processoId);
    if (!judicialId) return undefined;
    const administrativoId = judicialId === processoId ? p.id : processoId;
    return {
      oQue: `a ligação com o processo ${p.codigo}`,
      explicacao: <>O processo <b>{p.codigo}</b> ({nomeDoProcesso(p)}) continua no SEMPER: deixa de aparecer em "Processos relacionados" deste
        cartão, e este no dele. Dá para desfazer logo depois, no aviso do pé da tela.</>,
      aoTirar: () => tirarEAvisar(async () => {
        await SD.processoJudicialDesligar(judicialId);
        return async () => { await SD.processoJudicialLigar(administrativoId, judicialId); };
      }, `Ligação desfeita com o processo ${p.codigo}.`, 'ligação desfeita', aoMudar)
    };
  };

  return <>
    <ItensLigados rotulo="Processos ligados" vazio="Nenhum processo relacionado a este." itens={lista.map(p => ({
      id: p.id, para: TIPOS_PROCESSO[p.tipo].caminho + '?id=' + p.id, codigo: p.codigo, titulo: nomeDoProcesso(p), selo: p.arquivado_em ? 'Arquivado' : undefined,
      detalhe: [RELACOES[p.relacao], TIPOS_PROCESSO[p.tipo].nome, p.numero, situacaoDoItem(colunas, p.etapa_id, SEM_SITUACAO_PROCESSO)].filter(Boolean).join(' · '),
      tirar: tirar(p)
    }))} />
    {pode && <AcoesDosLigados>
      <LigarDoModulo modulo="processos" aviso={AVISO_AO_RELACIONAR_PROCESSO} filtro={{ fora: foraDaBuscaDeProcessos(processoId, lista) }}
        aoEscolher={x => ligarEAvisar(() => relacionarProcessos(processoId, x.id),
          { feito: `Processo relacionado: ${x.codigo}.`, oQue: 'ligação do processo relacionado', ja: 'Este processo já estava relacionado a este.' }, aoMudar)} />
    </AcoesDosLigados>}
  </>;
}
