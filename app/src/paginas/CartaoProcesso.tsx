// Cartão do processo (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de demanda: no topo (TopoDoCartao,
// #382, como o da anotação), o tipo e o código, com a equipe em bolinhas (responsável e colaboradores), a etiqueta, o lápis e o ⋯
// à direita; a linha da Situação (#397); os selos das etiquetas e o nome (CabecaDoCartao, #397; as datas ficam nas seções e o
// número, só em "Dados do processo", #430). "Entrar como colaborador" e "Assumir como responsável" ficam
// logo abaixo, junto da nota de quem só lê (no ⋯, ninguém os acharia), e o aviso diz que a equipe está no topo. Depois, cada tópico
// numa seção que recolhe (prazos, dados, clientes, demandas, contratos, tarefas, compromissos). Na coluna da direita (no centro) ou
// no pé do cartão (ao lado), desde a #362: comentários, andamentos (a linha do tempo), anotações e histórico de alterações.
// Desde a #346, quem altera o processo muda o nome do cartão no próprio lugar, como na anotação (o lápis não o repete). Sem
// nome, o título mostra os clientes (ou o número); o campo abre em branco, e apagar o nome volta a mostrá-los. Desde a #428, os
// dados (o número, com a conferência do CNJ, o órgão, o polo e os detalhes) mudam na própria seção "Dados do processo".
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { SD, type ComoEntrarNoProcesso, type CampoDeProcesso, type PessoaResumida, type Processo } from '../dados';
import { TAMANHO_PROCESSO } from '../dados/limites';
import { erroNoLugar, tituloOpcionalAoGravar } from '../regras/edicaoNoLugar';
import { linhasDosCampos, nomesNoHistorico, valorNoHistorico } from '../regras/camposDeProcesso';
import { CAMPOS_NO_HISTORICO } from '../regras/andamentos';
import { advogadoNaAdaptacao, equipeEditaTudo, equipeVeTudo, SO_LEITURA_DO_PROCESSO, SEM_COMPROMISSO_VISIVEL, SO_LEITURA_DO_PROCESSO_ADVOGADO, soLeOCartao } from '../regras/equipeVeTudo';
import {
  alteraOProcesso, CAMPOS_PROCESSO, clienteNoCartao, linhasDoProcesso, motivoSemMencaoNoProcesso, nomeDoProcesso, papeisParaEscolher, processoVazio, SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO, validarProcesso, valorLegivelProcesso
} from '../regras/processo';
import { SecaoComentarios } from '../ui/Comentarios';
import { AvisoDaEdicaoNoLugar, gravarNoLugar, LembreteDoLapis, useEdicaoNoLugar } from '../ui/EdicaoNoLugar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, DadosEditaveis, Nota, Selo, TituloEditavel, Vazio, type PedidoDeTirar } from '../ui/base';
import { confirmar } from '../ui/janela';
import { CabecaDoCartao } from '../ui/CabecaDoCartao';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { EquipeNoTopo } from './EquipeNoTopo';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { FaixaDoArquivado, TopoDoCartao } from '../ui/TopoDoCartao';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useLista, useQuantos } from '../ui/useQuantos';
import { ContratosDoProcesso } from './ContratosDoProcesso';
import { ligarParte, PartesDoProcesso } from './PartesDoProcesso';
import { ligarJudicialNaSecao, novoDerivado, ProcessosRelacionados } from './ProcessosRelacionados';
import { quantosPreenchidos } from '../regras/secoes';
import { meusGrupos } from '../regras/gruposDaEquipe';
import { useCtx } from '../ui/sessao';
import { dataCurta, hojeISO, relativo } from '../ui/util';
import {
  ACOMPANHAR_DEFERIMENTO, ACOMPANHAR_PRAZO_EXTRA, ACOMPANHAR_PROTECAO, acompanhamentoDaProtecao, anosDosPrazosEmDiasUteis, PARAMETRO_ACOMPANHAR, prazoAposODeferimentoNaAgenda,
  prazoExtraDaProtecao, prazosDaProtecao, prazosPorVir, tituloDoDeferimentoAConcluir
} from '../regras/propriedadeIntelectual';
import { ValidadeDaProtecao } from './processo/ValidadeDaProtecao';
import { useCalendarioDoInpi } from './processo/useCalendarioDoInpi';
import { CartoesLigados } from './CartoesLigados';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { CompromissosLigados } from './CompromissosLigados';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import NovoProcesso from './NovoProcesso';
import { AndamentosDoProcesso, PrazosDoProcesso, useAcompanhamento } from './processo/AndamentosEPrazos';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { SituacaoDoCartao } from '../ui/quadro/SituacaoDoCartao';
import { AcoesDosLigados, CriarNoCartao } from '../ui/ItensLigados';
import { LigarDoModulo, ligarDoModulo } from '../ui/LigarDoModulo';
import {
  desligarContratoDoProcesso, desligarDemandaDoProcesso, desligarNoItem, ligarContratoNoProcesso, ligarDemandaNoProcesso, ligarEAvisar, ligarNoItem, tirarEAvisar,
  type Desfazer
} from './ligarNoCartao';
import { EXPLICACAO_DE_TIRAR_DO_PROCESSO } from '../regras/tirarDoCartao';
import { LigarPessoaNoItem, ligarPessoaNoItem, novaPessoaNoItem, tirarPessoaDoItem } from './PessoasNosItens';
import { nomeDoCompromisso, TIPOS_COMPROMISSO } from '../regras/compromisso';

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
  // A seção "Dados do processo" aberta para mudar ali mesmo (#428), e se ela tem algo mudado (o lápis pergunta antes de abrir por cima).
  const [editandoDados, setEditandoDados] = useState(false);
  const dadosMudados = useRef(false);
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
  // Os prazos de PI em dias úteis (#418) contam no calendário do INPI (o órgão INPI de Feriados e prazos e os dias lançados).
  const inpi = useCalendarioDoInpi(p ? anosDosPrazosEmDiasUteis(p) : []), calendarioDoInpi = inpi.calendario;

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
  // As pessoas com papel e os processos ligados (#316): lidos aqui, para o número no título e a lista da seção.
  const partes = useLista(() => SD.processoPartes(id), chave);
  const relacionados = useLista(() => SD.processosRelacionados(id), chave);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (p === undefined) return <Carregando />;
  if (!p) return <Vazio>Este processo não foi encontrado. Ele pode ter sido excluído, ou você não participa dele.</Vazio>;

  const podeExcluir = !!p.arquivado_em && (p.criado_por === eu || ctx.ehAdmin);
  // Propriedade intelectual (#317): os prazos do INPI (null fora da área ou sem o tipo de proteção).
  const hoje = hojeISO(), protecao = prazosDaProtecao(p, hoje, calendarioDoInpi);
  const meus = meusGrupos(ctx.grupos, ctx.perfil.id), podeAlterar = !soLeOCartao(ctx, m => alteraOProcesso(p, m, meus));
  const advogado = advogadoNaAdaptacao(ctx), podeEntrar = advogado && !alteraOProcesso(p, ctx.perfil, meus) && !p.arquivado_em;
  // Ligar ao processo um item que já existe (#341): só quem altera o processo, com ele ativo. Depois, o cartão lê tudo de novo.
  const podeLigar = podeAlterar && !p.arquivado_em;
  // Criar um compromisso já ligado (#273, #376): quem altera o processo e, na fase de adaptação, o advogado (ele marca audiência
  // em qualquer processo). Nunca com o processo arquivado. O "+" do título e o "+ Novo compromisso" de baixo seguem esta regra.
  const podeCriarCompromisso = !p.arquivado_em && (podeAlterar || advogado);
  const novoCompromisso = '/agenda/novo/?processo=' + p.id;
  // Propriedade intelectual (#317, parte C): os prazos do INPI viram um compromisso que se repete (#307), com a mesma regra de criar
  // compromisso e o módulo Compromissos ligado. O cadastro abre já preenchido (?acompanhar=protecao). O prazo que já está no prazo extra
  // (com taxa) vira um compromisso só, no último dia dele (?acompanhar=prazo-extra): a série começa no prazo seguinte.
  const naAgenda = podeCriarCompromisso && !!modulos?.compromissos;
  // O prazo após o deferimento da marca (#418) também vira um compromisso só (?acompanhar=deferimento); com a concessão informada, o cartão
  // oferece concluí-lo. Os compromissos já criados acompanham as datas: o cartão oferece atualizá-las quando a conta muda.
  const prazosNaAgenda = naAgenda ? acompanhamentoDaProtecao(p, hoje, calendarioDoInpi) : null, prazoExtra = naAgenda ? prazoExtraDaProtecao(p, hoje, calendarioDoInpi) : null;
  const aposODeferimento = naAgenda ? prazoAposODeferimentoNaAgenda(p, hoje, calendarioDoInpi) : null, concluir = naAgenda ? tituloDoDeferimentoAConcluir(p) : null;
  const acompanharNaAgenda = prazosNaAgenda || prazoExtra || aposODeferimento || concluir ? {
    processoId: p.id, comDemanda: !!modulos?.demandas, hoje, concluir, aoMudar: () => setVersaoHist(v => v + 1), versaoDoCartao: versaoHist,
    serie: prazosNaAgenda && { acompanhamento: prazosNaAgenda, para: `${novoCompromisso}&${PARAMETRO_ACOMPANHAR}=${ACOMPANHAR_PROTECAO}` },
    extra: prazoExtra && { prazo: prazoExtra, para: `${novoCompromisso}&${PARAMETRO_ACOMPANHAR}=${ACOMPANHAR_PRAZO_EXTRA}` },
    deferimento: aposODeferimento && { prazo: aposODeferimento, para: `${novoCompromisso}&${PARAMETRO_ACOMPANHAR}=${ACOMPANHAR_DEFERIMENTO}` }
  } : null;
  // A demanda e o contrato criados já ligados a este processo (#376), com as mesmas condições de ligar os que existem.
  const novaDemanda = '/demandas/nova/?processo=' + p.id, novoContrato = '/contratos/novo/?processo=' + p.id;
  const depoisDeLigar = () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); };
  /**
   * O "x" das demandas, dos contratos, das tarefas e dos compromissos ligados (#424): quem altera o processo, com ele ativo. O item
   * continua no SEMPER; só a ligação sai, com a pergunta antes e o Desfazer.
   */
  const sai = (oQue: string, tirar: () => Promise<Desfazer | null>, aviso: string, acao: string): PedidoDeTirar | undefined => podeLigar
    ? { oQue, explicacao: EXPLICACAO_DE_TIRAR_DO_PROCESSO, aoTirar: () => tirarEAvisar(tirar, aviso, acao, depoisDeLigar) } : undefined;
  // O cadastro da tarefa que nasce ligada a este processo (#376).
  const novaTarefa = '/tarefas/nova/?processo=' + p.id;
  async function entrar(como: ComoEntrarNoProcesso) {
    try {
      await SD.processoMeIncluir(p!.id, como);
      avisar(ENTRADA_NO_PROCESSO[como]);
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  // Embaixo do nome, o papel do cliente no processo (#426), ou que ele ainda falta.
  const cliente = (c: PessoaResumida): ItemLigado => ({ id: 'cliente-' + c.id, para: '/pessoas/?id=' + c.id, codigo: c.codigo, titulo: c.nome,
    detalhe: clienteNoCartao(p!.papeis_clientes?.[c.id]), selo: c.arquivado_em ? 'Arquivada' : undefined,
    // O "x" de cada cliente (#424): nunca no último (o processo precisa de um cliente).
    tirar: podeLigar ? tirarPessoaDoItem('processos', p.id, c, p.clientes.length, depoisDeLigar) : undefined });

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
    setEditandoDados(false);
    if (salvou) { aoMudar(); void carregar(); void lerCampos(); setVersaoHist(x => x + 1); }
  }
  /**
   * O lápis abre o cartão inteiro como formulário, e a seção de dados aberta (#428) fecha: com algo mudado nela, pergunta antes,
   * para nada se perder sem a pessoa saber.
   */
  async function abrirOLapis() {
    if (editandoDados && dadosMudados.current
      && !await confirmar('Descartar as mudanças em "Dados do processo"?', 'O lápis abre o processo inteiro para editar, e o que você mudou na seção não será salvo.', 'Descartar e editar', true)) return;
    setEditandoDados(false);
    setEditando(true);
  }

  // Nenhum "+ Novo …" com o processo arquivado nem para quem só lê (o advogado na adaptação só cria compromissos).
  return <LembreteDoLapis edicao={noLugar}><CriarNoCartao pode={podeLigar || podeCriarCompromisso}>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={p} />
    {/* A ordem da cabeça (#397): o topo (com a Situação e as etiquetas) e o título. Sem descrição: o número ficava ali e se
        repetia em "Dados do processo" (e no título, se o processo não tem nome nem clientes); desde a #430, fica só nos dados. */}
    <CabecaDoCartao
      topo={/* O topo da anotação (#382): o tipo e o código; a equipe, a etiqueta, o lápis e o ⋯ (Arquivar, Excluir) à direita. Quem tem o
          lápis muda a equipe também nas bolinhas (#356), com as regras de sair do processo do lápis (#276). */
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
        lapis={podeAlterar ? { rotulo: 'Editar', aoEditar: () => noLugar.abrirOLapis(() => void abrirOLapis()) } : undefined}
        situacao={<SituacaoDoCartao>
          <MenuDeSituacao rotulo="Situação do processo" quadro={quadro} valor={p.etapa_id} semSituacao={SEM_SITUACAO_PROCESSO} desabilitado={!!p.arquivado_em || !podeAlterar} aoMudar={mudarSituacao} />
        </SituacaoDoCartao>} />}
      titulo={<TituloEditavel key={noLugar.chave} valor={p.titulo ?? ''} exibido={nomeDoProcesso(p)} rotulo="Nome do cartão" placeholder={nomeDoProcesso({ ...p, titulo: null })}
        maximo={TAMANHO_PROCESSO.titulo} conferir={nome => erroNoLugar(validarProcesso, processoVazio(p.tipo), 'titulo', nome)}
        aoMudarRascunho={noLugar.rascunhoDe('titulo')} aoSalvar={mudaNoLugar ? salvarNome : undefined} />} />
    {/* Sem a faixa das datas: só com a criação, ela some (o rodapé já a mostra; a distribuição fica nos dados do processo). */}

    {editando ? <NovoProcesso edicao={{ id: p.id, aoTerminar: terminarEdicao }} /> : <>

    {!podeAlterar && <Nota>{podeEntrar ? SO_LEITURA_DO_PROCESSO_ADVOGADO : SO_LEITURA_DO_PROCESSO}</Nota>}
    {podeEntrar && <div className="cartao-acoes">
      <Botao pequeno onClick={() => entrar('colaborador')}>Entrar como colaborador</Botao>
      <BotaoDuplo pequeno confirmar="Confirmar: assumir como responsável" aoConfirmar={() => entrar('responsavel')}>Assumir como responsável</BotaoDuplo>
    </div>}
    {/* A faixa explica e traz o Desarquivar à vista; o Excluir fica no ⋯ do topo. */}
    {p.arquivado_em && <FaixaDoArquivado modulo="processos" podeExcluir={podeExcluir} aoDesarquivar={podeAlterar ? arquivar : undefined} />}

    <PrazosDoProcesso processo={p} acompanhamento={acompanhamento} soLeitura={!podeAlterar} aoMudarRascunho={noLugar.rascunhoDe('prazoDoProcesso')} />

    {/* Quem altera o processo clica nos dados e eles viram um formulário ali mesmo (#428), com todos os campos, inclusive os vazios;
        depois de salvar, a seção volta a mostrar só os preenchidos. O lápis continua abrindo o processo inteiro. */}
    <Recolhivel titulo="Dados do processo" icone="processos" preferencia="processos.cartao.dados" contador={quantosPreenchidos([...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([, v]) => v))}>
      <DadosEditaveis rotulo="Dados do processo" editando={editandoDados} aoEditar={mudaNoLugar ? () => setEditandoDados(true) : undefined}
        edicao={<NovoProcesso edicao={{ id: p.id, soOsDados: true, aoTerminar: terminarEdicao, aoMudarSujo: sujo => { dadosMudados.current = sujo; } }} />}>
        <dl className="dados">{[...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
      </DadosEditaveis>
    </Recolhivel>

    {/* Tarefas e Compromissos vêm antes de Clientes (#429). O "+ Nova tarefa" (#376), com as condições do ligar: a tarefa nasce com o processo e os clientes dele, e a tela volta aqui. */}
    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="processos.cartao.tarefas" contador={quantos.tarefas}
      ligar={podeLigar ? ligarDoModulo('tarefas') : undefined} novo={podeLigar ? { para: novaTarefa, rotulo: 'Nova tarefa deste processo' } : undefined}>
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoProcesso(p.id)} vazio="Nenhuma tarefa ligada a este processo. Elas nascem das intimações e dos prazos." versao={versaoHist}
        tirar={t => sai(`a tarefa ${t.codigo}`, () => desligarNoItem('processo da tarefa', t.id, p.id), `Tarefa tirada do processo: ${t.codigo}.`, 'retirada da tarefa')} />
      {podeLigar && <AcoesDosLigados>
        <LigarDoModulo modulo="tarefas" filtro={{ sem: 'processos' }}
          aoEscolher={t => ligarEAvisar(() => ligarNoItem('processo da tarefa', t.id, p.id),
            { feito: `Tarefa ligada: ${t.titulo}.`, oQue: 'ligação da tarefa', ja: 'Esta tarefa já estava ligada a este processo.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {ctx.escritorio?.modulos?.compromissos && <Recolhivel titulo="Compromissos" icone="calendario" preferencia="processos.cartao.compromissos" contador={quantos.compromissos}
      ligar={podeLigar ? ligarDoModulo('compromissos') : undefined} novo={podeCriarCompromisso ? { para: novoCompromisso, rotulo: 'Nova audiência ou compromisso deste processo' } : undefined}>
      {/* Lê a lista uma vez: muda a chave quando algo foi ligado ou desfeito. */}
      {/* A audiência e a perícia precisam do processo: não saem por aqui (trocar o processo delas é pelo lápis do compromisso). */}
      <CompromissosLigados key={`${podeAlterar}:${versaoHist}`} carregar={() => SD.compromissosDoProcesso(p.id)} vazio={podeAlterar ? 'Nenhum compromisso ligado a este processo.' : SEM_COMPROMISSO_VISIVEL}
        tirar={c => TIPOS_COMPROMISSO[c.tipo].doProcesso ? undefined
          : sai(`o compromisso ${nomeDoCompromisso(c)}`, () => desligarNoItem('processo do compromisso', c.id, p.id), `Compromisso tirado do processo: ${nomeDoCompromisso(c)}.`, 'retirada do compromisso')} />
      {podeLigar && <AcoesDosLigados>
        <LigarDoModulo modulo="compromissos" filtro={{ sem: 'processos' }} aviso="Quem está neste processo passa a ver o compromisso que você ligar."
          aoEscolher={c => ligarEAvisar(() => ligarNoItem('processo do compromisso', c.id, p.id),
            { feito: `Compromisso ligado: ${nomeDoCompromisso(c)}.`, oQue: 'ligação do compromisso', ja: 'Este compromisso já estava ligado a este processo.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="processos.cartao.clientes" contador={p.clientes.length}
      ligar={ligarPessoaNoItem('processos', p.clientes, podeLigar)} novo={novaPessoaNoItem('processos', p.id, p.clientes, podeLigar)} atalho="ligacao">
      {p.clientes.length ? <ItensLigados itens={p.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a este processo.</Nota>}
      {podeLigar && <LigarPessoaNoItem modulo="processos" itemId={p.id} ligadas={p.clientes} papeis={p.papeis_clientes} depois={depoisDeLigar} />}
    </Recolhivel>

    {/* Propriedade intelectual (#317): a validade e os prazos do INPI, calculados das datas do processo, só no administrativo (#425).
        O número: os prazos por vir. */}
    {protecao && <Recolhivel titulo="Validade e anuidades" icone="relogio" preferencia="processos.cartao.validade" contador={prazosPorVir(protecao.datas, hoje)}>
      <ValidadeDaProtecao prazos={protecao} hoje={hoje} acompanhar={acompanharNaAgenda} calendario={inpi.situacao} />
    </Recolhivel>}

    {/* As outras pessoas do processo, com o papel de cada uma (#316). A corrente do título (#427: liga uma pessoa que já está no
        cadastro) abre o formulário de baixo. Nos de PI, também titular, inventor e autor da criação (#317). */}
    <Recolhivel titulo="Pessoas do processo" icone="pessoas" preferencia="processos.cartao.partes" contador={partes?.length}
      ligar={podeLigar ? ligarParte(partes) : undefined}>
      <PartesDoProcesso processoId={p.id} partes={partes} papeis={papeisParaEscolher(p)} podeMudar={podeLigar} aoMudar={() => setVersaoHist(v => v + 1)} />
    </Recolhivel>

    {/* O processo de origem e os recursos e incidentais que nasceram deste (#316), cada um com o próprio número e andamentos; o
        administrativo e o judicial que nasceu dele, ligados um ao outro (#425). O "+" do título abre o menu das ligações (#427). */}
    <Recolhivel titulo="Processos relacionados" icone="processos" preferencia="processos.cartao.relacionados" contador={relacionados?.length}
      novo={podeLigar ? novoDerivado(p.id, p.tipo) : undefined} ligar={podeLigar ? ligarJudicialNaSecao(p.tipo) : undefined}>
      <ProcessosRelacionados lista={relacionados} processoId={p.id} tipo={p.tipo} aoMudar={depoisDeLigar} />
    </Recolhivel>

    {ctx.escritorio?.modulos?.demandas && <Recolhivel titulo="Demandas" icone="demandas" preferencia="processos.cartao.demandas" contador={quantos.demandas}
      ligar={podeLigar ? ligarDoModulo('demandas') : undefined} novo={podeLigar ? { para: novaDemanda, rotulo: 'Nova demanda deste processo' } : undefined}>
      <CartoesLigados modulo="demandas" carregar={() => SD.demandasDoProcesso(p.id)} vazio="Nenhuma demanda ligada a este processo que você possa abrir." versao={versaoHist}
        tirar={d => sai(`a demanda ${d.codigo}`, () => desligarDemandaDoProcesso(p.id, d.id), `Demanda tirada do processo: ${d.codigo}.`, 'retirada da demanda')} />
      {podeLigar && <AcoesDosLigados>
        <LigarDoModulo modulo="demandas" filtro={async () => ({ fora: (await SD.demandasDoProcesso(p.id)).map(d => d.id) })}
          aoEscolher={d => ligarEAvisar(() => ligarDemandaNoProcesso(p.id, d.id),
            { feito: `Demanda ligada: ${d.titulo}.`, oQue: 'ligação da demanda', ja: 'Esta demanda já estava ligada a este processo.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {modulos?.contratos && <Recolhivel titulo="Contratos" icone="contratos" preferencia="processos.cartao.contratos"
      contador={quantos.contratos ? quantos.contratos.visiveis.length + quantos.contratos.ocultos : undefined}
      ligar={podeLigar ? ligarDoModulo('contratos') : undefined} novo={podeLigar ? { para: novoContrato, rotulo: 'Novo contrato deste processo' } : undefined}>
      <ContratosDoProcesso processoId={p.id} versao={versaoHist}
        tirar={k => sai(`o contrato ${k.codigo}`, () => desligarContratoDoProcesso(p.id, k.id), `Contrato tirado do processo: ${k.codigo}.`, 'retirada do contrato')} />
      {podeLigar && <AcoesDosLigados>
        <LigarDoModulo modulo="contratos" filtro={async () => ({ fora: (await SD.contratosDoProcesso(p.id)).visiveis.map(k => k.id) })}
          aoEscolher={k => ligarEAvisar(() => ligarContratoNoProcesso(p.id, k.id),
            { feito: `Contrato ligado: ${k.codigo}.`, oQue: 'ligação do contrato', ja: 'Este contrato já estava ligado a este processo.' }, depoisDeLigar)} />
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
  </CriarNoCartao></LembreteDoLapis>;
}
