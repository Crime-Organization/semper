// Equipe e acessos (master e administradores): liberar acesso a uma pessoa cadastrada, funções, papéis,
// desativar e reativar, convites pendentes e o registro de ações exigido pela LGPD.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { MARCA } from '../marca';
import { SD, type Convite, type ConviteCriado, type Funcao, type Papel, type PessoaLista, type RegistroAuditoria, type Socio, type Usuario } from '../dados';
import { REGISTRO_DE_ACOES, TAMANHO_EMAIL_DE_ACESSO, TROCAS_DE_EMAIL_MOSTRADAS } from '../dados/limites';
import { erroDoEmailDoColega, normalizarEmail, seloDoAvisoDaTroca, situacaoDoAvisoDaTroca } from '../regras/conta';
import { FUNCOES } from '../regras/equipe';
import { detalheDaMarcacao } from '../regras/meusValores';
import { emailValido } from '../regras/pessoa';
import { Avatar } from '../ui/Avatar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoLink, Campo, Carregando, Cartao, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao, Vazio } from '../ui/base';
import { janela } from '../ui/janela';
import { useSessao } from '../ui/sessao';
import { copiarTexto, dataHora, numero, PAPEIS, relativo, useTitulo } from '../ui/util';
import { SocioNaEquipe } from './financeiro/SocioNaEquipe';
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
  pessoa_vinculos: 'vínculo entre pessoas', vinculo_tipos: 'tipo de vínculo', escritorios: 'os dados do escritório', contratos: 'contrato', comentarios: 'um comentário', perfil_profissional: 'o perfil profissional de', ligacoes: 'a conta Google do escritório',
  financeiro_terceiros_pagos: 'a marcação de pago de um valor do contrato'
};
/** O que a ação diz além do alvo, nas tabelas em que só ele não basta. */
const DETALHES: Partial<Record<string, (resumo: NonNullable<RegistroAuditoria['resumo']>) => string>> = { financeiro_terceiros_pagos: detalheDaMarcacao };
const ACOES: Record<string, string> = { inclusao: 'incluiu', alteracao: 'alterou', exclusao: 'excluiu', leitura: 'leu', exportacao: 'exportou', importacao: 'importou' };
const cadastros = (n = 0) => `${numero(n)} ${n === 1 ? 'cadastro de pessoa' : 'cadastros de pessoas'}`;
/** Ações que não cabem em "quem fez o quê a qual cadastro": as sobre muitos cadastros de uma vez contam quantos, e a troca de e-mail diz de qual para qual. */
const LINHAS_ESPECIAIS: Partial<Record<string, (r: RegistroAuditoria, quem: string) => ReactNode>> = {
  reserva_conta: ({ resumo }, quem) => <>{quem} reservou uma conta, sem acesso ao sistema, para <b>{resumo?.nome}</b></>,
  troca_email: ({ resumo }, quem) => {
    const falhou = resumo?.situacao === 'falhou', aviso = falhou ? '' : situacaoDoAvisoDaTroca(resumo?.aviso_falhas);
    return <>{quem} {falhou ? 'tentou trocar' : 'trocou'} o e-mail de acesso de <b>{resumo?.nome}</b>, de {resumo?.email_antigo} para {resumo?.email_novo}{falhou && ' (a troca não aconteceu)'}{aviso && ` (${aviso})`}</>;
  },
  exportacao: (r, quem) => <>{quem} exportou {cadastros(r.resumo?.quantidade)} {r.resumo?.descricao && <b>({r.resumo.descricao})</b>}</>,
  // "Ana importou 120 cadastros de pessoas, completou 15; 8 com pendência" (só números: a descrição não vai ao registro)
  importacao: (r, quem) => <>{quem} importou {cadastros(r.resumo?.quantidade)}
    {!!r.resumo?.completadas && <>, completou {numero(r.resumo.completadas)}</>}
    {!!r.resumo?.incompletas && <>; {numero(r.resumo.incompletas)} com pendência</>}</>
};
// O link leva o código do convite depois do "#": essa parte não sai do navegador (não fica nos registros do servidor).
const linkAcesso = (codigo?: string) => location.origin + '/entrar/?primeiro-acesso' + (codigo ? '#convite=' + codigo : '');
const mensagemConvite = (c: Convite, escritorio?: string, codigo?: string) =>
  `Olá! Seu acesso ao ${MARCA.nome}${escritorio ? ` (${escritorio})` : ''} foi liberado. Abra ${linkAcesso(codigo)} e crie sua senha usando o e-mail ${c.email}. O link é pessoal e vale por 7 dias.`;
