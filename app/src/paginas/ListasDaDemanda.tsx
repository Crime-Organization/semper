// As listas da demanda, como as do Trello: cada lista com nome, a barra do quanto já foi feito e os itens para marcar,
// cada um com data de entrega opcional. Listas e itens se renomeiam, mudam de posição e se excluem pelo menu "⋯".
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { SD, type ItemDaLista, type ListaDaDemanda } from '../dados';
import { TAMANHO_ITEM, TAMANHO_LISTA } from '../dados/limites';
import { ROTULOS_PRAZO } from '../regras/demanda';
import { moverNaLista, prazoDoItem, progressoDaLista } from '../regras/listas';
import { fmtData, lerData } from '../regras/pessoa';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota, Selo } from '../ui/base';
import { Icone } from '../ui/Icone';
import { confirmar, pedirTexto } from '../ui/janela';
import { MenuFlutuante } from '../ui/Menu';
import { Recolhivel } from '../ui/Recolhivel';
import { hojeISO } from '../ui/util';

/** Cor do selo da data de entrega de um item: vencida em vermelho, para hoje em laranja, em dia neutra. */
const SELO_DO_PRAZO = { vencido: 'erro', hoje: 'pend', em_dia: 'arq' } as const;
/** Menu "⋯" aberto: de qual lista ou item, e o botão em que ele se prende. */
type MenuAberto = { botao: HTMLElement; lista: ListaDaDemanda; item?: ItemDaLista };

export function ListasDaDemanda({ demandaId }: { demandaId: string }) {
  const [listas, setListas] = useState<ListaDaDemanda[] | string | null>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const carregar = useCallback(() => SD.listasDaDemanda(demandaId).then(setListas).catch(e => setListas((e as Error).message)), [demandaId]);
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
  async function novaLista() {
    const nome = await pedirTexto('Nome da lista', '', { maximo: TAMANHO_LISTA });
    if (nome) await mexer(() => SD.listaCriar(demandaId, nome));
  }
  async function renomearLista(l: ListaDaDemanda) {
    const nome = await pedirTexto('Nome da lista', l.nome, { maximo: TAMANHO_LISTA });
    if (nome && nome !== l.nome) await mexer(() => SD.listaAtualizar(l.id, { nome }));
  }
  async function excluirLista(l: ListaDaDemanda) {
    if (await confirmar('Excluir a lista?', `A lista "${l.nome}" e os ${l.itens.length} itens dela serão excluídos.`, 'Excluir lista', true)) {
      await mexer(() => SD.listaExcluir(l.id));
    }
  }
  const moverLista = (i: number, passo: 1 | -1) => mexer(() =>
    Promise.all(moverNaLista(listas as ListaDaDemanda[], i, passo).map(m => SD.listaAtualizar(m.id, { ordem: m.ordem }))));
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
  const moverItem = (l: ListaDaDemanda, i: number, passo: 1 | -1) => mexer(() =>
    Promise.all(moverNaLista(l.itens, i, passo).map(m => SD.itemAtualizar(m.id, { ordem: m.ordem }))));

  const total = Array.isArray(listas) ? listas.length : undefined;
  return <Recolhivel titulo="Listas" icone="check" preferencia="demandas.cartao.listas" padrao contador={total}>
    {listas === null ? <Carregando />
      : typeof listas === 'string' ? <Aviso tipo="erro">{listas}</Aviso>
      : <>
        {!listas.length && <Nota>Nenhuma lista ainda. Use listas para os documentos e os passos da demanda.</Nota>}
        {listas.map(l => <Lista key={l.id} lista={l} aoMarcar={marcar}
          aoAcrescentar={texto => mexer(() => SD.itemCriar(l.id, texto))} aoAbrirMenu={(botao, item) => setMenu({ botao, lista: l, item })} />)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} onClick={novaLista}><Icone nome="mais" tam={13} /> Adicionar lista</button></div>
      </>}
    {menu && Array.isArray(listas) && (() => {
      const i = listas.findIndex(x => x.id === menu.lista.id), lista = listas[i];
      const fechar = () => setMenu(null);
      const agir = (fn: () => unknown) => () => { fechar(); void fn(); };
      if (!lista) return null;
      if (!menu.item) return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={`Ações da lista ${lista.nome}`}>
        <button type="button" role="menuitem" onClick={agir(() => renomearLista(lista))}><Icone nome="editar" tam={15} /> Renomear</button>
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

function Lista({ lista, aoMarcar, aoAcrescentar, aoAbrirMenu }: {
  lista: ListaDaDemanda; aoMarcar: (item: ItemDaLista, feito: boolean) => void; aoAcrescentar: (texto: string) => Promise<void>;
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
      <button type="button" className="icone-btn" aria-label={`Ações da lista ${lista.nome}`} onClick={e => aoAbrirMenu(e.currentTarget)}><Icone nome="pontos" tam={16} /></button>
    </header>
    <div className="lista-progresso" role="progressbar" aria-label={`Progresso da lista ${lista.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
      <i style={{ width: percentual + '%' }} />
    </div>
    <ul>{lista.itens.map(item => {
      const prazo = prazoDoItem(item, hoje);
      return <li key={item.id} className={item.feito_em ? 'feito' : undefined}>
        <label><input type="checkbox" checked={!!item.feito_em} onChange={e => aoMarcar(item, e.target.checked)} /><span>{item.texto}</span></label>
        {item.prazo && (prazo ? <Selo tipo={SELO_DO_PRAZO[prazo]}>{ROTULOS_PRAZO[prazo]}: {fmtData(item.prazo)}</Selo> : <span className="nota">{fmtData(item.prazo)}</span>)}
        <button type="button" className="icone-btn" aria-label={`Ações do item ${item.texto}`} onClick={e => aoAbrirMenu(e.currentTarget, item)}><Icone nome="pontos" tam={15} /></button>
      </li>;
    })}</ul>
    <form className="lista-novo-item" onSubmit={acrescentar}>
      <input type="text" className="campo" aria-label={`Novo item da lista ${lista.nome}`} placeholder="Adicionar um item…" maxLength={TAMANHO_ITEM}
        value={novo} onChange={e => setNovo(e.target.value)} />
      <button type="submit" className={estiloBotao({ pequeno: true })} disabled={!novo.trim()}>Adicionar</button>
    </form>
  </section>;
}
