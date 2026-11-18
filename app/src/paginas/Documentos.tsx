// Documentos (#303): as anotações do escritório, em Markdown, cada uma ligada a pessoas, processos, contratos, demandas,
// tarefas e compromissos. Uma tabela com busca, filtros (a que está ligada, quem escreveu, quando) e ações em lote, e o
// cartão de cada anotação. A estrutura da página vem de <PaginaModulo>; o modelo são Compromissos e Contratos.
import { useEffect, useMemo, useState } from 'react';
import { SD, type AnotacaoLista, type FiltroAnotacoes, type ModuloDaAnotacao, type Ordem, type Pagina } from '../dados';
import { POR_PAGINA } from '../dados/limites';
import { desdeDoPeriodo, ITEM_DA_ANOTACAO, MODULOS_DA_ANOTACAO, PERIODOS_DA_ANOTACAO, type PeriodoDaAnotacao } from '../regras/anotacao';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { useOrdem } from '../ui/ordem';
import { PaginaModulo, type Filtro } from '../ui/PaginaModulo';
import { PainelCartao } from '../ui/PainelCartao';
import { Paginacao } from '../ui/Paginacao';
import { SecaoArquivados } from '../ui/SecaoArquivados';
import { useCtx } from '../ui/sessao';
import { useCartaoNaUrl } from '../ui/useCartaoNaUrl';
import { useSelecao, type Selecao } from '../ui/useSelecao';
import { dataCurta, hojeISO, relativo, useTitulo } from '../ui/util';
import { CADASTRO_DE_ANOTACAO } from './AnotacoesDoCartao';
import { CartaoAnotacao } from './CartaoAnotacao';
import { plural } from './importarPessoas/textos';
import './Documentos.css';

/** O filtro da página: o da camada de dados, com o período no lugar da data (a data sai do período a cada leitura). */
type FiltroDaPagina = Omit<FiltroAnotacoes, 'desde' | 'ordem'> & { periodo: PeriodoDaAnotacao };
const paraOBanco = ({ periodo, ...f }: FiltroDaPagina): FiltroAnotacoes => ({ ...f, desde: desdeDoPeriodo(periodo, hojeISO()) });
/** Os módulos ligados de uma anotação, pelo nome no plural e na ordem do filtro ("Pessoas, Demandas"). */
const ligadaA = (modulos: ModuloDaAnotacao[]) => MODULOS_DA_ANOTACAO.filter(m => modulos.includes(m)).map(m => ITEM_DA_ANOTACAO[m].plural).join(', ');

