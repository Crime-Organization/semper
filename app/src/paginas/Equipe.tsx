// Equipe e acessos (master e administradores): liberar acesso a uma pessoa cadastrada, funções, papéis,
// desativar e reativar, convites pendentes e o registro de ações exigido pela LGPD.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { MARCA } from '../marca';
import { SD, type Convite, type ConviteCriado, type Funcao, type Papel, type PessoaLista, type RegistroAuditoria, type Usuario } from '../dados';
import { REGISTRO_DE_ACOES } from '../dados/limites';
import { FUNCOES } from '../regras/equipe';
import { emailValido } from '../regras/pessoa';
import { Avatar } from '../ui/Avatar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoLink, Carregando, Cartao, estiloBotao, Nota, Selo, TituloSecao, Vazio } from '../ui/base';
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
  pessoa_vinculos: 'vínculo entre pessoas', vinculo_tipos: 'tipo de vínculo', escritorios: 'os dados do escritório', contratos: 'contrato', comentarios: 'um comentário', perfil_profissional: 'o perfil profissional de'
};
const ACOES: Record<string, string> = { inclusao: 'incluiu', alteracao: 'alterou', exclusao: 'excluiu', leitura: 'leu', exportacao: 'exportou' };
// O link leva o código do convite depois do "#": essa parte não sai do navegador (não fica nos registros do servidor).
const linkAcesso = (codigo?: string) => location.origin + '/entrar/?primeiro-acesso' + (codigo ? '#convite=' + codigo : '');
const mensagemConvite = (c: Convite, escritorio?: string, codigo?: string) =>
  `Olá! Seu acesso ao ${MARCA.nome}${escritorio ? ` (${escritorio})` : ''} foi liberado. Abra ${linkAcesso(codigo)} e crie sua senha usando o e-mail ${c.email}. O link é pessoal e vale por 7 dias.`;
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
    SD.auditoriaListar(REGISTRO_DE_ACOES).then(setRegistro).catch(e => setRegistro((e as Error).message));
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useMudancas(() => { void carregar(); });
  // Papéis e situação mudam a equipe que as outras telas mostram.
  const mudouEquipe = () => { void carregar(); void recarregar(true); };

  const lista = usuarios || [];
  const n = (fn: (u: Usuario) => boolean) => lista.filter(fn).length;
  const podeGerir = (u: Usuario) => u.id !== eu && u.papel !== 'master' && (u.papel !== 'admin' || ctx.ehMaster);
  const nomeDe = (id: string | null) => lista.find(u => u.id === id)?.nome || ctx.equipe.find(u => u.id === id)?.nome || 'Sistema';

  async function trocarPapel(u: Usuario, papel: Papel) {
    const antes = u.papel;
    try {
      await SD.equipeDefinirPapel(u.id, papel);
      feito(`${u.nome} agora é ${PAPEIS[papel].toLowerCase()}.`, 'troca de papel', async () => { await SD.equipeDefinirPapel(u.id, antes); void recarregar(true); });
      mudouEquipe();
    } catch (e) { falha(e); void carregar(); }
  }
  async function trocarFuncao(u: Usuario, funcao: Funcao) {
    const antes = u.funcao;
    try {
      await SD.equipeDefinirFuncao(u.id, funcao);
      feito(`Função de ${u.nome}: ${FUNCOES[funcao]}.`, 'troca de função', async () => { await SD.equipeDefinirFuncao(u.id, antes); mudouEquipe(); });
      mudouEquipe();
    } catch (e) { falha(e); void carregar(); }
  }
  async function definirAtivo(u: Usuario, ativar: boolean) {
    try {
      await SD.equipeDefinirAtivo(u.id, ativar);
      feito(ativar ? `${u.nome} pode entrar de novo.` : `${u.nome} foi desativado(a) e perdeu o acesso aos dados. Nada do que fez foi apagado.`,
        ativar ? 'reativação' : 'desativação', async () => { await SD.equipeDefinirAtivo(u.id, !ativar); void recarregar(true); });
      mudouEquipe();
    } catch (e) { falha(e); }
  }
  async function cancelarConvite(id: string) {
    try { await SD.conviteCancelar(id); avisar('Convite cancelado.'); void carregar(); }
    catch (e) { falha(e); }
  }
  // O banco não guarda o código do link: para reenviar, gera um link novo (o anterior deixa de valer).
  async function novoLink(c: Convite) {
    try {
      const codigo = await SD.conviteNovoLink(c.id);
      const texto = mensagemConvite(c, ctx.escritorio?.nome, codigo);
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
        .map(([r, v]) => <Cartao key={r}><b>{usuarios ? v : '…'}</b><span>{r}</span></Cartao>)}
    </section>

    <LiberarAcesso usuarios={lista} convites={convites} aoLiberar={carregar} />

    <section aria-labelledby="tUsu" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tUsu">Usuários</TituloSecao>
      <Nota style={{ marginTop: -6 }}>A função diz o que cada um faz no escritório: só advogados são responsáveis por contratos, e os participantes de um contrato são sempre da equipe. O papel diz quem administra o sistema.</Nota>
      <div className="tabela"><table>
        <thead><tr><th scope="col">Usuário</th><th scope="col">Função</th><th scope="col">Papel</th><th scope="col">Situação</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
        <tbody>
          {!usuarios && <tr><td colSpan={5} className="carregando">Carregando…</td></tr>}
          {usuarios && !usuarios.length && <tr><td colSpan={5} className="nota">Nenhum usuário.</td></tr>}
          {lista.map(u => {
            const gerir = podeGerir(u);
            return <tr key={u.id}>
              <td><div className="pessoa-usuario"><Avatar p={u} tam={32} /><div><div className="nome">{u.nome}</div><div className="sub">@{u.usuario} · {u.email}</div></div></div></td>
              <td><select className="filtro" style={{ height: 36 }} aria-label={`Função de ${u.nome}`} value={u.funcao} onChange={e => trocarFuncao(u, e.target.value as Funcao)}>
                {(Object.keys(FUNCOES) as Funcao[]).map(f => <option key={f} value={f}>{FUNCOES[f]}</option>)}
              </select></td>
              <td>{gerir && ctx.ehMaster
                ? <select className="filtro" style={{ height: 36 }} aria-label={`Papel de ${u.nome}`} value={u.papel} onChange={e => trocarPapel(u, e.target.value as Papel)}>
                  {(['usuario', 'admin'] as Papel[]).map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}
                </select>
                : <span className={'papel' + (u.papel === 'usuario' ? ' comum' : '')}>{PAPEIS[u.papel]}</span>}</td>
              <td><div className="situacao-usuario">
                {!u.ativo ? <Selo tipo="erro">Desativado</Selo> : !u.confirmado ? <Selo tipo="pend">Aguardando confirmação</Selo> : <Selo tipo="ok">Ativo</Selo>}
                <span className="sub">{u.ultimo_acesso ? 'Último acesso: ' + dataHora(u.ultimo_acesso) : 'Nunca entrou'}</span>
              </div></td>
              <td><div className="td-acoes">
                <BotaoLink forma="mini" to={'/equipe/perfil/?id=' + u.id} aria-label={`Perfil profissional de ${u.nome}`}>Perfil</BotaoLink>
                {u.pessoa_id && <BotaoLink forma="mini" to={'/pessoas/?id=' + u.pessoa_id}>Cadastro</BotaoLink>}
                {!gerir ? <span className="nota">{u.id === eu ? 'Você' : u.papel === 'master' ? 'Conta protegida' : 'Só o master'}</span>
                  : u.ativo ? <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar desativação" aoConfirmar={() => definirAtivo(u, false)}>Desativar</BotaoDuplo>
                  : <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => definirAtivo(u, true)}>Reativar</button>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table></div>
    </section>

    <section aria-labelledby="tPend" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tPend">Convites pendentes</TituloSecao>
      {!convites.length ? <Vazio>Nenhum convite pendente.</Vazio>
        : <div className="tabela"><table style={{ minWidth: 620 }}>
          <thead><tr><th>Convidado</th><th>Papel</th><th>Criado</th><th><span className="sr">Ações</span></th></tr></thead>
          <tbody>{convites.map(c => <tr key={c.id}>
            <td><div className="nome">{c.nome}</div><div className="sub">{c.email}</div></td>
            <td>{PAPEIS[c.papel]}</td><td>{relativo(c.criado_em)}</td>
            <td><div className="td-acoes">
              {c.papel === 'usuario' || ctx.ehMaster
                ? <>
                  <button type="button" className={estiloBotao({ forma: 'mini' })} title="Gera e copia um link novo; o anterior deixa de valer" onClick={() => novoLink(c)}>Novo link</button>
                  <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar" aoConfirmar={() => cancelarConvite(c.id)}>Cancelar</BotaoDuplo>
                </>
                : <span className="nota">Só o master</span>}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    <section aria-labelledby="tReg" className="registro" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tReg">Registro de ações</TituloSecao>
      <Nota style={{ marginTop: -6 }}>Quem incluiu, alterou, excluiu, leu ou exportou informações (exigência da LGPD). Últimas 60 ações.</Nota>
      <Cartao>
        {registro === null ? <Carregando />
          : typeof registro === 'string' ? <Aviso tipo="erro">{registro}</Aviso>
          : !registro.length ? <Nota>Nenhuma ação registrada ainda.</Nota>
          : <ol>{registro.map(r => {
            if (r.acao === 'exportacao') {
              const q = r.resumo?.quantidade ?? 0;
              return <li key={r.id}>{nomeDe(r.feito_por)} exportou {q} {q === 1 ? 'cadastro de pessoa' : 'cadastros de pessoas'} {r.resumo?.descricao && <b>({r.resumo.descricao})</b>}<span>{dataHora(r.em)}</span></li>;
            }
            const alvo = r.resumo?.nome || r.resumo?.email || r.resumo?.codigo || '';
            return <li key={r.id}>{nomeDe(r.feito_por)} {ACOES[r.acao] || r.acao} {TABELAS[r.tabela] || r.tabela} {alvo && <b>{alvo}</b>}<span>{dataHora(r.em)}</span></li>;
          })}</ol>}
      </Cartao>
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
    <TituloSecao id="tConv">Dar acesso a uma pessoa</TituloSecao>
    <Cartao className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Nota>Quem faz parte da equipe é cadastrado primeiro em Pessoas. Aqui você escolhe essa pessoa e libera o acesso ao sistema: ela recebe o papel escolhido e um link pessoal, válido por 7 dias, para criar a própria senha. Quem entra começa com a função de advogado; ajuste na lista de usuários.</Nota>
      <form className="form-convite" noValidate onSubmit={liberar}>
        <div><BuscaPessoa rotulo="Pessoa" escolhida={escolhida} aoEscolher={escolher} placeholder="Busque pelo nome ou CPF"
          desativar={p => ja.has(p.id) ? 'já tem acesso ou convite' : null} /></div>
        <label>E-mail de acesso<input ref={campoEmail} type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Papel<select value={papel} onChange={e => setPapel(e.target.value as Papel)}>{papeis.map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}</select></label>
        <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>Liberar acesso</button>
      </form>
      {criado && <Aviso tipo="ok">
        Acesso liberado para <b>{criado.nome}</b> como {PAPEIS[criado.papel].toLowerCase()}. Envie o link abaixo só para essa pessoa: ela cria a senha com o e-mail <b>{criado.email}</b>. O link vale por 7 dias e aparece só agora; depois, use "Novo link" em Convites pendentes.
        <div className="link-convite"><code>{linkAcesso(criado.codigo)}</code><button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => copiar(mensagemConvite(criado, ctx.escritorio?.nome, criado.codigo))}>Copiar mensagem</button></div>
      </Aviso>}
    </Cartao>
  </section>;
}
