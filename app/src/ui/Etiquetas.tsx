// Etiquetas do escritório na tela: o selo colorido (com o x para tirar), o filtro dos módulos e a seção do cartão, onde a
// pessoa aplica, cria, muda e exclui etiquetas. Todo módulo com quadro usa estas peças; a lista fica em etiquetasDoEscritorio.ts.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { SD, type Etiqueta, type ModuloComEtiquetas } from '../dados';
import { TAMANHO_ETIQUETA } from '../dados/limites';
import { CORES, CORES_DA_ETIQUETA, erroDaEtiqueta, etiquetasNaOrdem, nomeDaEtiqueta, podeMudarEtiqueta, textoDaEtiqueta, type CorDaEtiqueta } from '../regras/etiquetas';
import { falha, sinalizarMudanca } from './avisos';
import { Aviso, Campo, estiloBotao, Nota, propsDoCampo } from './base';
import { BotaoDuplo } from './Botoes';
import { buscarEtiquetas, lojaDeEtiquetas, procurarEtiquetas, useEtiquetas } from './etiquetasDoEscritorio';
import { Icone } from './Icone';
import { MenuFlutuante } from './Menu';
import type { Filtro } from './PaginaModulo';
import { useCtx } from './sessao';

export { lojaDeEtiquetas, useEtiquetas, useEtiquetasDaPagina } from './etiquetasDoEscritorio';

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
    try { await SD.etiquetaTirar(modulo, id, e.id); sinalizarMudanca(); } catch (err) { falha(err); }
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

/** Seção "Etiquetas" do cartão. */
export function SecaoEtiquetas({ modulo, id, somenteLer, aoMudar }: PropsSecao) {
  const etiquetas = useEtiquetas();
  const [ids, setIds] = useState<string[]>([]);
  const [botao, setBotao] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let vale = true;
    void buscarEtiquetas();
    SD.etiquetasDoCartao(modulo, id).then(l => { if (vale) setIds(l); }).catch(falha);
    return () => { vale = false; };
  }, [modulo, id]);

  async function marcar(e: Etiqueta, marcada: boolean) {
    try {
      if (marcada) await SD.etiquetaAplicar(modulo, id, e.id);
      else await SD.etiquetaTirar(modulo, id, e.id);
      setIds(l => marcada ? [...l, e.id] : l.filter(x => x !== e.id));
      aoMudar();
    } catch (err) { falha(err); }
  }

  const minhas = etiquetas.filter(e => ids.includes(e.id));
  return <section className="bloco">
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

function PainelEtiquetas({ etiquetas, ids, aoMarcar, aoMudar, aoCriar }: { etiquetas: Etiqueta[]; ids: string[]; aoMarcar: (e: Etiqueta, marcada: boolean) => void; aoMudar: () => void; aoCriar: (e: Etiqueta) => void }) {
  const ctx = useCtx();
  // O que o formulário está fazendo: criando (null) ou mudando uma etiqueta.
  const [mudando, setMudando] = useState<Etiqueta | null>(null);
  return <div className="etq-painel">
    {etiquetas.length > 0 && <ul className="etq-lista" aria-label="Etiquetas do escritório">{etiquetas.map(e => <li key={e.id}>
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
      {mudando && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão" aoConfirmar={excluir}><Icone nome="lixeira" tam={13} /> Excluir</BotaoDuplo>}
    </div>
  </form>;
}
