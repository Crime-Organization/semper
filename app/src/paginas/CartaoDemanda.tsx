// Cartão da demanda (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de contrato: no topo, o
// título e o prazo em destaque; as ações, com a equipe da demanda em bolinhas ao lado (responsável e colaboradores), e
// a situação; depois, cada
// tópico numa seção que recolhe (listas, tarefas, clientes, contrato, comentários, histórico).
// O contrato ligado aparece sempre, mas só abre para quem pode ver o contrato (contrato é controle financeiro).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type Demanda, type PessoaResumida } from '../dados';
import { CAMPOS_DEMANDA, motivoSemMencaoNaDemanda, SEM_SITUACAO_DEMANDA, valorLegivelDemanda, veADemanda } from '../regras/demanda';
import { equipeVeTudo, SO_LEITURA_DO_CARTAO, soLeOCartao } from '../regras/equipeVeTudo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { Aviso, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { SecaoComentarios } from '../ui/Comentarios';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { Recolhivel } from '../ui/Recolhivel';
import { useQuantos } from '../ui/useQuantos';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { useCtx } from '../ui/sessao';
import NovaDemanda from './NovaDemanda';
import { dataCurta, relativo } from '../ui/util';
import { SeloDoLembrete, SeloDoPrazo } from './Demandas';
import { oferecerProcesso } from './concluirDemanda';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ProcessosDaDemanda } from './ProcessosDaDemanda';
import { TarefasDaDemanda } from './TarefasDaDemanda';
import { TempoDaDemanda } from './TempoNaTarefa';
import { ListasDoCartao } from './ListasDoCartao';

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
  const podeAlterar = !soLeOCartao(ctx, m => veADemanda(d, m)), veTudo = equipeVeTudo(ctx.escritorio);
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

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Demanda</Selo><span className="codigo">{d.codigo}</span>
        <SeloDoPrazo prazo={d.prazo} hora={d.prazo_hora} />
        <SeloDoLembrete prazo={d.prazo} lembrete={d.lembrete} />
        {d.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {podeAlterar && <AcoesDoCartao editando={editando} arquivado={!!d.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'a demanda', aoConfirmar: excluir } : undefined} />}
      </div>
      <h2>{d.titulo}</h2>
      {d.descricao && <p className="demanda-descricao">{d.descricao}</p>}
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <select aria-label="Situação da demanda" disabled={!!d.arquivado_em || !podeAlterar} value={d.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
          <option value="">{SEM_SITUACAO_DEMANDA}</option>
          {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
        </select>
      </section>}
    </header>

    {editando ? <NovaDemanda edicao={{ id: d.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={naEquipe(ctx.equipe, d.responsavel_id, 'Responsável')}
        participantes={d.colaboradores.map(c => naEquipe(ctx.equipe, c, 'Colaborador'))} />
    </div>
    {!podeAlterar && <Nota>{SO_LEITURA_DO_CARTAO}</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {d.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Demanda arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Demanda arquivada. Só quem cadastrou esta demanda ou um administrador pode excluí-la.'}</span>
    </div>}


    <SecaoEtiquetas modulo="demandas" id={d.id} somenteLer={!!d.arquivado_em || !podeAlterar} aoMudar={aoMudar} />

    <ListasDoCartao modulo="demandas" id={d.id} somenteLer={!podeAlterar} />

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="demandas.cartao.tarefas" contador={ligados.tarefas}>
      <TarefasDaDemanda demandaId={d.id} versao={versaoHist} somenteLer={!podeAlterar} aoMudar={() => { aoMudar(); void carregar(); setVersaoHist(v => v + 1); }} />
      <TempoDaDemanda demandaId={d.id} versao={versaoHist} />
    </Recolhivel>}

    {ctx.escritorio?.modulos?.processos && <Recolhivel titulo="Processos" icone="processos" preferencia="demandas.cartao.processos" contador={ligados.processos}>
      <ProcessosDaDemanda demandaId={d.id} somenteLer={!!d.arquivado_em || !podeAlterar} versao={versaoHist} />
    </Recolhivel>}

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="demandas.cartao.clientes" contador={d.clientes.length}>
      {d.clientes.length ? <ItensLigados itens={d.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a esta demanda.</Nota>}
    </Recolhivel>

    <Recolhivel titulo="Contrato" icone="contratos" preferencia="demandas.cartao.contrato" contador={contrato ? 1 : 0}>
      {contrato ? <ItensLigados itens={[contrato]} /> : <Nota>Esta demanda não vem de um contrato.</Nota>}
      {d.objeto && d.objeto !== d.titulo && <Nota>Nasceu do objeto do contrato: <b>{d.objeto}</b>.</Nota>}
    </Recolhivel>

    <SecaoComentarios modulo="demandas" cartaoId={d.id} motivoSemMencao={veTudo ? undefined : motivoSemMencaoNaDemanda(d)} />

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="demandas.cartao.historico" contador={historico}>
      <HistoricoDoCartao carregar={() => SD.demandaHistorico(d.id)} campos={CAMPOS_DEMANDA} valor={valorLegivelDemanda} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criada em {dataCurta(d.criado_em)}{d.criado_por ? ' por ' + nomeDe(d.criado_por) : ''}</span>
      <span>Atualizada {relativo(d.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
