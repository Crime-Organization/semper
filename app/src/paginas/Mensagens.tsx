// Caixa de mensagens de cada pessoa: onde ela foi citada com @ (#112), os avisos dos prazos dela (#113), os lembretes marcados nas tarefas e
// demandas em que ela está (#286), os pedidos para participar de um item (#363: quem aprova recebe o pedido, com "Aprovar" e
// "Recusar"; quem pediu recebe a resposta), o aviso de quando alguém a põe num item (#377; pelo grupo da equipe, diz qual) e a
// mensagem de quando um administrador a põe num grupo da equipe (#378). Clicar abre o cartão e marca como lida.
// O número no menu vem de ui/mensagens.ts; quem cria as mensagens é o banco: ao salvar o comentário ou a equipe de um item, na rotina
// diária dos prazos e na dos lembretes.
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SD, type Mensagem, type TipoMensagem } from '../dados';
import { AVISO_AO_RESPONDER, enderecoDaResposta, enderecoDoItemDoPedido, PEDIDO_DO_MODULO, RESPOSTA_DO_PEDIDO, respostaDoPedido, type RespostaDoPedido } from '../regras/pedidoDeParticipacao';
import { hojeNaAgenda } from '../regras/agenda';
import { acaoDaInclusao, enderecoDaInclusao, INCLUSAO_DO_MODULO, nomeDoItemDaInclusao, rotulosDaInclusao } from '../regras/inclusao';
import { linksDoGrupo, textoDaMensagemDeGrupo } from '../regras/gruposDaEquipe';
import { CARTAO_DO_MODULO, dataDoAviso, enderecoDoComentario, enderecoDoPrazo, NOME_DO_AVISO, NOME_DO_PRAZO, rotuloDoAviso, trechoDaMensagem } from '../regras/mensagens';
import { Avatar } from '../ui/Avatar';
import { avisar, falha } from '../ui/avisos';
import { Botao } from '../ui/Botoes';
import { Aviso, Carregando, Vazio } from '../ui/base';
import { Icone } from '../ui/Icone';
import { atualizarNaoLidas, naoLidas } from '../ui/mensagens';
import { useCtx } from '../ui/sessao';
import { TextoComMencoes } from '../ui/TextoComMencoes';
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
  /** Um pedido foi respondido: ele sai da caixa (de todos os que aprovariam) e o número do menu acompanha. */
  async function mudou() { await carregar(); await atualizarNaoLidas(); }
  async function marcarTodas() {
    try { await SD.mensagensMarcarTodasLidas(); await carregar(); await atualizarNaoLidas(); }
    catch (e) { falha(e); }
  }

  return <div className="miolo pagina-mensagens">
    <header className="mensagens-cabeca">
      <div>
        <h1 className="titulo">Mensagens<span className="ponto">.</span></h1>
        <p className="lead">Menções com @, prazos, lembretes, pedidos para participar e quando incluem você num item ou num grupo.</p>
      </div>
      {/* O número do menu conta todas; a lista mostra só as mais novas. */}
      {quantasNaoLidas > 0 && <Botao pequeno onClick={marcarTodas}>Marcar todas como lidas</Botao>}
    </header>
    {lista === null ? <Carregando />
      : typeof lista === 'string' ? <Aviso tipo="erro">{lista}</Aviso>
      : !lista.length ? <Vazio>Nenhuma mensagem. Menções com @, prazos, lembretes, pedidos para participar e avisos de quando incluem você num item aparecem aqui.</Vazio>
      : <ul className="lista-mensagens" aria-label="Mensagens">
        {lista.map(m => { const Item = ITEM_DO_TIPO[m.tipo]; return <Item key={m.id} m={m} aoMarcarLida={marcarLida} aoMudar={mudou} />; })}
      </ul>}
  </div>;
}

