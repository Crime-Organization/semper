// Os checklists da demanda ou da tarefa (#358; no código e no banco, "listas"), como os do Trello: cada checklist com nome, a
// barra do quanto já foi feito e os itens para marcar, cada um com data de entrega opcional. O nome do checklist e o texto de
// cada item se renomeiam ali mesmo, com um clique (<TituloEditavel>); o "⋯" de cada um, que aparece ao passar o mouse ou com o
// foco (e fica sempre à vista na tela de toque), muda de posição e exclui.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { SD, type CartaoComListas, type ItemDaLista, type ListaDoCartao, type ModeloDeLista } from '../dados';
import { TAMANHO_ITEM, TAMANHO_LISTA } from '../dados/limites';
import { ROTULOS_PRAZO, SELO_DO_PRAZO } from '../regras/demanda';
import { conferirNomeDoChecklist, conferirTextoDoItem, moverNaLista, prazoDoItem, progressoDaLista } from '../regras/listas';
import { fmtData, lerData } from '../regras/pessoa';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota, Selo, TituloEditavel } from '../ui/base';
import { Icone } from '../ui/Icone';
import { confirmar, pedirData, pedirTexto } from '../ui/janela';
import { MenuFlutuante } from '../ui/Menu';
import { Recolhivel } from '../ui/Recolhivel';
import { hojeISO } from '../ui/util';

/** O que muda de um cartão para o outro: o convite do cartão sem checklist. */
const DO_CARTAO: Record<CartaoComListas, { vazio: string }> = {
  demandas: { vazio: 'Nenhum checklist ainda. Use checklists para os documentos e os passos da demanda.' },
  tarefas: { vazio: 'Nenhum checklist ainda. Use checklists para os documentos e os passos da tarefa.' },
};
/** A dica do nome do checklist e do texto do item, que se mudam com um clique. */
const DICA_RENOMEAR = 'Clique para renomear';
/** Menu "⋯" aberto: de qual checklist ou item, e o botão em que ele se prende. */
type MenuAberto = { botao: HTMLElement; lista: ListaDoCartao; item?: ItemDaLista };
/** Menu de "Adicionar checklist": em branco ou a partir de um modelo (carregados ao abrir). */
type MenuNova = { botao: HTMLElement; modelos: ModeloDeLista[] | null };

