// Cartão da tarefa (painel ao lado ou janela no centro), no modelo do cartão da demanda: no topo (TopoDoCartao, #382, como o da
// anotação), o tipo e o código (o selo do prazo saiu do cartão aberto na #442: o prazo está na folhinha; no quadro e na lista, o
// selo continua), com a equipe da tarefa em bolinhas (responsável e participantes), a etiqueta, o lápis e o ⋯ à direita; logo
// abaixo, a linha da Situação, com o ✓ Concluir (ou Reabrir) redondo à direita (#397); os selos das etiquetas; o título; depois, os
// dados (CabecaDoCartao, #397): o bloco "Prazo e tempo" (#442, DadosDaTarefa): o prazo na folhinha (o início fica só na janela das
// datas, e a criação, no rodapé) e o relógio de quem altera, com o total da equipe e os registros embaixo (os botões rápidos
// da #351 viraram o "+" do topo, #399); depois, a descrição; e cada tópico numa seção que recolhe (demanda, pessoas,
// contrato), com o "Expandir tudo" sozinho acima da primeira (#394); comentários, anotações e histórico na coluna da direita.
// As demandas e os contratos ligados (vários desde a #283) aparecem sempre, mas só abrem para quem pode vê-los (os outros veem o código).
// Desde a #346, quem altera a tarefa muda o título e a descrição no próprio lugar, como na anotação; o lápis não os repete.
import { useCallback, useEffect, useState } from 'react';
import { SD, type PessoaResumida, type Tarefa } from '../dados';
import { useNavigate } from 'react-router';
import { descricaoAoGravar, erroNoLugar } from '../regras/edicaoNoLugar';
import {
  CAMPOS_TAREFA, continuaPelaDemanda, contratosQueAbre, DEMANDAS_DA_TAREFA_CHEIA, CONTRATOS_DA_TAREFA_CHEIA, demandasDaTarefa, demandasQueAbre, ligadasDaTarefa,
  ligadosDaTarefa, motivoSemMencaoNaTarefa, SEM_SITUACAO_TAREFA, TAREFA_VAZIA, validarTarefa, valorLegivelTarefa, estaNaTarefa, motivoDeSoLerATarefa
} from '../regras/tarefa';
import { useFuncoesNaTarefa } from '../ui/funcoesNaTarefa';
import { avisoDaFuncaoTrocada, comAFuncaoTrocada } from '../regras/funcoesNaTarefa';
import { CONTRATOS_POR_TAREFA, DEMANDAS_POR_TAREFA, TAMANHO_TAREFA } from '../dados/limites';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { contratosEmQueEsta } from '../regras/contrato';
import { equipeVeTudo, motivoDeSoLerOCartao } from '../regras/equipeVeTudo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { FaixaDoArquivado, TopoDoCartao } from '../ui/TopoDoCartao';
import { Aviso, Carregando, Nota, PrazoNaFolhinha, Selo, TextoEditavel, TituloEditavel, Vazio, type PedidoDeTirar } from '../ui/base';
import { CAMPOS_DO_PRAZO, datasDoPrazoComoEstao, errosDosCampos } from '../regras/datasNoCartao';
import { dataDaCriacao } from '../regras/dataDeInicio';
import { AvisoDaEdicaoNoLugar, gravarNoLugar, LembreteDoLapis, useEdicaoNoLugar } from '../ui/EdicaoNoLugar';
import { SecaoComentarios } from '../ui/Comentarios';
import { EquipeNoTopo } from './EquipeNoTopo';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useQuantos } from '../ui/useQuantos';
import type { Quadro } from '../ui/quadro/useColunas';
import { meusGrupos } from '../regras/gruposDaEquipe';
import { useCtx } from '../ui/sessao';
import NovaTarefa from './NovaTarefa';
import { relativo } from '../ui/util';
import { concluirOuReabrirItem, mudarSituacaoDoItem, type ItemQueMuda } from './situacaoDoItem';

