// Equipe e acessos (master e administradores): liberar acesso a uma pessoa cadastrada, papéis,
// desativar e reativar, convites pendentes e o registro de ações exigido pela LGPD.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { MARCA } from '../marca';
import { SD, type Convite, type Papel, type PessoaLista, type RegistroAuditoria, type Usuario } from '../dados';
import { emailValido, fmtDocumento, TIPOS } from '../regras/pessoa';
import { Avatar } from '../ui/Avatar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { useSessao } from '../ui/sessao';
import { copiarTexto, dataHora, PAPEIS, relativo, useAtrasado, useTitulo } from '../ui/util';
import './Equipe.css';

export default function Equipe() {
  useTitulo('Equipe e acessos');
  const { ctx } = useSessao();
  if (!ctx.ehAdmin) return <Navigate to="/inicio/" replace />;
  return <PainelEquipe />;
}

const TABELAS: Record<string, string> = {
  pessoas: 'cadastro de pessoa', pessoa_responsaveis: 'responsáveis de', pessoa_sigilos: 'informação sigilosa de',
  pessoa_sigilo_acessos: 'acesso às informações sigilosas de', perfis: 'usuário', convites: 'convite'
};
const ACOES: Record<string, string> = { inclusao: 'incluiu', alteracao: 'alterou', exclusao: 'excluiu', leitura: 'leu' };
const linkAcesso = () => location.origin + '/?primeiro-acesso';
const mensagemConvite = (c: Convite) =>
  `Olá! Seu acesso ao ${MARCA.submarca} (${MARCA.nome}) foi liberado. Entre em ${linkAcesso()} e crie sua senha usando o e-mail ${c.email}.`;
async function copiar(texto: string) {
  if (await copiarTexto(texto)) avisar('Mensagem copiada. Envie para a pessoa.');
  else avisar(texto, 'ok');
}