interface PropsDoItem { m: Mensagem; aoMarcarLida: (id: string) => Promise<void>; aoMudar: () => Promise<void> }

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
    <LinkDaMensagem {...props} para={enderecoDoComentario(c.modulo, c.cartao_id, c.id, c.tipo_do_processo)}>
      <span className="mensagem-titulo"><b>{nome}</b> citou você em {CARTAO_DO_MODULO[c.modulo].nome.toLowerCase()} <b>{c.cartao_nome || c.cartao_codigo}</b></span>
      <span className="mensagem-trecho"><TextoComMencoes texto={trechoDaMensagem(c.texto)} /></span>
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
  return <LinhaDaMensagem {...props} rotulo={`${NOME_DO_AVISO[p.aviso]} ${situacaoDoAviso(m)}: ${p.titulo}`} marcarLida={`Marcar como lida a mensagem de prazo de ${p.titulo}`}>
    <span className="mensagem-icone" aria-hidden="true"><Icone nome="sino" /></span>
    <LinkDaMensagem {...props} para={enderecoDoPrazo(p)}>
      <span className="mensagem-titulo"><b>{rotuloDoAviso(p, hojeNaAgenda())}</b>: {NOME_DO_PRAZO[p.modulo]} <b>{p.titulo || p.cartao_codigo}</b></span>
      <span className="mensagem-trecho">{dataDoAviso(p)}</span>
    </LinkDaMensagem>
  </LinhaDaMensagem>;
}

/** O código do item do pedido: um link para o cartão, quando a pessoa o vê. */
function CodigoDoItem({ codigo, para }: { codigo: string; para: string | null }) {
  return para ? <Link className="mensagem-codigo" to={para}>{codigo}</Link> : <b>{codigo}</b>;
}

/** O pedido para participar, na caixa de quem aprova (#363): o primeiro que responde resolve, e o pedido sai da caixa dos outros. */
function ItemDoPedido(props: PropsDoItem) {
  const { m, aoMudar } = props;
  const ctx = useCtx();
  const p = m.pedido;
  if (!p) {
    return <LinhaDaMensagem {...props} rotulo={`Pedido ${situacaoDa(m)} que não está mais disponível`} marcarLida="Marcar como lido o pedido que não está mais disponível">
      <CartaoQueNaoVe texto="Este pedido para participar não está mais disponível." />
    </LinhaDaMensagem>;
  }
  const quem = ctx.equipe.find(x => x.id === p.pedido_por), nome = quem?.nome ?? 'Usuário removido', modulo = PEDIDO_DO_MODULO[p.modulo];
  async function responder(r: RespostaDoPedido) {
    try { await SD.participacaoResponder(p!.id, r === 'aprovado'); avisar(AVISO_AO_RESPONDER[r](nome, p!.modulo)); }
    catch (e) { falha(e); }
    await aoMudar();
  }
  return <LinhaDaMensagem {...props} rotulo={`Pedido para participar ${situacaoDa(m)} de ${nome}`} marcarLida={`Marcar como lido o pedido de ${nome}`}>
    <Avatar p={quem} tam={32} />
    <div className="mensagem-miolo mensagem-pedido">
      <span className="mensagem-titulo"><b>{nome}</b> pediu para participar {modulo.doItem} <CodigoDoItem codigo={p.item_codigo} para={enderecoDoItemDoPedido(p)} /></span>
      <span className="mensagem-trecho">Ao aprovar, {nome} {modulo.aoAprovar}.</span>
      <div className="mensagem-acoes">
        <Botao pequeno variante="principal" ocupadoTexto="Aprovando…" aria-label={`Aprovar o pedido de ${nome}`} onClick={() => responder('aprovado')}>Aprovar</Botao>
        <Botao pequeno ocupadoTexto="Recusando…" aria-label={`Recusar o pedido de ${nome}`} onClick={() => responder('recusado')}>Recusar</Botao>
      </div>
    </div>
  </LinhaDaMensagem>;
}

/** A resposta ao pedido, na caixa de quem pediu (#363). Aprovada, abre o cartão; recusada, só avisa. */
function ItemDaResposta(props: PropsDoItem) {
  const { m } = props;
  const ctx = useCtx();
  const p = m.pedido, r = p && respostaDoPedido(p.situacao);
  if (!p || !r) {
    return <LinhaDaMensagem {...props} rotulo={`Resposta ${situacaoDa(m)} de um pedido que não está mais disponível`} marcarLida="Marcar como lida a resposta de um pedido que não está mais disponível">
      <CartaoQueNaoVe texto="Esta resposta é de um pedido que não está mais disponível." />
    </LinhaDaMensagem>;
  }
  const quem = ctx.equipe.find(x => x.id === p.respondido_por), nome = quem?.nome ?? 'Usuário removido', resposta = RESPOSTA_DO_PEDIDO[r];
  const para = enderecoDaResposta(p);
  const texto = <>
    <span className="mensagem-titulo"><b>{nome}</b> {resposta.verbo} seu pedido para participar {PEDIDO_DO_MODULO[p.modulo].doItem} <b>{p.item_codigo}</b></span>
    <span className="mensagem-trecho">{resposta.depois(p.modulo)}</span>
  </>;
  return <LinhaDaMensagem {...props} rotulo={`Resposta ${situacaoDa(m)}: ${nome} ${resposta.verbo} seu pedido`} marcarLida={`Marcar como lida a resposta de ${nome}`}>
    <Avatar p={quem} tam={32} />
    {para ? <LinkDaMensagem {...props} para={para}>{texto}</LinkDaMensagem> : <div className="mensagem-miolo mensagem-pedido">{texto}</div>}
  </LinhaDaMensagem>;
}

