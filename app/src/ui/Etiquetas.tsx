// Etiquetas do escritório na tela: o selo colorido (com o "x" para tirar, que pergunta antes, #424), o filtro dos módulos e, no topo dos cartões, o botão que
// abre a escolha (BotaoDasEtiquetas, o ícone de etiqueta), onde a pessoa aplica, cria, muda e exclui etiquetas, e os selos
// (SelosDasEtiquetas, entre o topo e o título). Todo módulo com quadro usa estas peças (os cartões, por ui/TopoDoCartao.tsx, #382;
// a anotação, direto); a lista fica em etiquetasDoEscritorio.ts.
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SD, type Etiqueta, type ModuloComEtiquetas } from '../dados';
import { TAMANHO_ETIQUETA } from '../dados/limites';
import { CORES, CORES_DA_ETIQUETA, erroDaEtiqueta, etiquetasNaOrdem, nomeDaEtiqueta, podeMudarEtiqueta, textoDaEtiqueta, type CorDaEtiqueta, etiquetasQueCombinam } from '../regras/etiquetas';
import { falha, feito, sinalizarMudanca, useMudancas } from './avisos';
import { Aviso, BotaoTirar, Campo, estiloBotao, Nota, propsDaDica, propsDoCampo } from './base';
import { BotaoDuplo } from './Botoes';
import { buscarEtiquetas, lojaDeEtiquetas, procurarEtiquetas, useEtiquetas } from './etiquetasDoEscritorio';
import { Icone } from './Icone';
import { MenuFlutuante } from './Menu';
import type { Filtro } from './PaginaModulo';
import { useCtx } from './sessao';

export { lojaDeEtiquetas, useEtiquetas, useEtiquetasDaPagina } from './etiquetasDoEscritorio';

const emCartoes = (n: number) => n === 1 ? '1 cartão' : `${n} cartões`;

/** Os cartões da lista que têm (ou não têm) a etiqueta. */
async function separarPelaEtiqueta(modulo: ModuloComEtiquetas, ids: string[], etiquetaId: string) {
  const dela = await Promise.all(ids.map(async id => (await SD.etiquetasDoCartao(modulo, id)).includes(etiquetaId)));
  return { com: ids.filter((_, i) => dela[i]), sem: ids.filter((_, i) => !dela[i]) };
}

/** Tira a etiqueta dos cartões, oferecendo desfazer. "Incompleta" zera as pendências: o desfazer devolve o motivo original de cada pessoa. */
async function tirarEtiqueta(modulo: ModuloComEtiquetas, ids: string[], e: Etiqueta) {
  const { com } = await separarPelaEtiqueta(modulo, ids, e.id);
  const zeraPendencias = modulo === 'pessoas' && e.sistema === 'incompleta';
  const pessoas = zeraPendencias ? await Promise.all(com.map(id => SD.pessoaObter(id))) : [];
  await SD.etiquetaTirarEmLote(modulo, ids, e.id);
  feito(`Etiqueta "${nomeDaEtiqueta(e)}" tirada de ${emCartoes(com.length)}.`, 'retirada da etiqueta', async () => {
    await Promise.all(pessoas.flatMap(p => p ? [SD.pessoaAtualizar(p.id, { pendencias: p.pendencias })] : []));
    await SD.etiquetaAplicarEmLote(modulo, com, e.id);
  });
  sinalizarMudanca();
}

/** Aplica a etiqueta nos cartões selecionados, oferecendo desfazer só nos que ainda não a tinham. */
async function aplicarEtiqueta(modulo: ModuloComEtiquetas, ids: string[], e: Etiqueta) {
  const { sem } = await separarPelaEtiqueta(modulo, ids, e.id);
  await SD.etiquetaAplicarEmLote(modulo, ids, e.id);
  feito(`Etiqueta "${nomeDaEtiqueta(e)}" aplicada em ${emCartoes(sem.length)}.`, 'aplicação da etiqueta', () => SD.etiquetaTirarEmLote(modulo, sem, e.id));
  sinalizarMudanca();
}

