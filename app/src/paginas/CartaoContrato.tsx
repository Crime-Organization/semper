// Cartão do contrato (painel lateral), no modelo do cartão de pessoa: no topo, o cliente e os objetos do contrato (o que
// vira demanda), em destaque; as ações e a situação; depois, cada tópico numa seção que recolhe (partes, honorários,
// divisão, documento e observações, histórico), com a escolha de cada usuário guardada. Os campos aparecem, mesmo vazios.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SD, type Contrato, type Historico, type Participacao, type PessoaResumida } from '../dados';
import { CAMPOS_CONTRATO, CATEGORIAS, fmtDinheiro, fmtPercentual, nomesPorExtenso, percentualResponsavel, SEM_SITUACAO, textoDosParticipantes, valorLegivelContrato, valorParcela } from '../regras/contrato';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoLink, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { SecaoComentarios } from '../ui/Comentarios';
import { CartoesLigados } from './CartoesLigados';
import { Icone, type NomeIcone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { Recolhivel } from '../ui/Recolhivel';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { useCtx } from '../ui/sessao';
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
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.contratoObter(id).then(x => { setK(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra o contrato como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (k === undefined) return <Carregando />;
  if (!k) return <Vazio>Este contrato não foi encontrado. Ele pode ter sido excluído.</Vazio>;

  const V = (campo: keyof Contrato) => valorLegivelContrato(campo, k[campo]);
  const podeExcluir = !!k.arquivado_em && (k.criado_por === eu || ctx.ehAdmin);
  const parcela = valorParcela(k.valor, k.entrada, k.parcelas);
  const doResponsavel = percentualResponsavel(k.percentual_escritorio, k.participantes.map(p => p.percentual), k.indicador_percentual);
  // O responsável e os participantes são da equipe (informação interna): ficam num bloco próprio, antes da situação, cada um
  // no quadrinho que abre o cartão da pessoa. As partes são as pessoas de fora do escritório: os clientes, o indicador e
  // participantes de fora que já estavam no contrato antes de o participante ser sempre da equipe.
  const comPercentual = (papel: string, pct: number | null) => pct === null ? papel : `${papel} · ${fmtPercentual(pct)}`;
  const pessoaLigada = (pessoa: PessoaResumida, chave: string, detalhe: string): ItemLigado => ({ id: chave + pessoa.id, para: '/pessoas/?id=' + pessoa.id,
    codigo: pessoa.codigo, titulo: pessoa.nome, detalhe, selo: pessoa.arquivado_em ? 'Arquivada' : undefined });
  const membro = ctx.equipe.find(m => m.id === k.responsavel_id);
  const responsavel: ItemLigado = { id: 'responsavel', para: membro?.pessoa_id ? '/pessoas/?id=' + membro.pessoa_id : undefined,
    titulo: nomeDe(k.responsavel_id), detalhe: 'Advogado responsável · equipe do escritório' };
  const participante = (p: Participacao) => pessoaLigada(p.pessoa, 'participante-', comPercentual('Participante', p.percentual));
  const daEquipe = (p: Participacao) => ctx.equipe.some(m => m.pessoa_id === p.pessoa.id);
  const internos = [responsavel, ...k.participantes.filter(daEquipe).map(participante)];
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
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">{CATEGORIAS[k.categoria]}</Selo><span className="codigo">{k.codigo}</span>
        {k.codigo_antigo && <span className="codigo">antigo: {k.codigo_antigo}</span>}
        {k.arquivado_em && <Selo tipo="arq">Arquivado</Selo>}
      </div>
      <h2>{nomesPorExtenso(k.clientes.map(c => c.nome))}</h2>
      <div className="contrato-objetos-destaque">
        <span className="rotulo-caps" id="objetos-do-contrato">{k.objetos.length > 1 ? 'Objetos do contrato' : 'Objeto do contrato'}</span>
        <ol aria-labelledby="objetos-do-contrato">{k.objetos.map(o => <li key={o}>{o}</li>)}</ol>
      </div>
    </header>

    <div className="cartao-acoes">
      <BotaoLink variante="principal" pequeno to={'/contratos/novo/?id=' + k.id}><Icone nome="editar" tam={15} /> Atualizar contrato</BotaoLink>
      <Botao pequeno className="acao-arquivar" title={k.arquivado_em ? 'Desarquivar' : 'Arquivar'} aria-label={k.arquivado_em ? 'Desarquivar' : 'Arquivar'} onClick={arquivar}>
        <Icone nome="arquivo" tam={15} /><span className="acao-rotulo">{k.arquivado_em ? 'Desarquivar' : 'Arquivar'}</span>
      </Botao>
    </div>
    {/* A exclusão fica numa linha própria: ao pedir confirmação o botão cresce, e nada sai do lugar. */}
    {k.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Contrato arquivado. Se não for mais necessário, pode ser excluído definitivamente. Se for o último contrato do ano, o número dele volta a ser usado.'
        : 'Contrato arquivado. Só quem cadastrou este contrato ou um administrador pode excluí-lo.'}</span>
      {podeExcluir && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão definitiva" aoConfirmar={excluir}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>}
    </div>}

    <section className="bloco">
      <h3><Icone nome="conta" tam={14} />{internos.length > 1 ? 'Responsável e participantes' : 'Responsável'}</h3>
      <ItensLigados itens={internos} />
    </section>

    <section className="bloco campos">
      <h3><Icone nome="kanban" tam={14} />Situação</h3>
      <select aria-label="Situação do contrato" disabled={!!k.arquivado_em} value={k.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
        <option value="">{SEM_SITUACAO}</option>
        {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
      </select>
    </section>

    <Recolhivel titulo="Partes" icone="pessoas" preferencia="contratos.cartao.partes">
      <ItensLigados itens={partes} />
    </Recolhivel>

    <Dados titulo="Honorários" icone="dinheiro" preferencia="contratos.cartao.honorarios" linhas={[
      ['Categoria', V('categoria')],
      ['Valor do contrato', V('valor')],
      ['Entrada', V('entrada')],
      ['Parcelas', V('parcelas')],
      ['Valor da parcela', parcela === null ? '—' : <>{fmtDinheiro(parcela)} <small className="nota">{k.entrada ? 'depois da entrada' : 'calculado'}</small></>],
      ['Descontos', V('descontos')],
      ['Assinado em', V('assinado_em')],
      ['Primeiro pagamento', V('primeiro_pagamento')]
    ]} />

    <Dados titulo="Divisão" icone="divisao" preferencia="contratos.cartao.divisao" linhas={[
      ['Enviado ao escritório', V('percentual_escritorio')],
      [k.participantes.length > 1 ? 'Participantes' : 'Participante', percentuaisParticipantes],
      ['Indicador', V('indicador_percentual')],
      ['Responsável', doResponsavel === null ? '—' : <>{fmtPercentual(doResponsavel)} <small className="nota">o restante</small></>]
    ]} />

    <Recolhivel titulo="Documento e observações" icone="anexo" preferencia="contratos.cartao.documento">
      {k.documento_url
        ? <a className="contrato-link" href={k.documento_url} target="_blank" rel="noopener noreferrer">Abrir o contrato no Drive</a>
        : <Nota>Nenhum link do Drive. O contrato assinado fica na pasta do Drive; cole o link em "Atualizar contrato".</Nota>}
      {k.observacoes ? <p className="contrato-obs">{k.observacoes}</p> : <Nota>Nenhuma observação.</Nota>}
    </Recolhivel>

    {ctx.escritorio?.modulos?.demandas && <Recolhivel titulo="Demandas" icone="demandas" preferencia="contratos.cartao.demandas">
      <CartoesLigados modulo="demandas" carregar={() => SD.demandasDoContrato(k.id)} vazio="Nenhuma demanda ainda. Elas nascem quando o contrato chega à coluna do contrato assinado."
        nova={{ para: '/demandas/nova/?contrato=' + k.id, rotulo: 'Nova demanda deste contrato' }} versao={versaoHist} />
    </Recolhivel>}

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="contratos.cartao.tarefas">
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDoContrato(k.id)} vazio="Nenhuma tarefa ligada a este contrato."
        nova={{ para: '/tarefas/nova/?contrato=' + k.id, rotulo: 'Nova tarefa deste contrato' }} />
    </Recolhivel>}

    <SecaoComentarios modulo="contratos" cartaoId={k.id} />

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="contratos.cartao.historico">
      <HistoricoContrato id={k.id} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criado em {dataCurta(k.criado_em)}{k.criado_por ? ' por ' + nomeDe(k.criado_por) : ''}</span>
      <span>Atualizado {relativo(k.atualizado_em)}</span>
    </footer>
  </>;
}

/** Tópico do cartão que recolhe, como em Pessoas; começa recolhido e cada usuário guarda a sua escolha. */
function Dados({ titulo, icone, preferencia, linhas }: { titulo: string; icone: NomeIcone; preferencia: string; linhas: [string, ReactNode][] }) {
  return <Recolhivel titulo={titulo} icone={icone} preferencia={preferencia}>
    <dl className="dados">{linhas.map(([rotulo, valor]) => <Par key={rotulo} rotulo={rotulo} valor={valor} />)}</dl>
  </Recolhivel>;
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
