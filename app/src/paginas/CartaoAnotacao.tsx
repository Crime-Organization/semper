// Cartão da anotação (painel ao lado ou janela no centro), no modelo dos outros cartões (#303): no topo, o código e as ações;
// o título e o texto formatado, em medida de leitura; a equipe; os itens a que ela está ligada, com a busca para ligar a
// mais um; o histórico e o rodapé. Quem a vê só por um item ligado lê tudo, mas não muda nada. Todos podem baixá-la em .md (#345)
// e duplicá-la (#343): a cópia é de quem a faz e leva só os itens ligados que ela vê.
// Desde a #339, como uma nota do Obsidian: quem altera clica no título ou no texto e muda ali mesmo (cada um grava só o que
// mudou); o lápis muda só a equipe. Com uma edição por salvar, sair do cartão pergunta antes (AvisoAoSair).
// Desde a #342, acima do título vem o caminho da pasta (cada pedaço leva à pasta, na página Documentos), e à esquerda dele o
// círculo das etiquetas, que abre ali mesmo a escolha. Quem altera muda a pasta e as etiquetas; quem só lê, vê.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type Anotacao, type ItemDaAnotacao } from '../dados';
import { ITENS_DA_ANOTACAO, TAMANHO_ANOTACAO } from '../dados/limites';
import {
  alteraAAnotacao, dadosDaCopia, DICA_DO_TEXTO, edicaoPorSalvar, enderecoDoItem, erroDoTexto, erroDoTitulo, excluiAAnotacao, gravaForaDaAnotacao, ITEM_DA_ANOTACAO, ligaNaAnotacao,
  MODULOS_DA_ANOTACAO, type RascunhosDaAnotacao
} from '../regras/anotacao';
import { markdownDaAnotacao, nomeDoArquivo } from '../regras/anotacaoEmMarkdown';
import { nomeDaEtiqueta } from '../regras/etiquetas';
import { caminhoDaPasta, textoDoCaminho } from '../regras/pastas';
import { equipeEditaTudo, equipeVeTudo } from '../regras/equipeVeTudo';
import { AcoesDeQuemLe, AcoesDoCartao, type AcaoDoTopo } from '../ui/AcoesDoCartao';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo, TextoEditavel, TituloEditavel, Vazio } from '../ui/base';
import { EquipeNoTopo } from './EquipeNoTopo';
import { CirculoDeEtiquetas, SelosDasEtiquetas, useEtiquetas, useEtiquetasDoCartao } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { LigarItem } from '../ui/LigarItem';
import { CaminhoDaPasta } from '../ui/Pastas';
import { usePastas } from '../ui/pastasDoEscritorio';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { useQuantos } from '../ui/useQuantos';
import { baixarArquivo, dataCurta, relativo } from '../ui/util';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ENDERECO_DA_ANOTACAO } from './AnotacoesDoCartao';
import { EditarEquipeDaAnotacao } from './EquipeDaAnotacao';
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

/** Quando a anotação não vem do banco (ao abrir o cartão, ou ao duplicar uma que sumiu depois que ele abriu). */
const NAO_ENCONTRADA = 'Esta anotação não foi encontrada. Ela pode ter sido excluída, ou você não tem acesso a ela.';
/** O aviso quando o item escolhido já estava ligado à anotação (alguém o ligou enquanto a busca estava aberta). */
export const ITEM_JA_LIGADO = 'Este item já estava ligado a esta anotação.';

/** O tipo do arquivo baixado: Markdown, em UTF-8 (acentos e emojis do texto chegam inteiros). */
const TIPO_MARKDOWN = 'text/markdown;charset=utf-8';
/** Para onde vai quem se tira da anotação: a página Documentos, sem o cartão (ela pode deixar de vê-la). */
const DOCUMENTOS = '/documentos/';

