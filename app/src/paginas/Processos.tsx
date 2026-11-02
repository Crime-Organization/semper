// Processos: um quadro para os judiciais e outro para os administrativos, cada um com as suas colunas e grupos. Tabela
// com ações em lote, quadro e o cartão de cada processo. A estrutura da página vem de <PaginaModulo>; o modelo é o
// módulo Pessoas. O órgão aparece como um selo neutro acima do nome do cartão, fora da lista de etiquetas.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SD, type FiltroProcessos, type Ordem, type Pagina, type ProcessoLista, type TipoProcesso } from '../dados';
import { POR_COLUNA, POR_PAGINA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import { SEM_FASE } from '../regras/painelProcessos';
import { nomeDoProcesso, SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO } from '../regras/processo';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, registrarDesfazer, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Selo, Vazio } from '../ui/base';
import { EtiquetasDoItem, EtiquetasEmLote, filtroDeEtiqueta, useEtiquetasDaPagina } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { PainelCartao } from '../ui/PainelCartao';
import { PaginaModulo, type Visao } from '../ui/PaginaModulo';
import { Paginacao } from '../ui/Paginacao';
import { SecaoArquivados } from '../ui/SecaoArquivados';
import { lerPreferencia, salvarPreferencia } from '../ui/preferencias';
import { moverNoArquivo } from '../ui/quadro/arquivo';
import { Kanban } from '../ui/quadro/Kanban';
import { useColunas } from '../ui/quadro/useColunas';
import { useCtx } from '../ui/sessao';
import { dataDaOrdem, useOrdem } from '../ui/ordem';
import { useCartaoNaUrl } from '../ui/useCartaoNaUrl';
import { useSelecao, type Selecao } from '../ui/useSelecao';
import { dataCurta, numero, relativo, useTitulo } from '../ui/util';
import { CartaoProcesso } from './CartaoProcesso';
import './Contratos.css';
import './Demandas.css';
import './Processos.css';

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
/** Comarca e vara, quando há. */
const localDoProcesso = (p: Pick<ProcessoLista, 'comarca' | 'vara'>) => [p.vara, p.comarca].filter(Boolean).join(' · ');

