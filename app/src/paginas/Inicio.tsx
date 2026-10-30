// Início: saudação, atalhos, números de Pessoas e atualizadas recentemente. "Minha conta" tem página própria (MinhaConta.tsx).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SD, type ResumoPessoas } from '../dados';
import { fmtDocumento, fmtTelefone, TIPOS } from '../regras/pessoa';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Avatares } from '../ui/Avatar';
import { useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, Cartao, TituloSecao, Vazio } from '../ui/base';
import { useSessao } from '../ui/sessao';
import { numero, relativo, useTitulo } from '../ui/util';

export default function Inicio() {
  useTitulo('Início');
  const { ctx } = useSessao();
  const [r, setR] = useState<ResumoPessoas | null>(null);
  const [erro, setErro] = useState('');

  const carregar = () => SD.pessoasResumo().then(setR).catch(e => setErro((e as Error).message));
  useEffect(() => { void carregar(); }, []);
  useMudancas(() => { void carregar(); });

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

  </div>;
}