/** O filtro por etiqueta da página de módulo (some enquanto o escritório não tem etiquetas). */
export function filtroDeEtiqueta(etiquetas: Etiqueta[], valor: string | undefined, aoMudar: (etiqueta: string) => void): Filtro[] {
  if (!etiquetas.length) return [];
  return [{ id: 'etiqueta', rotulo: 'Etiqueta', valor: valor || '', aoMudar, opcoes: [['', 'Todas'], ...etiquetas.map(e => [e.id, nomeDaEtiqueta(e)] as [string, string])] }];
}

/** O que a janela do "x" da etiqueta explica (#424). */
export const EXPLICACAO_DO_TIRAR_ETIQUETA = 'A etiqueta continua no escritório: só sai deste cartão. Dá para desfazer logo depois, no aviso do pé da tela.';

/**
 * A etiqueta: com texto, uma pílula colorida; só de cor, uma faixa. Com aoTirar, mostra o "x" ao passar o mouse (a peça comum de
 * tirar, #424, que pergunta antes).
 */
export function SeloEtiqueta({ e, aoTirar }: { e: Pick<Etiqueta, 'cor' | 'texto'>; aoTirar?: () => unknown }) {
  const nome = nomeDaEtiqueta(e);
  const tirar = aoTirar && <BotaoTirar forma="etiqueta" pode oQue={`a etiqueta ${nome}`} explicacao={EXPLICACAO_DO_TIRAR_ETIQUETA} aoTirar={aoTirar} />;
  const classes = `etiqueta cor-${e.cor}${aoTirar ? ' com-tirar' : ''}`;
  if (e.texto) return <span className={classes}>{e.texto}{tirar}</span>;
  return <span className={`${classes} so-cor`} title={nome}><span role="img" aria-label={nome} />{tirar}</span>;
}

/** As etiquetas de um cartão do quadro ou de uma linha da tabela, com o x para tirar (cartão arquivado: só mostra). */
export function EtiquetasDoItem({ etq, modulo, id, somenteLer }: { etq?: { etiqueta_id: string }[]; modulo: ModuloComEtiquetas; id: string; somenteLer?: boolean }) {
  const carregada = lojaDeEtiquetas.usar() !== null;
  const ids = etq?.map(x => x.etiqueta_id) ?? [];
  const chave = ids.join();
  // Etiqueta que a lista não conhece: um colega acabou de criar.
  useEffect(() => { if (carregada && chave) procurarEtiquetas(chave.split(','), lojaDeEtiquetas.ler() ?? []); }, [carregada, chave]);
  async function tirar(e: Etiqueta) {
    try { await tirarEtiqueta(modulo, [id], e); } catch (err) { falha(err); }
  }
  return <SelosDasEtiquetas ids={ids} aoTirar={somenteLer ? undefined : tirar} />;
}

interface PropsDosSelos {
  /** As etiquetas do cartão (os ids). */
  ids: string[];
  /** Tira a etiqueta (o x de cada selo). Sem isto, os selos só aparecem. */
  aoTirar?: (e: Etiqueta) => void;
  /** O nome da linha para o leitor de tela (no topo dos cartões, "Etiquetas"). Sem isto, é só a linha dos selos. */
  rotulo?: string;
}

/** Os selos coloridos das etiquetas do cartão, numa linha, cada um com o x para tirar. Sem etiquetas, nada aparece. */
export function SelosDasEtiquetas({ ids, aoTirar, rotulo }: PropsDosSelos) {
  const minhas = useEtiquetas().filter(e => ids.includes(e.id));
  if (!minhas.length) return null;
  return <div className="etiquetas" role={rotulo ? 'group' : undefined} aria-label={rotulo}>
    {minhas.map(e => <SeloEtiqueta key={e.id} e={e} aoTirar={aoTirar && (() => aoTirar(e))} />)}
  </div>;
}

