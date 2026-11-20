// A anotação aberta, como uma nota do Obsidian, na janela do cartão (PainelCartao), no centro ou ao lado, como a pessoa escolhe
// nos outros cartões (pedidos do dono de 18/11; antes, #303, #339, #340, #342): no topo, numa linha só, o caminho da pasta (que
// leva à pasta e, para quem altera, muda a pasta) e, à direita, a equipe em bolinhas, o ícone de etiqueta (abre a escolha das
// etiquetas) e o menu ⋯ (duplicar, baixar .md, arquivar, excluir), junto dos botões da janela (NoTopoDoCartao). Logo abaixo, os
// selos das etiquetas (sem etiquetas, a linha some); depois, o título grande, mudado ali mesmo, e o texto, que já abre na caixa de
// escrever, com a formatação à vista, e salva sozinho (EditorDeTexto): sem modo de ler à parte. "Comentários" (aberta), "Ligada
// a" e "Histórico de alterações" (recolhidas) vão para a coluna da direita da janela no centro (NaColunaDoCartao), com o
// "Expandir tudo" no topo dela; ao lado, ficam embaixo do texto, na mesma ordem. A linha da gravação ("Salvo") e o rodapé ficam
// juntos no pé da janela, à vista mesmo com o texto longo rolando (#372).
// Sem lápis: tudo se muda no próprio lugar.
// Quem a vê só por um item ligado lê tudo (o texto formatado, sem caixa), mas não muda nada; todos podem baixá-la em .md (#345)
// e duplicá-la (#343): a cópia é de quem a faz e leva só os itens ligados que ela vê. Sair com algo por gravar (ou ainda
// gravando) espera a gravação (AvisoAoSair); só se ela falhar, a pergunta aparece.
// O texto grava com trava otimista (decidirGravacao): se outra pessoa o mudou depois que a anotação abriu, nada é gravado por
// cima, e a pessoa escolhe qual texto fica. Cada pausa ao digitar grava só o texto, sem ler de novo a página inteira, e o
// histórico junta as gravações seguidas do texto numa linha só (juntarTextoNoHistorico).
// A anotação nova (#369, pedido do dono) abre nesta mesma janela, sem id, com o cursor no título: o que a pessoa escolhe antes
// de escrever fica na tela (RascunhoDaAnotacao), e ela vai ao banco sozinha, uma vez só, quando a pessoa escreve algo no título
// ou no texto (garantirGravada), levando a pasta, a equipe, as etiquetas e os itens escolhidos. Daí em diante, é a anotação
// aberta de sempre, sem trocar a caixa de escrever (o que a pessoa continua a escrever não se perde). Sem nada escrito, fechar
// não grava nada.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type Anotacao, type ItemDaAnotacao } from '../dados';
import { ITENS_DA_ANOTACAO, TAMANHO_ANOTACAO } from '../dados/limites';
import {
  alteraAAnotacao, anotacaoEmBranco, dadosDaAnotacaoNova, dadosDaCopia, DICA_DO_TEXTO, edicaoPorSalvar, enderecoDoItem, erroDoTexto, erroDoTitulo, excluiAAnotacao,
  gravaForaDaAnotacao, ITEM_DA_ANOTACAO, ligaNaAnotacao, MODULOS_DA_ANOTACAO, motivoSemMencaoNaAnotacao, mudadoNaIda, mudouNaIda, TITULO_PROVISORIO, tituloNaJanela, vaiAoBanco,
  type EscolhidoNaAnotacaoNova, type EscritoNaAnotacaoNova, type RascunhosDaAnotacao
} from '../regras/anotacao';
import { markdownDaAnotacao, nomeDoArquivo } from '../regras/anotacaoEmMarkdown';
import { nomeDaEtiqueta } from '../regras/etiquetas';
import { caminhoDaPasta } from '../regras/pastas';
import { equipeEditaTudo, equipeVeTudo } from '../regras/equipeVeTudo';
import { ICONE_DO_TOPO, MenuDoCartao, NoTopoDoCartao, type AcaoDoTopo } from '../ui/AcoesDoCartao';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { SecaoComentarios } from '../ui/Comentarios';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, DadoDoGrupo, EditorDeTexto, estiloBotao, GrupoDeDatas, Nota, Selo, TituloEditavel, Vazio, type ControleDoEditor } from '../ui/base';
import { dataDaCriacao } from '../regras/dataDeInicio';
import { EquipeNoTopo } from './EquipeNoTopo';
import { BotaoDasEtiquetas, SelosDasEtiquetas, useEtiquetas, useEtiquetasDoCartao } from '../ui/Etiquetas';
import { buscarEtiquetas } from '../ui/etiquetasDoEscritorio';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarItem } from '../ui/LigarItem';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { CaminhoDaPasta, escolherPastaDaAnotacao, levarAnotacaoParaPasta } from '../ui/Pastas';
import { buscarPastas, usePastas } from '../ui/pastasDoEscritorio';
import { Recolhivel } from '../ui/Recolhivel';
import { decidirGravacao, juntarTextoNoHistorico } from '../regras/salvamento';
import { JUNTAR_TEXTO_NO_HISTORICO } from '../ui/tempos';
import { meusGrupos } from '../regras/gruposDaEquipe';
import { useCtx } from '../ui/sessao';
import { useQuantos } from '../ui/useQuantos';
import { baixarArquivo, dataCurta, relativo } from '../ui/util';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ENDERECO_DA_ANOTACAO } from './AnotacoesDoCartao';
import { plural } from './importarPessoas/textos';
import { NovoNaAnotacao } from './NovoNaAnotacao';
import { LigadosDoRascunho, TopoDoRascunho, useRascunhoDaAnotacao, type AnotacaoNova } from './RascunhoDaAnotacao';
import './Documentos.css';

