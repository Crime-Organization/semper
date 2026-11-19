// Cartão da tarefa (painel ao lado ou janela no centro), no modelo do cartão da demanda: no topo, o título e o prazo em
// destaque; as ações, com a equipe da tarefa em bolinhas ao lado (responsável e participantes), e a situação; depois, cada tópico numa seção que
// recolhe (demanda, pessoas, contrato, comentários, histórico). Logo depois da descrição, o tempo e as datas lado a lado (#361): o cronômetro
// (TempoNaTarefa), a criação, o início e o prazo com a hora e o lembrete, que quem altera muda ali mesmo; o lápis não os repete.
// A demanda e o contrato ligados aparecem sempre, mas só abrem para quem pode vê-los (os outros veem o código).
// Desde a #346, quem altera a tarefa muda o título e a descrição no próprio lugar, como na anotação; o lápis não os repete.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SD, type PessoaResumida, type Tarefa } from '../dados';
import { TAMANHO_TAREFA } from '../dados/limites';
import { useNavigate } from 'react-router';
import { colunaComMarco } from '../regras/quadro';
import { descricaoAoGravar, erroNoLugar } from '../regras/edicaoNoLugar';
import { CAMPOS_TAREFA, continuaPelaDemanda, motivoSemMencaoNaTarefa, SEM_SITUACAO_TAREFA, TAREFA_VAZIA, validarTarefa, valorLegivelTarefa, estaNaTarefa } from '../regras/tarefa';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { contratosEmQueEsta } from '../regras/contrato';
import { equipeVeTudo, motivoDeSoLerOCartao } from '../regras/equipeVeTudo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { Aviso, Carregando, DadoDoGrupo, DataEditavel, GrupoDeDatas, Nota, PrazoEditavel, Selo, TextoEditavel, TituloEditavel, Vazio } from '../ui/base';
import { CAMPOS_DO_PRAZO, errosDosCampos, prazoAoGravar, prazoComoEsta } from '../regras/datasNoCartao';
import { dataDaCriacao, erroDaDataDeInicio, ROTULO_DO_INICIO } from '../regras/dataDeInicio';
import { AvisoDaEdicaoNoLugar, gravarNoLugar, useEdicaoNoLugar } from '../ui/EdicaoNoLugar';
import { SecaoComentarios } from '../ui/Comentarios';
import { EquipeNoTopo } from './EquipeNoTopo';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useQuantos } from '../ui/useQuantos';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { Botao } from '../ui/Botoes';
import { useCtx } from '../ui/sessao';
import NovaTarefa from './NovaTarefa';
import { relativo } from '../ui/util';
import { oferecerConcluirDemanda } from './concluirDemanda';
import { SeloDoPrazo } from './Demandas';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ListasDoCartao } from './ListasDoCartao';
import { ProcessosDoCartao, type ProcessosLidos } from './ProcessosDoCartao';
import { TempoNaTarefa } from './TempoNaTarefa';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { DEMANDA_DE_OUTRO_CONTRATO, motivoDeContratoDiferente } from '../regras/ligarExistente';
import { AcoesDosLigados } from '../ui/ItensLigados';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { ligarEAvisar, ligarNoItem, ligarTarefaNaDemanda } from './ligarNoCartao';
import { LigarPessoaNoItem } from './PessoasNosItens';

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
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  // Concluir e Reabrir trocam de lugar: o foco do teclado passa para o botão novo, em vez de cair no começo da página.
  const acaoDaSituacao = useRef<HTMLDivElement>(null);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  // O título e a descrição em edição no próprio lugar (#346).
  const noLugar = useEdicaoNoLugar();

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
  const soLeitura = motivoDeSoLerOCartao(ctx, m => estaNaTarefa(t, m, t.demanda), m => contratosEmQueEsta([t.contrato, t.demanda?.contrato], m).length > 0);
  const podeAlterar = !soLeitura, veTudo = equipeVeTudo(ctx.escritorio);
  // Ligar à tarefa um item que já existe (#341): quem altera a tarefa, com ela ativa. A demanda e o contrato, só enquanto a tarefa
  // não tem (mais de um é a #283). Depois, o cartão lê tudo de novo.
  const podeLigar = podeAlterar && !t.arquivado_em, modulos = ctx.escritorio?.modulos;
  const depoisDeLigar = () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); };
  // A coluna das concluídas e a do início são as colunas-marco: valem mesmo que o escritório as renomeie.
  const concluida = colunaComMarco(quadro.colunas, t.etapa_id, 'concluido');
  const fim = quadro.colunas.find(c => c.marco === 'concluido'), inicio = quadro.colunas.find(c => c.marco === 'inicio');
  const pessoa = (p: PessoaResumida): ItemLigado => ({ id: 'pessoa-' + p.id, para: '/pessoas/?id=' + p.id, codigo: p.codigo, titulo: p.nome,
    selo: p.arquivado_em ? 'Arquivada' : undefined });
  // A demanda e o contrato abrem só para quem pode vê-los; os outros veem o código, sem o link.
  const demanda: ItemLigado | null = t.demanda
    ? { id: 'demanda', para: '/demandas/?id=' + t.demanda.id, codigo: t.demanda.codigo, titulo: t.demanda.titulo, detalhe: 'Demanda' }
    : t.demanda_codigo ? { id: 'demanda', codigo: t.demanda_codigo, titulo: 'Demanda ligada', detalhe: 'Você não tem acesso a esta demanda' } : null;
  const contrato: ItemLigado | null = t.contrato
    ? { id: 'contrato', para: '/contratos/?id=' + t.contrato.id, codigo: t.contrato.codigo, titulo: t.contrato.servico, detalhe: 'Contrato' }
    : t.contrato_codigo ? { id: 'contrato', para: veTudo && t.contrato_id ? '/contratos/?id=' + t.contrato_id : undefined, codigo: t.contrato_codigo, titulo: 'Contrato ligado', detalhe: veTudo ? 'Contrato, sem os valores' : 'Você não tem acesso a este contrato' } : null;

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
  /** Leva a tarefa para outra coluna; `aviso` troca o texto do aviso no pé da tela (ex.: "Tarefa concluída."). */
  async function mudarSituacao(valor: string, aviso?: string, focarAcao = false) {
    const etapa = valor || null, de = t!.etapa_id || null, ordemDe = t!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.tarefaMover(t!.id, etapa, ordem);
      setT({ ...t!, etapa_id: etapa, etapa_ordem: ordem });
      if (focarAcao) setTimeout(() => acaoDaSituacao.current?.querySelector('button')?.focus(), 0);
      feito(aviso ?? (etapa ? `Movida para "${quadro.nomeDe(etapa)}".` : `Tarefa ${SEM_SITUACAO_TAREFA.toLowerCase()}.`), 'mudança de situação',
        async () => { await SD.tarefaMover(t!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
      // Relê a tarefa: chegar ou sair da coluna das concluídas muda a data de conclusão (e o resumo do tempo).
      await carregar();
      if (t!.demanda) await oferecerConcluirDemanda(t!.id, etapa, navegar);
    } catch (e) { falha(e); }
  }

  /** O título e a descrição mudam no próprio lugar só por quem altera, e só com a tarefa ativa (como o lápis). */
  const mudaNoLugar = podeAlterar && !t.arquivado_em;
  /** Grava o título ou a descrição mudados no próprio lugar (#346), como o lápis: o mesmo aviso, com Desfazer. */
  const salvarNoLugar = (novo: Partial<Pick<Tarefa, 'titulo' | 'descricao' | 'data_inicio' | 'prazo' | 'prazo_hora' | 'lembrete'>>, antes: typeof novo) => gravarNoLugar({
    novo, antes, gravar: d => SD.tarefaAtualizar(t!.id, d), aviso: 'Tarefa atualizada.', oQue: 'atualização da tarefa',
    mudanca: { tipo: 'tarefaAtualizada', id: t!.id }, mostrar: d => setT(atual => atual && { ...atual, ...d }),
    depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }
  });

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  return <>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={t} />
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Tarefa</Selo><span className="codigo">{t.codigo}</span>
        <SeloDoPrazo prazo={t.prazo} hora={t.prazo_hora} concluido={quadro.pronto ? concluida && 'tarefas' : null} />
        {t.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {podeAlterar && <AcoesDoCartao editando={editando} arquivado={!!t.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'a tarefa', aoConfirmar: excluir } : undefined} />}
      </div>
      <TituloEditavel key={'titulo-' + noLugar.chave} valor={t.titulo} maximo={TAMANHO_TAREFA.titulo} aoMudarRascunho={noLugar.rascunhoDe('titulo')}
        conferir={titulo => erroNoLugar(validarTarefa, TAREFA_VAZIA, 'titulo', titulo)}
        aoSalvar={mudaNoLugar ? titulo => salvarNoLugar({ titulo }, { titulo: t.titulo }) : undefined} />
      <TextoEditavel key={'descricao-' + noLugar.chave} texto={t.descricao || ''} className="descricao-formatada" rotulo="Descrição" mudar="Mudar a descrição"
        convite="Sem descrição. Clique para escrever." maximo={TAMANHO_TAREFA.descricao} aoMudarRascunho={noLugar.rascunhoDe('descricao')}
        conferir={texto => erroNoLugar(validarTarefa, TAREFA_VAZIA, 'descricao', texto)}
        aoSalvar={mudaNoLugar ? texto => salvarNoLugar({ descricao: descricaoAoGravar(texto) }, { descricao: t.descricao }) : undefined} />
      {/* As datas e o tempo lado a lado (#361): a criação (fixa), o início (#357) e o prazo com a hora e o lembrete, que quem altera
          muda no próprio lugar, como o lápis grava (com o histórico e o Desfazer); e o cronômetro de quem altera, com o esforço da
          equipe na linha de baixo. */}
      <GrupoDeDatas rotulo="Tempo e datas">
        <DadoDoGrupo rotulo="Criada em"><b className="num">{dataDaCriacao(t.criado_em)}</b></DadoDoGrupo>
        <DadoDoGrupo rotulo="Início">
          <DataEditavel key={'inicio-' + noLugar.chave} nome={ROTULO_DO_INICIO} valor={t.data_inicio} conferir={erroDaDataDeInicio}
            aoSalvar={mudaNoLugar && !editando ? data_inicio => salvarNoLugar({ data_inicio }, { data_inicio: t.data_inicio }) : undefined} />
        </DadoDoGrupo>
        <DadoDoGrupo rotulo="Prazo">
          <PrazoEditavel key={'prazo-' + noLugar.chave} nome="Prazo" valor={t} conferir={c => errosDosCampos(validarTarefa, TAREFA_VAZIA, c, CAMPOS_DO_PRAZO)}
            aoMudarRascunho={noLugar.rascunhoDe('prazo')}
            aoSalvar={mudaNoLugar && !editando ? c => salvarNoLugar(prazoAoGravar(c), prazoComoEsta(t)) : undefined} />
        </DadoDoGrupo>
        {podeAlterar && <TempoNaTarefa t={t} />}
      </GrupoDeDatas>
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <div className="situacao-com-acao" ref={acaoDaSituacao}>
          <MenuDeSituacao rotulo="Situação da tarefa" quadro={quadro} valor={t.etapa_id} semSituacao={SEM_SITUACAO_TAREFA} desabilitado={!!t.arquivado_em || !podeAlterar} aoMudar={mudarSituacao} />
          {/* Concluir leva à coluna das concluídas (a do marco, qualquer que seja o nome); Reabrir, de volta à do início. */}
          {podeAlterar && !t.arquivado_em && (concluida
            ? inicio && <Botao key="reabrir" forma="botao" ocupadoTexto="Reabrindo…" onClick={() => mudarSituacao(inicio.id, `Tarefa reaberta em "${inicio.nome}".`, true)}><Icone nome="voltar" tam={16} />Reabrir</Botao>
            : fim && <Botao key="concluir" forma="botao" ocupadoTexto="Concluindo…" onClick={() => mudarSituacao(fim.id, 'Tarefa concluída.', true)}><Icone nome="check" tam={16} />Concluir</Botao>)}
        </div>
      </section>}
    </header>

    {editando ? <NovaTarefa edicao={{ id: t.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      {/* Quem tem o lápis muda a equipe também nas bolinhas (#356), com as regras de sair da tarefa do lápis (#276). */}
      <EquipeNoTopo modulo="tarefas" id={t.id} equipe={{ responsavel_id: t.responsavel_id, lista: t.participantes }} mudar={mudaNoLugar ? {
        saida: { podeSair: gravaForaDoCartao(ctx, t.criado_por === eu, continuaPelaDemanda(t, t.demanda_id)), peloLigado: continuaPelaDemanda(t, t.demanda_id) },
        depois: depoisDeLigar, aoSair: veTudo ? depoisDeLigar : () => { aoMudar(); aoFechar(); }
      } : null} />
    </div>
    {soLeitura && <Nota>{soLeitura}</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {t.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Tarefa arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Tarefa arquivada. Só quem cadastrou esta tarefa ou um administrador pode excluí-la.'}</span>
    </div>}


    <SecaoEtiquetas modulo="tarefas" id={t.id} somenteLer={!!t.arquivado_em || !podeAlterar} aoMudar={aoMudar} />

    <ListasDoCartao modulo="tarefas" id={t.id} somenteLer={!podeAlterar} />

    <Recolhivel titulo="Demanda" icone="demandas" preferencia="tarefas.cartao.demanda" contador={demanda ? 1 : 0}>
      {demanda ? <ItensLigados itens={[demanda]} /> : <Nota>Esta tarefa não faz parte de uma demanda.</Nota>}
      {podeLigar && !t.demanda_id && modulos?.demandas && <AcoesDosLigados>
        <LigarDoModulo modulo="demandas" motivo={d => motivoDeContratoDiferente(t.contrato_id, d.contrato_id)}
          aviso="Quem está na demanda passa a ver esta tarefa. Sem pessoas ou sem contrato, a tarefa leva os clientes e o contrato da demanda."
          aoEscolher={d => ligarEAvisar(() => ligarTarefaNaDemanda(t.id, d.id),
            { feito: `Demanda ligada: ${d.titulo}.`, oQue: 'ligação da demanda', ja: 'Esta tarefa já estava nesta demanda.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>

    {(comProcessos || t.processo_id) && <Recolhivel titulo="Processo" icone="processos" preferencia="tarefas.cartao.processo" contador={t.processo_id ? 1 : 0}>
      <ProcessosDoCartao carregar={processoDaTarefa} versao={versaoHist} somenteLer={!!t.arquivado_em || !podeAlterar || !comProcessos} maximo={1}
        vazio="Esta tarefa não está ligada a um processo."
        ligar={processoId => SD.tarefaAtualizar(t.id, { processo_id: processoId })} desligar={() => SD.tarefaAtualizar(t.id, { processo_id: null })}
        aoMudar={() => { void carregar(); setVersaoHist(v => v + 1); aoMudar(); }} />
    </Recolhivel>}

    <Recolhivel titulo="Pessoas" icone="pessoas" preferencia="tarefas.cartao.pessoas" contador={t.pessoas.length}>
      {t.pessoas.length ? <ItensLigados itens={t.pessoas.map(pessoa)} /> : <Nota>Nenhuma pessoa do cadastro ligada a esta tarefa.</Nota>}
      {podeLigar && <LigarPessoaNoItem modulo="tarefas" itemId={t.id} ligadas={t.pessoas} depois={depoisDeLigar} />}
    </Recolhivel>

    <Recolhivel titulo="Contrato" icone="contratos" preferencia="tarefas.cartao.contrato" contador={contrato ? 1 : 0}>
      {contrato ? <ItensLigados itens={[contrato]} /> : <Nota>Esta tarefa não está ligada a um contrato.</Nota>}
      {podeLigar && !t.contrato_id && modulos?.contratos && <AcoesDosLigados>
        <LigarDoModulo modulo="contratos" motivo={k => motivoDeContratoDiferente(t.demanda?.contrato_id, k.id, DEMANDA_DE_OUTRO_CONTRATO)}
          aviso="Quem está no contrato passa a ver, só para ler, esta tarefa."
          aoEscolher={k => ligarEAvisar(() => ligarNoItem('contrato da tarefa', t.id, k.id),
            { feito: `Contrato ligado: ${k.codigo}.`, oQue: 'ligação do contrato', ja: 'Esta tarefa já estava ligada a este contrato.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: comentários, anotações e
        histórico (#360). A escolha de deixar o histórico aberto tem chave nova (".coluna."): na coluna, ele começa recolhido. */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="tarefas" cartaoId={t.id} motivoSemMencao={veTudo ? undefined : motivoSemMencaoNaTarefa(t, t.demanda)} />
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
  </>;
}
