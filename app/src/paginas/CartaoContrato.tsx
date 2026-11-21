// Cartão do contrato (painel lateral), no modelo do cartão de pessoa: no topo (TopoDoCartao, #382, como o da anotação), a
// categoria e o código, com a equipe em bolinhas (com o % de cada um na dica), a etiqueta, o lápis e o ⋯ à direita; os selos das
// etiquetas; os clientes e a situação. Quem edita sem os valores tem o mesmo lápis, com esse nome. Depois, cada tópico numa seção que recolhe, com o número de itens ao lado do
// título (objetos, que abrem as demandas deles, partes, honorários com divisão e parcelas, documento, demandas, tarefas,
// histórico), com a escolha de cada usuário guardada. Os campos aparecem, mesmo vazios.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SD, type Contrato, type Historico, type Participacao, type PessoaResumida } from '../dados';
import { contratoComAssinatura, erroDaAssinatura, objetosDefinidos, objetosEDemandas, CAMPOS_CONTRATO, CATEGORIAS, fmtDinheiro, fmtPercentual, nomesPorExtenso, percentualResponsavel, SEM_SITUACAO, textoDosParticipantes, valorLegivelContrato, valorParcela, alteraOContrato } from '../regras/contrato';
import { EDITA_SEM_OS_VALORES, equipeEditaTudo, SO_LEITURA_DO_CONTRATO } from '../regras/equipeVeTudo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { FaixaDoArquivado, TopoDoCartao } from '../ui/TopoDoCartao';
import { Aviso, Carregando, DadoDoGrupo, DataEditavel, FaixaDasDatas, Nota, Selo, Vazio } from '../ui/base';
import { AvisoDaEdicaoNoLugar, useEdicaoNoLugar } from '../ui/EdicaoNoLugar';
import { SecaoComentarios } from '../ui/Comentarios';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';
import { CartoesLigados } from './CartoesLigados';
import { ListasDoCartao } from './ListasDoCartao';
import { ProcessosDoCartao } from './ProcessosDoCartao';
import { ParcelasDoContrato, ROTULO_DA_NOVA_PARCELA } from './financeiro/Parcelas';
import { chegouAoAssinado } from '../regras/parcelas';
import './Financeiro.css';
import { EquipeDoContratoNoTopo } from './EquipeDoContratoNoTopo';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { NaColunaDoCartao } from '../ui/PainelCartao';
import { Recolhivel } from '../ui/Recolhivel';
import { useLista, useQuantos } from '../ui/useQuantos';
import { quantosPreenchidos } from '../regras/secoes';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { gruposDoItem, meusGrupos, peloGrupoSemOsValores } from '../regras/gruposDaEquipe';
import { useCtx } from '../ui/sessao';
import NovoContrato from './NovoContrato';
import { avisarSeAssinadoSemObjeto, SEM_OBJETO_DEFINIDO } from './clienteAoContrato';
import { dataCurta, dataHora, relativo } from '../ui/util';
import { MenuDeSituacao } from '../ui/quadro/MenuDeSituacao';
import { SituacaoDoCartao } from '../ui/quadro/SituacaoDoCartao';
import { DEMANDA_DE_OUTRO_CONTRATO, motivoDeContratoDiferente } from '../regras/ligarExistente';
import { AcoesDosLigados, CriarNoCartao } from '../ui/ItensLigados';
import { LigarDoModulo } from '../ui/LigarDoModulo';
import { ligarEAvisar, ligarNoItem } from './ligarNoCartao';

