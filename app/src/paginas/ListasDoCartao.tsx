// As listas da demanda ou da tarefa, como as do Trello: cada lista com nome, a barra do quanto já foi feito e os itens para marcar,
// cada um com data de entrega opcional. Listas e itens se renomeiam, mudam de posição e se excluem pelo menu "⋯".
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SD, type CartaoComListas, type ItemDaLista, type ListaDoCartao, type ModeloDeLista } from '../dados';
import { TAMANHO_ITEM, TAMANHO_LISTA } from '../dados/limites';
import { ROTULOS_PRAZO, SELO_DO_PRAZO } from '../regras/demanda';
import { moverNaLista, prazoDoItem, progressoDaLista } from '../regras/listas';
import { fmtData, lerData } from '../regras/pessoa';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota, Selo } from '../ui/base';
import { Icone } from '../ui/Icone';
import { confirmar, pedirTexto } from '../ui/janela';
import { MenuFlutuante } from '../ui/Menu';
import { Recolhivel } from '../ui/Recolhivel';
import { hojeISO } from '../ui/util';

/** O que muda de um cartão para o outro: o convite da lista vazia. */
const DO_CARTAO: Record<CartaoComListas, { vazio: string }> = {
  demandas: { vazio: 'Nenhuma lista ainda. Use listas para os documentos e os passos da demanda.' },
  tarefas: { vazio: 'Nenhuma lista ainda. Use listas para os documentos e os passos da tarefa.' },
};
/** Menu "⋯" aberto: de qual lista ou item, e o botão em que ele se prende. */
type MenuAberto = { botao: HTMLElement; lista: ListaDoCartao; item?: ItemDaLista };
/** Menu de "Adicionar lista": em branco ou a partir de um modelo (carregados ao abrir). */
type MenuNova = { botao: HTMLElement; modelos: ModeloDeLista[] | null };

