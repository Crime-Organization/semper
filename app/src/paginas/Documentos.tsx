// Documentos (#303): as anotações do escritório, em Markdown, cada uma ligada a pessoas, processos, contratos, demandas,
// tarefas e compromissos. Uma tabela com busca, filtros (a que está ligada, quem escreveu, quando) e ações em lote, e o
// cartão de cada anotação. A estrutura da página vem de <PaginaModulo>; o modelo são Compromissos e Contratos.
// Desde a #342, as pastas (como no Obsidian): a árvore ao lado da lista (em tela estreita, um seletor acima dela), e escolher uma
// pasta mostra o que está nela e nas subpastas. A pasta escolhida fica no endereço (?pasta=), para o caminho do cartão levar a
// ela. E o filtro por etiqueta, como nos outros módulos.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { SD, type AnotacaoLista, type FiltroAnotacoes, type ModuloDaAnotacao, type Ordem, type Pagina, type Pasta } from '../dados';
import { POR_PAGINA } from '../dados/limites';
import {
  alteraAAnotacao, desdeDoPeriodo, ITEM_DA_ANOTACAO, MODULOS_DA_ANOTACAO, motivoDaListaVazia, PERIODOS_DA_ANOTACAO, type MotivoDaListaVazia, type PeriodoDaAnotacao
} from '../regras/anotacao';
import { equipeEditaTudo } from '../regras/equipeVeTudo';
import { PARAMETRO_DA_PASTA, pastasDescendentes, textoDoCaminho } from '../regras/pastas';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Vazio } from '../ui/base';
import { EtiquetasDoItem, EtiquetasEmLote, filtroDeEtiqueta, useEtiquetasDaPagina } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { useOrdem } from '../ui/ordem';
import { PaginaModulo, type Filtro } from '../ui/PaginaModulo';
import { PainelCartao } from '../ui/PainelCartao';
import { Paginacao } from '../ui/Paginacao';
import { ArvoreDePastas, SeletorDePasta } from '../ui/Pastas';
import { usePastas, useProcurarPastas } from '../ui/pastasDoEscritorio';
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

  const [f, setF] = useState<FiltroDaPagina>({ termo: '', ligadaA: undefined, autor: '', periodo: '', etiqueta: '', situacao: 'ativas', pagina: 0 });
  // A pasta escolhida vem do endereço; ao abrir a página, a lista das pastas é lida de novo (um colega pode ter mudado).
  const [params, setParams] = useSearchParams();
  const pasta = params.get(PARAMETRO_DA_PASTA);
  // A pasta do endereço que a lista guardada não conhece (criada por um colega) faz ler de novo; até a resposta, a lista é null.
  const pastas = usePastas({ reler: true, precisa: pasta });
  // A lista mostra a pasta e as subpastas dela.
  const chaveDaPasta = pasta ? pastasDescendentes(pastas ?? [], pasta).join() : '';
  const naPasta = useMemo(() => chaveDaPasta ? chaveDaPasta.split(',') : undefined, [chaveDaPasta]);
  const escolherPasta = (id: string | null) => setParams(p => { if (id) p.set(PARAMETRO_DA_PASTA, id); else p.delete(PARAMETRO_DA_PASTA); p.delete('id'); return p; });
  // Outra pasta (pela árvore, pelo caminho do cartão ou pelo Voltar do navegador): a lista volta à primeira página.
  const [pastaVista, setPastaVista] = useState(pasta);
  if (pasta !== pastaVista) { setPastaVista(pasta); setF(atual => ({ ...atual, pagina: 0 })); selecao.limpar(); }
  // A pasta do endereço que não existe mais (apagada, ou de um link antigo) deixa de filtrar.
  const pastaSumiu = !!pasta && pastas !== null && !pastas.some(p => p.id === pasta);
  useEffect(() => { if (pastaSumiu) setParams(p => { p.delete(PARAMETRO_DA_PASTA); return p; }, { replace: true }); }, [pastaSumiu, setParams]);
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
    SD.anotacoesListar({ ...paraOBanco(f), pastas: naPasta, ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [f, ordem.valor, recarga, naPasta]);

  // Quantas arquivadas há, com os mesmos filtros: aparece na seção "Arquivadas", mesmo fechada.
  const { termo, ligadaA: ligada, autor, periodo, etiqueta } = f;
  const filtroDasArquivadas = useMemo(() => ({ ...paraOBanco({ termo, ligadaA: ligada, autor, periodo, etiqueta, situacao: 'arquivadas' }), pastas: naPasta }),
    [termo, ligada, autor, periodo, etiqueta, naPasta]);
  const [totalArquivadas, setTotalArquivadas] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.anotacoesListar({ ...filtroDasArquivadas, pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivadas(r.total); }).catch(() => {});
    return () => { vivo = false; };
  }, [filtroDasArquivadas, recarga]);
  const arquivadas = (pagina: number) => SD.anotacoesListar({ ...filtroDasArquivadas, ordem: 'recentes', pagina, porPagina: POR_PAGINA });

  const filtrado = !!(f.termo || f.ligadaA || f.autor || f.periodo || f.etiqueta);
  const mudarFiltro = (campos: Partial<FiltroDaPagina>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };
  const etiquetas = useEtiquetasDaPagina(f.etiqueta, () => mudarFiltro({ etiqueta: '' }));

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
      <EtiquetasEmLote modulo="anotacoes" ids={[...selecao.selecionadas]} />
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const filtros: Filtro[] = [
    { id: 'ligada', rotulo: 'Ligada a', valor: f.ligadaA || '', aoMudar: v => mudarFiltro({ ligadaA: (v || undefined) as FiltroAnotacoes['ligadaA'] }),
      opcoes: [['', 'Qualquer item'], ...MODULOS_DA_ANOTACAO.map(m => [m, ITEM_DA_ANOTACAO[m].plural] as [string, string]), ['nenhum', 'Nenhum item']] },
    { id: 'autor', rotulo: 'Autor', valor: f.autor || '', aoMudar: v => mudarFiltro({ autor: v }),
      opcoes: [['', 'Qualquer pessoa'], [eu, 'Eu'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
    { id: 'periodo', rotulo: 'Data', valor: f.periodo, aoMudar: v => mudarFiltro({ periodo: v as PeriodoDaAnotacao }),
      opcoes: (Object.keys(PERIODOS_DA_ANOTACAO) as PeriodoDaAnotacao[]).map(p => [p, PERIODOS_DA_ANOTACAO[p].rotulo] as [string, string]) },
    ...filtroDeEtiqueta(etiquetas, f.etiqueta, etiqueta => mudarFiltro({ etiqueta }))
  ];
  // A anotação nova, escrita com uma pasta escolhida, já nasce nela.
  const cadastro = pasta ? `${CADASTRO_DE_ANOTACAO}?${new URLSearchParams({ [PARAMETRO_DA_PASTA]: pasta })}` : CADASTRO_DE_ANOTACAO;
  const tabelaDe = { pastas: pastas ?? [], naPasta: !!pasta, cadastro };
  const contador = tabela ? plural(tabela.total, 'ativa', 'ativas') : null;

  return <>
    <PaginaModulo titulo="Documentos" contador={contador} acao={{ rotulo: 'Nova anotação', para: cadastro }}
      busca={{ placeholder: 'Buscar título, texto, código…', aoBuscar: t => mudarFiltro({ termo: t }) }}
      filtros={filtros} ordem={ordenacao} visoes={[]} lote={lote}>
      <div className="documentos-corpo">
        <ArvoreDePastas pastas={pastas} escolhida={pasta} aoEscolher={escolherPasta} />
        <div className="documentos-lista">
          <SeletorDePasta pastas={pastas} escolhida={pasta} aoEscolher={escolherPasta} />
          <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} {...tabelaDe}
            endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
          <SecaoArquivados<AnotacaoLista> modulo="anotacoes" nome={{ um: 'anotação', varios: 'anotações', feminino: true }} total={totalArquivadas}
            versao={[recarga, termo, ligada, autor, periodo, etiqueta, chaveDaPasta].join('|')} aoMudar={recarregar} listar={arquivadas}
            arquivar={(ids, a) => SD.anotacoesArquivar(ids, a)} excluir={ids => SD.anotacoesExcluir(ids)}
            tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivadas', pagina: numeroDaPagina }} ordem="recentes"
              filtrado={filtrado} selecao={sel} {...tabelaDe} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </div>
      </div>
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
  /** As pastas do escritório, para o caminho de cada anotação. */
  pastas: Pasta[];
  /** A lista está mostrando uma pasta (e as subpastas). */
  naPasta: boolean;
  /** O endereço da anotação nova (já na pasta escolhida). */
  cadastro: string;
}

/** O que a lista vazia diz, por motivo (recebe o endereço da anotação nova). */
const LISTA_VAZIA: Record<MotivoDaListaVazia, (cadastro: string) => ReactNode> = {
  filtrada: () => 'Nenhuma anotação encontrada com esses filtros.',
  arquivadas: () => 'Nenhuma anotação arquivada.',
  pasta: cadastro => <>Nenhuma anotação nesta pasta nem nas subpastas dela. <BotaoLink forma="link" to={cadastro}>Escreva a primeira aqui</BotaoLink>.</>,
  nenhuma: cadastro => <>Nenhuma anotação ainda. <BotaoLink forma="link" to={cadastro}>Escreva a primeira</BotaoLink>.</>
};

function Tabela({ pagina, erro, f, ordem, filtrado, selecao, endereco, aoAbrir, aoPaginar, pastas, naPasta, cadastro }: PropsTabela) {
  const ctx = useCtx();
  // Uma anotação numa pasta que a lista guardada não conhece (um colega a criou depois): as pastas são lidas de novo.
  useProcurarPastas(pagina?.linhas.map(a => a.pasta_id) ?? []);
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{LISTA_VAZIA[motivoDaListaVazia({ filtrada: filtrado, arquivadas: f.situacao === 'arquivadas', pasta: naPasta })](cadastro)}</Vazio>;
  // O x das etiquetas na lista: só para quem altera a anotação ativa (como no cartão).
  const chaves = { equipeEditaTudo: equipeEditaTudo(ctx.escritorio) };
  const soLe = (a: AnotacaoLista) => !!a.arquivado_em || !alteraAAnotacao(a, ctx.perfil, chaves);

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
        <td>
          <EtiquetasDoItem etq={a.etq} modulo="anotacoes" id={a.id} somenteLer={soLe(a)} />
          <NomeDaLinha>{a.titulo}</NomeDaLinha>
          <div className="sub"><span className="codigo">{a.codigo}</span>
            {a.pasta_id && <span className="anotacao-pasta"><Icone nome="pasta" tam={13} />{textoDoCaminho(pastas, a.pasta_id)}</span>}</div>
        </td>
        <td className={a.ligada_a.length ? undefined : 'anotacao-sem-ligacao'}>{a.ligada_a.length ? ligadaA(a.ligada_a) : 'Nenhum item'}</td>
        <td>{nomeDe(a.criado_por)}</td>
        <td><Avatares ids={[a.responsavel_id, ...a.participantes]} equipe={ctx.equipe} /></td>
        <td className="anotacao-data">{porCadastro ? dataCurta(a.criado_em) : relativo(a.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