/** O valor de "Assinado em", na faixa das datas, enquanto o contrato não tem a data da assinatura. */
const NAO_ASSINADO = 'Ainda não';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoContrato({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [k, setK] = useState<Contrato | null | undefined>(undefined);   // undefined: carregando; null: não existe
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  // A assinatura mudada no próprio lugar (#395): com ela por salvar, fechar o cartão pergunta antes.
  const noLugar = useEdicaoNoLugar();
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.contratoVer(id).then(x => { setK(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra o contrato como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });
  // O que cada seção tem, para o número ao lado do título (as demandas também ligam cada objeto à demanda dele).
  const modulos = ctx.escritorio?.modulos;
  const chave = `${id}:${versaoHist}`;
  const demandas = useLista(() => SD.demandasDoContrato(id), chave, !!modulos?.demandas);
  const tarefas = useQuantos(() => SD.tarefasDoContrato(id), chave, !!modulos?.tarefas);
  const veParcelas = !!modulos?.financeiro && (ctx.ehAdmin || k?.responsavel_id === eu);
  const parcelas = useQuantos(() => SD.parcelasDoContrato(id), chave, veParcelas);
  const historico = useQuantos(() => SD.contratoHistorico(id), chave);
  const contas = useLista(() => SD.contasParaEscolher(), chave, !!modulos?.financeiro);
  // Os processos ligados (os que a pessoa não pode abrir também contam).
  const processosLidos = useLista(() => SD.processosDoContrato(id).then(x => [x]), chave, !!modulos?.processos)?.[0];
  const processosDoContrato = useCallback(() => SD.processosDoContrato(id), [id]);
  // Os objetos que ainda não viraram demanda (ficam na lista das demandas, sem link).
  // Só antes de o contrato ser assinado: depois, a demanda de cada objeto já nasceu (e, se não existe mais, foi excluída).
  const objetosSemDemanda = k && !chegouAoAssinado(quadro.colunas, k.etapa_id, k.assinado_em)
    ? objetosEDemandas(objetosDefinidos(k.objetos), demandas ?? []).filter(x => !x.demanda).map(x => x.objeto) : [];
  // O contrato criado sozinho do cliente fechado ainda com o objeto "A definir" (#269).
  const semObjeto = !!k && !objetosDefinidos(k.objetos).length;

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (k === undefined) return <Carregando />;
  if (!k) return <Vazio>Este contrato não foi encontrado. Ele pode ter sido excluído, ou você não tem acesso a ele.</Vazio>;

  const V = (campo: keyof Contrato) => valorLegivelContrato(campo, k[campo]);
  const podeExcluir = !!k.arquivado_em && (k.criado_por === eu || ctx.ehAdmin);
  // Quem só foi mencionado num comentário lê e comenta, mas não altera.
  const podeAlterar = alteraOContrato({ ...k, participantes: k.participantes.map(p => p.pessoa.id) }, ctx.perfil);
  // Quem não é parte vê o contrato sem o que é financeiro: as seções de valores nem aparecem, para "vazio" não parecer "zero".
  // Quem está no contrato só por um grupo da equipe (#378) participa sem os valores, como a equipe com a chave "equipe_edita_tudo".
  const meus = meusGrupos(ctx.grupos, ctx.perfil.id), peloGrupo = podeAlterar ? undefined : gruposDoItem(ctx.grupos, k.grupos).find(g => meus.includes(g.id));
  const oculto = k.ve_financeiro === false, semValores = !podeAlterar && (equipeEditaTudo(ctx.escritorio) || !!peloGrupo);
  const parcela = valorParcela(k.valor, k.entrada, k.parcelas, k.descontos);
  const doResponsavel = percentualResponsavel(k.percentual_escritorio, k.participantes.map(p => p.percentual), k.indicador_percentual);
  // O responsável e os participantes são da equipe (informação interna): ficam em bolinhas ao lado das ações, cada uma com
  // o papel e o link para o cartão da pessoa. As partes são as pessoas de fora do escritório: os clientes, o indicador e
  // participantes de fora que já estavam no contrato antes de o participante ser sempre da equipe.
  const comPercentual = (papel: string, pct: number | null) => pct === null ? papel : `${papel} · ${fmtPercentual(pct)}`;
  const pessoaLigada = (pessoa: PessoaResumida, chave: string, detalhe: string): ItemLigado => ({ id: chave + pessoa.id, para: '/pessoas/?id=' + pessoa.id,
    codigo: pessoa.codigo, titulo: pessoa.nome, detalhe, selo: pessoa.arquivado_em ? 'Arquivada' : undefined });
  const participante = (p: Participacao) => pessoaLigada(p.pessoa, 'participante-', comPercentual('Participante', p.percentual));
  const daEquipe = (p: Participacao) => ctx.equipe.some(m => m.pessoa_id === p.pessoa.id);
  const partes: ItemLigado[] = [
    ...k.clientes.map(c => pessoaLigada(c, 'cliente-', 'Cliente')),
    ...k.participantes.filter(p => !daEquipe(p)).map(participante),
    ...(k.indicador ? [pessoaLigada(k.indicador, 'indicador-', comPercentual('Indicador', k.indicador_percentual))] : [])
  ];
  // Ligar ao contrato uma demanda ou uma tarefa que já existe (#341): quem altera o contrato (ou, na fase de adaptação, sem os
  // valores), com ele ativo. Depois, as seções e os contadores leem de novo.
  const podeLigar = !k.arquivado_em && (podeAlterar || semValores);
  const depoisDeLigar = () => { aoMudar(); setVersaoHist(v => v + 1); };
  // O cadastro do processo que nasce ligado a este contrato (#376).
  const novoProcesso = '/processos/novo/?contrato=' + k.id;
  // Depois de mudar a equipe nas bolinhas: a lista (a coluna do responsável), o cartão e o histórico leem de novo.
  const depoisDaEquipe = () => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); };
  const percentuaisParticipantes = textoDosParticipantes(k.participantes.map(p => ({ nome: p.pessoa.nome, percentual: p.percentual }))) ?? '—';

  async function arquivar() {
    const estava = !!k!.arquivado_em;
    try {
      await SD.contratosArquivar([k!.id], !estava);
      feito(estava ? 'Contrato desarquivado.' : 'Contrato arquivado. Arquivados podem ser excluídos depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.contratosArquivar([k!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.contratosExcluir([k!.id]);
    if (r.excluidas) { avisar('Contrato excluído definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = k!.etapa_id || null, ordemDe = k!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.contratoMover(k!.id, etapa, ordem);
      setK({ ...k!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movido para "${quadro.nomeDe(etapa)}".` : `Contrato ${SEM_SITUACAO.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.contratoMover(k!.id, de, ordemDe); });
      if (etapa !== de && podeAlterar) avisarSeAssinadoSemObjeto(k!.objetos, etapa, quadro.colunas, { rotulo: 'Editar o contrato', fn: () => setEditando(true) });
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }
  /**
   * A assinatura mudada no próprio lugar (#395), como o início da tarefa: grava pela mesma função do lápis (com o histórico), a
   * partir do contrato inteiro como está agora no banco, e o Desfazer volta a data de antes.
   */
  async function salvarAssinatura(assinadoEm: string | null) {
    const atual = await SD.contratoObter(k!.id);
    if (!atual) throw new Error('Este contrato não foi encontrado. Feche e tente de novo.');
    const antes = contratoComAssinatura(atual, atual.assinado_em);
    await SD.contratoAtualizar(atual.id, contratoComAssinatura(atual, assinadoEm));
    feito('Contrato atualizado.', 'atualização do contrato', async () => {
      await SD.contratoAtualizar(atual.id, antes);
      return { tipo: 'contratoAtualizado', id: atual.id };
    });
    aoMudar(); await carregar(); setVersaoHist(x => x + 1);
  }
  const mudaAssinatura = podeAlterar && !k.arquivado_em && !editando;

  // Com o contrato arquivado, ou para quem só o lê, nenhuma seção mostra o "+ Novo …" (#376).
  return <CriarNoCartao pode={podeLigar}>
    <AvisoDaEdicaoNoLugar edicao={noLugar} gravado={{ titulo: null }} />
    <header className="cartao-cabeca">
      {/* O topo da anotação (#382): a categoria e o código; a equipe, a etiqueta, o lápis e o ⋯ (Arquivar, Excluir) à direita. Quem
          altera o contrato muda a equipe também nas bolinhas (#356), com as regras do lápis; o % de cada um continua no lápis. Quem
          edita sem os valores tem o mesmo lápis, com esse nome (antes, um botão de texto à parte). As etiquetas: quem vê os valores
          ou edita sem eles. */}
      <TopoDoCartao modulo="contratos" id={k.id} arquivado={!!k.arquivado_em} editando={editando}
        inicio={!oculto && <Selo tipo="escuro">{CATEGORIAS[k.categoria]}</Selo>}
        esquerda={<>
          <span className="codigo">{k.codigo}</span>
          {k.codigo_antigo && <span className="codigo">antigo: {k.codigo_antigo}</span>}
          {k.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
        </>}
        equipe={<EquipeDoContratoNoTopo contrato={k} depois={podeAlterar && !k.arquivado_em ? depoisDaEquipe : null} />}
        mudaEtiquetas={!k.arquivado_em && !(oculto && !semValores)} aoMudarEtiquetas={aoMudar}
        aoArquivar={podeAlterar ? arquivar : undefined} aoExcluir={podeAlterar && podeExcluir ? excluir : undefined}
        lapis={podeAlterar || semValores ? { rotulo: podeAlterar ? 'Editar' : 'Editar sem os valores', aoEditar: () => setEditando(true) } : undefined} />
      <h2>{nomesPorExtenso(k.clientes.map(c => c.nome))}</h2>
      {/* A faixa das datas (#383), a mesma dos outros cartões: a criação e a assinatura (que saiu de Honorários). Quem não vê os
          valores do contrato também não vê a assinatura, como antes, e aí a faixa some (#385): sobraria só a criação, que o
          rodapé já mostra. Quem altera o contrato muda a assinatura ali mesmo (#395), como o início da tarefa. */}
      <FaixaDasDatas criacao={{ rotulo: 'Criado em', em: k.criado_em }}>
        {!oculto && <DadoDoGrupo rotulo="Assinado em">
          <DataEditavel key={'assinatura-' + noLugar.chave} nome="Data da assinatura" valor={k.assinado_em} semData={NAO_ASSINADO} conferir={erroDaAssinatura}
            aoMudarRascunho={noLugar.rascunhoDe('assinatura')} aoSalvar={mudaAssinatura ? salvarAssinatura : undefined} />
        </DadoDoGrupo>}
      </FaixaDasDatas>
      {!editando && <SituacaoDoCartao>
        <MenuDeSituacao rotulo="Situação do contrato" quadro={quadro} valor={k.etapa_id} semSituacao={SEM_SITUACAO} desabilitado={!!k.arquivado_em || (!podeAlterar && !semValores)} aoMudar={mudarSituacao} />
      </SituacaoDoCartao>}
    </header>

    {editando ? <NovoContrato edicao={{ id: k.id, aoTerminar: terminarEdicao, semValores }} /> : <>

    {!podeAlterar && <Nota>{peloGrupo && !equipeEditaTudo(ctx.escritorio) ? peloGrupoSemOsValores(peloGrupo.nome) : semValores ? EDITA_SEM_OS_VALORES : oculto ? SO_LEITURA_DO_CONTRATO : 'Você vê este contrato porque foi mencionado num comentário. Pode ler e comentar, mas não alterar.'}</Nota>}
    {/* A faixa explica e traz o Desarquivar à vista; o Excluir fica no ⋯ do topo. */}
    {k.arquivado_em && <FaixaDoArquivado modulo="contratos" podeExcluir={podeExcluir} aoDesarquivar={podeAlterar ? arquivar : undefined} />}

    {/* Os checklists do contrato (#309): mexe quem altera o contrato (ou, com a equipe editando tudo, quem o vê), como nas
        anotações e nos processos; arquivado, só se lê. */}
    <ListasDoCartao modulo="contratos" id={k.id} somenteLer={!!k.arquivado_em || !(podeAlterar || semValores)} />

    {/* As demandas são os objetos do contrato: cada objeto é a demanda que nasceu dele. O objeto que ainda não virou
        demanda (o contrato não chegou ao assinado) aparece na mesma lista, sem link. */}
    {modulos?.demandas ? <Recolhivel titulo="Demandas" icone="demandas" preferencia="contratos.cartao.demandas" contador={demandas ? demandas.length + objetosSemDemanda.length : undefined} novo={oculto && !semValores ? undefined : { para: '/demandas/nova/?contrato=' + k.id, rotulo: 'Nova demanda deste contrato' }}>
      {semObjeto && <Aviso tipo="info">{SEM_OBJETO_DEFINIDO}</Aviso>}
      <CartoesLigados modulo="demandas" rotulo="Demandas do contrato" carregar={() => SD.demandasDoContrato(k.id)} vazio="Nenhum objeto cadastrado neste contrato." versao={versaoHist}
        antes={objetosSemDemanda.map((objeto, i) => ({ id: 'objeto-' + i, titulo: objeto, detalhe: 'Objeto do contrato · vira demanda quando o contrato for assinado' }))} />
      {podeLigar && <AcoesDosLigados novo={{ para: '/demandas/nova/?contrato=' + k.id, rotulo: 'Nova demanda' }}>
        <LigarDoModulo modulo="demandas" filtro={{ sem: 'contratos' }} aviso="Quem está neste contrato passa a ver, só para ler, a demanda que você ligar e as tarefas dela."
          aoEscolher={d => ligarEAvisar(() => ligarNoItem('contrato da demanda', d.id, k.id),
            { feito: `Demanda ligada: ${d.titulo}.`, oQue: 'ligação da demanda', ja: 'Esta demanda já estava ligada a este contrato.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>
    : <Recolhivel titulo={k.objetos.length > 1 ? 'Objetos do contrato' : 'Objeto do contrato'} icone="demandas" preferencia="contratos.cartao.objetos" contador={k.objetos.length}>
      <ItensLigados rotulo="Objetos do contrato" vazio="Nenhum objeto cadastrado." itens={k.objetos.map((objeto, i) => ({ id: 'objeto-' + i, titulo: objeto }))} />
    </Recolhivel>}

    {modulos?.processos && <Recolhivel titulo="Processos" icone="processos" preferencia="contratos.cartao.processos"
      contador={processosLidos ? processosLidos.visiveis.length + processosLidos.ocultos : undefined}
      novo={podeLigar ? { para: novoProcesso, rotulo: 'Novo processo deste contrato' } : undefined}>
      {/* Ligar ou criar um processo não mexe em valores: na fase de adaptação, quem não é parte também liga e cria (#376). */}
      <ProcessosDoCartao carregar={processosDoContrato} versao={versaoHist} somenteLer={!podeLigar}
        vazio="Nenhum processo ligado a este contrato." ligar={processoId => SD.contratoProcessoLigar(k.id, processoId)}
        desligar={processoId => SD.contratoProcessoDesligar(k.id, processoId)} aoMudar={() => setVersaoHist(v => v + 1)}
        novo={{ para: novoProcesso, rotulo: 'Novo processo' }} />
    </Recolhivel>}

    <Recolhivel titulo="Partes" icone="pessoas" preferencia="contratos.cartao.partes" contador={partes.length}>
      <ItensLigados itens={partes} />
    </Recolhivel>

    {/* Honorários, divisão e parcelas juntos: as parcelas são o detalhe do que foi combinado. O número é o de parcelas. */}
    {!oculto && <Recolhivel titulo="Honorários" icone="dinheiro" preferencia="contratos.cartao.honorarios" contador={parcelas}
      novo={veParcelas ? { rotulo: ROTULO_DA_NOVA_PARCELA } : undefined}>
      <dl className="dados">{([
      ['Categoria', V('categoria')],
      ['Valor do contrato', V('valor')],
      ['Entrada', V('entrada')],
      ['Parcelas', V('parcelas')],
      ['Valor da parcela', parcela === null ? '—' : <>{fmtDinheiro(parcela)} <small className="nota">{k.entrada ? 'depois da entrada' : 'calculado'}</small></>],
      ['Descontos', V('descontos')],
      ['Primeiro pagamento', V('primeiro_pagamento')]
      ] as [string, ReactNode][]).map(([rotulo, valor]) => <Par key={rotulo} rotulo={rotulo} valor={valor} />)}</dl>
      <span className="rotulo-caps">Divisão</span>
      <dl className="dados">{([
      ['Enviado à conta da empresa', V('percentual_escritorio')],
      ...(modulos?.financeiro ? [['Conta de destino', k.conta_destino_id ? (contas ? contas.find(c => c.id === k.conta_destino_id)?.nome ?? 'Conta arquivada' : '…') : 'Escolhida a cada entrada']] : []),
      [k.participantes.length > 1 ? 'Participantes' : 'Participante', percentuaisParticipantes],
      ['Indicador', V('indicador_percentual')],
      ['Responsável', doResponsavel === null ? '—' : <>{fmtPercentual(doResponsavel)} <small className="nota">o restante, se não for sócio</small></>]
      ] as [string, ReactNode][]).map(([rotulo, valor]) => <Par key={rotulo} rotulo={rotulo} valor={valor} />)}</dl>
      {veParcelas && <>
        <span className="rotulo-caps">Parcelas</span>
        <ParcelasDoContrato k={k} versao={versaoHist} aoMudar={() => setVersaoHist(v => v + 1)} />
      </>}
    </Recolhivel>}

    {!oculto && <Recolhivel titulo="Documento e observações" icone="anexo" preferencia="contratos.cartao.documento" contador={quantosPreenchidos([k.documento_url, k.observacoes])}>
      {k.documento_url
        ? <a className="contrato-link" href={k.documento_url} target="_blank" rel="noopener noreferrer">Abrir o contrato no Drive</a>
        : <Nota>Nenhum link do Drive. O contrato assinado fica na pasta do Drive; cole o link em "Atualizar contrato".</Nota>}
      {k.observacoes ? <p className="contrato-obs">{k.observacoes}</p> : <Nota>Nenhuma observação.</Nota>}
    </Recolhivel>}


    {modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="contratos.cartao.tarefas" contador={tarefas} novo={oculto && !semValores ? undefined : { para: '/tarefas/nova/?contrato=' + k.id, rotulo: 'Nova tarefa deste contrato' }}>
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoContrato(k.id)} vazio="Nenhuma tarefa ligada a este contrato." versao={versaoHist} />
      {podeLigar && <AcoesDosLigados novo={{ para: '/tarefas/nova/?contrato=' + k.id, rotulo: 'Nova tarefa' }}>
        <LigarDoModulo modulo="tarefas" filtro={{ sem: 'contratos' }} motivo={t => motivoDeContratoDiferente(t.contrato_da_demanda, k.id, DEMANDA_DE_OUTRO_CONTRATO)}
          aviso="Quem está neste contrato passa a ver, só para ler, a tarefa que você ligar."
          aoEscolher={t => ligarEAvisar(() => ligarNoItem('contrato da tarefa', t.id, k.id),
            { feito: `Tarefa ligada: ${t.titulo}.`, oQue: 'ligação da tarefa', ja: 'Esta tarefa já estava ligada a este contrato.' }, depoisDeLigar)} />
      </AcoesDosLigados>}
    </Recolhivel>}

    {/* Na coluna da direita da janela no centro (ao lado e na janela estreita, aqui embaixo), na ordem: comentários, anotações e
        histórico (#360). A escolha de deixar o histórico aberto tem chave nova (".coluna."): na coluna, ele começa recolhido. */}
    <NaColunaDoCartao>
      <SecaoComentarios modulo="contratos" cartaoId={k.id} aviso={oculto ? undefined : 'Quem você mencionar passa a ver este contrato, com os valores, enquanto a menção existir.'} />
      <AnotacoesDoCartao modulo="contratos" id={k.id} somenteLer={!!k.arquivado_em || !(podeAlterar || semValores)} />
      {!oculto && <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="contratos.coluna.historico" contador={historico}>
        <HistoricoContrato id={k.id} versao={versaoHist} />
      </Recolhivel>}
    </NaColunaDoCartao>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(k.criado_em)}{k.criado_por ? ' por ' + nomeDe(k.criado_por) : ''}</span>
      <span>Atualizado {relativo(k.atualizado_em)}</span>
    </footer>
    </>}
  </CriarNoCartao>;
}

const Par = ({ rotulo, valor }: { rotulo: string; valor: ReactNode }) => <><dt>{rotulo}</dt><dd>{valor}</dd></>;

// ---------- histórico ----------
function HistoricoContrato({ id, versao }: { id: string; versao: number }) {
  const ctx = useCtx();
  const [hist, setHist] = useState<Historico[] | string | null>(null);
  const nomeDe = (pid: string) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  useEffect(() => {
    let vivo = true;
    SD.contratoHistorico(id).then(h => { if (vivo) setHist(h); }).catch(e => { if (vivo) setHist((e as Error).message); });
    return () => { vivo = false; };
  }, [id, versao]);

  if (hist === null) return <Carregando />;
  if (typeof hist === 'string') return <Aviso tipo="erro">{hist}</Aviso>;
  if (!hist.length) return <Nota>Nenhuma alteração desde o cadastro.</Nota>;
  return <ol className="hist">{hist.map(h => <li key={h.id}>
    <span className="quando">{dataHora(h.em)} · {h.feito_por ? nomeDe(h.feito_por) : 'Sistema'}</span>
    {Object.entries(h.alteracoes).map(([campo, v]) => {
      if (campo === 'arquivado_em') return <div key={campo}>{v.para ? 'Arquivado' : 'Desarquivado'}</div>;
      const de = valorLegivelContrato(campo, v.de), para = valorLegivelContrato(campo, v.para);
      return <div key={campo}><b>{CAMPOS_CONTRATO[campo] || campo}:</b> {de !== '—' && <><span className="de">{de}</span> → </>}{para}</div>;
    })}
  </li>)}</ol>;
}