/**
 * As etiquetas de um cartão, lidas do banco, e o marcar e desmarcar de cada uma: a caixa muda na hora e, se o banco recusar,
 * volta como estava; tirar oferece desfazer. Usada pelo topo dos cartões e da anotação.
 */
export function useEtiquetasDoCartao(modulo: ModuloComEtiquetas, id: string) {
  const [ids, setIds] = useState<string[]>([]);
  // Lê de novo quando algo muda fora daqui (ex.: "Marcar como conferido" tira "Incompleta").
  const [versao, setVersao] = useState(0);
  useMudancas(() => setVersao(v => v + 1));

  useEffect(() => { void buscarEtiquetas(); }, [modulo, id]);
  // Só a leitura mais nova vale, e a pessoa agir descarta a que está a caminho (ela traria o estado de antes).
  const leitura = useRef(0);
  useEffect(() => {
    // Sem id (a anotação nova, que ainda não foi ao banco, #369), não há o que ler.
    if (!id) return;
    const esta = ++leitura.current;
    SD.etiquetasDoCartao(modulo, id).then(l => { if (esta === leitura.current) setIds(l); }).catch(falha);
  }, [modulo, id, versao]);

  async function marcar(e: Etiqueta, marcada: boolean) {
    leitura.current++;
    // A caixa muda na hora; se o banco recusar, volta como estava.
    const trocar = (ligada: boolean) => setIds(l => ligada ? [...l, e.id] : l.filter(x => x !== e.id));
    trocar(marcada);
    try {
      // A página relê a lista, e o cartão também: em Pessoas, a etiqueta "Incompleta" anda junto com as pendências.
      if (marcada) { await SD.etiquetaAplicar(modulo, id, e.id); sinalizarMudanca(); }
      else await tirarEtiqueta(modulo, [id], e);
    } catch (err) { trocar(!marcada); falha(err); }
  }
  return { ids, marcar };
}

interface PropsDaEscolha {
  /** As etiquetas do cartão (os ids). */
  ids: string[];
  /** Marcar ou desmarcar uma etiqueta (no cartão, useEtiquetasDoCartao; na anotação ainda por salvar, a lista da tela). */
  aoMarcar: (e: Etiqueta, marcada: boolean) => void;
  /** Uma etiqueta mudou de cor ou de texto: a lista da página relê. */
  aoMudar?: () => void;
}

interface PropsDoBotao extends PropsDaEscolha {
  /** O nome do botão para o leitor de tela, que também aparece ao passar o mouse. */
  rotulo: string;
  className: string;
  /** O nome aparece na dica do sistema ([data-dica], como nas bolinhas da equipe), e não na do navegador. */
  comDica?: boolean;
  /** O que aparece no botão: o ícone de etiqueta. */
  children: ReactNode;
}

/**
 * O botão que abre, ali mesmo, a escolha das etiquetas (onde também se cria uma etiqueta nova, para todo o escritório): o ícone de
 * etiqueta no topo dos cartões e da anotação. Clicar de novo fecha.
 */
export function BotaoDasEtiquetas({ ids, aoMarcar, aoMudar = () => {}, rotulo, className, comDica = false, children }: PropsDoBotao) {
  const etiquetas = useEtiquetas();
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" className={className} aria-label={rotulo} {...(comDica ? propsDaDica(rotulo) : { title: rotulo })}
      aria-haspopup="dialog" aria-expanded={!!botao} onClick={ev => { const alvo = ev.currentTarget; setBotao(b => b ? null : alvo); }}>
      {children}
    </button>
    {botao && <MenuFlutuante painel rotulo="Escolher etiquetas" botao={botao} aoFechar={() => setBotao(null)}>
      <PainelEtiquetas etiquetas={etiquetas} ids={ids} aoMarcar={aoMarcar} aoMudar={aoMudar} aoCriar={e => aoMarcar(e, true)} />
    </MenuFlutuante>}
  </>;
}

