// Início: saudação, atalhos, números de Pessoas, atualizadas recentemente e "Minha conta".
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { SD, type ResumoPessoas } from '../dados';
import { fmtDocumento, fmtTelefone, TIPOS } from '../regras/pessoa';
import { Avatares } from '../ui/Avatar';
import { falha, feito, useMudancas } from '../ui/avisos';
import { useSessao } from '../ui/sessao';
import { definirTema, TEMAS, useTema, type Tema } from '../ui/tema';
import { numero, relativo, useTitulo } from '../ui/util';

export default function Inicio() {
  useTitulo('Início');
  const { ctx, recarregar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();
  const [r, setR] = useState<ResumoPessoas | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => SD.pessoasResumo().then(setR).catch(e => setErro((e as Error).message));
  useEffect(() => { carregar(); }, []);
  useMudancas(() => { carregar(); });
  // "Minha conta" no menu leva até a seção, mesmo vindo de outra tela.
  useEffect(() => {
    if (r && local.hash === '#conta') document.getElementById('conta')?.scrollIntoView();
  }, [r, local.hash, local.key]);

  if (erro) return <div className="miolo"><div className="aviso erro">{erro}</div></div>;
  if (!r) return <div className="miolo"><p className="carregando">Carregando…</p></div>;

  const primeiro = (ctx.perfil.nome || '').trim().split(/\s+/)[0];
  return <div className="miolo">
    <header>
      <p className="olho">{ctx.escritorio?.nome || ''}</p>
      <h1 className="titulo">Olá{primeiro ? ', ' + primeiro : ''}<span className="ponto">.</span></h1>
    </header>

    <section className="destaque" aria-labelledby="tAtalho">
      <div style={{ flex: '1 1 360px', minWidth: 0 }}>
        <h2 id="tAtalho">Comece por aqui</h2>
        <p>{r.total ? 'Cadastre uma pessoa nova ou acompanhe o atendimento no quadro.' : 'Cadastre a primeira pessoa do escritório.'}</p>
      </div>
      <div className="acoes">
        <Link className="btn" to="/pessoas/?visao=kanban">Ver o quadro</Link>
        <Link className="btn pri" to="/pessoas/nova/">Cadastrar pessoa</Link>
      </div>
    </section>

    <section aria-labelledby="tNum" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="secao" id="tNum">Pessoas</h2>
      <div className="resumo">
        <Link className="cartao" to="/pessoas/"><b>{numero(r.total)}</b><span>No escritório</span></Link>
        <Link className="cartao" to="/pessoas/?responsavel=eu"><b>{numero(r.minhas)}</b><span>Sob sua responsabilidade</span></Link>
        <div className="cartao"><b>{numero(r.mes)}</b><span>Cadastradas neste mês</span></div>
        <Link className="cartao" to="/pessoas/?situacao=arquivadas"><b>{numero(r.arquivadas)}</b><span>Arquivadas</span></Link>
      </div>
    </section>

    <section aria-labelledby="tRec" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="secao-topo">
        <h2 className="secao" id="tRec">Atualizadas recentemente</h2>
        <Link className="link" to="/pessoas/">Ver todas</Link>
      </div>
      {r.recentes.length ? <div className="tabela"><table style={{ minWidth: 560 }}>
        <thead><tr><th scope="col">Pessoa</th><th scope="col">Contato</th><th scope="col">Responsáveis</th><th scope="col">Atualizada</th></tr></thead>
        <tbody>{r.recentes.map(p => <tr key={p.id} className="clicavel" onClick={() => navegar('/pessoas/?id=' + p.id)}>
          <td><div className="nome">{p.nome}</div><div className="sub">{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''}</div></td>
          <td>{fmtTelefone(p.telefones?.[0] || '')}</td>
          <td><Avatares ids={p.resp.map(x => x.perfil_id)} equipe={ctx.equipe} /></td>
          <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{relativo(p.atualizado_em)}</td>
        </tr>)}</tbody>
      </table></div>
        : <div className="vazio">Nenhuma pessoa cadastrada ainda. <Link className="link" to="/pessoas/nova/">Cadastrar a primeira</Link></div>}
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
    <h2 className="secao" id="tConta">Minha conta</h2>
    <div className="cartao campos" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p className="nota">E-mail de acesso: <b style={{ color: 'var(--ink)' }}>{ctx.usuario.email}</b></p>
      <form className="grade-campos" style={{ alignItems: 'end' }} onSubmit={salvar}>
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required /></label>
        <label>Usuário para menções <small>(@nome nas conversas)</small><input value={usuario} onChange={e => setUsuario(e.target.value)} required /></label>
        <div><button className="btn esc" type="submit" disabled={ocupado}>Salvar</button></div>
      </form>
      <label style={{ maxWidth: 320 }}>Aparência
        <select value={tema} onChange={e => definirTema(e.target.value as Tema)}>
          {(Object.keys(TEMAS) as Tema[]).map(k => <option key={k} value={k}>{TEMAS[k]}{k === 'auto' ? ' (segue o aparelho)' : ''}</option>)}
        </select>
      </label>
    </div>
  </section>;
}