interface Props {
  id: string;
  /** Avisa a lista de que algo mudou (para recarregar a tabela). */
  aoMudar: () => void;
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
  const [editando, setEditando] = useState(false);
  /** A equipe está sendo gravada pelo lápis: sair agora pede para esperar (a gravação termina mesmo assim). */
  const [salvandoEquipe, setSalvandoEquipe] = useState(false);
  /** Muda quando a pessoa escolhe "Sair sem salvar": o título, o texto e a equipe em edição recomeçam, sem o que ela descartou. */
  const [edicaoDescartada, setEdicaoDescartada] = useState(0);
  /** O que está aberto para editar (o título, o texto, a equipe), para avisar ao sair com algo por salvar. */
  const [rascunhos, setRascunhos] = useState<RascunhosDaAnotacao>({});
  const mudarRascunho = useCallback(<K extends keyof RascunhosDaAnotacao>(campo: K) => (r: RascunhosDaAnotacao[K]) =>
    setRascunhos(atual => ({ ...atual, [campo]: r })), []);
  /** Marcada logo antes de sair por conta própria (a pessoa se tirou da anotação): aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  /**
   * As caixinhas marcadas uma atrás da outra: são gravadas em fila, na ordem dos cliques. Enquanto há gravação pendente, nenhuma
   * leitura do banco troca o texto da tela (ela viria sem os cliques ainda na fila, e o próximo clique partiria dela e os
   * apagaria). "confirmado" é o último texto que o banco aceitou, para a tela voltar a ele se uma gravação falhar; "geracao" muda
   * na falha, e as gravações que já estavam na fila, calculadas sobre o clique que falhou, são descartadas.
   */
  const caixinhas = useRef({ fila: Promise.resolve(), pendentes: 0, confirmado: '', geracao: 0 });
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
      if (esta !== leitura.current || caixinhas.current.pendentes) return;   // velha, ou há caixinha na fila: a fila lê no fim
      setA(x);
      setErro('');
    }).catch(e => setErro((e as Error).message));
  }, [id]);
  const carregarItens = useCallback(() => SD.anotacaoItens(id).then(setItens).catch(e => setItens((e as Error).message)), [id]);
  useEffect(() => { void carregar(); void carregarItens(); }, [carregar, carregarItens]);
  // Depois de desfazer: mostra a anotação como ficou.
  useMudancas(() => { void carregar(); void carregarItens(); setVersaoHist(v => v + 1); });
  const historico = useQuantos(() => SD.anotacaoHistorico(id), `${id}:${versaoHist}`);

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
   * Grava o texto novo: a tela muda na hora e a gravação entra na fila das caixinhas (veja "caixinhas"), com o aviso e o desfazer.
   * Vale para a caixinha marcada (o texto novo parte do que está na tela, que já tem os cliques anteriores, mesmo os ainda na
   * fila) e para o texto editado no próprio lugar (#339). Se uma gravação falhar, a tela volta ao último texto gravado, e as
   * seguintes já na fila não são gravadas. Quando a fila esvazia, a anotação é lida de novo. Diz se este texto foi gravado.
   */
  function gravarTexto(texto: string): Promise<boolean> {
    const c = caixinhas.current, antes = a!.texto, id = a!.id, geracao = c.geracao;
    if (!c.pendentes) c.confirmado = antes;
    c.pendentes++;
    setA(atual => atual && { ...atual, texto });
    let gravou = false;
    c.fila = c.fila.then(async () => {
      if (geracao !== c.geracao) return;   // uma gravação anterior falhou, e esta partiu dela: fica de fora
      try {
        await SD.anotacaoAtualizar(id, { texto });
        c.confirmado = texto;
        gravou = true;
        feito('Anotação atualizada.', 'atualização da anotação', async () => {
          await SD.anotacaoAtualizar(id, { texto: antes });
          return { tipo: 'anotacaoAtualizada', id };
        });
      } catch (e) {
        const gravado = c.confirmado;
        c.geracao++;
        falha(e);
        setA(atual => atual && { ...atual, texto: gravado });
      }
    }).then(() => { if (--c.pendentes === 0) depois(); });
    return c.fila.then(() => gravou);
  }
  const marcarCaixinha = (texto: string) => void gravarTexto(texto);
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
  /** Quem se tirou da anotação pela equipe: o cartão fecha sem perguntar (veja EditarEquipeDaAnotacao). */
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
  const baixarMd: AcaoDoTopo = { rotulo: 'Baixar .md', icone: 'baixar', aoClicar: baixar };
  /**
   * Duplica a anotação e abre o cartão da cópia. O que ela leva vem de dadosDaCopia; as ligações, só as que a pessoa vê, o banco
   * copia. A cópia parte do que está gravado, não da tela: espera as caixinhas ainda na fila e lê a original de novo (outra
   * pessoa pode tê-la mudado depois que o cartão abriu). Desfazer arquiva e exclui a cópia, como no cadastro.
   */
  async function duplicar() {
    try {
      await caixinhas.current.fila;
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
  const duplicarAcao: AcaoDoTopo = { rotulo: 'Duplicar', icone: 'copiar', aoClicar: duplicar };
  const acoesDoTopo = [duplicarAcao, baixarMd];
  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) depois();
  }

  const lidos = itens && typeof itens !== 'string' ? itens : null;
  const totalLigados = lidos ? lidos.visiveis.length + lidos.ocultos : undefined;
  // O título e o texto se mudam no próprio lugar só por quem altera, e só com a anotação ativa (a arquivada fica como está).
  const mudaNoLugar = podeAlterar && !a.arquivado_em;
  // "Sair sem salvar" descarta o que está em edição. O cartão pode continuar ao fundo (a anotação nova abre por cima dele), e
  // assim o título descartado não é salvo quando o campo perde o foco para ela.
  function descartarEdicao() {
    setEditando(false);
    setRascunhos({});
    setEdicaoDescartada(v => v + 1);
  }

  return <>
    {edicaoPorSalvar(a, rascunhos) && <AvisoAoSair preenchido liberada={saidaLiberada} ocupado={salvandoEquipe} aoDescartar={descartarEdicao} />}
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Anotação</Selo><span className="codigo">{a.codigo}</span>
        {a.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {podeAlterar
          ? <AcoesDoCartao editando={editando} arquivado={!!a.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)}
            excluir={podeExcluir ? { oQue: 'a anotação', aoConfirmar: excluir } : undefined} extras={acoesDoTopo} />
          : <AcoesDeQuemLe acoes={acoesDoTopo} />}
      </div>
      <CaminhoDaPasta pastas={pastas} pastaId={a.pasta_id} comLinks aoMudar={mudaNoLugar ? mudarPasta : undefined} />
      <div className="anotacao-titulo">
        <CirculoDeEtiquetas ids={etiquetas.ids} aoMarcar={etiquetas.marcar} somenteLer={!mudaNoLugar} aoMudar={depois} />
        <TituloEditavel key={edicaoDescartada} valor={a.titulo} aoSalvar={mudaNoLugar ? salvarTitulo : undefined} conferir={erroDoTitulo} maximo={TAMANHO_ANOTACAO.titulo}
          placeholder="Sem título" aoMudarRascunho={mudarRascunho('titulo')} />
      </div>
      <SelosDasEtiquetas ids={etiquetas.ids} aoTirar={mudaNoLugar ? e => etiquetas.marcar(e, false) : undefined} />
    </header>

    {/* O lápis muda só a equipe: o título e o texto já se mudam no próprio lugar. */}
    {editando
      ? <EditarEquipeDaAnotacao anotacao={a} aoTerminar={terminarEdicao} aoSairDaAnotacao={sairDaAnotacao} aoMudarRascunho={mudarRascunho('equipe')}
        aoMudarOcupado={setSalvandoEquipe} />
      : <div className="cartao-acoes">
        {/* Quem tem o lápis muda a equipe também nas bolinhas (#356), com as regras de sair da anotação do lápis (#276). */}
        <EquipeNoTopo modulo="anotacoes" id={a.id} equipe={{ responsavel_id: a.responsavel_id, lista: a.participantes }} mudar={mudaNoLugar ? {
          saida: { podeSair: gravaForaDaAnotacao(ctx, a.criado_por === ctx.perfil.id) }, depois, aoSair: sairDaAnotacao
        } : null} />
      </div>}
    {!podeAlterar && <Nota>{POR_QUE_SO_LE[equipeVeTudo(ctx.escritorio) ? 'equipe' : 'item']}</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {a.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Anotação arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Anotação arquivada. Só quem a escreveu ou um administrador pode excluí-la.'}</span>
    </div>}

    <TextoEditavel key={edicaoDescartada} texto={a.texto} className="anotacao-texto" classeDaCaixa="anotacao-caixa" maximo={TAMANHO_ANOTACAO.texto} conferir={erroDoTexto}
      placeholder={DICA_DO_TEXTO} vazio={<Nota>Sem texto ainda.</Nota>} convite="Sem texto ainda. Clique para escrever."
      aoSalvar={mudaNoLugar ? gravarTexto : undefined} aoMarcar={mudaNoLugar ? marcarCaixinha : undefined} aoMudarRascunho={mudarRascunho('texto')} />

    <Recolhivel titulo="Ligada a" icone="vinculo" preferencia="anotacoes.cartao.ligada" contador={totalLigados}>
      {itens === null ? <Carregando />
        : typeof itens === 'string' ? <Aviso tipo="erro">{itens}</Aviso>
        : <>
          {itens.ocultos > 0 && <Nota>Há {plural(itens.ocultos, 'item ligado', 'itens ligados')} aqui que você não tem acesso para abrir.</Nota>}
          <ItensLigados rotulo="Itens ligados" vazio={itens.ocultos ? undefined : 'Esta anotação não está ligada a nenhum item.'} itens={itens.visiveis.map(i => ({
            id: `${i.modulo}-${i.id}`, para: enderecoDoItem(i), codigo: `${ITEM_DA_ANOTACAO[i.modulo].rotulo} · ${i.codigo}`, titulo: i.nome,
            selo: i.arquivado_em ? 'Arquivado' : undefined,
            acao: podeLigar ? <button type="button" className="icone-btn" title="Desligar" aria-label={`Desligar ${i.nome}`} onClick={() => desligar(i)}>
              <Icone nome="fechar" tam={14} />
            </button> : undefined
          }))} />
          {podeLigar && (totalLigados ?? 0) < ITENS_DA_ANOTACAO && <div className="ligados-acoes">
            <LigarItem modulos={modulos} ligados={itens.visiveis} aoEscolher={ligar} />
          </div>}
          {podeLigar && (totalLigados ?? 0) >= ITENS_DA_ANOTACAO && <Nota>A anotação já está ligada a {ITENS_DA_ANOTACAO} itens, o máximo.</Nota>}
        </>}
    </Recolhivel>

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="anotacoes.cartao.historico" contador={historico}>
      <HistoricoDoCartao carregar={() => SD.anotacaoHistorico(a.id)} campos={CAMPOS_ANOTACAO} valor={valorNoHistorico} soQueMudou={SO_QUE_MUDOU} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criada em {dataCurta(a.criado_em)}{a.criado_por ? ' por ' + nomeDe(a.criado_por) : ''}</span>
      <span>Atualizada {relativo(a.atualizado_em)}</span>
    </footer>
  </>;
}
