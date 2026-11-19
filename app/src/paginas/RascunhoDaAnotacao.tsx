// A anotação nova antes de ir ao banco (#369, pedido do dono): ela abre na mesma janela da anotação aberta (CartaoAnotacao), com
// o cursor no título, e só vai ao banco quando a pessoa escreve algo no título ou no texto. Até lá, o que a pessoa escolhe fica
// guardado aqui, na tela: a pasta (vinda da página com ?pasta=, já escolhida), a equipe nas bolinhas (quem escreve já é o
// responsável), as etiquetas e os itens a que ela vai nascer ligada (vinda do cartão de um item, ?demanda=…, ele já vem na
// lista). Ao ir ao banco, ela leva tudo isso junto (paraGravar), e o cartão passa a mostrar a anotação gravada.
// Antes, a anotação nova tinha uma tela própria (NovaAnotacao, #303/#339), com "Salvar anotação" e Ctrl+Enter.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { SD, type Etiqueta, type ItemDaAnotacao, type ItemParaLigar, type ModuloDaAnotacao, type Pasta } from '../dados';
import { ITENS_DA_ANOTACAO } from '../dados/limites';
import {
  comMaisUmItem, ITEM_DA_ANOTACAO, itemDaAnotacao, ligacoesDaAnotacaoNova, MODULOS_DA_ANOTACAO, semOItem, type CamposDaEquipe, type EscolhidoNaAnotacaoNova
} from '../regras/anotacao';
import { candidatosDaEquipe } from '../regras/equipe';
import { AVISO_DA_MUDANCA, desfazerMudanca, EQUIPE_DO_MODULO, MUDANCAS, type EquipeGravada, type TipoDeMudanca } from '../regras/equipeNoCartao';
import { etiquetasQueExistem } from '../regras/etiquetas';
import { ICONE_DO_TOPO, NoTopoDoCartao } from '../ui/AcoesDoCartao';
import { avisar, feito } from '../ui/avisos';
import { Aviso, Nota } from '../ui/base';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { BotaoDasEtiquetas, SelosDasEtiquetas } from '../ui/Etiquetas';
import { lojaDeEtiquetas } from '../ui/etiquetasDoEscritorio';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarItem } from '../ui/LigarItem';
import { CaminhoDaPasta } from '../ui/Pastas';
import { useCtx } from '../ui/sessao';
import { desfazerNoItem } from './equipeNoCartao';
import { NovoNaAnotacao } from './NovoNaAnotacao';

/** De onde a anotação nova vem: a pasta em que ela nasce e o item a que ela nasce ligada (null: nenhum). */
export interface AnotacaoNova { pasta: string | null; origem: ItemParaLigar | null }

/** Como ler o item de cada módulo, para mostrar a que a anotação nova fica ligada. */
const OBTER_ITEM: Record<ModuloDaAnotacao, (id: string) => Promise<ItemDaAnotacao | null>> = {
  pessoas: id => SD.pessoaObter(id).then(x => x && itemDaAnotacao('pessoas', x)),
  processos: id => SD.processoObter(id).then(x => x && itemDaAnotacao('processos', { ...x, cliente_nome: x.clientes.map(c => c.nome).join('; ') })),
  contratos: id => SD.contratoObter(id).then(x => x && itemDaAnotacao('contratos', x)),
  demandas: id => SD.demandaObter(id).then(x => x && itemDaAnotacao('demandas', x)),
  tarefas: id => SD.tarefaObter(id).then(x => x && itemDaAnotacao('tarefas', x)),
  compromissos: id => SD.compromissoObter(id).then(x => x && itemDaAnotacao('compromissos', x))
};
/** O tamanho do X que tira um item da lista dos que a anotação vai ligar. */
const TAMANHO_DO_X = 14;
/** As palavras da equipe da anotação (o papel de quem está na lista, o "+", a lista cheia). */
const EQUIPE = EQUIPE_DO_MODULO.anotacoes;

/**
 * O que a pessoa escolhe na anotação nova antes de ela ir ao banco (veja o começo do arquivo). `gravada`: o id que ela ganha ao ir
 * ao banco (null: ainda não foi), para o Desfazer de uma mudança feita antes agir na anotação gravada.
 */