/**
 * O aviso de que alguém pôs a pessoa num item (#377). Com o item, quem incluiu, o nome do item e o link para o cartão; sem ele (a
 * pessoa foi retirada), só que ela não faz mais parte, sem nada do item nem quem incluiu, como a menção de um cartão que não vê.
 */
function ItemDaInclusao(props: PropsDoItem) {
  const { m } = props;
  const ctx = useCtx();
  const i = m.inclusao!, modulo = INCLUSAO_DO_MODULO[i.modulo];
  const quem = ctx.equipe.find(x => x.id === i.incluido_por), nome = quem?.nome ?? 'Usuário removido';
  const rotulos = rotulosDaInclusao(i, nome, situacaoDoAviso(m));
  const para = i.item && enderecoDaInclusao(i.modulo, i.item);
  if (!i.item || !para) {
    return <LinhaDaMensagem {...props} rotulo={rotulos.linha} marcarLida={rotulos.marcarLida}>
      <CartaoQueNaoVe texto={modulo.naoFazMais} />
    </LinhaDaMensagem>;
  }
  return <LinhaDaMensagem {...props} rotulo={rotulos.linha} marcarLida={rotulos.marcarLida}>
    <Avatar p={quem} tam={32} />
    <LinkDaMensagem {...props} para={para}>
      <span className="mensagem-titulo"><b>{nome}</b> {acaoDaInclusao(i)} <b>{nomeDoItemDaInclusao(i.item)}</b></span>
      <span className="mensagem-trecho">{modulo.agora[i.entrou_como]}</span>
    </LinkDaMensagem>
  </LinhaDaMensagem>;
}

/**
 * A mensagem de quem foi posto num grupo da equipe (#378): uma só, a do grupo, com os links para as demandas e as tarefas dele
 * (filtradas no grupo). Abrir um link marca como lida.
 */
function ItemDoGrupo(props: PropsDoItem) {
  const { m, aoMarcarLida } = props;
  const ctx = useCtx();
  const g = m.grupo;
  if (!g) {
    return <LinhaDaMensagem {...props} rotulo={`Mensagem ${situacaoDa(m)} de um grupo que não existe mais`} marcarLida="Marcar como lida a mensagem de um grupo que não existe mais">
      <CartaoQueNaoVe texto="Este grupo da equipe não existe mais." />
    </LinhaDaMensagem>;
  }
  const quem = ctx.equipe.find(x => x.id === g.incluido_por), nome = quem?.nome ?? 'Usuário removido';
  const texto = textoDaMensagemDeGrupo(nome, g.nome);
  const abrir = () => { if (!m.lido_em) void aoMarcarLida(m.id); };
  return <LinhaDaMensagem {...props} rotulo={`Mensagem ${situacaoDa(m)}: ${texto.titulo}`} marcarLida={`Marcar como lida a mensagem do grupo ${g.nome}`}>
    <Avatar p={quem} tam={32} />
    <div className="mensagem-miolo mensagem-pedido">
      <span className="mensagem-titulo"><b>{nome}</b> incluiu você no grupo <b>{g.nome}</b>.</span>
      <span className="mensagem-trecho">{texto.trecho}</span>
      <div className="mensagem-acoes">
        {linksDoGrupo(g.grupo_id).map(l => <Link key={l.para} className="mensagem-codigo" to={l.para} onClick={abrir}
          onAuxClick={e => { if (e.button === BOTAO_DO_MEIO) abrir(); }}>{l.texto}</Link>)}
      </div>
    </div>
  </LinhaDaMensagem>;
}

/** Como cada tipo de mensagem aparece. Tipo novo = uma entrada nova. */
const ITEM_DO_TIPO: Record<TipoMensagem, ComponentType<PropsDoItem>> = {
  mencao: ItemDaMencao, prazo: ItemDoPrazo, pedido: ItemDoPedido, resposta: ItemDaResposta, inclusao: ItemDaInclusao, grupo: ItemDoGrupo
};
