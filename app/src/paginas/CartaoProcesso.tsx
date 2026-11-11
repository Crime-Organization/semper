// Cartão do processo (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de demanda: no topo, o nome
// e o número; as ações, com a equipe em bolinhas ao lado (responsável e colaboradores), e a situação; depois, cada tópico
// numa seção que recolhe (prazos, andamentos, dados, clientes, tarefas, histórico).
import { Fragment, useCallback, useEffect, useState } from 'react';
import { SD, type ComoEntrarNoProcesso, type CampoDeProcesso, type PessoaResumida, type Processo } from '../dados';
import { linhasDosCampos, nomesNoHistorico, valorNoHistorico } from '../regras/camposDeProcesso';
import { CAMPOS_NO_HISTORICO } from '../regras/andamentos';
import { advogadoNaAdaptacao, SO_LEITURA_DO_PROCESSO, SEM_COMPROMISSO_VISIVEL, SO_LEITURA_DO_PROCESSO_ADVOGADO, soLeOCartao } from '../regras/equipeVeTudo';
import { alteraOProcesso, CAMPOS_PROCESSO, linhasDoProcesso, nomeDoProcesso, SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO, valorLegivelProcesso } from '../regras/processo';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { Recolhivel } from '../ui/Recolhivel';
import { useLista, useQuantos } from '../ui/useQuantos';
import { ContratosDoProcesso } from './ContratosDoProcesso';
import { quantosPreenchidos } from '../regras/secoes';
import { useCtx } from '../ui/sessao';
import { dataCurta, relativo } from '../ui/util';
import { CartoesLigados } from './CartoesLigados';
import { CompromissosLigados } from './CompromissosLigados';
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

/** O que a tela confirma depois de a pessoa entrar no processo. */
const ENTRADA_NO_PROCESSO: Record<ComoEntrarNoProcesso, string> = {
  colaborador: 'Você entrou neste processo como colaborador.',
  responsavel: 'Você agora é o responsável por este processo. Quem era responsável continua como colaborador.'
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

  const carregar = useCallback(() => SD.processoObter(id).then(x => { setP(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  const lerCampos = useCallback(() => SD.processoCampos().then(setCampos).catch(falha), []);
  useEffect(() => { void lerCampos(); }, [lerCampos]);
  // Depois de desfazer: mostra o processo como ficou.
  useMudancas(() => { void carregar(); void lerCampos(); setVersaoHist(v => v + 1); });

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
  const podeAlterar = !soLeOCartao(ctx, m => alteraOProcesso(p, m));
  const advogado = advogadoNaAdaptacao(ctx), podeEntrar = advogado && !alteraOProcesso(p, ctx.perfil) && !p.arquivado_em;
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
        {podeAlterar && <AcoesDoCartao editando={editando} arquivado={!!p.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} excluir={podeExcluir ? { oQue: 'o processo', aoConfirmar: excluir } : undefined} />}
      </div>
      <h2>{nomeDoProcesso(p)}</h2>
      <p className="demanda-descricao">{p.numero}</p>
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <select aria-label="Situação do processo" disabled={!!p.arquivado_em || !podeAlterar} value={p.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
          <option value="">{SEM_SITUACAO_PROCESSO}</option>
          {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
        </select>
      </section>}
    </header>

    {editando ? <NovoProcesso edicao={{ id: p.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={naEquipe(ctx.equipe, p.responsavel_id, 'Responsável')}
        participantes={p.colaboradores.map(c => naEquipe(ctx.equipe, c, 'Colaborador'))} />
    </div>
    {!podeAlterar && <Nota>{podeEntrar ? SO_LEITURA_DO_PROCESSO_ADVOGADO : SO_LEITURA_DO_PROCESSO}</Nota>}
    {podeEntrar && <div className="cartao-acoes">
      <Botao pequeno onClick={() => entrar('colaborador')}>Entrar como colaborador</Botao>
      <BotaoDuplo pequeno confirmar="Confirmar: assumir como responsável" aoConfirmar={() => entrar('responsavel')}>Assumir como responsável</BotaoDuplo>
    </div>}
    {/* A faixa só explica: a exclusão fica na lixeira, no topo do cartão. */}
    {p.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Processo arquivado. Se não for mais necessário, pode ser excluído definitivamente.'
        : 'Processo arquivado. Só quem cadastrou este processo ou um administrador pode excluí-lo.'}</span>
    </div>}


    <SecaoEtiquetas modulo="processos" id={p.id} somenteLer={!!p.arquivado_em || !podeAlterar} aoMudar={aoMudar} />

    <AndamentosEPrazos processo={p} soLeitura={!podeAlterar} aoMudar={() => setVersaoHist(v => v + 1)} />

    <Recolhivel titulo="Dados do processo" icone="processos" preferencia="processos.cartao.dados" contador={quantosPreenchidos([...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([, v]) => v))}>
      <dl className="dados">{[...linhasDoProcesso(p), ...linhasDosCampos(campos, p.tipo, p.campos)].map(([rotulo, valor]) => <Fragment key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></Fragment>)}</dl>
    </Recolhivel>

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="processos.cartao.clientes" contador={p.clientes.length}>
      {p.clientes.length ? <ItensLigados itens={p.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a este processo.</Nota>}
    </Recolhivel>

    {ctx.escritorio?.modulos?.demandas && <Recolhivel titulo="Demandas" icone="demandas" preferencia="processos.cartao.demandas" contador={quantos.demandas}>
      <CartoesLigados modulo="demandas" carregar={() => SD.demandasDoProcesso(p.id)} vazio="Nenhuma demanda ligada a este processo que você possa abrir." versao={versaoHist} />
    </Recolhivel>}

    {modulos?.contratos && <Recolhivel titulo="Contratos" icone="contratos" preferencia="processos.cartao.contratos"
      contador={quantos.contratos ? quantos.contratos.visiveis.length + quantos.contratos.ocultos : undefined}>
      <ContratosDoProcesso processoId={p.id} versao={versaoHist} />
    </Recolhivel>}

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="processos.cartao.tarefas" contador={quantos.tarefas}>
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoProcesso(p.id)} vazio="Nenhuma tarefa ligada a este processo. Elas nascem das intimações e dos prazos." versao={versaoHist} />
    </Recolhivel>}

    {ctx.escritorio?.modulos?.compromissos && <Recolhivel titulo="Compromissos" icone="calendario" preferencia="processos.cartao.compromissos" contador={quantos.compromissos} novo={podeAlterar || advogado ? { para: '/agenda/novo/?processo=' + p.id, rotulo: 'Nova audiência ou compromisso deste processo' } : undefined}>
      <CompromissosLigados key={String(podeAlterar)} carregar={() => SD.compromissosDoProcesso(p.id)} vazio={podeAlterar ? 'Nenhum compromisso ligado a este processo.' : SEM_COMPROMISSO_VISIVEL} />
    </Recolhivel>}

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="processos.cartao.historico" contador={quantos.historico}>
      <HistoricoDoCartao carregar={() => SD.processoHistorico(p.id)} campos={{ ...CAMPOS_PROCESSO, ...CAMPOS_NO_HISTORICO, ...nomesNoHistorico(campos) }} valor={valorNoHistorico(campos, valorLegivelProcesso)} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(p.criado_em)}{p.criado_por ? ' por ' + nomeDe(p.criado_por) : ''}</span>
      <span>Atualizado {relativo(p.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}
