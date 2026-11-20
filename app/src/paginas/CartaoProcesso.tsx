// Cartão do processo (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de demanda: no topo (TopoDoCartao,
// #382, como o da anotação), o tipo e o código, com a equipe em bolinhas (responsável e colaboradores), a etiqueta, o lápis e o ⋯
// à direita; os selos das etiquetas; o nome, o número e a situação. "Entrar como colaborador" e "Assumir como responsável" ficam
// logo abaixo, junto da nota de quem só lê (no ⋯, ninguém os acharia), e o aviso diz que a equipe está no topo. Depois, cada tópico
// numa seção que recolhe (prazos, dados, clientes, demandas, contratos, tarefas, compromissos). Na coluna da direita (no centro) ou
// no pé do cartão (ao lado), desde a #362: comentários, andamentos (a linha do tempo), anotações e histórico de alterações.
// Desde a #346, quem altera o processo muda o nome do cartão no próprio lugar, como na anotação (o lápis não o repete). Sem
// nome, o título mostra os clientes (ou o número); o campo abre em branco, e apagar o nome volta a mostrá-los. O número
// abaixo do título não vira campo: muda pelo lápis, com a conferência do CNJ.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { SD, type ComoEntrarNoProcesso, type CampoDeProcesso, type PessoaResumida, type Processo } from '../dados';
import { TAMANHO_PROCESSO } from '../dados/limites';
import { erroNoLugar, tituloOpcionalAoGravar } from '../regras/edicaoNoLugar';
import { linhasDosCampos, nomesNoHistorico, valorNoHistorico } from '../regras/camposDeProcesso';
import { CAMPOS_NO_HISTORICO } from '../regras/andamentos';
import { advogadoNaAdaptacao, equipeEditaTudo, equipeVeTudo, SO_LEITURA_DO_PROCESSO, SEM_COMPROMISSO_VISIVEL, SO_LEITURA_DO_PROCESSO_ADVOGADO, soLeOCartao } from '../regras/equipeVeTudo';
import {
  alteraOProcesso, CAMPOS_PROCESSO, linhasDoProcesso, motivoSemMencaoNoProcesso, nomeDoProcesso, processoVazio, SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO, validarProcesso, valorLegivelProcesso
} from '../regras/processo';
import { SecaoComentarios } from '../ui/Comentarios';
import { AvisoDaEdicaoNoLugar, gravarNoLugar, useEdicaoNoLugar } from '../ui/EdicaoNoLugar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, FaixaDasDatas, Nota, Selo, TituloEditavel, Vazio } from '../ui/base';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { EquipeNoTopo } from './EquipeNoTopo';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { FaixaDoArquivado, TopoDoCartao } from '../ui/TopoDoCartao';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useLista, useQuantos } from '../ui/useQuantos';
import { ContratosDoProcesso } from './ContratosDoProcesso';
import { quantosPreenchidos } from '../regras/secoes';
import { meusGrupos } from '../regras/gruposDaEquipe';
import { useCtx } from '../ui/sessao';
import { dataCurta, relativo } from '../ui/util';
import { CartoesLigados } from './CartoesLigados';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { CompromissosLigados } from './CompromissosLigados';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import NovoProcesso from './NovoProcesso';
import { AndamentosDoProcesso, PrazosDoProcesso, useAcompanhamento } from './processo/AndamentosEPrazos';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { AcoesDosLigados, CriarNoCartao } from '../ui/ItensLigados';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { ligarContratoNoProcesso, ligarDemandaNoProcesso, ligarEAvisar, ligarNoItem } from './ligarNoCartao';
import { LigarPessoaNoItem, novaPessoaNoItem } from './PessoasNosItens';
import { nomeDoCompromisso } from '../regras/compromisso';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

/** O que a tela confirma depois de a pessoa entrar no processo. */
const ENTRADA_NO_PROCESSO: Record<ComoEntrarNoProcesso, string> = {
  colaborador: 'Você entrou neste processo como colaborador (a equipe fica no topo do cartão).',
  responsavel: 'Você agora é o responsável por este processo (a equipe fica no topo do cartão). Quem era responsável continua como colaborador.'
};

