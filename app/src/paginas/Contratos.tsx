// Contratos: o que liga o cliente ao advogado responsável e ao serviço contratado, com os honorários e a divisão.
// Tabela com ações em lote, quadro pela situação do contrato e o cartão de cada um. A estrutura da página vem
// de <PaginaModulo>; o modelo é o módulo Pessoas.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type ContratoLista, type FiltroContratos, type Ordem, type Pagina } from '../dados';
import { POR_COLUNA, POR_PAGINA } from '../dados/limites';
import { CATEGORIAS, clientesPorExtenso, fmtDinheiro, SEM_SITUACAO } from '../regras/contrato';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, registrarDesfazer, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Vazio } from '../ui/base';
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
import { CartaoContrato } from './CartaoContrato';
import './Contratos.css';

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;

export default function Contratos() {
  useTitulo('Contratos');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const quadro = useColunas('contratos', ctx, SEM_SITUACAO);
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  const selecao = useSelecao();

  const [f, setF] = useState<FiltroContratos>(() => {
    let responsavel = lerPreferencia('contratos.responsavel', '');
    if (responsavel && !ctx.equipe.some(m => m.id === responsavel)) responsavel = '';
    return { termo: '', responsavel, categoria: '', situacao: 'ativos', pagina: 0 };
  });
  const [visao, setVisao] = useState<Visao>(() => lerPreferencia<Visao>('contratos.visao', 'tabela') === 'kanban' ? 'kanban' : 'tabela');
  // Ordem da tabela (mudar volta para a primeira página). No quadro, cada coluna tem a sua, no menu da coluna.
  const ordem = useOrdem('contratos', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<ContratoLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // Contrato desfeito no formulário depois de salvo: fecha o cartão do contrato que deixou de existir.
  useMudancas(d => {
    recarregar();
    if (d.tipo === 'contratoCriado' && d.id === aberto) fechar();
  });

  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.contratosListar({ ...f, ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [visao, f, ordem.valor, recarga]);

  // No quadro, o total vem de uma contagem à parte (cada coluna carrega só o começo da lista).
  const [totalQuadro, setTotalQuadro] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'kanban') return;
    let vivo = true;
    SD.contratosListar({ ...f, situacao: 'ativos', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalQuadro(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.categoria, f.responsavel, recarga]);

  // Quantos arquivados há: aparece na seção "Arquivados" embaixo da tabela, mesmo fechada.
  const [totalArquivados, setTotalArquivados] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.contratosListar({ ...f, situacao: 'arquivados', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivados(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.categoria, f.responsavel, recarga]);
  const arquivados = (pagina: number, porPagina: number) => SD.contratosListar({ ...f, situacao: 'arquivados', ordem: 'recentes', pagina, porPagina });

  const filtrado = !!(f.termo || f.categoria || f.responsavel);
  const mudarFiltro = (campos: Partial<FiltroContratos>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };

  function trocarVisao(v: Visao) {
    setVisao(v);
    salvarPreferencia('contratos.visao', v);
    selecao.limpar();
  }
  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.contratosArquivar(lista, true);
      const quantos = q === 1 ? '1 contrato' : q + ' contratos';
      feito(`${plural(q, 'contrato arquivado', 'contratos arquivados')}.`, `arquivamento de ${quantos}`, async () => { await SD.contratosArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }

  const n = selecao.quantas;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionado' : 'selecionados'} <button type="button" className={estiloBotao({ forma: 'link' })} style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const total = visao === 'kanban' ? totalQuadro : tabela?.total ?? null;
  const contador = total === null ? null : plural(total, 'ativo', 'ativos');

  return <>
    <PaginaModulo titulo="Contratos" contador={contador} acao={{ rotulo: 'Novo contrato', para: '/contratos/novo/' }}
      busca={{ placeholder: 'Buscar cliente, número, objeto…', aoBuscar: termo => mudarFiltro({ termo }) }}
      filtros={[
        { id: 'responsavel', rotulo: 'Responsável', valor: f.responsavel || '',
          aoMudar: responsavel => { mudarFiltro({ responsavel }); salvarPreferencia('contratos.responsavel', responsavel); },
          opcoes: [['', 'Todos os responsáveis'], [eu, 'Sob minha responsabilidade'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        { id: 'categoria', rotulo: 'Categoria de honorário', valor: f.categoria || '', aoMudar: categoria => mudarFiltro({ categoria }),
          opcoes: [['', 'Todas as categorias'], ...Object.entries(CATEGORIAS)] }
      ]}
      ordem={visao === 'tabela' ? ordenacao : undefined}
      visao={visao} aoTrocarVisao={trocarVisao} lote={lote}>
      {visao === 'kanban'
        ? <Kanban<ContratoLista> quadro={quadro}
          recarga={[recarga, f.termo, f.categoria, f.responsavel].join('|')}
          carregar={(colunaId, deslocamento, ordemDaColuna) => SD.contratosDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativos' }, deslocamento, 30)}
          ordemDe={k => k.etapa_ordem}
          arquivados={deslocamento => arquivados(Math.floor(deslocamento / POR_COLUNA), POR_COLUNA)}
          cartao={(k, ordemDaColuna) => <CartaoKanban k={k} ordem={ordemDaColuna} />}
          endereco={k => endereco(k.id)}
          aoAbrir={k => abrir(k.id)}
          aoMover={async (k, m) => {
            const noArquivo = { arquivar: (ids: string[], a: boolean) => SD.contratosArquivar(ids, a), mover: (id: string, etapa: string | null, ordem: number | null) => SD.contratoMover(id, etapa, ordem) };
            if (await moverNoArquivo(k.codigo, k.id, m, noArquivo, id => quadro.nomeDe(id) || SEM_SITUACAO)) { recarregar(); return; }
            const { de, para, ordem, ordemAnterior } = m;
            await SD.contratoMover(k.id, para, ordem);
            const voltar = async () => { await SD.contratoMover(k.id, de, ordemAnterior); };
            if (de !== para) feito(`${k.codigo} foi para "${quadro.nomeDe(para) || SEM_SITUACAO}".`, 'movimentação do cartão', voltar);
            else registrarDesfazer('mudança de posição do cartão', voltar);
          }}
          aoAdicionar={colunaId => navegar('/contratos/novo/' + (colunaId ? '?etapa=' + colunaId : ''))} />
        : <>
          <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} situacao={quadro.nomeDe}
          endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
          <SecaoArquivados<ContratoLista> modulo="contratos" nome={{ um: 'contrato', varios: 'contratos', feminino: false }} total={totalArquivados}
            versao={recarga} aoMudar={recarregar} listar={pagina => arquivados(pagina, POR_PAGINA)}
            arquivar={(ids, a) => SD.contratosArquivar(ids, a)} excluir={ids => SD.contratosExcluir(ids)}
            tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivados', pagina: numeroDaPagina }} ordem="recentes"
              filtrado={filtrado} selecao={sel} situacao={quadro.nomeDe} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </>}
    </PaginaModulo>
    {aberto && <PainelCartao aoFechar={fechar}>
      <CartaoContrato key={aberto} id={aberto} quadro={quadro} aoMudar={recarregar} aoFechar={fechar} />
    </PainelCartao>}
  </>;
}

function CartaoKanban({ k, ordem }: { k: ContratoLista; ordem: Ordem }) {
  const ctx = useCtx();
  const data = dataDaOrdem(ordem, k);
  return <>
    <div className="kt">{clientesPorExtenso(k.cliente_nome)}</div>
    <div className="km">
      <span className="codigo">{k.codigo}</span>
      <span className="contrato-servico">{k.servico}</span>
      <span>{CATEGORIAS[k.categoria]}{k.valor !== null ? ' · ' + fmtDinheiro(k.valor) : ''}</span>
      {data && <span>{data}</span>}
    </div>
    <div className="kp"><Avatares ids={[k.responsavel_id]} equipe={ctx.equipe} tam={24} /></div>
  </>;
}

interface PropsTabela {
  pagina: Pagina<ContratoLista> | null;
  erro: string;
  f: FiltroContratos;
  ordem: Ordem;
  filtrado: boolean;
  selecao: Selecao;
  situacao: (id: string | null) => string;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, ordem, filtrado, selecao, situacao, endereco, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhum contrato encontrado com esses filtros.'
    : f.situacao === 'arquivados' ? 'Nenhum contrato arquivado.'
    : <>Nenhum contrato cadastrado ainda. <BotaoLink forma="link" to="/contratos/novo/">Cadastrar o primeiro</BotaoLink></>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const todas = linhas.every(k => selecionadas.has(k.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  return <div>
    <div className="tabela tabela-contratos"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todos desta página" checked={todas} onChange={e => marcar(linhas.map(k => k.id), e.target.checked)} /></th>
        <th scope="col">Cliente</th><th scope="col">Contrato</th><th scope="col">Categoria</th><th scope="col">Valor</th>
        <th scope="col">Situação</th><th scope="col">Responsável</th><th scope="col">{porCadastro ? 'Criado' : 'Atualizado'}</th>
      </tr></thead>
      <tbody>{linhas.map(k => <LinhaQueAbre key={k.id} para={endereco(k.id)} aoAbrir={() => aoAbrir(k.id)} marcada={selecionadas.has(k.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${k.codigo}`} checked={selecionadas.has(k.id)} onChange={e => marcar([k.id], e.target.checked)} /></td>
        <td><NomeDaLinha>{clientesPorExtenso(k.cliente_nome)}</NomeDaLinha><div className="sub contrato-servico">{k.servico}</div></td>
        <td style={{ whiteSpace: 'nowrap' }}><span className="codigo">{k.codigo}</span>{k.codigo_antigo && <div className="sub">antigo: {k.codigo_antigo}</div>}</td>
        <td>{CATEGORIAS[k.categoria]}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{fmtDinheiro(k.valor)}</td>
        <td><span className="etapa-txt">{situacao(k.etapa_id)}</span></td>
        <td><Avatares ids={[k.responsavel_id]} equipe={ctx.equipe} /></td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{porCadastro ? dataCurta(k.criado_em) : relativo(k.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
