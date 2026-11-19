// Um checklist do cartão (demanda, tarefa ou contrato; #358 e #309): o nome (renomeia com um clique), quantos itens estão
// feitos, a barra do progresso e a árvore com os grupos numerados. Liga cada ação da árvore às funções de dados: muda na tela
// na hora, grava e recarrega (pelo "mexer" da seção); se a gravação falha, o erro aparece no pé da tela e a recarga desfaz.
import { useMemo, useRef } from 'react';
import { SD, type ItemDaLista, type ListaDoCartao } from '../../dados';
import { TAMANHO_LISTA } from '../../dados/limites';
import { aplicarPosicoes, arvoreDaLista, mudancasDePosicao, ondeEntraAArvore, semOGrupo } from '../../regras/gruposDaLista';
import { conferirNomeDoChecklist, progressoDaLista } from '../../regras/listas';
import { fmtData, lerData } from '../../regras/pessoa';
import { avisar, falha } from '../../ui/avisos';
import { TituloEditavel } from '../../ui/base';
import { Icone } from '../../ui/Icone';
import { pedirData } from '../../ui/janela';
import { ArvoreDoChecklist, DICA_RENOMEAR, type AcoesDaArvore } from './ArvoreDoChecklist';

interface Props {
  lista: ListaDoCartao;
  somenteLer: boolean;
  /** O ⋯ do checklist com o menu aberto (fica à vista). */
  menuAberto: boolean;
  aoAbrirMenu: (botao: HTMLElement) => void;
  /** Faz a mudança no banco e recarrega os checklists (o erro aparece no pé da tela); devolve se gravou. */
  mexer: (fn: () => Promise<unknown>) => Promise<boolean>;
  /** Muda na tela, na hora, o que o banco grava em seguida. */
  mudarNaTela: (fn: (l: ListaDoCartao) => ListaDoCartao) => void;
}

export function Lista({ lista, somenteLer, menuAberto, aoAbrirMenu, mexer, mudarNaTela }: Props) {
  const secao = useRef<HTMLElement>(null);
  const arvore = useMemo(() => arvoreDaLista(lista), [lista]);
  const { feitos, total, percentual } = progressoDaLista(lista.itens);
  const nesta = (fn: (l: ListaDoCartao) => ListaDoCartao) => mudarNaTela(l => l.id === lista.id ? fn(l) : l);
  const mudarItem = (id: string, campos: Partial<ItemDaLista>) => nesta(l => ({ ...l, itens: l.itens.map(i => i.id === id ? { ...i, ...campos } : i) }));

  const acoes: AcoesDaArvore = {
    marcar(item, feito) {
      mudarItem(item.id, { feito_em: feito ? new Date().toISOString() : null });
      void mexer(() => SD.itemAtualizar(item.id, { feito }));
    },
    async prazo(item) {
      const texto = await pedirData('Data de entrega (DD/MM/AAAA). Deixe vazio para tirar.', fmtData(item.prazo));
      if (texto === null) return;
      let prazo: string | null;
      try { prazo = lerData(texto); } catch (e) { falha(e); return; }
      await mexer(() => SD.itemAtualizar(item.id, { prazo }));
    },
    renomearItem(item, texto) {
      mudarItem(item.id, { texto });
      return mexer(() => SD.itemAtualizar(item.id, { texto }));
    },
    renomearGrupo(grupo, nome) {
      nesta(l => ({ ...l, grupos: l.grupos.map(g => g.id === grupo.id ? { ...g, nome } : g) }));
      return mexer(() => SD.grupoDoChecklistAtualizar(grupo.id, { nome }));
    },
    async reordenar(depois) {
      const posicoes = mudancasDePosicao(lista, depois);
      if (!posicoes.length) return true;
      nesta(l => ({ ...l, ...aplicarPosicoes(l, posicoes) }));
      return mexer(() => SD.listaReordenar(lista.id, posicoes));
    },
    // Tudo de uma vez (#375): o que renumerar, os grupos e os itens entram juntos, ou nada entra (a internet que cai no meio, ou
    // outra pessoa mexendo junto, não deixam o checklist pela metade).
    async acrescentar(grupoId, nova) {
      let criados: string[] = [];
      await mexer(async () => { criados = await SD.listaAcrescentar(lista.id, grupoId, nova, ondeEntraAArvore(arvore, grupoId, nova)); });
      return criados;
    },
    excluirItem(item) {
      nesta(l => ({ ...l, itens: l.itens.filter(i => i.id !== item.id) }));
      return mexer(async () => { await SD.itemExcluir(item.id); avisar('Item excluído.'); });
    },
    excluirGrupo(grupo) {
      nesta(l => ({ ...l, ...semOGrupo(l, grupo.id) }));
      return mexer(async () => { await SD.grupoDoChecklistExcluir(grupo.id); avisar('Grupo excluído.'); });
    },
  };
  /** Sem nó acima, o foco vai para o nome do checklist. */
  const focarNoNome = () => secao.current?.querySelector<HTMLElement>('header button')?.focus();

  return <section className="lista-demanda" aria-label={`Checklist ${lista.nome}`} ref={secao}>
    <header>
      <TituloEditavel nivel={4} valor={lista.nome} rotulo="Nome do checklist" dica={DICA_RENOMEAR} maximo={TAMANHO_LISTA}
        conferir={conferirNomeDoChecklist} aoSalvar={somenteLer ? undefined : nome => {
          nesta(l => ({ ...l, nome }));
          return mexer(() => SD.listaAtualizar(lista.id, { nome }));
        }} />
      <span className="nota">{feitos} de {total}</span>
      {!somenteLer && <button type="button" className="icone-btn lista-mais" aria-label={`Ações do checklist ${lista.nome}`} aria-haspopup="menu"
        aria-expanded={menuAberto} onClick={e => aoAbrirMenu(e.currentTarget)}><Icone nome="pontos" tam={16} /></button>}
    </header>
    <div className="lista-progresso" role="progressbar" aria-label={`Progresso do checklist ${lista.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
      <i style={{ width: percentual + '%' }} />
    </div>
    <ArvoreDoChecklist arvore={arvore} modo="cartao" acoes={somenteLer ? undefined : acoes} rotuloDoNovo={`Novo item do checklist ${lista.nome}`}
      aoFocarNoTopo={focarNoNome} />
  </section>;
}
