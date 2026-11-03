// Minha conta: nome, @usuário, aparência e verificação em duas etapas (que ficavam no Início) e o perfil profissional,
// a base da página de cada um no site do escritório.
import { useEffect, useState, type FormEvent } from 'react';
import { SD, type CadastroDuasEtapas, type EmailDaConta, type FatorDuasEtapas } from '../dados';
import { TAMANHO_EMAIL_DE_ACESSO } from '../dados/limites';
import { erroDoNovoEmail } from '../regras/conta';
import { avisar, falha, feito } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, Campo, Carregando, Cartao, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao } from '../ui/base';
import { useSessao } from '../ui/sessao';
import { definirTema, TEMAS, useTema, type Tema } from '../ui/tema';
import { dataCurta, useTitulo } from '../ui/util';
import { FotoDoPerfil } from './FotoDoPerfil';
import { FormularioDoPerfil } from './PerfilProfissional';
import './Configuracoes.css';

export default function PaginaMinhaConta() {
  useTitulo('Minha conta');
  const { ctx, recarregar } = useSessao();
  const eu = ctx.equipe.find(m => m.id === ctx.perfil.id) ?? ctx.perfil;
  return <div className="miolo">
    <header>
      <h1 className="titulo">Minha conta<span className="ponto">.</span></h1>
      <p className="lead">Seus dados de acesso e o seu perfil profissional, que é a base da sua página no site do escritório.</p>
    </header>
    <MinhaConta aoSalvar={() => recarregar(false)} />
    <section aria-labelledby="tPerfil" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tPerfil">Perfil profissional</TituloSecao>
      <section className="cartao config campos foto-cartao" aria-labelledby="tFoto">
        <h3 className="perfil-bloco" id="tFoto">Foto</h3>
        <FotoDoPerfil membro={eu} />
      </section>
      <FormularioDoPerfil perfilId={ctx.perfil.id} nome={ctx.perfil.nome} podePublicar={ctx.ehAdmin} />
    </section>
  </div>;
}

function MinhaConta({ aoSalvar }: { aoSalvar: () => void }) {
  const { ctx } = useSessao();
  const tema = useTema();
  const [nome, setNome] = useState(ctx.perfil.nome);
  const [usuario, setUsuario] = useState(ctx.perfil.usuario);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim().replace(/\s+/g, ' ');
    const u = usuario.trim().toLowerCase().replace(/^@/, '');
    if (!n) return falha(new Error('Informe seu nome.'));
    if (!/^[a-z0-9._-]{2,40}$/.test(u)) return falha(new Error('O usuário aceita letras sem acento, números, ponto, hífen e sublinhado (2 a 40).'));
    const antes = { nome: ctx.perfil.nome, usuario: ctx.perfil.usuario };
    setOcupado(true);
    try {
      await SD.salvarPerfil({ nome: n, usuario: u });
      setNome(n); setUsuario(u);
      aoSalvar();
      feito('Conta atualizada.', 'alteração da conta', async () => {
        await SD.salvarPerfil(antes);
        setNome(antes.nome); setUsuario(antes.usuario);
        aoSalvar();
      });
    } catch (err) {
      falha(/duplicate|existe/i.test((err as Error).message) ? new Error('Esse @usuário já é usado por outra pessoa do escritório.') : err);
    }
    setOcupado(false);
  }

  return <section aria-labelledby="tConta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <TituloSecao id="tConta">Acesso</TituloSecao>
    <Cartao className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <EmailDeAcesso aoTrocar={aoSalvar} />
      <form className="grade-campos" style={{ alignItems: 'end' }} onSubmit={salvar}>
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required /></label>
        <label>Usuário para menções <small>(@nome nas conversas)</small><input value={usuario} onChange={e => setUsuario(e.target.value)} required /></label>
        <div><button className={estiloBotao({ variante: 'escuro' })} type="submit" disabled={ocupado}>Salvar</button></div>
      </form>
      <label style={{ maxWidth: 320 }}>Aparência
        <select value={tema} onChange={e => definirTema(e.target.value as Tema)}>
          {(Object.keys(TEMAS) as Tema[]).map(k => <option key={k} value={k}>{TEMAS[k]}{k === 'auto' ? ' (segue o aparelho)' : ''}</option>)}
        </select>
      </label>
      <DuasEtapas />
    </Cartao>
  </section>;
}

