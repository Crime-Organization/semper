// Comentários do cartão, com @ e com ! (veja regras/comentarios.ts): a caixa para escrever, com a lista do @ (pessoas da equipe) e a
// do ! (itens pelo código, #297) e as menções em destaque enquanto se digita, e os comentários do mais novo para o mais antigo, com
// as menções de itens como atalhos para os cartões deles. Quem escreveu edita e apaga; administradores também apagam. É a primeira seção da coluna da direita
// do cartão (NaColunaDoCartao, #360: depois vêm "Anotações" e "Histórico de alterações"), recolhível e aberta de início; ao lado,
// as seções da coluna ficam embaixo do cartão, na mesma ordem.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { SD, type Comentario, type ItemDaAnotacao, type Membro, type ModuloComentado } from '../dados';
import { ACHADOS_DA_MENCAO, BUSCA_GERAL_MINIMO, TAMANHO_COMENTARIO } from '../dados/limites';
import { ITEM_DA_ANOTACAO } from '../regras/anotacao';
import {
  codigosNoTexto, inserirMencao, itemSendoDigitado, itensPeloCodigo, mencaoSendoDigitada, membrosParaMencionar, modulosParaMencionar, MOTIVO_SEM_MENCAO,
  tipoDoTrecho, trechosDoComentario
} from '../regras/comentarios';
import { PARAMETRO_DO_COMENTARIO } from '../regras/mensagens';
import { Avatar } from './Avatar';
import { falha } from './avisos';
import { Botao, BotaoDuplo } from './Botoes';
import { Carregando, estiloBotao, Nota } from './base';
import { ComoComentario, nomeDoAutor } from './ComoComentario';
import { NaColunaDoCartao, useDentroDaColuna } from './PainelCartao';
import { buscarItensParaMencionar, type BuscarItensParaMencionar } from './mencoesDeItens';
import { Recolhivel } from './Recolhivel';
import { useCtx } from './sessao';
import { TextoComMencoes } from './TextoComMencoes';
import { ESPERA_AO_DIGITAR } from './tempos';

/** O tamanho da bolinha de cada pessoa na lista do @. */
const BOLINHA_DA_MENCAO = 22;