async function copiar(texto: string) {
  if (await copiarTexto(texto)) avisar('Mensagem copiada. Envie para a pessoa.');
  else avisar(texto, 'ok');
}

/** Pergunta o e-mail novo. Se houver erro, pergunta de novo, sem perder o que foi digitado. Devolve null se desistir. */
async function pedirEmailNovo(u: Usuario, digitado = '', erro: string | null = null): Promise<string | null> {
  const r = await janela<{ novo: string; repetido: string }>({
    titulo: `Trocar o e-mail de acesso de ${u.nome}`,
    corpo: <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Aviso tipo="info">Use só para quem perdeu o acesso ao e-mail atual, depois de confirmar com a própria pessoa que foi ela quem pediu. A troca vale na hora, sem link de confirmação, e fica no registro de ações. Quem já estava conectado perde o acesso na hora. Se houver suspeita de invasão, desative o acesso da pessoa nesta tela em vez de trocar o e-mail.</Aviso>
      <Nota>E-mail atual: <b>{u.email}</b>. A senha atual deixa de valer: a pessoa cria outra em "Esqueci minha senha", com o e-mail novo.</Nota>
      <Campo rotulo="E-mail novo" para="email-do-colega" erro={erro}>
        <input {...propsDoCampo('email-do-colega', { erro })} name="novo" className="campo" type="email" autoComplete="off" maxLength={TAMANHO_EMAIL_DE_ACESSO} defaultValue={digitado} />
      </Campo>
      <Campo rotulo="Repita o e-mail novo" para="email-do-colega-repetido">
        <input {...propsDoCampo('email-do-colega-repetido')} name="repetido" className="campo" type="email" autoComplete="off" maxLength={TAMANHO_EMAIL_DE_ACESSO} />
      </Campo>
    </div>,
    acoes: [{ rotulo: 'Cancelar', valor: null },
      { rotulo: 'Trocar e-mail', tipo: 'pri', valor: campos => ({ novo: String(campos.get('novo') ?? ''), repetido: String(campos.get('repetido') ?? '') }) }]
  });
  if (!r) return null;
  const problema = erroDoEmailDoColega(r.novo, r.repetido, u.email);
  return problema ? pedirEmailNovo(u, r.novo, problema) : normalizarEmail(r.novo);
}