/** O nome de cada campo no histórico. */
const CAMPOS_ANOTACAO: Record<string, string> = {
  titulo: 'Título', texto: 'Texto', responsavel_id: 'Responsável', participantes: 'Compartilhada com', pasta_id: 'Pasta', arquivado_em: 'Arquivamento'
};
/** O texto não é guardado no histórico (seria grande demais): fica só que mudou, "Texto alterado". */
const SO_QUE_MUDOU = ['texto'];
/** Como cada valor aparece no histórico. */
const valorNoHistorico = (_campo: string, v: unknown) => v === null || v === undefined || v === '' ? '—' : String(v);
/** Por que quem não altera a anotação a vê: com a chave da equipe, todos a veem; sem ela, só por um item ligado. */
const POR_QUE_SO_LE = {
  equipe: 'Toda a equipe vê as anotações do escritório. Só quem a escreveu, o responsável e quem está nela podem mudá-la.',
  item: 'Você vê esta anotação porque vê um item ligado a ela. Só quem a escreveu, o responsável e quem está nela podem mudá-la.'
};

/** Quando a anotação não vem do banco (ao abrir, ou ao duplicar uma que sumiu depois que ela abriu). */
const NAO_ENCONTRADA = 'Esta anotação não foi encontrada. Ela pode ter sido excluída, ou você não tem acesso a ela.';
/** O aviso quando o item escolhido já estava ligado à anotação (alguém o ligou enquanto a busca estava aberta). */
export const ITEM_JA_LIGADO = 'Este item já estava ligado a esta anotação.';

/** O tipo do arquivo baixado: Markdown, em UTF-8 (acentos e emojis do texto chegam inteiros). */
const TIPO_MARKDOWN = 'text/markdown;charset=utf-8';
/** Para onde vai quem se tira da anotação: a página Documentos, sem a anotação (ela pode deixar de vê-la). */
const DOCUMENTOS = '/documentos/';
/** O tamanho do X que desliga um item da anotação. */
const ICONE_DO_DESLIGAR = 14;
/**
 * Quantas vezes a gravação do texto tenta de novo quando a anotação mudou só em outro campo (o título, a pasta, a equipe)
 * entre a leitura e a gravação: a cada vez, ela lê a anotação de novo e confere o texto.
 */
const TENTATIVAS_DE_GRAVAR = 3;
/** Quando a gravação não passa nem depois das tentativas (a anotação muda sem parar). */
const NAO_GRAVOU = 'Não foi possível gravar o texto agora. Tente de novo com Ctrl+S.';
/** O histórico da anotação, com as gravações seguidas do texto numa linha só (o número da seção conta assim também). */
const historicoJunto = (id: string) => SD.anotacaoHistorico(id).then(h => juntarTextoNoHistorico(h, JUNTAR_TEXTO_NO_HISTORICO));
/** Como está o texto no banco: o texto e o atualizado_em lido com ele (a trava da próxima gravação). */
type VersaoNoBanco = { texto: string; marca: string };
/** O resultado de uma gravação do texto: gravou (com o atualizado_em novo) ou parou porque outra pessoa o mudou. */
type GravacaoDoTexto = { gravou: true; marca: string } | { gravou: false; noBanco: Anotacao };

interface Props {
  /** A anotação gravada. Sem ele, a anotação nova, em branco, que vai ao banco quando a pessoa escreve o título ou o texto. */
  id?: string;
  /** De onde vem a anotação nova: a pasta em que ela nasce e o item a que ela nasce ligada. */
  nova?: AnotacaoNova;
  /** Avisa a página de que algo mudou (para ler de novo o explorador e a lista). */
  aoMudar: () => void;
  /** Fecha a janela da anotação (a página volta à lista), depois que ela é excluída. */
  aoFechar: () => void;
  /** A anotação nova acabou de ir ao banco: quem a abriu passa a mostrá-la pelo endereço dela. */
  aoCriar?: (id: string) => void;
}
type ItensLidos = { visiveis: ItemDaAnotacao[]; ocultos: number };
/** A anotação com o título como a janela o trata (o provisório conta como sem título), para comparar com o título aberto. */
const comoNaJanela = (x: Anotacao): Anotacao => ({ ...x, titulo: tituloNaJanela(x.titulo) });

