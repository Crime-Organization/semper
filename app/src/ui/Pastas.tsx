// Pastas dos documentos na tela (#342), como no Obsidian: a árvore à esquerda (abre e fecha cada pasta; cria, renomeia, move e
// apaga pelo ⋯ de cada uma), que desde o pedido de 18/11 é o explorador, com as anotações dentro das pastas (no celular, numa
// gaveta); o caminho no topo da anotação ("Escritório › POPs › Financeiro", cada pedaço leva à pasta) e a escolha da pasta da anotação. As regras (árvore,
// caminho, nome, ciclo) ficam em regras/pastas.ts; a lista do escritório, em pastasDoEscritorio.ts. Desde a #370, quem altera a
// anotação a arrasta, no explorador, para uma pasta (ou para "Sem pasta"), ou a leva pelo ⋯ dela, em "Mover para pasta".
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { SD, type Ordem, type Pasta } from '../dados';
import { TAMANHO_PASTA } from '../dados/limites';
import {
  arvoreDePastas, caminhoDaPasta, destinosDaPasta, enderecoDaPasta, erroAoMoverPasta, erroDoNomeDaPasta, pastasDescendentes, pastasEmOrdem,
  textoDoCaminho, type NoDaPasta
} from '../regras/pastas';
import {
  ALVO_SEM_PASTA, anotacoesPorPasta, avisoDaMudancaDePasta, mudaDePasta, ORDENS_DO_EXPLORADOR, pastaDoAlvo, pastasParaMostrar, type AnotacaoDoExplorador
} from '../regras/explorador';
import { ATRIBUTO_DO_ALVO, FantasmaDoArrasto, useArrastar } from './arrastar';
import { avisar, falha, feito } from './avisos';
import { Carregando, Nota } from './base';
import { Icone, type NomeIcone } from './Icone';
import { confirmar, escolherNaJanela, pedirTexto } from './janela';
import { MenuFlutuante } from './Menu';
import { ORDENS } from './ordem';
import { buscarPastas } from './pastasDoEscritorio';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { useCtx } from './sessao';

/** O recuo de cada nível da árvore e da lista de escolha vem do CSS (--nivel). */
const comNivel = (nivel: number) => ({ '--nivel': nivel }) as CSSProperties;
/** Onde fica guardado, para cada pessoa, quais pastas da árvore ela deixou abertas. */
const PREFERENCIA_DAS_ABERTAS = 'documentos.pastas.abertas';
/** Onde fica guardado, para cada pessoa, se a navegação de Documentos (a árvore à esquerda) está recolhida. */
export const PREFERENCIA_DA_NAVEGACAO = 'documentos.navegacao.recolhida';
/** O nome do botão que recolhe e mostra a navegação, em cada estado: ele diz o que o clique faz. */
const NOME_DA_NAVEGACAO: Record<'recolhida' | 'aberta', string> = { recolhida: 'Mostrar a navegação', aberta: 'Recolher a navegação' };

/**
 * Se a navegação de Documentos (a árvore à esquerda) está recolhida, e como alternar. A escolha fica guardada para cada pessoa,
 * como as outras preferências de tela.
 */
export function useNavegacaoRecolhida() {
  const [recolhida, setRecolhida] = useState(() => lerPreferencia<unknown>(PREFERENCIA_DA_NAVEGACAO, false) === true);
  const alternar = () => {
    setRecolhida(!recolhida);
    salvarPreferencia(PREFERENCIA_DA_NAVEGACAO, !recolhida);
  };
  return { recolhida, alternar };
}
/** O valor do seletor que mostra todos os documentos, de todas as pastas. */
const TODAS = '';
/** O atributo com o id da anotação no link dela, no explorador: por ele o foco a acha depois de ela mudar de pasta. */
const ATRIBUTO_DA_ANOTACAO = 'data-anotacao';

interface EscolhaNaJanela {
  titulo: string;
  /** O rótulo do campo da pasta. */
  rotulo: string;
  /** A primeira opção, a de fora de todas as pastas: o valor dela e o nome que a pessoa lê. */
  raiz: { valor: string; nome: string };
  /** As pastas que se podem escolher, na ordem da árvore, e todas as do escritório (para o caminho de cada uma). */
  destinos: NoDaPasta<Pasta>[];
  pastas: Pasta[];
  /** A opção já escolhida ao abrir (a pasta de agora). */
  atual: string;
}

