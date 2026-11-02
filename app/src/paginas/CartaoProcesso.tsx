// Cartão do processo (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de demanda: no topo, o nome
// e o número; as ações, com a equipe em bolinhas ao lado (responsável e colaboradores), e a situação; depois, cada tópico
// numa seção que recolhe (prazos, andamentos, dados, clientes, tarefas, histórico).
import { Fragment, useCallback, useEffect, useState } from 'react';
import { SD, type CampoDeProcesso, type PessoaResumida, type Processo } from '../dados';
import { linhasDosCampos, nomesNoHistorico, valorNoHistorico } from '../regras/camposDeProcesso';
import { CAMPOS_NO_HISTORICO } from '../regras/andamentos';
import { CAMPOS_PROCESSO, linhasDoProcesso, nomeDoProcesso, SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO, valorLegivelProcesso } from '../regras/processo';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { dataCurta, relativo } from '../ui/util';
import { CartoesLigados } from './CartoesLigados';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import NovoProcesso from './NovoProcesso';
import { AndamentosEPrazos } from './processo/AndamentosEPrazos';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

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

  const carregar = useCallback(() => SD.processoObter(id).then(x => { setP(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  const lerCampos = useCallback(() => SD.processoCampos().then(setCampos).catch(falha), []);
  useEffect(() => { void lerCampos(); }, [lerCampos]);
  // Depois de desfazer: mostra o processo como ficou.
  useMudancas(() => { void carregar(); void lerCampos(); setVersaoHist(v => v + 1); });

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (p === undefined) return <Carregando />;
  if (!p) return <Vazio>Este processo não foi encontrado. Ele pode ter sido excluído, ou você não participa dele.</Vazio>;

  const podeExcluir = !!p.arquivado_em && (p.criado_por === eu || ctx.ehAdmin);
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
  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); void lerCampos(); setVersaoHist(x => x + 1); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">{TIPOS_PROCESSO[p.tipo].nome}</Selo><span className="codigo">{p.codigo}</span>
        {p.orgao && <Selo tipo="arq">{p.orgao}</Selo>}
        {p.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
        <AcoesDoCartao editando={editando} arquivado={!!p.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} />
      </div>
      <h2>{nomeDoProcesso(p)}</h2>
      <p className="demanda-descricao">{p.numero}</p>
    </header>

    {editando ? <NovoProcesso edicao={{ id: p.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={naEquipe(ctx.equipe, p.responsavel_id, 'Responsável')}
        participantes={p.colaboradores.map(c => naEquipe(ctx.equipe, c, 'Colaborador'))} />
    </div>
    {/* A exclusão fica numa linha própria: ao pedir confirmação o botão cresce, e nada sai do lugar. */}
    {p.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Processo arquivado. Se não for mais necessário, pode ser excluído definitivamente.'
        : 'Processo arquivado. Só quem cadastrou este processo ou um administrador pode excluí-lo.'}</span>
      {podeExcluir && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão definitiva" aoConfirmar={excluir}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>}
    </div>}

    <section className="bloco campos">
      <h3><Icone nome="kanban" tam={14} />Situação</h3>
      <select aria-label="Situação do processo" disabled={!!p.arquivado_em} value={p.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
        <option value="">{SEM_SITUACAO_PROCESSO}</option>
        {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
      </select>
    </section>

    <SecaoEtiquetas modulo="processos" id={p.id} somenteLer={!!p.arquivado_em} aoMudar={aoMudar} />

    <AndamentosEPrazos processo={p} aoMudar={() => setVersaoHist(v => v + 1)} />

    <Recolhivel titulo="Dados do processo" icone="processos" preferencia="processos.cartao.dados">
      <dl className="dados">{[...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
    </Recolhivel>

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="processos.cartao.clientes" contador={p.clientes.length}>
      {p.clientes.length ? <ItensLigados itens={p.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a este processo.</Nota>}
    </Recolhivel>

    {ctx.escritorio?.modulos?.demandas && <Recolhivel titulo="Demandas" icone="demandas" preferencia="processos.cartao.demandas">
      <CartoesLigados modulo="demandas" carregar={() => SD.demandasDoProcesso(p.id)} vazio="Nenhuma demanda ligada a este processo." versao={versaoHist} />
    </Recolhivel>}

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="processos.cartao.tarefas">
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoProcesso(p.id)} vazio="Nenhuma tarefa ligada a este processo. Elas nascem das intimações e dos prazos." versao={versaoHist} />
    </Recolhivel>}

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="processos.cartao.historico">
      <HistoricoDoCartao carregar={() => SD.processoHistorico(p.id)} campos={{ ...CAMPOS_PROCESSO, ...CAMPOS_NO_HISTORICO, ...nomesNoHistorico(campos) }} valor={valorNoHistorico(campos, valorLegivelProcesso)} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(p.criado_em)}{p.criado_por ? ' por ' + nomeDe(p.criado_por) : ''}</span>
      <span>Atualizado {relativo(p.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