import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { CompromissosDoItem } from './CompromissosDoItem';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ListasDoCartao } from './ListasDoCartao';
import { ProcessosDoCartao, type ProcessosLidos } from './ProcessosDoCartao';
import { DadosDaTarefa } from './TempoNaTarefa';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { SituacaoDoCartao } from '../ui/quadro/SituacaoDoCartao';
import { ConcluirNaSituacao } from '../ui/quadro/ConcluirNaSituacao';
import { CabecaDoCartao } from '../ui/CabecaDoCartao';
import { acaoDeConclusao, type AcaoDeConclusao } from '../regras/conclusaoNoCartao';
import { AcoesDosLigados, CriarNoCartao } from '../ui/ItensLigados';
import { LigarDoModulo, ligarDoModulo } from '../ui/LigarDoModulo';
import { LIGAR_PROCESSO } from '../ui/LigarProcesso';
import { ligarContratoNaTarefa, ligarEAvisar, ligarTarefaNaDemanda, tirarDaTarefa, tirarEAvisar } from './ligarNoCartao';
import { LigarPessoaNoItem, ligarPessoaNoItem, novaPessoaNoItem, tirarPessoaDoItem } from './PessoasNosItens';
import { podeTirarADemandaDaTarefa, TIRAR_DA_TAREFA } from '../regras/tirarDoCartao';
import { copiarParaOutraDemanda } from './copiarTarefa';
import { COPIAR_PARA_OUTRA_DEMANDA } from '../regras/copiaDaTarefa';
import { FaixaDaAprovacao } from './AprovacaoDaTarefa';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoTarefa({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const navegar = useNavigate();
  const eu = ctx.perfil.id;
  const [t, setT] = useState<Tarefa | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  // Muda quando a devolução da tarefa (#313) grava um comentário: a seção dos comentários relê.
  const [versaoComentarios, setVersaoComentarios] = useState(0);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  // O título e a descrição em edição no próprio lugar (#346).
  const noLugar = useEdicaoNoLugar();
  // As funções dos participantes do escritório (#313).
  const funcoes = useFuncoesNaTarefa();

  const carregar = useCallback(() => SD.tarefaObter(id).then(x => { setT(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra a tarefa como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  // Quantas alterações o histórico tem, para o número ao lado do título.
  const historico = useQuantos(() => SD.tarefaHistorico(id), `${id}:${versaoHist}`);
  // O processo vem com a tarefa: o ligado que a pessoa não pode abrir só conta.
  const processoDaTarefa = useCallback(async (): Promise<ProcessosLidos> =>
    t?.processo ? { visiveis: [t.processo], ocultos: 0 } : { visiveis: [], ocultos: t?.processo_id ? 1 : 0 }, [t]);
  const comProcessos = !!ctx.escritorio?.modulos?.processos;

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (t === undefined) return <Carregando />;
  if (!t) return <Vazio>Esta tarefa não foi encontrada. Ela pode ter sido excluída, ou você não participa dela.</Vazio>;

  const podeExcluir = !!t.arquivado_em && (t.criado_por === eu || ctx.ehAdmin);
  // Quem está em qualquer uma das demandas altera; quem está em qualquer um dos contratos (ou no de uma das demandas) só lê (#283).
  const demandasAbertas = demandasQueAbre(t), contratosAbertos = contratosQueAbre(t);
  // Quem só pediu a tarefa (o solicitante, #313) também só lê, com o motivo próprio.
  const soLeitura = motivoDeSoLerATarefa(motivoDeSoLerOCartao(ctx, m => estaNaTarefa(t, m, demandasAbertas, meusGrupos(ctx.grupos, m.id)),
    m => contratosEmQueEsta([...contratosAbertos, ...demandasAbertas.map(d => d.contrato)], m).length > 0), t, eu);
  const podeAlterar = !soLeitura, veTudo = equipeVeTudo(ctx.escritorio);
  // Ligar à tarefa um item que já existe (#341): quem altera a tarefa, com ela ativa. Demandas e contratos, mais um a cada vez, até o
  // máximo (#283). Depois, o cartão lê tudo de novo.
  const podeLigar = podeAlterar && !t.arquivado_em, modulos = ctx.escritorio?.modulos;
  const depoisDeLigar = () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); };
  // O cadastro do processo que nasce gravado nesta tarefa (#376).
  const novoProcesso = '/processos/novo/?tarefa=' + t.id;
  // As demandas e os contratos ligados (#283), na ordem: a demanda, ligada (a que existe) ou criada já ligada (#376), mais uma a cada vez.
  const demandasLigadas = ligadasDaTarefa(t), contratosLigados = ligadosDaTarefa(t);
  const ligaDemanda = podeLigar && !!modulos?.demandas && demandasLigadas.length < DEMANDAS_POR_TAREFA, novaDemanda = '/demandas/nova/?tarefa=' + t.id;
  const ligaContrato = podeLigar && !!modulos?.contratos && contratosLigados.length < CONTRATOS_POR_TAREFA;
  // Copiar para outra demanda (#312), no ⋯: quem altera a tarefa, com ela ativa; a busca traz só as demandas que a pessoa altera.
  const copiar = podeLigar && !!modulos?.demandas
    ? [{ rotulo: COPIAR_PARA_OUTRA_DEMANDA, icone: 'copiar' as const, aoClicar: () => copiarParaOutraDemanda(t, id => navegar('/tarefas/?id=' + id), aoMudar) }]
    : [];
  // O "x" de cada pessoa, demanda e contrato (#424): tira só a ligação, com a pergunta antes e o Desfazer.
  const pessoa = (p: PessoaResumida): ItemLigado => ({ id: 'pessoa-' + p.id, para: '/pessoas/?id=' + p.id, codigo: p.codigo, titulo: p.nome,
    selo: p.arquivado_em ? 'Arquivada' : undefined, tirar: tirarPessoaDoItem('tarefas', t.id, p, t.pessoas.length, depoisDeLigar) });
  const tirarDaLista = (qual: 'demandas' | 'contratos', id: string, codigo: string): PedidoDeTirar => ({ oQue: TIRAR_DA_TAREFA[qual].oQue(codigo),
    explicacao: TIRAR_DA_TAREFA[qual].explicacao,
    aoTirar: () => tirarEAvisar(() => tirarDaTarefa(qual, t.id, id), TIRAR_DA_TAREFA[qual].feito(codigo), TIRAR_DA_TAREFA[qual].acao, depoisDeLigar) });
  // A tarefa só sai de uma demanda se continua em outra (regras/tirarDoCartao.ts).
  const tiraDemanda = podeTirarADemandaDaTarefa(demandasLigadas.length);
  // Cada demanda e cada contrato abrem só para quem pode vê-los; os outros veem o código, sem o link.
  const demandas: ItemLigado[] = demandasLigadas.map(({ id, codigo, item }) => ({ ...(item
    ? { id: 'demanda-' + id, para: '/demandas/?id=' + id, codigo: item.codigo, titulo: item.titulo, detalhe: 'Demanda' }
    : { id: 'demanda-' + id, codigo, titulo: 'Demanda ligada', detalhe: 'Você não tem acesso a esta demanda' }),
    tirar: tiraDemanda ? tirarDaLista('demandas', id, item?.codigo ?? codigo) : undefined }));
  const contratos: ItemLigado[] = contratosLigados.map(({ id, codigo, item }) => ({ ...(item
    ? { id: 'contrato-' + id, para: '/contratos/?id=' + id, codigo: item.codigo, titulo: item.servico, detalhe: 'Contrato' }
    : { id: 'contrato-' + id, para: veTudo ? '/contratos/?id=' + id : undefined, codigo, titulo: 'Contrato ligado', detalhe: veTudo ? 'Contrato, sem os valores' : 'Você não tem acesso a este contrato' }),
    tirar: tirarDaLista('contratos', id, item?.codigo ?? codigo) }));

  async function arquivar() {
    const estava = !!t!.arquivado_em;
    try {
      await SD.tarefasArquivar([t!.id], !estava);
      feito(estava ? 'Tarefa desarquivada.' : 'Tarefa arquivada. Arquivadas podem ser excluídas depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.tarefasArquivar([t!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.tarefasExcluir([t!.id]);
    if (r.excluidas) { avisar('Tarefa excluída definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  // Mudar a Situação (o menu e o ✓): a gravação comum do cartão, da miniatura do quadro e da tabela (situacaoDoItem, #350).
  /** A tarefa como a gravação comum (situacaoDoItem) precisa: onde ela está agora e se tem demanda (para oferecer concluí-la). */
  const comoItem = (): ItemQueMuda => ({ id: t!.id, titulo: t!.titulo, etapa_id: t!.etapa_id || null, etapa_ordem: t!.etapa_ordem ?? null, ligadoADemanda: !!t!.demanda });
  /** Depois de gravar: mostra a coluna nova e relê a tarefa (chegar ou sair da coluna das concluídas muda a data de conclusão e o
   *  resumo do tempo). */
  const depoisDeMudar = async (ordem: number, etapa: string | null) => {
    setT({ ...t!, etapa_id: etapa, etapa_ordem: ordem });
    aoMudar(); setVersaoHist(v => v + 1);
    await carregar();
  };
  /** Leva o item para a coluna escolhida no menu, com o aviso "Movida para …". */
  async function mudarSituacao(valor: string) {
    const etapa = valor || null;
    await mudarSituacaoDoItem('tarefas', comoItem(), etapa, etapa ? `Movida para "${quadro.nomeDe(etapa)}".` : `Tarefa ${SEM_SITUACAO_TAREFA.toLowerCase()}.`,
      navegar, depoisDeMudar);
  }

  /** Concluir leva à coluna das concluídas (a do marco, qualquer que seja o nome); Reabrir, de volta à do início. */
  function concluirOuReabrir(acao: AcaoDeConclusao) {
    return concluirOuReabrirItem('tarefas', quadro.colunas, comoItem(), acao, navegar, depoisDeMudar);
  }

  /** O título e a descrição mudam no próprio lugar só por quem altera, e só com a tarefa ativa (como o lápis). */
  const mudaNoLugar = podeAlterar && !t.arquivado_em;
  /** Grava o título ou a descrição mudados no próprio lugar (#346), como o lápis: o mesmo aviso, com Desfazer. */
  const salvarNoLugar = (novo: Partial<Pick<Tarefa, 'titulo' | 'descricao' | 'data_inicio' | 'prazo' | 'prazo_hora' | 'lembrete'>>, antes: typeof novo) => gravarNoLugar({
    novo, antes, gravar: d => SD.tarefaAtualizar(t!.id, d), aviso: 'Tarefa atualizada.', oQue: 'atualização da tarefa',
    mudanca: { tipo: 'tarefaAtualizada', id: t!.id }, mostrar: d => setT(atual => atual && { ...atual, ...d }),
    depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }
  });

  /** Troca a função de um participante (#313), no menu da bolinha, ou a tira (null, #421): o mesmo aviso do lápis, com Desfazer. */
  async function trocarFuncao(perfil: string, funcao: string | null) {
    const antes = t!.funcoes, id = t!.id;
    await SD.tarefaAtualizar(id, { funcoes: comAFuncaoTrocada(antes, perfil, funcao) });
    feito(avisoDaFuncaoTrocada(nomeDe(perfil), funcao && (funcoes.find(f => f.id === funcao)?.nome ?? '')), 'troca de função', async () => {
      await SD.tarefaAtualizar(id, { funcoes: antes });
      return { tipo: 'tarefaAtualizada', id };
    });
  }

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  // Nenhum "+ Novo …" com a tarefa arquivada nem para quem só lê (#376), em seção nenhuma.
  return <LembreteDoLapis edicao={noLugar}><CriarNoCartao pode={podeLigar}>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={t} />
    {/* A ordem da cabeça (#397): o topo (com a Situação e as etiquetas), o título, os dados e a descrição. */}
    <CabecaDoCartao
      topo={/* O topo da anotação (#382): o tipo e o código; a equipe, a etiqueta, o lápis e o ⋯ (Copiar para outra demanda, #312; Arquivar, Excluir) à direita. Quem
          tem o lápis muda a equipe também nas bolinhas (#356), com as regras de sair da tarefa do lápis (#276). */
      <TopoDoCartao modulo="tarefas" id={t.id} arquivado={!!t.arquivado_em} editando={editando}
        inicio={<Selo tipo="escuro">Tarefa</Selo>}
        /* O código e os selos juntos (#442): sem o selo do prazo, ao lado e no celular eles descem com a equipe para a linha de baixo,
           e ela nunca fica sozinha numa linha (veja .cartao-topo-abaixo-do-tipo em estilo.css). */
        esquerda={<span className="cartao-topo-abaixo-do-tipo">
          <span className="codigo">{t.codigo}</span>
          {t.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
          {t.diligencia && <Selo tipo="pend" dica={t.diligencia_motivo ?? undefined}>Diligência</Selo>}
        </span>}
        equipe={<EquipeNoTopo modulo="tarefas" id={t.id} equipe={{ responsavel_id: t.responsavel_id, lista: t.participantes }} grupos={t.grupos}
          funcoes={{ opcoes: funcoes, de: t.funcoes, trocar: trocarFuncao }} mudar={mudaNoLugar ? {
          saida: { podeSair: gravaForaDoCartao(ctx, t.criado_por === eu, continuaPelaDemanda(t, demandasDaTarefa(t))), peloLigado: continuaPelaDemanda(t, demandasDaTarefa(t)) },
          depois: depoisDeLigar, aoSair: veTudo ? depoisDeLigar : () => { aoMudar(); aoFechar(); }
        } : null} />}
        mudaEtiquetas={mudaNoLugar} aoMudarEtiquetas={aoMudar}
        aoArquivar={podeAlterar ? arquivar : undefined} aoExcluir={podeAlterar && podeExcluir ? excluir : undefined} extras={copiar}
        lapis={podeAlterar ? { rotulo: 'Editar', aoEditar: () => noLugar.abrirOLapis(() => setEditando(true)) } : undefined}
        situacao={<SituacaoDoCartao acao={<ConcluirNaSituacao acao={acaoDeConclusao(quadro.colunas, t.etapa_id)} soParaVer={!!t.arquivado_em || !podeAlterar}
          aoAgir={concluirOuReabrir} />}>
          <MenuDeSituacao rotulo="Situação da tarefa" quadro={quadro} valor={t.etapa_id} semSituacao={SEM_SITUACAO_TAREFA} desabilitado={!!t.arquivado_em || !podeAlterar} aoMudar={mudarSituacao} />
        </SituacaoDoCartao>} />}
      titulo={<TituloEditavel key={'titulo-' + noLugar.chave} valor={t.titulo} maximo={TAMANHO_TAREFA.titulo} aoMudarRascunho={noLugar.rascunhoDe('titulo')}
        conferir={titulo => erroNoLugar(validarTarefa, TAREFA_VAZIA, 'titulo', titulo)}
        aoSalvar={mudaNoLugar ? titulo => salvarNoLugar({ titulo }, { titulo: t.titulo }) : undefined} />}
      descricao={<TextoEditavel key={'descricao-' + noLugar.chave} texto={t.descricao || ''} className="descricao-formatada" rotulo="Descrição"
        convite="Sem descrição. Clique para escrever." maximo={TAMANHO_TAREFA.descricao} aoMudarRascunho={noLugar.rascunhoDe('descricao')}
        conferir={texto => erroNoLugar(validarTarefa, TAREFA_VAZIA, 'descricao', texto)}
        aoSalvar={mudaNoLugar ? texto => salvarNoLugar({ descricao: descricaoAoGravar(texto) }, { descricao: t.descricao }) : undefined} />}
      /* O prazo e o tempo (#442): o prazo na folhinha, que quem altera muda na janela das datas (#422, com o início lá dentro), como o
         lápis grava (com o histórico e o Desfazer); ao lado, o relógio de quem altera; embaixo, o total da equipe e os registros. */
      dados={<DadosDaTarefa t={t} podeAlterar={podeAlterar} prazo={
        <PrazoNaFolhinha nomeDoPrazo="Prazo" atalho="datas" valor={t} concluidaEm={t.concluida_em}
          conferirPrazo={c => errosDosCampos(validarTarefa, TAREFA_VAZIA, c, CAMPOS_DO_PRAZO)}
          aoSalvar={mudaNoLugar && !editando ? g => salvarNoLugar(g, datasDoPrazoComoEstao(t)) : undefined} />} />} />

    {editando ? <NovaTarefa edicao={{ id: t.id, aoTerminar: terminarEdicao }} /> : <>

    {soLeitura && <Nota>{soLeitura}</Nota>}
    {/* Quem pediu a tarefa (#313): não troca o responsável; ele a vê, lê e comenta e, com a aprovação, aprova a conclusão. */}
    {t.solicitante_id && <Nota>Pedida por <b>{nomeDe(t.solicitante_id)}</b>{t.precisa_aprovacao && ', que aprova a conclusão'}</Nota>}
    {!t.solicitante_id && t.precisa_aprovacao && <Nota>A conclusão precisa da aprovação de um administrador.</Nota>}
    {/* A tarefa que espera aprovação (#313): de quem é a aprovação e, para quem aprova, o Aprovar e o Devolver. */}
    <FaixaDaAprovacao t={t} colunas={quadro.colunas} nomeDe={nomeDe}
      aoMudar={() => { depoisDeLigar(); setVersaoComentarios(v => v + 1); }} />
    {/* O motivo da diligência (#313), logo abaixo da cabeça: é o que diz por que a tarefa existe. */}
    {t.diligencia && t.diligencia_motivo && <Nota><b>Motivo da diligência:</b> {t.diligencia_motivo}</Nota>}
    {/* A faixa explica e traz o Desarquivar à vista; o Excluir fica no ⋯ do topo. */}
    {t.arquivado_em && <FaixaDoArquivado modulo="tarefas" podeExcluir={podeExcluir} aoDesarquivar={podeAlterar ? arquivar : undefined} />}

    <ListasDoCartao modulo="tarefas" id={t.id} somenteLer={!podeAlterar} />

    {/* As demandas (#283): a tarefa pode fazer parte de várias; cada uma conta, e o "+" liga mais uma. */}
    <Recolhivel titulo="Demanda" icone="demandas" preferencia="tarefas.cartao.demanda" contador={demandas.length}
      ligar={ligaDemanda ? ligarDoModulo('demandas', demandas.length ? 'Ligar mais uma demanda' : undefined) : undefined}
      novo={ligaDemanda ? { para: novaDemanda, rotulo: 'Nova demanda desta tarefa' } : undefined}>
      {demandas.length ? <ItensLigados itens={demandas} /> : <Nota>Esta tarefa não faz parte de uma demanda.</Nota>}
      {podeLigar && !!modulos?.demandas && !ligaDemanda && <Nota>{DEMANDAS_DA_TAREFA_CHEIA}</Nota>}
      {ligaDemanda && <AcoesDosLigados>
        <LigarDoModulo modulo="demandas" rotulo={demandas.length ? 'Ligar mais uma demanda' : undefined}
          motivo={d => demandasLigadas.some(l => l.id === d.id) ? 'já ligada a esta tarefa' : ''}
          aviso="Quem está na demanda passa a ver esta tarefa. A tarefa leva o contrato da demanda e, se ainda não tem pessoas, os clientes dela."
          aoEscolher={d => ligarEAvisar(() => ligarTarefaNaDemanda(t.id, d.id),
            { feito: `Demanda ligada: ${d.titulo}.`, oQue: 'ligação da demanda', ja: 'Esta tarefa já estava nesta demanda.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>

    {/* O "+ Novo processo" (#376), como o ligar: só enquanto a tarefa não tem processo, nem um que a pessoa não pode abrir. */}
    {(comProcessos || t.processo_id) && <Recolhivel titulo="Processo" icone="processos" preferencia="tarefas.cartao.processo" contador={t.processo_id ? 1 : 0}
      ligar={podeLigar && comProcessos && !t.processo_id ? { rotulo: LIGAR_PROCESSO } : undefined}
      novo={podeLigar && comProcessos && !t.processo_id ? { para: novoProcesso, rotulo: 'Novo processo desta tarefa' } : undefined}>
      <ProcessosDoCartao carregar={processoDaTarefa} versao={versaoHist} somenteLer={!podeLigar || !comProcessos} maximo={1}
        vazio="Esta tarefa não está ligada a um processo."
        ligar={processoId => SD.tarefaAtualizar(t.id, { processo_id: processoId })} desligar={() => SD.tarefaAtualizar(t.id, { processo_id: null })}
        aoMudar={() => { void carregar(); setVersaoHist(v => v + 1); aoMudar(); }} />
    </Recolhivel>}

    <Recolhivel titulo="Pessoas" icone="pessoas" preferencia="tarefas.cartao.pessoas" contador={t.pessoas.length}
      ligar={ligarPessoaNoItem('tarefas', t.pessoas, podeLigar)} novo={novaPessoaNoItem('tarefas', t.id, t.pessoas, podeLigar)} atalho="ligacao">
      {t.pessoas.length ? <ItensLigados itens={t.pessoas.map(pessoa)} /> : <Nota>Nenhuma pessoa do cadastro ligada a esta tarefa.</Nota>}
      {podeLigar && <LigarPessoaNoItem modulo="tarefas" itemId={t.id} ligadas={t.pessoas} depois={depoisDeLigar} />}
    </Recolhivel>

    <Recolhivel titulo="Contrato" icone="contratos" preferencia="tarefas.cartao.contrato" contador={contratos.length}
      ligar={ligaContrato ? ligarDoModulo('contratos', contratos.length ? 'Ligar mais um contrato' : undefined) : undefined}>
      {contratos.length ? <ItensLigados itens={contratos} /> : <Nota>Esta tarefa não está ligada a um contrato.</Nota>}
      {podeLigar && !!modulos?.contratos && !ligaContrato && <Nota>{CONTRATOS_DA_TAREFA_CHEIA}</Nota>}
      {ligaContrato && <AcoesDosLigados>
        <LigarDoModulo modulo="contratos" rotulo={contratos.length ? 'Ligar mais um contrato' : undefined}
          motivo={k => contratosLigados.some(l => l.id === k.id) ? 'já ligado a esta tarefa' : ''}
          aviso="Quem está no contrato passa a ver, só para ler, esta tarefa."
          aoEscolher={k => ligarEAvisar(() => ligarContratoNaTarefa(t.id, k.id),
            { feito: `Contrato ligado: ${k.codigo}.`, oQue: 'ligação do contrato', ja: 'Esta tarefa já estava ligada a este contrato.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>

    {/* Os compromissos ligados à tarefa (#306), com o + Novo compromisso já ligado. */}
    <CompromissosDoItem modulo="tarefas" id={t.id} podeLigar={podeLigar} versao={versaoHist} />

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: comentários, anotações e
        histórico (#360). A escolha de deixar o histórico aberto tem chave nova (".coluna."): na coluna, ele começa recolhido. */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="tarefas" cartaoId={t.id} versao={versaoComentarios} motivoSemMencao={veTudo ? undefined : motivoSemMencaoNaTarefa(t, demandasAbertas)} />
      <AnotacoesDoCartao modulo="tarefas" id={t.id} somenteLer={!!t.arquivado_em || !podeAlterar} />
      <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="tarefas.coluna.historico" contador={historico}>
        <HistoricoDoCartao carregar={() => SD.tarefaHistorico(t.id)} campos={CAMPOS_TAREFA} valor={valorLegivelTarefa} versao={versaoHist} />
      </Recolhivel>
    </NaColunaDoCartao>

    <footer className="cartao-rodape">
      <span>Criada em {dataDaCriacao(t.criado_em)}{t.criado_por ? ' por ' + nomeDe(t.criado_por) : ''}</span>
      <span>Atualizada {relativo(t.atualizado_em)}</span>
    </footer>
    </>}
  </CriarNoCartao></LembreteDoLapis>;
}