/**
 * A janela de escolher para qual pasta algo vai: a de mover uma pasta e a de mover uma anotação (#370). Devolve o valor da opção
 * escolhida, ou null se a pessoa desistiu.
 */
function escolherPastaNaJanela({ titulo, rotulo, raiz, destinos, pastas, atual }: EscolhaNaJanela) {
  const opcoes = [raiz, ...destinos.map(n => ({ valor: n.pasta.id, nome: textoDoCaminho(pastas, n.pasta.id) }))];
  return escolherNaJanela({ titulo, rotulo, opcoes, atual });
}

/**
 * A janela "Mover para pasta" da anotação (#370; o ⋯ dela, no explorador e no cartão), a mesma de mover uma pasta: devolve a
 * pasta escolhida (null: sem pasta), ou undefined se a pessoa desistiu ou deixou a mesma.
 */
export async function escolherPastaDaAnotacao(pastas: Pasta[], atual: string | null, titulo: string): Promise<string | null | undefined> {
  const alvo = await escolherPastaNaJanela({
    titulo: `Mover "${titulo}" para a pasta`, rotulo: 'Pasta', raiz: { valor: ALVO_SEM_PASTA, nome: 'Sem pasta' },
    destinos: pastasEmOrdem(pastas), pastas, atual: atual ?? ALVO_SEM_PASTA
  });
  return alvo === null || !mudaDePasta(atual, alvo) ? undefined : pastaDoAlvo(alvo);
}

/**
 * Leva a anotação para outra pasta (null: para fora das pastas) e avisa no pé da tela, com o Desfazer, que a devolve à pasta de
 * antes. A anotação aberta e as listas se atualizam no desfazer, pelo aviso de mudança ('anotacaoAtualizada').
 */
export async function levarAnotacaoParaPasta(id: string, antes: string | null, destino: string | null, pastas: Pasta[]) {
  await SD.anotacaoAtualizar(id, { pasta_id: destino });
  feito(avisoDaMudancaDePasta(pastas, destino), 'mudança da pasta da anotação', async () => {
    await SD.anotacaoAtualizar(id, { pasta_id: antes });
    return { tipo: 'anotacaoAtualizada', id };
  });
}

/** O que se faz com uma pasta: criar (outra dentro dela, ou no primeiro nível), renomear, mover e apagar. Cada um com o desfazer. */
function useAcoesDasPastas(pastas: Pasta[], escolhida: string | null, aoEscolher: (id: string | null) => void) {
  const dono = useCtx().perfil.id;
  const reler = () => buscarPastas(dono);
  async function criar(mae: string | null) {
    const nome = await pedirTexto(mae ? 'Nova subpasta' : 'Nova pasta', '', { maximo: TAMANHO_PASTA });
    if (nome === null) return;
    const erro = erroDoNomeDaPasta(nome, pastas, mae);
    if (erro) { avisar(erro, 'erro'); return; }
    try {
      const p = await SD.pastaCriar(nome, mae);
      feito(`Pasta "${p.nome}" criada.`, 'criação da pasta', async () => { await SD.pastaExcluir(p.id); await reler(); });
      await reler();
      aoEscolher(p.id);
    } catch (e) { falha(e); }
  }
  async function renomear(p: Pasta) {
    const nome = await pedirTexto('Renomear a pasta', p.nome, { maximo: TAMANHO_PASTA });
    if (nome === null || nome === p.nome) return;
    const erro = erroDoNomeDaPasta(nome, pastas, p.pasta_mae_id, p.id);
    if (erro) { avisar(erro, 'erro'); return; }
    try {
      await SD.pastaRenomear(p.id, nome);
      feito('Pasta renomeada.', 'troca do nome da pasta', async () => { await SD.pastaRenomear(p.id, p.nome); await reler(); });
      await reler();
    } catch (e) { falha(e); }
  }
  async function mover(p: Pasta) {
    const destino = await escolherPastaNaJanela({
      titulo: `Mover a pasta "${p.nome}"`, rotulo: 'Para dentro de', raiz: { valor: TODAS, nome: 'Nenhuma (primeiro nível)' },
      destinos: destinosDaPasta(pastas, p.id), pastas, atual: p.pasta_mae_id ?? TODAS
    });
    if (destino === null) return;
    const mae = destino || null;
    if (mae === p.pasta_mae_id) return;
    const erro = erroAoMoverPasta(pastas, p.id, mae);
    if (erro) { avisar(erro, 'erro'); return; }
    try {
      await SD.pastaMover(p.id, mae);
      feito('Pasta movida.', 'mudança da pasta de lugar', async () => { await SD.pastaMover(p.id, p.pasta_mae_id); await reler(); });
      await reler();
    } catch (e) { falha(e); }
  }
  async function apagar(p: Pasta) {
    const ok = await confirmar('Apagar a pasta', `A pasta "${p.nome}" será apagada. Só a pasta vazia, sem anotações nem subpastas, pode ser apagada.`, 'Apagar', true);
    if (!ok) return;
    try {
      await SD.pastaExcluir(p.id);
      feito(`Pasta "${p.nome}" apagada.`, 'exclusão da pasta', async () => { await SD.pastaCriar(p.nome, p.pasta_mae_id); await reler(); });
      if (escolhida && pastasDescendentes(pastas, p.id).includes(escolhida)) aoEscolher(p.pasta_mae_id);
      await reler();
    } catch (e) { falha(e); }
  }
  return { criar, renomear, mover, apagar };
}
type AcoesDasPastas = ReturnType<typeof useAcoesDasPastas>;

