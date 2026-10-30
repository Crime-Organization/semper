// Cartão da pessoa (painel lateral): ações, etapa, responsáveis, qualificação, o que está ligado a ela nos outros
// módulos (contratos e, depois, demandas, tarefas...), vínculos, dados, informações sigilosas e histórico de alterações.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SD, type AcessoSigilo, type Coluna, type ContratoDaPessoa, type Historico, type Pessoa, type Sigilo, type Vinculo } from '../dados';
import { TAMANHO_SIGILO } from '../dados/limites';
import { ordemNoFim } from '../ui/quadro/posicao';
import { PAPEIS_NO_CONTRATO, SEM_SITUACAO } from '../regras/contrato';
import { CAMPOS, qualificacao, TIPO_REPRESENTANTE, TIPOS, valorLegivel, type Representante } from '../regras/pessoa';
import { Avatar } from '../ui/Avatar';
import { SecaoComentarios } from '../ui/Comentarios';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoLink, Carregando, estiloBotao, Nota, Selo, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { ItensLigados } from '../ui/ItensLigados';
import { pedirTexto } from '../ui/janela';
import { Recolhivel } from '../ui/Recolhivel';
import type { Quadro } from '../ui/quadro/useColunas';
import { AcoesDoCartao } from '../ui/AcoesDoCartao';
import { useCtx } from '../ui/sessao';
import NovaPessoa from './NovaPessoa';
import { copiarTexto, dataCurta, dataHora, relativo } from '../ui/util';
import { CartoesLigados } from './CartoesLigados';
import { VinculosPessoa } from './VinculosPessoa';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
  /** Abre o cartão de outra pessoa (pelos vínculos). */
  aoAbrirPessoa: (id: string) => void;
}

