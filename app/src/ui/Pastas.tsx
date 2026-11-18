// Pastas dos documentos na tela (#342), como no Obsidian: a árvore ao lado da lista (abre e fecha cada pasta; cria, renomeia,
// move e apaga pelo ⋯ de cada uma), o seletor que toma o lugar dela quando a tela é estreita, o caminho acima do título da
// anotação ("Escritório › POPs › Financeiro", cada pedaço leva à pasta) e a escolha da pasta da anotação. As regras (árvore,
// caminho, nome, ciclo) ficam em regras/pastas.ts; a lista do escritório, em pastasDoEscritorio.ts.
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { SD, type Pasta } from '../dados';
import { TAMANHO_PASTA } from '../dados/limites';
import {
  arvoreDePastas, caminhoDaPasta, destinosDaPasta, enderecoDaPasta, erroAoMoverPasta, erroDoNomeDaPasta, pastasDescendentes, pastasEmOrdem,
  textoDoCaminho, type NoDaPasta
} from '../regras/pastas';
import { avisar, falha, feito } from './avisos';
import { Campo, Carregando } from './base';
import { Icone, type NomeIcone } from './Icone';
import { confirmar, janela, pedirTexto } from './janela';
import { MenuFlutuante } from './Menu';
import { buscarPastas } from './pastasDoEscritorio';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { useCtx } from './sessao';

/** O recuo de cada nível da árvore e da lista de escolha vem do CSS (--nivel). */
const comNivel = (nivel: number) => ({ '--nivel': nivel }) as CSSProperties;
/** Onde fica guardado, para cada pessoa, quais pastas da árvore ela deixou abertas. */
const PREFERENCIA_DAS_ABERTAS = 'documentos.pastas.abertas';
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

interface PropsDaArvore {
  /** As pastas do escritório (null: ainda chegando). */
  pastas: Pasta[] | null;
  /** A pasta escolhida (null: todos os documentos). */
  escolhida: string | null;
  aoEscolher: (id: string | null) => void;
}

/**
 * A árvore das pastas, ao lado da lista de documentos: "Todos os documentos" no alto e cada pasta com a seta que abre e fecha
 * as subpastas, o nome (que escolhe a pasta) e o ⋯. A pasta escolhida abre o caminho até ela. As abertas ficam guardadas para
 * cada pessoa. Em tela estreita, o CSS a esconde e mostra o SeletorDePasta no lugar.
 */
export function ArvoreDePastas({ pastas, escolhida, aoEscolher }: PropsDaArvore) {
  const lista = pastas ?? [];
  const acoes = useAcoesDasPastas(lista, escolhida, aoEscolher);
  const [abertas, setAbertas] = useState<string[]>(() => lerPreferencia<string[]>(PREFERENCIA_DAS_ABERTAS, []));
  // A pasta escolhida (pela árvore, pelo caminho do cartão ou pelo endereço) fica à vista e aberta, como a lista, que mostra também
  // as subpastas dela: ao ser escolhida, ela e as pastas acima dela abrem. Depois, a pessoa ainda pode fechá-las.
  const acima = caminhoDaPasta(lista, escolhida).map(p => p.id);
  const [abertasPara, setAbertasPara] = useState('');
  if (acima.join() !== abertasPara) {
    setAbertasPara(acima.join());
    const faltam = acima.filter(id => !abertas.includes(id));
    if (faltam.length) setAbertas([...abertas, ...faltam]);
  }
  function alternar(id: string) {
    const novas = abertas.includes(id) ? abertas.filter(x => x !== id) : [...abertas, id];
    setAbertas(novas);
    salvarPreferencia(PREFERENCIA_DAS_ABERTAS, novas);
  }
  const arvore = arvoreDePastas(lista);

  const no = (n: NoDaPasta<Pasta>) => {
    const aberta = abertas.includes(n.pasta.id), atual = n.pasta.id === escolhida;
    return <li key={n.pasta.id}>
      <div className={atual ? 'pasta-linha atual' : 'pasta-linha'} style={comNivel(n.nivel)}>
        {n.filhas.length > 0
          ? <button type="button" className="pasta-abrir" aria-expanded={aberta} aria-label={`Subpastas de ${n.pasta.nome}`} title={aberta ? 'Fechar' : 'Abrir'}
            onClick={() => alternar(n.pasta.id)}><Icone nome={aberta ? 'abaixo' : 'direita'} tam={14} /></button>
          : <span className="pasta-abrir" aria-hidden="true" />}
        <button type="button" className="pasta-nome" aria-current={atual ? 'true' : undefined} onClick={() => aoEscolher(n.pasta.id)}>
          <Icone nome="pasta" tam={16} /><span>{n.pasta.nome}</span>
        </button>
        <MenuDaPasta pasta={n.pasta} acoes={acoes} />
      </div>
      {aberta && n.filhas.length > 0 && <ul>{n.filhas.map(no)}</ul>}
    </li>;
  };

  return <nav className="pastas-arvore" aria-label="Pastas">
    <div className="pastas-cabeca">
      <span className="rotulo-caps">Pastas</span>
      <button type="button" className="pasta-mais" aria-label="Nova pasta" title="Nova pasta" onClick={() => void acoes.criar(null)}>
        <Icone nome="mais" tam={16} />
      </button>
    </div>
    <ul className="pastas-lista">
      <li><div className={escolhida === null ? 'pasta-linha atual' : 'pasta-linha'} style={comNivel(0)}>
        <span className="pasta-abrir" aria-hidden="true" />
        <button type="button" className="pasta-nome" aria-current={escolhida === null ? 'true' : undefined} onClick={() => aoEscolher(null)}>
          <Icone nome="documentos" tam={16} /><span>Todos os documentos</span>
        </button>
      </div></li>
      {arvore.map(no)}
    </ul>
    {pastas !== null && !lista.length && <p className="pastas-vazio">Nenhuma pasta ainda. Use o + para criar a primeira.</p>}
  </nav>;
}

/** No lugar da árvore, em tela estreita: a pasta num seletor acima da lista, com o + para criar e o ⋯ da pasta escolhida. */
export function SeletorDePasta({ pastas, escolhida, aoEscolher }: PropsDaArvore) {
  const lista = pastas ?? [];
  const acoes = useAcoesDasPastas(lista, escolhida, aoEscolher);
  const atual = lista.find(p => p.id === escolhida);
  return <div className="pastas-seletor">
    <label className="pastas-seletor-campo"><Icone nome="pasta" tam={16} /><span className="sr">Pasta</span>
      <select className="filtro" value={escolhida ?? TODAS} onChange={e => aoEscolher(e.target.value || null)}>
        <option value={TODAS}>Todos os documentos</option>
        {pastasEmOrdem(lista).map(n => <option key={n.pasta.id} value={n.pasta.id}>{textoDoCaminho(lista, n.pasta.id)}</option>)}
      </select>
    </label>
    <button type="button" className="pasta-mais" aria-label={atual ? `Nova subpasta em ${atual.nome}` : 'Nova pasta'} title={atual ? 'Nova subpasta' : 'Nova pasta'}
      onClick={() => void acoes.criar(atual?.id ?? null)}><Icone nome="mais" tam={16} /></button>
    {atual && <MenuDaPasta pasta={atual} acoes={acoes} />}
  </div>;
}

/** O sinal da escolha atual no menu (o lugar fica reservado nas outras, para os nomes ficarem alinhados). */
const Marca = ({ ligada }: { ligada: boolean }) => <span className="kmenu-marca">{ligada && <Icone nome="check" tam={15} />}</span>;

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
