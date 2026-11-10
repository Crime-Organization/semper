// Cartão da tarefa (painel ao lado ou janela no centro), no modelo do cartão da demanda: no topo, o título e o prazo em
// destaque; as ações, com a equipe da tarefa em bolinhas ao lado (responsável e participantes), e a situação; depois, cada tópico numa seção que
// recolhe (demanda, pessoas, contrato, comentários, histórico). Logo depois da situação, o cronômetro (TempoNaTarefa).
// A demanda e o contrato ligados aparecem sempre, mas só abrem para quem pode vê-los (os outros veem o código).
import { useCallback, useEffect, useState } from 'react';
import { SD, type PessoaResumida, type Tarefa } from '../dados';
import { useNavigate } from 'react-router';
import { TIPOS_PROCESSO } from '../regras/processo';
import { CAMPOS_TAREFA, motivoSemMencaoNaTarefa, SEM_SITUACAO_TAREFA, valorLegivelTarefa, veATarefa } from '../regras/tarefa';
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
import NovaTarefa from './NovaTarefa';
import { dataCurta, relativo } from '../ui/util';
import { oferecerConcluirDemanda } from './concluirDemanda';
import { SeloDoPrazo } from './Demandas';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ListasDoCartao } from './ListasDoCartao';
import { TempoNaTarefa } from './TempoNaTarefa';

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
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.tarefaObter(id).then(x => { setT(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra a tarefa como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  // Quantas alterações o histórico tem, para o número ao lado do título.
  const historico = useQuantos(() => SD.tarefaHistorico(id), `${id}:${versaoHist}`);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (t === undefined) return <Carregando />;
  if (!t) return <Vazio>Esta tarefa não foi encontrada. Ela pode ter sido excluída, ou você não participa dela.</Vazio>;

  const podeExcluir = !!t.arquivado_em && (t.criado_por === eu || ctx.ehAdmin);
  const podeAlterar = !soLeOCartao(ctx, m => veATarefa(t, m, t.demanda)), veTudo = equipeVeTudo(ctx.escritorio);
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
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = t!.etapa_id || null, ordemDe = t!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.tarefaMover(t!.id, etapa, ordem);
      setT({ ...t!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movida para "${quadro.nomeDe(etapa)}".` : `Tarefa ${SEM_SITUACAO_TAREFA.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.tarefaMover(t!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
      // Relê a tarefa: chegar ou sair da coluna das concluídas muda a data de conclusão (e o resumo do tempo).
      await carregar();
      if (t!.demanda) await oferecerConcluirDemanda(t!.id, etapa, navegar);
    } catch (e) { falha(e); }
  }

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Tarefa</Selo><span className="codigo">{t.codigo}</span>
        <SeloDoPrazo prazo={t.prazo} />
        {t.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {podeAlterar && <AcoesDoCartao editando={editando} arquivado={!!t.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'a tarefa', aoConfirmar: excluir } : undefined} />}
      </div>
      <h2>{t.titulo}</h2>
      {t.descricao && <p className="demanda-descricao">{t.descricao}</p>}
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <select aria-label="Situação da tarefa" disabled={!!t.arquivado_em || !podeAlterar} value={t.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
          <option value="">{SEM_SITUACAO_TAREFA}</option>
          {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
        </select>
      </section>}
    </header>

    {editando ? <NovaTarefa edicao={{ id: t.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={naEquipe(ctx.equipe, t.responsavel_id, 'Responsável')}
        participantes={t.participantes.map(p => naEquipe(ctx.equipe, p, 'Participante'))} />
    </div>
    {!podeAlterar && <Nota>{SO_LEITURA_DO_CARTAO}</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {t.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Tarefa arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Tarefa arquivada. Só quem cadastrou esta tarefa ou um administrador pode excluí-la.'}</span>
    </div>}


    <SecaoEtiquetas modulo="tarefas" id={t.id} somenteLer={!!t.arquivado_em || !podeAlterar} aoMudar={aoMudar} />

    {podeAlterar && <TempoNaTarefa t={t} />}

    <ListasDoCartao modulo="tarefas" id={t.id} somenteLer={!podeAlterar} />

    <Recolhivel titulo="Demanda" icone="demandas" preferencia="tarefas.cartao.demanda" contador={demanda ? 1 : 0}>
      {demanda ? <ItensLigados itens={[demanda]} /> : <Nota>Esta tarefa não faz parte de uma demanda.</Nota>}
    </Recolhivel>

    {t.processo_id && <Recolhivel titulo="Processo" icone="processos" preferencia="tarefas.cartao.processo" contador={1}>
      <ItensLigados itens={[t.processo
        ? { id: 'processo', para: `${TIPOS_PROCESSO[t.processo.tipo].caminho}?id=${t.processo.id}`, codigo: t.processo.codigo, titulo: t.processo.numero, detalhe: 'Processo' }
        : { id: 'processo', titulo: 'Processo ligado', detalhe: 'Você não tem acesso a este processo' }]} />
    </Recolhivel>}

    <Recolhivel titulo="Pessoas" icone="pessoas" preferencia="tarefas.cartao.pessoas" contador={t.pessoas.length}>
      {t.pessoas.length ? <ItensLigados itens={t.pessoas.map(pessoa)} /> : <Nota>Nenhuma pessoa do cadastro ligada a esta tarefa.</Nota>}
    </Recolhivel>

    <Recolhivel titulo="Contrato" icone="contratos" preferencia="tarefas.cartao.contrato" contador={contrato ? 1 : 0}>
      {contrato ? <ItensLigados itens={[contrato]} /> : <Nota>Esta tarefa não está ligada a um contrato.</Nota>}
    </Recolhivel>

    <SecaoComentarios modulo="tarefas" cartaoId={t.id} motivoSemMencao={veTudo ? undefined : motivoSemMencaoNaTarefa(t, t.demanda)} />

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="tarefas.cartao.historico" contador={historico}>
      <HistoricoDoCartao carregar={() => SD.tarefaHistorico(t.id)} campos={CAMPOS_TAREFA} valor={valorLegivelTarefa} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criada em {dataCurta(t.criado_em)}{t.criado_por ? ' por ' + nomeDe(t.criado_por) : ''}</span>
      <span>Atualizada {relativo(t.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