export function CartaoPessoa({ id, quadro, aoMudar, aoFechar, aoAbrirPessoa }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [p, setP] = useState<Pessoa | null | undefined>(undefined);   // undefined: carregando; null: não existe
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  // Lápis: o cartão vira o formulário, com todos os campos de uma vez (o cadastro em etapas fica para criar).
  const [editando, setEditando] = useState(false);
  const [versaoSig, setVersaoSig] = useState(0);
  const qual = useRef<HTMLDivElement>(null);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.pessoaObter(id).then(x => { setP(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Os vínculos carregam com a pessoa, para a quantidade aparecer mesmo com a seção fechada.
  const [vinculos, setVinculos] = useState<Vinculo[] | string | null>(null);
  const carregarVinculos = useCallback(() => SD.vinculosListar(id).then(setVinculos).catch(e => setVinculos((e as Error).message)), [id]);
  useEffect(() => { void carregarVinculos(); }, [carregarVinculos]);
  // Pessoa jurídica: quem a representa (vínculo "Representante legal de") entra no fim da qualificação, com a qualificação dele.
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const ehPJ = p?.tipo === 'pj';
  useEffect(() => {
    const deles = ehPJ && Array.isArray(vinculos) ? vinculos.filter(v => v.tipo.nome === TIPO_REPRESENTANTE && v.pessoa_para === id) : [];
    if (!deles.length) { setRepresentantes([]); return; }
    let vivo = true;
    SD.representantesVinculados([id]).then(r => { if (vivo) setRepresentantes(r); }).catch(() => { if (vivo) setRepresentantes([]); });
    return () => { vivo = false; };
  }, [vinculos, ehPJ, id]);
  // Os contratos ligados à pessoa (como cliente, participante, indicadora ou, se for da equipe, responsável) carregam com
  // ela, para a quantidade aparecer mesmo com a seção fechada. Só no escritório com o módulo Contratos ligado.
  const comContratos = !!ctx.escritorio?.modulos?.contratos;
  const perfilDaPessoa = ctx.equipe.find(m => m.pessoa_id === id)?.id ?? null;
  const [contratos, setContratos] = useState<ContratoDaPessoa[] | string | null>(null);
  const carregarContratos = useCallback(async () => {
    if (!comContratos) return;
    try { setContratos(await SD.contratosDaPessoa(id, perfilDaPessoa)); } catch (e) { setContratos((e as Error).message); }
  }, [id, perfilDaPessoa, comContratos]);
  useEffect(() => { void carregarContratos(); }, [carregarContratos]);
  // Depois de desfazer: mostra a pessoa como ficou.
  useMudancas(d => {
    void carregar();
    void carregarVinculos();
    void carregarContratos();
    setVersaoHist(v => v + 1);
    if (d.tipo === 'sigilo') setVersaoSig(v => v + 1);
  });

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (p === undefined) return <Carregando />;
  if (!p) return <Vazio>Esta pessoa não foi encontrada. Ela pode ter sido excluída.</Vazio>;

  const V = (campo: string, v: unknown = (p as unknown as Record<string, unknown>)[campo]) =>
    v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? '' : valorLegivel(campo, v);
  const textoQual = qualificacao(p, { representantes });
  const podeExcluir = !!p.arquivado_em && (p.criado_por === eu || ctx.ehAdmin);
  const ehUsuario = ctx.equipe.some(m => m.pessoa_id === p.id);
  const local = (mun: string | null, uf: string | null) => mun ? mun + (uf ? '/' + uf : '') : '';

  async function arquivar() {
    const estava = !!p!.arquivado_em;
    try {
      await SD.pessoasArquivar([p!.id], !estava);
      feito(estava ? 'Pessoa desarquivada.' : 'Pessoa arquivada. Arquivadas podem ser excluídas depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.pessoasArquivar([p!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.pessoasExcluir([p!.id]);
    if (r.excluidas) { avisar('Pessoa excluída definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarEtapa(valor: string) {
    const etapa = valor || null, de = p!.etapa_id || null, ordemDe = p!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.pessoaMover(p!.id, etapa, ordem);
      setP({ ...p!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movida para "${quadro.nomeDe(etapa)}".` : 'Pessoa sem etapa.', 'mudança de etapa', async () => { await SD.pessoaMover(p!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function copiar() {
    if (await copiarTexto(textoQual, qual.current)) avisar('Qualificação copiada.');
    else avisar('Selecionei o texto: use Ctrl+C para copiar.');
  }

  function terminarEdicao(salvou: boolean) {
    setEditando(false);
    if (salvou) { aoMudar(); void carregar(); setVersaoHist(x => x + 1); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">{TIPOS[p.tipo]}</Selo><span className="codigo">{p.codigo}</span>
        {p.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
        {ehUsuario && <Selo tipo="ok">Usuária do sistema</Selo>}
        {!editando && <AcoesDoCartao arquivado={!!p.arquivado_em} aoArquivar={arquivar} aoEditar={() => setEditando(true)} />}
      </div>
      <h2>{p.nome}</h2>
      {p.nome_fantasia && <Nota style={{ marginTop: 4 }}>{p.nome_fantasia}</Nota>}
    </header>

    {editando ? <NovaPessoa edicao={{ id: p.id, aoTerminar: terminarEdicao }} /> : <>

    {/* A exclusão fica numa linha própria: ao pedir confirmação o botão cresce, e nada sai do lugar. */}
    {p.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Pessoa arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Pessoa arquivada. Só quem cadastrou esta pessoa ou um administrador pode excluí-la.'}</span>
      {podeExcluir && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão definitiva" aoConfirmar={excluir}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>}
    </div>}

    <section className="bloco campos">
      <h3><Icone nome="kanban" tam={14} />Etapa do atendimento</h3>
      <select aria-label="Etapa do atendimento" disabled={!!p.arquivado_em} value={p.etapa_id || ''} onChange={e => mudarEtapa(e.target.value)}>
        <option value="">Sem etapa</option>
        {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
      </select>
    </section>

    <section className="bloco">
      <h3><Icone nome="conta" tam={14} />Responsáveis</h3>
      <Responsaveis p={p} aoMudar={resp => { setP({ ...p, resp: resp.map(perfil_id => ({ perfil_id })) }); aoMudar(); }} />
    </section>

    {textoQual && <section className="bloco">
      <h3><Icone nome="texto" tam={14} />Qualificação</h3>
      <div className="qualificacao" ref={qual}>{textoQual}</div>
      {/* O botão fica junto do texto que ele copia. */}
      <div className="qualificacao-acoes">
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={copiar}><Icone nome="copiar" tam={13} /> Copiar qualificação</button>
        <Nota>Gerada a partir do cadastro. Fica só no SEMPER.</Nota>
      </div>
    </section>}

    {comContratos && <Recolhivel titulo="Contratos" icone="contratos" preferencia="pessoas.cartao.contratos"
      contador={Array.isArray(contratos) ? contratos.length : undefined}>
      {contratos === null ? <Carregando />
        : typeof contratos === 'string' ? <Aviso tipo="erro">{contratos}</Aviso>
        : <ContratosDaPessoa lista={contratos} pessoaId={p.id} />}
    </Recolhivel>}

    {ctx.escritorio?.modulos?.demandas && <Recolhivel titulo="Demandas" icone="demandas" preferencia="pessoas.cartao.demandas">
      <CartoesLigados modulo="demandas" carregar={() => SD.demandasDaPessoa(id, perfilDaPessoa)} vazio="Nenhuma demanda ligada a esta pessoa."
        nova={{ para: '/demandas/nova/?cliente=' + id, rotulo: 'Nova demanda com esta pessoa como cliente' }} />
    </Recolhivel>}

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="pessoas.cartao.tarefas">
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDaPessoa(id, perfilDaPessoa)} vazio="Nenhuma tarefa ligada a esta pessoa."
        nova={{ para: '/tarefas/nova/?pessoa=' + id, rotulo: 'Nova tarefa ligada a esta pessoa' }} />
    </Recolhivel>}

    <Recolhivel titulo="Vínculos" icone="vinculo" preferencia="pessoas.cartao.vinculos" contador={Array.isArray(vinculos) ? vinculos.length : undefined}>
      {vinculos === null ? <Carregando />
        : typeof vinculos === 'string' ? <Aviso tipo="erro">{vinculos}</Aviso>
        : <VinculosPessoa p={p} vinculos={vinculos} aoAbrirPessoa={aoAbrirPessoa} aoMudar={() => { void carregarVinculos(); setVersaoHist(v => v + 1); }} />}
    </Recolhivel>

    <Recolhivel titulo="Dados do cadastro" icone="cadastro" preferencia="pessoas.cartao.dados">
      <Grupo titulo="Identificação" linhas={[['Nome', p.nome], [p.tipo === 'pj' ? 'CNPJ' : 'CPF', V('documento')], ['Gênero', V('genero')],
        ['Nacionalidade', p.nacionalidade], ['Profissão', p.profissao], ['Estado civil', V('estado_civil')], ['RG', p.rg], ['Expedição do RG', V('rg_expedicao')]]} />
      <Grupo titulo="Filiação e nascimento" linhas={[['Mãe', p.nome_mae], ['Pai', p.nome_pai], ['Nascimento', V('nascimento')],
        ['Naturalidade', local(p.nascimento_municipio, p.nascimento_uf)]]} />
      <Grupo titulo="Empresa" linhas={[['Natureza jurídica', V('natureza')], ['Tipo de entidade', p.tipo_entidade], ['Nome fantasia', p.nome_fantasia],
        ['Porte', V('porte')], ['Abertura', V('abertura')], ['Representante(s)', p.representantes]]} />
      <Grupo titulo="Endereço" linhas={[['CEP', V('cep')], ['Logradouro', [p.logradouro, p.numero].filter(Boolean).join(', ')], ['Complemento', p.complemento],
        ['Bairro', p.bairro], ['Município', local(p.municipio, p.uf)]]} />
      <Grupo titulo="Contato" linhas={[['Telefones', V('telefones')], ['E-mails', V('emails')]]} />
      <Grupo titulo="Proteção de dados (LGPD)" linhas={[['Base legal', V('lgpd_base')], ['Consentimento em', V('lgpd_consentimento')]]} />
    </Recolhivel>

    {/* Sempre começa fechada: cada abertura é uma leitura registrada (LGPD) e o conteúdo não fica à vista de quem passa. */}
    <Recolhivel titulo="Informações sigilosas" icone="cadeado">
      <Sigilos p={p} versao={versaoSig} aoMudar={() => setVersaoSig(v => v + 1)} />
    </Recolhivel>

    <SecaoComentarios modulo="pessoas" cartaoId={p.id} />

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="pessoas.cartao.historico">
      <HistoricoPessoa id={p.id} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Cadastrada em {dataCurta(p.criado_em)}{p.criado_por ? ' por ' + nomeDe(p.criado_por) : ''}</span>
      <span>Atualizada {relativo(p.atualizado_em)}</span>
    </footer>
    </>}
  </>;
}

function Grupo({ titulo, linhas }: { titulo: string; linhas: [string, ReactNode][] }) {
  // oxlint-disable-next-line typescript/no-misused-promises -- os valores são textos; no React 19 o tipo ReactNode inclui Promise
  const cheias = linhas.filter(([, v]) => v);
  if (!cheias.length) return null;
  return <div className="grupo-dados">
    <h4>{titulo}</h4>
    <dl className="dados">{cheias.map(([r, v]) => <Par key={r} rotulo={r} valor={v} />)}</dl>
  </div>;
}
const Par = ({ rotulo, valor }: { rotulo: string; valor: ReactNode }) => <><dt>{rotulo}</dt><dd>{valor}</dd></>;

// ---------- contratos ----------
function ContratosDaPessoa({ lista, pessoaId }: { lista: ContratoDaPessoa[]; pessoaId: string }) {
  // A situação de cada contrato é o nome da coluna dele no quadro de contratos.
  const [colunas, setColunas] = useState<Coluna[]>([]);
  useEffect(() => { SD.colunasListar('contratos').then(setColunas).catch(() => {}); }, []);
  const situacao = (etapa: string | null) => colunas.find(c => c.id === etapa)?.nome || SEM_SITUACAO;
  return <>
    <ItensLigados vazio="Nenhum contrato ligado a esta pessoa." itens={lista.map(k => ({
      id: k.id, para: '/contratos/?id=' + k.id, codigo: k.codigo, titulo: k.servico, selo: k.arquivado_em ? 'Arquivado' : undefined,
      detalhe: k.papeis.map(x => PAPEIS_NO_CONTRATO[x]).join(', ') + ' · ' + situacao(k.etapa_id)
    }))} />
    <div><BotaoLink forma="mini" to={'/contratos/novo/?cliente=' + pessoaId}><Icone nome="mais" tam={13} /> Novo contrato com esta pessoa como cliente</BotaoLink></div>
  </>;
}

// ---------- responsáveis ----------
function Responsaveis({ p, aoMudar }: { p: Pessoa; aoMudar: (resp: string[]) => void }) {
  const ctx = useCtx();
  const resp = p.resp.map(r => r.perfil_id);
  const nomeDe = (id: string) => ctx.equipe.find(m => m.id === id)?.nome || 'Usuário removido';
  const fora = ctx.equipe.filter(m => m.ativo && !resp.includes(m.id));

  async function tirar(id: string) {
    try {
      await SD.responsavelRemover(p.id, id);
      aoMudar(resp.filter(x => x !== id));
      feito(`${nomeDe(id)} saiu dos responsáveis.`, 'retirada do responsável', async () => { await SD.responsavelIncluir(p.id, id); });
    } catch (e) { falha(e); }
  }
  async function incluir(id: string) {
    if (!id) return;
    try {
      await SD.responsavelIncluir(p.id, id);
      aoMudar([...resp, id]);
      feito(`${nomeDe(id)} agora é responsável.`, 'inclusão do responsável', async () => { await SD.responsavelRemover(p.id, id); });
    } catch (e) { falha(e); }
  }

  return <div className="responsaveis">
    {resp.map(id => <span key={id} className="resp-chip">
      <Avatar p={ctx.equipe.find(m => m.id === id) || { id, nome: 'Usuário removido' }} tam={26} />
      {nomeDe(id)}
      <button type="button" aria-label={`Tirar ${nomeDe(id)} dos responsáveis`} onClick={() => tirar(id)}><Icone nome="fechar" tam={13} /></button>
    </span>)}
    {fora.length > 0 && <select className="filtro" aria-label="Incluir responsável" style={{ height: 34 }} value="" onChange={e => incluir(e.target.value)}>
      <option value="">+ Incluir responsável</option>
      {fora.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
    </select>}
    {!resp.length && <Nota style={{ flexBasis: '100%' }}>Nenhum responsável ainda.</Nota>}
  </div>;
}

// ---------- informações sigilosas ----------
// Cada leitura fica registrada no banco (LGPD); por isso só se relê quando algo dos sigilos muda.
function Sigilos({ p, versao, aoMudar }: { p: Pessoa; versao: number; aoMudar: () => void }) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [dados, setDados] = useState<{ lista: Sigilo[]; acessos: AcessoSigilo[] } | string | null>(null);
  const [texto, setTexto] = useState('');
  const nomeDe = (id: string) => ctx.equipe.find(m => m.id === id)?.nome || 'Usuário removido';
  const desfeito = { tipo: 'sigilo', id: p.id };

  useEffect(() => {
    let vivo = true;
    Promise.all([SD.sigilosListar(p.id), SD.sigiloAcessos(p.id)])
      .then(([lista, acessos]) => { if (vivo) setDados({ lista, acessos }); })
      .catch(e => { if (vivo) setDados((e as Error).message); });
    return () => { vivo = false; };
  }, [p.id, versao]);

  if (dados === null) return <Carregando />;
  if (typeof dados === 'string') return <Aviso tipo="erro">{dados}</Aviso>;
  const { lista, acessos } = dados;
  const veTodas = p.criado_por === eu || ctx.ehMaster || acessos.some(a => a.perfil_id === eu);
  const podeConceder = acessos[0]?.pode_conceder ?? (p.criado_por === eu || ctx.ehMaster || lista.some(s => s.criado_por === eu));
  const semAcesso = ctx.equipe.filter(m => m.ativo && m.id !== eu && m.id !== p.criado_por && !acessos.some(a => a.perfil_id === m.id));

  const agir = async (fn: () => Promise<unknown>) => { try { await fn(); aoMudar(); } catch (e) { falha(e); } };
  const registrar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) { falha(new Error('Escreva a informação sigilosa.')); return; }
    void agir(async () => {
      const novoId = await SD.sigiloSalvar(p.id, t);
      setTexto('');
      feito('Informação sigilosa registrada.', 'registro da informação sigilosa', async () => { await SD.sigiloApagar(novoId); return desfeito; });
    });
  };
  const editar = async (s: Sigilo) => {
    const novo = await pedirTexto('Editar informação sigilosa', s.texto, { multilinha: true });
    if (!novo || novo === s.texto) return;
    void agir(async () => {
      await SD.sigiloSalvar(p.id, novo, s.id);
      feito('Informação atualizada.', 'edição da informação sigilosa', async () => { await SD.sigiloSalvar(p.id, s.texto, s.id); return desfeito; });
    });
  };
  // Desfazer o apagar registra o texto de novo, agora em nome de quem desfez.
  const apagar = (s: Sigilo) => agir(async () => {
    await SD.sigiloApagar(s.id);
    feito('Informação apagada.', 'exclusão da informação sigilosa', async () => { await SD.sigiloSalvar(p.id, s.texto); return desfeito; });
  });
  const conceder = (id: string, sim: boolean) => agir(async () => {
    await SD.sigiloConceder(p.id, id, sim);
    feito(sim ? `${nomeDe(id)} agora vê as informações sigilosas desta pessoa.` : `${nomeDe(id)} não vê mais as informações sigilosas.`,
      sim ? 'concessão de acesso' : 'retirada de acesso', async () => { await SD.sigiloConceder(p.id, id, !sim); return desfeito; });
  });

  return <>
    {lista.length ? lista.map(s => <div key={s.id} className="sigilo">
      <div className="sigilo-texto" style={{ whiteSpace: 'pre-wrap' }}>{s.texto}</div>
      <div className="meta">
        <span>{s.autor || 'Usuário removido'} · {dataHora(s.atualizado_em)}</span>
        {s.pode_editar && <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => editar(s)}><Icone nome="editar" tam={13} /> Editar</button>
          <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar" aoConfirmar={() => apagar(s)}>Apagar</BotaoDuplo>
        </span>}
      </div>
    </div>)
      : <Nota>{veTodas ? 'Nenhuma informação sigilosa registrada.'
        : 'Você não tem acesso às informações sigilosas desta pessoa, se houver. Você pode registrar uma: ela ficará visível para você, para quem cadastrou a pessoa e para o master.'}</Nota>}
    <form className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onSubmit={registrar}>
      <label>Registrar informação sigilosa<textarea maxLength={TAMANHO_SIGILO} placeholder="Visível só para quem tem acesso" value={texto} onChange={e => setTexto(e.target.value)} /></label>
      <div><button className={estiloBotao({ variante: 'escuro', pequeno: true })} type="submit">Salvar informação</button></div>
    </form>
    {podeConceder && <div className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p className="rotulo-caps">Quem mais vê</p>
      <div className="responsaveis">
        {acessos.length ? acessos.map(a => <span key={a.perfil_id} className="resp-chip">
          <Avatar p={ctx.equipe.find(m => m.id === a.perfil_id) || { id: a.perfil_id, nome: a.nome }} tam={26} /> {a.nome}
          <button type="button" aria-label={`Tirar o acesso de ${a.nome}`} onClick={() => conceder(a.perfil_id, false)}><Icone nome="fechar" tam={13} /></button>
        </span>) : <Nota>Só quem cadastrou a pessoa, quem escreveu e o master.</Nota>}
        {semAcesso.length > 0 && <select className="filtro" style={{ height: 34 }} aria-label="Conceder acesso" value="" onChange={e => { if (e.target.value) void conceder(e.target.value, true); }}>
          <option value="">+ Conceder acesso</option>
          {semAcesso.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>}
      </div>
    </div>}
  </>;
}

// ---------- histórico ----------
function HistoricoPessoa({ id, versao }: { id: string; versao: number }) {
  const ctx = useCtx();
  const [hist, setHist] = useState<Historico[] | string | null>(null);
  const nomeDe = (pid: string) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';
  useEffect(() => {
    let vivo = true;
    SD.pessoaHistorico(id).then(h => { if (vivo) setHist(h); }).catch(e => { if (vivo) setHist((e as Error).message); });
    return () => { vivo = false; };
  }, [id, versao]);

  if (hist === null) return <Carregando />;
  if (typeof hist === 'string') return <Aviso tipo="erro">{hist}</Aviso>;
  if (!hist.length) return <Nota>Nenhuma alteração desde o cadastro.</Nota>;
  return <ol className="hist">{hist.map(h => <li key={h.id}>
    <span className="quando">{dataHora(h.em)} · {h.feito_por ? nomeDe(h.feito_por) : 'Sistema'}</span>
    {Object.entries(h.alteracoes).map(([campo, v]) => {
      if (campo === 'arquivado_em') return <div key={campo}>{v.para ? 'Arquivada' : 'Desarquivada'}</div>;
      const de = valorLegivel(campo, v.de), para = valorLegivel(campo, v.para);
      return <div key={campo}><b>{CAMPOS[campo] || campo}:</b> {de !== '—' && <><span className="de">{de}</span> → </>}{para}</div>;
    })}
  </li>)}</ol>;
}