export default function Processos({ tipo }: { tipo: TipoProcesso }) {
  const { titulo, quadro: moduloDoQuadro } = TIPOS_PROCESSO[tipo];
  useTitulo(titulo);
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const quadro = useColunas(moduloDoQuadro, ctx, SEM_SITUACAO_PROCESSO);
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  const selecao = useSelecao();

  const [params] = useSearchParams();
  const [f, setF] = useState<FiltroProcessos>(() => {
    // Vindo de um número do painel, o filtro é o do painel, e não a última escolha da pessoa.
    const etapa = params.get('etapa') ?? '';
    let pessoa = etapa ? params.get('pessoa') ?? '' : lerPreferencia('processos.pessoa', '');
    if (pessoa && !ctx.equipe.some(m => m.id === pessoa)) pessoa = '';
    return { tipo, termo: '', pessoa, orgao: '', etapa, situacao: 'ativos', pagina: 0 };
  });
  const [visao, setVisao] = useState<Visao>(() => lerPreferencia<Visao>('processos.visao', 'kanban') === 'tabela' ? 'tabela' : 'kanban');
  // Ordem da tabela (mudar volta para a primeira página). No quadro, cada coluna tem a sua, no menu da coluna.
  const ordem = useOrdem('processos', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<ProcessoLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');
  const [orgaos, setOrgaos] = useState<string[]>([]);

  // Processo desfeito no formulário depois de salvo: fecha o cartão do processo que deixou de existir.
  useMudancas(d => {
    recarregar();
    if (d.tipo === 'processoCriado' && d.id === aberto) fechar();
  });

  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.processosListar({ ...f, ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [visao, f, ordem.valor, recarga]);

  // Os campos do filtro que mudam as contagens (a página da tabela não muda).
  const { termo, pessoa, orgao, etiqueta, etapa } = f;
  const filtroDasContagens = useMemo(() => ({ tipo, termo, pessoa, orgao, etiqueta, etapa }), [tipo, termo, pessoa, orgao, etiqueta, etapa]);

  // No quadro, o total vem de uma contagem à parte (cada coluna carrega só o começo da lista).
  const [totalQuadro, setTotalQuadro] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'kanban') return;
    let vivo = true;
    SD.processosListar({ ...filtroDasContagens, situacao: 'ativos', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalQuadro(r.total); }).catch(() => {});
    return () => { vivo = false; };
  }, [visao, filtroDasContagens, recarga]);

  // Quantos arquivados há: aparece na seção "Arquivados" embaixo da tabela, mesmo fechada.
  const [totalArquivados, setTotalArquivados] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.processosListar({ ...filtroDasContagens, situacao: 'arquivados', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivados(r.total); }).catch(() => {});
    return () => { vivo = false; };
  }, [visao, filtroDasContagens, recarga]);
  const arquivados = (pagina: number, porPagina: number) => SD.processosListar({ ...f, situacao: 'arquivados', ordem: 'recentes', pagina, porPagina });

  // Os órgãos do filtro: os que aparecem nos processos deste quadro.
  useEffect(() => {
    let vivo = true;
    SD.processoSugestoes(tipo).then(s => { if (vivo) setOrgaos(s.orgaos); }).catch(() => {});
    return () => { vivo = false; };
  }, [tipo, recarga]);

  const filtrado = !!(f.termo || f.pessoa || f.orgao || f.etiqueta || f.etapa);
  const mudarFiltro = (campos: Partial<FiltroProcessos>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };
  const etiquetas = useEtiquetasDaPagina(f.etiqueta, () => mudarFiltro({ etiqueta: '' }));

  function trocarVisao(v: Visao) {
    setVisao(v);
    salvarPreferencia('processos.visao', v);
    selecao.limpar();
  }
  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.processosArquivar(lista, true);
      feito(`${plural(q, 'processo arquivado', 'processos arquivados')}.`, `arquivamento de ${plural(q, 'processo', 'processos')}`, async () => { await SD.processosArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }

  const n = selecao.quantas;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionado' : 'selecionados'} <button type="button" className={estiloBotao({ forma: 'link' })} style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <EtiquetasEmLote modulo="processos" ids={[...selecao.selecionadas]} />
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const chaveDaLista = [recarga, f.termo, f.pessoa, f.orgao, f.etiqueta].join('|');
  const total = visao === 'kanban' ? totalQuadro : tabela?.total ?? null;
  const contador = total === null ? null : plural(total, 'ativo', 'ativos');
  const cadastro = '/processos/novo/?tipo=' + tipo;
  // O órgão escolhido continua na lista mesmo que o último processo dele tenha saído.
  const orgaosDoFiltro = f.orgao && !orgaos.includes(f.orgao) ? [...orgaos, f.orgao] : orgaos;

  return <>
    <PaginaModulo titulo={titulo} contador={contador} acao={{ rotulo: 'Novo processo', para: cadastro }}
      busca={{ placeholder: 'Buscar número, cliente, nome, comarca, código…', aoBuscar: t => mudarFiltro({ termo: t }) }}
      filtros={[
        { id: 'pessoa', rotulo: 'Pessoa da equipe', valor: f.pessoa || '',
          aoMudar: p => { mudarFiltro({ pessoa: p }); salvarPreferencia('processos.pessoa', p); },
          opcoes: [['', 'Todos os processos'], [eu, 'Comigo (responsável ou colaborador)'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        ...(orgaosDoFiltro.length ? [{ id: 'orgao', rotulo: 'Órgão', valor: f.orgao || '', aoMudar: (o: string) => mudarFiltro({ orgao: o }),
          opcoes: [['', 'Todos os órgãos'], ...orgaosDoFiltro.map(o => [o, o] as [string, string])] as [string, string][] }] : []),
        { id: 'etapa', rotulo: 'Situação', valor: f.etapa || '', aoMudar: (e: string) => mudarFiltro({ etapa: e }),
          opcoes: [['', 'Todas as situações'], ...quadro.colunas.map(c => [c.id, c.nome] as [string, string]), [SEM_FASE, SEM_SITUACAO_PROCESSO]] as [string, string][] },
        ...filtroDeEtiqueta(etiquetas, f.etiqueta, e => mudarFiltro({ etiqueta: e }))
      ]}
      ordem={visao === 'tabela' ? ordenacao : undefined}
      visao={visao} aoTrocarVisao={trocarVisao} lote={lote}>
      {visao === 'kanban'
        ? <Kanban<ProcessoLista> quadro={quadro}
          recarga={chaveDaLista}
          carregar={(colunaId, deslocamento, ordemDaColuna) => SD.processosDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativos' }, deslocamento, POR_COLUNA)}
          ordemDe={p => p.etapa_ordem}
          arquivados={deslocamento => arquivados(Math.floor(deslocamento / POR_COLUNA), POR_COLUNA)}
          cartao={(p, ordemDaColuna) => <CartaoKanban p={p} ordem={ordemDaColuna} />}
          endereco={p => endereco(p.id)}
          aoAbrir={p => abrir(p.id)}
          aoMover={async (p, m) => {
            const noArquivo = { arquivar: (ids: string[], a: boolean) => SD.processosArquivar(ids, a), mover: (id: string, etapa: string | null, ordemNova: number | null) => SD.processoMover(id, etapa, ordemNova) };
            if (await moverNoArquivo(p.codigo, p.id, m, noArquivo, id => quadro.nomeDe(id) || SEM_SITUACAO_PROCESSO)) { recarregar(); return; }
            const { de, para, ordem: ordemNova, ordemAnterior } = m;
            await SD.processoMover(p.id, para, ordemNova);
            const voltar = async () => { await SD.processoMover(p.id, de, ordemAnterior); };
            if (de !== para) feito(`${p.codigo} foi para "${quadro.nomeDe(para) || SEM_SITUACAO_PROCESSO}".`, 'movimentação do cartão', voltar);
            else registrarDesfazer('mudança de posição do cartão', voltar);
          }}
          aoAdicionar={colunaId => navegar(cadastro + (colunaId ? '&etapa=' + colunaId : ''))} />
        : <>
          <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} situacao={quadro.nomeDe} cadastro={cadastro}
            endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
          <SecaoArquivados<ProcessoLista> modulo="processos" nome={{ um: 'processo', varios: 'processos', feminino: false }} total={totalArquivados}
            versao={chaveDaLista} aoMudar={recarregar} listar={pagina => arquivados(pagina, POR_PAGINA)}
            arquivar={(ids, a) => SD.processosArquivar(ids, a)} excluir={ids => SD.processosExcluir(ids)}
            tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivados', pagina: numeroDaPagina }} ordem="recentes"
              filtrado={filtrado} selecao={sel} situacao={quadro.nomeDe} cadastro={cadastro} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </>}
    </PaginaModulo>
    {aberto && <PainelCartao aoFechar={fechar}>
      <CartaoProcesso key={aberto} id={aberto} quadro={quadro} aoMudar={recarregar} aoFechar={fechar} />
    </PainelCartao>}
  </>;
}

function CartaoKanban({ p, ordem }: { p: ProcessoLista; ordem: Ordem }) {
  const ctx = useCtx();
  const data = dataDaOrdem(ordem, p), local = localDoProcesso(p);
  return <>
    <EtiquetasDoItem etq={p.etq} modulo="processos" id={p.id} somenteLer={!!p.arquivado_em} />
    {p.orgao && <div><Selo tipo="arq">{p.orgao}</Selo></div>}
    <div className="kt">{nomeDoProcesso(p)}</div>
    <div className="km">
      <span className="codigo">{p.numero}</span>
      {p.titulo && p.cliente_nome && <span>{clientesPorExtenso(p.cliente_nome)}</span>}
      {local && <span>{local}</span>}
      {data && <span>{data}</span>}
    </div>
    <div className="kp"><Avatares ids={[p.responsavel_id, ...p.colaboradores]} equipe={ctx.equipe} tam={24} /></div>
  </>;
}

interface PropsTabela {
  pagina: Pagina<ProcessoLista> | null;
  erro: string;
  f: FiltroProcessos;
  ordem: Ordem;
  filtrado: boolean;
  selecao: Selecao;
  situacao: (id: string | null) => string;
  cadastro: string;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, ordem, filtrado, selecao, situacao, cadastro, endereco, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhum processo encontrado com esses filtros.'
    : f.situacao === 'arquivados' ? 'Nenhum processo arquivado.'
    : <>Nenhum processo ainda. <BotaoLink forma="link" to={cadastro}>Cadastre o primeiro</BotaoLink>.</>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const todas = linhas.every(p => selecionadas.has(p.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  return <div>
    <div className="tabela tabela-processos"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todas} onChange={e => marcar(linhas.map(p => p.id), e.target.checked)} /></th>
        <th scope="col">Processo</th><th scope="col">Órgão</th><th scope="col">Situação</th><th scope="col">Pessoas</th>
        <th scope="col">{porCadastro ? 'Criado' : 'Atualizado'}</th>
      </tr></thead>
      <tbody>{linhas.map(p => <LinhaQueAbre key={p.id} para={endereco(p.id)} aoAbrir={() => aoAbrir(p.id)} marcada={selecionadas.has(p.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${p.codigo}`} checked={selecionadas.has(p.id)} onChange={e => marcar([p.id], e.target.checked)} /></td>
        <td><EtiquetasDoItem etq={p.etq} modulo="processos" id={p.id} somenteLer={!!p.arquivado_em} /><NomeDaLinha>{nomeDoProcesso(p)}</NomeDaLinha>
          <div className="sub"><span className="codigo">{p.numero}</span>{p.titulo && p.cliente_nome ? ' · ' + clientesPorExtenso(p.cliente_nome) : ''}{localDoProcesso(p) ? ' · ' + localDoProcesso(p) : ''}</div></td>
        <td>{p.orgao ? <Selo tipo="arq">{p.orgao}</Selo> : <span className="nota">—</span>}</td>
        <td><span className="etapa-txt">{situacao(p.etapa_id)}</span></td>
        <td><Avatares ids={[p.responsavel_id, ...p.colaboradores]} equipe={ctx.equipe} /></td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{porCadastro ? dataCurta(p.criado_em) : relativo(p.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