export function useRascunhoDaAnotacao(nova: AnotacaoNova | undefined, gravada: RefObject<string | null>) {
  const ctx = useCtx();
  const [equipe, setEquipe] = useState<CamposDaEquipe>(() => ({ responsavelId: ctx.perfil.id, participantes: [] }));
  const [pasta, setPasta] = useState<string | null>(() => nova?.pasta ?? null);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  // Os itens também numa referência: o item de onde se veio pode chegar logo antes de a anotação ir ao banco, antes de a tela se
  // desenhar de novo, e ele não pode ficar de fora.
  const listaDosItens = useRef<ItemDaAnotacao[]>([]);
  const [itens, setItensNaTela] = useState<ItemDaAnotacao[]>([]);
  const mudarItens = (mudanca: (lista: ItemDaAnotacao[]) => ItemDaAnotacao[]) => {
    listaDosItens.current = mudanca(listaDosItens.current);
    setItensNaTela(listaDosItens.current);
  };
  /** O item de onde se veio: undefined enquanto é lido (ou sem origem); null se não foi encontrado. */
  const [origem, setOrigem] = useState<ItemDaAnotacao | null | undefined>(undefined);
  const leituraDaOrigem = useRef<Promise<unknown>>(Promise.resolve());
  const moduloDeOrigem = nova?.origem?.modulo, idDeOrigem = nova?.origem?.id;
  useEffect(() => {
    if (!moduloDeOrigem || !idDeOrigem) return;
    leituraDaOrigem.current = OBTER_ITEM[moduloDeOrigem](idDeOrigem).then(i => {
      setOrigem(i);
      // O item de onde se veio já entra na lista dos que a anotação vai ligar, em primeiro.
      if (i) mudarItens(atual => [i, ...semOItem(atual, i)]);
    }).catch(() => setOrigem(null));
  }, [moduloDeOrigem, idDeOrigem]);

  // A etiqueta marcada e depois excluída (no próprio painel, ou por um colega) some da tela e não vai para a anotação.
  const etiquetasMarcadas = etiquetasQueExistem(etiquetas, lojaDeEtiquetas.usar());
  const marcarEtiqueta = (e: Etiqueta, marcada: boolean) => setEtiquetas(atual => marcada ? [...atual.filter(x => x !== e.id), e.id] : atual.filter(x => x !== e.id));
  /** A equipe e as etiquetas como estão na tela agora, para o Desfazer (que pode vir depois de outras mudanças) e para gravar. */
  const naTela = useRef({ equipe, pasta, etiquetas: etiquetasMarcadas });
  naTela.current = { equipe, pasta, etiquetas: etiquetasMarcadas };

  /**
   * A equipe nas mesmas bolinhas da anotação aberta, com as mesmas regras (MUDANCAS) e o mesmo aviso no pé da tela com o
   * Desfazer (desfazerMudanca, sobre a equipe como estiver na hora), só que guardada na tela até a anotação ir ao banco.
   */
  function pedir(tipo: TipoDeMudanca, id: string, nome: string) {
    const antes: EquipeGravada = { responsavel_id: equipe.responsavelId, lista: equipe.participantes };
    const r = MUDANCAS[tipo]('anotacoes', antes, id, nome);
    if ('aviso' in r) { avisar(r.aviso, r.tipo); return; }
    setEquipe({ responsavelId: r.gravar.responsavel_id ?? equipe.responsavelId, participantes: r.gravar.lista });
    feito(AVISO_DA_MUDANCA[tipo]('anotacoes', nome), EQUIPE.oQue, async () => {
      const agora = naTela.current.equipe;
      const volta = desfazerMudanca('anotacoes', { tipo, id, nome }, antes, { responsavel_id: agora.responsavelId, lista: agora.participantes });
      if (volta && 'aviso' in volta) throw new Error(volta.aviso);
      if (volta) setEquipe({ responsavelId: volta.responsavel_id ?? agora.responsavelId, participantes: volta.lista });
      // A anotação já foi ao banco, com esta mudança (o aviso e o Ctrl+Z continuam valendo depois): o Desfazer age também na
      // anotação gravada, sobre a equipe dela agora, e a janela a lê de novo.
      if (gravada.current) return desfazerNoItem('anotacoes', gravada.current, { tipo, id, nome }, antes);
    });
  }

  return {
    equipe, pasta, etiquetas: etiquetasMarcadas, itens, origem, pedir, marcarEtiqueta,
    mudarPasta: setPasta,
    ligar: (i: ItemDaAnotacao) => mudarItens(atual => comMaisUmItem(atual, i)),
    tirar: (i: ItemDaAnotacao) => mudarItens(atual => semOItem(atual, i)),
    /** A pasta escolhida que não existe mais (apagada por um colega) não vai para a anotação. Chamado ao desenhar, com as pastas lidas. */
    conferirPasta: (pastas: Pasta[] | null) => { if (pasta && pastas && !pastas.some(p => p.id === pasta)) setPasta(null); },
    /** O que vai junto ao banco: espera o item de onde se veio, para a anotação não nascer sem ele. */
    paraGravar: async (): Promise<EscolhidoNaAnotacaoNova> => {
      await leituraDaOrigem.current.catch(() => undefined);
      const { equipe: e, pasta: p, etiquetas: etq } = naTela.current;
      return { equipe: e, pasta: p, ligacoes: ligacoesDaAnotacaoNova(listaDosItens.current), etiquetas: etq };
    }
  };
}
export type RascunhoDaAnotacao = ReturnType<typeof useRascunhoDaAnotacao>;