/** O ⋯ de uma pasta: criar uma subpasta dentro dela, renomear, mover e apagar. */
function MenuDaPasta({ pasta, acoes }: { pasta: Pasta; acoes: AcoesDasPastas }) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const itens: [rotulo: string, icone: NomeIcone, agir: (p: Pasta) => unknown, perigo?: boolean][] = [
    ['Nova subpasta', 'mais', p => acoes.criar(p.id)],
    ['Renomear', 'editar', acoes.renomear],
    ['Mover para outra pasta', 'seta', acoes.mover],
    ['Apagar', 'lixeira', acoes.apagar, true]
  ];
  return <>
    <button type="button" className="pasta-mais" aria-label={`Ações da pasta ${pasta.nome}`} title="Ações da pasta" aria-haspopup="menu" aria-expanded={!!botao}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="pontos" tam={16} />
    </button>
    {botao && <MenuFlutuante botao={botao} aoFechar={() => setBotao(null)}>
      {itens.map(([rotulo, icone, agir, perigo]) => <button key={rotulo} type="button" role="menuitem" className={perigo ? 'perigo' : undefined}
        onClick={() => { setBotao(null); void agir(pasta); }}>
        <Icone nome={icone} tam={15} /> {rotulo}
      </button>)}
    </MenuFlutuante>}
  </>;
}

/**
 * O ⋯ de uma anotação no explorador (só para quem a altera): por ele, pelo teclado ou pelo toque, a anotação vai para outra pasta.
 * Antes de abrir a janela, o foco volta ao ⋯: a janela o devolve para lá se a pessoa desistir (se mover, a árvore o leva à anotação
 * no lugar novo).
 */
function MenuDaAnotacao({ titulo, aoMover }: { titulo: string; aoMover: () => unknown }) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  function mover() {
    botao?.focus();
    setBotao(null);
    void aoMover();
  }
  return <>
    <button type="button" className="pasta-mais" aria-label={`Ações da anotação ${titulo}`} title="Ações da anotação" aria-haspopup="menu" aria-expanded={!!botao}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="pontos" tam={16} />
    </button>
    {botao && <MenuFlutuante botao={botao} aoFechar={() => setBotao(null)}>
      <button type="button" role="menuitem" onClick={mover}>
        <Icone nome="seta" tam={15} /> Mover para pasta
      </button>
    </MenuFlutuante>}
  </>;
}

/** O sinal da escolha atual no menu (o lugar fica reservado nas outras, para os nomes ficarem alinhados). */
const Marca = ({ ligada }: { ligada: boolean }) => <span className="kmenu-marca">{ligada && <Icone nome="check" tam={15} />}</span>;

