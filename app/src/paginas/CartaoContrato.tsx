// Cartão do contrato (painel lateral), no modelo do cartão de pessoa: no topo, os clientes e a situação; as ações, com a
// equipe em bolinhas ao lado; depois as etiquetas e cada tópico numa seção que recolhe, com o número de itens ao lado do
// título (objetos, que abrem as demandas deles, partes, honorários com divisão e parcelas, documento, demandas, tarefas,
// histórico), com a escolha de cada usuário guardada. Os campos aparecem, mesmo vazios.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SD, type Contrato, type Historico, type Participacao, type PessoaResumida } from '../dados';
import { objetosDefinidos, objetosEDemandas, CAMPOS_CONTRATO, CATEGORIAS, fmtDinheiro, fmtPercentual, nomesPorExtenso, percentualResponsavel, SEM_SITUACAO, textoDosParticipantes, valorLegivelContrato, valorParcela, alteraOContrato } from '../regras/contrato';
import { SO_LEITURA_DO_CONTRATO } from '../regras/equipeVeTudo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { SecaoEtiquetas } from '../ui/Etiquetas';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { SecaoComentarios } from '../ui/Comentarios';
import { CartoesLigados } from './CartoesLigados';
import { ParcelasDoContrato } from './financeiro/Parcelas';
import { chegouAoAssinado } from '../regras/parcelas';
import './Financeiro.css';
import { EquipeDoCartao, naEquipe } from '../ui/EquipeDoCartao';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { Recolhivel } from '../ui/Recolhivel';
import { useLista, useQuantos } from '../ui/useQuantos';
import { quantosPreenchidos } from '../regras/secoes';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { useCtx } from '../ui/sessao';
import NovoContrato from './NovoContrato';
import { avisarSeAssinadoSemObjeto, SEM_OBJETO_DEFINIDO } from './clienteAoContrato';
import { dataCurta, dataHora, relativo } from '../ui/util';

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
  const oculto = k.ve_financeiro === false;
  const parcela = valorParcela(k.valor, k.entrada, k.parcelas, k.descontos);
  const doResponsavel = percentualResponsavel(k.percentual_escritorio, k.participantes.map(p => p.percentual), k.indicador_percentual);
  // O responsável e os participantes são da equipe (informação interna): ficam em bolinhas ao lado das ações, cada uma com
  // o papel e o link para o cartão da pessoa. As partes são as pessoas de fora do escritório: os clientes, o indicador e
  // participantes de fora que já estavam no contrato antes de o participante ser sempre da equipe.
  const comPercentual = (papel: string, pct: number | null) => pct === null ? papel : `${papel} · ${fmtPercentual(pct)}`;
  const pessoaLigada = (pessoa: PessoaResumida, chave: string, detalhe: string): ItemLigado => ({ id: chave + pessoa.id, para: '/pessoas/?id=' + pessoa.id,
    codigo: pessoa.codigo, titulo: pessoa.nome, detalhe, selo: pessoa.arquivado_em ? 'Arquivada' : undefined });
  const responsavel = naEquipe(ctx.equipe, k.responsavel_id, 'Advogado responsável');
  const participante = (p: Participacao) => pessoaLigada(p.pessoa, 'participante-', comPercentual('Participante', p.percentual));
  const membroDe = (p: Participacao) => ctx.equipe.find(m => m.pessoa_id === p.pessoa.id);
  const daEquipe = (p: Participacao) => !!membroDe(p);
  const participantesDaEquipe = k.participantes.filter(daEquipe).map(p => naEquipe(ctx.equipe, membroDe(p)!.id, comPercentual('Participante', p.percentual)));
  const partes: ItemLigado[] = [
    ...k.clientes.map(c => pessoaLigada(c, 'cliente-', 'Cliente')),
    ...k.participantes.filter(p => !daEquipe(p)).map(participante),
    ...(k.indicador ? [pessoaLigada(k.indicador, 'indicador-', comPercentual('Indicador', k.indicador_percentual))] : [])
  ];
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

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        {!oculto && <Selo tipo="escuro">{CATEGORIAS[k.categoria]}</Selo>}<span className="codigo">{k.codigo}</span>
        {k.codigo_antigo && <span className="codigo">antigo: {k.codigo_antigo}</span>}
        {k.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
        {podeAlterar && <AcoesDoCartao editando={editando} arquivado={!!k.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} />}
      </div>
      <h2>{nomesPorExtenso(k.clientes.map(c => c.nome))}</h2>
      {!editando && <section className="bloco campos cartao-situacao">
        <h3><Icone nome="kanban" tam={14} />Situação</h3>
        <select aria-label="Situação do contrato" disabled={!!k.arquivado_em || !podeAlterar} value={k.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
          <option value="">{SEM_SITUACAO}</option>
          {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
        </select>
      </section>}
    </header>

    {editando ? <NovoContrato edicao={{ id: k.id, aoTerminar: terminarEdicao }} /> : <>

    <div className="cartao-acoes">
      <EquipeDoCartao responsavel={responsavel} participantes={participantesDaEquipe} />
    </div>
    {!podeAlterar && <Nota>{oculto ? SO_LEITURA_DO_CONTRATO : 'Você vê este contrato porque foi mencionado num comentário. Pode ler e comentar, mas não alterar.'}</Nota>}
    {/* A exclusão fica numa linha própria: ao pedir confirmação o botão cresce, e nada sai do lugar. */}
    {k.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Contrato arquivado. Se não for mais necessário, pode ser excluído definitivamente. Se for o último contrato do ano, o número dele volta a ser usado.'
        : 'Contrato arquivado. Só quem cadastrou este contrato ou um administrador pode excluí-lo.'}</span>
      {podeExcluir && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão definitiva" aoConfirmar={excluir}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>}
    </div>}

    <SecaoEtiquetas modulo="contratos" id={k.id} somenteLer={!!k.arquivado_em || oculto} aoMudar={aoMudar} />

    {/* As demandas são os objetos do contrato: cada objeto é a demanda que nasceu dele. O objeto que ainda não virou
        demanda (o contrato não chegou ao assinado) aparece na mesma lista, sem link. */}
    {modulos?.demandas ? <Recolhivel titulo="Demandas" icone="demandas" preferencia="contratos.cartao.demandas" contador={demandas ? demandas.length + objetosSemDemanda.length : undefined} novo={oculto ? undefined : { para: '/demandas/nova/?contrato=' + k.id, rotulo: 'Nova demanda deste contrato' }}>
      {semObjeto && <Aviso tipo="info">{SEM_OBJETO_DEFINIDO}</Aviso>}
      <CartoesLigados modulo="demandas" rotulo="Demandas do contrato" carregar={() => SD.demandasDoContrato(k.id)} vazio="Nenhum objeto cadastrado neste contrato." versao={versaoHist}
        antes={objetosSemDemanda.map((objeto, i) => ({ id: 'objeto-' + i, titulo: objeto, detalhe: 'Objeto do contrato · vira demanda quando o contrato for assinado' }))} />
    </Recolhivel>
    : <Recolhivel titulo={k.objetos.length > 1 ? 'Objetos do contrato' : 'Objeto do contrato'} icone="demandas" preferencia="contratos.cartao.objetos" contador={k.objetos.length}>
      <ItensLigados rotulo="Objetos do contrato" vazio="Nenhum objeto cadastrado." itens={k.objetos.map((objeto, i) => ({ id: 'objeto-' + i, titulo: objeto }))} />
    </Recolhivel>}

    <Recolhivel titulo="Partes" icone="pessoas" preferencia="contratos.cartao.partes" contador={partes.length}>
      <ItensLigados itens={partes} />
    </Recolhivel>

    {/* Honorários, divisão e parcelas juntos: as parcelas são o detalhe do que foi combinado. O número é o de parcelas. */}
    {!oculto && <Recolhivel titulo="Honorários" icone="dinheiro" preferencia="contratos.cartao.honorarios" contador={parcelas}>
      <dl className="dados">{([
      ['Categoria', V('categoria')],
      ['Valor do contrato', V('valor')],
      ['Entrada', V('entrada')],
      ['Parcelas', V('parcelas')],
      ['Valor da parcela', parcela === null ? '—' : <>{fmtDinheiro(parcela)} <small className="nota">{k.entrada ? 'depois da entrada' : 'calculado'}</small></>],
      ['Descontos', V('descontos')],
      ['Assinado em', V('assinado_em')],
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


    {modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="contratos.cartao.tarefas" contador={tarefas} novo={oculto ? undefined : { para: '/tarefas/nova/?contrato=' + k.id, rotulo: 'Nova tarefa deste contrato' }}>
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoContrato(k.id)} vazio="Nenhuma tarefa ligada a este contrato." />
    </Recolhivel>}

    <SecaoComentarios modulo="contratos" cartaoId={k.id} aviso={oculto ? undefined : 'Quem você mencionar passa a ver este contrato, com os valores, enquanto a menção existir.'} />

    {!oculto && <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="contratos.cartao.historico" contador={historico}>
      <HistoricoContrato id={k.id} versao={versaoHist} />
    </Recolhivel>}

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(k.criado_em)}{k.criado_por ? ' por ' + nomeDe(k.criado_por) : ''}</span>
      <span>Atualizado {relativo(k.atualizado_em)}</span>
    </footer>
    </>}
  </>;
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
