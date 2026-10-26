// Pessoas: cadastro comum do escritório. Tabela com ações em lote, kanban do atendimento (CRM)
// e o cartão de cada pessoa. A estrutura da página vem de <PaginaModulo>.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type FiltroPessoas, type Ordem, type Pagina, type PessoaLista } from '../dados';
import { csvContatosGoogle } from '../regras/contatosGoogle';
import { fmtDocumento, fmtTelefone, TIPOS, type Representante } from '../regras/pessoa';
import { Avatares } from '../ui/Avatar';
import { avisar, falha, feito, registrarDesfazer, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { janela } from '../ui/janela';
import { PainelCartao } from '../ui/PainelCartao';
import { PaginaModulo, type Visao } from '../ui/PaginaModulo';
import { lerPreferencia, salvarPreferencia } from '../ui/preferencias';
import { Kanban } from '../ui/quadro/Kanban';
import { useColunas } from '../ui/quadro/useColunas';
import { useCtx } from '../ui/sessao';
import { dataDaOrdem, useOrdem } from '../ui/ordem';
import { baixarArquivo, dataCurta, numero, relativo, useTitulo } from '../ui/util';
import { CartaoPessoa } from './CartaoPessoa';
import './Pessoas.css';

const POR_PAGINA = 50;
const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;

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
    return { termo: '', tipo: '', responsavel, situacao: params.get('situacao') === 'arquivadas' ? 'arquivadas' : 'ativas', pagina: 0 };
  });
  const [visao, setVisao] = useState<Visao>(() =>
    (params.get('visao') || lerPreferencia('pessoas.visao', 'tabela')) === 'kanban' && params.get('situacao') !== 'arquivadas' ? 'kanban' : 'tabela');
  // Ordem escolhida (cada visualização tem a sua). Na tabela, mudar a ordem volta para a primeira página.
  // Ordem da tabela (controle "Ordenar" da barra; mudar volta para a primeira página). No quadro, cada
  // coluna tem a sua, no menu da coluna.
  const ordem = useOrdem('pessoas', 'tabela');
  const ordenacao = { ...ordem, aoMudar: (o: Ordem) => { ordem.aoMudar(o); setF(atual => ({ ...atual, pagina: 0 })); } };
  const [recarga, setRecarga] = useState(0);
  const recarregar = () => setRecarga(n => n + 1);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [tabela, setTabela] = useState<Pagina<PessoaLista> | null>(null);
  const [erroTabela, setErroTabela] = useState('');

  // O cartão aberto fica na URL (?id=...), para o link levar direto à pessoa.
  const aberto = params.get('id');
  const abrir = (id: string) => setParams({ id }, { replace: true });
  const fechar = () => setParams({}, { replace: true });
  useEffect(() => {
    if (['visao', 'responsavel', 'situacao'].some(k => params.has(k))) setParams(aberto ? { id: aberto } : {}, { replace: true });
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
  }, [visao, f, ordem.valor, recarga]);

  const filtrado = !!(f.termo || f.tipo || f.responsavel);
  const mudarFiltro = (campos: Partial<FiltroPessoas>) => { setF(atual => ({ ...atual, ...campos, pagina: 0 })); setSelecionadas(new Set()); };

  function trocarVisao(v: Visao) {
    if (v === 'kanban' && f.situacao === 'arquivadas') {
      mudarFiltro({ situacao: 'ativas' });
      avisar('O quadro mostra só as pessoas ativas.', 'ok');
    }
    setVisao(v);
    salvarPreferencia('pessoas.visao', v);
    setSelecionadas(new Set());
  }
  function mudarSituacao(valor: string) {
    const situacao = valor === 'arquivadas' ? 'arquivadas' : 'ativas';
    mudarFiltro({ situacao });
    if (situacao === 'arquivadas' && visao === 'kanban') { setVisao('tabela'); avisar('As arquivadas aparecem só na tabela.', 'ok'); }
  }

  // ---------- ações em lote ----------
  async function arquivarLote(arquivar: boolean) {
    const lista = [...selecionadas];
    try {
      const q = await SD.pessoasArquivar(lista, arquivar);
      const quantas = q === 1 ? '1 pessoa' : q + ' pessoas';
      feito(arquivar ? `${plural(q, 'pessoa arquivada', 'pessoas arquivadas')}.` : `${plural(q, 'pessoa voltou', 'pessoas voltaram')} para as ativas.`,
        arquivar ? `arquivamento de ${quantas}` : `desarquivamento de ${quantas}`, async () => { await SD.pessoasArquivar(lista, !arquivar); });
      setSelecionadas(new Set()); recarregar();
    } catch (e) { falha(e); }
  }
  async function excluirLote() {
    try {
      const r = await SD.pessoasExcluir([...selecionadas]);
      avisar(r.naoExcluidas
        ? `${r.excluidas} excluída(s). ${r.naoExcluidas} não pôde(puderam) ser excluída(s): ${r.motivo || 'só quem cadastrou ou um administrador exclui.'}`
        : `${plural(r.excluidas, 'pessoa excluída', 'pessoas excluídas')} definitivamente.`, r.naoExcluidas ? 'erro' : 'ok');
      setSelecionadas(new Set()); recarregar();
    } catch (e) { falha(e); }
  }
  // ---------- exportar ----------
  // Leva as pessoas da lista como ela está filtrada (busca, tipo, responsável, situação) para o Google Contatos.
  // Só administradores: é a base inteira de clientes saindo do sistema.
  async function exportarGoogle() {
    const quantas = visao === 'tabela' && tabela ? plural(tabela.total, 'pessoa', 'pessoas') : 'as pessoas';
    const escolha = await janela<'com' | 'sem'>({
      titulo: 'Exportar para o Google Contatos',
      corpo: <>
        <p>Gera um arquivo CSV com {quantas} desta lista{filtrado || f.situacao === 'arquivadas' ? ', com os filtros escolhidos' : ''}. No Google Contatos, use "Importar" e escolha o arquivo.</p>
        <div className="opcoes-janela" role="radiogroup" aria-label="Descrição dos contatos">
          <label><input type="radio" name="descricao" value="com" defaultChecked />
            <span>Com a qualificação na descrição<small>Nome, telefones, e-mails, aniversário e a qualificação completa.</small></span></label>
          <label><input type="radio" name="descricao" value="sem" />
            <span>Sem descrição<small>Só nome, telefones, e-mails e aniversário.</small></span></label>
        </div>
        <p className="sub">O Google cria contatos novos ao importar: quem já estiver lá fica repetido. Depois, use "Mesclar e corrigir" no Google.</p>
      </>,
      acoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Baixar arquivo', tipo: 'pri', valor: j => j.querySelector<HTMLInputElement>('input[name="descricao"]:checked')?.value === 'sem' ? 'sem' : 'com' }]
    });
    if (!escolha) return;
    try {
      const pessoas = await SD.pessoasExportar({ termo: f.termo, tipo: f.tipo, responsavel: f.responsavel, situacao: f.situacao });
      if (!pessoas.length) { avisar('Nenhuma pessoa para exportar com esses filtros.', 'erro'); return; }
      // Na qualificação das pessoas jurídicas entra quem as representa (vínculo "Representante legal de").
      const representantes: Record<string, Representante[]> = {};
      if (escolha === 'com') {
        for (const r of await SD.representantesVinculados(pessoas.filter(p => p.tipo === 'pj').map(p => p.id))) (representantes[r.pj_id] ||= []).push(r);
      }
      const hoje = new Date().toLocaleDateString('sv-SE');
      baixarArquivo(`contatos-google-${escolha}-qualificacao-${hoje}.csv`, csvContatosGoogle(pessoas, { comQualificacao: escolha === 'com', representantes }));
      avisar(`${plural(pessoas.length, 'contato exportado', 'contatos exportados')}.`, 'ok');
    } catch (e) { falha(e); }
  }

  const n = selecionadas.size;
  const lote = visao === 'tabela' && n > 0 ? <>
    <span><b>{n}</b> {n === 1 ? 'selecionada' : 'selecionadas'} <button type="button" className="link" style={{ color: '#DCDCD4', marginLeft: 8 }} onClick={() => setSelecionadas(new Set())}>limpar</button></span>
    <span className="acoes-lote">{f.situacao === 'ativas'
      ? <button type="button" className="mini" onClick={() => arquivarLote(true)}><Icone nome="arquivo" tam={15} /> Arquivar</button>
      : <>
        <button type="button" className="mini" onClick={() => arquivarLote(false)}><Icone nome="arquivo" tam={15} /> Desarquivar</button>
        <BotaoDuplo className="mini perigo" confirmar={`Confirmar exclusão de ${n}`} aoConfirmar={excluirLote}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>
      </>}</span>
  </> : null;

  const lead = visao === 'kanban'
    ? 'Acompanhamento do atendimento. Arraste os cartões entre as colunas; a ordem de cada coluna muda no menu dela (⋯).'
    : tabela ? `${plural(tabela.total, f.situacao === 'arquivadas' ? 'pessoa arquivada' : 'pessoa ativa', f.situacao === 'arquivadas' ? 'pessoas arquivadas' : 'pessoas ativas')}${filtrado ? ' com os filtros escolhidos' : ''}.` : null;

  return <>
    <PaginaModulo olho="Cadastro comum do escritório" titulo="Pessoas" acao={{ rotulo: 'Nova pessoa', para: '/pessoas/nova/' }}
      busca={{ placeholder: 'Nome, CPF/CNPJ, telefone, e-mail ou código', aoBuscar: termo => mudarFiltro({ termo }) }}
      filtros={[
        { id: 'tipo', rotulo: 'Tipo de cadastro', valor: f.tipo || '', aoMudar: tipo => mudarFiltro({ tipo }),
          opcoes: [['', 'Todos os tipos'], ['pf', 'Pessoa física'], ['pj', 'Pessoa jurídica'], ['contato', 'Somente contato']] },
        { id: 'responsavel', rotulo: 'Responsável', valor: f.responsavel || '',
          aoMudar: responsavel => { mudarFiltro({ responsavel }); salvarPreferencia('pessoas.responsavel', responsavel); },
          opcoes: [['', 'Todos os responsáveis'], [eu, 'Sob minha responsabilidade'], ...ctx.equipe.filter(m => m.id !== eu).map(m => [m.id, m.nome] as [string, string])] },
        { id: 'situacao', rotulo: 'Situação', valor: f.situacao || 'ativas', aoMudar: mudarSituacao, opcoes: [['ativas', 'Ativas'], ['arquivadas', 'Arquivadas']] }
      ]}
      ordem={visao === 'tabela' ? ordenacao : undefined}
      mais={ctx.ehAdmin ? [{ rotulo: 'Exportar para o Google Contatos', icone: 'baixar', aoEscolher: exportarGoogle }] : undefined}
      visao={visao} aoTrocarVisao={trocarVisao} lead={lead} lote={lote}>
      {visao === 'kanban'
        ? <Kanban<PessoaLista> quadro={quadro}
          recarga={[recarga, f.termo, f.tipo, f.responsavel].join('|')}
          carregar={(colunaId, deslocamento, ordemDaColuna) => SD.pessoasDaEtapa(colunaId, { ...f, ordem: ordemDaColuna, situacao: 'ativas' }, deslocamento, 30)}
          ordemDe={p => p.etapa_ordem}
          cartao={(p, ordemDaColuna) => <CartaoKanban p={p} ordem={ordemDaColuna} />}
          aoAbrir={p => abrir(p.id)}
          aoMover={async (p, { de, para, ordem, ordemAnterior }) => {
            await SD.pessoaMover(p.id, para, ordem);
            const voltar = async () => { await SD.pessoaMover(p.id, de, ordemAnterior); };
            if (de !== para) feito(`${p.nome} foi para "${quadro.nomeDe(para) || 'Sem etapa'}".`, 'movimentação do cartão', voltar);
            else registrarDesfazer('mudança de posição do cartão', voltar);
          }}
          aoAdicionar={colunaId => navegar('/pessoas/nova/' + (colunaId ? '?etapa=' + colunaId : ''))} />
        : <Tabela pagina={tabela} erro={erroTabela} f={f} ordem={ordem.valor} filtrado={filtrado} selecionadas={selecionadas} etapa={quadro.nomeDe}
          aoSelecionar={setSelecionadas} aoAbrir={abrir} aoPaginar={pagina => { setF(atual => ({ ...atual, pagina })); window.scrollTo({ top: 0 }); }} />}
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
    <div className="kt">{p.nome}</div>
    <div className="km">
      <span>{p.documento ? fmtDocumento(p.documento) : TIPOS[p.tipo]}</span>
      {p.telefones?.[0] && <span>{fmtTelefone(p.telefones[0])}</span>}
      {p.municipio && <span>{p.municipio}{p.uf ? '/' + p.uf : ''}</span>}
      {data && <span>{data}</span>}
    </div>
    <div className="kp"><span className="codigo">{p.codigo}</span><Avatares ids={p.resp.map(x => x.perfil_id)} equipe={ctx.equipe} max={4} tam={24} /></div>
  </>;
}