export function ListasDoCartao({ modulo, id, somenteLer = false }: { modulo: CartaoComListas; id: string; somenteLer?: boolean }) {
  const [listas, setListas] = useState<ListaDoCartao[] | string | null>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const [menuNova, setMenuNova] = useState<MenuNova | null>(null);
  const navegar = useNavigate();
  const carregar = useCallback(() => SD.listasDoCartao(modulo, id).then(setListas).catch(e => setListas((e as Error).message)), [modulo, id]);
  useEffect(() => { void carregar(); }, [carregar]);
  /** Faz a mudança e recarrega as listas (o erro aparece no pé da tela). */
  const mexer = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { falha(e); } await carregar(); };

  // Marcar muda a caixa na hora; o banco grava em seguida (e a lista volta como ele guardou).
  function marcar(item: ItemDaLista, feito: boolean) {
    setListas(atual => Array.isArray(atual)
      ? atual.map(l => ({ ...l, itens: l.itens.map(i => i.id === item.id ? { ...i, feito_em: feito ? new Date().toISOString() : null } : i) }))
      : atual);
    void mexer(() => SD.itemAtualizar(item.id, { feito }));
  }
  function abrirMenuNova(botao: HTMLElement) {
    setMenuNova({ botao, modelos: null });
    SD.modelosListar().then(modelos => setMenuNova(m => m && { ...m, modelos })).catch(e => { falha(e); setMenuNova(m => m && { ...m, modelos: [] }); });
  }
  // Um clique no modelo: a lista entra no cartão com o nome e os itens dele, sem nenhum marcado.
  const usarModelo = (m: ModeloDeLista) => mexer(async () => { await SD.listaCriar(modulo, id, m.nome, m.itens); avisar(`Lista "${m.nome}" acrescentada.`); });
  async function salvarComoModelo(l: ListaDoCartao) {
    const nome = await pedirTexto('Nome do modelo', l.nome, { maximo: TAMANHO_LISTA });
    if (!nome) return;
    try { await SD.modeloCriar(nome, l.itens.map(i => i.texto)); avisar(`Modelo "${nome}" salvo. Ele aparece em "Adicionar lista" em qualquer demanda ou tarefa.`); }
    catch (e) { falha(e); }
  }
  async function novaLista() {
    const nome = await pedirTexto('Nome da lista', '', { maximo: TAMANHO_LISTA });
    if (nome) await mexer(() => SD.listaCriar(modulo, id, nome));
  }
  async function renomearLista(l: ListaDoCartao) {
    const nome = await pedirTexto('Nome da lista', l.nome, { maximo: TAMANHO_LISTA });
    if (nome && nome !== l.nome) await mexer(() => SD.listaAtualizar(l.id, { nome }));
  }
  async function excluirLista(l: ListaDoCartao) {
    if (await confirmar('Excluir a lista?', `A lista "${l.nome}" e os ${l.itens.length} itens dela serão excluídos.`, 'Excluir lista', true)) {
      await mexer(() => SD.listaExcluir(l.id));
    }
  }
  const moverLista = (i: number, passo: 1 | -1) => mexer(() =>
    Promise.all(moverNaLista(listas as ListaDoCartao[], i, passo).map(m => SD.listaAtualizar(m.id, { ordem: m.ordem }))));
  async function editarItem(item: ItemDaLista) {
    const texto = await pedirTexto('Item', item.texto, { maximo: TAMANHO_ITEM, multilinha: true });
    if (texto && texto !== item.texto) await mexer(() => SD.itemAtualizar(item.id, { texto }));
  }
  async function prazoDoItemPedir(item: ItemDaLista) {
    const texto = await pedirTexto('Data de entrega (DD/MM/AAAA). Deixe vazio para tirar.', fmtData(item.prazo), { maximo: 10 });
    if (texto === null) return;
    let prazo: string | null;
    try { prazo = lerData(texto); } catch (e) { falha(e); return; }
    await mexer(() => SD.itemAtualizar(item.id, { prazo }));
  }
  const moverItem = (l: ListaDoCartao, i: number, passo: 1 | -1) => mexer(() =>
    Promise.all(moverNaLista(l.itens, i, passo).map(m => SD.itemAtualizar(m.id, { ordem: m.ordem }))));

  const total = Array.isArray(listas) ? listas.length : undefined;
  return <Recolhivel titulo="Listas" icone="check" preferencia={`${modulo}.cartao.listas`} contador={total}>
    {listas === null ? <Carregando />
      : typeof listas === 'string' ? <Aviso tipo="erro">{listas}</Aviso>
      : <>
        {!listas.length && <Nota>{DO_CARTAO[modulo].vazio}</Nota>}
        {listas.map(l => <Lista key={l.id} lista={l} somenteLer={somenteLer} aoMarcar={marcar}
          aoAcrescentar={texto => mexer(() => SD.itemCriar(l.id, texto))} aoAbrirMenu={(botao, item) => setMenu({ botao, lista: l, item })} />)}
        {!somenteLer && <div><button type="button" className={estiloBotao({ forma: 'mini' })} aria-haspopup="menu" onClick={e => abrirMenuNova(e.currentTarget)}><Icone nome="mais" tam={13} /> Adicionar lista</button></div>}
      </>}
    {menuNova && <MenuFlutuante botao={menuNova.botao} aoFechar={() => setMenuNova(null)} rotulo="Adicionar lista">
      <button type="button" role="menuitem" onClick={() => { setMenuNova(null); void novaLista(); }}><Icone nome="mais" tam={15} /> Lista em branco</button>
      {menuNova.modelos === null ? <p className="kmenu-nota">Carregando os modelos…</p>
        : menuNova.modelos.length ? <>
          <p className="rotulo-caps kmenu-titulo">Usar um modelo</p>
          {menuNova.modelos.map(m => <button key={m.id} type="button" role="menuitem" onClick={() => { setMenuNova(null); void usarModelo(m); }}>
            <Icone nome="check" tam={15} /> {m.nome}
          </button>)}
        </> : <p className="kmenu-nota">Nenhum modelo ainda. Salve uma lista como modelo pelo menu dela.</p>}
      <button type="button" role="menuitem" onClick={() => { setMenuNova(null); navegar('/modelos-de-lista/'); }}><Icone nome="configuracoes" tam={15} /> Gerenciar modelos</button>
    </MenuFlutuante>}
    {menu && Array.isArray(listas) && (() => {
      const i = listas.findIndex(x => x.id === menu.lista.id), lista = listas[i];
      const fechar = () => setMenu(null);
      const agir = (fn: () => unknown) => () => { fechar(); void fn(); };
      if (!lista) return null;
      if (!menu.item) return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={`Ações da lista ${lista.nome}`}>
        <button type="button" role="menuitem" onClick={agir(() => renomearLista(lista))}><Icone nome="editar" tam={15} /> Renomear</button>
        <button type="button" role="menuitem" onClick={agir(() => salvarComoModelo(lista))}><Icone nome="copiar" tam={15} /> Salvar como modelo</button>
        {i > 0 && <button type="button" role="menuitem" onClick={agir(() => moverLista(i, -1))}><Icone nome="acima" tam={15} /> Subir</button>}
        {i < listas.length - 1 && <button type="button" role="menuitem" onClick={agir(() => moverLista(i, 1))}><Icone nome="abaixo" tam={15} /> Descer</button>}
        <button type="button" role="menuitem" className="perigo" onClick={agir(() => excluirLista(lista))}><Icone nome="lixeira" tam={15} /> Excluir lista</button>
      </MenuFlutuante>;
      const j = lista.itens.findIndex(x => x.id === menu.item!.id), item = lista.itens[j];
      if (!item) return null;
      return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={`Ações do item ${item.texto}`}>
        <button type="button" role="menuitem" onClick={agir(() => editarItem(item))}><Icone nome="editar" tam={15} /> Editar</button>
        <button type="button" role="menuitem" onClick={agir(() => prazoDoItemPedir(item))}><Icone nome="relogio" tam={15} /> Data de entrega</button>
        {j > 0 && <button type="button" role="menuitem" onClick={agir(() => moverItem(lista, j, -1))}><Icone nome="acima" tam={15} /> Subir</button>}
        {j < lista.itens.length - 1 && <button type="button" role="menuitem" onClick={agir(() => moverItem(lista, j, 1))}><Icone nome="abaixo" tam={15} /> Descer</button>}
        <button type="button" role="menuitem" className="perigo" onClick={agir(() => mexer(async () => { await SD.itemExcluir(item.id); avisar('Item excluído.'); }))}>
          <Icone nome="lixeira" tam={15} /> Excluir item
        </button>
      </MenuFlutuante>;
    })()}
  </Recolhivel>;
}

