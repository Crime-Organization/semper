// Entrada: login da equipe, primeiro acesso por convite, recuperação de senha e entrada do cliente (em preparação).
// É sempre clara, qualquer que seja o tema escolhido.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { MARCA } from '../marca';
import { SD } from '../dados';
import { emailValido } from '../regras/pessoa';
import { mostrarTema, temaGuardado } from '../ui/tema';
import { useTitulo } from '../ui/util';
import './Entrada.css';

type Painel = 'entrar' | 'primeiro' | 'cliente' | 'solicitar' | 'recuperar' | 'nova';
const TITULOS: Record<Painel, string> = { entrar: 'Entrar', primeiro: 'Primeiro acesso', cliente: 'Área do cliente', solicitar: 'Solicitar acesso', recuperar: 'Recuperar senha', nova: 'Nova senha' };
const ABA_DE: Partial<Record<Painel, 'entrar' | 'cliente'>> = { entrar: 'entrar', primeiro: 'entrar', recuperar: 'entrar', cliente: 'cliente', solicitar: 'cliente' };
type Mensagem = { texto: string; tipo: 'erro' | 'ok' | 'info' } | null;

export default function Entrada() {
  useTitulo('Entrar');
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const volta = params.get('volta');
  const destino = volta && volta.startsWith('/') && !volta.startsWith('//') ? volta : '/inicio/';
  const aqui = location.origin + '/';   // endereço do SEMPER (para os links dos e-mails)
  const porRecuperacao = location.hash.includes('type=recovery') || params.has('nova-senha');
  // Código do convite: vem depois do "#" no link do convite. Fica só na memória e sai do endereço,
  // para não ficar no histórico do navegador.
  const [codigoConvite] = useState(() => new URLSearchParams(location.hash.slice(1)).get('convite') || '');
  useEffect(() => { if (codigoConvite) history.replaceState(null, '', location.pathname + location.search); }, [codigoConvite]);
  const inicial: Painel = porRecuperacao ? 'nova' : params.has('primeiro-acesso') ? 'primeiro' : params.has('recuperar') ? 'recuperar' : params.has('cliente') ? 'cliente' : 'entrar';

  const [painel, setPainel] = useState<Painel>(inicial);
  const [msg, setMsg] = useState<Mensagem>(params.has('desativado') ? { texto: 'Seu acesso a este escritório está desativado. Fale com o administrador.', tipo: 'info' } : null);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    mostrarTema('claro');
    return () => mostrarTema(temaGuardado());
  }, []);

  const mostrar = (p: Painel) => { setPainel(p); setMsg(null); };
  const avisar = (texto: string, tipo: 'erro' | 'ok' | 'info' = 'erro') => setMsg({ texto, tipo });
  useEffect(() => { caixa.current?.querySelector<HTMLInputElement>('form input')?.focus(); }, [painel]);

  // Links dos e-mails: a confirmação de cadastro entra direto; o de nova senha abre o formulário.
  useEffect(() => {
    const parar = SD.aoMudarSessao(evento => {
      if (evento === 'PASSWORD_RECOVERY') mostrar('nova');
      else if (evento === 'SIGNED_IN' && !porRecuperacao && location.hash.includes('access_token')) navegar('/inicio/', { replace: true });
    });
    if (!porRecuperacao) SD.sessao().then(s => { if (s && !params.has('desativado')) navegar(destino, { replace: true }); });
    return parar;
  }, []);

  // Envio com o formulário ocupado; ler(nome) traz o valor de cada campo.
  const enviar = (fn: (ler: (nome: string) => string, form: HTMLFormElement) => Promise<unknown> | void) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, dados = new FormData(form);
    const ler = (nome: string) => String(dados.get(nome) || '');
    setOcupado(true);
    try { await fn(ler, form); }
    catch (err) { avisar((err as Error).message); }
    setOcupado(false);
  };

  const entrar = enviar(async ler => {
    if (!emailValido(ler('email')) || !ler('senha')) return avisar('Informe o e-mail e a senha.');
    await SD.entrar(ler('email'), ler('senha'));
    navegar(destino);
  });
  const primeiro = enviar(async (ler, form) => {
    if (!emailValido(ler('email'))) return avisar('Informe o e-mail em que você recebeu o convite.');
    if (ler('senha').length < 8) return avisar('A senha precisa ter pelo menos 8 caracteres.');
    if (ler('senha') !== ler('senha2')) return avisar('As duas senhas não são iguais.');
    const { entrou } = await SD.primeiroAcesso(ler('email'), ler('senha'), aqui, codigoConvite);
    if (entrou) { navegar('/inicio/'); return; }
    form.reset();
    mostrar('entrar');
    avisar('Acesso criado. Enviamos um e-mail de confirmação: clique no link para ativar e depois entre com sua senha.', 'ok');
  });
  const portalEmBreve = enviar(() => avisar('O portal do cliente ainda está em preparação. Fale com o advogado responsável pelo seu atendimento.', 'info'));
  const recuperar = enviar(async ler => {
    if (!emailValido(ler('email'))) return avisar('Informe o e-mail da sua conta.');
    await SD.recuperarSenha(ler('email'), aqui + '?nova-senha');
    avisar('Se houver uma conta com esse e-mail, o link para criar uma nova senha chegará em instantes.', 'ok');
  });
  const novaSenha = enviar(async ler => {
    if (ler('senha').length < 8) return avisar('A senha precisa ter pelo menos 8 caracteres.');
    if (ler('senha') !== ler('senha2')) return avisar('As duas senhas não são iguais.');
    await SD.novaSenha(ler('senha'));
    navegar('/inicio/');
  });

  const ir = (p: Painel, rotulo: ReactNode) => <button className="link" type="button" disabled={ocupado} onClick={() => mostrar(p)}>{rotulo}</button>;
  const enviarBotao = (rotulo: string) => <button className="btn pri" type="submit" disabled={ocupado}>{rotulo}</button>;
  const aba = ABA_DE[painel];

  return <div className="entrada"><div className="tela">
    <div className="lado">
      <img className="fundo" src={MARCA.fotoEntrada} alt="" aria-hidden="true" />
      <a href={MARCA.site} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={MARCA.logoClaro} alt={MARCA.nome} style={{ height: 18, width: 'auto' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--accent-bright)' }}>{MARCA.submarca}</span>
      </a>
      <div>
        <h1>{MARCA.submarca}<span style={{ color: 'var(--accent-bright)' }}>.</span></h1>
        <p>Contratos, demandas, prazos e equipe do escritório reunidos num só lugar.</p>
      </div>
    </div>

    <div className="form-lado">
      <div className="caixa" ref={caixa}>
        <div>
          <p className="olho">Área restrita</p>
          <h2 className="titulo" style={{ fontSize: 'clamp(30px, 3.4vw, 40px)' }}>{TITULOS[painel]}</h2>
        </div>

        {aba && <div className="abas" role="tablist" aria-label="Acesso">
          <button type="button" role="tab" aria-selected={aba === 'entrar'} onClick={() => mostrar('entrar')}>Equipe</button>
          <button type="button" role="tab" aria-selected={aba === 'cliente'} onClick={() => mostrar('cliente')}>Sou cliente</button>
        </div>}

        {msg && <div className={'aviso ' + msg.tipo} role="status">{msg.texto}</div>}

        {painel === 'entrar' && <form noValidate onSubmit={entrar}>
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
          {enviarBotao('Entrar')}
          <div className="links">{ir('recuperar', 'Esqueci minha senha')}{ir('primeiro', 'Primeiro acesso')}</div>
          <p className="dica">Os acessos da equipe são liberados pelo administrador do escritório.</p>
        </form>}

        {painel === 'primeiro' && <form noValidate onSubmit={primeiro}>
          <p className="dica" style={{ fontSize: 14 }}>{codigoConvite
            ? 'Use o e-mail em que você recebeu o convite do escritório e crie sua senha.'
            : 'O primeiro acesso é feito pelo link do convite que o escritório enviou para você (vale 7 dias). Abra esse link; se ele se perdeu ou venceu, peça um novo ao administrador.'}</p>
          <label>E-mail do convite<input name="email" type="email" autoComplete="email" required /></label>
          <label>Crie uma senha<input name="senha" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Repita a senha<input name="senha2" type="password" autoComplete="new-password" minLength={8} required /></label>
          <p className="dica">Use pelo menos 8 caracteres.</p>
          {enviarBotao('Criar meu acesso')}
          {ir('entrar', 'Voltar para entrar')}
        </form>}

        {painel === 'cliente' && <form noValidate onSubmit={portalEmBreve}>
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
          {enviarBotao('Acompanhar minhas demandas')}
          {ir('solicitar', 'Ainda não tenho acesso')}
        </form>}

        {painel === 'solicitar' && <form noValidate onSubmit={portalEmBreve}>
          <label>CPF ou CNPJ<input name="documento" inputMode="numeric" autoComplete="off" required /></label>
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <p className="dica">Use o e-mail informado no seu cadastro. O advogado responsável analisa o pedido e libera o acesso.</p>
          {enviarBotao('Solicitar acesso')}
          {ir('cliente', 'Voltar para entrar')}
        </form>}

        {painel === 'recuperar' && <form noValidate onSubmit={recuperar}>
          <label>E-mail da conta<input name="email" type="email" autoComplete="email" required /></label>
          <p className="dica">Enviaremos um link para você criar uma nova senha.</p>
          {enviarBotao('Enviar link')}
          {ir('entrar', 'Voltar para entrar')}
        </form>}

        {painel === 'nova' && <form noValidate onSubmit={novaSenha}>
          <label>Nova senha<input name="senha" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Repita a nova senha<input name="senha2" type="password" autoComplete="new-password" minLength={8} required /></label>
          {enviarBotao('Salvar nova senha')}
        </form>}
      </div>
    </div>
  </div></div>;
}
