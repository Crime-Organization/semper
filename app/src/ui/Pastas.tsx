// Pastas dos documentos na tela (#342), como no Obsidian: a árvore à esquerda (abre e fecha cada pasta; cria, renomeia, move e
// apaga pelo ⋯ de cada uma), que desde o pedido de 18/11 é o explorador, com as anotações dentro das pastas (no celular, numa
// gaveta); o caminho no topo da anotação ("Escritório › POPs › Financeiro", cada pedaço leva à pasta) e a escolha da pasta da anotação. As regras (árvore,
// caminho, nome, ciclo) ficam em regras/pastas.ts; a lista do escritório, em pastasDoEscritorio.ts.
import { useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { SD, type Ordem, type Pasta } from '../dados';
import { TAMANHO_PASTA } from '../dados/limites';
import {
  arvoreDePastas, caminhoDaPasta, destinosDaPasta, enderecoDaPasta, erroAoMoverPasta, erroDoNomeDaPasta, pastasDescendentes, pastasEmOrdem,
  textoDoCaminho, type NoDaPasta
} from '../regras/pastas';
import { anotacoesPorPasta, ORDENS_DO_EXPLORADOR, pastasParaMostrar, type AnotacaoDoExplorador } from '../regras/explorador';
import { avisar, falha, feito } from './avisos';
import { Campo, Carregando, Nota } from './base';
import { Icone, type NomeIcone } from './Icone';
import { confirmar, janela, pedirTexto } from './janela';
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
/** O id do campo da pasta de destino, na janela de mover. */
const DESTINO = 'pasta-destino';

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
    const destinos = destinosDaPasta(pastas, p.id);
    const destino = await janela<string>({
      titulo: `Mover a pasta "${p.nome}"`,
      corpo: <Campo rotulo="Para dentro de" para={DESTINO}>
        <select id={DESTINO} name="destino" className="campo" defaultValue={p.pasta_mae_id ?? TODAS}>
          <option value={TODAS}>Nenhuma (primeiro nível)</option>
          {destinos.map(n => <option key={n.pasta.id} value={n.pasta.id}>{textoDoCaminho(pastas, n.pasta.id)}</option>)}
        </select>
      </Campo>,
      acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Mover', tipo: 'pri', valor: campos => String(campos.get('destino') ?? TODAS) }]
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
  const porPasta = anotacoesPorPasta(anotacoes?.lista ?? [], lista);
  const temAberta = !!anotacoes?.aberta;

  const linhasDasAnotacoes = (pastaId: string | null, nivel: number) => anotacoes && (porPasta.get(pastaId) ?? []).map(a => {
    const atual = a.id === anotacoes.aberta;
    return <li key={'a-' + a.id}>
      <Link className={atual ? 'explorador-anotacao atual' : 'explorador-anotacao'} style={comNivel(nivel)} to={anotacoes.endereco(a.id)} replace
        aria-current={atual ? 'page' : undefined}><span>{a.titulo}</span></Link>
    </li>;
  });
  const no = (n: NoDaPasta<Pasta>) => {
    const temDentro = n.filhas.length > 0 || (porPasta.get(n.pasta.id)?.length ?? 0) > 0;
    const aberta = abertas.includes(n.pasta.id), atual = !temAberta && n.pasta.id === escolhida;
    return <li key={n.pasta.id}>
      <div className={atual ? 'pasta-linha atual' : 'pasta-linha'} style={comNivel(n.nivel)}>
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

  return <nav className="pastas-arvore" aria-label="Pastas e anotações">
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
      <li><div className={todos ? 'pasta-linha atual' : 'pasta-linha'} style={comNivel(0)}>
        <span className="pasta-abrir" aria-hidden="true" />
        <button type="button" className="pasta-nome" aria-current={todos ? 'true' : undefined} onClick={() => aoEscolher(null)}>
          <Icone nome="documentos" tam={16} /><span>Todos os documentos</span>
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
