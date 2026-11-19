// O menu "⋯" de cada grupo e de cada item do checklist (#309): Data de entrega (só no cartão), Adicionar subgrupo, Subir,
// Descer (da tabela ACOES_DO_NO), Mover para grupo (a janela de escolher, a mesma de "Mover para pasta") e Excluir. Depois de
// cada ação, o foco vai para um lugar certo: o ⋯ do nó movido (e o aviso do pé diz o número novo) ou, depois de excluir, o ⋯ do
// nó à vista logo acima (ou o nome do checklist, se não houver). O que está dentro de um grupo fechado não está na tela: o grupo
// para onde o nó vai, ou onde nasce o subgrupo, abre antes do foco.
import { useState, type RefObject } from 'react';
import type { GrupoDaLista, ItemDaLista, NoDoModelo } from '../../dados';
import { TAMANHO_LISTA } from '../../dados/limites';
import {
  ACOES_DO_NO, acharNo, acoesPossiveis, avisoDaPosicao, destinosDoNo, grupoDoNo, gruposDeCima, moverParaGrupo, noDeCimaNaTela, podeTerSubgrupo, textoDaExclusaoDoGrupo,
  type AcaoDoNo, type NoDaLista, type ResultadoDaAcao
} from '../../regras/gruposDaLista';
import { avisar } from '../../ui/avisos';
import { Icone } from '../../ui/Icone';
import { confirmar, escolherNaJanela, pedirTexto } from '../../ui/janela';
import { MenuFlutuante } from '../../ui/Menu';

/** O atributo do ⋯ de cada nó, com o id dele: por ele o foco o acha depois de uma ação. */
export const ATRIBUTO_DO_NO = 'data-no';
/** O valor da opção "Fora dos grupos" na janela de mover. */
const FORA = '';

/** O que a árvore pede a quem a usa (o cartão grava no banco; o editor de modelos muda a árvore em memória). */
export interface AcoesDaArvore {
  /** Marcar e a data de entrega: só no cartão. */
  marcar?: (item: ItemDaLista, feito: boolean) => void;
  prazo?: (item: ItemDaLista) => Promise<unknown>;
  renomearItem: (item: ItemDaLista, texto: string) => unknown;
  renomearGrupo: (grupo: GrupoDaLista, nome: string) => unknown;
  /** Grava a árvore depois de subir, descer ou mover para grupo; devolve se gravou (se não, quem a usa já mostrou o erro). */
  reordenar: (depois: NoDaLista[]) => Promise<boolean>;
  /** Acrescenta a árvore no fim do grupo (null: no fim do checklist); devolve os ids dos grupos criados, na ordem. */
  acrescentar: (grupoId: string | null, nova: NoDoModelo[]) => Promise<string[]>;
  excluirItem: (item: ItemDaLista) => Promise<unknown>;
  excluirGrupo: (grupo: GrupoDaLista) => Promise<unknown>;
}

/** O nome do nó, como a pessoa lê. */
export const nomeDoNo = (no: NoDaLista) => no.tipo === 'grupo' ? no.grupo.nome : no.item.texto;

interface Opcoes {
  arvore: NoDaLista[];
  acoes: AcoesDaArvore | undefined;
  /** Onde procurar o ⋯ que recebe o foco. */
  raiz: RefObject<HTMLElement | null>;
  /** Para onde vai o foco quando não sobra nó acima (o nome do checklist ou do modelo). */
  aoFocarNoTopo: () => void;
  /** Abre o campo de item novo do grupo (depois de criar um subgrupo). */
  abrirCampo: (grupoId: string) => void;
  /** Os grupos fechados na tela, e como abrir alguns. */
  fechados: ReadonlySet<string>;
  abrirGrupos: (ids: string[]) => void;
}