/** As anotações no explorador (a página Documentos, como no Obsidian): quais são, qual está aberta e como abrir e criar. */
export interface AnotacoesDaArvore {
  /** As anotações, na ordem escolhida no explorador (null: ainda chegando). */
  lista: AnotacaoDoExplorador[] | null;
  /** A anotação aberta (na janela do cartão), destacada na árvore. */
  aberta: string | null;
  /** O endereço que abre a anotação (o link de cada uma, que troca o endereço sem criar entrada no histórico, como abrir um cartão; o Ctrl+clique abre noutra aba). */
  endereco: (id: string) => string;
  /** O endereço da anotação nova (já na pasta escolhida). */
  nova: string;
  /** A ordem das anotações e como mudá-la (o botão Ordenar). */
  ordem: Ordem;
  aoOrdenar: (o: Ordem) => void;
  /**
   * Quantas anotações há com a busca e os filtros da página: o explorador lê até um máximo (ANOTACOES_NO_EXPLORADOR), e, se
   * houver mais, diz no pé quantas mostra, para ninguém achar que as outras sumiram.
   */
  total?: number;
  /**
   * Levar a anotação para outra pasta (#370): quem a altera (pode) a arrasta até uma pasta, ou até "Sem pasta" (a linha do alto,
   * que muda de nome durante o arrasto), ou usa "Mover para pasta" no ⋯ dela. Quem só lê não arrasta nem vê o ⋯. Sem isto,
   * nenhuma se move.
   */
  mover?: { pode: (id: string) => boolean; aoMover: (id: string, pasta: string | null) => void };
}

interface PropsDaArvore {
  /** As pastas do escritório (null: ainda chegando). */
  pastas: Pasta[] | null;
  /** A pasta escolhida (null: todos os documentos). */
  escolhida: string | null;
  aoEscolher: (id: string | null) => void;
  /** Com isto, a árvore é o explorador: cada pasta mostra as anotações dela, e as sem pasta ficam no primeiro nível. */
  anotacoes?: AnotacoesDaArvore;
  /**
   * O botão que recolhe e mostra a navegação (useNavegacaoRecolhida), no começo da barra. Recolhida, a página esconde o resto da
   * árvore pelo CSS; no celular, onde a árvore é uma gaveta, o botão não aparece, e a gaveta mostra tudo.
   */
  navegacao?: { recolhida: boolean; aoAlternar: () => void };
}

/** O tamanho dos ícones da barra do explorador. */
const ICONE_DA_BARRA = 16;

/**
 * A árvore das pastas, à esquerda da página Documentos, como o explorador do Obsidian: no alto, a barra com nova anotação, nova
 * pasta, ordenar e recolher tudo; depois, "Todos os documentos" e cada pasta com a seta que abre e fecha o que está dentro, o
 * nome (que escolhe a pasta) e o ⋯. Dentro de cada pasta aberta, as subpastas e as anotações dela; as anotações sem pasta vêm
 * no primeiro nível, depois das pastas. A anotação aberta fica destacada, e as pastas do caminho até ela (e até a pasta
 * escolhida) abrem sozinhas. As abertas ficam guardadas para cada pessoa. No celular, a página a mostra numa gaveta. Com
 * "navegacao", o começo da barra tem o botão que recolhe e mostra a navegação (como o do painel lateral do Obsidian).
 */
