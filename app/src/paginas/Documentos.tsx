// Documentos (#303): as anotações do escritório, em Markdown, cada uma ligada a pessoas, processos, contratos, demandas,
// tarefas e compromissos. A estrutura da página vem de <PaginaModulo> (título, busca, filtros, ordem e ações em lote).
// Desde os pedidos do dono de 18/11, a página é como o Obsidian:
// - à esquerda, o explorador (#342): a árvore das pastas com as anotações dentro, e a barra com recolher a navegação, nova
//   anotação, nova pasta, ordenar e recolher tudo. A busca e os filtros da página valem também para ele. Recolhida (a escolha
//   fica guardada para cada pessoa), sobra só o botão de mostrá-la, e a tabela ocupa a largura toda. Quem altera uma anotação a
//   arrasta ali para outra pasta, ou usa "Mover para pasta" no ⋯ dela (#370);
// - no centro, a tabela da pasta escolhida (?pasta=), com as arquivadas embaixo.
// A anotação abre na janela do cartão (PainelCartao), como os cartões dos outros módulos, no centro ou ao lado (?id=, para recarregar e
// mandar o link; abrir e fechar não criam entrada no histórico); a anotação nova abre na janela do cadastro (/documentos/nova/, App.tsx). No celular, o explorador vira uma
// gaveta (o botão no alto do centro). Tudo pelo tamanho do conteúdo (container queries), nunca por contas em JavaScript.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { SD, type AnotacaoLista, type FiltroAnotacoes, type ModuloDaAnotacao, type Ordem, type Pagina, type Pasta } from '../dados';
import { ANOTACOES_NO_EXPLORADOR, POR_PAGINA } from '../dados/limites';
import {
  alteraAAnotacao, desdeDoPeriodo, ITEM_DA_ANOTACAO, MODULOS_DA_ANOTACAO, motivoDaListaVazia, PERIODOS_DA_ANOTACAO, type MotivoDaListaVazia, type PeriodoDaAnotacao
} from '../regras/anotacao';
import { equipeEditaTudo } from '../regras/equipeVeTudo';
import { ordemDoExplorador } from '../regras/explorador';
import { PARAMETRO_DO_COMENTARIO } from '../regras/mensagens';
import { PARAMETRO_DA_PASTA, pastasDescendentes, textoDoCaminho } from '../regras/pastas';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, sinalizarMudanca, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, prepararEditorAoVivo, Vazio } from '../ui/base';
import { EtiquetasDoItem, EtiquetasEmLote, filtroDeEtiqueta, useEtiquetasDaPagina } from '../ui/Etiquetas';
import { Icone } from '../ui/Icone';
import { useOrdem } from '../ui/ordem';
import { PaginaModulo, type Filtro } from '../ui/PaginaModulo';
import { PainelCartao } from '../ui/PainelCartao';
import { Paginacao } from '../ui/Paginacao';
import { ArvoreDePastas, levarAnotacaoParaPasta, useNavegacaoRecolhida } from '../ui/Pastas';
import { usePastas, useProcurarPastas } from '../ui/pastasDoEscritorio';
import { lerPreferencia, salvarPreferencia } from '../ui/preferencias';
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
/** O parâmetro do endereço com a anotação aberta. */
const PARAMETRO_DA_ANOTACAO = 'id';
/** Onde fica, para cada pessoa, a ordem das anotações no explorador. */
const PREFERENCIA_DA_ORDEM = 'documentos.explorador.ordem';
/** O id do explorador, para o botão da gaveta (no celular) dizer o que abre. */
const EXPLORADOR = 'documentos-explorador';
/** O tamanho dos ícones dos botões pequenos da página (o da gaveta e o Arquivar do lote). */
const ICONE_DO_BOTAO = 15;
/** O tamanho do ícone da pasta ao lado do código, na tabela. */
const ICONE_DA_PASTA_NA_TABELA = 13;