export function SecaoComentarios({ modulo, cartaoId, motivoSemMencao, aviso, buscarItens = buscarItensParaMencionar }: {
  modulo: ModuloComentado; cartaoId: string;
  /** Onde a lista do ! procura os itens (os testes trocam). */
  buscarItens?: BuscarItensParaMencionar;
  /** O que a menção faz neste cartão (ex.: em contratos, dá acesso a ele). */
  aviso?: string;
  /** Regra a mais de quem pode ser mencionado, que depende do cartão (ex.: só quem vê a demanda). */
  motivoSemMencao?: (m: Membro) => string | null;
}) {
  const dentroDaColuna = useDentroDaColuna();
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [rascunho, setRascunho] = useState('');
  const enviando = useRef(false);
  // O comentário que a mensagem abriu (?comentario=...): a seção já vem aberta, e ele aparece destacado e à vista.
  const [citado] = useState(() => new URLSearchParams(window.location.search).get(PARAMETRO_DO_COMENTARIO));
  const carregouCitado = lista !== null && !!citado;
  useEffect(() => {
    if (carregouCitado) document.getElementById(idDoComentario(citado))?.scrollIntoView({ block: 'center' });
  }, [carregouCitado, citado]);

  const carregar = useCallback(async () => {
    try { setLista(await SD.comentariosListar(modulo, cartaoId)); }
    catch (e) { falha(e); setLista([]); }
  }, [modulo, cartaoId]);
  useEffect(() => { void carregar(); }, [carregar]);

  // Os itens chamados com ! nos comentários (regras/comentarios.ts): só os que quem lê vê voltam. Os códigos são consultados de novo a
  // cada mudança da lista (abrir, comentar, editar, excluir), então um item arquivado, excluído ou que deixou de ser visível com o
  // cartão aberto aparece como está agora. Se a consulta falhar, fica o que já se sabia (ou só o destaque) até a próxima mudança.
  const [consultados, setConsultados] = useState<ReadonlyMap<string, ItemDaAnotacao | null>>(new Map());
  useEffect(() => {
    const codigos = codigosNoTexto(...(lista ?? []).map(c => c.texto));
    if (!codigos.length) return;
    let valendo = true;
    SD.itensMencionados(codigos).then(itens => { if (valendo) setConsultados(itensPeloCodigo(codigos, itens)); }, () => undefined);
    return () => { valendo = false; };
  }, [lista]);

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
    <CaixaComentario modulo={modulo} motivoSemMencao={motivoSemMencao} buscarItens={buscarItens} rotulo="Escrever um comentário" botao="Comentar" valor={rascunho} aoMudar={setRascunho} aoEnviar={comentar} />
    {aviso && <Nota>{aviso}</Nota>}
    {lista === null ? <Carregando />
      : !lista.length ? <Nota>Nenhum comentário ainda. Escreva acima e use @ para chamar alguém da equipe, ou ! e o código para citar um item.</Nota>
      : <ol className="lista-comentarios" aria-label="Comentários do cartão">
        {lista.map(c => <ItemComentario key={c.id} c={c} citado={c.id === citado} modulo={modulo} motivoSemMencao={motivoSemMencao} buscarItens={buscarItens} itens={consultados} aoEditar={editar} aoExcluir={excluir} />)}
      </ol>}
  </div>;
  // Sempre no grupo da coluna (o cartão a põe em NaColunaDoCartao com as outras seções dela; sozinha, ela vai para lá por conta
  // própria): a seção abre aberta, nos dois formatos da janela, e não guarda a escolha, com o "Expandir tudo" / "Recolher tudo" do
  // grupo da coluna acima dela. O que se escrevia fica aqui (rascunho), e não na seção: trocar o formato da janela não o perde.
  const secao = <Recolhivel titulo="Comentários" icone="comentario" contador={lista?.length} abertaAoIniciar>{conteudo}</Recolhivel>;
  return dentroDaColuna ? secao : <NaColunaDoCartao>{secao}</NaColunaDoCartao>;
}

const idDoComentario = (id: string) => 'comentario-' + id;

function ItemComentario({ c, citado, modulo, motivoSemMencao, buscarItens, itens, aoEditar, aoExcluir }: {
  c: Comentario; citado: boolean; modulo: ModuloComentado; motivoSemMencao?: (m: Membro) => string | null; buscarItens: BuscarItensParaMencionar;
  itens: ReadonlyMap<string, ItemDaAnotacao | null>; aoEditar: (id: string, texto: string) => Promise<boolean>; aoExcluir: (id: string) => Promise<void>;
}) {
  const ctx = useCtx();
  const [editando, setEditando] = useState<string | null>(null);
  const nome = nomeDoAutor(ctx.equipe, c.autor_id);
  const meu = c.autor_id === ctx.perfil.id, podeApagar = meu || ctx.ehAdmin;
  async function salvar() {
    if (editando !== null && await aoEditar(c.id, editando)) setEditando(null);
  }
  return <li id={idDoComentario(c.id)} className={'comentario' + (citado ? ' comentario-citado' : '')} aria-current={citado || undefined} aria-label={`Comentário de ${nome}`}>
    <ComoComentario autorId={c.autor_id} quando={c.criado_em} depoisDoQuando={c.editado_em ? ' (editado)' : undefined}>
      {editando !== null
        ? <CaixaComentario modulo={modulo} motivoSemMencao={motivoSemMencao} buscarItens={buscarItens} rotulo="Editar o comentário" botao="Salvar" valor={editando} aoMudar={setEditando} aoEnviar={salvar}
          aoCancelar={() => setEditando(null)} focar />
        : <p className="comentario-texto"><TextoComMencoes texto={c.texto} itens={itens} /></p>}
      {editando === null && podeApagar && <div className="comentario-acoes">
        {meu && <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => setEditando(c.texto)}>Editar</button>}
        <BotaoDuplo forma="link" variante="perigo" confirmar="Confirmar exclusão" aoConfirmar={() => aoExcluir(c.id)}>Excluir</BotaoDuplo>
      </div>}
    </ComoComentario>
  </li>;
}

