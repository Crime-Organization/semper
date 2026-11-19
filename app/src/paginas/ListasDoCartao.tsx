// Os checklists da demanda, da tarefa e do contrato (#358 e #309; no código e no banco, "listas"), como os do Trello: cada
// checklist com nome, a barra do quanto já foi feito e os itens para marcar, em grupos e subgrupos numerados (1. Documentos
// pessoais › 1.1 RG), cada item com data de entrega opcional. O nome do checklist, o de cada grupo e o texto de cada item se
// renomeiam ali mesmo, com um clique (<TituloEditavel>); o "⋯" de cada um, que aparece ao passar o mouse ou com o foco (e fica
// sempre à vista na tela de toque), muda de posição e exclui. Cada checklist é um <Lista> (paginas/listas/).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { SD, type CartaoComListas, type ListaDoCartao, type ModeloDeLista } from '../dados';
import { TAMANHO_LISTA } from '../dados/limites';
import { arvoreDoChecklist } from '../regras/gruposDaLista';
import { moverNaLista } from '../regras/listas';
import { avisar, falha } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota } from '../ui/base';
import { Icone } from '../ui/Icone';
import { confirmar, pedirTexto } from '../ui/janela';
import { MenuFlutuante } from '../ui/Menu';
import { Recolhivel } from '../ui/Recolhivel';
import { Lista } from './listas/Lista';
import './Demandas.css';

/** O que muda de um cartão para o outro: o convite do cartão sem checklist. */
const DO_CARTAO: Record<CartaoComListas, { vazio: string }> = {
  demandas: { vazio: 'Nenhum checklist ainda. Use checklists para os documentos e os passos da demanda.' },
  tarefas: { vazio: 'Nenhum checklist ainda. Use checklists para os documentos e os passos da tarefa.' },
  contratos: { vazio: 'Nenhum checklist ainda. Use checklists para os documentos e os passos do contrato.' },
};
/** Menu "⋯" de um checklist aberto: de qual, e o botão em que ele se prende. */
type MenuAberto = { botao: HTMLElement; lista: ListaDoCartao };
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

  function abrirMenuNova(botao: HTMLElement) {
    setMenuNova({ botao, modelos: null });
    SD.modelosListar().then(modelos => setMenuNova(m => m && { ...m, modelos })).catch(e => { falha(e); setMenuNova(m => m && { ...m, modelos: [] }); });
  }
  // Um clique no modelo: o checklist entra no cartão com o nome, os grupos e os itens dele, sem nenhum marcado.
  const usarModelo = (m: ModeloDeLista) => mexer(async () => { await SD.listaCriar(modulo, id, m.nome, m.arvore); avisar(`Checklist "${m.nome}" acrescentado.`); });
  async function salvarComoModelo(l: ListaDoCartao) {
    const nome = await pedirTexto('Nome do modelo', l.nome, { maximo: TAMANHO_LISTA });
    if (!nome) return;
    try { await SD.modeloCriar(nome, arvoreDoChecklist(l)); avisar(`Modelo "${nome}" salvo. Ele aparece em "Adicionar checklist" em qualquer demanda, tarefa ou contrato.`); }
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

  const total = Array.isArray(listas) ? listas.length : undefined;
  return <Recolhivel titulo="Checklists" icone="check" preferencia={`${modulo}.cartao.listas`} contador={total}>
    {listas === null ? <Carregando />
      : typeof listas === 'string' ? <Aviso tipo="erro">{listas}</Aviso>
      : <>
        {!listas.length && <Nota>{DO_CARTAO[modulo].vazio}</Nota>}
        {listas.map(l => <Lista key={l.id} lista={l} somenteLer={somenteLer} menuAberto={menu?.lista.id === l.id}
          aoAbrirMenu={botao => setMenu({ botao, lista: l })} mexer={mexer} mudarNaTela={mudarNaTela} />)}
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
      return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={`Ações do checklist ${lista.nome}`}>
        <button type="button" role="menuitem" onClick={agir(() => salvarComoModelo(lista))}><Icone nome="copiar" tam={15} /> Salvar como modelo</button>
        {i > 0 && <button type="button" role="menuitem" onClick={agir(() => moverLista(i, -1))}><Icone nome="acima" tam={15} /> Subir</button>}
        {i < listas.length - 1 && <button type="button" role="menuitem" onClick={agir(() => moverLista(i, 1))}><Icone nome="abaixo" tam={15} /> Descer</button>}
        <button type="button" role="menuitem" className="perigo" onClick={agir(() => excluirLista(lista))}><Icone nome="lixeira" tam={15} /> Excluir checklist</button>
      </MenuFlutuante>;
    })()}
  </Recolhivel>;
}
