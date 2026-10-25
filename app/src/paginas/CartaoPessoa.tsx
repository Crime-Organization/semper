// Cartão da pessoa (painel lateral): ações, etapa, responsáveis, qualificação, dados, informações
// sigilosas e histórico de alterações.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SD, type AcessoSigilo, type Historico, type Pessoa, type Sigilo } from '../dados';
import { CAMPOS, qualificacao, TIPOS, valorLegivel } from '../regras/pessoa';
import { Avatar } from '../ui/Avatar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { pedirTexto } from '../ui/janela';
import { Recolhivel } from '../ui/Recolhivel';
import type { Quadro } from '../ui/quadro/useColunas';
import { useCtx } from '../ui/sessao';
import { copiarTexto, dataCurta, dataHora, relativo } from '../ui/util';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoPessoa({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [p, setP] = useState<Pessoa | null | undefined>(undefined);   // undefined: carregando; null: não existe
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  const [versaoSig, setVersaoSig] = useState(0);
  const qual = useRef<HTMLDivElement>(null);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.pessoaObter(id).then(x => { setP(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { carregar(); }, [carregar]);
  // Depois de desfazer: mostra a pessoa como ficou.
  useMudancas(d => {
    carregar();
    setVersaoHist(v => v + 1);
    if (d.tipo === 'sigilo') setVersaoSig(v => v + 1);
  });

  if (erro) return <div className="aviso erro">{erro}</div>;
  if (p === undefined) return <p className="carregando">Carregando…</p>;
  if (!p) return <div className="vazio">Esta pessoa não foi encontrada. Ela pode ter sido excluída.</div>;

  const V = (campo: string, v: unknown = (p as unknown as Record<string, unknown>)[campo]) =>
    v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? '' : valorLegivel(campo, v);
  const textoQual = qualificacao(p);
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
    const etapa = valor || null, de = p!.etapa_id || null, ordemDe = p!.etapa_ordem ?? null, ordem = Date.now() / 1000;
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

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <span className="selo escuro">{TIPOS[p.tipo]}</span><span className="codigo">{p.codigo}</span>
        {p.arquivado_em && <span className="selo arq">Arquivada</span>}
        {ehUsuario && <span className="selo ok">Usuária do sistema</span>}
      </div>
      <h2>{p.nome}</h2>
      {p.nome_fantasia && <p className="nota" style={{ marginTop: 4 }}>{p.nome_fantasia}</p>}
    </header>

    {/* Ações numa linha só. Em espaço estreito, Copiar e Arquivar viram botões redondos só com o ícone (estilo.css, "cartao-acoes"). */}
    <div className="cartao-acoes">
      <Link className="btn pri btn-sm" to={'/pessoas/nova/?id=' + p.id}><Icone nome="editar" tam={15} /> Atualizar cadastro</Link>
      {textoQual && <button type="button" className="btn btn-sm acao-copiar" title="Copiar qualificação" aria-label="Copiar qualificação" onClick={copiar}>
        <Icone nome="copiar" tam={15} /><span className="acao-rotulo">Copiar qualificação</span>
      </button>}
      <Botao className="btn btn-sm acao-arquivar" title={p.arquivado_em ? 'Desarquivar' : 'Arquivar'} aria-label={p.arquivado_em ? 'Desarquivar' : 'Arquivar'} onClick={arquivar}>
        <Icone nome="arquivo" tam={15} /><span className="acao-rotulo">{p.arquivado_em ? 'Desarquivar' : 'Arquivar'}</span>
      </Botao>
    </div>
    {/* A exclusão fica numa linha própria: ao pedir confirmação o botão cresce, e nada sai do lugar. */}
    {p.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Pessoa arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Pessoa arquivada. Só quem cadastrou esta pessoa ou um administrador pode excluí-la.'}</span>
      {podeExcluir && <BotaoDuplo className="btn btn-sm perigo" confirmar="Confirmar exclusão definitiva" aoConfirmar={excluir}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>}
    </div>}

    <section className="bloco campos">
      <h3>Etapa do atendimento</h3>
      <select aria-label="Etapa do atendimento" disabled={!!p.arquivado_em} value={p.etapa_id || ''} onChange={e => mudarEtapa(e.target.value)}>
        <option value="">Sem etapa</option>
        {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
      </select>
    </section>

    <section className="bloco">
      <h3>Responsáveis</h3>
      <Responsaveis p={p} aoMudar={resp => { setP({ ...p, resp: resp.map(perfil_id => ({ perfil_id })) }); aoMudar(); }} />
    </section>

    {textoQual && <section className="bloco">
      <h3>Qualificação</h3>
      <div className="qualificacao" ref={qual}>{textoQual}</div>
      <p className="nota">Gerada a partir do cadastro. Fica só no SEMPER.</p>
    </section>}

    <Recolhivel titulo="Dados do cadastro" preferencia="pessoas.cartao.dados">
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

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="pessoas.cartao.historico">
      <HistoricoPessoa id={p.id} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Cadastrada em {dataCurta(p.criado_em)}{p.criado_por ? ' por ' + nomeDe(p.criado_por) : ''}</span>
      <span>Atualizada {relativo(p.atualizado_em)}</span>
    </footer>
  </>;
}

function Grupo({ titulo, linhas }: { titulo: string; linhas: [string, ReactNode][] }) {
  const cheias = linhas.filter(([, v]) => v);
  if (!cheias.length) return null;
  return <div className="grupo-dados">
    <h4>{titulo}</h4>
    <dl className="dados">{cheias.map(([r, v]) => <Par key={r} rotulo={r} valor={v} />)}</dl>
  </div>;
}
const Par = ({ rotulo, valor }: { rotulo: string; valor: ReactNode }) => <><dt>{rotulo}</dt><dd>{valor}</dd></>;

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
    {!resp.length && <p className="nota" style={{ flexBasis: '100%' }}>Nenhum responsável ainda.</p>}
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

  if (dados === null) return <p className="carregando">Carregando…</p>;
  if (typeof dados === 'string') return <div className="aviso erro">{dados}</div>;
  const { lista, acessos } = dados;
  const veTodas = p.criado_por === eu || ctx.ehMaster || acessos.some(a => a.perfil_id === eu);
  const podeConceder = acessos[0]?.pode_conceder ?? (p.criado_por === eu || ctx.ehMaster || lista.some(s => s.criado_por === eu));
  const semAcesso = ctx.equipe.filter(m => m.ativo && m.id !== eu && m.id !== p.criado_por && !acessos.some(a => a.perfil_id === m.id));

  const agir = async (fn: () => Promise<unknown>) => { try { await fn(); aoMudar(); } catch (e) { falha(e); } };
  const registrar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) { falha(new Error('Escreva a informação sigilosa.')); return; }
    agir(async () => {
      const novoId = await SD.sigiloSalvar(p.id, t);
      setTexto('');
      feito('Informação sigilosa registrada.', 'registro da informação sigilosa', async () => { await SD.sigiloApagar(novoId); return desfeito; });
    });
  };
  const editar = async (s: Sigilo) => {
    const novo = await pedirTexto('Editar informação sigilosa', s.texto, { multilinha: true });
    if (!novo || novo === s.texto) return;
    agir(async () => {
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
          <button type="button" className="mini" onClick={() => editar(s)}><Icone nome="editar" tam={13} /> Editar</button>
          <BotaoDuplo className="mini perigo" confirmar="Confirmar" aoConfirmar={() => apagar(s)}>Apagar</BotaoDuplo>
        </span>}
      </div>
    </div>)
      : <p className="nota">{veTodas ? 'Nenhuma informação sigilosa registrada.'
        : 'Você não tem acesso às informações sigilosas desta pessoa, se houver. Você pode registrar uma: ela ficará visível para você, para quem cadastrou a pessoa e para o master.'}</p>}
    <form className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onSubmit={registrar}>
      <label>Registrar informação sigilosa<textarea maxLength={5000} placeholder="Visível só para quem tem acesso" value={texto} onChange={e => setTexto(e.target.value)} /></label>
      <div><button className="btn esc btn-sm" type="submit">Salvar informação</button></div>
    </form>
    {podeConceder && <div className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p className="rotulo-caps">Quem mais vê</p>
      <div className="responsaveis">
        {acessos.length ? acessos.map(a => <span key={a.perfil_id} className="resp-chip">
          <Avatar p={ctx.equipe.find(m => m.id === a.perfil_id) || { id: a.perfil_id, nome: a.nome }} tam={26} /> {a.nome}
          <button type="button" aria-label={`Tirar o acesso de ${a.nome}`} onClick={() => conceder(a.perfil_id, false)}><Icone nome="fechar" tam={13} /></button>
        </span>) : <p className="nota">Só quem cadastrou a pessoa, quem escreveu e o master.</p>}
        {semAcesso.length > 0 && <select className="filtro" style={{ height: 34 }} aria-label="Conceder acesso" value="" onChange={e => { if (e.target.value) conceder(e.target.value, true); }}>
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

  if (hist === null) return <p className="carregando">Carregando…</p>;
  if (typeof hist === 'string') return <div className="aviso erro">{hist}</div>;
  if (!hist.length) return <p className="nota">Nenhuma alteração desde o cadastro.</p>;
  return <ol className="hist">{hist.map(h => <li key={h.id}>
    <span className="quando">{dataHora(h.em)} · {h.feito_por ? nomeDe(h.feito_por) : 'Sistema'}</span>
    {Object.entries(h.alteracoes).map(([campo, v]) => {
      if (campo === 'arquivado_em') return <div key={campo}>{v.para ? 'Arquivada' : 'Desarquivada'}</div>;
      const de = valorLegivel(campo, v.de), para = valorLegivel(campo, v.para);
      return <div key={campo}><b>{CAMPOS[campo] || campo}:</b> {de !== '—' && <><span className="de">{de}</span> → </>}{para}</div>;
    })}
  </li>)}</ol>;
}