export function CartaoProcesso({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [p, setP] = useState<Processo | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  const [campos, setCampos] = useState<CampoDeProcesso[]>([]);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  // O nome do cartão em edição no próprio lugar (#346).
  const noLugar = useEdicaoNoLugar();

  const carregar = useCallback(() => SD.processoObter(id).then(x => { setP(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  const lerCampos = useCallback(() => SD.processoCampos().then(setCampos).catch(falha), []);
  useEffect(() => { void lerCampos(); }, [lerCampos]);
  // Depois de desfazer: mostra o processo como ficou.
  useMudancas(() => { void carregar(); void lerCampos(); setVersaoHist(v => v + 1); });
  // Os prazos (no corpo) e os andamentos (na coluna) leem juntos; cada mudança neles relê o histórico.
  const acompanhamento = useAcompanhamento(id, () => setVersaoHist(v => v + 1));

  // O que cada seção tem, para o número ao lado do título.
  const modulos = ctx.escritorio?.modulos;
  const chave = `${id}:${versaoHist}`;
  const quantos = {
    demandas: useQuantos(() => SD.demandasDoProcesso(id), chave, !!modulos?.demandas),
    tarefas: useQuantos(() => SD.tarefasDoProcesso(id), chave, !!modulos?.tarefas),
    compromissos: useQuantos(() => SD.compromissosDoProcesso(id), chave, !!modulos?.compromissos),
    contratos: useLista(() => SD.contratosDoProcesso(id).then(x => [x]), chave, !!modulos?.contratos)?.[0],
    historico: useQuantos(() => SD.processoHistorico(id), chave)
  };

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (p === undefined) return <Carregando />;
  if (!p) return <Vazio>Este processo não foi encontrado. Ele pode ter sido excluído, ou você não participa dele.</Vazio>;

  const podeExcluir = !!p.arquivado_em && (p.criado_por === eu || ctx.ehAdmin);
  const meus = meusGrupos(ctx.grupos, ctx.perfil.id), podeAlterar = !soLeOCartao(ctx, m => alteraOProcesso(p, m, meus));
  const advogado = advogadoNaAdaptacao(ctx), podeEntrar = advogado && !alteraOProcesso(p, ctx.perfil, meus) && !p.arquivado_em;
  // Ligar ao processo um item que já existe (#341): só quem altera o processo, com ele ativo. Depois, o cartão lê tudo de novo.
  const podeLigar = podeAlterar && !p.arquivado_em;
  // Criar um compromisso já ligado (#273, #376): quem altera o processo e, na fase de adaptação, o advogado (ele marca audiência
  // em qualquer processo). Nunca com o processo arquivado. O "+" do título e o "+ Novo compromisso" de baixo seguem esta regra.
  const podeCriarCompromisso = !p.arquivado_em && (podeAlterar || advogado);
  const novoCompromisso = '/agenda/novo/?processo=' + p.id;
  // A demanda e o contrato criados já ligados a este processo (#376), com as mesmas condições de ligar os que existem.
  const novaDemanda = '/demandas/nova/?processo=' + p.id, novoContrato = '/contratos/novo/?processo=' + p.id;
  const depoisDeLigar = () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); };
  // O cadastro da tarefa que nasce ligada a este processo (#376).
  const novaTarefa = '/tarefas/nova/?processo=' + p.id;
  async function entrar(como: ComoEntrarNoProcesso) {
    try {
      await SD.processoMeIncluir(p!.id, como);
      avisar(ENTRADA_NO_PROCESSO[como]);
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  const cliente = (c: PessoaResumida): ItemLigado => ({ id: 'cliente-' + c.id, para: '/pessoas/?id=' + c.id, codigo: c.codigo, titulo: c.nome,
    detalhe: 'Cliente', selo: c.arquivado_em ? 'Arquivada' : undefined });

  async function arquivar() {
    const estava = !!p!.arquivado_em;
    try {
      await SD.processosArquivar([p!.id], !estava);
      feito(estava ? 'Processo desarquivado.' : 'Processo arquivado. Arquivados podem ser excluídos depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.processosArquivar([p!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.processosExcluir([p!.id]);
    if (r.excluidas) { avisar('Processo excluído definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = p!.etapa_id || null, ordemDe = p!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.processoMover(p!.id, etapa, ordem);
      setP({ ...p!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movido para "${quadro.nomeDe(etapa)}".` : `Processo ${SEM_SITUACAO_PROCESSO.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.processoMover(p!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  /** O nome do cartão muda no próprio lugar só por quem altera o processo, e só com ele ativo (como o lápis). */
  const mudaNoLugar = podeAlterar && !p.arquivado_em;
  /** Grava o nome mudado no próprio lugar (#346), como o lápis: o mesmo aviso, com Desfazer. Em branco, o nome sai. */
  const salvarNome = (nome: string) => gravarNoLugar<Pick<Processo, 'titulo'>>({
    novo: { titulo: tituloOpcionalAoGravar(nome) }, antes: { titulo: p.titulo }, gravar: x => SD.processoAtualizar(p.id, x),
    aviso: 'Processo atualizado.', oQue: 'atualização do processo', mudanca: { tipo: 'processoAtualizado', id: p.id },
    mostrar: x => setP(atual => atual && { ...atual, ...x }), depois: () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }
  });

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); void lerCampos(); setVersaoHist(x => x + 1); }
  }

  // Nenhum "+ Novo …" com o processo arquivado nem para quem só lê (o advogado na adaptação só cria compromissos).
  return <CriarNoCartao pode={podeLigar || podeCriarCompromisso}>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={p} />
    <header className="cartao-cabeca">
      {/* O topo da anotação (#382): o tipo e o código; a equipe, a etiqueta, o lápis e o ⋯ (Arquivar, Excluir) à direita. Quem tem o
          lápis muda a equipe também nas bolinhas (#356), com as regras de sair do processo do lápis (#276). */}
      <TopoDoCartao modulo="processos" id={p.id} arquivado={!!p.arquivado_em} editando={editando}
        inicio={<Selo tipo="escuro">{TIPOS_PROCESSO[p.tipo].nome}</Selo>}
        esquerda={<>
          <span className="codigo">{p.codigo}</span>
          {p.orgao && <Selo tipo="arq">{p.orgao}</Selo>}
          {p.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
        </>}
        equipe={<EquipeNoTopo modulo="processos" id={p.id} equipe={{ responsavel_id: p.responsavel_id, lista: p.colaboradores }} grupos={p.grupos} mudar={mudaNoLugar ? {
          saida: { podeSair: gravaForaDoCartao(ctx, p.criado_por === eu) }, depois: depoisDeLigar,
          aoSair: equipeVeTudo(ctx.escritorio) ? depoisDeLigar : () => { aoMudar(); aoFechar(); }
        } : null} />}
        mudaEtiquetas={mudaNoLugar} aoMudarEtiquetas={aoMudar}
        aoArquivar={podeAlterar ? arquivar : undefined} aoExcluir={podeAlterar && podeExcluir ? excluir : undefined}
        lapis={podeAlterar ? { rotulo: 'Editar', aoEditar: () => setEditando(true) } : undefined} />
      <TituloEditavel key={noLugar.chave} valor={p.titulo ?? ''} exibido={nomeDoProcesso(p)} rotulo="Nome do cartão" placeholder={nomeDoProcesso({ ...p, titulo: null })}
        maximo={TAMANHO_PROCESSO.titulo} conferir={nome => erroNoLugar(validarProcesso, processoVazio(p.tipo), 'titulo', nome)}
        aoMudarRascunho={noLugar.rascunhoDe('titulo')} aoSalvar={mudaNoLugar ? salvarNome : undefined} />
      <p className="demanda-descricao">{p.numero}</p>
      {/* A faixa das datas (#383, #385), a mesma dos outros cartões: só com a criação, ela some (o rodapé já a mostra; a
          distribuição fica nos dados do processo). */}
      <FaixaDasDatas criacao={{ rotulo: 'Criado em', em: p.criado_em }} />
      {!editando &&<section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <MenuDeSituacao rotulo="Situação do processo" quadro={quadro} valor={p.etapa_id} semSituacao={SEM_SITUACAO_PROCESSO} desabilitado={!!p.arquivado_em || !podeAlterar} aoMudar={mudarSituacao} />
      </section>}
    </header>

    {editando ? <NovoProcesso edicao={{ id: p.id, aoTerminar: terminarEdicao }} /> : <>

    {!podeAlterar && <Nota>{podeEntrar ? SO_LEITURA_DO_PROCESSO_ADVOGADO : SO_LEITURA_DO_PROCESSO}</Nota>}
    {podeEntrar && <div className="cartao-acoes">
      <Botao pequeno onClick={() => entrar('colaborador')}>Entrar como colaborador</Botao>
      <BotaoDuplo pequeno confirmar="Confirmar: assumir como responsável" aoConfirmar={() => entrar('responsavel')}>Assumir como responsável</BotaoDuplo>
    </div>}
    {/* A faixa explica e traz o Desarquivar à vista; o Excluir fica no ⋯ do topo. */}
    {p.arquivado_em && <FaixaDoArquivado modulo="processos" podeExcluir={podeExcluir} aoDesarquivar={podeAlterar ? arquivar : undefined} />}

    <PrazosDoProcesso processo={p} acompanhamento={acompanhamento} soLeitura={!podeAlterar} />

    <Recolhivel titulo="Dados do processo" icone="processos" preferencia="processos.cartao.dados" contador={quantosPreenchidos([...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([, v]) => v))}>
      <dl className="dados">{[...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
    </Recolhivel>

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="processos.cartao.clientes" contador={p.clientes.length} novo={novaPessoaNoItem('processos', p.id, p.clientes, podeLigar).titulo}>
      {p.clientes.length ? <ItensLigados itens={p.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a este processo.</Nota>}
      {podeLigar && <LigarPessoaNoItem modulo="processos" itemId={p.id} ligadas={p.clientes} depois={depoisDeLigar} novo={novaPessoaNoItem('processos', p.id, p.clientes, podeLigar).embaixo} />}
    </Recolhivel>

    {ctx.escritorio?.modulos?.demandas && <Recolhivel titulo="Demandas" icone="demandas" preferencia="processos.cartao.demandas" contador={quantos.demandas}
      novo={podeLigar ? { para: novaDemanda, rotulo: 'Nova demanda deste processo' } : undefined}>
      <CartoesLigados modulo="demandas" carregar={() => SD.demandasDoProcesso(p.id)} vazio="Nenhuma demanda ligada a este processo que você possa abrir." versao={versaoHist} />
      {podeLigar && <AcoesDosLigados novo={{ para: novaDemanda, rotulo: 'Nova demanda' }}>
        <LigarDoModulo modulo="demandas" filtro={async () => ({ fora: (await SD.demandasDoProcesso(p.id)).map(d => d.id) })}
          aoEscolher={d => ligarEAvisar(() => ligarDemandaNoProcesso(p.id, d.id),
            { feito: `Demanda ligada: ${d.titulo}.`, oQue: 'ligação da demanda', ja: 'Esta demanda já estava ligada a este processo.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {modulos?.contratos && <Recolhivel titulo="Contratos" icone="contratos" preferencia="processos.cartao.contratos"
      contador={quantos.contratos ? quantos.contratos.visiveis.length + quantos.contratos.ocultos : undefined}
      novo={podeLigar ? { para: novoContrato, rotulo: 'Novo contrato deste processo' } : undefined}>
      <ContratosDoProcesso processoId={p.id} versao={versaoHist} />
      {podeLigar && <AcoesDosLigados novo={{ para: novoContrato, rotulo: 'Novo contrato' }}>
        <LigarDoModulo modulo="contratos" filtro={async () => ({ fora: (await SD.contratosDoProcesso(p.id)).visiveis.map(k => k.id) })}
          aoEscolher={k => ligarEAvisar(() => ligarContratoNoProcesso(p.id, k.id),
            { feito: `Contrato ligado: ${k.codigo}.`, oQue: 'ligação do contrato', ja: 'Este contrato já estava ligado a este processo.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {/* O "+ Nova tarefa" (#376), com as condições do ligar: a tarefa nasce com o processo e os clientes dele, e a tela volta aqui. */}
    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="processos.cartao.tarefas" contador={quantos.tarefas}
      novo={podeLigar ? { para: novaTarefa, rotulo: 'Nova tarefa deste processo' } : undefined}>
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoProcesso(p.id)} vazio="Nenhuma tarefa ligada a este processo. Elas nascem das intimações e dos prazos." versao={versaoHist} />
      {podeLigar && <AcoesDosLigados novo={{ para: novaTarefa, rotulo: 'Nova tarefa' }}>
        <LigarDoModulo modulo="tarefas" filtro={{ sem: 'processos' }}
          aoEscolher={t => ligarEAvisar(() => ligarNoItem('processo da tarefa', t.id, p.id),
            { feito: `Tarefa ligada: ${t.titulo}.`, oQue: 'ligação da tarefa', ja: 'Esta tarefa já estava ligada a este processo.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {ctx.escritorio?.modulos?.compromissos && <Recolhivel titulo="Compromissos" icone="calendario" preferencia="processos.cartao.compromissos" contador={quantos.compromissos} novo={podeCriarCompromisso ? { para: novoCompromisso, rotulo: 'Nova audiência ou compromisso deste processo' } : undefined}>
      {/* Lê a lista uma vez: muda a chave quando algo foi ligado ou desfeito. */}
      <CompromissosLigados key={`${podeAlterar}:${versaoHist}`} carregar={() => SD.compromissosDoProcesso(p.id)} vazio={podeAlterar ? 'Nenhum compromisso ligado a este processo.' : SEM_COMPROMISSO_VISIVEL} />
      {podeCriarCompromisso && <AcoesDosLigados novo={{ para: novoCompromisso, rotulo: 'Novo compromisso' }}>
        {podeLigar && <LigarDoModulo modulo="compromissos" filtro={{ sem: 'processos' }} aviso="Quem está neste processo passa a ver o compromisso que você ligar."
          aoEscolher={c => ligarEAvisar(() => ligarNoItem('processo do compromisso', c.id, p.id),
            { feito: `Compromisso ligado: ${nomeDoCompromisso(c)}.`, oQue: 'ligação do compromisso', ja: 'Este compromisso já estava ligado a este processo.' }, depoisDeLigar)} />}
      </AcoesDosLigados>}
    </Recolhivel>}

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem dos outros cartões (#360), com os
        andamentos entre os comentários e as anotações (#362). Quem só lê o processo também comenta, como nos outros cartões; com as
        chaves da equipe, todos podem ser mencionados. A escolha de deixar cada seção aberta tem chave da coluna (".coluna."). */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="processos" cartaoId={p.id}
        motivoSemMencao={equipeVeTudo(ctx.escritorio) || equipeEditaTudo(ctx.escritorio) ? undefined : motivoSemMencaoNoProcesso(p)} />
      <AndamentosDoProcesso processo={p} acompanhamento={acompanhamento} soLeitura={!podeAlterar} />
      <AnotacoesDoCartao modulo="processos" id={p.id} somenteLer={!!p.arquivado_em || !podeAlterar} />
      <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="processos.coluna.historico" contador={quantos.historico}>
        <HistoricoDoCartao carregar={() => SD.processoHistorico(p.id)} campos={{ ...CAMPOS_PROCESSO, ...CAMPOS_NO_HISTORICO, ...nomesNoHistorico(campos) }} valor={valorNoHistorico(campos, valorLegivelProcesso)} versao={versaoHist} />
      </Recolhivel>
    </NaColunaDoCartao>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(p.criado_em)}{p.criado_por ? ' por ' + nomeDe(p.criado_por) : ''}</span>
      <span>Atualizado {relativo(p.atualizado_em)}</span>
    </footer>
    </>}
  </CriarNoCartao>;
}