export function CartaoAnotacao({ id: idRecebido, nova, aoMudar, aoFechar, aoCriar }: Props) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** O id que a anotação nova ganhou ao ir ao banco (quem a abriu pode ainda não ter trocado o endereço). */
  const [criada, setCriada] = useState<string | null>(null);
  /** O id da anotação no banco (null: a anotação nova, que ainda não foi). */
  const id = idRecebido ?? criada;
  const emBranco = !id;
  /** O mesmo id, para as gravações da fila, que podem começar antes de a anotação nova ir ao banco e terminar depois. */
  const noBanco = useRef<string | null>(id);
  const rascunho = useRascunhoDaAnotacao(nova, noBanco);
  /**
   * Marcada enquanto uma saída está segurada (AvisoAoSair, que grava antes de sair): a anotação nova que vai ao banco nesse meio
   * tempo não troca de endereço (a troca desfaria o bloqueio do roteador, e a saída se perderia). A troca fica guardada e só
   * acontece se a pessoa continuar na anotação (aoFicar); se ela sair, não há o que trocar.
   */
  const saindo = useRef(false);
  const trocaGuardada = useRef<string | null>(null);
  /** A janela ainda está aberta: a anotação que chega ao banco depois de a janela fechar não a abre de novo pelo endereço. */
  const aberta = useRef(false);
  useEffect(() => {
    aberta.current = true;
    return () => { aberta.current = false; };
  }, []);
  /** O texto só de espaços que a anotação nova "gravou" sem ir ao banco (não há o que gravar): no banco, ele é o texto vazio. */
  const soEspacos = useRef<string | null>(null);
  // A anotação nova já abre, em branco; a gravada é lida do banco.
  const [a, setA] = useState<Anotacao | null | undefined>(() => id ? undefined : anotacaoEmBranco(ctx.perfil.id));   // undefined: carregando; null: não existe ou não pode ver
  /** A anotação como está agora, para quem continua depois de esperar o banco (a tela pode ainda não ter se desenhado de novo). */
  const naTela = useRef(a);
  naTela.current = a;
  /** A ida da anotação nova ao banco: uma vez só, mesmo que o título e o texto peçam ao mesmo tempo. */
  const criacao = useRef<Promise<Anotacao> | null>(null);
  const [criando, setCriando] = useState(false);
  /** A caixa do texto, para o Enter no título da anotação nova descer até ela. */
  const idDoTexto = useId();
  const [itens, setItens] = useState<ItensLidos | string | null>(null);
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  /** Muda quando a pessoa escolhe "Sair sem salvar": o título e o texto recomeçam, sem o que ela descartou. */
  const [edicaoDescartada, setEdicaoDescartada] = useState(0);
  /** Muda quando a pessoa fica com o texto que outra pessoa gravou: a caixa recomeça com ele. */
  const [textoTrocado, setTextoTrocado] = useState(0);
  /** O texto que outra pessoa gravou enquanto esta escrevia (null: sem conflito). Até a pessoa escolher, nada é gravado. */
  const [conflito, setConflito] = useState<Anotacao | null>(null);
  const emConflito = useRef(false);
  /** "Manter o meu texto": a próxima gravação parte do texto da outra pessoa (que a pessoa viu e decidiu substituir). */
  const baseEscolhida = useRef<string | null>(null);
  /** Quantas gravações do texto estão na fila: sair espera por elas. */
  const [naFila, setNaFila] = useState(0);
  /**
   * Como o texto está no banco, pela última leitura ou gravação: a gravação seguinte vai com este atualizado_em (trava
   * otimista). Se o texto daqui não for o de que a pessoa partiu, ou a anotação mudou depois, a gravação lê de novo e decide.
   */
  const versao = useRef<VersaoNoBanco | null>(null);
  /** O que ainda não foi gravado (o título aberto, o texto por salvar), para avisar ao sair. */
  const [rascunhos, setRascunhos] = useState<RascunhosDaAnotacao>({});
  const mudarRascunho = useCallback(<K extends keyof RascunhosDaAnotacao>(campo: K) => (r: RascunhosDaAnotacao[K]) =>
    setRascunhos(atual => ({ ...atual, [campo]: r })), []);
  /** O lugar, no pé da janela, onde o editor põe a linha da gravação (#372). */
  const [lugarDaSituacao, setLugarDaSituacao] = useState<HTMLElement | null>(null);
  const pe = useRef<HTMLDivElement>(null);
  /** O quanto o pé cobre no fim da janela, com o esmaecido logo acima dele: o cursor do texto não se esconde ali. */
  const folgaDoPe = useCallback(() => {
    const p = pe.current;
    return p ? p.offsetHeight + (parseFloat(getComputedStyle(p, '::before').height) || 0) : 0;
  }, []);
  /** Para gravar o texto que falta antes de sair da anotação. */
  const editor = useRef<ControleDoEditor | null>(null);
  /** Marcada logo antes de sair por conta própria (a pessoa se tirou da anotação): aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  /**
   * As gravações do texto vão em fila, na ordem em que foram pedidas (duplicar e sair esperam por ela). Enquanto há gravação
   * pendente, nenhuma leitura do banco troca o texto da tela (ela viria sem o que ainda está na fila).
   */
  const gravacoes = useRef({ fila: Promise.resolve(), pendentes: 0 });
  /** Cada leitura da anotação ganha um número, e só vale a resposta da mais recente (as respostas podem chegar fora de ordem). */
  const leitura = useRef(0);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  // A pasta da anotação que a lista guardada não conhece (um colega a criou depois) faz ler as pastas de novo; até lá, null.
  const pastas = usePastas({ precisa: emBranco ? rascunho.pasta : a?.pasta_id ?? null });
  if (emBranco) rascunho.conferirPasta(pastas);
  const etiquetasDoEscritorio = useEtiquetas();
  const etiquetas = useEtiquetasDoCartao('anotacoes', id ?? '');

  const carregar = useCallback(() => {
    if (!id) return Promise.resolve();
    const esta = ++leitura.current;
    return SD.anotacaoObter(id).then(x => {
      if (esta !== leitura.current) return;   // velha: vale a resposta mais recente
      if (x) versao.current = { texto: x.texto, marca: x.atualizado_em };
      if (gravacoes.current.pendentes) return;   // há gravação na fila: a tela fica com o que ela já mostra
      setA(x);
      setErro('');
    }).catch(e => setErro((e as Error).message));
  }, [id]);
  const carregarItens = useCallback(() => id ? SD.anotacaoItens(id).then(setItens).catch(e => setItens((e as Error).message)) : Promise.resolve(), [id]);
  useEffect(() => { void carregar(); void carregarItens(); }, [carregar, carregarItens]);
  // Depois de desfazer: mostra a anotação como ficou.
  useMudancas(() => { void carregar(); void carregarItens(); setVersaoHist(v => v + 1); });
  const historico = useQuantos(() => historicoJunto(id!), `${id}:${versaoHist}`, !emBranco);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (a === undefined) return <Carregando />;
  if (!a) return <Vazio>{NAO_ENCONTRADA}</Vazio>;

  const chaves = { equipeEditaTudo: equipeEditaTudo(ctx.escritorio) };
  const podeAlterar = alteraAAnotacao(a, ctx.perfil, chaves, meusGrupos(ctx.grupos, ctx.perfil.id));
  const podeLigar = ligaNaAnotacao(a, ctx.perfil, chaves);
  const podeExcluir = excluiAAnotacao(a, ctx.perfil);
  // Os módulos que se podem ligar: os ligados no escritório (as pessoas sempre existem).
  const modulos = MODULOS_DA_ANOTACAO.filter(m => m === 'pessoas' || !!ctx.escritorio?.modulos?.[m]);
  const depois = () => { aoMudar(); void carregar(); void carregarItens(); setVersaoHist(v => v + 1); };

  async function arquivar() {
    const estava = !!a!.arquivado_em;
    try {
      await SD.anotacoesArquivar([a!.id], !estava);
      feito(estava ? 'Anotação desarquivada.' : 'Anotação arquivada. Arquivadas podem ser excluídas depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.anotacoesArquivar([a!.id], estava); });
      depois();
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.anotacoesExcluir([a!.id]);
    if (r.excluidas) { avisar('Anotação excluída definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function ligar(i: Pick<ItemDaAnotacao, 'modulo' | 'id' | 'nome'>) {
    try {
      // Se outra pessoa ligou o mesmo item enquanto a busca estava aberta, nada é gravado: sem Desfazer, que apagaria a ligação dela (#341).
      if (!await SD.anotacaoLigar(a!.id, i.modulo, i.id)) { avisar(ITEM_JA_LIGADO, 'info'); depois(); return; }
      feito(`Ligada a ${ITEM_DA_ANOTACAO[i.modulo].rotulo.toLowerCase()}: ${i.nome}.`, 'ligação da anotação', async () => { await SD.anotacaoDesligar(a!.id, i.modulo, i.id); });
      depois();
    } catch (e) { falha(e); }
  }
  async function desligar(i: ItemDaAnotacao) {
    try {
      await SD.anotacaoDesligar(a!.id, i.modulo, i.id);
      feito(`Desligada de ${ITEM_DA_ANOTACAO[i.modulo].rotulo.toLowerCase()}: ${i.nome}.`, 'desligamento da anotação', async () => { await SD.anotacaoLigar(a!.id, i.modulo, i.id); });
      depois();
    } catch (e) { falha(e); }
  }
  /**
   * Leva a anotação nova ao banco, uma vez só: com o que a pessoa escreveu primeiro (o título ou o texto) e com o que ela escolheu
   * antes (a pasta, a equipe, as etiquetas e os itens). Quem pede depois, enquanto ela vai, espera a mesma ida. Sem aviso no pé da
   * tela, como o texto que salva sozinho. O que a pessoa mudou nas escolhas enquanto ela ia (mudadoNaIda) é gravado logo depois.
   * Se a criação falhar, a próxima gravação tenta de novo (a pasta ou uma etiqueta pode ter sido apagada por um colega: as listas
   * lidas de novo as tiram da tela). Depois de criada, ela não é criada de novo: uma falha nos passos seguintes (o que mudou na
   * ida, a leitura) aparece no pé da tela, e a janela passa a mostrar a anotação como está no banco.
   */
  function garantirGravada(escrito: EscritoNaAnotacaoNova): Promise<Anotacao> {
    if (criacao.current) return criacao.current;
    setCriando(true);
    const ida = (async () => {
      const foi = await rascunho.paraGravar();
      const r = await SD.anotacaoCriar({ ...dadosDaAnotacaoNova(escrito, foi.equipe), pasta_id: foi.pasta }, foi.ligacoes, foi.etiquetas);
      noBanco.current = r.id;
      try {
        // O que mudou enquanto ela ia, e depois o que mudou enquanto ela era lida (aí ela é lida de novo, já com isso).
        const depoisDaIda = await gravarOMudadoNaIda(r.id, foi);
        let gravada = await SD.anotacaoObter(r.id);
        if ((await gravarOMudadoNaIda(r.id, depoisDaIda.agora)).mudou) gravada = await SD.anotacaoObter(r.id);
        if (!gravada) throw new Error(NAO_ENCONTRADA);
        versao.current = { texto: gravada.texto, marca: gravada.atualizado_em };
        naTela.current = gravada;
        setA(gravada);
        return gravada;
      } finally {
        // Mesmo com uma falha depois de criada: com o id, a janela lê a anotação do banco (carregar).
        setCriada(r.id);
        trocarOEndereco(r.id);
        aoMudar();
      }
    })();
    criacao.current = ida;
    ida.catch(() => {
      criacao.current = null;
      void buscarPastas(ctx.perfil.id);
      void buscarEtiquetas();
    }).finally(() => setCriando(false));
    return ida;
  }
  /** A anotação nova foi ao banco: quem a abriu passa a mostrá-la pelo endereço dela, a não ser com uma saída segurada (veja "saindo"). */
  function trocarOEndereco(novoId: string) {
    if (!aberta.current) return;
    if (saindo.current) trocaGuardada.current = novoId;
    else aoCriar?.(novoId);
  }
  /** A saída segurada não aconteceu (a pessoa continua aqui): a troca de endereço guardada acontece agora. */
  function ficar() {
    saindo.current = false;
    const guardada = trocaGuardada.current;
    trocaGuardada.current = null;
    if (guardada) aoCriar?.(guardada);
  }
  /**
   * Grava na anotação nova, que acabou de ir ao banco, o que a pessoa mudou nas escolhas desde "antes" (o que já está gravado).
   * Devolve as escolhas de agora (o ponto de partida da próxima conferência) e se havia algo a gravar.
   */
  async function gravarOMudadoNaIda(id: string, antes: EscolhidoNaAnotacaoNova) {
    const agora = await rascunho.paraGravar();
    const m = mudadoNaIda(antes, agora);
    if (!mudouNaIda(m)) return { agora, mudou: false };
    await Promise.all([
      m.dados && SD.anotacaoAtualizar(id, m.dados),
      ...m.aplicar.map(e => SD.etiquetaAplicar('anotacoes', id, e)),
      ...m.tirar.map(e => SD.etiquetaTirar('anotacoes', id, e)),
      ...m.ligar.map(i => SD.anotacaoLigar(id, i.modulo, i.id)),
      ...m.desligar.map(i => SD.anotacaoDesligar(id, i.modulo, i.id))
    ]);
    return { agora, mudou: true };
  }
  /**
   * Grava o texto com a trava otimista: só se o banco ainda tem o texto de que a pessoa partiu (`base`). Vai direto com o
   * atualizado_em da última leitura; se a anotação mudou depois dela, lê de novo e decide (decidirGravacao): mudou só outro
   * campo, tenta de novo; o banco já tem este texto, está feito; outra pessoa mudou o texto, para, sem gravar por cima.
   */
  async function gravarSeNinguemMudou(id: string, texto: string, base: string): Promise<GravacaoDoTexto> {
    let lida = versao.current;
    for (let vez = 0; vez < TENTATIVAS_DE_GRAVAR; vez++) {
      if (!lida || lida.texto !== base) {
        const agora = await SD.anotacaoObter(id);
        if (!agora) throw new Error(NAO_ENCONTRADA);
        lida = versao.current = { texto: agora.texto, marca: agora.atualizado_em };
        const decisao = decidirGravacao({ base, noBanco: agora.texto, novo: texto });
        if (decisao === 'conflito') return { gravou: false, noBanco: agora };
        if (decisao === 'jaGravado') return { gravou: true, marca: agora.atualizado_em };
      }
      const marca = await SD.anotacaoGravarTexto(id, texto, lida.marca);
      if (marca) {
        versao.current = { texto, marca };
        return { gravou: true, marca };
      }
      lida = null;   // a anotação mudou depois da leitura: lê de novo
    }
    throw new Error(NAO_GRAVOU);
  }
  /**
   * Grava o texto que salva sozinho (as caixinhas marcadas no editor também), numa fila (veja "gravacoes"), sem aviso: a linha
   * "Salvo" já diz, e o Ctrl+Z da caixa desfaz. A tela só muda depois de gravado. Gravar o texto não lê de novo a página nem os
   * itens: só a própria anotação muda (o texto e a data). Diz se este texto foi gravado.
   */
  function gravarTexto(texto: string, base: string): Promise<boolean> {
    // Com o conflito à vista, o texto espera a pessoa escolher qual texto fica.
    if (emConflito.current) return Promise.resolve(false);
    const g = gravacoes.current;
    const partiuDe = baseEscolhida.current ?? base;
    g.pendentes++;
    setNaFila(g.pendentes);
    let gravou = false;
    g.fila = g.fila.then(async () => {
      try {
        // A anotação nova vai ao banco com este texto (só espaços não a levam: não há o que gravar). Se ela já ia, com o título,
        // o texto grava depois, como na anotação aberta.
        if (!noBanco.current) {
          if (!vaiAoBanco({ texto })) { soEspacos.current = texto; gravou = true; return; }
          if ((await garantirGravada({ texto })).texto === texto) { soEspacos.current = null; gravou = true; return; }
        }
        // O texto só de espaços que a caixa tomou por gravado está vazio no banco (a anotação foi com o título): é dele que a
        // pessoa partiu, sem conflito com ninguém.
        const r = await gravarSeNinguemMudou(noBanco.current!, texto, partiuDe === soEspacos.current ? '' : partiuDe);
        if (!r.gravou) {
          emConflito.current = true;
          setConflito(r.noBanco);
          return;
        }
        baseEscolhida.current = null;
        soEspacos.current = null;
        gravou = true;
        setA(atual => atual && { ...atual, texto, atualizado_em: r.marca });
      } catch (e) { falha(e); }
    }).then(() => { setNaFila(--g.pendentes); });
    return g.fila.then(() => gravou);
  }
  /** "Manter o meu texto": grava o que está na caixa por cima do texto da outra pessoa, que ela acabou de ver. */
  function manterOMeu() {
    if (!conflito) return;
    baseEscolhida.current = conflito.texto;
    emConflito.current = false;
    setConflito(null);
    void editor.current?.salvar();
  }
  /** "Usar o texto gravado": o que a pessoa escreveu sai, e a caixa recomeça com o texto da outra pessoa. */
  function usarOGravado() {
    if (!conflito) return;
    const gravada = conflito;
    emConflito.current = false;
    setConflito(null);
    setA(atual => atual && { ...atual, texto: gravada.texto, atualizado_em: gravada.atualizado_em });
    setRascunhos(r => ({ ...r, texto: null }));
    setTextoTrocado(v => v + 1);
  }
  /**
   * Grava o título mudado no próprio lugar (#339): só o título, com o aviso e o desfazer. A tela já mostra o novo; se a gravação
   * falhar, o título gravado volta. Na anotação nova, o título a leva ao banco; se ela já tinha ido com o texto (com o título
   * provisório), o título muda como na anotação aberta.
   */
  async function salvarTitulo(titulo: string) {
    let antes = a!.titulo;
    setA(atual => atual && { ...atual, titulo });
    try {
      if (!noBanco.current) {
        const gravada = await garantirGravada({ titulo });
        if (gravada.titulo === titulo) return;
        antes = gravada.titulo;
        setA(atual => atual && { ...atual, titulo });
      }
      const id = noBanco.current!;
      await SD.anotacaoAtualizar(id, { titulo });
      feito('Anotação atualizada.', 'atualização da anotação', async () => {
        await SD.anotacaoAtualizar(id, { titulo: antes });
        return { tipo: 'anotacaoAtualizada', id };
      });
      depois();
    } catch (e) {
      setA(atual => atual && { ...atual, titulo: antes });
      throw e;
    }
  }
  /** Leva a anotação para outra pasta (null: fora de qualquer pasta), com o aviso e o desfazer. */
  async function mudarPasta(pastaId: string | null) {
    const antes = a!.pasta_id, id = a!.id;
    setA(atual => atual && { ...atual, pasta_id: pastaId });
    try {
      await levarAnotacaoParaPasta(id, antes, pastaId, pastas ?? []);
      depois();
    } catch (e) {
      setA(atual => atual && { ...atual, pasta_id: antes });
      falha(e);
    }
  }
  /** Quem se tirou da anotação pelas bolinhas: ela fecha sem perguntar (a pessoa pode deixar de vê-la). */
  function sairDaAnotacao() {
    saidaLiberada.current = true;
    navegar(DOCUMENTOS);
  }
  /**
   * Baixa a anotação como arquivo .md, como está na tela. Os itens ligados são lidos na hora (a seção "Ligada a" pode estar
   * fechada ou ainda carregando), e só entram os que a pessoa vê.
   */
  async function baixar() {
    try {
      // Com as pastas ainda chegando, lê aqui mesmo: o .md não sai sem a pasta.
      const [{ visiveis }, lista] = await Promise.all([SD.anotacaoItens(a!.id), pastas ?? SD.pastasListar()]);
      const nomes = {
        responsavel: nomeDe(a!.responsavel_id),
        pasta: caminhoDaPasta(lista, a!.pasta_id).map(p => p.nome),
        etiquetas: etiquetasDoEscritorio.filter(e => etiquetas.ids.includes(e.id)).map(nomeDaEtiqueta)
      };
      baixarArquivo(nomeDoArquivo(a!.titulo, a!.codigo), markdownDaAnotacao(a!, visiveis, nomes), TIPO_MARKDOWN);
    } catch (e) { falha(e); }
  }
  /**
   * Duplica a anotação e abre a cópia. O que ela leva vem de dadosDaCopia; as ligações, só as que a pessoa vê, o banco copia. A
   * cópia parte do que está gravado, não da tela: grava antes o texto que falta, espera a fila e lê a original de novo (outra
   * pessoa pode tê-la mudado depois que ela abriu). Desfazer arquiva e exclui a cópia, como no cadastro.
   */
  async function duplicar() {
    try {
      await editor.current?.salvar();
      await gravacoes.current.fila;
      const original = await SD.anotacaoObter(a!.id);
      if (!original) throw new Error(NAO_ENCONTRADA);
      const quem = { id: ctx.perfil.id, alteraAOriginal: alteraAAnotacao(original, ctx.perfil, chaves, meusGrupos(ctx.grupos, ctx.perfil.id)), equipe: ctx.equipe };
      const copia = await SD.anotacaoDuplicar(original.id, dadosDaCopia(original, quem));
      feito(`Anotação ${original.codigo} duplicada como ${copia.codigo}.`, 'cópia da anotação', async () => {
        await SD.anotacoesArquivar([copia.id], true);
        const x = await SD.anotacoesExcluir([copia.id]);
        if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer a cópia.');
        return { tipo: 'anotacaoCriada', id: copia.id };
      });
      aoMudar();
      navegar(ENDERECO_DA_ANOTACAO + copia.id);
    } catch (e) { falha(e); }
  }
  /** "Mover para pasta", no ⋯ (#370): a mesma janela do ⋯ da anotação no explorador. */
  async function moverParaPasta() {
    const destino = await escolherPastaDaAnotacao(pastas ?? [], a!.pasta_id, a!.titulo);
    if (destino !== undefined) await mudarPasta(destino);
  }
  const lidos = itens && typeof itens !== 'string' ? itens : null;
  const totalLigados = lidos ? lidos.visiveis.length + lidos.ocultos : undefined;
  // O título e o texto se mudam no próprio lugar só por quem altera, e só com a anotação ativa (a arquivada fica como está).
  const mudaNoLugar = podeAlterar && !a.arquivado_em;
  const acoesDoMenu: AcaoDoTopo[] = [
    ...(mudaNoLugar ? [{ rotulo: 'Mover para pasta', icone: 'seta', aoClicar: moverParaPasta } satisfies AcaoDoTopo] : []),
    { rotulo: 'Duplicar', icone: 'copiar', aoClicar: duplicar }, { rotulo: 'Baixar .md', icone: 'baixar', aoClicar: baixar }
  ];
  // "Sair sem salvar" descarta o que está em edição: o título e o texto voltam ao gravado.
  function descartarEdicao() {
    setRascunhos({});
    emConflito.current = false;
    setConflito(null);
    setEdicaoDescartada(v => v + 1);
  }
  /**
   * Antes de sair, grava o texto que falta e espera a fila das gravações; o título ainda aberto não se grava sozinho (Enter ou
   * sair do campo o gravam). Na anotação nova, o título ainda aberto a leva ao banco: a pessoa escreveu algo. Diz se ficou tudo
   * gravado.
   */
  async function salvarAntesDeSair() {
    // A anotação nova que for ao banco agora não troca de endereço até a saída se decidir (veja "saindo").
    saindo.current = true;
    const tituloAberto = rascunhos.titulo?.trim() ?? '';
    const levaANova = !noBanco.current && vaiAoBanco({ titulo: tituloAberto });
    if (levaANova) {
      try { await salvarTitulo(tituloAberto); } catch (e) { falha(e); return false; }
    }
    const gravou = await (editor.current?.salvar() ?? Promise.resolve(true));
    await gravacoes.current.fila;
    const foi = await (criacao.current?.then(() => true, () => false) ?? true);
    return gravou && foi && (levaANova || !edicaoPorSalvar(comoNaJanela(naTela.current ?? a!), { titulo: rascunhos.titulo }));
  }
  // Há o que perder enquanto o editor tem texto por gravar ou gravando (o rascunho só some depois que o banco aceita), enquanto
  // há gravações na fila, enquanto a anotação nova vai ao banco e enquanto o título aberto difere do gravado: a saída espera a
  // gravação. Na anotação nova sem nada escrito, não há o que perder (o que foi escolhido antes não vai sozinho ao banco).
  const porSalvar = rascunhos.texto != null || naFila > 0 || criando || edicaoPorSalvar(comoNaJanela(a), { titulo: rascunhos.titulo });
  // O título provisório ("Sem título") conta como sem título: aparece apagado, e o campo abre vazio.
  const titulo = tituloNaJanela(a.titulo);
  /** O Enter no título da anotação nova desce para o texto, como numa nota. */
  const focarTexto = () => document.getElementById(idDoTexto)?.focus({ preventScroll: true });
  const chavesDaMencao = { equipeVeTudo: equipeVeTudo(ctx.escritorio), equipeEditaTudo: chaves.equipeEditaTudo };

  return <article className="anotacao-aberta" aria-label={emBranco ? 'Anotação nova' : `Anotação ${a.codigo}`}>
    {/* Sempre montado: a saída que espera a gravação continua depois dela, quando já não há nada por salvar. */}
    <AvisoAoSair preenchido={porSalvar} liberada={saidaLiberada} ocupado={false} aoDescartar={descartarEdicao} salvarAntes={salvarAntesDeSair} aoFicar={ficar} />
    {/* O topo num lugar só (o da anotação nova ou o da gravada): o título e o texto, logo abaixo, continuam os mesmos quando a
        anotação nova vai ao banco. */}
    {emBranco ? <TopoDoRascunho rascunho={rascunho} pastas={pastas} /> : <>
      <header className="anotacao-topo">
        <CaminhoDaPasta pastas={pastas} pastaId={a.pasta_id} comLinks aoMudar={mudaNoLugar ? mudarPasta : undefined} />
        <div className="anotacao-topo-acoes">
          {a.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
          {/* Quem altera muda a equipe nas bolinhas (#356), com as regras de sair da anotação (#276). */}
          <EquipeNoTopo modulo="anotacoes" id={a.id} equipe={{ responsavel_id: a.responsavel_id, lista: a.participantes }} grupos={a.grupos} mudar={mudaNoLugar ? {
            saida: { podeSair: gravaForaDaAnotacao(ctx, a.criado_por === ctx.perfil.id) }, depois, aoSair: sairDaAnotacao
          } : null} />
          {/* A etiqueta e o ⋯ ficam junto dos botões da janela (o formato e o X), como os botões do topo dos outros cartões. A etiqueta
              abre a mesma escolha da seção "Etiquetas" dos outros cartões; quem só lê vê só os selos. */}
          <NoTopoDoCartao>
            {mudaNoLugar && <BotaoDasEtiquetas ids={etiquetas.ids} aoMarcar={etiquetas.marcar} aoMudar={depois} rotulo="Etiquetas" className="cartao-botao" comDica>
              <Icone nome="etiqueta" tam={ICONE_DO_TOPO} />
            </BotaoDasEtiquetas>}
            <MenuDoCartao arquivado={!!a.arquivado_em} aoArquivar={podeAlterar ? arquivar : undefined}
              excluir={podeExcluir ? { oQue: 'a anotação', aoConfirmar: excluir } : undefined} extras={acoesDoMenu} />
          </NoTopoDoCartao>
        </div>
      </header>
      {/* As etiquetas escolhidas, numa linha entre o topo e o título (sem etiquetas, ela não aparece). */}
      <SelosDasEtiquetas ids={etiquetas.ids} rotulo="Etiquetas" aoTirar={mudaNoLugar ? e => etiquetas.marcar(e, false) : undefined} />
    </>}

    {/* A anotação nova abre com o cursor no título; sem título (ou com o provisório), ele aparece como "Sem título", apagado. */}
    <TituloEditavel key={'titulo-' + edicaoDescartada} className={'anotacao-titulo' + (titulo ? '' : ' sem-titulo')} valor={titulo}
      exibido={titulo ? undefined : TITULO_PROVISORIO} aoSalvar={mudaNoLugar ? salvarTitulo : undefined} conferir={erroDoTitulo}
      maximo={TAMANHO_ANOTACAO.titulo} placeholder={TITULO_PROVISORIO} aoMudarRascunho={mudarRascunho('titulo')}
      editandoAoAbrir={emBranco} depoisDoEnter={emBranco ? focarTexto : undefined} />
    {/* A faixa das datas (#383), a mesma dos outros cartões, entre o título e o texto: a criação. A última gravação fica no pé
        ("Atualizada agora", que acompanha o salvar sozinho). A anotação nova ainda não tem datas, nem a que acabou de ir ao banco
        e ainda não foi lida de volta (se a leitura falhar, ela continua a em branco, sem a data do banco). */}
    {!emBranco && a.criado_em && <GrupoDeDatas rotulo="Datas">
      <DadoDoGrupo rotulo="Criada em"><b className="num">{dataDaCriacao(a.criado_em)}</b></DadoDoGrupo>
    </GrupoDeDatas>}
    {!podeAlterar && <Nota>{POR_QUE_SO_LE[equipeVeTudo(ctx.escritorio) ? 'equipe' : 'item']}</Nota>}
    {a.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Anotação arquivada. Se não for mais necessária, pode ser excluída definitivamente, pelo menu ⋯.'
        : 'Anotação arquivada. Só quem a escreveu ou um administrador pode excluí-la.'}</span>
    </div>}

    {conflito && <Aviso tipo="erro" className="anotacao-conflito">
      <p>Outra pessoa mudou o texto desta anotação enquanto você escrevia. Nada foi gravado por cima: escolha qual texto fica.</p>
      <div className="anotacao-conflito-acoes">
        <button type="button" className={estiloBotao({ forma: 'mini', variante: 'principal' })} onClick={manterOMeu}>Manter o meu texto</button>
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={usarOGravado}>Usar o texto gravado</button>
      </div>
    </Aviso>}
    <EditorDeTexto key={`texto-${edicaoDescartada}-${textoTrocado}`} id={idDoTexto} texto={a.texto} className="anotacao-texto" maximo={TAMANHO_ANOTACAO.texto}
      conferir={erroDoTexto} placeholder={DICA_DO_TEXTO} vazio={<Nota>Sem texto ainda.</Nota>} controle={editor} conflito={!!conflito}
      aindaNaoGravada={emBranco} aoSalvar={mudaNoLugar ? gravarTexto : undefined}
      aoMudarRascunho={mudarRascunho('texto')} lugarDaSituacao={lugarDaSituacao} folgaEmbaixo={folgaDoPe} />

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: os comentários (abertos), o
        que a anotação liga e o histórico (recolhidos). Quem vê a anotação comenta, mesmo quem só a lê, como nos outros cartões (#364).
        Na anotação nova, "Ligada a" vem aberta, com os itens escolhidos antes de ela ir ao banco, e ainda não há o que comentar.
        Quando ela vai ao banco, a coluna recomeça (a chave), na ordem de sempre, com o "Expandir tudo" no topo; "Ligada a" continua aberta. */}
    <NaColunaDoCartao key={emBranco ? 'coluna-nova' : 'coluna'}>
      {emBranco
        ? <Recolhivel titulo="Comentários" icone="comentario" contador={0} abertaAoIniciar>
          <Nota>Para comentar, escreva antes o título ou o texto: a anotação é gravada assim que você escreve.</Nota>
        </Recolhivel>
        : <SecaoComentarios modulo="anotacoes" cartaoId={a.id} motivoSemMencao={motivoSemMencaoNaAnotacao(a, chavesDaMencao)} />}
      <Recolhivel titulo="Ligada a" icone="vinculo" preferencia="anotacoes.cartao.ligada" contador={emBranco ? rascunho.itens.length : totalLigados} abertaAoIniciar={emBranco || !!criada}>
        {emBranco ? <LigadosDoRascunho rascunho={rascunho} />
          : itens === null ? <Carregando />
          : typeof itens === 'string' ? <Aviso tipo="erro">{itens}</Aviso>
          : <>
            {itens.ocultos > 0 && <Nota>Há {plural(itens.ocultos, 'item ligado', 'itens ligados')} aqui que você não tem acesso para abrir.</Nota>}
            <ItensLigados rotulo="Itens ligados" vazio={itens.ocultos ? undefined : 'Esta anotação não está ligada a nenhum item.'} itens={itens.visiveis.map(i => ({
              id: `${i.modulo}-${i.id}`, para: enderecoDoItem(i), codigo: `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo}`, titulo: i.nome,
              selo: i.arquivado_em ? 'Arquivado' : undefined,
              acao: podeLigar ? <button type="button" className="icone-btn" title="Desligar" aria-label={`Desligar ${i.nome}`} onClick={() => desligar(i)}>
                <Icone nome="fechar" tam={ICONE_DO_DESLIGAR} />
              </button> : undefined
            }))} />
            {podeLigar && (totalLigados ?? 0) < ITENS_DA_ANOTACAO && <div className="ligados-acoes">
              <LigarItem modulos={modulos} ligados={itens.visiveis} aoEscolher={ligar} />
              <NovoNaAnotacao modulos={modulos} anotacaoId={a.id} itens={itens.visiveis} />
            </div>}
            {podeLigar && (totalLigados ?? 0) >= ITENS_DA_ANOTACAO && <Nota>A anotação já está ligada a {ITENS_DA_ANOTACAO} itens, o máximo.</Nota>}
          </>}
      </Recolhivel>

      <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="anotacoes.cartao.historico" contador={emBranco ? 0 : historico}>
        {emBranco ? <Nota>Nenhuma alteração ainda.</Nota>
          : <HistoricoDoCartao carregar={() => historicoJunto(a.id)} campos={CAMPOS_ANOTACAO} valor={valorNoHistorico} soQueMudou={SO_QUE_MUDOU} versao={versaoHist} />}
      </Recolhivel>
    </NaColunaDoCartao>

    {/* O pé da janela (#372): a linha da gravação ("Salvando…", "Salvo", que o editor põe no lugar marcado) e o rodapé, por último,
        como nos outros cartões. Com texto curto, ficam encostados no fim da janela; com texto longo, presos ao pé enquanto o texto
        rola, e no fim da rolagem logo depois do que há acima, sem cobrir nada (Documentos.css). Ao lado e na janela estreita, as
        seções da coluna ficam acima dele. */}
    <div className="anotacao-pe" ref={pe}>
      <div className="anotacao-pe-situacao" ref={setLugarDaSituacao} />
      {emBranco
        ? <footer className="cartao-rodape"><span>Anotação nova · gravada assim que você escrever o título ou o texto</span></footer>
        : <footer className="cartao-rodape">
          <span>Anotação <span className="codigo">{a.codigo}</span> · Criada em {dataCurta(a.criado_em)}{a.criado_por ? ' por ' + nomeDe(a.criado_por) : ''}</span>
          <span>Atualizada {relativo(a.atualizado_em)}</span>
        </footer>}
    </div>
  </article>;
}
