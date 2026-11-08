// Caixa de mensagens de cada pessoa (#112): onde ela foi citada com @. Clicar abre o cartão no comentário e marca como lida.
// O número no menu vem de ui/mensagens.ts; quem cria as mensagens é o banco, ao salvar o comentário.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SD, type Mensagem } from '../dados';
import { CARTAO_DO_MODULO, enderecoDoComentario, trechoDaMensagem } from '../regras/mensagens';
import { Avatar } from '../ui/Avatar';
import { falha } from '../ui/avisos';
import { Botao } from '../ui/Botoes';
import { Aviso, Carregando, Vazio } from '../ui/base';
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
        <p className="lead">As vezes em que marcaram você com @ nos comentários dos cartões.</p>
      </div>
      {/* O número do menu conta todas; a lista mostra só as mais novas. */}
      {quantasNaoLidas > 0 && <Botao pequeno onClick={marcarTodas}>Marcar todas como lidas</Botao>}
    </header>
    {lista === null ? <Carregando />
      : typeof lista === 'string' ? <Aviso tipo="erro">{lista}</Aviso>
      : !lista.length ? <Vazio>Nenhuma mensagem. Quando alguém marcar você com @ num comentário, ela aparece aqui.</Vazio>
      : <ul className="lista-mensagens" aria-label="Mensagens">
        {lista.map(m => <ItemMensagem key={m.id} m={m} aoMarcarLida={marcarLida} />)}
      </ul>}
  </div>;
}

function ItemMensagem({ m, aoMarcarLida }: { m: Mensagem; aoMarcarLida: (id: string) => Promise<void> }) {
  const ctx = useCtx();
  const c = m.comentario, lida = !!m.lido_em;
  const autor = ctx.equipe.find(x => x.id === c?.autor_id), nome = autor?.nome ?? 'Usuário removido';
  const classe = 'mensagem' + (lida ? '' : ' nao-lida'), situacao = lida ? 'lida' : 'não lida';
  const lado = (rotulo: string) => <div className="mensagem-lado">
    <time className="mensagem-quando" dateTime={m.criado_em} title={dataHora(m.criado_em)}>{relativo(m.criado_em)}</time>
    {!lida && <Botao forma="link" aria-label={rotulo} onClick={() => aoMarcarLida(m.id)}>Marcar como lida</Botao>}
  </div>;
  if (!c) {
    return <li className={classe} aria-label={`Mensagem ${situacao} de um cartão que você não vê mais`}>
      <div className="mensagem-miolo"><p className="mensagem-trecho">Esta menção é de um cartão que você não vê mais.</p></div>
      {lado('Marcar como lida a mensagem de um cartão que você não vê mais')}
    </li>;
  }
  const abrir = () => { if (!lida) void aoMarcarLida(m.id); };
  return <li className={classe} aria-label={`Mensagem ${situacao} de ${nome}`}>
    <Avatar p={autor} tam={32} />
    <div className="mensagem-miolo">
      <Link className="mensagem-link" to={enderecoDoComentario(c.modulo, c.cartao_id, c.id)} onClick={abrir} onAuxClick={e => { if (e.button === BOTAO_DO_MEIO) abrir(); }}>
        <span className="mensagem-titulo"><b>{nome}</b> citou você em {CARTAO_DO_MODULO[c.modulo].nome.toLowerCase()} <b>{c.cartao_nome || c.cartao_codigo}</b></span>
        <span className="mensagem-trecho">{trechoDaMensagem(c.texto)}</span>
      </Link>
    </div>
    {lado(`Marcar como lida a mensagem de ${nome}`)}
  </li>;
}