function PainelEquipe() {
  const { ctx, recarregar } = useSessao();
  const eu = ctx.perfil.id;
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [registro, setRegistro] = useState<RegistroAuditoria[] | string | null>(null);
  const [trocas, setTrocas] = useState<RegistroAuditoria[] | string | null>(null);
  const [socios, setSocios] = useState<Socio[] | null>(null);
  // Quem é sócio só aparece para o administrador, e só com o financeiro ligado.
  const veSocios = ctx.ehAdmin && !!ctx.escritorio?.modulos?.financeiro;

  const carregar = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([SD.equipeListar(), SD.convitesListar()]);
      setUsuarios(u); setConvites(c);
    } catch (e) { falha(e); }
    SD.auditoriaListar(REGISTRO_DE_ACOES).then(setRegistro).catch(e => setRegistro((e as Error).message));
    SD.trocasDeEmailListar(TROCAS_DE_EMAIL_MOSTRADAS).then(setTrocas).catch(e => setTrocas((e as Error).message));
    if (veSocios) SD.financeiroSocios().then(setSocios).catch(falha);
  }, [veSocios]);
  useEffect(() => { void carregar(); }, [carregar]);
  useMudancas(() => { void carregar(); });
  // Papéis e situação mudam a equipe que as outras telas mostram.
  const mudouEquipe = () => { void carregar(); void recarregar(true); };

  const lista = usuarios || [];
  const n = (fn: (u: Usuario) => boolean) => lista.filter(fn).length;
  const podeGerir = (u: Usuario) => !u.reservada && u.id !== eu && u.papel !== 'master' && (u.papel !== 'admin' || ctx.ehMaster);
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
      // Toda reativação tira a senha de uso, inclusive a do "Desfazer" de uma desativação (public.equipe_definir_ativo).
      const senha = 'A senha antiga não vale mais: a pessoa cria uma nova em "Esqueci minha senha"';
      feito(ativar ? `${u.nome} foi reativado(a). ${senha}.` : `${u.nome} foi desativado(a), saiu de todos os aparelhos e perdeu o acesso aos dados. Nada do que fez foi apagado.`,
        ativar ? 'reativação' : `desativação. ${senha}`, async () => { await SD.equipeDefinirAtivo(u.id, !ativar); void recarregar(true); });
      mudouEquipe();
    } catch (e) { falha(e); }
  }
  async function trocarEmail(u: Usuario) {
    const email = await pedirEmailNovo(u);
    if (!email) return;
    try {
      await SD.equipeTrocarEmail(u.id, email);
      avisar(`O e-mail de acesso de ${u.nome} agora é ${email}. Avise a pessoa: ela precisa criar uma senha nova em "Esqueci minha senha".`);
    } catch (e) { falha(e); }
    void carregar();
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
        ['Desativados', n(u => !u.ativo && !u.reservada)], ['Convites pendentes', convites.length]] as const)
        .map(([r, v]) => <Cartao key={r}><b>{usuarios ? v : '…'}</b><span>{r}</span></Cartao>)}
    </section>

    <LiberarAcesso usuarios={lista} convites={convites} aoLiberar={carregar} />
    <ReservarConta usuarios={lista} convites={convites} aoReservar={mudouEquipe} />

    <section aria-labelledby="tUsu" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tUsu">Usuários</TituloSecao>
      <Nota style={{ marginTop: -6 }}>A função diz o que cada um faz no escritório: só advogados são responsáveis por contratos, e os participantes de um contrato são sempre da equipe. O papel diz quem administra o sistema.</Nota>
      <div className="tabela"><table className="tabela-usuarios">
        <thead><tr><th scope="col">Usuário</th><th scope="col">Função</th><th scope="col">Papel</th><th scope="col">Situação</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
        <tbody>
          {!usuarios && <tr><td colSpan={5} className="carregando">Carregando…</td></tr>}
          {usuarios && !usuarios.length && <tr><td colSpan={5} className="nota">Nenhum usuário.</td></tr>}
          {lista.map(u => {
            const gerir = podeGerir(u);
            return <tr key={u.id}>
              <td><div className="pessoa-usuario"><Avatar p={u} tam={32} /><div><div className="nome">{u.nome}</div>{!u.reservada && <><div className="sub">@{u.usuario}</div><div className="sub">{u.email}</div></>}
                {gerir && <button type="button" className={estiloBotao({ forma: 'link' })} aria-label={`Trocar e-mail de ${u.nome}`} onClick={() => trocarEmail(u)}>Trocar e-mail</button>}</div></div></td>
              <td><select className="filtro" style={{ height: 36 }} aria-label={`Função de ${u.nome}`} value={u.funcao} onChange={e => trocarFuncao(u, e.target.value as Funcao)}>
                {(Object.keys(FUNCOES) as Funcao[]).map(f => <option key={f} value={f}>{FUNCOES[f]}</option>)}
              </select>
              {socios && u.pessoa_id && <SocioNaEquipe usuario={u} socios={socios} aoMudar={() => void carregar()} />}</td>
              <td>{gerir && ctx.ehMaster
                ? <select className="filtro" style={{ height: 36 }} aria-label={`Papel de ${u.nome}`} value={u.papel} onChange={e => trocarPapel(u, e.target.value as Papel)}>
                  {(['usuario', 'admin'] as Papel[]).map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}
                </select>
                : <span className={'papel' + (u.papel === 'usuario' ? ' comum' : '')}>{PAPEIS[u.papel]}</span>}</td>
              <td><div className="situacao-usuario">
                {u.reservada ? <Selo tipo="pend">Sem acesso ao sistema</Selo> : !u.ativo ? <Selo tipo="erro">Desativado</Selo> : !u.confirmado ? <Selo tipo="pend">Aguardando confirmação</Selo> : <Selo tipo="ok">Ativo</Selo>}
                {!u.reservada && <span className="sub">{u.ultimo_acesso ? 'Último acesso: ' + dataHora(u.ultimo_acesso) : 'Nunca entrou'}</span>}
              </div></td>
              <td><div className="td-acoes">
                <BotaoLink forma="mini" to={'/equipe/perfil/?id=' + u.id} aria-label={`Perfil profissional de ${u.nome}`}>Perfil</BotaoLink>
                {u.pessoa_id && <BotaoLink forma="mini" to={'/pessoas/?id=' + u.pessoa_id}>Cadastro</BotaoLink>}
                {u.reservada ? <span className="nota">Conta reservada</span>
                  : !gerir ? <span className="nota">{u.id === eu ? 'Você' : u.papel === 'master' ? 'Conta protegida' : 'Só o master'}</span>
                  : u.ativo ? <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar desativação" aoConfirmar={() => definirAtivo(u, false)}>Desativar</BotaoDuplo>
                  : <BotaoDuplo forma="mini" confirmar="Confirmar reativação" aoConfirmar={() => definirAtivo(u, true)}>Reativar</BotaoDuplo>}
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

    <section aria-labelledby="tTrocas" className="registro" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tTrocas">Trocas de e-mail</TituloSecao>
      <Nota style={{ marginTop: -6 }}>Quando um administrador troca o e-mail de acesso de um colega, o e-mail antigo e a administração recebem um aviso. Se ele falhar, o sistema tenta de novo. Últimas {TROCAS_DE_EMAIL_MOSTRADAS} trocas.</Nota>
      <Cartao>
        {trocas === null ? <Carregando />
          : typeof trocas === 'string' ? <Aviso tipo="erro">{trocas}</Aviso>
          : !trocas.length ? <Nota>Nenhuma troca de e-mail ainda.</Nota>
          : <ol>{trocas.map(r => {
            const selo = seloDoAvisoDaTroca(r.resumo);
            return <li key={r.id}>{LINHAS_ESPECIAIS.troca_email?.(r, nomeDe(r.feito_por))} {selo && <Selo tipo={selo.tipo}>{selo.texto}</Selo>}<span>{dataHora(r.em)}</span></li>;
          })}</ol>}
      </Cartao>
    </section>

    <section aria-labelledby="tReg" className="registro" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tReg">Registro de ações</TituloSecao>
      <Nota style={{ marginTop: -6 }}>Quem incluiu, alterou, excluiu, leu, exportou ou importou informações (exigência da LGPD). Últimas 60 ações.</Nota>
      <Cartao>
        {registro === null ? <Carregando />
          : typeof registro === 'string' ? <Aviso tipo="erro">{registro}</Aviso>
          : !registro.length ? <Nota>Nenhuma ação registrada ainda.</Nota>
          : <ol>{registro.map(r => {
            const especial = LINHAS_ESPECIAIS[r.acao];
            if (especial) return <li key={r.id}>{especial(r, nomeDe(r.feito_por))}<span>{dataHora(r.em)}</span></li>;
            const alvo = r.resumo?.nome || r.resumo?.email || r.resumo?.codigo || '';
            const detalhe = r.resumo && DETALHES[r.tabela]?.(r.resumo);
            return <li key={r.id}>{nomeDe(r.feito_por)} {ACOES[r.acao] || r.acao} {TABELAS[r.tabela] || r.tabela} {alvo && <b>{alvo}</b>}{detalhe && ` (${detalhe})`}<span>{dataHora(r.em)}</span></li>;
          })}</ol>}
      </Cartao>
    </section>
  </div>;
}

// ---------- conta reservada ----------
function ReservarConta({ usuarios, convites, aoReservar }: { usuarios: Usuario[]; convites: Convite[]; aoReservar: () => void }) {
  const [escolhida, setEscolhida] = useState<PessoaLista | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ja = new Set([...usuarios.map(u => u.pessoa_id), ...convites.map(c => c.pessoa_id)].filter(Boolean));

  async function reservar(e: FormEvent) {
    e.preventDefault();
    if (!escolhida) return falha(new Error('Escolha a pessoa para reservar a conta.'));
    setOcupado(true);
    try {
      await SD.equipeReservarConta(escolhida.id);
      avisar(`Conta reservada para ${escolhida.nome}. A pessoa pode constar nos contratos e não entra no sistema.`);
      setEscolhida(null);
      aoReservar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  return <section aria-labelledby="tRes" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <TituloSecao id="tRes">Reservar conta sem acesso</TituloSecao>
    <Cartao className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Nota>Para quem precisa constar como responsável ou participante de contratos, mas não entra no sistema, como quem já saiu do escritório. A pessoa não recebe e-mail e não consegue entrar nem criar senha. Quem vai ser responsável precisa ter o CPF no cadastro. Começa com a função de advogado; ajuste na lista de usuários.</Nota>
      <form className="form-reserva" noValidate onSubmit={reservar}>
        <div><BuscaPessoa rotulo="Integrante sem acesso" escolhida={escolhida} aoEscolher={setEscolhida} placeholder="Busque pelo nome ou CPF"
          desativar={p => ja.has(p.id) ? 'já tem acesso ou convite' : null} /></div>
        <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>Reservar conta</button>
      </form>
    </Cartao>
  </section>;
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