export function ListasDoCartao({ modulo, id, somenteLer = false }: { modulo: CartaoComListas; id: string; somenteLer?: boolean }) {
  const [listas, setListas] = useState<ListaDoCartao[] | string | null>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const [menuNova, setMenuNova] = useState<MenuNova | null>(null);
  const navegar = useNavigate();
  /** O número da leitura mais recente e quantas gravações ainda não voltaram do banco. */
  const leitura = useRef(0), gravando = useRef(0);
  // Só vale a leitura mais recente, e só quando nenhuma gravação está a caminho: duas mudanças seguidas (renomear um item e
  // logo outro) não fazem a resposta da primeira recarga desfazer na tela a segunda, nem chegar fora de ordem e ficar.
  const carregar = useCallback(() => {
    const n = ++leitura.current;
    const mostrar = (v: ListaDoCartao[] | string) => { if (n === leitura.current && !gravando.current) setListas(v); };
    return SD.listasDoCartao(modulo, id).then(mostrar).catch(e => mostrar((e as Error).message));
  }, [modulo, id]);
  useEffect(() => { void carregar(); }, [carregar]);
  /** Faz a mudança e recarrega os checklists (o erro aparece no pé da tela). */
  const mexer = async (fn: () => Promise<unknown>) => {
    gravando.current++;
    try { await fn(); } catch (e) { falha(e); } finally { gravando.current--; }
    await carregar();
  };
  /** Muda na tela na hora o que o banco grava em seguida (e os checklists voltam como ele guardou). */
  const mudarNaTela = (fn: (l: ListaDoCartao) => ListaDoCartao) => setListas(atual => Array.isArray(atual) ? atual.map(fn) : atual);

  function marcar(item: ItemDaLista, feito: boolean) {
    mudarNaTela(l => ({ ...l, itens: l.itens.map(i => i.id === item.id ? { ...i, feito_em: feito ? new Date().toISOString() : null } : i) }));
    void mexer(() => SD.itemAtualizar(item.id, { feito }));
  }
  function renomearLista(lista: ListaDoCartao, nome: string) {
    mudarNaTela(l => l.id === lista.id ? { ...l, nome } : l);
    return mexer(() => SD.listaAtualizar(lista.id, { nome }));
  }
  function renomearItem(item: ItemDaLista, texto: string) {
    mudarNaTela(l => ({ ...l, itens: l.itens.map(i => i.id === item.id ? { ...i, texto } : i) }));
    return mexer(() => SD.itemAtualizar(item.id, { texto }));
  }
  function abrirMenuNova(botao: HTMLElement) {
    setMenuNova({ botao, modelos: null });
    SD.modelosListar().then(modelos => setMenuNova(m => m && { ...m, modelos })).catch(e => { falha(e); setMenuNova(m => m && { ...m, modelos: [] }); });
  }
  // Um clique no modelo: o checklist entra no cartão com o nome e os itens dele, sem nenhum marcado.
  const usarModelo = (m: ModeloDeLista) => mexer(async () => { await SD.listaCriar(modulo, id, m.nome, m.itens); avisar(`Checklist "${m.nome}" acrescentado.`); });
  async function salvarComoModelo(l: ListaDoCartao) {
    const nome = await pedirTexto('Nome do modelo', l.nome, { maximo: TAMANHO_LISTA });
    if (!nome) return;
    try { await SD.modeloCriar(nome, l.itens.map(i => i.texto)); avisar(`Modelo "${nome}" salvo. Ele aparece em "Adicionar checklist" em qualquer demanda ou tarefa.`); }
    catch (e) { falha(e); }
  }
  async function novaLista() {
    const nome = await pedirTexto('Nome do checklist', '', { maximo: TAMANHO_LISTA });
    if (nome) await mexer(() => SD.listaCriar(modulo, id, nome));
  }
  async function excluirLista(l: ListaDoCartao) {
    if (await confirmar('Excluir o checklist?', `O checklist "${l.nome}" e os ${l.itens.length} itens dele serão excluídos.`, 'Excluir checklist', true)) {
      await mexer(() => SD.listaExcluir(l.id));
    }
  }
  const moverLista = (i: number, passo: 1 | -1) => mexer(() =>
    Promise.all(moverNaLista(listas as ListaDoCartao[], i, passo).map(m => SD.listaAtualizar(m.id, { ordem: m.ordem }))));
  async function prazoDoItemPedir(item: ItemDaLista) {
    const texto = await pedirData('Data de entrega (DD/MM/AAAA). Deixe vazio para tirar.', fmtData(item.prazo));
    if (texto === null) return;
    let prazo: string | null;
    try { prazo = lerData(texto); } catch (e) { falha(e); return; }
    await mexer(() => SD.itemAtualizar(item.id, { prazo }));
  }
  const moverItem = (l: ListaDoCartao, i: number, passo: 1 | -1) => mexer(() =>
    Promise.all(moverNaLista(l.itens, i, passo).map(m => SD.itemAtualizar(m.id, { ordem: m.ordem }))));

  const total = Array.isArray(listas) ? listas.length : undefined;
  /** De quem é o menu "⋯" aberto (o checklist ou o item), para o botão dele continuar à vista. */
  const menuDe = menu ? menu.item?.id ?? menu.lista.id : null;
  return <Recolhivel titulo="Checklists" icone="check" preferencia={`${modulo}.cartao.listas`} contador={total}>
    {listas === null ? <Carregando />
      : typeof listas === 'string' ? <Aviso tipo="erro">{listas}</Aviso>
      : <>
        {!listas.length && <Nota>{DO_CARTAO[modulo].vazio}</Nota>}
        {listas.map(l => <Lista key={l.id} lista={l} somenteLer={somenteLer} menuDe={menuDe} aoMarcar={marcar}
          aoRenomear={nome => renomearLista(l, nome)} aoRenomearItem={renomearItem}
          aoAcrescentar={texto => mexer(() => SD.itemCriar(l.id, texto))} aoAbrirMenu={(botao, item) => setMenu({ botao, lista: l, item })} />)}
        {!somenteLer && <div><button type="button" className={estiloBotao({ forma: 'mini' })} aria-haspopup="menu" onClick={e => abrirMenuNova(e.currentTarget)}><Icone nome="mais" tam={13} /> Adicionar checklist</button></div>}
      </>}
    {menuNova && <MenuFlutuante botao={menuNova.botao} aoFechar={() => setMenuNova(null)} rotulo="Adicionar checklist">
      <button type="button" role="menuitem" onClick={() => { setMenuNova(null); void novaLista(); }}><Icone nome="mais" tam={15} /> Checklist em branco</button>
      {menuNova.modelos === null ? <p className="kmenu-nota">Carregando os modelos…</p>
        : menuNova.modelos.length ? <>
          <p className="rotulo-caps kmenu-titulo">Usar um modelo</p>
          {menuNova.modelos.map(m => <button key={m.id} type="button" role="menuitem" onClick={() => { setMenuNova(null); void usarModelo(m); }}>
            <Icone nome="check" tam={15} /> {m.nome}
          </button>)}
        </> : <p className="kmenu-nota">Nenhum modelo ainda. Salve um checklist como modelo pelo menu dele.</p>}
      <button type="button" role="menuitem" onClick={() => { setMenuNova(null); navegar('/modelos-de-lista/'); }}><Icone nome="configuracoes" tam={15} /> Gerenciar modelos</button>
    </MenuFlutuante>}
    {menu && Array.isArray(listas) && (() => {
      const i = listas.findIndex(x => x.id === menu.lista.id), lista = listas[i];
      const fechar = () => setMenu(null);
      const agir = (fn: () => unknown) => () => { fechar(); void fn(); };
      if (!lista) return null;
      if (!menu.item) return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={`Ações do checklist ${lista.nome}`}>
        <button type="button" role="menuitem" onClick={agir(() => salvarComoModelo(lista))}><Icone nome="copiar" tam={15} /> Salvar como modelo</button>
        {i > 0 && <button type="button" role="menuitem" onClick={agir(() => moverLista(i, -1))}><Icone nome="acima" tam={15} /> Subir</button>}
        {i < listas.length - 1 && <button type="button" role="menuitem" onClick={agir(() => moverLista(i, 1))}><Icone nome="abaixo" tam={15} /> Descer</button>}
        <button type="button" role="menuitem" className="perigo" onClick={agir(() => excluirLista(lista))}><Icone nome="lixeira" tam={15} /> Excluir checklist</button>
      </MenuFlutuante>;
      const j = lista.itens.findIndex(x => x.id === menu.item!.id), item = lista.itens[j];
      if (!item) return null;
      return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={`Ações do item ${item.texto}`}>
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

function Lista({ lista, somenteLer, menuDe, aoMarcar, aoRenomear, aoRenomearItem, aoAcrescentar, aoAbrirMenu }: {
  somenteLer: boolean; lista: ListaDoCartao; menuDe: string | null; aoMarcar: (item: ItemDaLista, feito: boolean) => void;
  aoRenomear: (nome: string) => Promise<void>; aoRenomearItem: (item: ItemDaLista, texto: string) => Promise<void>;
  aoAcrescentar: (texto: string) => Promise<void>; aoAbrirMenu: (botao: HTMLElement, item?: ItemDaLista) => void;
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
  return <section className="lista-demanda" aria-label={`Checklist ${lista.nome}`}>
    <header>
      <TituloEditavel nivel={4} valor={lista.nome} rotulo="Nome do checklist" dica={DICA_RENOMEAR} maximo={TAMANHO_LISTA}
        conferir={conferirNomeDoChecklist} aoSalvar={somenteLer ? undefined : aoRenomear} />
      <span className="nota">{feitos} de {total}</span>
      {!somenteLer && <button type="button" className="icone-btn lista-mais" aria-label={`Ações do checklist ${lista.nome}`} aria-haspopup="menu"
        aria-expanded={menuDe === lista.id} onClick={e => aoAbrirMenu(e.currentTarget)}><Icone nome="pontos" tam={16} /></button>}
    </header>
    <div className="lista-progresso" role="progressbar" aria-label={`Progresso do checklist ${lista.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
      <i style={{ width: percentual + '%' }} />
    </div>
    <ul>{lista.itens.map(item => {
      const prazo = prazoDoItem(item, hoje);
      // A caixa marca; o texto, ao lado, se renomeia com um clique (por isso a caixa tem o próprio nome, e não um rótulo em volta do texto).
      return <li key={item.id} className={item.feito_em ? 'feito' : undefined}>
        <label className="lista-marcar"><input type="checkbox" aria-label={item.texto} checked={!!item.feito_em} disabled={somenteLer}
          onChange={e => aoMarcar(item, e.target.checked)} /></label>
        <TituloEditavel nivel="texto" className="lista-item-texto" valor={item.texto} rotulo="Texto do item" dica={DICA_RENOMEAR} maximo={TAMANHO_ITEM}
          conferir={conferirTextoDoItem} aoSalvar={somenteLer ? undefined : texto => aoRenomearItem(item, texto)} />
        {item.prazo && (prazo ? <Selo tipo={SELO_DO_PRAZO[prazo]}>{ROTULOS_PRAZO[prazo]}: {fmtData(item.prazo)}</Selo> : <span className="nota">{fmtData(item.prazo)}</span>)}
        {!somenteLer && <button type="button" className="icone-btn lista-mais" aria-label={`Ações do item ${item.texto}`} aria-haspopup="menu"
          aria-expanded={menuDe === item.id} onClick={e => aoAbrirMenu(e.currentTarget, item)}><Icone nome="pontos" tam={15} /></button>}
      </li>;
    })}</ul>
    {!somenteLer && <form className="lista-novo-item" onSubmit={acrescentar}>
      <input type="text" className="campo" aria-label={`Novo item do checklist ${lista.nome}`} placeholder="Adicionar um item…" maxLength={TAMANHO_ITEM}
        value={novo} onChange={e => setNovo(e.target.value)} />
      <button type="submit" className={estiloBotao({ pequeno: true })} disabled={!novo.trim()}>Adicionar</button>
    </form>}
  </section>;
}
