// Cartão da demanda (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de contrato: no topo, o
// título e o prazo em destaque; as ações, com a equipe da demanda em bolinhas ao lado (responsável e colaboradores), e
// a situação; depois, cada
// tópico numa seção que recolhe (listas, tarefas, clientes, contrato, comentários, histórico).
// O contrato ligado aparece sempre, mas só abre para quem pode ver o contrato (contrato é controle financeiro).
// Desde a #346, quem altera a demanda muda o título e a descrição no próprio lugar, como na anotação; o lápis não os repete.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type Demanda, type PessoaResumida } from '../dados';
import { TAMANHO_DEMANDA } from '../dados/limites';
import { CAMPOS_DEMANDA, DEMANDA_VAZIA, motivoSemMencaoNaDemanda, SEM_SITUACAO_DEMANDA, validarDemanda, valorLegivelDemanda, estaNaDemanda } from '../regras/demanda';
import { descricaoAoGravar, erroNoLugar } from '../regras/edicaoNoLugar';
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
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { Icone } from '../ui/Icone';
import { CriarNoCartao, ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useQuantos } from '../ui/useQuantos';
import { colunaComMarco } from '../regras/quadro';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { meusGrupos } from '../regras/gruposDaEquipe';
import { useCtx } from '../ui/sessao';
import NovaDemanda from './NovaDemanda';
import { relativo } from '../ui/util';
import { SeloDoPrazo } from './Demandas';
import { oferecerProcesso } from './concluirDemanda';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { novoProcessoDaDemanda, ProcessosDaDemanda } from './ProcessosDaDemanda';
import { TarefasDaDemanda } from './TarefasDaDemanda';
import { TempoDaDemanda } from './TempoNaTarefa';
import { ListasDoCartao } from './ListasDoCartao';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { motivoDeContratoDiferente } from '../regras/ligarExistente';
import { AcoesDosLigados } from '../ui/ItensLigados';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { ligarEAvisar, ligarNoItem, ligarTarefaNaDemanda } from './ligarNoCartao';
import { LigarPessoaNoItem, novaPessoaNoItem } from './PessoasNosItens';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoDemanda({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const navegar = useNavigate();
  const eu = ctx.perfil.id;
  const [d, setD] = useState<Demanda | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  // O título e a descrição em edição no próprio lugar (#346).
  const noLugar = useEdicaoNoLugar();

  const carregar = useCallback(() => SD.demandaObter(id).then(x => { setD(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Quantas tarefas e processos a demanda tem: o número aparece no título da seção, mesmo recolhida, para saber que há algo dentro.
  const [ligados, setLigados] = useState<{ tarefas?: number; processos?: number }>({});
  const comTarefas = !!ctx.escritorio?.modulos?.tarefas, comProcessos = !!ctx.escritorio?.modulos?.processos;
  useEffect(() => {
    let vivo = true;
    if (comTarefas) SD.tarefasDaDemanda(id).then(x => { if (vivo) setLigados(l => ({ ...l, tarefas: x.length })); }).catch(() => {});
    if (comProcessos) SD.processosDaDemanda(id).then(x => { if (vivo) setLigados(l => ({ ...l, processos: x.visiveis.length + x.ocultos })); }).catch(() => {});
    return () => { vivo = false; };
  }, [id, versaoHist, comTarefas, comProcessos]);
  // Depois de desfazer: mostra a demanda como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  // Quantas alterações o histórico tem, para o número ao lado do título.
  const historico = useQuantos(() => SD.demandaHistorico(id), `${id}:${versaoHist}`);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (d === undefined) return <Carregando />;
  if (!d) return <Vazio>Esta demanda não foi encontrada. Ela pode ter sido excluída, ou você não participa dela.</Vazio>;

  const podeExcluir = !!d.arquivado_em && (d.criado_por === eu || ctx.ehAdmin);
  const soLeitura = motivoDeSoLerOCartao(ctx, m => estaNaDemanda(d, m, meusGrupos(ctx.grupos, m.id)), m => contratosEmQueEsta([d.contrato], m).length > 0);
  const podeAlterar = !soLeitura, veTudo = equipeVeTudo(ctx.escritorio);
  // Ligar à demanda um item que já existe (#341): quem altera a demanda, com ela ativa. Depois, o cartão lê tudo de novo.
  const podeLigar = podeAlterar && !d.arquivado_em;
  const depoisDeLigar = () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); };
  // O contrato, ligado (o que existe) ou criado já ligado (#376): um só, e só enquanto a demanda não tem.
  const ligaContrato = podeLigar && !d.contrato_id && !!ctx.escritorio?.modulos?.contratos, novoContrato = '/contratos/novo/?demanda=' + d.id;
  const cliente = (p: PessoaResumida): ItemLigado => ({ id: 'cliente-' + p.id, para: '/pessoas/?id=' + p.id, codigo: p.codigo, titulo: p.nome,
    detalhe: 'Cliente', selo: p.arquivado_em ? 'Arquivada' : undefined });
  // O contrato abre só para quem pode vê-lo; os outros veem o número, sem o link.
  const contrato: ItemLigado | null = d.contrato
    ? { id: 'contrato', para: '/contratos/?id=' + d.contrato.id, codigo: d.contrato.codigo, titulo: d.contrato.servico, detalhe: 'Contrato' }
    : d.contrato_codigo ? { id: 'contrato', para: veTudo && d.contrato_id ? '/contratos/?id=' + d.contrato_id : undefined, codigo: d.contrato_codigo, titulo: 'Contrato ligado', detalhe: veTudo ? 'Contrato, sem os valores' : 'Você não tem acesso a este contrato' } : null;

  async function arquivar() {
    const estava = !!d!.arquivado_em;
    try {
      await SD.demandasArquivar([d!.id], !estava);
      feito(estava ? 'Demanda desarquivada.' : 'Demanda arquivada. Arquivadas podem ser excluídas depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.demandasArquivar([d!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.demandasExcluir([d!.id]);
    if (r.excluidas) { avisar('Demanda excluída definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = d!.etapa_id || null, ordemDe = d!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.demandaMover(d!.id, etapa, ordem);
      setD({ ...d!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movida para "${quadro.nomeDe(etapa)}".` : `Demanda ${SEM_SITUACAO_DEMANDA.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.demandaMover(d!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
      void oferecerProcesso(d!, etapa, navegar);
    } catch (e) { falha(e); }
  }

  /** O título e a descrição mudam no próprio lugar só por quem altera, e só com a demanda ativa (como o lápis). */
  const mudaNoLugar = podeAlterar && !d.arquivado_em;
  /** Grava o título ou a descrição mudados no próprio lugar (#346), como o lápis: o mesmo aviso, com Desfazer. */
  const salvarNoLugar = (novo: Partial<Pick<Demanda, 'titulo' | 'descricao' | 'data_inicio' | 'prazo' | 'prazo_hora' | 'lembrete'>>, antes: typeof novo) => gravarNoLugar({
    novo, antes, gravar: x => SD.demandaAtualizar(d!.id, x), aviso: 'Demanda atualizada.', oQue: 'atualização da demanda',
    mudanca: { tipo: 'demandaAtualizada', id: d!.id }, mostrar: x => setD(atual => atual && { ...atual, ...x }),
    depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }
  });

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  // Para quem só lê a demanda, ou com ela arquivada, nenhuma seção mostra o "+ Novo …" (#376).
  return <CriarNoCartao pode={podeLigar}>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={d} />
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Demanda</Selo><span className="codigo">{d.codigo}</span>
        <SeloDoPrazo prazo={d.prazo} hora={d.prazo_hora} concluido={quadro.pronto ? colunaComMarco(quadro.colunas, d.etapa_id, 'concluido') && 'demandas' : null} />
        {d.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {podeAlterar && <AcoesDoCartao editando={editando} arquivado={!!d.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'a demanda', aoConfirmar: excluir } : undefined} />}
      </div>
      <TituloEditavel key={'titulo-' + noLugar.chave} valor={d.titulo} maximo={TAMANHO_DEMANDA.titulo} aoMudarRascunho={noLugar.rascunhoDe('titulo')}
        conferir={titulo => erroNoLugar(validarDemanda, DEMANDA_VAZIA, 'titulo', titulo)}
        aoSalvar={mudaNoLugar ? titulo => salvarNoLugar({ titulo }, { titulo: d.titulo }) : undefined} />
      <TextoEditavel key={'descricao-' + noLugar.chave} texto={d.descricao || ''} className="descricao-formatada" rotulo="Descrição" mudar="Mudar a descrição"
        convite="Sem descrição. Clique para escrever." maximo={TAMANHO_DEMANDA.descricao} aoMudarRascunho={noLugar.rascunhoDe('descricao')}
        conferir={texto => erroNoLugar(validarDemanda, DEMANDA_VAZIA, 'descricao', texto)}
        aoSalvar={mudaNoLugar ? texto => salvarNoLugar({ descricao: descricaoAoGravar(texto) }, { descricao: d.descricao }) : undefined} />
      {/* As datas lado a lado (#361): a criação (fixa), o início (#357) e o prazo de entrega com a hora e o lembrete, que quem altera
          muda no próprio lugar, como o lápis grava (com o histórico e o Desfazer). */}
      <GrupoDeDatas rotulo="Datas">
        <DadoDoGrupo rotulo="Criada em"><b className="num">{dataDaCriacao(d.criado_em)}</b></DadoDoGrupo>
        <DadoDoGrupo rotulo="Início">
          <DataEditavel key={'inicio-' + noLugar.chave} nome={ROTULO_DO_INICIO} valor={d.data_inicio} conferir={erroDaDataDeInicio}
            aoSalvar={mudaNoLugar && !editando ? data_inicio => salvarNoLugar({ data_inicio }, { data_inicio: d.data_inicio }) : undefined} />
        </DadoDoGrupo>
        <DadoDoGrupo rotulo="Prazo de entrega">
          <PrazoEditavel key={'prazo-' + noLugar.chave} nome="Prazo de entrega" valor={d} conferir={c => errosDosCampos(validarDemanda, DEMANDA_VAZIA, c, CAMPOS_DO_PRAZO)}
            aoMudarRascunho={noLugar.rascunhoDe('prazo')}
            aoSalvar={mudaNoLugar && !editando ? c => salvarNoLugar(prazoAoGravar(c), prazoComoEsta(d)) : undefined} />
        </DadoDoGrupo>
      </GrupoDeDatas>
      {/* Logo abaixo das datas, na faixa própria do tempo (#383): a soma do tempo de toda a equipe nas tarefas desta demanda. */}
      {ctx.escritorio?.modulos?.tarefas && <TempoDaDemanda demandaId={d.id} versao={versaoHist} />}
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <MenuDeSituacao rotulo="Situação da demanda" quadro={quadro} valor={d.etapa_id} semSituacao={SEM_SITUACAO_DEMANDA} desabilitado={!!d.arquivado_em || !podeAlterar} aoMudar={mudarSituacao} />
      </section>}
    </header>

    {editando ? <NovaDemanda edicao={{ id: d.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      {/* Quem tem o lápis muda a equipe também nas bolinhas (#356), com as regras de sair da demanda do lápis (#276). */}
      <EquipeNoTopo modulo="demandas" id={d.id} equipe={{ responsavel_id: d.responsavel_id, lista: d.colaboradores }} grupos={d.grupos} mudar={mudaNoLugar ? {
        saida: { podeSair: gravaForaDoCartao(ctx, d.criado_por === eu) }, depois: depoisDeLigar, aoSair: veTudo ? depoisDeLigar : () => { aoMudar(); aoFechar(); }
      } : null} />
    </div>
    {soLeitura && <Nota>{soLeitura}</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {d.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Demanda arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Demanda arquivada. Só quem cadastrou esta demanda ou um administrador pode excluí-la.'}</span>
    </div>}


    <SecaoEtiquetas modulo="demandas" id={d.id} somenteLer={!!d.arquivado_em || !podeAlterar} aoMudar={aoMudar} />

    <ListasDoCartao modulo="demandas" id={d.id} somenteLer={!podeAlterar} />

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="demandas.cartao.tarefas" contador={ligados.tarefas}
      novo={podeAlterar && !d.arquivado_em ? { para: '/tarefas/nova/?demanda=' + d.id, rotulo: 'Nova tarefa desta demanda' } : undefined}>
      <TarefasDaDemanda demandaId={d.id} versao={versaoHist} somenteLer={!podeAlterar} aoMudar={() => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }} />
      {podeLigar && <AcoesDosLigados novo={{ para: '/tarefas/nova/?demanda=' + d.id, rotulo: 'Nova tarefa' }}>
        <LigarDoModulo modulo="tarefas" filtro={{ sem: 'demandas' }} motivo={t => motivoDeContratoDiferente(t.contrato_id, d.contrato_id)}
          aviso="Quem está nesta demanda passa a ver a tarefa que você ligar. Sem pessoas ou sem contrato, a tarefa leva os clientes e o contrato da demanda."
          aoEscolher={t => ligarEAvisar(() => ligarTarefaNaDemanda(t.id, d.id),
            { feito: `Tarefa ligada: ${t.titulo}.`, oQue: 'ligação da tarefa', ja: 'Esta tarefa já estava nesta demanda.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {ctx.escritorio?.modulos?.processos && <Recolhivel titulo="Processos" icone="processos" preferencia="demandas.cartao.processos" contador={ligados.processos}
      novo={novoProcessoDaDemanda(d.id, 'Novo processo desta demanda')}>
      <ProcessosDaDemanda demandaId={d.id} somenteLer={!!d.arquivado_em || !podeAlterar} versao={versaoHist} aoMudar={() => setVersaoHist(v => v + 1)} />
    </Recolhivel>}

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="demandas.cartao.clientes" contador={d.clientes.length} novo={novaPessoaNoItem('demandas', d.id, d.clientes, podeLigar).titulo}>
      {d.clientes.length ? <ItensLigados itens={d.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a esta demanda.</Nota>}
      {podeLigar && <LigarPessoaNoItem modulo="demandas" itemId={d.id} ligadas={d.clientes} depois={depoisDeLigar} novo={novaPessoaNoItem('demandas', d.id, d.clientes, podeLigar).embaixo}
        aviso={d.contrato_id ? 'Esta demanda é de um contrato: confira se a pessoa também é parte dele.' : undefined} />}
    </Recolhivel>

    <Recolhivel titulo="Contrato" icone="contratos" preferencia="demandas.cartao.contrato" contador={contrato ? 1 : 0}
      novo={ligaContrato ? { para: novoContrato, rotulo: 'Novo contrato desta demanda' } : undefined}>
      {contrato ? <ItensLigados itens={[contrato]} /> : <Nota>Esta demanda não vem de um contrato.</Nota>}
      {d.objeto && d.objeto !== d.titulo && <Nota>Nasceu do objeto do contrato: <b>{d.objeto}</b>.</Nota>}
      {/* Um contrato só: com ele, trocar é pelo lápis (a demanda pode ter nascido de um objeto dele). */}
      {ligaContrato && <AcoesDosLigados novo={{ para: novoContrato, rotulo: 'Novo contrato' }}>
        <LigarDoModulo modulo="contratos" aviso="Quem está no contrato passa a ver, só para ler, esta demanda e as tarefas dela."
          aoEscolher={k => ligarEAvisar(() => ligarNoItem('contrato da demanda', d.id, k.id),
            { feito: `Contrato ligado: ${k.codigo}.`, oQue: 'ligação do contrato', ja: 'Esta demanda já estava ligada a este contrato.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: comentários, anotações e
        histórico (#360). A escolha de deixar o histórico aberto tem chave nova (".coluna."): na coluna, ele começa recolhido. */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="demandas" cartaoId={d.id} motivoSemMencao={veTudo ? undefined : motivoSemMencaoNaDemanda(d)} />
      <AnotacoesDoCartao modulo="demandas" id={d.id} somenteLer={!!d.arquivado_em || !podeAlterar} />
      <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="demandas.coluna.historico" contador={historico}>
        <HistoricoDoCartao carregar={() => SD.demandaHistorico(d.id)} campos={CAMPOS_DEMANDA} valor={valorLegivelDemanda} versao={versaoHist} />
      </Recolhivel>
    </NaColunaDoCartao>

    <footer className="cartao-rodape">
      <span>Criada em {dataDaCriacao(d.criado_em)}{d.criado_por ? ' por ' + nomeDe(d.criado_por) : ''}</span>
      <span>Atualizada {relativo(d.atualizado_em)}</span>
    </footer>
    </>}
  </CriarNoCartao>;
}
