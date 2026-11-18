// Etiquetas do escritório na tela: o selo colorido (com o x para tirar), o filtro dos módulos e a seção do cartão, onde a
// pessoa aplica, cria, muda e exclui etiquetas. Todo módulo com quadro usa estas peças; a lista fica em etiquetasDoEscritorio.ts.
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { SD, type Etiqueta, type ModuloComEtiquetas } from '../dados';
import { TAMANHO_ETIQUETA } from '../dados/limites';
import { CORES, CORES_DA_ETIQUETA, erroDaEtiqueta, etiquetasNaOrdem, nomeDaEtiqueta, podeMudarEtiqueta, textoDaEtiqueta, type CorDaEtiqueta, etiquetasQueCombinam } from '../regras/etiquetas';
import { falha, feito, sinalizarMudanca, useMudancas } from './avisos';
import { Aviso, Campo, estiloBotao, Nota, propsDoCampo } from './base';
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

/** A etiqueta: com texto, uma pílula colorida; só de cor, uma faixa. Com aoTirar, mostra o x ao passar o mouse. */
export function SeloEtiqueta({ e, aoTirar }: { e: Pick<Etiqueta, 'cor' | 'texto'>; aoTirar?: () => void }) {
  const nome = nomeDaEtiqueta(e);
  const tirar = aoTirar && <button type="button" className="etiqueta-tirar" aria-label={`Tirar a etiqueta ${nome}`} title="Tirar a etiqueta"
    onClick={ev => { ev.stopPropagation(); aoTirar(); }} onKeyDown={ev => ev.stopPropagation()}>
    <Icone nome="fechar" tam={11} />
  </button>;
  const classes = `etiqueta cor-${e.cor}${aoTirar ? ' com-tirar' : ''}`;
  if (e.texto) return <span className={classes}>{e.texto}{tirar}</span>;
  return <span className={`${classes} so-cor`} title={nome}><span role="img" aria-label={nome} />{tirar}</span>;
}

/** As etiquetas de um cartão do quadro ou de uma linha da tabela, com o x para tirar (cartão arquivado: só mostra). */
export function EtiquetasDoItem({ etq, modulo, id, somenteLer }: { etq?: { etiqueta_id: string }[]; modulo: ModuloComEtiquetas; id: string; somenteLer?: boolean }) {
  const etiquetas = useEtiquetas();
  const carregada = lojaDeEtiquetas.usar() !== null;
  const ids = etq?.map(x => x.etiqueta_id) ?? [];
  const chave = ids.join();
  // Etiqueta que a lista não conhece: um colega acabou de criar.
  useEffect(() => { if (carregada && chave) procurarEtiquetas(chave.split(','), lojaDeEtiquetas.ler() ?? []); }, [carregada, chave]);
  async function tirar(e: Etiqueta) {
    try { await tirarEtiqueta(modulo, [id], e); } catch (err) { falha(err); }
  }
  const minhas = etiquetas.filter(e => ids.includes(e.id));
  return minhas.length ? <div className="etiquetas">{minhas.map(e => <SeloEtiqueta key={e.id} e={e} aoTirar={somenteLer ? undefined : () => tirar(e)} />)}</div> : null;
}

interface PropsSecao {
  modulo: ModuloComEtiquetas;
  id: string;
  /** Cartão arquivado: só mostra. */
  somenteLer?: boolean;
  /** A lista da página mostra as etiquetas: ela relê quando mudam. */
  aoMudar: () => void;
}