export function ArvoreDePastas({ pastas, escolhida, aoEscolher, anotacoes, navegacao }: PropsDaArvore) {
  const lista = pastas ?? [];
  const idDaLista = useId();
  const acoes = useAcoesDasPastas(lista, escolhida, aoEscolher);
  const [abertas, setAbertas] = useState<string[]>(() => lerPreferencia<string[]>(PREFERENCIA_DAS_ABERTAS, []));
  const [menuDaOrdem, setMenuDaOrdem] = useState<HTMLElement | null>(null);
  // A pasta escolhida (pela árvore, pelo caminho da anotação ou pelo endereço) e a da anotação aberta ficam à vista: ao mudarem,
  // elas e as pastas acima delas abrem. Depois, a pessoa ainda pode fechá-las.
  const daAberta = anotacoes?.lista?.find(a => a.id === anotacoes.aberta)?.pasta_id ?? null;
  const acima = pastasParaMostrar(lista, escolhida, daAberta);
  const [abertasPara, setAbertasPara] = useState('');
  if (acima.join() !== abertasPara) {
    setAbertasPara(acima.join());
    const faltam = acima.filter(id => !abertas.includes(id));
    if (faltam.length) setAbertas([...abertas, ...faltam]);
  }
  function guardar(novas: string[]) {
    setAbertas(novas);
    salvarPreferencia(PREFERENCIA_DAS_ABERTAS, novas);
  }
  const alternar = (id: string) => guardar(abertas.includes(id) ? abertas.filter(x => x !== id) : [...abertas, id]);
  const arvore = arvoreDePastas(lista);
  const daArvore = anotacoes?.lista ?? [];
  const porPasta = anotacoesPorPasta(daArvore, lista);
  const temAberta = !!anotacoes?.aberta;

  // ---------- levar a anotação para outra pasta (#370) ----------
  const anotacao = (id: string) => daArvore.find(a => a.id === id);
  /** Leva a anotação e abre a pasta de destino (e as de cima), para ela continuar à vista. */
  function levar(id: string, destino: string | null) {
    anotacoes?.mover?.aoMover(id, destino);
    const faltam = pastasParaMostrar(lista, destino).filter(p => !abertas.includes(p));
    if (faltam.length) guardar([...abertas, ...faltam]);
  }
  const { arrasto, alca } = useArrastar({
    aceita: (id, alvo) => { const a = anotacao(id); return !!a && mudaDePasta(a.pasta_id, alvo); },
    aoSoltar: (id, alvo) => levar(id, pastaDoAlvo(alvo))
  });
  // Movida pelo ⋯ (o caminho do teclado), a anotação é desenhada de novo no lugar novo, e o ⋯ em que estava o foco some: o foco
  // vai para o link dela, ali, para quem usa o teclado ou o leitor de tela não voltar ao começo da página.
  const arvoreRef = useRef<HTMLElement>(null);
  const focarNaAnotacao = useRef<string | null>(null);
  useEffect(() => {
    if (!focarNaAnotacao.current) return;
    const link = arvoreRef.current?.querySelector<HTMLElement>(`[${ATRIBUTO_DA_ANOTACAO}="${focarNaAnotacao.current}"]`);
    if (!link) return;
    link.focus();
    focarNaAnotacao.current = null;
  });
  async function moverPeloMenu(a: AnotacaoDoExplorador) {
    const destino = await escolherPastaDaAnotacao(lista, a.pasta_id, a.titulo);
    if (destino === undefined) return;
    focarNaAnotacao.current = a.id;
    levar(a.id, destino);
  }
  /** As classes da linha que recebe a anotação arrastada: destacada enquanto ela passa por cima. */
  const recebe = (classes: string, alvo: string) => classes + (arrasto?.alvo === alvo ? ' recebendo' : '');

  const linhasDasAnotacoes = (pastaId: string | null, nivel: number) => anotacoes && (porPasta.get(pastaId) ?? []).map(a => {
    const atual = a.id === anotacoes.aberta, pode = !!anotacoes.mover?.pode(a.id);
    return <li key={'a-' + a.id}>
      <div className={'explorador-item' + (atual ? ' atual' : '') + (arrasto?.id === a.id ? ' arrastando' : '')}>
        <Link className={atual ? 'explorador-anotacao atual' : 'explorador-anotacao'} style={comNivel(nivel)} to={anotacoes.endereco(a.id)} replace
          aria-current={atual ? 'page' : undefined} draggable={false} {...{ [ATRIBUTO_DA_ANOTACAO]: a.id }} {...(pode ? alca(a.id) : {})}><span>{a.titulo}</span></Link>
        {pode && <MenuDaAnotacao titulo={a.titulo} aoMover={() => moverPeloMenu(a)} />}
      </div>
    </li>;
  });
  const no = (n: NoDaPasta<Pasta>) => {
    const temDentro = n.filhas.length > 0 || (porPasta.get(n.pasta.id)?.length ?? 0) > 0;
    const aberta = abertas.includes(n.pasta.id), atual = !temAberta && n.pasta.id === escolhida;
    return <li key={n.pasta.id}>
      <div className={recebe(atual ? 'pasta-linha atual' : 'pasta-linha', n.pasta.id)} style={comNivel(n.nivel)} {...{ [ATRIBUTO_DO_ALVO]: n.pasta.id }}>
        {temDentro
          ? <button type="button" className="pasta-abrir" aria-expanded={aberta} aria-label={`O que está em ${n.pasta.nome}`} title={aberta ? 'Fechar' : 'Abrir'}
            onClick={() => alternar(n.pasta.id)}><Icone nome={aberta ? 'abaixo' : 'direita'} tam={14} /></button>
          : <span className="pasta-abrir" aria-hidden="true" />}
        <button type="button" className="pasta-nome" aria-current={atual ? 'true' : undefined} onClick={() => aoEscolher(n.pasta.id)}>
          <Icone nome="pasta" tam={16} /><span>{n.pasta.nome}</span>
        </button>
        <MenuDaPasta pasta={n.pasta} acoes={acoes} />
      </div>
      {aberta && temDentro && <ul>{n.filhas.map(no)}{linhasDasAnotacoes(n.pasta.id, n.nivel + 1)}</ul>}
    </li>;
  };
  const ordenar = (o: Ordem) => { setMenuDaOrdem(null); anotacoes?.aoOrdenar(o); };
  // Com uma anotação aberta, o destaque é só dela: a pasta escolhida (ou "Todos os documentos") volta a se destacar ao fechá-la.
  const todos = !temAberta && escolhida === null;

  // Enquanto a anotação é arrastada, a linha do alto vira "Sem pasta": soltá-la ali a tira das pastas.
  const raiz = arrasto ? { icone: 'pasta' as const, nome: 'Sem pasta' } : { icone: 'documentos' as const, nome: 'Todos os documentos' };

  return <nav ref={arvoreRef} className={'pastas-arvore' + (arrasto ? ' arrastando' : '')} aria-label="Pastas e anotações">
    <div className="pastas-cabeca">
      {/* No explorador, só a barra (como no Obsidian): o título da página já diz onde se está. */}
      {!anotacoes && <span className="rotulo-caps">Pastas</span>}
      {navegacao && <button type="button" className="pasta-mais explorador-navegacao" aria-controls={idDaLista} aria-expanded={!navegacao.recolhida}
        aria-label={NOME_DA_NAVEGACAO[navegacao.recolhida ? 'recolhida' : 'aberta']} title={NOME_DA_NAVEGACAO[navegacao.recolhida ? 'recolhida' : 'aberta']}
        onClick={navegacao.aoAlternar}><Icone nome="navegacao" tam={ICONE_DA_BARRA} /></button>}
      <div className="explorador-barra" role="toolbar" aria-label="Explorador">
        {anotacoes && <Link className="pasta-mais" to={anotacoes.nova} aria-label="Nova anotação" title="Nova anotação"><Icone nome="novaAnotacao" tam={ICONE_DA_BARRA} /></Link>}
        <button type="button" className="pasta-mais" aria-label="Nova pasta" title="Nova pasta" onClick={() => void acoes.criar(null)}>
          <Icone nome={anotacoes ? 'novaPasta' : 'mais'} tam={ICONE_DA_BARRA} />
        </button>
        {anotacoes && <button type="button" className="pasta-mais" aria-label={`Ordenar: ${ORDENS[anotacoes.ordem]}`} title="Ordenar" aria-haspopup="menu"
          aria-expanded={!!menuDaOrdem} onClick={e => { const alvo = e.currentTarget; setMenuDaOrdem(m => m ? null : alvo); }}>
          <Icone nome="ordenar" tam={ICONE_DA_BARRA} />
        </button>}
        {anotacoes && <button type="button" className="pasta-mais" aria-label="Recolher tudo" title="Recolher tudo" disabled={!abertas.length} onClick={() => guardar([])}>
          <Icone nome="recolher" tam={ICONE_DA_BARRA} />
        </button>}
      </div>
    </div>
    {menuDaOrdem && anotacoes && <MenuFlutuante botao={menuDaOrdem} aoFechar={() => setMenuDaOrdem(null)}>
      {ORDENS_DO_EXPLORADOR.map(o => <button key={o} type="button" role="menuitemradio" aria-checked={o === anotacoes.ordem} onClick={() => ordenar(o)}>
        <Marca ligada={o === anotacoes.ordem} /> {ORDENS[o]}
      </button>)}
    </MenuFlutuante>}
    <ul className="pastas-lista" id={idDaLista}>
      <li><div className={recebe(todos ? 'pasta-linha atual' : 'pasta-linha', ALVO_SEM_PASTA)} style={comNivel(0)} {...{ [ATRIBUTO_DO_ALVO]: ALVO_SEM_PASTA }}>
        <span className="pasta-abrir" aria-hidden="true" />
        <button type="button" className="pasta-nome" aria-current={todos ? 'true' : undefined} onClick={() => aoEscolher(null)}>
          <Icone nome={raiz.icone} tam={16} /><span>{raiz.nome}</span>
        </button>
      </div></li>
      {arvore.map(no)}
      {linhasDasAnotacoes(null, 0)}
    </ul>
    {anotacoes?.lista === null && <Carregando />}
    {anotacoes?.lista && anotacoes.total !== undefined && anotacoes.total > anotacoes.lista.length && <Nota className="pastas-vazio">
      Mostrando {anotacoes.lista.length} de {anotacoes.total} anotações. Use a busca, no alto da página, ou a tabela de cada pasta, para achar as outras.
    </Nota>}
    {pastas !== null && !lista.length && !anotacoes?.lista?.length && <p className="pastas-vazio">Nenhuma pasta ainda. Use o botão de nova pasta, no alto, para criar a primeira.</p>}
    <FantasmaDoArrasto arrasto={arrasto}>{arrasto && anotacao(arrasto.id)?.titulo}</FantasmaDoArrasto>
  </nav>;
}