export function useAcoesDoNo({ arvore, acoes, raiz, aoFocarNoTopo, abrirCampo, fechados, abrirGrupos }: Opcoes) {
  const [menu, setMenu] = useState<{ botao: HTMLElement; id: string } | null>(null);
  /** O foco no ⋯ do nó, depois de o React desenhar a árvore nova. */
  const focar = (id: string | null) => setTimeout(() => {
    const botao = id ? raiz.current?.querySelector<HTMLElement>(`[${ATRIBUTO_DO_NO}="${id}"]`) : null;
    if (botao) botao.focus(); else aoFocarNoTopo();
  }, 0);
  /** Grava a árvore nova da ação (ou diz por que não deu) e leva o foco ao nó, com o número novo no aviso. */
  async function aplicar(id: string, resultado: ResultadoDaAcao) {
    if ('motivo' in resultado) { avisar(resultado.motivo, 'erro'); return; }
    if (!await acoes!.reordenar(resultado.arvore)) return;
    const no = acharNo(resultado.arvore, id);
    if (no) avisar(avisoDaPosicao(no));
    abrirGrupos(gruposDeCima(resultado.arvore, id));
    focar(id);
  }
  async function moverParaOGrupo(no: NoDaLista) {
    const atual = grupoDoNo(arvore, no.id);
    const escolha = await escolherNaJanela({
      titulo: `Mover "${nomeDoNo(no)}" para o grupo`, rotulo: 'Grupo', atual: atual ?? FORA,
      opcoes: destinosDoNo(arvore, no.id).map(d => ({ valor: d.grupoId ?? FORA, nome: d.nome }))
    });
    if (escolha === null) return;
    const grupoId = escolha || null;
    if (grupoId === atual) return;
    await aplicar(no.id, moverParaGrupo(arvore, no.id, grupoId));
  }
  /** Exclui o grupo depois de a pessoa confirmar (com o que está dentro dele); devolve se excluiu. */
  async function excluirGrupo(no: Extract<NoDaLista, { tipo: 'grupo' }>) {
    if (!await confirmar('Excluir o grupo?', textoDaExclusaoDoGrupo(no), 'Excluir grupo', true)) return false;
    await acoes!.excluirGrupo(no.grupo);
    return true;
  }
  async function excluir(no: NoDaLista) {
    const acima = noDeCimaNaTela(arvore, no.id, fechados)?.id ?? null;
    if (no.tipo === 'item') { await acoes!.excluirItem(no.item); focar(acima); return; }
    focar(await excluirGrupo(no) ? acima : no.id);
  }
  async function subgrupo(no: NoDaLista) {
    const nome = await pedirTexto('Nome do subgrupo', '', { maximo: TAMANHO_LISTA });
    if (!nome) return;
    const [criado] = await acoes!.acrescentar(no.id, [{ texto: nome, filhos: [] }]);
    if (!criado) return;
    abrirGrupos([no.id]);
    abrirCampo(criado);
  }

  const no = menu && acharNo(arvore, menu.id);
  const elemento = menu && no && acoes && (() => {
    const fechar = () => setMenu(null);
    // O foco volta ao ⋯ antes da ação: a janela que ela abrir o devolve para lá, se a pessoa desistir.
    const agir = (fn: () => unknown) => () => { fechar(); menu.botao.focus(); void fn(); };
    const possiveis = acoesPossiveis(arvore, no.id);
    const ordem = (a: AcaoDoNo) => <button key={a} type="button" role="menuitem" onClick={agir(() => aplicar(no.id, ACOES_DO_NO[a].aplicar(arvore, no.id)))}>
      <Icone nome={ACOES_DO_NO[a].icone} tam={15} /> {ACOES_DO_NO[a].rotulo}
    </button>;
    const rotulo = no.tipo === 'grupo' ? `Ações do grupo ${no.grupo.nome}` : `Ações do item ${no.item.texto}`;
    return <MenuFlutuante botao={menu.botao} aoFechar={fechar} rotulo={rotulo}>
      {no.tipo === 'item' && acoes.prazo && <button type="button" role="menuitem" onClick={agir(() => acoes.prazo!(no.item))}><Icone nome="relogio" tam={15} /> Data de entrega</button>}
      {podeTerSubgrupo(no) && <button type="button" role="menuitem" onClick={agir(() => subgrupo(no))}><Icone nome="mais" tam={15} /> Adicionar subgrupo</button>}
      {possiveis.ordem.map(ordem)}
      {possiveis.moverParaGrupo && <button type="button" role="menuitem" onClick={agir(() => moverParaOGrupo(no))}><Icone nome="seta" tam={15} /> Mover para grupo</button>}
      <button type="button" role="menuitem" className="perigo" onClick={agir(() => excluir(no))}>
        <Icone nome="lixeira" tam={15} /> {no.tipo === 'grupo' ? 'Excluir grupo' : 'Excluir item'}
      </button>
    </MenuFlutuante>;
  })();

  return { abrir: (botao: HTMLElement, id: string) => setMenu({ botao, id }), menuDe: menu?.id ?? null, menu: elemento };
}