interface PropsTabela {
  pagina: Pagina<PessoaLista> | null;
  erro: string;
  f: FiltroPessoas;
  ordem: Ordem;
  filtrado: boolean;
  selecionadas: Set<string>;
  etapa: (id: string | null) => string;
  aoSelecionar: (s: Set<string>) => void;
  aoAbrir: (id: string) => void;
  aoPaginar: (pagina: number) => void;
}

function Tabela({ pagina, erro, f, ordem, filtrado, selecionadas, etapa, aoSelecionar, aoAbrir, aoPaginar }: PropsTabela) {
  const ctx = useCtx();
  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!pagina) return <p className="carregando">Carregando…</p>;
  const { linhas, total } = pagina;
  if (!linhas.length) return <div className="vazio">{filtrado ? 'Nenhuma pessoa encontrada com esses filtros.'
    : f.situacao === 'arquivadas' ? 'Nenhuma pessoa arquivada.'
    : <>Nenhuma pessoa cadastrada ainda. <Link className="link" to="/pessoas/nova/">Cadastrar a primeira</Link></>}</div>;

  const pg = f.pagina || 0, de = pg * POR_PAGINA + 1, ate = pg * POR_PAGINA + linhas.length;
  const todas = linhas.every(p => selecionadas.has(p.id));
  // Ordenando pela data de cadastro, a última coluna mostra essa data; nas outras ordens, a última atualização.
  const porCadastro = ordem === 'novos' || ordem === 'antigos';
  const marcar = (ids: string[], sim: boolean) => {
    const s = new Set(selecionadas);
    ids.forEach(id => sim ? s.add(id) : s.delete(id));
    aoSelecionar(s);
  };
  return <div>
    <div className="tabela tabela-pessoas"><table>
      <thead><tr>
        <th className="td-check"><input type="checkbox" aria-label="Selecionar todas desta página" checked={todas} onChange={e => marcar(linhas.map(p => p.id), e.target.checked)} /></th>
        <th scope="col">Pessoa</th><th scope="col">Telefone</th><th scope="col">Município</th>
        <th scope="col">Etapa</th><th scope="col">Responsáveis</th><th scope="col">{porCadastro ? 'Cadastrada' : 'Atualizada'}</th>
      </tr></thead>
      <tbody>{linhas.map(p => <tr key={p.id} className={'clicavel' + (selecionadas.has(p.id) ? ' marcada' : '')}
        onClick={e => { if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) aoAbrir(p.id); }}>
        <td className="td-check"><input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={selecionadas.has(p.id)} onChange={e => marcar([p.id], e.target.checked)} /></td>
        <td><div className="nome">{p.nome}</div><div className="sub">{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''} · <span className="codigo">{p.codigo}</span></div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{fmtTelefone(p.telefones?.[0] || '')}{p.telefones?.length > 1 && <> <span className="sub">+{p.telefones.length - 1}</span></>}</td>
        <td>{p.municipio ? p.municipio + (p.uf ? '/' + p.uf : '') : ''}</td>
        <td><span className="etapa-txt">{etapa(p.etapa_id)}</span></td>
        <td><Avatares ids={p.resp.map(x => x.perfil_id)} equipe={ctx.equipe} /></td>
        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{porCadastro ? dataCurta(p.criado_em) : relativo(p.atualizado_em)}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="paginacao" style={{ marginTop: 12 }}>
      <span>Mostrando {numero(de)}–{numero(ate)} de {numero(total)}</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="mini" disabled={pg === 0} onClick={() => aoPaginar(pg - 1)}>Anterior</button>
        <button type="button" className="mini" disabled={ate >= total} onClick={() => aoPaginar(pg + 1)}>Próxima</button>
      </span>
    </div>
  </div>;
}
