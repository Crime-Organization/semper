// No cartão da demanda, a seção "Demandas relacionadas" (#310): as demandas ligadas a esta, cada uma num quadrinho que abre o cartão
// dela, com a situação e o prazo. A ligação vale nos dois sentidos: a outra demanda mostra esta. Quem não pode ver a relacionada vê o
// número dela e que ela existe, sem o título e sem o link. Quem altera a demanda liga outra que já existe ("Ligar demanda existente",
// com a busca) e desfaz pelo "X", com o Desfazer no pé da tela, como os processos ligados (ProcessosDoCartao).
import { SD, type Coluna, type DemandaRelacionada } from '../dados';
import { rotuloDoPrazoComHora, SEM_SITUACAO_DEMANDA } from '../regras/demanda';
import { DETALHE_SEM_ACESSO, foraDaBuscaDeRelacionadas, RELACIONADA_SEM_ACESSO } from '../regras/demandasRelacionadas';
import { colunaComMarco, situacaoDoItem } from '../regras/quadro';
import { avisar, falha, feito } from '../ui/avisos';
import { Aviso, Carregando } from '../ui/base';
import { Icone } from '../ui/Icone';
import { AcoesDosLigados, ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { hojeISO } from '../ui/util';
import { ligarEAvisar, relacionarDemandas } from './ligarNoCartao';

/** O que a seção explica enquanto a busca está aberta: quem passa a ver o quê. */
export const AVISO_AO_RELACIONAR = 'A ligação aparece nas duas demandas. Quem está só numa delas vê o número da outra, sem o conteúdo.';

interface Props {
  demandaId: string;
  /** As relacionadas, lidas pelo cartão (que mostra o número no título da seção, mesmo recolhida); null enquanto carrega; texto: o erro. */
  relacionadas: DemandaRelacionada[] | string | null;
  /** As colunas do quadro de Demandas: a situação de cada relacionada. */
  colunas: Coluna[];
  /** Quem só lê a demanda (ou com ela arquivada) não liga nem desfaz. */
  somenteLer: boolean;
  /** Depois de ligar ou desfazer: o cartão lê de novo. */
  aoMudar: () => void;
}

export function DemandasRelacionadas({ demandaId, relacionadas, colunas, somenteLer, aoMudar }: Props) {
  if (relacionadas === null) return <Carregando />;
  if (typeof relacionadas === 'string') return <Aviso tipo="erro">{relacionadas}</Aviso>;

  async function desfazer(r: DemandaRelacionada) {
    try {
      await SD.demandaDesrelacionar(demandaId, r.id);
      // Religar pede estar nas duas: sem ver a outra, a ligação desfeita não volta pelo Desfazer.
      if (r.demanda) feito(`Ligação desfeita com a demanda ${r.codigo}.`, 'ligação desfeita', async () => { await SD.demandaRelacionar(demandaId, r.id); });
      else avisar(`Ligação desfeita com a demanda ${r.codigo}.`);
      aoMudar();
    } catch (e) { falha(e); }
  }

  const situacao = (etapa: string | null) => situacaoDoItem(colunas, etapa, SEM_SITUACAO_DEMANDA);
  const prazo = (d: NonNullable<DemandaRelacionada['demanda']>) =>
    rotuloDoPrazoComHora(d.prazo, d.prazo_hora, hojeISO(), colunaComMarco(colunas, d.etapa_id, 'concluido'));
  const item = (r: DemandaRelacionada): ItemLigado => ({
    id: r.id, codigo: r.codigo,
    ...(r.demanda
      ? { para: '/demandas/?id=' + r.id, titulo: r.demanda.titulo, selo: r.demanda.arquivado_em ? 'Arquivada' : undefined,
        detalhe: [situacao(r.demanda.etapa_id), prazo(r.demanda)].filter(Boolean).join(' · ') }
      : { titulo: RELACIONADA_SEM_ACESSO, detalhe: DETALHE_SEM_ACESSO }),
    acao: somenteLer ? undefined
      : <button type="button" className="icone-btn" title="Desfazer a ligação" aria-label={`Desfazer a ligação com a demanda ${r.codigo}`} onClick={() => desfazer(r)}>
        <Icone nome="fechar" tam={14} />
      </button>
  });

  return <>
    <ItensLigados rotulo="Demandas relacionadas" vazio="Nenhuma demanda relacionada a esta." itens={relacionadas.map(item)} />
    {!somenteLer && <AcoesDosLigados>
      <LigarDoModulo modulo="demandas" aviso={AVISO_AO_RELACIONAR}
        filtro={async () => ({ fora: foraDaBuscaDeRelacionadas(demandaId, await SD.demandasRelacionadas(demandaId)) })}
        aoEscolher={x => ligarEAvisar(() => relacionarDemandas(demandaId, x.id),
          { feito: `Demanda relacionada: ${x.codigo}.`, oQue: 'ligação da demanda relacionada', ja: 'Esta demanda já estava relacionada a esta.' }, aoMudar)} />
    </AcoesDosLigados>}
  </>;
}