/** O que se digita depois do @ ou do !, com onde o sinal começa. */
type Digitando = { inicio: number; termo: string };
/** As duas listas da caixa: a do @ (pessoas da equipe) e a do ! (itens pelo código). */
type QualLista = 'pessoas' | 'itens';
interface ListaAberta { quantas: number; escolher: (i: number) => void; rotulo: string; opcoes: ReactNode[] }

/**
 * A caixa de texto do comentário, com a lista do @ e a do !: setas escolhem, Enter ou Tab marcam, Esc fecha; Ctrl+Enter envia.
 * Por trás do texto, um espelho dele (só para os olhos) pinta o fundo das menções enquanto se digita.
 */
function CaixaComentario({ modulo, motivoSemMencao, buscarItens, rotulo, botao, valor, aoMudar, aoEnviar, aoCancelar, focar }: {
  modulo: ModuloComentado; motivoSemMencao?: (m: Membro) => string | null; buscarItens: BuscarItensParaMencionar; rotulo: string; botao: string; valor: string;
  aoMudar: (v: string) => void; aoEnviar: () => Promise<void>; aoCancelar?: () => void; focar?: boolean;
}) {
  const ctx = useCtx();
  const campo = useRef<HTMLTextAreaElement>(null);
  const espelho = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const [mencao, setMencao] = useState<Digitando | null>(null);
  const [item, setItem] = useState<Digitando | null>(null);
  const [destaque, setDestaque] = useState(0);
  const motivo = (m: Membro) => MOTIVO_SEM_MENCAO[modulo](m) ?? motivoSemMencao?.(m) ?? null;
  useEffect(() => { if (focar) campo.current?.focus(); }, [focar]);
  // Põe o cursor depois da menção assim que o React escreve o texto novo, antes de a próxima tecla ser atendida.
  // Com setTimeout, o navegador podia atender as teclas primeiro, e o cursor voltava para trás no meio da digitação.
  const cursorDaMencao = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursorDaMencao.current === null) return;
    campo.current?.focus();
    campo.current?.setSelectionRange(cursorDaMencao.current, cursorDaMencao.current);
    cursorDaMencao.current = null;
  });

  // A lista do !: busca depois de uma pausa na digitação, com pelo menos BUSCA_GERAL_MINIMO letras; a resposta vale só para o termo dela.
  const modulosDoEscritorio = ctx.escritorio?.modulos;
  const modulos = useMemo(() => modulosParaMencionar(modulosDoEscritorio), [modulosDoEscritorio]);
  const termoDoItem = item && item.termo.length >= BUSCA_GERAL_MINIMO ? item.termo : '';
  const [achados, setAchados] = useState<{ termo: string; itens: ItemDaAnotacao[] } | null>(null);
  useEffect(() => {
    if (!termoDoItem) return;
    let valendo = true;
    const relogio = setTimeout(() => {
      buscarItens(termoDoItem, modulos).then(itens => { if (valendo) setAchados({ termo: termoDoItem, itens }); }, () => undefined);
    }, ESPERA_AO_DIGITAR);
    return () => { valendo = false; clearTimeout(relogio); };
  }, [termoDoItem, modulos, buscarItens]);

  const pessoas = mencao ? membrosParaMencionar(ctx.equipe, mencao.termo, ACHADOS_DA_MENCAO) : [];
  const itens = termoDoItem && achados?.termo === termoDoItem ? achados.itens : [];

  function lerCursor(texto: string, cursor: number) {
    setMencao(mencaoSendoDigitada(texto, cursor));
    setItem(itemSendoDigitado(texto, cursor));
  }
  function mudar(texto: string, cursor: number) {
    aoMudar(texto);
    lerCursor(texto, cursor);
    setDestaque(0);
  }
  function fechar() { setMencao(null); setItem(null); }
  function inserir(onde: Digitando, nome: string, sinal: '@' | '!') {
    const r = inserirMencao(valor, onde.inicio, campo.current?.selectionStart ?? valor.length, nome, sinal);
    cursorDaMencao.current = r.cursor;
    aoMudar(r.texto);
    fechar();
  }
  function escolherPessoa(m: Membro) {
    if (mencao && m.usuario && !motivo(m)) inserir(mencao, m.usuario, '@');
  }
  function escolherItem(x: ItemDaAnotacao) {
    if (item) inserir(item, x.codigo, '!');
  }

  // Clicar numa opção não tira o foco da caixa de texto (senão a lista fecharia antes da escolha).
  const opcao = (i: number, chave: string, escolher: () => void, conteudo: ReactNode, desligada = false) =>
    <li key={chave} id={`${listaId}-${i}`} role="option" aria-selected={i === destaque} aria-disabled={desligada}
      onMouseDown={e => { e.preventDefault(); escolher(); }}>{conteudo}</li>;
  const LISTAS: Record<QualLista, ListaAberta> = {
    pessoas: {
      quantas: pessoas.length, escolher: i => escolherPessoa(pessoas[i]), rotulo: 'Mencionar alguém da equipe',
      opcoes: pessoas.map((m, i) => {
        const porque = motivo(m);
        return opcao(i, m.id, () => escolherPessoa(m),
          <><Avatar p={m} tam={BOLINHA_DA_MENCAO} /><span><b>{m.nome}</b> <small>@{m.usuario}{porque ? ' · ' + porque : ''}</small></span></>, !!porque);
      })
    },
    itens: {
      quantas: itens.length, escolher: i => escolherItem(itens[i]), rotulo: 'Mencionar um item pelo código',
      opcoes: itens.map((x, i) => opcao(i, `${x.modulo}-${x.id}`, () => escolherItem(x),
        <span><b>{x.nome}</b> <small>{ITEM_DA_ANOTACAO[x.modulo].rotulo} · !{x.codigo}</small></span>))
    }
  };
  const qual: QualLista | null = pessoas.length ? 'pessoas' : itens.length ? 'itens' : null;
  const lista = qual ? LISTAS[qual] : null;

  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (lista) {
      const passo = { ArrowDown: 1, ArrowUp: -1 }[e.key as 'ArrowDown' | 'ArrowUp'];
      if (passo) { e.preventDefault(); setDestaque(i => (i + passo + lista.quantas) % lista.quantas); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); lista.escolher(Math.min(destaque, lista.quantas - 1)); return; }
    }
    // Com a lista aberta, o Esc só a fecha; sem lista, cancela a edição. Os dois sem fechar o cartão. Sem lista e sem edição, o Esc
    // segue para o cartão (um !palavra que não achou nada não prende a tecla).
    if (e.key === 'Escape' && (lista || aoCancelar)) {
      e.preventDefault(); e.stopPropagation();
      if (lista) fechar(); else aoCancelar?.();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void aoEnviar(); }
  }

  return <div className="caixa-comentario"><div className="caixa-comentario-campo">
    <div ref={espelho} className="campo caixa-comentario-espelho" aria-hidden="true">
      {trechosDoComentario(valor, ctx.equipe).map((t, i) => tipoDoTrecho(t) === 'texto' ? t.texto : <mark key={i} className="mencao-no-campo">{t.texto}</mark>)}
      {/* O espelho termina como o campo: uma quebra no fim do texto também abre uma linha nele. */}
      {'\n'}
    </div>
    <textarea ref={campo} className="campo caixa-comentario-texto" aria-label={rotulo} placeholder={rotulo + '…'} maxLength={TAMANHO_COMENTARIO} value={valor}
      aria-autocomplete="list" aria-expanded={!!lista} aria-controls={lista ? listaId : undefined}
      aria-activedescendant={lista ? `${listaId}-${Math.min(destaque, lista.quantas - 1)}` : undefined}
      onChange={e => mudar(e.target.value, e.target.selectionStart)} onKeyDown={teclar}
      onScroll={e => { if (espelho.current) espelho.current.scrollTop = e.currentTarget.scrollTop; }}
      onClick={e => lerCursor(valor, e.currentTarget.selectionStart)} onBlur={fechar} />
    {lista && <ul className="lista-sugestoes" role="listbox" id={listaId} aria-label={lista.rotulo}>{lista.opcoes}</ul>}
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