export default function Documentos() {
  useTitulo('Documentos');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  const selecao = useSelecao();

  const [f, setF] = useState<FiltroDaPagina>({ termo: '', ligadaA: undefined, autor: '', periodo: '', situacao: 'ativas', pagina: 0 });
  // Ordem da tabela (mudar volta para a primeira página).
  const ordem = useOrdem('anotacoes', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<AnotacaoLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // Anotação desfeita depois de salva: fecha o cartão da que deixou de existir.
  useMudancas(d => {
    recarregar();
    if (d.tipo === 'anotacaoCriada' && d.id === aberto) fechar();
  });

  useEffect(() => {
    let vivo = true;
    SD.anotacoesListar({ ...paraOBanco(f), ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [f, ordem.valor, recarga]);

  // Quantas arquivadas há, com os mesmos filtros: aparece na seção "Arquivadas", mesmo fechada.
  const { termo, ligadaA: ligada, autor, periodo } = f;
  const filtroDasArquivadas = useMemo(() => paraOBanco({ termo, ligadaA: ligada, autor, periodo, situacao: 'arquivadas' }), [termo, ligada, autor, periodo]);
  const [totalArquivadas, setTotalArquivadas] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.anotacoesListar({ ...filtroDasArquivadas, pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivadas(r.total); }).catch(() => {});
    return () => { vivo = false; };
  }, [filtroDasArquivadas, recarga]);
  const arquivadas = (pagina: number) => SD.anotacoesListar({ ...filtroDasArquivadas, ordem: 'recentes', pagina, porPagina: POR_PAGINA });

  const filtrado = !!(f.termo || f.ligadaA || f.autor || f.periodo);
  const mudarFiltro = (campos: Partial<FiltroDaPagina>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };

  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.anotacoesArquivar(lista, true);
      feito(`${plural(q, 'anotação arquivada', 'anotações arquivadas')}.`, `arquivamento de ${plural(q, 'anotação', 'anotações')}`, async () => { await SD.anotacoesArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }
  const n = selecao.quantas;
  const lote = n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionada' : 'selecionadas'} <button type="button" className={estiloBotao({ forma: 'link' }) + ' lote-limpar'} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const filtros: Filtro[] = [
    { id: 'ligada', rotulo: 'Ligada a', valor: f.ligadaA || '', aoMudar: v => mudarFiltro({ ligadaA: (v || undefined) as FiltroAnotacoes['ligadaA'] }),
      opcoes: [['', 'Qualquer item'], ...MODULOS_DA_ANOTACAO.map(m => [m, ITEM_DA_ANOTACAO[m].plural] as [string, string]), ['nenhum', 'Nenhum item']] },
    { id: 'autor', rotulo: 'Autor', valor: f.autor || '', aoMudar: v => mudarFiltro({ autor: v }),
      opcoes: [['', 'Qualquer pessoa'], [eu, 'Eu'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
    { id: 'periodo', rotulo: 'Data', valor: f.periodo, aoMudar: v => mudarFiltro({ periodo: v as PeriodoDaAnotacao }),
      opcoes: (Object.keys(PERIODOS_DA_ANOTACAO) as PeriodoDaAnotacao[]).map(p => [p, PERIODOS_DA_ANOTACAO[p].rotulo] as [string, string]) }
  ];
  const contador = tabela ? plural(tabela.total, 'ativa', 'ativas') : null;

  return <>
    <PaginaModulo titulo="Documentos" contador={contador} acao={{ rotulo: 'Nova anotação', para: CADASTRO_DE_ANOTACAO }}
      busca={{ placeholder: 'Buscar título, texto, código…', aoBuscar: t => mudarFiltro({ termo: t }) }}
      filtros={filtros} ordem={ordenacao} visoes={[]} lote={lote}>
      <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao}
        endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
      <SecaoArquivados<AnotacaoLista> modulo="anotacoes" nome={{ um: 'anotação', varios: 'anotações', feminino: true }} total={totalArquivadas}
        versao={[recarga, termo, ligada, autor, periodo].join('|')} aoMudar={recarregar} listar={arquivadas}
        arquivar={(ids, a) => SD.anotacoesArquivar(ids, a)} excluir={ids => SD.anotacoesExcluir(ids)}
        tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivadas', pagina: numeroDaPagina }} ordem="recentes"
          filtrado={filtrado} selecao={sel} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
    </PaginaModulo>
    {/* A anotação é um texto próprio, sem comentários; e, para ler e escrever, a janela no centro ocupa quase toda a tela (#340). */}
    {aberto && <PainelCartao aoFechar={fechar} semColuna largo>
      <CartaoAnotacao key={aberto} id={aberto} aoMudar={recarregar} aoFechar={fechar} />
    </PainelCartao>}
  </>;
}

interface PropsTabela {
  pagina: Pagina<AnotacaoLista> | null;
  erro: string;
  f: FiltroDaPagina;
  ordem: Ordem;
  filtrado: boolean;
  selecao: Selecao;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, ordem, filtrado, selecao, endereco, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhuma anotação encontrada com esses filtros.'
    : f.situacao === 'arquivadas' ? 'Nenhuma anotação arquivada.'
    : <>Nenhuma anotação ainda. <BotaoLink forma="link" to={CADASTRO_DE_ANOTACAO}>Escreva a primeira</BotaoLink>.</>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const todas = linhas.every(a => selecionadas.has(a.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || '—';
  return <div>
    <div className="tabela tabela-anotacoes"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todas} onChange={e => marcar(linhas.map(a => a.id), e.target.checked)} /></th>
        <th scope="col">Título</th><th scope="col">Ligada a</th><th scope="col">Autor</th><th scope="col">Equipe</th><th scope="col">{porCadastro ? 'Criada' : 'Atualizada'}</th>
      </tr></thead>
      <tbody>{linhas.map(a => <LinhaQueAbre key={a.id} para={endereco(a.id)} aoAbrir={() => aoAbrir(a.id)} marcada={selecionadas.has(a.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${a.codigo}`} checked={selecionadas.has(a.id)} onChange={e => marcar([a.id], e.target.checked)} /></td>
        <td><NomeDaLinha>{a.titulo}</NomeDaLinha><div className="sub"><span className="codigo">{a.codigo}</span></div></td>
        <td className={a.ligada_a.length ? undefined : 'anotacao-sem-ligacao'}>{a.ligada_a.length ? ligadaA(a.ligada_a) : 'Nenhum item'}</td>
        <td>{nomeDe(a.criado_por)}</td>
        <td><Avatares ids={[a.responsavel_id, ...a.participantes]} equipe={ctx.equipe} /></td>
        <td className="anotacao-data">{porCadastro ? dataCurta(a.criado_em) : relativo(a.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
