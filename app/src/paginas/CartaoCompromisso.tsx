// Cartão do compromisso (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de processo: no topo, o tipo,
// o nome e a data; as ações, com a equipe em bolinhas, e a situação; depois, cada tópico numa seção que recolhe. Quem só vê o
// compromisso pela Agenda geral lê tudo e comenta, mas não muda nada.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { SD, type Compromisso, type PessoaResumida } from '../dados';
import { CAMPOS_COMPROMISSO, linhasDoCompromisso, motivoSemMencaoNoCompromisso, nomeDoCompromisso, podeMudarCompromisso, quandoDoCompromisso, SEM_SITUACAO_COMPROMISSO, TIPOS_COMPROMISSO, valorLegivelCompromisso } from '../regras/compromisso';
import { equipeEditaTudo } from '../regras/equipeVeTudo';
import { nomeDoProcesso, TIPOS_PROCESSO } from '../regras/processo';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { SecaoComentarios } from '../ui/Comentarios';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { Recolhivel } from '../ui/Recolhivel';
import { useQuantos } from '../ui/useQuantos';
import { quantosPreenchidos } from '../regras/secoes';
import { useCtx } from '../ui/sessao';
import { dataCurta, relativo } from '../ui/util';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import NovoCompromisso from './NovoCompromisso';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a agenda, a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoCompromisso({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [c, setC] = useState<Compromisso | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.compromissoObter(id).then(x => { setC(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra o compromisso como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  // Quantas alterações o histórico tem, para o número ao lado do título.
  const historico = useQuantos(() => SD.compromissoHistorico(id), `${id}:${versaoHist}`);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (c === undefined) return <Carregando />;
  if (!c) return <Vazio>Este compromisso não foi encontrado. Ele pode ter sido excluído, ou você não participa dele.</Vazio>;

  const podeMudar = equipeEditaTudo(ctx.escritorio) || podeMudarCompromisso(c, eu, ctx.ehAdmin);
  const podeExcluir = !!c.arquivado_em && (c.criado_por === eu || ctx.ehAdmin);
  const somenteLer = !!c.arquivado_em || !podeMudar;
  const doProcesso = TIPOS_COMPROMISSO[c.tipo].doProcesso;
  const pessoa = (p: PessoaResumida): ItemLigado => ({ id: 'pessoa-' + p.id, para: '/pessoas/?id=' + p.id, codigo: p.codigo, titulo: p.nome, detalhe: 'Ligada', selo: p.arquivado_em ? 'Arquivada' : undefined });
  const processo: ItemLigado | null = c.processo
    ? { id: 'processo', para: TIPOS_PROCESSO[c.processo.tipo].caminho + '?id=' + c.processo.id, codigo: c.processo.codigo, titulo: nomeDoProcesso(c.processo), detalhe: `${TIPOS_PROCESSO[c.processo.tipo].nome} · ${c.processo.numero}` }
    : c.processo_codigo ? { id: 'processo', codigo: c.processo_codigo, titulo: c.processo_numero || 'Processo ligado', detalhe: 'Você não tem acesso a este processo' } : null;

  async function arquivar() {
    const estava = !!c!.arquivado_em;
    try {
      await SD.compromissosArquivar([c!.id], !estava);
      feito(estava ? 'Compromisso desarquivado.' : 'Compromisso arquivado. Arquivados podem ser excluídos depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.compromissosArquivar([c!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.compromissosExcluir([c!.id]);
    if (r.excluidas) { avisar('Compromisso excluído definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = c!.etapa_id || null, ordemDe = c!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.compromissoMover(c!.id, etapa, ordem);
      setC({ ...c!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movido para "${quadro.nomeDe(etapa)}".` : `Compromisso ${SEM_SITUACAO_COMPROMISSO.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.compromissoMover(c!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">{TIPOS_COMPROMISSO[c.tipo].nome}</Selo><span className="codigo">{c.codigo}</span>
        {c.geral && <Selo>Agenda geral</Selo>}
        {c.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
        {podeMudar && <AcoesDoCartao editando={editando} arquivado={!!c.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'o compromisso', aoConfirmar: excluir } : undefined} />}
      </div>
      <h2>{nomeDoCompromisso(c)}</h2>
      <p className="cartao-quando">{quandoDoCompromisso(c)}</p>
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <select aria-label="Situação do compromisso" disabled={somenteLer} value={c.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
          <option value="">{SEM_SITUACAO_COMPROMISSO}</option>
          {quadro.colunas.map(x => <option key={x.id} value={x.id}>{x.nome}{x.oculta ? ' (oculta para você)' : ''}</option>)}
        </select>
      </section>}
    </header>

    {editando ? <NovoCompromisso edicao={{ id: c.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={naEquipe(ctx.equipe, c.responsavel_id, 'Responsável')}
        participantes={c.participantes.map(p => naEquipe(ctx.equipe, p, 'Participante'))} />
    </div>
    {!podeMudar && <Nota>Você vê este compromisso porque ele está na Agenda geral. Só quem participa dele pode mudá-lo.</Nota>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {c.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Compromisso arquivado. Se não for mais necessário, pode ser excluído definitivamente.'
        : 'Compromisso arquivado. Só quem cadastrou este compromisso ou um administrador pode excluí-lo.'}</span>
    </div>}


    <SecaoEtiquetas modulo="compromissos" id={c.id} somenteLer={somenteLer} aoMudar={aoMudar} />

    <Recolhivel titulo="Dados do compromisso" icone="calendario" preferencia="compromissos.cartao.dados" contador={quantosPreenchidos(linhasDoCompromisso(c).map(([, v]) => v))}>
      <dl className="dados">{linhasDoCompromisso(c).map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
    </Recolhivel>

    {doProcesso && <Recolhivel titulo="Resultado" icone="check" preferencia="compromissos.cartao.resultado" contador={c.resultado ? 1 : 0}>
      {c.resultado ? <p className="demanda-descricao">{c.resultado}</p> : <Nota>Ainda sem resultado. Depois do compromisso, registre aqui pelo lápis do cartão.</Nota>}
    </Recolhivel>}

    <Recolhivel titulo="Processo" icone="processos" preferencia="compromissos.cartao.processo" contador={processo ? 1 : 0}>
      {processo ? <ItensLigados itens={[processo]} /> : <Nota>Este compromisso não está ligado a um processo.</Nota>}
    </Recolhivel>

    <Recolhivel titulo="Pessoas" icone="pessoas" preferencia="compromissos.cartao.pessoas" contador={c.pessoas.length}>
      {c.pessoas.length ? <ItensLigados itens={c.pessoas.map(pessoa)} /> : <Nota>Nenhuma pessoa do cadastro ligada a este compromisso.</Nota>}
    </Recolhivel>

    <SecaoComentarios modulo="compromissos" cartaoId={c.id} motivoSemMencao={equipeEditaTudo(ctx.escritorio) ? undefined : motivoSemMencaoNoCompromisso(c, c.processo)} />

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="compromissos.cartao.historico" contador={historico}>
      <HistoricoDoCartao carregar={() => SD.compromissoHistorico(c.id)} campos={CAMPOS_COMPROMISSO} valor={valorLegivelCompromisso} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(c.criado_em)}{c.criado_por ? ' por ' + nomeDe(c.criado_por) : ''}</span>
      <span>Atualizado {relativo(c.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