const SEM_RESULTADO = 'Nenhuma etiqueta combina com essa pesquisa.';
/** O campo que pesquisa as etiquetas já criadas, acima da lista. */
function BuscaDeEtiquetas({ termo, aoMudar }: { termo: string; aoMudar: (termo: string) => void }) {
  return <input type="search" className="campo" aria-label="Pesquisar etiquetas" placeholder="Pesquisar etiquetas…" value={termo} onChange={ev => aoMudar(ev.target.value)} />;
}

/** Na barra de ações em lote: aplica ou tira uma etiqueta de todos os cartões selecionados. */
export function EtiquetasEmLote({ modulo, ids }: { modulo: ModuloComEtiquetas; ids: string[] }) {
  const etiquetas = useEtiquetas();
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const [termo, setTermo] = useState('');
  const achadas = etiquetasQueCombinam(etiquetas, termo);

  // Ao fechar, a pesquisa volta a ficar em branco, como no painel do cartão.
  const fechar = () => { setBotao(null); setTermo(''); };

  async function agir(e: Etiqueta, aplicar: boolean) {
    fechar();
    try { await (aplicar ? aplicarEtiqueta : tirarEtiqueta)(modulo, ids, e); } catch (err) { falha(err); }
  }

  return <>
    <button type="button" className={estiloBotao({ forma: 'mini' })} aria-expanded={!!botao} onClick={ev => { const alvo = ev.currentTarget; setTermo(''); setBotao(b => b ? null : alvo); }}>
      <Icone nome="etiqueta" tam={15} /> Etiquetas
    </button>
    {botao && <MenuFlutuante painel rotulo="Etiquetas dos selecionados" botao={botao} aoFechar={fechar}>
      <div className="etq-painel">
        <p className="rotulo-caps etq-lote-titulo">{emCartoes(ids.length)} {ids.length === 1 ? 'selecionado' : 'selecionados'}</p>
        {etiquetas.length > 0 && <BuscaDeEtiquetas termo={termo} aoMudar={setTermo} />}
        {achadas.length ? <ul className="etq-lista" aria-label="Etiquetas do escritório">{achadas.map(e => <li key={e.id}>
          <span className="etq-opcao"><SeloEtiqueta e={e} /></span>
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Aplicar a etiqueta ${nomeDaEtiqueta(e)}`} onClick={() => agir(e, true)}>Aplicar</button>
          <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Tirar a etiqueta ${nomeDaEtiqueta(e)}`} onClick={() => agir(e, false)}>Tirar</button>
        </li>)}</ul> : <Nota>{etiquetas.length ? SEM_RESULTADO : 'Nenhuma etiqueta ainda. Crie a primeira pelo ícone de etiqueta no topo de um cartão.'}</Nota>}
      </div>
    </MenuFlutuante>}
  </>;
}

function PainelEtiquetas({ etiquetas, ids, aoMarcar, aoMudar, aoCriar }: { etiquetas: Etiqueta[]; ids: string[]; aoMarcar: (e: Etiqueta, marcada: boolean) => void; aoMudar: () => void; aoCriar: (e: Etiqueta) => void }) {
  const ctx = useCtx();
  // O que o formulário está fazendo: criando (null) ou mudando uma etiqueta.
  const [mudando, setMudando] = useState<Etiqueta | null>(null);
  const [termo, setTermo] = useState('');
  const achadas = etiquetasQueCombinam(etiquetas, termo);
  return <div className="etq-painel">
    {etiquetas.length > 0 && <BuscaDeEtiquetas termo={termo} aoMudar={setTermo} />}
    {etiquetas.length > 0 && !achadas.length && <Nota>{SEM_RESULTADO}</Nota>}
    {achadas.length > 0 && <ul className="etq-lista" aria-label="Etiquetas do escritório">{achadas.map(e => <li key={e.id}>
      <label className="etq-opcao">
        <input type="checkbox" className="marca" aria-label={nomeDaEtiqueta(e)} checked={ids.includes(e.id)} onChange={ev => aoMarcar(e, ev.target.checked)} />
        <SeloEtiqueta e={e} />
      </label>
      {podeMudarEtiqueta(e, ctx.perfil.id, ctx.ehAdmin) && <button type="button" className="coluna-menu" aria-label={`Mudar a etiqueta ${nomeDaEtiqueta(e)}`} onClick={() => setMudando(e)}>
        <Icone nome="editar" tam={14} />
      </button>}
    </li>)}</ul>}
    <FormEtiqueta key={mudando?.id ?? 'nova'} etiquetas={etiquetas} mudando={mudando} aoCriar={aoCriar} aoMudar={aoMudar} aoTerminar={() => setMudando(null)} />
  </div>;
}

