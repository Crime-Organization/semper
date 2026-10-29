// Início: saudação, atalhos, números de Pessoas, atualizadas recentemente e "Minha conta".
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { SD, type CadastroDuasEtapas, type FatorDuasEtapas, type ResumoPessoas } from '../dados';
import { fmtDocumento, fmtTelefone, TIPOS } from '../regras/pessoa';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoLink, Carregando, Cartao, estiloBotao, Nota, Selo, TituloSecao, Vazio } from '../ui/base';
import { useSessao } from '../ui/sessao';
import { definirTema, TEMAS, useTema, type Tema } from '../ui/tema';
import { dataCurta, numero, relativo, useTitulo } from '../ui/util';

export default function Inicio() {
  useTitulo('Início');
  const { ctx, recarregar } = useSessao();
  const local = useLocation();
  const [r, setR] = useState<ResumoPessoas | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => SD.pessoasResumo().then(setR).catch(e => setErro((e as Error).message));
  useEffect(() => { void carregar(); }, []);
  useMudancas(() => { void carregar(); });
  // "Minha conta" no menu leva até a seção, mesmo vindo de outra tela.
  useEffect(() => {
    if (r && local.hash === '#conta') document.getElementById('conta')?.scrollIntoView();
  }, [r, local.hash, local.key]);

  if (erro) return <div className="miolo"><Aviso tipo="erro">{erro}</Aviso></div>;
  if (!r) return <div className="miolo"><Carregando /></div>;

  const primeiro = (ctx.perfil.nome || '').trim().split(/\s+/)[0];
  return <div className="miolo">
    <header>
      <h1 className="titulo">Olá{primeiro ? ', ' + primeiro : ''}<span className="ponto">.</span></h1>
    </header>

    <section className="destaque" aria-labelledby="tAtalho">
      <div style={{ flex: '1 1 360px', minWidth: 0 }}>
        <h2 id="tAtalho">Comece por aqui</h2>
        <p>{r.total ? 'Cadastre uma pessoa nova ou acompanhe o atendimento no quadro.' : 'Cadastre a primeira pessoa do escritório.'}</p>
      </div>
      <div className="acoes">
        <BotaoLink to="/pessoas/?visao=kanban">Ver o quadro</BotaoLink>
        <BotaoLink variante="principal" to="/pessoas/nova/">Cadastrar pessoa</BotaoLink>
      </div>
    </section>

    <section aria-labelledby="tNum" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TituloSecao id="tNum">Pessoas</TituloSecao>
      <div className="resumo">
        <Link className="cartao" to="/pessoas/"><b>{numero(r.total)}</b><span>No escritório</span></Link>
        <Link className="cartao" to="/pessoas/?responsavel=eu"><b>{numero(r.minhas)}</b><span>Sob sua responsabilidade</span></Link>
        <Cartao><b>{numero(r.mes)}</b><span>Cadastradas neste mês</span></Cartao>
        <Link className="cartao" to="/pessoas/?situacao=arquivadas"><b>{numero(r.arquivadas)}</b><span>Arquivadas</span></Link>
      </div>
    </section>

    <section aria-labelledby="tRec" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="secao-topo">
        <TituloSecao id="tRec">Atualizadas recentemente</TituloSecao>
        <BotaoLink forma="link" to="/pessoas/">Ver todas</BotaoLink>
      </div>
      {r.recentes.length ? <div className="tabela"><table style={{ minWidth: 560 }}>
        <thead><tr><th scope="col">Pessoa</th><th scope="col">Contato</th><th scope="col">Responsáveis</th><th scope="col">Atualizada</th></tr></thead>
        <tbody>{r.recentes.map(p => <LinhaQueAbre key={p.id} para={'/pessoas/?id=' + p.id}>
          <td><NomeDaLinha>{p.nome}</NomeDaLinha><div className="sub">{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''}</div></td>
          <td>{fmtTelefone(p.telefones?.[0] || '')}</td>
          <td><Avatares ids={p.resp.map(x => x.perfil_id)} equipe={ctx.equipe} /></td>
          <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{relativo(p.atualizado_em)}</td>
        </LinhaQueAbre>)}</tbody>
      </table></div>
        : <Vazio>Nenhuma pessoa cadastrada ainda. <BotaoLink forma="link" to="/pessoas/nova/">Cadastrar a primeira</BotaoLink></Vazio>}
    </section>

    <MinhaConta aoSalvar={() => recarregar(false)} />
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

  return <section id="conta" aria-labelledby="tConta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <TituloSecao id="tConta">Minha conta</TituloSecao>
    <Cartao className="campos" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Nota>E-mail de acesso: <b style={{ color: 'var(--ink)' }}>{ctx.usuario.email}</b></Nota>
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