/**
 * As etiquetas de um cartão, lidas do banco, e o marcar e desmarcar de cada uma: a caixa muda na hora e, se o banco recusar,
 * volta como estava; tirar oferece desfazer. Usada pela seção "Etiquetas" dos cartões e pelo círculo da anotação (#342).
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

/** Seção "Etiquetas" do cartão. */
export function SecaoEtiquetas({ modulo, id, somenteLer, aoMudar }: PropsSecao) {
  const etiquetas = useEtiquetas();
  const { ids, marcar } = useEtiquetasDoCartao(modulo, id);
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const minhas = etiquetas.filter(e => ids.includes(e.id));
  return <section className="bloco separada">
    <h3><Icone nome="etiqueta" tam={14} />Etiquetas</h3>
    {minhas.length ? <div className="etiquetas">{minhas.map(e => <SeloEtiqueta key={e.id} e={e} aoTirar={somenteLer ? undefined : () => marcar(e, false)} />)}</div> : <Nota>Nenhuma etiqueta.</Nota>}
    {!somenteLer && <div><button type="button" className={estiloBotao({ forma: 'mini' })} aria-expanded={!!botao} onClick={ev => { const alvo = ev.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="etiqueta" tam={13} /> Escolher etiquetas
    </button></div>}
    {botao && <MenuFlutuante painel rotulo="Escolher etiquetas" botao={botao} aoFechar={() => setBotao(null)}>
      <PainelEtiquetas etiquetas={etiquetas} ids={ids} aoMarcar={marcar} aoMudar={aoMudar} aoCriar={e => marcar(e, true)} />
    </MenuFlutuante>}
  </section>;
}

/**
 * O anel do círculo das etiquetas: as cores das etiquetas aplicadas, em fatias iguais, na ordem da lista (sem etiqueta, o círculo
 * fica vazado). As cores são as variáveis da paleta (--etq-…, em estilo.css).
 */
export function anelDasEtiquetas(cores: CorDaEtiqueta[]): CSSProperties | undefined {
  if (!cores.length) return undefined;
  const fatia = 100 / cores.length;
  const partes = cores.map((c, i) => `var(--etq-${c}) ${i * fatia}% ${(i + 1) * fatia}%`);
  return { '--anel': `conic-gradient(${partes.join(', ')})` } as CSSProperties;
}

interface PropsDoCirculo {
  /** As etiquetas do cartão (os ids). */
  ids: string[];
  /** Marcar ou desmarcar uma etiqueta (no cartão, useEtiquetasDoCartao; na anotação ainda por salvar, a lista da tela). */
  aoMarcar: (e: Etiqueta, marcada: boolean) => void;
  /** Quem só lê vê as cores, mas não abre a escolha. */
  somenteLer?: boolean;
  /** Uma etiqueta mudou de cor ou de texto: a lista da página relê. */
  aoMudar?: () => void;
}

/**
 * O círculo à esquerda do título da anotação (#342): mostra as cores das etiquetas dela e abre ali mesmo a escolha de etiquetas
 * (a mesma dos outros cartões), onde também se cria uma etiqueta nova, que fica para todo o escritório.
 */
export function CirculoDeEtiquetas({ ids, aoMarcar, somenteLer, aoMudar = () => {} }: PropsDoCirculo) {
  const etiquetas = useEtiquetas();
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const minhas = etiquetas.filter(e => ids.includes(e.id));
  const estilo = anelDasEtiquetas(minhas.map(e => e.cor));
  const classe = minhas.length ? 'circulo-etiquetas com-etiquetas' : 'circulo-etiquetas';
  if (somenteLer) return <span className={classe} style={estilo} aria-hidden="true" />;
  return <>
    <button type="button" className={classe} style={estilo} aria-label="Escolher etiquetas" title="Etiquetas" aria-haspopup="dialog" aria-expanded={!!botao}
      onClick={ev => { const alvo = ev.currentTarget; setBotao(b => b ? null : alvo); }} />
    {botao && <MenuFlutuante painel rotulo="Escolher etiquetas" botao={botao} aoFechar={() => setBotao(null)}>
      <PainelEtiquetas etiquetas={etiquetas} ids={ids} aoMarcar={aoMarcar} aoMudar={aoMudar} aoCriar={e => aoMarcar(e, true)} />
    </MenuFlutuante>}
  </>;
}

/** As etiquetas do cartão em selos, logo abaixo do título (com o x para tirar, para quem pode mudar). Sem etiqueta, nada. */
export function SelosDasEtiquetas({ ids, aoTirar }: { ids: string[]; aoTirar?: (e: Etiqueta) => void }) {
  const etiquetas = useEtiquetas();
  const minhas = etiquetas.filter(e => ids.includes(e.id));
  return minhas.length ? <div className="etiquetas">{minhas.map(e => <SeloEtiqueta key={e.id} e={e} aoTirar={aoTirar && (() => aoTirar(e))} />)}</div> : null;
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
        </li>)}</ul> : <Nota>{etiquetas.length ? SEM_RESULTADO : 'Nenhuma etiqueta ainda. Crie a primeira na seção "Etiquetas" de um cartão.'}</Nota>}
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
