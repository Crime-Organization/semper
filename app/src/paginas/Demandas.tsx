// Demandas: as etapas do trabalho (na maioria das vezes, os objetos dos contratos assinados), com responsável,
// colaboradores, clientes e prazo. Tabela com ações em lote, quadro (Para fazer, Fazendo, Aguardando retorno,
// Concluído) e o cartão de cada uma. A estrutura da página vem de <PaginaModulo>; o modelo é o módulo Pessoas.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { oferecerProcesso } from './concluirDemanda';
import { SD, type DemandaLista, type FiltroDemandas, type Ordem, type Pagina } from '../dados';
import { POR_COLUNA, POR_PAGINA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import { ROTULOS_PRAZO, SEM_SITUACAO_DEMANDA, situacaoDoPrazo, veADemanda } from '../regras/demanda';
import { soLeOCartao } from '../regras/equipeVeTudo';
import { fmtData } from '../regras/pessoa';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { falha, feito, registrarDesfazer, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Selo, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { PainelCartao } from '../ui/PainelCartao';
import { EtiquetasDoItem, EtiquetasEmLote, filtroDeEtiqueta, useEtiquetasDaPagina } from '../ui/Etiquetas';
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
import { dataCurta, hojeISO, numero, relativo, useTitulo } from '../ui/util';
import { CartaoDemanda } from './CartaoDemanda';
import './Contratos.css';
import './Demandas.css';

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
/** Cor do selo do prazo: vencido em vermelho, vence hoje em laranja, em dia neutro. */
const SELO_DO_PRAZO = { vencido: 'erro', hoje: 'pend', em_dia: 'arq' } as const;

/** O prazo como selo (some quando não há prazo). */
export function SeloDoPrazo({ prazo }: { prazo: string | null }) {
  const s = situacaoDoPrazo(prazo, hojeISO());
  return s ? <Selo tipo={SELO_DO_PRAZO[s]}>{ROTULOS_PRAZO[s]}: {fmtData(prazo)}</Selo> : null;
}

export default function Demandas() {
  useTitulo('Demandas');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const quadro = useColunas('demandas', ctx, SEM_SITUACAO_DEMANDA);
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  const selecao = useSelecao();

  const [f, setF] = useState<FiltroDemandas>(() => {
    let pessoa = lerPreferencia('demandas.pessoa', '');
    if (pessoa && !ctx.equipe.some(m => m.id === pessoa)) pessoa = '';
    return { termo: '', pessoa, situacao: 'ativas', pagina: 0 };
  });
  const [visao, setVisao] = useState<Visao>(() => lerPreferencia<Visao>('demandas.visao', 'kanban') === 'tabela' ? 'tabela' : 'kanban');
  // Ordem da tabela (mudar volta para a primeira página). No quadro, cada coluna tem a sua, no menu da coluna.
  const ordem = useOrdem('demandas', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [tabela, setTabela] = useState<Pagina<DemandaLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // Demanda desfeita no formulário depois de salva: fecha o cartão da demanda que deixou de existir.
  useMudancas(d => {
    recarregar();
    if (d.tipo === 'demandaCriada' && d.id === aberto) fechar();
  });

  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.demandasListar({ ...f, ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [visao, f, ordem.valor, f.etiqueta, recarga]);

  // No quadro, o total vem de uma contagem à parte (cada coluna carrega só o começo da lista).
  const [totalQuadro, setTotalQuadro] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'kanban') return;
    let vivo = true;
    SD.demandasListar({ ...f, situacao: 'ativas', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalQuadro(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.pessoa, f.etiqueta, recarga]);

  // Quantos arquivados há: aparece na seção "Arquivados" embaixo da tabela, mesmo fechada.
  const [totalArquivadas, setTotalArquivadas] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.demandasListar({ ...f, situacao: 'arquivadas', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivadas(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.pessoa, f.etiqueta, recarga]);
  const arquivadas = (pagina: number, porPagina: number) => SD.demandasListar({ ...f, situacao: 'arquivadas', ordem: 'recentes', pagina, porPagina });

  const filtrado = !!(f.termo || f.pessoa || f.etiqueta);
  const mudarFiltro = (campos: Partial<FiltroDemandas>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };
  const etiquetas = useEtiquetasDaPagina(f.etiqueta, () => mudarFiltro({ etiqueta: '' }));

  function trocarVisao(v: Visao) {
    setVisao(v);
    salvarPreferencia('demandas.visao', v);
    selecao.limpar();
  }
  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.demandasArquivar(lista, true);
      const quantas = q === 1 ? '1 demanda' : q + ' demandas';
      feito(`${plural(q, 'demanda arquivada', 'demandas arquivadas')}.`, `arquivamento de ${quantas}`, async () => { await SD.demandasArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }

  const n = selecao.quantas;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionada' : 'selecionadas'} <button type="button" className={estiloBotao({ forma: 'link' })} style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <EtiquetasEmLote modulo="demandas" ids={[...selecao.selecionadas]} />
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  const chaveDaLista = [recarga, f.termo, f.pessoa, f.etiqueta].join('|');
  const total = visao === 'kanban' ? totalQuadro : tabela?.total ?? null;
  const contador = total === null ? null : plural(total, 'ativa', 'ativas');

  return <>
    <PaginaModulo titulo="Demandas" contador={contador} acao={{ rotulo: 'Nova demanda', para: '/demandas/nova/' }}
      busca={{ placeholder: 'Buscar título, cliente, código, contrato…', aoBuscar: termo => mudarFiltro({ termo }) }}
      filtros={[
        { id: 'pessoa', rotulo: 'Pessoa da equipe', valor: f.pessoa || '',
          aoMudar: pessoa => { mudarFiltro({ pessoa }); salvarPreferencia('demandas.pessoa', pessoa); },
          opcoes: [['', 'Todas as demandas'], [eu, 'Comigo (responsável ou colaborador)'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        ...filtroDeEtiqueta(etiquetas, f.etiqueta, etiqueta => mudarFiltro({ etiqueta }))
      ]}
      mais={[{ rotulo: 'Modelos de lista', icone: 'check', aoEscolher: () => navegar('/modelos-de-lista/') }]}
      ordem={visao === 'tabela' ? ordenacao : undefined}
      visao={visao} aoTrocarVisao={trocarVisao} lote={lote}>
      {visao === 'kanban'
        ? <Kanban<DemandaLista> quadro={quadro} podeArrastar={d => !soLeOCartao(ctx, m => veADemanda(d, m))}
          recarga={chaveDaLista}
          carregar={(colunaId, deslocamento, ordemDaColuna) => SD.demandasDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativas' }, deslocamento, 30)}
          ordemDe={d => d.etapa_ordem}
          arquivados={deslocamento => arquivadas(Math.floor(deslocamento / POR_COLUNA), POR_COLUNA)}
          cartao={(d, ordemDaColuna) => <CartaoKanban d={d} ordem={ordemDaColuna} />}
          endereco={d => endereco(d.id)}
          aoAbrir={d => abrir(d.id)}
          aoMover={async (d, m) => {
            const noArquivo = { arquivar: (ids: string[], a: boolean) => SD.demandasArquivar(ids, a), mover: (id: string, etapa: string | null, ordem: number | null) => SD.demandaMover(id, etapa, ordem) };
            if (await moverNoArquivo(d.codigo, d.id, m, noArquivo, id => quadro.nomeDe(id) || SEM_SITUACAO_DEMANDA)) { recarregar(); void oferecerProcesso(d, m.para, navegar); return; }
            const { de, para, ordem, ordemAnterior } = m;
            await SD.demandaMover(d.id, para, ordem);
            const voltar = async () => { await SD.demandaMover(d.id, de, ordemAnterior); };
            if (de !== para) {
              feito(`${d.codigo} foi para "${quadro.nomeDe(para) || SEM_SITUACAO_DEMANDA}".`, 'movimentação do cartão', voltar);
              void oferecerProcesso(d, para, navegar);
            } else registrarDesfazer('mudança de posição do cartão', voltar);
          }}
          aoAdicionar={colunaId => navegar('/demandas/nova/' + (colunaId ? '?etapa=' + colunaId : ''))} />
        : <>
          <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} situacao={quadro.nomeDe}
          endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
          <SecaoArquivados<DemandaLista> modulo="demandas" nome={{ um: 'demanda', varios: 'demandas', feminino: true }} total={totalArquivadas}
            versao={chaveDaLista} aoMudar={recarregar} listar={pagina => arquivadas(pagina, POR_PAGINA)}
            arquivar={(ids, a) => SD.demandasArquivar(ids, a)} excluir={ids => SD.demandasExcluir(ids)}
            tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivadas', pagina: numeroDaPagina }} ordem="recentes"
              filtrado={filtrado} selecao={sel} situacao={quadro.nomeDe} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </>}
    </PaginaModulo>
    {aberto && <PainelCartao aoFechar={fechar}>
      <CartaoDemanda key={aberto} id={aberto} quadro={quadro} aoMudar={recarregar} aoFechar={fechar} />
    </PainelCartao>}
  </>;
}

function CartaoKanban({ d, ordem }: { d: DemandaLista; ordem: Ordem }) {
  const ctx = useCtx();
  const data = dataDaOrdem(ordem, d);
  return <>
    <EtiquetasDoItem etq={d.etq} modulo="demandas" id={d.id} somenteLer={!!d.arquivado_em || soLeOCartao(ctx, m => veADemanda(d, m))} />
    <div className="kt">{d.titulo}</div>
    <div className="km">
      <span className="codigo">{d.codigo}{d.contrato_codigo ? ' · contrato ' + d.contrato_codigo : ''}</span>
      {d.cliente_nome && <span>{clientesPorExtenso(d.cliente_nome)}</span>}
      <SeloDoPrazo prazo={d.prazo} />
      {data && <span>{data}</span>}
    </div>
    <div className="kp"><Avatares ids={[d.responsavel_id, ...d.colaboradores]} equipe={ctx.equipe} tam={24} /></div>
  </>;
}

interface PropsTabela {
  pagina: Pagina<DemandaLista> | null;
  erro: string;
  f: FiltroDemandas;
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
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhuma demanda encontrada com esses filtros.'
    : f.situacao === 'arquivadas' ? 'Nenhuma demanda arquivada.'
    : <>Nenhuma demanda ainda. Elas nascem dos contratos assinados, ou <BotaoLink forma="link" to="/demandas/nova/">cadastre a primeira</BotaoLink>.</>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const alteraveis = linhas.filter(d => !soLeOCartao(ctx, m => veADemanda(d, m)));
  const todas = alteraveis.length > 0 && alteraveis.every(d => selecionadas.has(d.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  return <div>
    <div className="tabela tabela-demandas"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todas desta página" checked={todas} onChange={e => marcar(alteraveis.map(d => d.id), e.target.checked)} /></th>
        <th scope="col">Demanda</th><th scope="col">Prazo</th><th scope="col">Situação</th><th scope="col">Pessoas</th>
        <th scope="col">{porCadastro ? 'Criada' : 'Atualizada'}</th>
      </tr></thead>
      <tbody>{linhas.map(d => <LinhaQueAbre key={d.id} para={endereco(d.id)} aoAbrir={() => aoAbrir(d.id)} marcada={selecionadas.has(d.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${d.codigo}`} checked={selecionadas.has(d.id)} disabled={!alteraveis.includes(d)} onChange={e => marcar([d.id], e.target.checked)} /></td>
        <td><EtiquetasDoItem etq={d.etq} modulo="demandas" id={d.id} somenteLer={!!d.arquivado_em || soLeOCartao(ctx, m => veADemanda(d, m))} /><NomeDaLinha>{d.titulo}</NomeDaLinha>
          <div className="sub"><span className="codigo">{d.codigo}</span>{d.cliente_nome ? ' · ' + clientesPorExtenso(d.cliente_nome) : ''}{d.contrato_codigo ? ' · contrato ' + d.contrato_codigo : ''}</div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{d.prazo ? <SeloDoPrazo prazo={d.prazo} /> : <span className="nota">—</span>}</td>
        <td><span className="etapa-txt">{situacao(d.etapa_id)}</span></td>
        <td><Avatares ids={[d.responsavel_id, ...d.colaboradores]} equipe={ctx.equipe} /></td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{porCadastro ? dataCurta(d.criado_em) : relativo(d.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