function PainelEquipe() {
  const { ctx, recarregar } = useSessao();
  const eu = ctx.perfil.id;
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [registro, setRegistro] = useState<RegistroAuditoria[] | string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([SD.equipeListar(), SD.convitesListar()]);
      setUsuarios(u); setConvites(c);
    } catch (e) { falha(e); }
    SD.auditoriaListar(60).then(setRegistro).catch(e => setRegistro((e as Error).message));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useMudancas(() => { carregar(); });
  // Papéis e situação mudam a equipe que as outras telas mostram.
  const mudouEquipe = () => { carregar(); recarregar(true); };

  const lista = usuarios || [];
  const n = (fn: (u: Usuario) => boolean) => lista.filter(fn).length;
  const podeGerir = (u: Usuario) => u.id !== eu && u.papel !== 'master' && (u.papel !== 'admin' || ctx.ehMaster);
  const nomeDe = (id: string | null) => lista.find(u => u.id === id)?.nome || ctx.equipe.find(u => u.id === id)?.nome || 'Sistema';

  async function trocarPapel(u: Usuario, papel: Papel) {
    const antes = u.papel;
    try {
      await SD.equipeDefinirPapel(u.id, papel);
      feito(`${u.nome} agora é ${PAPEIS[papel].toLowerCase()}.`, 'troca de papel', async () => { await SD.equipeDefinirPapel(u.id, antes); recarregar(true); });
      mudouEquipe();
    } catch (e) { falha(e); carregar(); }
  }
  async function definirAtivo(u: Usuario, ativar: boolean) {
    try {
      await SD.equipeDefinirAtivo(u.id, ativar);
      feito(ativar ? `${u.nome} pode entrar de novo.` : `${u.nome} foi desativado(a) e perdeu o acesso aos dados. Nada do que fez foi apagado.`,
        ativar ? 'reativação' : 'desativação', async () => { await SD.equipeDefinirAtivo(u.id, !ativar); recarregar(true); });
      mudouEquipe();
    } catch (e) { falha(e); }
  }
  async function cancelarConvite(id: string) {
    try { await SD.conviteCancelar(id); avisar('Convite cancelado.'); carregar(); }
    catch (e) { falha(e); }
  }

  return <div className="miolo">
    <header>
      <p className="olho">Administração</p>
      <h1 className="titulo">Equipe e acessos<span className="ponto">.</span></h1>
      <p className="lead">{ctx.ehMaster
        ? 'Você é master: gerencia usuários e administradores. Ninguém altera ou desativa um master.'
        : 'Como administrador, você gerencia os usuários. Administradores são gerenciados pelo master.'}</p>
    </header>

    <section className="resumo" aria-label="Resumo">
      {([['Usuários ativos', n(u => u.ativo)], ['Administradores', n(u => u.ativo && u.papel !== 'usuario')],
        ['Desativados', n(u => !u.ativo)], ['Convites pendentes', convites.length]] as const)
        .map(([r, v]) => <div key={r} className="cartao"><b>{usuarios ? v : '…'}</b><span>{r}</span></div>)}
    </section>

    <LiberarAcesso usuarios={lista} convites={convites} aoLiberar={carregar} />

    <section aria-labelledby="tUsu" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="secao" id="tUsu">Usuários</h2>
      <div className="tabela"><table>
        <thead><tr><th scope="col">Usuário</th><th scope="col">Papel</th><th scope="col">Situação</th><th scope="col">Último acesso</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
        <tbody>
          {!usuarios && <tr><td colSpan={5} className="carregando">Carregando…</td></tr>}
          {usuarios && !usuarios.length && <tr><td colSpan={5} className="nota">Nenhum usuário.</td></tr>}
          {lista.map(u => {
            const gerir = podeGerir(u);
            return <tr key={u.id}>
              <td><div className="pessoa-usuario"><Avatar p={u} tam={32} /><div><div className="nome">{u.nome}</div><div className="sub">@{u.usuario} · {u.email}</div></div></div></td>
              <td>{gerir && ctx.ehMaster
                ? <select className="filtro" style={{ height: 36 }} aria-label={`Papel de ${u.nome}`} value={u.papel} onChange={e => trocarPapel(u, e.target.value as Papel)}>
                  {(['usuario', 'admin'] as Papel[]).map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}
                </select>
                : <span className={'papel' + (u.papel === 'usuario' ? ' comum' : '')}>{PAPEIS[u.papel]}</span>}</td>
              <td>{!u.ativo ? <span className="selo erro">Desativado</span> : !u.confirmado ? <span className="selo pend">Aguardando confirmação</span> : <span className="selo ok">Ativo</span>}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{u.ultimo_acesso ? dataHora(u.ultimo_acesso) : <span className="nota">Nunca entrou</span>}</td>
              <td><div className="td-acoes">
                {u.pessoa_id && <Link className="mini" to={'/pessoas/?id=' + u.pessoa_id}>Cadastro</Link>}
                {!gerir ? <span className="nota">{u.id === eu ? 'Você' : u.papel === 'master' ? 'Conta protegida' : 'Só o master'}</span>
                  : u.ativo ? <BotaoDuplo className="mini perigo" confirmar="Confirmar desativação" aoConfirmar={() => definirAtivo(u, false)}>Desativar</BotaoDuplo>
                  : <button type="button" className="mini" onClick={() => definirAtivo(u, true)}>Reativar</button>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </section>

    <section aria-labelledby="tPend" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="secao" id="tPend">Convites pendentes</h2>
      {!convites.length ? <div className="vazio">Nenhum convite pendente.</div>
        : <div className="tabela"><table style={{ minWidth: 620 }}>
          <thead><tr><th>Convidado</th><th>Papel</th><th>Criado</th><th><span className="sr">Ações</span></th></tr></thead>
          <tbody>{convites.map(c => <tr key={c.id}>
            <td><div className="nome">{c.nome}</div><div className="sub">{c.email}</div></td>
            <td>{PAPEIS[c.papel]}</td><td>{relativo(c.criado_em)}</td>
            <td><div className="td-acoes">
              <button type="button" className="mini" onClick={() => copiar(mensagemConvite(c))}>Copiar link</button>
              {c.papel === 'usuario' || ctx.ehMaster
                ? <BotaoDuplo className="mini perigo" confirmar="Confirmar" aoConfirmar={() => cancelarConvite(c.id)}>Cancelar</BotaoDuplo>
                : <span className="nota">Só o master</span>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section aria-labelledby="tReg" className="registro" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="secao" id="tReg">Registro de ações</h2>
      <p className="nota" style={{ marginTop: -6 }}>Quem incluiu, alterou, excluiu ou leu informações (exigência da LGPD). Últimas 60 ações.</p>
      <div className="cartao">
        {registro === null ? <p className="carregando">Carregando…</p>
          : typeof registro === 'string' ? <div className="aviso erro">{registro}</div>
          : !registro.length ? <p className="nota">Nenhuma ação registrada ainda.</p>
          : <ol>{registro.map(r => {
            const alvo = r.resumo?.nome || r.resumo?.email || r.resumo?.codigo || '';
            return <li key={r.id}>{nomeDe(r.feito_por)} {ACOES[r.acao] || r.acao} {TABELAS[r.tabela] || r.tabela} {alvo && <b>{alvo}</b>}<span>{dataHora(r.em)}</span></li>;
          })}</ol>}
      </div>
    </section>
  </div>;
}

// ---------- liberar acesso ----------
function LiberarAcesso({ usuarios, convites, aoLiberar }: { usuarios: Usuario[]; convites: Convite[]; aoLiberar: () => void }) {
  const { ctx } = useSessao();
  const papeis: Papel[] = ctx.ehMaster ? ['usuario', 'admin'] : ['usuario'];
  const [escolhida, setEscolhida] = useState<PessoaLista | null>(null);
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo, 300);
  const [achados, setAchados] = useState<PessoaLista[] | null>(null);
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('usuario');
  const [ocupado, setOcupado] = useState(false);
  const [criado, setCriado] = useState<Convite | null>(null);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = buscado.trim();
    if (t.length < 2) { setAchados(null); return; }
    let vivo = true;
    SD.pessoasListar({ termo: t, porPagina: 8 }).then(r => { if (vivo) setAchados(r.linhas); }).catch(falha);
    return () => { vivo = false; };
  }, [buscado]);

  const ja = new Set([...usuarios.map(u => u.pessoa_id), ...convites.map(c => c.pessoa_id)].filter(Boolean));
  const escolher = (p: PessoaLista) => {
    setEscolhida(p);
    if (!email && p.emails?.[0]) setEmail(p.emails[0]);
    setTimeout(() => campoEmail.current?.focus(), 0);
  };
  const trocar = () => { setEscolhida(null); setTermo(''); setAchados(null); setTimeout(() => campoBusca.current?.focus(), 0); };

  async function liberar(e: FormEvent) {
    e.preventDefault();
    if (!escolhida) return falha(new Error('Escolha a pessoa que vai receber o acesso.'));
    const em = email.trim().toLowerCase();
    if (!emailValido(em)) return falha(new Error('Informe um e-mail válido.'));
    setOcupado(true);
    try {
      const c = await SD.conviteCriar(escolhida.id, em, papel);
      setCriado(c);
      feito(`Acesso liberado para ${c.nome}.`, 'liberação de acesso', async () => { await SD.conviteCancelar(c.id); setCriado(null); });
      setEscolhida(null); setTermo(''); setAchados(null); setEmail('');
      aoLiberar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  return <section aria-labelledby="tConv" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <h2 className="secao" id="tConv">Dar acesso a uma pessoa</h2>
    <div className="cartao campos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="nota">Quem faz parte da equipe é cadastrado primeiro em Pessoas. Aqui você escolhe essa pessoa e libera o acesso ao sistema: ela recebe o papel escolhido e cria a própria senha em "Primeiro acesso".</p>
      <form className="form-convite" noValidate onSubmit={liberar}>
        <div>
          {escolhida
            ? <label>Pessoa<span className="escolhida"><span>{escolhida.nome}</span><button type="button" className="mini" onClick={trocar}>Trocar</button></span></label>
            : <>
              <label>Pessoa<input ref={campoBusca} placeholder="Busque pelo nome ou CPF" autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)} /></label>
              {achados && <ul className="achados">
                {achados.length ? achados.map(p => <li key={p.id}>
                  <button type="button" disabled={ja.has(p.id)} onClick={() => escolher(p)}>
                    <b>{p.nome}</b><small>{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''}{ja.has(p.id) ? ' · já tem acesso ou convite' : ''}</small>
                  </button>
                </li>)
                  : <li className="nota" style={{ padding: '10px 12px' }}>Nenhuma pessoa encontrada. <Link className="link" to="/pessoas/nova/">Cadastrar</Link></li>}
              </ul>}
            </>}
        </div>
        <label>E-mail de acesso<input ref={campoEmail} type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Papel<select value={papel} onChange={e => setPapel(e.target.value as Papel)}>{papeis.map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}</select></label>
        <button className="btn pri" type="submit" disabled={ocupado}>Liberar acesso</button>
      </form>
      {criado && <div className="aviso ok">
        Acesso liberado para <b>{criado.nome}</b> como {PAPEIS[criado.papel].toLowerCase()}. Peça para a pessoa entrar no link abaixo, em "Primeiro acesso", com o e-mail <b>{criado.email}</b>.
        <div className="link-convite"><code>{linkAcesso()}</code><button type="button" className="mini" onClick={() => copiar(mensagemConvite(criado))}>Copiar mensagem</button></div>
      </div>}
    </div>
  </section>;
}