function Lista({ lista, somenteLer, aoMarcar, aoAcrescentar, aoAbrirMenu }: {
  somenteLer: boolean; lista: ListaDoCartao; aoMarcar: (item: ItemDaLista, feito: boolean) => void; aoAcrescentar: (texto: string) => Promise<void>;
  aoAbrirMenu: (botao: HTMLElement, item?: ItemDaLista) => void;
}) {
  const [novo, setNovo] = useState('');
  const { feitos, total, percentual } = progressoDaLista(lista.itens);
  const hoje = hojeISO();
  async function acrescentar(e: FormEvent) {
    e.preventDefault();
    if (!novo.trim()) return;
    await aoAcrescentar(novo);
    setNovo('');
  }
  return <section className="lista-demanda" aria-label={`Lista ${lista.nome}`}>
    <header>
      <h4>{lista.nome}</h4>
      <span className="nota">{feitos} de {total}</span>
      {!somenteLer && <button type="button" className="icone-btn" aria-label={`Ações da lista ${lista.nome}`} onClick={e => aoAbrirMenu(e.currentTarget)}><Icone nome="pontos" tam={16} /></button>}
    </header>
    <div className="lista-progresso" role="progressbar" aria-label={`Progresso da lista ${lista.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
      <i style={{ width: percentual + '%' }} />
    </div>
    <ul>{lista.itens.map(item => {
      const prazo = prazoDoItem(item, hoje);
      return <li key={item.id} className={item.feito_em ? 'feito' : undefined}>
        <label><input type="checkbox" checked={!!item.feito_em} disabled={somenteLer} onChange={e => aoMarcar(item, e.target.checked)} /><span>{item.texto}</span></label>
        {item.prazo && (prazo ? <Selo tipo={SELO_DO_PRAZO[prazo]}>{ROTULOS_PRAZO[prazo]}: {fmtData(item.prazo)}</Selo> : <span className="nota">{fmtData(item.prazo)}</span>)}
        {!somenteLer && <button type="button" className="icone-btn" aria-label={`Ações do item ${item.texto}`} onClick={e => aoAbrirMenu(e.currentTarget, item)}><Icone nome="pontos" tam={15} /></button>}
      </li>;
    })}</ul>
    {!somenteLer && <form className="lista-novo-item" onSubmit={acrescentar}>
      <input type="text" className="campo" aria-label={`Novo item da lista ${lista.nome}`} placeholder="Adicionar um item…" maxLength={TAMANHO_ITEM}
        value={novo} onChange={e => setNovo(e.target.value)} />
      <button type="submit" className={estiloBotao({ pequeno: true })} disabled={!novo.trim()}>Adicionar</button>
    </form>}
  </section>;
}
