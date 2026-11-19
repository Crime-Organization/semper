// A anotação aberta, como uma nota do Obsidian, na janela do cartão (PainelCartao), no centro ou ao lado, como a pessoa escolhe
// nos outros cartões (pedidos do dono de 18/11; antes, #303, #339, #340, #342): no topo, numa linha só, o caminho da pasta (que
// leva à pasta e, para quem altera, muda a pasta) e, à direita, a equipe em bolinhas, o ícone de etiqueta (abre a escolha das
// etiquetas) e o menu ⋯ (duplicar, baixar .md, arquivar, excluir), junto dos botões da janela (NoTopoDoCartao). Logo abaixo, os
// selos das etiquetas (sem etiquetas, a linha some); depois, o título grande, mudado ali mesmo, e o texto, que já abre na caixa de
// escrever, com a formatação à vista, e salva sozinho (EditorDeTexto): sem modo de ler à parte. "Comentários" (aberta), "Ligada
// a" e "Histórico de alterações" (recolhidas) vão para a coluna da direita da janela no centro (NaColunaDoCartao), com o
// "Expandir tudo" no topo dela; ao lado, ficam embaixo do texto, na mesma ordem.
// Sem lápis: tudo se muda no próprio lugar.
// Quem a vê só por um item ligado lê tudo (o texto formatado, sem caixa), mas não muda nada; todos podem baixá-la em .md (#345)
// e duplicá-la (#343): a cópia é de quem a faz e leva só os itens ligados que ela vê. Sair com algo por gravar (ou ainda
// gravando) espera a gravação (AvisoAoSair); só se ela falhar, a pergunta aparece.
// O texto grava com trava otimista (decidirGravacao): se outra pessoa o mudou depois que a anotação abriu, nada é gravado por
// cima, e a pessoa escolhe qual texto fica. Cada pausa ao digitar grava só o texto, sem ler de novo a página inteira, e o
// histórico junta as gravações seguidas do texto numa linha só (juntarTextoNoHistorico).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type Anotacao, type ItemDaAnotacao } from '../dados';
import { ITENS_DA_ANOTACAO, TAMANHO_ANOTACAO } from '../dados/limites';
import {
  alteraAAnotacao, dadosDaCopia, DICA_DO_TEXTO, edicaoPorSalvar, enderecoDoItem, erroDoTexto, erroDoTitulo, excluiAAnotacao, gravaForaDaAnotacao, ITEM_DA_ANOTACAO, ligaNaAnotacao,
  MODULOS_DA_ANOTACAO, motivoSemMencaoNaAnotacao, type RascunhosDaAnotacao
} from '../regras/anotacao';
import { markdownDaAnotacao, nomeDoArquivo } from '../regras/anotacaoEmMarkdown';
import { nomeDaEtiqueta } from '../regras/etiquetas';
import { caminhoDaPasta, textoDoCaminho } from '../regras/pastas';
import { equipeEditaTudo, equipeVeTudo } from '../regras/equipeVeTudo';
import { ICONE_DO_TOPO, MenuDoCartao, NoTopoDoCartao, type AcaoDoTopo } from '../ui/AcoesDoCartao';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { SecaoComentarios } from '../ui/Comentarios';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, EditorDeTexto, estiloBotao, Nota, Selo, TituloEditavel, Vazio, type ControleDoEditor } from '../ui/base';
import { EquipeNoTopo } from './EquipeNoTopo';
import { BotaoDasEtiquetas, SelosDasEtiquetas, useEtiquetas, useEtiquetasDoCartao } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarItem } from '../ui/LigarItem';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { CaminhoDaPasta } from '../ui/Pastas';
import { usePastas } from '../ui/pastasDoEscritorio';
import { Recolhivel } from '../ui/Recolhivel';
import { decidirGravacao, juntarTextoNoHistorico } from '../regras/salvamento';
import { JUNTAR_TEXTO_NO_HISTORICO } from '../ui/tempos';
import { useCtx } from '../ui/sessao';
import { useQuantos } from '../ui/useQuantos';
import { baixarArquivo, dataCurta, relativo } from '../ui/util';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ENDERECO_DA_ANOTACAO } from './AnotacoesDoCartao';
import { plural } from './importarPessoas/textos';
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
  id: string;
  /** Avisa a página de que algo mudou (para ler de novo o explorador e a lista). */
  aoMudar: () => void;
  /** Fecha a janela da anotação (a página volta à lista), depois que ela é excluída. */
  aoFechar: () => void;
}
type ItensLidos = { visiveis: ItemDaAnotacao[]; ocultos: number };

