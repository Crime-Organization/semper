// Entrada: login da equipe, primeiro acesso por convite, recuperação de senha e entrada do cliente (em preparação).
// É sempre clara, qualquer que seja o tema escolhido.
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { MARCA } from '../marca';
import { SD, type TipoLink } from '../dados';
import { emailValido } from '../regras/pessoa';
import { mostrarTema, temaGuardado } from '../ui/tema';
import { useTitulo } from '../ui/util';
import { Aviso, Dica, estiloBotao } from '../ui/base';
import './Entrada.css';

type Painel = 'entrar' | 'primeiro' | 'cliente' | 'solicitar' | 'recuperar' | 'nova' | 'codigo';
// Cada painel tem tudo o que é dele num lugar só (padrão State): título, aba em que aparece (Equipe ou Sou cliente;
// sem aba, as abas somem), o envio do formulário e os campos.
interface DefPainel { titulo: string; aba?: 'entrar' | 'cliente'; enviar: (e: FormEvent<HTMLFormElement>) => Promise<void>; campos: ReactNode }
type Mensagem = { texto: string; tipo: 'erro' | 'ok' | 'info' } | null;

export default function Entrada() {
  useTitulo('Entrar');
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const volta = params.get('volta');
  const destino = volta && volta.startsWith('/') && !volta.startsWith('//') ? volta : '/inicio/';
  // Endereço dos links dos e-mails: a raiz do SEMPER (o Site URL do Supabase). A página inicial reconhece
  // o link (?token_hash, ?nova-senha, #access_token…) e o traz para esta tela.
  const aqui = location.origin + '/';
  // Link dos e-mails: ?token_hash=...&type=... (código de uso único, trocado pela sessão ao abrir).
  const linkEmail = (() => {
    const codigo = params.get('token_hash'), tipo = params.get('type') as TipoLink | null;
    return codigo && tipo && (['email', 'recovery', 'email_change'] as string[]).includes(tipo) ? { codigo, tipo } : null;
  })();
  const porRecuperacao = location.hash.includes('type=recovery') || params.has('nova-senha') || linkEmail?.tipo === 'recovery';
  // Código do convite: vem depois do "#" no link do convite. Fica só na memória e sai do endereço,
  // para não ficar no histórico do navegador.
  const [codigoConvite] = useState(() => new URLSearchParams(location.hash.slice(1)).get('convite') || '');
  useEffect(() => { if (codigoConvite) history.replaceState(null, '', location.pathname + location.search); }, [codigoConvite]);
  const inicial: Painel = porRecuperacao ? 'nova' : params.has('primeiro-acesso') ? 'primeiro' : params.has('recuperar') ? 'recuperar' : params.has('cliente') ? 'cliente' : 'entrar';

  const [painel, setPainel] = useState<Painel>(inicial);
  const [msg, setMsg] = useState<Mensagem>(params.has('desativado') ? { texto: 'Seu acesso a este escritório está desativado. Fale com o administrador.', tipo: 'info' } : null);
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const linkAberto = useRef(false);   // o código do link é de uso único, e o efeito abaixo pode rodar duas vezes em desenvolvimento
  const destinoDoCodigo = useRef(destino);   // para onde ir depois do código das duas etapas

  useLayoutEffect(() => {
    mostrarTema('claro');
    return () => mostrarTema(temaGuardado());
  }, []);

  const mostrar = (p: Painel) => { setPainel(p); setMsg(null); };
  const avisar = (texto: string, tipo: 'erro' | 'ok' | 'info' = 'erro') => setMsg({ texto, tipo });
  useEffect(() => { caixa.current?.querySelector<HTMLInputElement>('form input')?.focus(); }, [painel]);

  // Links dos e-mails: a confirmação de cadastro entra direto; o de nova senha abre o formulário.
  // (Os links antigos, com a chave no "#", continuam funcionando pelo aoMudarSessao.)
  useEffect(() => {
    const parar = SD.aoMudarSessao(evento => {
      if (evento === 'PASSWORD_RECOVERY') mostrar('nova');
      else if (evento === 'SIGNED_IN' && !porRecuperacao && location.hash.includes('access_token')) navegar('/inicio/', { replace: true });
    });
    if (linkEmail) {
      if (linkAberto.current) return parar;
      linkAberto.current = true;
      history.replaceState(null, '', location.pathname);
      // O que cada link faz depois de aceito.
      const depoisDoLink: Record<TipoLink, (comSessao: boolean) => void | Promise<void>> = {
        email: () => navegar('/inicio/', { replace: true }),
        recovery: () => mostrar('nova'),
        email_change: async comSessao => {
          if (!comSessao) {
            mostrar('entrar');
            avisar('Link confirmado. Para concluir a troca, abra também o link enviado ao outro e-mail. Depois, entre com o e-mail novo.', 'ok');
            return;
          }
          destinoDoCodigo.current = '/minha-conta/';
          if (await SD.duasEtapasPendente()) mostrar('codigo');
          else navegar(destinoDoCodigo.current, { replace: true });
        }
      };
      SD.confirmarLink(linkEmail.codigo, linkEmail.tipo)
        .then(({ comSessao }) => depoisDoLink[linkEmail.tipo](comSessao))
        .catch((e: Error) => { mostrar('entrar'); avisar(e.message); });
    } else if (!porRecuperacao) SD.sessao().then(async s => {
      if (!s || params.has('desativado')) return;
      // Entrou com a senha, mas tem verificação em duas etapas: falta o código do aplicativo.
      if (await SD.duasEtapasPendente()) mostrar('codigo'); else navegar(destino, { replace: true });
    }).catch(() => { /* sem conferir a sessão, a tela de entrada continua como está */ });
    return parar;
  // oxlint-disable-next-line react/exhaustive-deps -- confere a sessão uma vez só, ao abrir a tela
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
    if (await SD.duasEtapasPendente()) { mostrar('codigo'); return; }
    navegar(destino);
  });
  const codigo = enviar(async ler => {
    const c = ler('codigo').replace(/\D/g, '');
    if (c.length !== 6) return avisar('Digite os 6 números que o aplicativo autenticador mostra.');
    await SD.duasEtapasEntrar(c);
    navegar(destinoDoCodigo.current);
  });
  const sairDoCodigo = async () => { await SD.sair(); mostrar('entrar'); };
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

  const ir = (p: Painel, rotulo: ReactNode) => <button className={estiloBotao({ forma: 'link' })} type="button" disabled={ocupado} onClick={() => mostrar(p)}>{rotulo}</button>;
  const enviarBotao = (rotulo: string) => <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>{rotulo}</button>;

  const paineis: Record<Painel, DefPainel> = {
    entrar: {
      titulo: 'Entrar', aba: 'entrar', enviar: entrar,
      campos: <>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
        {enviarBotao('Entrar')}
        <div className="links">{ir('recuperar', 'Esqueci minha senha')}{ir('primeiro', 'Primeiro acesso')}</div>
        <Dica>Os acessos da equipe são liberados pelo administrador do escritório.</Dica>
      </>
    },
    primeiro: {
      titulo: 'Primeiro acesso', aba: 'entrar', enviar: primeiro,
      campos: <>
        <Dica style={{ fontSize: 14 }}>{codigoConvite
          ? 'Use o e-mail em que você recebeu o convite do escritório e crie sua senha.'
          : 'O primeiro acesso é feito pelo link do convite que o escritório enviou para você (vale 7 dias). Abra esse link; se ele se perdeu ou venceu, peça um novo ao administrador.'}</Dica>
        <label>E-mail do convite<input name="email" type="email" autoComplete="email" required /></label>
        <label>Crie uma senha<input name="senha" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Repita a senha<input name="senha2" type="password" autoComplete="new-password" minLength={8} required /></label>
        <Dica>Use pelo menos 8 caracteres.</Dica>
        {enviarBotao('Criar meu acesso')}
        {ir('entrar', 'Voltar para entrar')}
      </>
    },
    cliente: {
      titulo: 'Área do cliente', aba: 'cliente', enviar: portalEmBreve,
      campos: <>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
        {enviarBotao('Acompanhar minhas demandas')}
        {ir('solicitar', 'Ainda não tenho acesso')}
      </>
    },
    solicitar: {
      titulo: 'Solicitar acesso', aba: 'cliente', enviar: portalEmBreve,
      campos: <>
        <label>CPF ou CNPJ<input name="documento" autoCapitalize="characters" autoComplete="off" required /></label>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <Dica>Use o e-mail informado no seu cadastro. O advogado responsável analisa o pedido e libera o acesso.</Dica>
        {enviarBotao('Solicitar acesso')}
        {ir('cliente', 'Voltar para entrar')}
      </>
    },
    recuperar: {
      titulo: 'Recuperar senha', aba: 'entrar', enviar: recuperar,
      campos: <>
        <label>E-mail da conta<input name="email" type="email" autoComplete="email" required /></label>
        <Dica>Enviaremos um link para você criar uma nova senha.</Dica>
        {enviarBotao('Enviar link')}
        {ir('entrar', 'Voltar para entrar')}
      </>
    },
    codigo: {
      titulo: 'Código de verificação', enviar: codigo,
      campos: <>
        <Dica style={{ fontSize: 14 }}>Sua conta tem verificação em duas etapas. Abra o aplicativo autenticador do celular e digite o código do SEMPER.</Dica>
        <label>Código de 6 números<input name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required /></label>
        {enviarBotao('Confirmar')}
        <button className={estiloBotao({ forma: 'link' })} type="button" disabled={ocupado} onClick={sairDoCodigo}>Entrar com outra conta</button>
        <Dica>Perdeu o celular ou o aplicativo? Fale com o master do escritório.</Dica>
      </>
    },
    nova: {
      titulo: 'Nova senha', enviar: novaSenha,
      campos: <>
        <label>Nova senha<input name="senha" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Repita a nova senha<input name="senha2" type="password" autoComplete="new-password" minLength={8} required /></label>
        {enviarBotao('Salvar nova senha')}
      </>
    }
  };
  const atual = paineis[painel];

  return <div className="entrada"><div className="tela">
    <div className="lado">
      <img className="fundo" src={MARCA.fotoEntrada} alt="" aria-hidden="true" />
      <Link to="/" className="conhecer">Conheça o {MARCA.nome}</Link>
      <div>
        <h1>{MARCA.nome}<span style={{ color: 'var(--accent-bright)' }}>.</span></h1>
        <p>Contratos, demandas, prazos e equipe do escritório reunidos num só lugar.</p>
      </div>
    </div>

    <div className="form-lado">
      <div className="caixa" ref={caixa}>
        <div>
          <p className="olho">Área restrita</p>
          <h2 className="titulo" style={{ fontSize: 'clamp(30px, 3.4vw, 40px)' }}>{atual.titulo}</h2>
        </div>

        {atual.aba && <div className="abas" role="tablist" aria-label="Acesso">
          <button type="button" role="tab" aria-selected={atual.aba === 'entrar'} onClick={() => mostrar('entrar')}>Equipe</button>
          <button type="button" role="tab" aria-selected={atual.aba === 'cliente'} onClick={() => mostrar('cliente')}>Sou cliente</button>
        </div>}

        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

        <form key={painel} noValidate onSubmit={atual.enviar}>{atual.campos}</form>
      </div>
    </div>
  </div></div>;
}
