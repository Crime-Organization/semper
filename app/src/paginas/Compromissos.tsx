// Compromissos: a agenda do escritório. Três formas de ver os mesmos compromissos: por data (dia, semana e mês), tabela com
// ações em lote e quadro por situação, além do cartão de cada um. A estrutura da página vem de <PaginaModulo>; o modelo é o
// módulo Pessoas.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type CompromissoLista, type FiltroCompromissos, type Ordem, type OrdemCompromisso, type Pagina, type TipoCompromisso } from '../dados';
import { POR_COLUNA, POR_PAGINA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import { nomeDoCompromisso, quandoDoCompromisso, SEM_SITUACAO_COMPROMISSO, soLeNaLista, TIPOS, TIPOS_COMPROMISSO } from '../regras/compromisso';
import { equipeEditaTudo } from '../regras/equipeVeTudo';
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
import { dataDaOrdem, ORDENS } from '../ui/ordem';
import { useCartaoNaUrl } from '../ui/useCartaoNaUrl';
import { useSelecao, type Selecao } from '../ui/useSelecao';
import { numero, useTitulo } from '../ui/util';
import { VisaoPorData } from './agenda/VisaoPorData';
import { CartaoCompromisso } from './CartaoCompromisso';
import './Contratos.css';
import './Demandas.css';
import './Compromissos.css';

const CADASTRO = '/agenda/novo/';
const VISOES_DA_AGENDA: Visao[] = ['agenda', 'tabela', 'kanban'];
/** As ordens da tabela: a data do compromisso, a mais adiante primeiro, é a padrão (a primeira da lista). */
const ORDENS_DA_TABELA: [OrdemCompromisso, string][] = [
  ['data_desc', 'Data (a mais adiante primeiro)'], ['data', 'Data (a mais antiga primeiro)'],
  ...(['nome', 'nome_desc', 'novos', 'antigos', 'recentes'] as const).map(o => [o, ORDENS[o]] as [OrdemCompromisso, string])
];
const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;

export default function Compromissos() {
  useTitulo('Agenda');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const quadro = useColunas('compromissos', ctx, SEM_SITUACAO_COMPROMISSO);
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  const selecao = useSelecao();

  const [f, setF] = useState<FiltroCompromissos>(() => {
    let pessoa = lerPreferencia('compromissos.pessoa', '');
    if (pessoa && !ctx.equipe.some(m => m.id === pessoa)) pessoa = '';
    return { termo: '', pessoa, tipo: '', situacao: 'ativos', pagina: 0 };
  });
  const [visao, setVisao] = useState<Visao>(() => { const v = lerPreferencia<Visao>('compromissos.visao', 'agenda'); return VISOES_DA_AGENDA.includes(v) ? v : 'agenda'; });
  const [ordem, setOrdem] = useState<OrdemCompromisso>(() => { const o = lerPreferencia<OrdemCompromisso>('compromissos.ordem.tabela', 'data_desc'); return ORDENS_DA_TABELA.some(([v]) => v === o) ? o : 'data_desc'; });
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<CompromissoLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // Compromisso desfeito no formulário depois de salvo: fecha o cartão do que deixou de existir.
  useMudancas(d => {
    recarregar();
    if (d.tipo === 'compromissoCriado' && d.id === aberto) fechar();
  });

  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.compromissosListar({ ...f, ordem, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [visao, f, ordem, recarga]);

  // Os campos do filtro que mudam as contagens (a página da tabela não muda).
  const { termo, pessoa, tipo, etiqueta } = f;
  const filtroDasContagens = useMemo(() => ({ termo, pessoa, tipo, etiqueta }), [termo, pessoa, tipo, etiqueta]);

  // Fora da tabela, o total vem de uma contagem à parte (o quadro e a agenda mostram só um pedaço da lista).
  const [totalAtivos, setTotalAtivos] = useState<number | null>(null);
  useEffect(() => {
    if (visao === 'tabela') return;
    let vivo = true;
    SD.compromissosListar({ ...filtroDasContagens, situacao: 'ativos', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalAtivos(r.total); }).catch(() => {});
    return () => { vivo = false; };
  }, [visao, filtroDasContagens, recarga]);

  // Quantos arquivados há: aparece na seção "Arquivados" embaixo da tabela, mesmo fechada.
  const [totalArquivados, setTotalArquivados] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.compromissosListar({ ...filtroDasContagens, situacao: 'arquivados', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivados(r.total); }).catch(() => {});
    return () => { vivo = false; };
  }, [visao, filtroDasContagens, recarga]);
  const arquivados = (pagina: number, porPagina: number) => SD.compromissosListar({ ...f, situacao: 'arquivados', ordem: 'recentes', pagina, porPagina });

  const filtrado = !!(f.termo || f.pessoa || f.tipo || f.etiqueta);
  const mudarFiltro = (campos: Partial<FiltroCompromissos>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };
  const etiquetas = useEtiquetasDaPagina(f.etiqueta, () => mudarFiltro({ etiqueta: '' }));

  function trocarVisao(v: Visao) {
    setVisao(v);
    salvarPreferencia('compromissos.visao', v);
    selecao.limpar();
  }
  function mudarOrdem(o: OrdemCompromisso) {
    setOrdem(o);
    salvarPreferencia('compromissos.ordem.tabela', o);
    setF(atual => ({ ...atual, pagina: 0 }));
  }
  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.compromissosArquivar(lista, true);
      feito(`${plural(q, 'compromisso arquivado', 'compromissos arquivados')}.`, `arquivamento de ${plural(q, 'compromisso', 'compromissos')}`, async () => { await SD.compromissosArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }

  const n = selecao.quantas;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionado' : 'selecionados'} <button type="button" className={estiloBotao({ forma: 'link' })} style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <EtiquetasEmLote modulo="compromissos" ids={[...selecao.selecionadas]} />
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const chaveDaLista = [recarga, f.termo, f.pessoa, f.tipo, f.etiqueta].join('|');
  const total = visao === 'tabela' ? tabela?.total ?? null : totalAtivos;
  const contador = total === null ? null : plural(total, 'ativo', 'ativos');

  return <>
    <PaginaModulo titulo="Agenda" contador={contador} acao={{ rotulo: 'Novo compromisso', para: CADASTRO }}
      busca={{ placeholder: 'Buscar título, pessoa, local, processo, código…', aoBuscar: t => mudarFiltro({ termo: t }) }}
      filtros={[
        { id: 'pessoa', rotulo: 'Pessoa da equipe', valor: f.pessoa || '',
          aoMudar: p => { mudarFiltro({ pessoa: p }); salvarPreferencia('compromissos.pessoa', p); },
          opcoes: [['', 'Todos os compromissos'], [eu, 'Comigo (responsável ou participante)'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        { id: 'tipo', rotulo: 'Tipo', valor: f.tipo || '', aoMudar: t => mudarFiltro({ tipo: t as TipoCompromisso | '' }),
          opcoes: [['', 'Todos os tipos'], ...TIPOS.map(t => [t, TIPOS_COMPROMISSO[t].nome] as [string, string])] },
        ...filtroDeEtiqueta(etiquetas, f.etiqueta, e => mudarFiltro({ etiqueta: e })),
        ...(visao === 'tabela' ? [{ id: 'ordem', rotulo: 'Ordenar', valor: ordem, aoMudar: (o: string) => mudarOrdem(o as OrdemCompromisso), opcoes: ORDENS_DA_TABELA }] : [])
      ]}
      visoes={VISOES_DA_AGENDA} visao={visao} aoTrocarVisao={trocarVisao} lote={lote}>
      {visao === 'agenda' && <VisaoPorData filtro={f} recarga={chaveDaLista} situacao={quadro.nomeDe} endereco={endereco} aoAbrir={abrir} />}
      {visao === 'kanban' && <Kanban<CompromissoLista> quadro={quadro}
        recarga={chaveDaLista}
        carregar={(colunaId, deslocamento, ordemDaColuna) => SD.compromissosDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativos' }, deslocamento, POR_COLUNA)}
        ordemDe={c => c.etapa_ordem}
        arquivados={deslocamento => arquivados(Math.floor(deslocamento / POR_COLUNA), POR_COLUNA)}
        cartao={(c, ordemDaColuna) => <CartaoKanban c={c} ordem={ordemDaColuna} />}
        endereco={c => endereco(c.id)}
        aoAbrir={c => abrir(c.id)}
        aoMover={async (c, m) => {
          const noArquivo = { arquivar: (ids: string[], a: boolean) => SD.compromissosArquivar(ids, a), mover: (id: string, etapa: string | null, ordemNova: number | null) => SD.compromissoMover(id, etapa, ordemNova) };
          if (await moverNoArquivo(c.codigo, c.id, m, noArquivo, id => quadro.nomeDe(id) || SEM_SITUACAO_COMPROMISSO)) { recarregar(); return; }
          const { de, para, ordem: ordemNova, ordemAnterior } = m;
          await SD.compromissoMover(c.id, para, ordemNova);
          const voltar = async () => { await SD.compromissoMover(c.id, de, ordemAnterior); };
          if (de !== para) feito(`${c.codigo} foi para "${quadro.nomeDe(para) || SEM_SITUACAO_COMPROMISSO}".`, 'movimentação do cartão', voltar);
          else registrarDesfazer('mudança de posição do cartão', voltar);
        }}
        aoAdicionar={colunaId => navegar(CADASTRO + (colunaId ? '?etapa=' + colunaId : ''))} />}
      {visao === 'tabela' && <>
        <Tabela pagina={tabela} erro={erroTabela} f={f} filtrado={filtrado} selecao={selecao} situacao={quadro.nomeDe}
          endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
        <SecaoArquivados<CompromissoLista> modulo="compromissos" nome={{ um: 'compromisso', varios: 'compromissos', feminino: false }} total={totalArquivados}
          versao={chaveDaLista} aoMudar={recarregar} listar={pagina => arquivados(pagina, POR_PAGINA)}
          arquivar={(ids, a) => SD.compromissosArquivar(ids, a)} excluir={ids => SD.compromissosExcluir(ids)}
          tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivados', pagina: numeroDaPagina }}
            filtrado={filtrado} selecao={sel} situacao={quadro.nomeDe} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
      </>}
    </PaginaModulo>
    {aberto && <PainelCartao aoFechar={fechar}>
      <CartaoCompromisso key={aberto} id={aberto} quadro={quadro} aoMudar={recarregar} aoFechar={fechar} />
    </PainelCartao>}
  </>;
}

function CartaoKanban({ c, ordem }: { c: CompromissoLista; ordem: Ordem }) {
  const ctx = useCtx();
  const data = dataDaOrdem(ordem, c);
  return <>
    <EtiquetasDoItem etq={c.etq} modulo="compromissos" id={c.id} somenteLer={!!c.arquivado_em || (soLeNaLista(c, ctx.perfil.id, ctx.ehAdmin) && !equipeEditaTudo(ctx.escritorio))} />
    <div><Selo tipo="arq">{TIPOS_COMPROMISSO[c.tipo].nome}</Selo></div>
    <div className="kt">{nomeDoCompromisso(c)}</div>
    <div className="km">
      <span>{quandoDoCompromisso(c)}</span>
      {c.titulo && c.pessoa_nome && <span>{clientesPorExtenso(c.pessoa_nome)}</span>}
      {c.local && <span>{c.local}</span>}
      {data && <span>{data}</span>}
    </div>
    <div className="kp"><Avatares ids={[c.responsavel_id, ...c.participantes]} equipe={ctx.equipe} tam={24} /></div>
  </>;
}

interface PropsTabela {
  pagina: Pagina<CompromissoLista> | null;
  erro: string;
  f: FiltroCompromissos;
  filtrado: boolean;
  selecao: Selecao;
  situacao: (id: string | null) => string;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, filtrado, selecao, situacao, endereco, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhum compromisso encontrado com esses filtros.'
    : f.situacao === 'arquivados' ? 'Nenhum compromisso arquivado.'
    : <>Nenhum compromisso ainda. <BotaoLink forma="link" to={CADASTRO}>Cadastre o primeiro</BotaoLink>.</>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const todas = linhas.every(c => selecionadas.has(c.id));
  return <div>
    <div className="tabela tabela-compromissos"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todas} onChange={e => marcar(linhas.map(c => c.id), e.target.checked)} /></th>
        <th scope="col">Compromisso</th><th scope="col">Quando</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">Pessoas</th>
      </tr></thead>
      <tbody>{linhas.map(c => <LinhaQueAbre key={c.id} para={endereco(c.id)} aoAbrir={() => aoAbrir(c.id)} marcada={selecionadas.has(c.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${c.codigo}`} checked={selecionadas.has(c.id)} onChange={e => marcar([c.id], e.target.checked)} /></td>
        <td><EtiquetasDoItem etq={c.etq} modulo="compromissos" id={c.id} somenteLer={!!c.arquivado_em || (soLeNaLista(c, ctx.perfil.id, ctx.ehAdmin) && !equipeEditaTudo(ctx.escritorio))} /><NomeDaLinha>{nomeDoCompromisso(c)}</NomeDaLinha>
          <div className="sub"><span className="codigo">{c.codigo}</span>{c.local ? ' · ' + c.local : ''}{c.processo_numero ? ' · ' + c.processo_numero : ''}</div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{quandoDoCompromisso(c)}</td>
        <td><Selo tipo="arq">{TIPOS_COMPROMISSO[c.tipo].nome}</Selo></td>
        <td><span className="etapa-txt">{situacao(c.etapa_id)}</span></td>
        <td><Avatares ids={[c.responsavel_id, ...c.participantes]} equipe={ctx.equipe} /></td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