export function CartaoAnotacao({ id, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const navegar = useNavigate();
  const [a, setA] = useState<Anotacao | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
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
  const pastas = usePastas({ precisa: a?.pasta_id ?? null });
  const etiquetasDoEscritorio = useEtiquetas();
  const etiquetas = useEtiquetasDoCartao('anotacoes', id);

  const carregar = useCallback(() => {
    const esta = ++leitura.current;
    return SD.anotacaoObter(id).then(x => {
      if (esta !== leitura.current) return;   // velha: vale a resposta mais recente
      if (x) versao.current = { texto: x.texto, marca: x.atualizado_em };
      if (gravacoes.current.pendentes) return;   // há gravação na fila: a tela fica com o que ela já mostra
      setA(x);
      setErro('');
    }).catch(e => setErro((e as Error).message));
  }, [id]);
  const carregarItens = useCallback(() => SD.anotacaoItens(id).then(setItens).catch(e => setItens((e as Error).message)), [id]);
  useEffect(() => { void carregar(); void carregarItens(); }, [carregar, carregarItens]);
  // Depois de desfazer: mostra a anotação como ficou.
  useMudancas(() => { void carregar(); void carregarItens(); setVersaoHist(v => v + 1); });
  const historico = useQuantos(() => historicoJunto(id), `${id}:${versaoHist}`);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (a === undefined) return <Carregando />;
  if (!a) return <Vazio>{NAO_ENCONTRADA}</Vazio>;

  const chaves = { equipeEditaTudo: equipeEditaTudo(ctx.escritorio) };
  const podeAlterar = alteraAAnotacao(a, ctx.perfil, chaves);
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
    const g = gravacoes.current, id = a!.id;
    const partiuDe = baseEscolhida.current ?? base;
    g.pendentes++;
    setNaFila(g.pendentes);
    let gravou = false;
    g.fila = g.fila.then(async () => {
      try {
        const r = await gravarSeNinguemMudou(id, texto, partiuDe);
        if (!r.gravou) {
          emConflito.current = true;
          setConflito(r.noBanco);
          return;
        }
        baseEscolhida.current = null;
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
   * falhar, o título gravado volta.
   */
  async function salvarTitulo(titulo: string) {
    const antes = a!.titulo, id = a!.id;
    setA(atual => atual && { ...atual, titulo });
    try {
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
      await SD.anotacaoAtualizar(id, { pasta_id: pastaId });
      const onde = pastaId ? `para a pasta ${textoDoCaminho(pastas ?? [], pastaId)}` : 'para fora das pastas';
      feito(`Anotação levada ${onde}.`, 'mudança da pasta da anotação', async () => {
        await SD.anotacaoAtualizar(id, { pasta_id: antes });
        return { tipo: 'anotacaoAtualizada', id };
      });
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
      const original = await SD.anotacaoObter(id);
      if (!original) throw new Error(NAO_ENCONTRADA);
      const quem = { id: ctx.perfil.id, alteraAOriginal: alteraAAnotacao(original, ctx.perfil, chaves), equipe: ctx.equipe };
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
  const acoesDoMenu: AcaoDoTopo[] = [{ rotulo: 'Duplicar', icone: 'copiar', aoClicar: duplicar }, { rotulo: 'Baixar .md', icone: 'baixar', aoClicar: baixar }];

  const lidos = itens && typeof itens !== 'string' ? itens : null;
  const totalLigados = lidos ? lidos.visiveis.length + lidos.ocultos : undefined;
  // O título e o texto se mudam no próprio lugar só por quem altera, e só com a anotação ativa (a arquivada fica como está).
  const mudaNoLugar = podeAlterar && !a.arquivado_em;
  // "Sair sem salvar" descarta o que está em edição: o título e o texto voltam ao gravado.
  function descartarEdicao() {
    setRascunhos({});
    emConflito.current = false;
    setConflito(null);
    setEdicaoDescartada(v => v + 1);
  }
  /**
   * Antes de sair, grava o texto que falta e espera a fila das gravações; o título ainda aberto não se grava sozinho (Enter ou
   * sair do campo o gravam). Diz se ficou tudo gravado.
   */
  async function salvarAntesDeSair() {
    const gravou = await (editor.current?.salvar() ?? Promise.resolve(true));
    await gravacoes.current.fila;
    return gravou && !edicaoPorSalvar(a!, { titulo: rascunhos.titulo });
  }
  // Há o que perder enquanto o editor tem texto por gravar ou gravando (o rascunho só some depois que o banco aceita), enquanto
  // há gravações na fila e enquanto o título aberto difere do gravado: a saída espera a gravação.
  const porSalvar = rascunhos.texto != null || naFila > 0 || edicaoPorSalvar(a, { titulo: rascunhos.titulo });

  return <article className="anotacao-aberta" aria-label={`Anotação ${a.codigo}`}>
    {/* Sempre montado: a saída que espera a gravação continua depois dela, quando já não há nada por salvar. */}
    <AvisoAoSair preenchido={porSalvar} liberada={saidaLiberada} ocupado={false} aoDescartar={descartarEdicao} salvarAntes={salvarAntesDeSair} />
    <header className="anotacao-topo">
      <CaminhoDaPasta pastas={pastas} pastaId={a.pasta_id} comLinks aoMudar={mudaNoLugar ? mudarPasta : undefined} />
      <div className="anotacao-topo-acoes">
        {a.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {/* Quem altera muda a equipe nas bolinhas (#356), com as regras de sair da anotação (#276). */}
        <EquipeNoTopo modulo="anotacoes" id={a.id} equipe={{ responsavel_id: a.responsavel_id, lista: a.participantes }} mudar={mudaNoLugar ? {
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

    <TituloEditavel key={'titulo-' + edicaoDescartada} className="anotacao-titulo" valor={a.titulo} aoSalvar={mudaNoLugar ? salvarTitulo : undefined} conferir={erroDoTitulo}
      maximo={TAMANHO_ANOTACAO.titulo} placeholder="Sem título" aoMudarRascunho={mudarRascunho('titulo')} />
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
    <EditorDeTexto key={`texto-${edicaoDescartada}-${textoTrocado}`} texto={a.texto} className="anotacao-texto" maximo={TAMANHO_ANOTACAO.texto} conferir={erroDoTexto}
      placeholder={DICA_DO_TEXTO} vazio={<Nota>Sem texto ainda.</Nota>} controle={editor} conflito={!!conflito}
      aoSalvar={mudaNoLugar ? gravarTexto : undefined}
      aoMudarRascunho={mudarRascunho('texto')} />

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: os comentários (abertos), o
        que a anotação liga e o histórico (recolhidos). Quem vê a anotação comenta, mesmo quem só a lê, como nos outros cartões (#364). */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="anotacoes" cartaoId={a.id}
        motivoSemMencao={motivoSemMencaoNaAnotacao(a, { equipeVeTudo: equipeVeTudo(ctx.escritorio), equipeEditaTudo: chaves.equipeEditaTudo })} />
      <Recolhivel titulo="Ligada a" icone="vinculo" preferencia="anotacoes.cartao.ligada" contador={totalLigados}>
        {itens === null ? <Carregando />
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
            </div>}
            {podeLigar && (totalLigados ?? 0) >= ITENS_DA_ANOTACAO && <Nota>A anotação já está ligada a {ITENS_DA_ANOTACAO} itens, o máximo.</Nota>}
          </>}
      </Recolhivel>

      <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="anotacoes.cartao.historico" contador={historico}>
        <HistoricoDoCartao carregar={() => historicoJunto(a.id)} campos={CAMPOS_ANOTACAO} valor={valorNoHistorico} soQueMudou={SO_QUE_MUDOU} versao={versaoHist} />
      </Recolhivel>
    </NaColunaDoCartao>

    {/* O rodapé, por último, como nos outros cartões (no centro, as seções de cima vão para a coluna, e ele fica no pé do texto). */}
    <footer className="cartao-rodape">
      <span>Anotação <span className="codigo">{a.codigo}</span> · Criada em {dataCurta(a.criado_em)}{a.criado_por ? ' por ' + nomeDe(a.criado_por) : ''}</span>
      <span>Atualizada {relativo(a.atualizado_em)}</span>
    </footer>
  </article>;
}