/**
 * O topo da anotação nova, no mesmo desenho do da anotação aberta: a pasta, a equipe em bolinhas e o ícone de etiqueta (junto dos
 * botões da janela, como na aberta), e embaixo os selos das etiquetas escolhidas. Sem o menu ⋯: ainda não há o que duplicar,
 * baixar, arquivar ou excluir.
 */
export function TopoDoRascunho({ rascunho, pastas }: { rascunho: RascunhoDaAnotacao; pastas: Pasta[] | null }) {
  const ctx = useCtx();
  const { equipe, pedir } = rascunho;
  const responsavel = equipe.responsavelId ? naEquipe(ctx.equipe, equipe.responsavelId, 'Responsável') : null;
  const participantes = equipe.participantes.map(x => naEquipe(ctx.equipe, x, EQUIPE.papel));
  return <>
    <header className="anotacao-topo">
      {/* Sem link nos pedaços do caminho: abrir a pasta agora fecharia a anotação, que ainda não foi gravada. */}
      <CaminhoDaPasta pastas={pastas} pastaId={rascunho.pasta} aoMudar={rascunho.mudarPasta} />
      <div className="anotacao-topo-acoes">
        <EquipeDoCartao responsavel={responsavel} participantes={participantes} mudar={{
          por: EQUIPE.por,
          candidatos: termo => candidatosDaEquipe(ctx.equipe, termo, [equipe.responsavelId, ...equipe.participantes]),
          responsaveis: termo => candidatosDaEquipe(ctx.equipe, termo, [equipe.responsavelId]),
          // Na anotação nova, ninguém "sai": quem escreve é sempre dela.
          tirar: p => `Tirar ${p.nome}`,
          cheia: equipe.participantes.length >= EQUIPE.maximo ? EQUIPE.cheia : undefined,
          aoPor: m => pedir('por', m.id, m.nome),
          aoTirar: p => pedir('tirar', p.id, p.nome),
          aoTrocarResponsavel: m => pedir('responsavel', m.id, m.nome)
        }} />
        <NoTopoDoCartao>
          <BotaoDasEtiquetas ids={rascunho.etiquetas} aoMarcar={rascunho.marcarEtiqueta} rotulo="Etiquetas" className="cartao-botao" comDica>
            <Icone nome="etiqueta" tam={ICONE_DO_TOPO} />
          </BotaoDasEtiquetas>
        </NoTopoDoCartao>
      </div>
    </header>
    <SelosDasEtiquetas ids={rascunho.etiquetas} rotulo="Etiquetas" aoTirar={e => rascunho.marcarEtiqueta(e, false)} />
  </>;
}

/** O que vai dentro de "Ligada a" na anotação nova: os itens escolhidos (sem link, que fecharia a anotação) e o ligar a mais um. */
export function LigadosDoRascunho({ rascunho }: { rascunho: RascunhoDaAnotacao }) {
  const ctx = useCtx();
  const { itens } = rascunho;
  // Os módulos que se podem ligar: os ligados no escritório (as pessoas sempre existem).
  const modulos = MODULOS_DA_ANOTACAO.filter(m => m === 'pessoas' || !!ctx.escritorio?.modulos?.[m]);
  return <>
    {rascunho.origem === null && <Aviso tipo="erro">O item de onde você veio não foi encontrado. A anotação será gravada sem ligação a ele.</Aviso>}
    <ItensLigados rotulo="Itens ligados" vazio="Ainda não está ligada a nenhum item." itens={itens.map(i => ({
      id: `${i.modulo}-${i.id}`, codigo: `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo}`, titulo: i.nome,
      acao: <button type="button" className="icone-btn" title="Tirar" aria-label={`Tirar ${i.nome}`} onClick={() => rascunho.tirar(i)}>
        <Icone nome="fechar" tam={TAMANHO_DO_X} />
      </button>
    }))} />
    {itens.length >= ITENS_DA_ANOTACAO
      ? <Nota>A anotação já vai ligada a {ITENS_DA_ANOTACAO} itens, o máximo.</Nota>
      : <div className="ligados-acoes">
        <LigarItem modulos={modulos} ligados={itens} rotulo={itens.length ? 'Ligar a outro item' : 'Ligar a um item'} aoEscolher={rascunho.ligar} />
        {/* O "+ Novo…" espera a anotação ir ao banco: só então há a que ligar o item novo. */}
        <NovoNaAnotacao modulos={modulos} anotacaoId={null} />
      </div>}
  </>;
}
