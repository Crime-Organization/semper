// Pessoas: cadastro comum do escritório. Tabela com ações em lote, kanban do atendimento (CRM)
// e o cartão de cada pessoa. A estrutura da página vem de <PaginaModulo>.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SD, type FiltroPessoas, type MarcaPessoas, type Ordem, type Pagina, type PessoaLista } from '../dados';
import { POR_COLUNA, POR_PAGINA } from '../dados/limites';
import { csvContatosGoogle } from '../regras/contatosGoogle';
import { fmtDocumento, fmtTelefone, TIPOS, type Representante } from '../regras/pessoa';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { avisar, falha, feito, registrarDesfazer, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { janela } from '../ui/janela';
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
import { useCartaoNaUrl } from '../ui/useCartaoNaUrl';
import { useSelecao, type Selecao } from '../ui/useSelecao';
import { dataDaOrdem, useOrdem } from '../ui/ordem';
import { baixarArquivo, dataCurta, numero, relativo, useTitulo } from '../ui/util';
import { CartaoPessoa } from './CartaoPessoa';
import './Pessoas.css';

/** A preferência que guarda se a seção "Arquivados" das pessoas está aberta (a mesma de SecaoArquivados). */
const ARQUIVADAS_ABERTA = 'pessoas.arquivados';

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
/** O filtro "Situação do cadastro": as criadas por uma importação ou as com alguma pendência (veja ImportarPessoas.tsx). */
const MARCAS: Record<MarcaPessoas, string> = { importadas: 'Importadas', pendentes: 'Com pendência' };
const marcaDe = (valor: string) => Object.hasOwn(MARCAS, valor) ? valor as MarcaPessoas : undefined;

export default function Pessoas() {
  useTitulo('Pessoas');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const quadro = useColunas('pessoas', ctx);

  // Estado inicial: da URL (atalhos do Início), senão das preferências do usuário.
  const [f, setF] = useState<FiltroPessoas>(() => {
    let responsavel = params.get('responsavel') === 'eu' ? eu : lerPreferencia('pessoas.responsavel', '');
    if (responsavel && !ctx.equipe.some(m => m.id === responsavel)) responsavel = '';
    return { termo: '', tipo: '', responsavel, situacao: 'ativas', pagina: 0 };
  });
  // O atalho "Arquivadas" do Início (?situacao=arquivadas) abre a tabela com a seção dos arquivados aberta.
  const [verArquivadas] = useState(() => params.get('situacao') === 'arquivadas');
  const [visao, setVisao] = useState<Visao>(() => {
    if (verArquivadas) { salvarPreferencia(ARQUIVADAS_ABERTA, true); return 'tabela'; }
    return (params.get('visao') || lerPreferencia('pessoas.visao', 'tabela')) === 'kanban' ? 'kanban' : 'tabela';
  });
  // Ordem escolhida (cada visualização tem a sua). Na tabela, mudar a ordem volta para a primeira página.
  // Ordem da tabela (controle "Ordenar" da barra; mudar volta para a primeira página). No quadro, cada
  // coluna tem a sua, no menu da coluna.
  const ordem = useOrdem('pessoas', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const selecao = useSelecao();
  const [tabela, setTabela] = useState<Pagina<PessoaLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // O cartão aberto fica na URL (?id=...), para o link levar direto à pessoa.
  const { aberto, abrir, fechar, endereco } = useCartaoNaUrl();
  useEffect(() => {
    if (['visao', 'responsavel', 'situacao'].some(k => params.has(k))) setParams(aberto ? { id: aberto } : {}, { replace: true });
  // oxlint-disable-next-line react/exhaustive-deps -- limpa endereços antigos uma vez só, ao abrir a tela
  }, []);

  // Cadastro desfeito aqui depois de salvo no formulário: fecha o cartão da pessoa que deixou de existir.
  useMudancas(d => {
    recarregar();
    if (d.tipo === 'pessoaCriada' && d.id === aberto) fechar();
  });

  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.pessoasListar({ ...f, ordem: ordem.valor, porPagina: POR_PAGINA })
      .then(r => { if (vivo) { setTabela(r); setErroTabela(''); } })
      .catch(e => { if (vivo) setErroTabela((e as Error).message); });
    return () => { vivo = false; };
  }, [visao, f, ordem.valor, f.etiqueta, recarga]);

  // No quadro, o total vem de uma contagem à parte (cada coluna carrega só o começo da lista).
  const [totalQuadro, setTotalQuadro] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'kanban') return;
    let vivo = true;
    SD.pessoasListar({ ...f, situacao: 'ativas', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalQuadro(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.tipo, f.responsavel, f.marca, f.etiqueta, recarga]);

  // Quantas arquivadas há: aparece na seção "Arquivados" embaixo da tabela, mesmo fechada.
  const [totalArquivadas, setTotalArquivadas] = useState<number | null>(null);
  useEffect(() => {
    if (visao !== 'tabela') return;
    let vivo = true;
    SD.pessoasListar({ ...f, situacao: 'arquivadas', pagina: 0, porPagina: 1 }).then(r => { if (vivo) setTotalArquivadas(r.total); }).catch(() => {});
    return () => { vivo = false; };
  // oxlint-disable-next-line react/exhaustive-deps -- depende só dos campos do filtro que mudam a contagem, não do objeto f
  }, [visao, f.termo, f.tipo, f.responsavel, f.marca, f.etiqueta, recarga]);
  const arquivadas = (pagina: number, porPagina: number) => SD.pessoasListar({ ...f, situacao: 'arquivadas', ordem: 'recentes', pagina, porPagina });
  // Vindo do atalho do Início, a tela já desce até os arquivados.
  useEffect(() => {
    if (!verArquivadas) return;
    const t = setTimeout(() => document.querySelector('.secao-arquivados')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0);
    return () => clearTimeout(t);
  }, [verArquivadas]);

  const filtrado = !!(f.termo || f.tipo || f.responsavel || f.marca || f.etiqueta);
  const mudarFiltro = (campos: Partial<FiltroPessoas>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); selecao.limpar(); };
  const etiquetas = useEtiquetasDaPagina(f.etiqueta, () => mudarFiltro({ etiqueta: '' }));

  function trocarVisao(v: Visao) {
    setVisao(v);
    salvarPreferencia('pessoas.visao', v);
    selecao.limpar();
  }
  // ---------- ações em lote ----------
  async function arquivarLote() {
    const lista = [...selecao.selecionadas];
    try {
      const q = await SD.pessoasArquivar(lista, true);
      const quantas = q === 1 ? '1 pessoa' : q + ' pessoas';
      feito(`${plural(q, 'pessoa arquivada', 'pessoas arquivadas')}.`, `arquivamento de ${quantas}`, async () => { await SD.pessoasArquivar(lista, false); });
      selecao.limpar(); recarregar();
    } catch (e) { falha(e); }
  }
  // ---------- exportar ----------
  // Leva as pessoas ativas da lista como ela está filtrada (busca, tipo, responsável) para o Google Contatos.
  // Só administradores: é a base inteira de clientes saindo do sistema.
  async function exportarGoogle() {
    const quantas = visao === 'tabela' && tabela ? plural(tabela.total, 'pessoa', 'pessoas') : 'as pessoas';
    const escolha = await janela<'com' | 'sem'>({
      titulo: 'Exportar para o Google Contatos',
      corpo: <>
        <p>Gera um arquivo CSV com {quantas} desta lista{filtrado ? ', com os filtros escolhidos' : ''}. No Google Contatos, use "Importar" e escolha o arquivo.</p>
        <div className="opcoes-janela" role="radiogroup" aria-label="Descrição dos contatos">
          <label><input type="radio" name="descricao" value="com" defaultChecked />
            <span>Com a qualificação na descrição<small>Nome, telefones, e-mails, aniversário e a qualificação completa.</small></span></label>
          <label><input type="radio" name="descricao" value="sem" />
            <span>Sem descrição<small>Só nome, telefones, e-mails e aniversário.</small></span></label>
        </div>
        <p className="sub">O Google cria contatos novos ao importar: quem já estiver lá fica repetido. Depois, use "Mesclar e corrigir" no Google.</p>
      </>,
      acoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Baixar arquivo', tipo: 'pri', valor: campos => campos.get('descricao') === 'sem' ? 'sem' : 'com' }]
    });
    if (!escolha) return;
    try {
      const pessoas = await SD.pessoasExportar({ termo: f.termo, tipo: f.tipo, responsavel: f.responsavel, marca: f.marca, situacao: f.situacao, etiqueta: f.etiqueta });
      if (!pessoas.length) { avisar('Nenhuma pessoa para exportar com esses filtros.', 'erro'); return; }
      // Na qualificação das pessoas jurídicas entra quem as representa (vínculo "Representante legal de").
      const representantes: Record<string, Representante[]> = {};
      if (escolha === 'com') {
        for (const r of await SD.representantesVinculados(pessoas.filter(p => p.tipo === 'pj').map(p => p.id))) (representantes[r.pj_id] ||= []).push(r);
      }
      // A exportação entra no registro de ações (LGPD) antes de o arquivo sair; se não registrar, não exporta.
      await SD.exportacaoRegistrar('pessoas', `Google Contatos, ${escolha === 'com' ? 'com' : 'sem'} qualificação`, pessoas.length);
      const hoje = new Date().toLocaleDateString('sv-SE');
      baixarArquivo(`contatos-google-${escolha}-qualificacao-${hoje}.csv`, csvContatosGoogle(pessoas, { comQualificacao: escolha === 'com', representantes }));
      avisar(`${plural(pessoas.length, 'contato exportado', 'contatos exportados')}.`, 'ok');
    } catch (e) { falha(e); }
  }

  const n = selecao.quantas;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionada' : 'selecionadas'} <button type="button" className={estiloBotao({ forma: 'link' })} style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => selecao.limpar()}>limpar</button></span>
    <span className="acoes-lote">
      <EtiquetasEmLote modulo="pessoas" ids={[...selecao.selecionadas]} />
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={arquivarLote}><Icone nome="arquivo" tam={15} /> Arquivar</button>
    </span>
  </> : null;

  // Contador ao lado do título: quantas pessoas a lista mostra (com a busca e os filtros).
  const chaveDaLista = [recarga, f.termo, f.tipo, f.responsavel, f.marca, f.etiqueta].join('|');
  const total = visao === 'kanban' ? totalQuadro : tabela?.total ?? null;
  const contador = total === null ? null : plural(total, 'ativa', 'ativas');

  return <>
    <PaginaModulo titulo="Pessoas" contador={contador} acao={{ rotulo: 'Nova pessoa', para: '/pessoas/nova/' }}
      busca={{ placeholder: 'Buscar nome, CPF/CNPJ, telefone…', aoBuscar: termo => mudarFiltro({ termo }) }}
      filtros={[
        { id: 'tipo', rotulo: 'Tipo de cadastro', valor: f.tipo || '', aoMudar: tipo => mudarFiltro({ tipo }),
          opcoes: [['', 'Todos os tipos'], ['pf', 'Pessoa física'], ['pj', 'Pessoa jurídica'], ['contato', 'Somente contato']] },
        { id: 'responsavel', rotulo: 'Responsável', valor: f.responsavel || '',
          aoMudar: responsavel => { mudarFiltro({ responsavel }); salvarPreferencia('pessoas.responsavel', responsavel); },
          opcoes: [['', 'Todos os responsáveis'], [eu, 'Sob minha responsabilidade'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        { id: 'marca', rotulo: 'Situação do cadastro', valor: f.marca || '', aoMudar: marca => mudarFiltro({ marca: marcaDe(marca) }),
          opcoes: [['', 'Todos'], ...Object.entries(MARCAS) as [string, string][]] },
        ...filtroDeEtiqueta(etiquetas, f.etiqueta, etiqueta => mudarFiltro({ etiqueta }))
      ]}
      ordem={visao === 'tabela' ? ordenacao : undefined}
      mais={ctx.ehAdmin ? [{ rotulo: 'Exportar para o Google Contatos', icone: 'baixar', aoEscolher: exportarGoogle },
        { rotulo: 'Importar pessoas', icone: 'subir', aoEscolher: () => navegar('/pessoas/importar/') }] : undefined}
      visao={visao} aoTrocarVisao={trocarVisao} lote={lote}>
      {visao === 'kanban'
        ? <Kanban<PessoaLista> quadro={quadro}
          recarga={chaveDaLista}
          carregar={(colunaId, deslocamento, ordemDaColuna) => SD.pessoasDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativas' }, deslocamento, 30)}
          ordemDe={p => p.etapa_ordem}
          arquivados={deslocamento => arquivadas(Math.floor(deslocamento / POR_COLUNA), POR_COLUNA)}
          cartao={(p, ordemDaColuna) => <CartaoKanban p={p} ordem={ordemDaColuna} />}
          endereco={p => endereco(p.id)}
          aoAbrir={p => abrir(p.id)}
          aoMover={async (p, m) => {
            const noArquivo = { arquivar: (ids: string[], a: boolean) => SD.pessoasArquivar(ids, a), mover: (id: string, etapa: string | null, ordem: number | null) => SD.pessoaMover(id, etapa, ordem) };
            if (await moverNoArquivo(p.nome, p.id, m, noArquivo, id => quadro.nomeDe(id) || 'Sem etapa')) { recarregar(); return; }
            const { de, para, ordem, ordemAnterior } = m;
            await SD.pessoaMover(p.id, para, ordem);
            const voltar = async () => { await SD.pessoaMover(p.id, de, ordemAnterior); };
            if (de !== para) feito(`${p.nome} foi para "${quadro.nomeDe(para) || 'Sem etapa'}".`, 'movimentação do cartão', voltar);
            else registrarDesfazer('mudança de posição do cartão', voltar);
          }}
          aoAdicionar={colunaId => navegar('/pessoas/nova/' + (colunaId ? '?etapa=' + colunaId : ''))} />
        : <>
          <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecao={selecao} etapa={quadro.nomeDe}
          endereco={endereco} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />
          <SecaoArquivados<PessoaLista> modulo="pessoas" nome={{ um: 'pessoa', varios: 'pessoas', feminino: true }} total={totalArquivadas}
            versao={chaveDaLista} aoMudar={recarregar} listar={pagina => arquivadas(pagina, POR_PAGINA)}
            arquivar={(ids, a) => SD.pessoasArquivar(ids, a)} excluir={ids => SD.pessoasExcluir(ids)}
            tabela={(pg, numeroDaPagina, sel, aoPaginar) => <Tabela pagina={pg} erro="" f={{ ...f, situacao: 'arquivadas', pagina: numeroDaPagina }} ordem="recentes"
              filtrado={filtrado} selecao={sel} etapa={quadro.nomeDe} endereco={endereco} aoAbrir={abrir} aoPaginar={aoPaginar} />} />
        </>}
    </PaginaModulo>
    {aberto && <PainelCartao aoFechar={fechar}>
      <CartaoPessoa key={aberto} id={aberto} quadro={quadro} aoMudar={recarregar} aoFechar={fechar} aoAbrirPessoa={abrir} />
    </PainelCartao>}
  </>;
}

function CartaoKanban({ p, ordem }: { p: PessoaLista; ordem: Ordem }) {
  const ctx = useCtx();
  const data = dataDaOrdem(ordem, p);
  return <>
    <EtiquetasDoItem etq={p.etq} modulo="pessoas" id={p.id} somenteLer={!!p.arquivado_em} />
    <div className="kt">{p.nome}</div>
    <div className="km">
      {p.telefones?.[0] && <span>{fmtTelefone(p.telefones[0])}</span>}
      {p.municipio && <span>{p.municipio}{p.uf ? '/' + p.uf : ''}</span>}
      {data && <span>{data}</span>}
    </div>
    {p.resp.length > 0 && <div className="kp"><Avatares ids={p.resp.map(x => x.perfil_id)} equipe={ctx.equipe} max={4} tam={24} /></div>}
  </>;
}

interface PropsTabela {
  pagina: Pagina<PessoaLista> | null;
  erro: string;
  f: FiltroPessoas;
  ordem: Ordem;
  filtrado: boolean;
  selecao: Selecao;
  etapa: (id: string | null) => string;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, ordem, filtrado, selecao, etapa, endereco, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!pagina) return <Carregando />;
  const { linhas, total } = pagina;
  if (!linhas.length) return <Vazio>{filtrado ? 'Nenhuma pessoa encontrada com esses filtros.'
    : f.situacao === 'arquivadas' ? 'Nenhuma pessoa arquivada.'
    : <>Nenhuma pessoa cadastrada ainda. <BotaoLink forma="link" to="/pessoas/nova/">Cadastrar a primeira</BotaoLink></>}</Vazio>;

  const { selecionadas, marcar } = selecao;
  const todas = linhas.every(p => selecionadas.has(p.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  return <div>
    <div className="tabela tabela-pessoas"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todas desta página" checked={todas} onChange={e => marcar(linhas.map(p => p.id), e.target.checked)} /></th>
        <th scope="col">Pessoa</th><th scope="col">Telefone</th><th scope="col">Município</th>
        <th scope="col">Etapa</th><th scope="col">Responsáveis</th><th scope="col">{porCadastro ? 'Cadastrada' : 'Atualizada'}</th>
      </tr></thead>
      <tbody>{linhas.map(p => <LinhaQueAbre key={p.id} para={endereco(p.id)} aoAbrir={() => aoAbrir(p.id)} marcada={selecionadas.has(p.id)}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={selecionadas.has(p.id)} onChange={e => marcar([p.id], e.target.checked)} /></td>
        <td><EtiquetasDoItem etq={p.etq} modulo="pessoas" id={p.id} somenteLer={!!p.arquivado_em} /><NomeDaLinha>{p.nome}</NomeDaLinha><div className="sub">{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''} · <span className="codigo">{p.codigo}</span></div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{fmtTelefone(p.telefones?.[0] || '')}{p.telefones?.length > 1 && <> <span className="sub">+{p.telefones.length - 1}</span></>}</td>
        <td>{p.municipio ? p.municipio + (p.uf ? '/' + p.uf : '') : ''}</td>
        <td><span className="etapa-txt">{etapa(p.etapa_id)}</span></td>
        <td><Avatares ids={p.resp.map(x => x.perfil_id)} equipe={ctx.equipe} /></td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{porCadastro ? dataCurta(p.criado_em) : relativo(p.atualizado_em)}</td>
      </LinhaQueAbre>)}</tbody>
    </table></div>
    <Paginacao pagina={f.pagina || 0} porPagina={POR_PAGINA} naPagina={linhas.length} total={total} aoPaginar={aoPaginar} />
  </div>;
}
