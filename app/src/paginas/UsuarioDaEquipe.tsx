// A janela de um usuário em Equipe e acessos (abre ao clicar na linha dele): o nome, o acesso, a função, o papel, a
// sociedade (com as datas à vista) e os atalhos para o perfil profissional e o cadastro. O nome de um usuário o
// administrador muda; o de um administrador, só o master; o de um master, só ele mesmo.
import { useId, useState, type FormEvent } from 'react';
import { SD, type Funcao, type Papel, type Socio, type Usuario } from '../dados';
import { FUNCOES } from '../regras/equipe';
import { avisar, falha } from '../ui/avisos';
import { Avatar } from '../ui/Avatar';
import { BotaoLink, Campo, estiloBotao, Nota, propsDoCampo, Selo } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { useCtx } from '../ui/sessao';
import { dataHora, PAPEIS } from '../ui/util';
import { SocioNaEquipe } from './financeiro/SocioNaEquipe';
import './Financeiro.css';

/** Como a situação de um usuário aparece. */
export const seloDaSituacao = (u: Usuario) => u.reservada ? <Selo tipo="pend">Sem acesso ao sistema</Selo> : !u.ativo ? <Selo tipo="erro">Desativado</Selo>
  : !u.confirmado ? <Selo tipo="pend">Aguardando confirmação</Selo> : <Selo tipo="ok">Ativo</Selo>;

interface Props {
  u: Usuario;
  /** Pode mudar a função, o papel, o e-mail e a situação (não é você, nem um master, nem um administrador para quem não é master). */
  gerir: boolean;
  socios: Socio[] | null;
  aoTrocarFuncao: (f: Funcao) => void;
  aoTrocarPapel: (p: Papel) => void;
  aoTrocarEmail: () => void;
  aoDefinirAtivo: (ativo: boolean) => Promise<void>;
  aoMudar: () => void;
}

export function UsuarioDaEquipe({ u, gerir, socios, aoTrocarFuncao, aoTrocarPapel, aoTrocarEmail, aoDefinirAtivo, aoMudar }: Props) {
  const ctx = useCtx();
  const id = useId();
  const eu = ctx.perfil.id;
  const podeRenomear = u.id === eu || (u.papel === 'usuario') || (u.papel === 'admin' && ctx.ehMaster);
  const [nome, setNome] = useState(u.nome);
  const [ocupado, setOcupado] = useState(false);
  const mudouNome = nome.trim() !== u.nome;

  async function salvarNome(ev: FormEvent) {
    ev.preventDefault();
    if (!mudouNome || ocupado) return;
    setOcupado(true);
    try {
      await SD.equipeDefinirNome(u.id, nome.trim());
      avisar(`Nome salvo: ${nome.trim()}.`);
      aoMudar();
    } catch (e) { falha(e); }
    setOcupado(false);
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">{seloDaSituacao(u)}{u.papel === 'master' && <Selo tipo="escuro">Master</Selo>}</div>
      <div className="usuario-cabeca"><Avatar p={u} tam={44} /><div><h2>{u.nome}</h2>{!u.reservada && <span className="sub">@{u.usuario} · {u.email}</span>}</div></div>
    </header>

    <section className="bloco separada" aria-label="Nome do usuário">
      <form className="usuario-nome" onSubmit={salvarNome} noValidate>
        <Campo rotulo="Nome" para={id + 'nome'}>
          <input type="text" {...propsDoCampo(id + 'nome')} value={nome} maxLength={200} disabled={!podeRenomear} onChange={e => setNome(e.target.value)} />
        </Campo>
        {podeRenomear && <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={!mudouNome || ocupado}>{ocupado ? 'Salvando…' : 'Salvar nome'}</button>}
      </form>
      {!podeRenomear && <Nota>{u.papel === 'master' ? 'Só o próprio master muda o nome dele.' : 'Só o master muda o nome de um administrador.'}</Nota>}
    </section>

    <section className="bloco separada" aria-label="Função e papel">
      <div className="usuario-campos">
        <Campo rotulo="Função" para={id + 'funcao'} dica="Só advogados são responsáveis por contratos.">
          <select {...propsDoCampo(id + 'funcao')} value={u.funcao} onChange={e => aoTrocarFuncao(e.target.value as Funcao)}>
            {(Object.keys(FUNCOES) as Funcao[]).map(f => <option key={f} value={f}>{FUNCOES[f]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Papel no sistema" para={id + 'papel'} dica="Quem administra o sistema.">
          <select {...propsDoCampo(id + 'papel')} value={u.papel} disabled={!(gerir && ctx.ehMaster)} onChange={e => aoTrocarPapel(e.target.value as Papel)}>
            {(u.papel === 'master' ? ['master'] as Papel[] : ['usuario', 'admin'] as Papel[]).map(p => <option key={p} value={p}>{PAPEIS[p]}</option>)}
          </select>
        </Campo>
      </div>
    </section>

    {socios && u.pessoa_id && <section className="bloco separada" aria-labelledby={id + 'socio'}>
      <h3 id={id + 'socio'}>Sócio</h3>
      <SocioNaEquipe usuario={u} socios={socios} aoMudar={aoMudar} />
    </section>}

    {!u.reservada && <section className="bloco separada" aria-labelledby={id + 'acesso'}>
      <h3 id={id + 'acesso'}>Acesso</h3>
      <p className="usuario-acesso">E-mail de acesso: <b>{u.email}</b> · {u.ultimo_acesso ? 'Último acesso: ' + dataHora(u.ultimo_acesso) : 'Nunca entrou'}</p>
      {gerir && <div className="financeiro-acoes">
        <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Trocar e-mail de ${u.nome}`} onClick={aoTrocarEmail}>Trocar e-mail</button>
        {u.ativo ? <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar desativação" aoConfirmar={() => aoDefinirAtivo(false)}>Desativar</BotaoDuplo>
          : <BotaoDuplo forma="mini" confirmar="Confirmar reativação" aoConfirmar={() => aoDefinirAtivo(true)}>Reativar</BotaoDuplo>}
      </div>}
    </section>}

    <div className="financeiro-acoes">
      <BotaoLink forma="mini" to={'/equipe/perfil/?id=' + u.id} aria-label={`Perfil profissional de ${u.nome}`}>Perfil profissional</BotaoLink>
      {u.pessoa_id && <BotaoLink forma="mini" to={'/pessoas/?id=' + u.pessoa_id}>Cadastro</BotaoLink>}
    </div>
  </>;
}