interface PropsForm {
  etiquetas: Etiqueta[];
  mudando: Etiqueta | null;
  aoCriar: (e: Etiqueta) => void;
  aoMudar: () => void;
  aoTerminar: () => void;
}

function FormEtiqueta({ etiquetas, mudando, aoCriar, aoMudar, aoTerminar }: PropsForm) {
  const idTexto = useId();
  const [texto, setTexto] = useState(mudando?.texto ?? '');
  const [cor, setCor] = useState<CorDaEtiqueta>(mudando?.cor ?? CORES[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const dados = { cor, texto: textoDaEtiqueta(texto) };
    const problema = erroDaEtiqueta(dados, etiquetas, mudando?.id);
    if (problema) { setErro(problema); return; }
    setOcupado(true);
    try {
      if (mudando) {
        await SD.etiquetaAtualizar(mudando.id, dados);
        lojaDeEtiquetas.mudar(l => etiquetasNaOrdem((l ?? []).map(e => e.id === mudando.id ? { ...e, ...dados } : e)));
        aoMudar();
      } else {
        const nova = await SD.etiquetaCriar(dados.cor, dados.texto);
        lojaDeEtiquetas.mudar(l => etiquetasNaOrdem([...(l ?? []), nova]));
        aoCriar(nova);
        setTexto(''); setErro(null);
      }
      aoTerminar();
    } catch (err) { setErro((err as Error).message); }
    setOcupado(false);
  }

  async function excluir() {
    if (!mudando) return;
    try {
      await SD.etiquetaExcluir(mudando.id);
      lojaDeEtiquetas.mudar(l => (l ?? []).filter(e => e.id !== mudando.id));
      aoMudar();
      aoTerminar();
    } catch (err) { setErro((err as Error).message); }
  }

  return <form className="etq-form" noValidate onSubmit={salvar} aria-label={mudando ? `Mudar a etiqueta ${nomeDaEtiqueta(mudando)}` : 'Nova etiqueta'}>
    <p className="rotulo-caps">{mudando ? 'Mudar a etiqueta' : 'Nova etiqueta'}</p>
    <Campo rotulo="Texto" para={idTexto} dica="Opcional: sem texto, ela aparece como uma faixa colorida.">
      <input type="text" {...propsDoCampo(idTexto, { dica: true })} className="campo" maxLength={TAMANHO_ETIQUETA} value={texto} onChange={e => { setTexto(e.target.value); setErro(null); }} />
    </Campo>
    <div className="etq-cores" role="radiogroup" aria-label="Cor da etiqueta">
      {CORES.map(c => <label key={c} className={`etq-cor cor-${c}`} title={CORES_DA_ETIQUETA[c]}>
        <input type="radio" name={`${idTexto}-cor`} aria-label={CORES_DA_ETIQUETA[c]} checked={cor === c} onChange={() => { setCor(c); setErro(null); }} />
      </label>)}
    </div>
    {erro && <Aviso tipo="erro">{erro}</Aviso>}
    <div className="etq-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado}>{mudando ? 'Salvar etiqueta' : 'Criar etiqueta'}</button>
      {mudando && <button type="button" className={estiloBotao({ pequeno: true })} onClick={aoTerminar}>Cancelar</button>}
      {mudando && !mudando.sistema && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão" aoConfirmar={excluir}><Icone nome="lixeira" tam={13} /> Excluir</BotaoDuplo>}
    </div>
  </form>;
}