export default function Documentos() {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const { pathname } = useLocation();
  useTitulo('Documentos');
  // O editor das anotações começa a chegar já: ao abrir ou criar uma anotação, ele está pronto para escrever.
  useEffect(() => { void prepararEditorAoVivo(); }, []);
  const selecao = useSelecao();

  const [f, setF] = useState<FiltroDaPagina>({ termo: '', ligadaA: undefined, autor: '', periodo: '', etiqueta: '', situacao: 'ativas', pagina: 0 });
  // A pasta escolhida e a anotação aberta vêm do endereço; ao abrir a página, a lista das pastas é lida de novo (um colega pode
  // ter mudado).
  const [params, setParams] = useSearchParams();
  const pasta = params.get(PARAMETRO_DA_PASTA);
  const aberto = params.get(PARAMETRO_DA_ANOTACAO);
  // A pasta do endereço que a lista guardada não conhece (criada por um colega) faz ler de novo; até a resposta, a lista é null.
  const pastas = usePastas({ reler: true, precisa: pasta });
  // A lista mostra a pasta e as subpastas dela.
  const chaveDaPasta = pasta ? pastasDescendentes(pastas ?? [], pasta).join() : '';
  const naPasta = useMemo(() => chaveDaPasta ? chaveDaPasta.split(',') : undefined, [chaveDaPasta]);
  /** O endereço desta página com a anotação aberta (e a pasta escolhida, que continua): o link de cada anotação. */
  const endereco = (id: string) => {
    const p = new URLSearchParams(params);
    p.delete(PARAMETRO_DO_COMENTARIO);
    p.set(PARAMETRO_DA_ANOTACAO, id);
    return `/documentos/?${p}`;
  };
  // Escolher uma pasta mostra a lista dela: a anotação aberta fecha (cada troca entra no histórico, para o Voltar).
  const escolherPasta = (id: string | null) => navegar(`/documentos/${id ? '?' + new URLSearchParams({ [PARAMETRO_DA_PASTA]: id }) : ''}`);
  // Abrir e fechar a janela trocam o endereço sem criar entrada no histórico, como nos outros módulos (useCartaoNaUrl): o Voltar sai
  // da página. A pasta escolhida continua. O texto por gravar é gravado antes de fechar (o AvisoAoSair da anotação segura a saída).
  const { abrir, fechar } = useCartaoNaUrl();
  const navegacao = useNavegacaoRecolhida();
  // Outra pasta (pela árvore, pelo caminho da anotação ou pelo Voltar do navegador): a lista volta à primeira página.
  const [pastaVista, setPastaVista] = useState(pasta);
  if (pasta !== pastaVista) { setPastaVista(pasta); setF(atual => ({ ...atual, pagina: 0 })); selecao.limpar(); }
  // A gaveta do explorador (no celular) fecha quando a pessoa escolhe uma anotação ou uma pasta.
  const [gaveta, setGaveta] = useState(false);
  const lugar = pathname + '?' + params.toString();
  const [lugarVisto, setLugarVisto] = useState(lugar);
  if (lugar !== lugarVisto) { setLugarVisto(lugar); setGaveta(false); }
  useEffect(() => {
    if (!gaveta) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setGaveta(false); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [gaveta]);
  // A pasta do endereço que não existe mais (apagada, ou de um link antigo) deixa de filtrar.
  const pastaSumiu = !!pasta && pastas !== null && !pastas.some(p => p.id === pasta);
  useEffect(() => { if (pastaSumiu) setParams(p => { p.delete(PARAMETRO_DA_PASTA); return p; }, { replace: true }); }, [pastaSumiu, setParams]);
  // Ordem da tabela (mudar volta para a primeira página).
  const ordem = useOrdem('anotacoes', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  // A ordem do explorador é outra, só dele (nome, de início, como no Obsidian).
  const [ordemDaArvore, setOrdemDaArvore] = useState(() => ordemDoExplorador(lerPreferencia<string>(PREFERENCIA_DA_ORDEM, '')));
  const ordenarArvore = (o: Ordem) => { setOrdemDaArvore(o); salvarPreferencia(PREFERENCIA_DA_ORDEM, o); };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<AnotacaoLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // Anotação desfeita depois de salva: fecha a que deixou de existir.
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

  // As anotações do explorador: as ativas de todas as pastas, com a busca e os filtros da página, na ordem do explorador.
  const [daArvore, setDaArvore] = useState<Pagina<AnotacaoLista> | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.anotacoesListar({ ...paraOBanco({ termo, ligadaA: ligada, autor, periodo, etiqueta, situacao: 'ativas' }), ordem: ordemDaArvore, porPagina: ANOTACOES_NO_EXPLORADOR })
      .then(r => { if (vivo) setDaArvore(r); })
      .catch(e => { if (vivo) falha(e); });
    return () => { vivo = false; };
  }, [termo, ligada, autor, periodo, etiqueta, ordemDaArvore, recarga]);

  // Levar a anotação para outra pasta, pelo explorador (#370): só quem a altera. Ela muda de lugar na árvore na hora; depois de
  // gravar, a página e a anotação aberta leem de novo (o aviso de mudança). Se falhar, ela volta para onde estava.
  const chavesDaEquipe = { equipeEditaTudo: equipeEditaTudo(ctx.escritorio) };
  const naArvore = (id: string) => daArvore?.linhas.find(a => a.id === id);
  const mudarNaArvore = (id: string, pasta_id: string | null) => setDaArvore(p => p && { ...p, linhas: p.linhas.map(a => a.id === id ? { ...a, pasta_id } : a) });
  const mover = {
    pode: (id: string) => { const a = naArvore(id); return !!a && !a.arquivado_em && alteraAAnotacao(a, ctx.perfil, chavesDaEquipe); },
    aoMover: async (id: string, destino: string | null) => {
      const antes = naArvore(id)?.pasta_id ?? null;
      mudarNaArvore(id, destino);
      try {
        await levarAnotacaoParaPasta(id, antes, destino, pastas ?? []);
        sinalizarMudanca({ tipo: 'anotacaoAtualizada', id });
      } catch (e) { mudarNaArvore(id, antes); falha(e); }
    }
  };

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
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={ICONE_DO_BOTAO} /> Arquivar</button>
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
    <div className={'documentos-corpo' + (navegacao.recolhida ? ' sem-navegacao' : '') + (gaveta ? ' gaveta-aberta' : '')}>
      <div className="documentos-explorador" id={EXPLORADOR}>
        <ArvoreDePastas pastas={pastas} escolhida={pasta} aoEscolher={escolherPasta} navegacao={{ recolhida: navegacao.recolhida, aoAlternar: navegacao.alternar }} anotacoes={{
          lista: daArvore?.linhas ?? null, total: daArvore?.total, aberta: aberto, endereco, nova: cadastro, ordem: ordemDaArvore, aoOrdenar: ordenarArvore, mover
        }} />
      </div>
      {/* No celular, o véu atrás da gaveta: o clique nele fecha. */}
      {gaveta && <div className="documentos-veu" aria-hidden="true" onClick={() => setGaveta(false)} />}
      <div className="documentos-centro">
        <button type="button" className={estiloBotao({ forma: 'mini' }, 'documentos-abrir-explorador')} aria-expanded={gaveta} aria-controls={EXPLORADOR}
          onClick={() => setGaveta(g => !g)}><Icone nome="pasta" tam={ICONE_DO_BOTAO} /> Pastas e anotações</button>
        <div className="documentos-lista">
      <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} {...tabelaDe}
        endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
      <SecaoArquivados<AnotacaoLista> modulo="anotacoes" nome={{ um: 'anotação', varios: 'anotações', feminino: true }} total={totalArquivadas}
        versao={[recarga, termo, ligada, autor, periodo, etiqueta, chaveDaPasta].join('|')} aoMudar={recarregar} listar={arquivadas}
        arquivar={(ids, a) => SD.anotacoesArquivar(ids, a)} excluir={ids => SD.anotacoesExcluir(ids)}
        tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivadas', pagina: numeroDaPagina }} ordem="recentes"
          filtrado={filtrado} selecao={sel} {...tabelaDe} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </div>
      </div>
    </div>
  </PaginaModulo>
  {/* A anotação, na janela do cartão dos outros módulos (no centro, larga como uma folha aberta, #340, com a coluna da direita). */}
  {aberto && <PainelCartao aoFechar={fechar} largo rotulo="Anotação">
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
  /** O endereço que abre a anotação na janela do cartão (o clique na linha e o Ctrl+clique, noutra aba). */
  endereco: (id: string) => string;
  /** Abre a anotação na janela do cartão, sem criar entrada no histórico (o clique na linha). */
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
            {a.pasta_id && <span className="anotacao-pasta"><Icone nome="pasta" tam={ICONE_DA_PASTA_NA_TABELA} />{textoDoCaminho(pastas, a.pasta_id)}</span>}</div>
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