// O e-mail de acesso: vem da conta, porque a troca pode ter sido confirmada em outro aparelho. Até a confirmação, vale o atual.
function EmailDeAcesso({ aoTrocar }: { aoTrocar: () => void }) {
  const { ctx } = useSessao();
  const [conta, setConta] = useState<EmailDaConta | null>(null);
  const [novo, setNovo] = useState<string | null>(null);   // null: o formulário está fechado
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { SD.contaEmail().then(setConta).catch(falha); }, []);
  const atual = conta?.atual || ctx.usuario.email || '';
  const abrir = (valor: string | null) => { setNovo(valor); setErro(null); };

  async function trocar(e: FormEvent) {
    e.preventDefault();
    const problema = erroDoNovoEmail(novo ?? '', atual);
    setErro(problema);
    if (problema) return;
    setOcupado(true);
    try {
      const nova = await SD.trocarEmail(novo ?? '');
      setConta(nova);
      abrir(null);
      if (nova.pendente) avisar('Pedido enviado. Confirme pelo link que chegará por e-mail.');
      else { avisar('E-mail de acesso alterado.'); aoTrocar(); }
    } catch (err) { setErro((err as Error).message); }
    setOcupado(false);
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <Nota>E-mail de acesso: <b style={{ color: 'var(--ink)' }}>{atual}</b></Nota>
    {conta?.pendente && <Aviso tipo="info">
      Troca aguardando confirmação para <b>{conta.pendente}</b>. Abra o link enviado por e-mail; se o e-mail atual também receber um, abra os dois. Até lá, continue entrando com {atual}.
    </Aviso>}
    {novo === null
      ? <div><button className={estiloBotao({ pequeno: true })} type="button" onClick={() => abrir('')}>{conta?.pendente ? 'Pedir de novo' : 'Trocar e-mail'}</button></div>
      : <form noValidate onSubmit={trocar} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
        <Campo rotulo="E-mail novo" para="email-novo" erro={erro}>
          <input {...propsDoCampo('email-novo', { erro })} type="email" autoComplete="email" maxLength={TAMANHO_EMAIL_DE_ACESSO} autoFocus value={novo} onChange={e => setNovo(e.target.value)} />
        </Campo>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>Enviar confirmação</button>
          <button className={estiloBotao()} type="button" disabled={ocupado} onClick={() => abrir(null)}>Cancelar</button>
        </div>
      </form>}
  </div>;
}

// Verificação em duas etapas: além da senha, o código do aplicativo autenticador do celular.
function DuasEtapas() {
  const { ctx } = useSessao();
  const [fatores, setFatores] = useState<FatorDuasEtapas[] | null>(null);
  const [cadastro, setCadastro] = useState<CadastroDuasEtapas | null>(null);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const carregar = () => SD.duasEtapasFatores().then(setFatores).catch(falha);
  useEffect(() => { void carregar(); }, []);
  const ativo = fatores?.find(f => f.ativo);

  async function iniciar() {
    setOcupado(true);
    try { setCadastro(await SD.duasEtapasIniciar()); setCodigo(''); } catch (e) { falha(e); }
    setOcupado(false);
  }
  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!cadastro) return;
    const c = codigo.replace(/\D/g, '');
    if (c.length !== 6) return falha(new Error('Digite os 6 números que o aplicativo mostra.'));
    setOcupado(true);
    try {
      await SD.duasEtapasConfirmar(cadastro.id, c);
      setCadastro(null);
      avisar('Verificação em duas etapas ativada. Nas próximas entradas, o SEMPER vai pedir o código do aplicativo.');
      void carregar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }
  async function desativar() {
    if (!ativo) return;
    try { await SD.duasEtapasDesativar(ativo.id); avisar('Verificação em duas etapas desativada. A entrada volta a pedir só a senha.'); void carregar(); }
    catch (e) { falha(e); }
  }

  return <div className="duas-etapas">
    <h3>Verificação em duas etapas</h3>
    {fatores === null ? <Carregando />
      : ativo ? <>
        <Nota><Selo tipo="ok">Ativa</Selo> desde {dataCurta(ativo.criado_em)}. Ao entrar, o SEMPER pede a senha e o código do aplicativo autenticador.</Nota>
        <div><BotaoDuplo pequeno confirmar="Confirmar: desativar" aoConfirmar={desativar}>Desativar</BotaoDuplo></div>
      </>
      : cadastro ? <form className="duas-etapas-ativar" onSubmit={confirmar}>
        <ol>
          <li>No celular, abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy…) e adicione uma conta lendo este QR code.</li>
          <li>Sem câmera? Digite esta chave no aplicativo: <code className="chave">{cadastro.segredo}</code></li>
          <li>Digite o código de 6 números que o aplicativo mostrar.</li>
        </ol>
        <img className="qr" src={cadastro.qr} alt="QR code para o aplicativo autenticador" width={180} height={180} />
        <div className="grade-campos" style={{ alignItems: 'end' }}>
          <label>Código do aplicativo<input value={codigo} onChange={e => setCodigo(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>Ativar</button>
            <button className={estiloBotao()} type="button" onClick={() => setCadastro(null)}>Cancelar</button>
          </div>
        </div>
      </form>
      : <>
        <Nota>Além da senha, o SEMPER passa a pedir um código de 6 números do aplicativo autenticador do celular. Assim, quem descobrir sua senha não entra.{ctx.ehAdmin ? ' Recomendado para quem administra o escritório.' : ''}</Nota>
        <div><button className={estiloBotao({ variante: 'principal', pequeno: true })} type="button" disabled={ocupado} onClick={iniciar}>Ativar verificação em duas etapas</button></div>
      </>}
  </div>;
}
