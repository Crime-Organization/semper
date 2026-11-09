// Caixa de mensagens de cada pessoa: onde ela foi citada com @ (#112) e os avisos dos prazos dela (#113). Clicar abre o cartão e marca como lida.
// O número no menu vem de ui/mensagens.ts; quem cria as mensagens é o banco: ao salvar o comentário e na rotina diária dos prazos.
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SD, type Mensagem, type TipoMensagem } from '../dados';
import { hojeNaAgenda } from '../regras/agenda';
import { CARTAO_DO_MODULO, dataDoAviso, enderecoDoComentario, enderecoDoPrazo, NOME_DO_PRAZO, rotuloDoAviso, trechoDaMensagem } from '../regras/mensagens';
import { Avatar } from '../ui/Avatar';
import { falha } from '../ui/avisos';
import { Botao } from '../ui/Botoes';
import { Aviso, Carregando, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { atualizarNaoLidas, naoLidas } from '../ui/mensagens';
import { useCtx } from '../ui/sessao';
import { dataHora, relativo, useTitulo } from '../ui/util';
import './Mensagens.css';

/** O botão do meio do mouse: abre o link em outra aba sem disparar o clique comum. */
const BOTAO_DO_MEIO = 1;

export default function Mensagens() {
  useTitulo('Mensagens');
  const [lista, setLista] = useState<Mensagem[] | string | null>(null);
  const quantasNaoLidas = naoLidas.usar();
  const carregar = useCallback(() => SD.mensagensListar().then(setLista).catch((e: unknown) => setLista((e as Error).message)), []);
  // Chegou mensagem (ou alguma foi lida em outra aba): a lista acompanha o número do menu.
  useEffect(() => { void carregar(); }, [carregar, quantasNaoLidas]);

  async function marcarLida(id: string) {
    try { await SD.mensagemMarcarLida(id); await carregar(); await atualizarNaoLidas(); }
    catch (e) { falha(e); }
  }
  async function marcarTodas() {
    try { await SD.mensagensMarcarTodasLidas(); await carregar(); await atualizarNaoLidas(); }
    catch (e) { falha(e); }
  }

  return <div className="miolo pagina-mensagens">
    <header className="mensagens-cabeca">
      <div>
        <h1 className="titulo">Mensagens<span className="ponto">.</span></h1>
        <p className="lead">As vezes em que marcaram você com @ nos comentários e os avisos dos prazos sob a sua responsabilidade.</p>
      </div>
      {/* O número do menu conta todas; a lista mostra só as mais novas. */}
      {quantasNaoLidas > 0 && <Botao pequeno onClick={marcarTodas}>Marcar todas como lidas</Botao>}
    </header>
    {lista === null ? <Carregando />
      : typeof lista === 'string' ? <Aviso tipo="erro">{lista}</Aviso>
      : !lista.length ? <Vazio>Nenhuma mensagem. Quando alguém marcar você com @ num comentário ou um prazo seu estiver perto de vencer, o aviso aparece aqui.</Vazio>
      : <ul className="lista-mensagens" aria-label="Mensagens">
        {lista.map(m => { const Item = ITEM_DO_TIPO[m.tipo]; return <Item key={m.id} m={m} aoMarcarLida={marcarLida} />; })}
      </ul>}
  </div>;
}

interface PropsDoItem { m: Mensagem; aoMarcarLida: (id: string) => Promise<void> }

const situacaoDa = (m: Mensagem) => m.lido_em ? 'lida' : 'não lida';
const situacaoDoAviso = (m: Mensagem) => m.lido_em ? 'lido' : 'não lido';

function LinhaDaMensagem({ m, rotulo, marcarLida, aoMarcarLida, children }: PropsDoItem & { rotulo: string; marcarLida: string; children: ReactNode }) {
  return <li className={'mensagem' + (m.lido_em ? '' : ' nao-lida')} aria-label={rotulo}>
    {children}
    <div className="mensagem-lado">
      <time className="mensagem-quando" dateTime={m.criado_em} title={dataHora(m.criado_em)}>{relativo(m.criado_em)}</time>
      {!m.lido_em && <Botao forma="link" aria-label={marcarLida} onClick={() => aoMarcarLida(m.id)}>Marcar como lida</Botao>}
    </div>
  </li>;
}

function LinkDaMensagem({ m, para, aoMarcarLida, children }: PropsDoItem & { para: string; children: ReactNode }) {
  const abrir = () => { if (!m.lido_em) void aoMarcarLida(m.id); };
  return <div className="mensagem-miolo">
    <Link className="mensagem-link" to={para} onClick={abrir} onAuxClick={e => { if (e.button === BOTAO_DO_MEIO) abrir(); }}>{children}</Link>
  </div>;
}

function CartaoQueNaoVe({ texto }: { texto: string }) {
  return <div className="mensagem-miolo"><p className="mensagem-trecho">{texto}</p></div>;
}

function ItemDaMencao(props: PropsDoItem) {
  const { m } = props;
  const ctx = useCtx();
  const c = m.comentario;
  const autor = ctx.equipe.find(x => x.id === c?.autor_id), nome = autor?.nome ?? 'Usuário removido';
  if (!c) {
    return <LinhaDaMensagem {...props} rotulo={`Mensagem ${situacaoDa(m)} de um cartão que você não vê mais`} marcarLida="Marcar como lida a mensagem de um cartão que você não vê mais">
      <CartaoQueNaoVe texto="Esta menção é de um cartão que você não vê mais." />
    </LinhaDaMensagem>;
  }
  return <LinhaDaMensagem {...props} rotulo={`Mensagem ${situacaoDa(m)} de ${nome}`} marcarLida={`Marcar como lida a mensagem de ${nome}`}>
    <Avatar p={autor} tam={32} />
    <LinkDaMensagem {...props} para={enderecoDoComentario(c.modulo, c.cartao_id, c.id)}>
      <span className="mensagem-titulo"><b>{nome}</b> citou você em {CARTAO_DO_MODULO[c.modulo].nome.toLowerCase()} <b>{c.cartao_nome || c.cartao_codigo}</b></span>
      <span className="mensagem-trecho">{trechoDaMensagem(c.texto)}</span>
    </LinkDaMensagem>
  </LinhaDaMensagem>;
}

function ItemDoPrazo(props: PropsDoItem) {
  const { m } = props;
  const p = m.prazo;
  if (!p) {
    return <LinhaDaMensagem {...props} rotulo={`Aviso de prazo ${situacaoDoAviso(m)} de um cartão que você não vê mais`} marcarLida="Marcar como lida a mensagem de prazo de um cartão que você não vê mais">
      <CartaoQueNaoVe texto="Este aviso de prazo é de um cartão que você não vê mais." />
    </LinhaDaMensagem>;
  }
  return <LinhaDaMensagem {...props} rotulo={`Aviso de prazo ${situacaoDoAviso(m)}: ${p.titulo}`} marcarLida={`Marcar como lida a mensagem de prazo de ${p.titulo}`}>
    <span className="mensagem-icone" aria-hidden="true"><Icone nome="sino" /></span>
    <LinkDaMensagem {...props} para={enderecoDoPrazo(p)}>
      <span className="mensagem-titulo"><b>{rotuloDoAviso(p, hojeNaAgenda())}</b>: {NOME_DO_PRAZO[p.modulo]} <b>{p.titulo || p.cartao_codigo}</b></span>
      <span className="mensagem-trecho">{dataDoAviso(p)}</span>
    </LinkDaMensagem>
  </LinhaDaMensagem>;
}

/** Como cada tipo de mensagem aparece. Tipo novo = uma entrada nova. */
const ITEM_DO_TIPO: Record<TipoMensagem, ComponentType<PropsDoItem>> = { mencao: ItemDaMencao, prazo: ItemDoPrazo };
