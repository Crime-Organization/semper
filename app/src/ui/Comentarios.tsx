// Comentários do cartão, com @ (veja regras/comentarios.ts): a caixa para escrever, com a lista do @, e os comentários do
// mais novo para o mais antigo. Quem escreveu edita e apaga; administradores também apagam. No painel ao lado, ficam numa
// seção recolhível do cartão; na janela no centro, na coluna da direita (o PainelCartao diz onde ela está).
import { useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { SD, type Comentario, type Membro, type ModuloComentado } from '../dados';
import { ACHADOS_DA_MENCAO, TAMANHO_COMENTARIO } from '../dados/limites';
import { inserirMencao, mencaoSendoDigitada, membrosParaMencionar, MOTIVO_SEM_MENCAO, trechosDoComentario } from '../regras/comentarios';
import { Avatar } from './Avatar';
import { falha } from './avisos';
import { Botao, BotaoDuplo } from './Botoes';
import { Carregando, estiloBotao, Nota } from './base';
import { Icone } from './Icone';
import { ColunaDoCartao } from './PainelCartao';
import { Recolhivel } from './Recolhivel';
import { useCtx } from './sessao';
import { dataHora, relativo } from './util';

export function SecaoComentarios({ modulo, cartaoId, motivoSemMencao }: {
  modulo: ModuloComentado; cartaoId: string;
  /** Regra a mais de quem pode ser mencionado, que depende do cartão (ex.: só quem vê a demanda). */
  motivoSemMencao?: (m: Membro) => string | null;
}) {
  const coluna = useContext(ColunaDoCartao);
  const titulo = useId();
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [rascunho, setRascunho] = useState('');
  const enviando = useRef(false);

  const carregar = useCallback(async () => {
    try { setLista(await SD.comentariosListar(modulo, cartaoId)); }
    catch (e) { falha(e); setLista([]); }
  }, [modulo, cartaoId]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function comentar() {
    if (!rascunho.trim() || enviando.current) return;
    enviando.current = true;
    try {
      const novo = await SD.comentarioCriar(modulo, cartaoId, rascunho);
      setLista(atual => [novo, ...(atual ?? [])]);
      setRascunho('');
    } catch (e) { falha(e); }
    enviando.current = false;
  }
  async function editar(id: string, texto: string) {
    try {
      const editado = await SD.comentarioEditar(id, texto);
      setLista(atual => atual?.map(c => c.id === id ? editado : c) ?? null);
      return true;
    } catch (e) { falha(e); return false; }
  }
  async function excluir(id: string) {
    try { await SD.comentarioExcluir(id); setLista(atual => atual?.filter(c => c.id !== id) ?? null); }
    catch (e) { falha(e); }
  }

  const conteudo = <div className="comentarios">
    <CaixaComentario modulo={modulo} motivoSemMencao={motivoSemMencao} rotulo="Escrever um comentário" botao="Comentar" valor={rascunho} aoMudar={setRascunho} aoEnviar={comentar} />
    {lista === null ? <Carregando />
      : !lista.length ? <Nota>Nenhum comentário ainda. Escreva acima e use @ para chamar alguém da equipe.</Nota>
      : <ol className="lista-comentarios" aria-label="Comentários do cartão">
        {lista.map(c => <ItemComentario key={c.id} c={c} modulo={modulo} motivoSemMencao={motivoSemMencao} aoEditar={editar} aoExcluir={excluir} />)}
      </ol>}
  </div>;
  // Na janela no centro, a coluna da direita; no painel ao lado, uma seção recolhível como as outras do cartão.
  return coluna
    ? createPortal(<section className="bloco comentarios-coluna" aria-labelledby={titulo}><h3 id={titulo}><Icone nome="comentario" tam={14} />Comentários</h3>{conteudo}</section>, coluna)
    : <Recolhivel titulo="Comentários" icone="comentario" preferencia="cartao.comentarios" padrao contador={lista?.length}>{conteudo}</Recolhivel>;
}

function ItemComentario({ c, modulo, motivoSemMencao, aoEditar, aoExcluir }: {
  c: Comentario; modulo: ModuloComentado; motivoSemMencao?: (m: Membro) => string | null; aoEditar: (id: string, texto: string) => Promise<boolean>; aoExcluir: (id: string) => Promise<void>;
}) {
  const ctx = useCtx();
  const [editando, setEditando] = useState<string | null>(null);
  const autor = ctx.equipe.find(m => m.id === c.autor_id), nome = autor?.nome ?? 'Usuário removido';
  const meu = c.autor_id === ctx.perfil.id, podeApagar = meu || ctx.ehAdmin;
  async function salvar() {
    if (editando !== null && await aoEditar(c.id, editando)) setEditando(null);
  }
  return <li className="comentario" aria-label={`Comentário de ${nome}`}>
    <Avatar p={autor} tam={28} />
    <div className="comentario-miolo">
      <div className="comentario-cabeca">
        <b>{nome}</b>
        <span className="nota" title={dataHora(c.criado_em)}>{relativo(c.criado_em)}{c.editado_em && ' (editado)'}</span>
      </div>
      {editando !== null
        ? <CaixaComentario modulo={modulo} motivoSemMencao={motivoSemMencao} rotulo="Editar o comentário" botao="Salvar" valor={editando} aoMudar={setEditando} aoEnviar={salvar}
          aoCancelar={() => setEditando(null)} focar />
        : <p className="comentario-texto">{trechosDoComentario(c.texto, ctx.equipe).map((t, i) => t.membro
          ? <span key={i} className="mencao" title={t.membro.nome}>{t.texto}</span>
          : <span key={i}>{t.texto}</span>)}</p>}
      {editando === null && podeApagar && <div className="comentario-acoes">
        {meu && <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => setEditando(c.texto)}>Editar</button>}
        <BotaoDuplo forma="link" variante="perigo" confirmar="Confirmar exclusão" aoConfirmar={() => aoExcluir(c.id)}>Excluir</BotaoDuplo>
      </div>}
    </div>
  </li>;
}

/** A caixa de texto do comentário, com a lista do @: setas escolhem, Enter ou Tab marcam, Esc fecha; Ctrl+Enter envia. */
function CaixaComentario({ modulo, motivoSemMencao, rotulo, botao, valor, aoMudar, aoEnviar, aoCancelar, focar }: {
  modulo: ModuloComentado; motivoSemMencao?: (m: Membro) => string | null; rotulo: string; botao: string; valor: string; aoMudar: (v: string) => void;
  aoEnviar: () => Promise<void>; aoCancelar?: () => void; focar?: boolean;
}) {
  const ctx = useCtx();
  const campo = useRef<HTMLTextAreaElement>(null);
  const listaId = useId();
  const [mencao, setMencao] = useState<{ inicio: number; termo: string } | null>(null);
  const [destaque, setDestaque] = useState(0);
  const opcoes = mencao ? membrosParaMencionar(ctx.equipe, mencao.termo, ACHADOS_DA_MENCAO) : [];
  const motivo = (m: Membro) => MOTIVO_SEM_MENCAO[modulo](m) ?? motivoSemMencao?.(m) ?? null;
  useEffect(() => { if (focar) campo.current?.focus(); }, [focar]);

  function mudar(texto: string, cursor: number) {
    aoMudar(texto);
    setMencao(mencaoSendoDigitada(texto, cursor));
    setDestaque(0);
  }
  function escolher(m: Membro) {
    if (!mencao || !m.usuario || motivo(m)) return;
    const r = inserirMencao(valor, mencao.inicio, campo.current?.selectionStart ?? valor.length, m.usuario);
    aoMudar(r.texto);
    setMencao(null);
    // Espera o React escrever o texto novo para pôr o cursor depois da menção.
    setTimeout(() => { campo.current?.focus(); campo.current?.setSelectionRange(r.cursor, r.cursor); }, 0);
  }
  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mencao && opcoes.length) {
      const passo = { ArrowDown: 1, ArrowUp: -1 }[e.key as 'ArrowDown' | 'ArrowUp'];
      if (passo) { e.preventDefault(); setDestaque(i => (i + passo + opcoes.length) % opcoes.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); escolher(opcoes[destaque]); return; }
    }
    if (e.key === 'Escape' && (mencao || aoCancelar)) {
      // Fecha a lista do @ (ou cancela a edição) sem fechar o cartão.
      e.preventDefault(); e.stopPropagation();
      if (mencao) setMencao(null); else aoCancelar?.();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void aoEnviar(); }
  }

  const aberta = !!mencao && opcoes.length > 0;
  return <div className="caixa-comentario"><div className="caixa-comentario-campo">
    <textarea ref={campo} className="campo" aria-label={rotulo} placeholder={rotulo + '…'} maxLength={TAMANHO_COMENTARIO} value={valor}
      aria-autocomplete="list" aria-expanded={aberta} aria-controls={aberta ? listaId : undefined}
      aria-activedescendant={aberta ? `${listaId}-${destaque}` : undefined}
      onChange={e => mudar(e.target.value, e.target.selectionStart)} onKeyDown={teclar}
      onClick={e => setMencao(mencaoSendoDigitada(valor, e.currentTarget.selectionStart))} onBlur={() => setMencao(null)} />
    {aberta && <ul className="lista-sugestoes" role="listbox" id={listaId} aria-label="Mencionar alguém da equipe">
      {opcoes.map((m, i) => {
        const porque = motivo(m);
        return <li key={m.id} id={`${listaId}-${i}`} role="option" aria-selected={i === destaque} aria-disabled={!!porque}
          // Clicar não tira o foco da caixa de texto (senão a lista fecharia antes da escolha).
          onMouseDown={e => { e.preventDefault(); escolher(m); }}>
          <Avatar p={m} tam={22} /><span><b>{m.nome}</b> <small>@{m.usuario}{porque ? ' · ' + porque : ''}</small></span>
        </li>;
      })}
    </ul>}
  </div>
    {valor.trim() && <div className="caixa-comentario-acoes">
      <Botao variante="principal" pequeno onClick={aoEnviar}>{botao}</Botao>
      {aoCancelar && <button type="button" className={estiloBotao({ pequeno: true })} onClick={aoCancelar}>Cancelar</button>}
      <small className="nota">Ctrl+Enter também envia.</small>
    </div>}
    {!valor.trim() && aoCancelar && <div className="caixa-comentario-acoes">
      <button type="button" className={estiloBotao({ pequeno: true })} onClick={aoCancelar}>Cancelar</button>
    </div>}
  </div>;
}