interface PropsDoCaminho {
  pastas: Pasta[] | null;
  /** A pasta da anotação (null: fora de qualquer pasta). */
  pastaId: string | null;
  /** Cada pedaço do caminho leva à página Documentos naquela pasta. Na anotação ainda por salvar, não (sair a perderia). */
  comLinks?: boolean;
  /** Quem pode mudar a pasta recebe a escolhida (null: fora de qualquer pasta). Sem isto, o caminho só se lê. */
  aoMudar?: (id: string | null) => void;
}

/**
 * O caminho da pasta, logo acima do título da anotação ("Escritório › POPs › Financeiro"), e, para quem pode mudar, o botão que
 * abre a escolha da pasta. Fora de qualquer pasta, quem pode mudar vê "Sem pasta"; quem só lê não vê nada. Com a anotação numa
 * pasta e as pastas ainda chegando, mostra que está carregando (e não "Sem pasta").
 */
export function CaminhoDaPasta({ pastas, pastaId, comLinks = false, aoMudar }: PropsDoCaminho) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  if (pastas === null && pastaId) return <div className="caminho-da-pasta"><Carregando>Carregando a pasta…</Carregando></div>;
  const lista = pastas ?? [];
  const caminho = caminhoDaPasta(lista, pastaId);
  if (!caminho.length && !aoMudar) return null;
  const escolher = (id: string | null) => { setBotao(null); if (id !== pastaId) aoMudar?.(id); };
  return <div className="caminho-da-pasta">
    {caminho.length > 0 && <nav aria-label="Pasta"><ol>
      {caminho.map(p => <li key={p.id}>{comLinks ? <Link to={enderecoDaPasta(p.id)}>{p.nome}</Link> : <span>{p.nome}</span>}</li>)}
    </ol></nav>}
    {aoMudar && <button type="button" className="caminho-mudar" aria-label="Escolher a pasta" title="Escolher a pasta" aria-haspopup="menu" aria-expanded={!!botao}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      {caminho.length ? <Icone nome="abaixo" tam={14} /> : <><Icone nome="pasta" tam={14} /><span>Sem pasta</span></>}
    </button>}
    {botao && <MenuFlutuante botao={botao} aoFechar={() => setBotao(null)}>
      <button type="button" role="menuitemradio" aria-checked={pastaId === null} onClick={() => escolher(null)}>
        <Marca ligada={pastaId === null} /> Sem pasta
      </button>
      {pastasEmOrdem(lista).map(n => <button key={n.pasta.id} type="button" role="menuitemradio" className="escolha-da-pasta" style={comNivel(n.nivel)}
        aria-checked={n.pasta.id === pastaId} aria-label={textoDoCaminho(lista, n.pasta.id)} onClick={() => escolher(n.pasta.id)}>
        <Marca ligada={n.pasta.id === pastaId} /><Icone nome="pasta" tam={15} /> {n.pasta.nome}
      </button>)}
      {!lista.length && <p className="pastas-vazio">Nenhuma pasta ainda. Crie as pastas na página Documentos.</p>}
    </MenuFlutuante>}
  </div>;
}
