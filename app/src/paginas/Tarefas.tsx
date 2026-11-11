// Tarefas: as partes menores do trabalho (ex.: "Emitir a GRU", numa demanda de registro de marca), com responsável,
// participantes, prazo e, se houver, a demanda, o contrato e as pessoas a que se ligam. Tabela com ações em lote,
// quadro (Para fazer, Fazendo, Aguardando retorno, Concluída) e o cartão de cada uma. A estrutura da página vem de
// <PaginaModulo>; o modelo é o módulo Pessoas, e a página é irmã da de Demandas.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type FiltroTarefas, type Ordem, type Pagina, type TarefaLista } from '../dados';
import { POR_COLUNA, POR_PAGINA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import { soLeOCartao } from '../regras/equipeVeTudo';
import { SEM_SITUACAO_TAREFA, soLeATarefaNaLista } from '../regras/tarefa';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, registrarDesfazer, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { PainelCartao } from '../ui/PainelCartao';
import { EtiquetasDoItem, EtiquetasEmLote, filtroDeEtiqueta, useEtiquetasDaPagina } from '../ui/Etiquetas';
import { PaginaModulo, type Visao } from '../ui/PaginaModulo';
import { Paginacao } from '../ui/Paginacao';
import { SecaoArquivados } from '../ui/SecaoArquivados';
import { lerPreferencia, salvarPreferencia } from '../ui/preferencias';
import { moverNoArquivo } from '../ui/quadro/arquivo';
import { Kanban } from '../ui/quadro/Kanban';
import { colunaComMarco } from '../regras/quadro';
import { useColunas } from '../ui/quadro/useColunas';
import { useCtx } from '../ui/sessao';
import { dataDaOrdem, useOrdem } from '../ui/ordem';
import { useCartaoNaUrl } from '../ui/useCartaoNaUrl';
import { useSelecao, type Selecao } from '../ui/useSelecao';
import { dataCurta, numero, relativo, useTitulo } from '../ui/util';
import { CartaoTarefa } from './CartaoTarefa';
import { oferecerConcluirDemanda } from './concluirDemanda';
import { SeloDoPrazo, type SeloConcluido } from './Demandas';
import './Contratos.css';
import './Demandas.css';

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
/** O código e as ligações da tarefa numa linha: "C0FFEE12 · demanda D3A1F09C · contrato MA96-0001-2026". */
const ligacoes = (t: TarefaLista) =>
  [t.demanda_codigo && 'demanda ' + t.demanda_codigo, t.contrato_codigo && 'contrato ' + t.contrato_codigo].filter(Boolean).join(' · ');

export default function Tarefas() {
  useTitulo('Tarefas');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const quadro = useColunas('tarefas', ctx, SEM_SITUACAO_TAREFA);
  // O módulo, se o cartão está na coluna das concluídas; null enquanto as colunas não chegaram (sem selo, para não piscar "vencido").
  const concluido = (etapa: string | null) => !quadro.pronto ? null : colunaComMarco(quadro.colunas, etapa, 'concluido') && ('tarefas' as const);
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  const selecao = useSelecao();

  const [f, setF] = useState<FiltroTarefas>(() => {
    let pessoa = lerPreferencia('tarefas.pessoa', '');
    if (pessoa && !ctx.equipe.some(m => m.id === pessoa)) pessoa = '';
    return { termo: '', pessoa, situacao: 'ativas', pagina: 0 };
  });
  const [visao, setVisao] = useState<Visao>(() => lerPreferencia<Visao>('tarefas.visao', 'kanban') === 'tabela' ? 'tabela' : 'kanban');
  // Ordem da tabela (mudar volta para a primeira página). No quadro, cada coluna tem a sua, no menu da coluna.
  const ordem = useOrdem('tarefas', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<TarefaLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // Tarefa desfeita no formulário depois de salva: fecha o cartão da tarefa que deixou de existir.
  useMudancas(t => {
    recarregar();
    if (t.tipo === 'tarefaCriada' && t.id === aberto) fechar();
  });

  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.tarefasListar({ ...f, ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [visao, f, ordem.valor, f.etiqueta, recarga]);

  // No quadro, o total vem de uma contagem à parte (cada coluna carrega só o começo da lista).
  const [totalQuadro, setTotalQuadro] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'kanban') return;
    let vivo = true;
    SD.tarefasListar({ ...f, situacao: 'ativas', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalQuadro(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.pessoa, f.etiqueta, recarga]);

  // Quantos arquivados há: aparece na seção "Arquivados" embaixo da tabela, mesmo fechada.
  const [totalArquivadas, setTotalArquivadas] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.tarefasListar({ ...f, situacao: 'arquivadas', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivadas(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.pessoa, f.etiqueta, recarga]);
  const arquivadas = (pagina: number, porPagina: number) => SD.tarefasListar({ ...f, situacao: 'arquivadas', ordem: 'recentes', pagina, porPagina });

  const filtrado = !!(f.termo || f.pessoa || f.etiqueta);
  const mudarFiltro = (campos: Partial<FiltroTarefas>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };
  const etiquetas = useEtiquetasDaPagina(f.etiqueta, () => mudarFiltro({ etiqueta: '' }));

  function trocarVisao(v: Visao) {
    setVisao(v);
    salvarPreferencia('tarefas.visao', v);
    selecao.limpar();
  }
  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.tarefasArquivar(lista, true);
      const quantas = q === 1 ? '1 tarefa' : q + ' tarefas';
      feito(`${plural(q, 'tarefa arquivada', 'tarefas arquivadas')}.`, `arquivamento de ${quantas}`, async () => { await SD.tarefasArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }

  const n = selecao.quantas;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionada' : 'selecionadas'} <button type="button" className={estiloBotao({ forma: 'link' })} style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <EtiquetasEmLote modulo="tarefas" ids={[...selecao.selecionadas]} />
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const chaveDaLista = [recarga, f.termo, f.pessoa, f.etiqueta].join('|');
  const total = visao === 'kanban' ? totalQuadro : tabela?.total ?? null;
  const contador = total === null ? null : plural(total, 'ativa', 'ativas');

  return <>
    <PaginaModulo titulo="Tarefas" contador={contador} acao={{ rotulo: 'Nova tarefa', para: '/tarefas/nova/' }}
      busca={{ placeholder: 'Buscar título, pessoa, código, demanda…', aoBuscar: termo => mudarFiltro({ termo }) }}
      filtros={[
        { id: 'pessoa', rotulo: 'Pessoa da equipe', valor: f.pessoa || '',
          aoMudar: pessoa => { mudarFiltro({ pessoa }); salvarPreferencia('tarefas.pessoa', pessoa); },
          opcoes: [['', 'Todas as tarefas'], [eu, 'Comigo (responsável ou participante)'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        ...filtroDeEtiqueta(etiquetas, f.etiqueta, etiqueta => mudarFiltro({ etiqueta }))
      ]}
      ordem={visao === 'tabela' ? ordenacao : undefined}
      mais={[{ rotulo: 'Meu tempo trabalhado', icone: 'relogio', aoEscolher: () => navegar('/tarefas/meu-tempo/') }]}
      visao={visao} aoTrocarVisao={trocarVisao} lote={lote}>
      {visao === 'kanban'
        ? <Kanban<TarefaLista> quadro={quadro} podeArrastar={t => !soLeOCartao(ctx, m => !soLeATarefaNaLista(t, m))}
          recarga={chaveDaLista}
          carregar={(colunaId, deslocamento, ordemDaColuna) => SD.tarefasDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativas' }, deslocamento, 30)}
          ordemDe={t => t.etapa_ordem}
          arquivados={deslocamento => arquivadas(Math.floor(deslocamento / POR_COLUNA), POR_COLUNA)}
          cartao={(t, ordemDaColuna, coluna) => <CartaoKanban t={t} ordem={ordemDaColuna} concluido={concluido(coluna)} />}
          endereco={t => endereco(t.id)}
          aoAbrir={t => abrir(t.id)}
          aoMover={async (t, m) => {
            const noArquivo = { arquivar: (ids: string[], a: boolean) => SD.tarefasArquivar(ids, a), mover: (id: string, etapa: string | null, ordem: number | null) => SD.tarefaMover(id, etapa, ordem) };
            if (await moverNoArquivo(t.codigo, t.id, m, noArquivo, id => quadro.nomeDe(id) || SEM_SITUACAO_TAREFA)) { recarregar(); return; }
            const { de, para, ordem, ordemAnterior } = m;
            await SD.tarefaMover(t.id, para, ordem);
            const voltar = async () => { await SD.tarefaMover(t.id, de, ordemAnterior); };
            if (de !== para) feito(`${t.codigo} foi para "${quadro.nomeDe(para) || SEM_SITUACAO_TAREFA}".`, 'movimentação do cartão', voltar);
            else registrarDesfazer('mudança de posição do cartão', voltar);
            if (de !== para && t.demanda_codigo) void oferecerConcluirDemanda(t.id, para, navegar);
          }}
          aoAdicionar={colunaId => navegar('/tarefas/nova/' + (colunaId ? '?etapa=' + colunaId : ''))} />
        : <>
          <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} situacao={quadro.nomeDe} concluido={concluido}
          endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
          <SecaoArquivados<TarefaLista> modulo="tarefas" nome={{ um: 'tarefa', varios: 'tarefas', feminino: true }} total={totalArquivadas}
            versao={chaveDaLista} aoMudar={recarregar} listar={pagina => arquivadas(pagina, POR_PAGINA)}
            arquivar={(ids, a) => SD.tarefasArquivar(ids, a)} excluir={ids => SD.tarefasExcluir(ids)}
            tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivadas', pagina: numeroDaPagina }} ordem="recentes"
              filtrado={filtrado} selecao={sel} situacao={quadro.nomeDe} concluido={concluido} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </>}
    </PaginaModulo>
    {aberto && <PainelCartao aoFechar={fechar}>
      <CartaoTarefa key={aberto} id={aberto} quadro={quadro} aoMudar={recarregar} aoFechar={fechar} />
    </PainelCartao>}
  </>;
}

function CartaoKanban({ t, ordem, concluido }: { t: TarefaLista; ordem: Ordem; concluido: SeloConcluido }) {
  const ctx = useCtx();
  const data = dataDaOrdem(ordem, t);
  return <>
    <EtiquetasDoItem etq={t.etq} modulo="tarefas" id={t.id} somenteLer={!!t.arquivado_em || soLeOCartao(ctx, m => !soLeATarefaNaLista(t, m))} />
    <div className="kt">{t.titulo}</div>
    <div className="km">
      <span className="codigo">{[t.codigo, ligacoes(t)].filter(Boolean).join(' · ')}</span>
      {t.pessoa_nome && <span>{clientesPorExtenso(t.pessoa_nome)}</span>}
      <SeloDoPrazo prazo={t.prazo} hora={t.prazo_hora} concluido={concluido} />
      {data && <span>{data}</span>}
    </div>
    <div className="kp"><Avatares ids={[t.responsavel_id, ...t.participantes]} equipe={ctx.equipe} tam={24} /></div>
  </>;
}

interface PropsTabela {
  pagina: Pagina<TarefaLista> | null;
  erro: string;
  f: FiltroTarefas;
  ordem: Ordem;
  filtrado: boolean;
  selecao: Selecao;
  situacao: (id: string | null) => string;
  /** Se o cartão está na coluna das concluídas (o prazo dele não vence mais). */
  concluido: (id: string | null) => SeloConcluido;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, ordem, filtrado, selecao, situacao, concluido, endereco, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhuma tarefa encontrada com esses filtros.'
    : f.situacao === 'arquivadas' ? 'Nenhuma tarefa arquivada.'
    : <>Nenhuma tarefa ainda. <BotaoLink forma="link" to="/tarefas/nova/">Cadastre a primeira</BotaoLink>, ou crie pelo cartão de uma demanda.</>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const alteraveis = linhas.filter(t => !soLeOCartao(ctx, m => !soLeATarefaNaLista(t, m)));
  const todas = alteraveis.length > 0 && alteraveis.every(t => selecionadas.has(t.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  return <div>
    <div className="tabela tabela-demandas"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todas desta página" checked={todas} onChange={e => marcar(alteraveis.map(t => t.id), e.target.checked)} /></th>
        <th scope="col">Tarefa</th><th scope="col">Prazo</th><th scope="col">Situação</th><th scope="col">Pessoas</th>
        <th scope="col">{porCadastro ? 'Criada' : 'Atualizada'}</th>
      </tr></thead>
      <tbody>{linhas.map(t => <LinhaQueAbre key={t.id} para={endereco(t.id)} aoAbrir={() => aoAbrir(t.id)} marcada={selecionadas.has(t.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${t.codigo}`} checked={selecionadas.has(t.id)} disabled={!alteraveis.includes(t)} onChange={e => marcar([t.id], e.target.checked)} /></td>
        <td><EtiquetasDoItem etq={t.etq} modulo="tarefas" id={t.id} somenteLer={!!t.arquivado_em || soLeOCartao(ctx, m => !soLeATarefaNaLista(t, m))} /><NomeDaLinha>{t.titulo}</NomeDaLinha>
          <div className="sub"><span className="codigo">{t.codigo}</span>{t.pessoa_nome ? ' · ' + clientesPorExtenso(t.pessoa_nome) : ''}{ligacoes(t) ? ' · ' + ligacoes(t) : ''}</div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{t.prazo ? <SeloDoPrazo prazo={t.prazo} hora={t.prazo_hora} concluido={concluido(t.etapa_id)} /> : <span className="nota">—</span>}</td>
        <td><span className="etapa-txt">{situacao(t.etapa_id)}</span></td>
        <td><Avatares ids={[t.responsavel_id, ...t.participantes]} equipe={ctx.equipe} /></td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{porCadastro ? dataCurta(t.criado_em) : relativo(t.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
