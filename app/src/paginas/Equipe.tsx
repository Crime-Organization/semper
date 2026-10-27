// Equipe e acessos (master e administradores): liberar acesso a uma pessoa cadastrada, papéis,
// desativar e reativar, convites pendentes e o registro de ações exigido pela LGPD.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { MARCA } from '../marca';
import { SD, type Convite, type ConviteCriado, type Papel, type PessoaLista, type RegistroAuditoria, type Usuario } from '../dados';
import { emailValido } from '../regras/pessoa';
import { Avatar } from '../ui/Avatar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { useSessao } from '../ui/sessao';
import { copiarTexto, dataHora, PAPEIS, relativo, useTitulo } from '../ui/util';
import './Equipe.css';

export default function Equipe() {
  useTitulo('Equipe e acessos');
  const { ctx } = useSessao();
  if (!ctx.ehAdmin) return <Navigate to="/inicio/" replace />;
  return <PainelEquipe />;
}

const TABELAS: Record<string, string> = {
  pessoas: 'cadastro de pessoa', pessoa_responsaveis: 'responsáveis de', pessoa_sigilos: 'informação sigilosa de',
  pessoa_sigilo_acessos: 'acesso às informações sigilosas de', perfis: 'usuário', convites: 'convite',
  pessoa_vinculos: 'vínculo entre pessoas', vinculo_tipos: 'tipo de vínculo'
};
const ACOES: Record<string, string> = { inclusao: 'incluiu', alteracao: 'alterou', exclusao: 'excluiu', leitura: 'leu' };
// O link leva o código do convite depois do "#": essa parte não sai do navegador (não fica nos registros do servidor).
const linkAcesso = (codigo?: string) => location.origin + '/?primeiro-acesso' + (codigo ? '#convite=' + codigo : '');
const mensagemConvite = (c: Convite, codigo?: string) =>
  `Olá! Seu acesso ao ${MARCA.submarca} (${MARCA.nome}) foi liberado. Abra ${linkAcesso(codigo)} e crie sua senha usando o e-mail ${c.email}. O link é pessoal e vale por 7 dias.`;
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
  // O banco não guarda o código do link: para reenviar, gera um link novo (o anterior deixa de valer).
  async function novoLink(c: Convite) {
    try {
      const codigo = await SD.conviteNovoLink(c.id);
      const texto = mensagemConvite(c, codigo);
      if (await copiarTexto(texto)) avisar('Link novo copiado. Envie para a pessoa: o link anterior deixou de valer.');
      else avisar(texto, 'ok');
    } catch (e) { falha(e); }
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
              {c.papel === 'usuario' || ctx.ehMaster
                ? <>
                  <button type="button" className="mini" title="Gera e copia um link novo; o anterior deixa de valer" onClick={() => novoLink(c)}>Novo link</button>
                  <BotaoDuplo className="mini perigo" confirmar="Confirmar" aoConfirmar={() => cancelarConvite(c.id)}>Cancelar</BotaoDuplo>
                </>
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
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('usuario');
  const [ocupado, setOcupado] = useState(false);
  const [criado, setCriado] = useState<ConviteCriado | null>(null);
  const campoEmail = useRef<HTMLInputElement>(null);

  const ja = new Set([...usuarios.map(u => u.pessoa_id), ...convites.map(c => c.pessoa_id)].filter(Boolean));
  const escolher = (p: PessoaLista | null) => {
    setEscolhida(p);
    if (!p) return;
    if (!email && p.emails?.[0]) setEmail(p.emails[0]);
    setTimeout(() => campoEmail.current?.focus(), 0);
  };

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
      setEscolhida(null); setEmail('');
      aoLiberar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  return <section aria-labelledby="tConv" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <h2 className="secao" id="tConv">Dar acesso a uma pessoa</h2>
    <div className="cartao campos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="nota">Quem faz parte da equipe é cadastrado primeiro em Pessoas. Aqui você escolhe essa pessoa e libera o acesso ao sistema: ela recebe o papel escolhido e um link pessoal, válido por 7 dias, para criar a própria senha.</p>
      <form className="form-convite" noValidate onSubmit={liberar}>
        <div><BuscaPessoa rotulo="Pessoa" escolhida={escolhida} aoEscolher={escolher} placeholder="Busque pelo nome ou CPF"
          desativar={p => ja.has(p.id) ? 'já tem acesso ou convite' : null} /></div>
        <label>E-mail de acesso<input ref={campoEmail} type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Papel<select value={papel} onChange={e => setPapel(e.target.value as Papel)}>{papeis.map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}</select></label>
        <button className="btn pri" type="submit" disabled={ocupado}>Liberar acesso</button>
      </form>
      {criado && <div className="aviso ok">
        Acesso liberado para <b>{criado.nome}</b> como {PAPEIS[criado.papel].toLowerCase()}. Envie o link abaixo só para essa pessoa: ela cria a senha com o e-mail <b>{criado.email}</b>. O link vale por 7 dias e aparece só agora; depois, use "Novo link" em Convites pendentes.
        <div className="link-convite"><code>{linkAcesso(criado.codigo)}</code><button type="button" className="mini" onClick={() => copiar(mensagemConvite(criado, criado.codigo))}>Copiar mensagem</button></div>
      </div>}
    </div>
  </section>;
}
