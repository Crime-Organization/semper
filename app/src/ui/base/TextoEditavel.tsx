// Texto formatado que se muda no próprio lugar (#339), como numa nota do Obsidian: quem pode alterar clica no texto e ele vira
// a caixa de escrever (com a barra de formatação) ali mesmo, com Salvar e Cancelar logo abaixo. Ctrl+Enter salva. O clique num
// link ou numa caixinha de tarefa faz o que sempre fez (abre o link, marca a caixinha) e não abre a edição, nem o clique que
// termina escolhendo um trecho para copiar. Pelo teclado (#385), o próprio texto recebe o foco com o Tab e Enter abre a edição;
// ao cancelar ou salvar, o foco volta a ele. Não há mais o botão "Mudar o texto" embaixo. O texto não vira um botão: ele tem links
// e caixinhas dentro, que continuam com o Tab e o Enter (ou o Espaço) deles. Quem só lê vê o texto formatado, e nada vira campo
// nem recebe o foco. Peça comum: desde a #346, também nas descrições dos cartões de tarefa e de demanda.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { avisar, falha } from '../avisos';
import { estiloBotao } from './botao';
import { CaixaFormatada, TextoFormatado } from './TextoFormatado';

/** O que, dentro do texto, tem clique próprio: o clique nele não abre a edição. */
const COM_CLIQUE_PROPRIO = 'a, button, input, label, summary';
/** O que o leitor de tela diz depois do nome do texto, para quem usa o teclado saber como mudá-lo. */
const COMO_MUDAR_PELO_TECLADO = 'Tecle Enter para mudar.';

interface Props {
  /** O texto gravado. */
  texto: string;
  /**
   * Quem pode alterar recebe o texto novo (só quando ele mudou). Sem isto, o texto só se lê. A edição fecha quando a gravação
   * termina; se ela devolver false (quem chama já avisou do problema) ou falhar (o erro aparece no pé da tela), a edição
   * continua aberta, com o que a pessoa escreveu.
   */
  aoSalvar?: (texto: string) => unknown;
  /** Marca e desmarca as caixinhas da lista de tarefas sem abrir a edição (veja TextoFormatado). */
  aoMarcar?: (texto: string) => void;
  /** O que o texto confere antes de salvar ('' = está certo). */
  conferir?: (texto: string) => string;
  /** O nome da caixa para o leitor de tela. */
  rotulo?: string;
  maximo?: number;
  /** A dica dentro da caixa vazia. */
  placeholder?: string;
  /** O que aparece no lugar do texto vazio, para quem só lê. */
  vazio?: ReactNode;
  /** O convite no lugar do texto vazio, para quem pode escrever. */
  convite?: string;
  /** A classe do texto formatado (ex.: a medida de leitura da anotação). */
  className?: string;
  /** A classe da caixa de escrever (ex.: a altura da caixa da anotação). */
  classeDaCaixa?: string;
  /** O que a pessoa está escrevendo, a cada tecla (null: fora da edição), para o cartão avisar ao sair sem salvar. */
  aoMudarRascunho?: (rascunho: string | null) => void;
}

export function TextoEditavel({
  texto, aoSalvar, aoMarcar, conferir, rotulo = 'Texto', maximo, placeholder, vazio, convite = 'Clique para escrever.', className,
  classeDaCaixa, aoMudarRascunho
}: Props) {
  const id = useId();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Onde a edição abriu (o texto ou o convite do texto vazio): o foco volta para lá ao fechar.
  const area = useRef<HTMLDivElement>(null);
  const botaoDoConvite = useRef<HTMLButtonElement>(null);
  const avisarRascunho = useRef(aoMudarRascunho);
  avisarRascunho.current = aoMudarRascunho;
  // Ao sair da tela no meio da edição, o cartão deixa de esperar este rascunho.
  useEffect(() => () => avisarRascunho.current?.(null), []);
  // Ao abrir a edição, o cursor vai para o fim do texto, como quem continua a escrever.
  const editando = rascunho !== null;
  useEffect(() => {
    const caixa = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!editando || !caixa) return;
    caixa.focus();
    caixa.setSelectionRange(caixa.value.length, caixa.value.length);
  }, [editando, id]);
  // Se a edição deixa de ser permitida no meio (a anotação foi arquivada, a pessoa perdeu a permissão), o rascunho fecha: não
  // fica nada por salvar que ela não vê, nem a caixa volta aberta com ele depois.
  const podeMudar = !!aoSalvar;
  useEffect(() => {
    if (podeMudar || !editando) return;
    setRascunho(null);
    avisarRascunho.current?.(null);
  }, [podeMudar, editando]);

  if (!aoSalvar) return texto.trim() ? <TextoFormatado className={className} texto={texto} /> : <>{vazio}</>;

  function mudar(novo: string | null) {
    setRascunho(novo);
    avisarRascunho.current?.(novo);
  }
  function fechar() {
    mudar(null);
    // O foco volta para onde a edição abriu: o teclado não se perde.
    setTimeout(() => (area.current ?? botaoDoConvite.current)?.focus({ preventScroll: true }), 0);
  }
  /** Abre a edição pelo clique no texto, a não ser que o clique seja num link, numa caixinha ou ao escolher um trecho. */
  function clicar(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(COM_CLIQUE_PROPRIO)) return;
    if (window.getSelection()?.toString()) return;
    mudar(texto);
  }
  /** Pelo teclado, Enter no próprio texto abre a edição; Enter num link ou numa caixinha de dentro faz o que sempre fez. */
  function teclarNoTexto(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
    e.preventDefault();
    mudar(texto);
  }
  async function salvar() {
    if (rascunho === null || ocupado) return;
    if (rascunho === texto) { fechar(); return; }
    const erro = conferir?.(rascunho);
    if (erro) { avisar(erro, 'erro'); return; }
    setOcupado(true);
    try {
      if (await aoSalvar!(rascunho) !== false) fechar();
    } catch (e) {
      falha(e);
    } finally {
      setOcupado(false);
    }
  }
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void salvar(); return; }
    if (e.key !== 'Escape') return;
    // Esc nunca fecha o cartão em volta com o texto aberto. Sem mudança, fecha a edição; com mudança, nada se perde por engano:
    // a pessoa escolhe entre Salvar e Cancelar.
    e.preventDefault();
    e.stopPropagation();
    if (rascunho === texto) fechar();
  }

  if (editando) return <div className="texto-editavel-edicao" onKeyDown={teclar}>
    <CaixaFormatada id={id} aria-label={rotulo} className={['texto-editavel-caixa', classeDaCaixa].filter(Boolean).join(' ')} maxLength={maximo} placeholder={placeholder} valor={rascunho} aoMudar={mudar} />
    <div className="texto-editavel-acoes">
      <span className="texto-editavel-atalho" aria-hidden="true">Ctrl+Enter salva</span>
      <button type="button" className={estiloBotao({ pequeno: true })} disabled={ocupado} onClick={fechar}>Cancelar</button>
      <button type="button" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado} onClick={() => void salvar()}>
        {ocupado ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  </div>;

  // Sem texto, o convite já é o botão que abre a edição.
  if (!texto.trim()) return <button ref={botaoDoConvite} type="button" className="texto-editavel-vazio" onClick={() => mudar(texto)}>{convite}</button>;
  // O texto é um grupo com nome (o rótulo, ex.: "Descrição") que recebe o foco, e o leitor de tela diz como mudá-lo. Não é um
  // botão: os links e as caixinhas de dentro sumiriam para o leitor de tela e deixariam de ser alcançados pelo Tab.
  return <div className="texto-editavel">
    <div ref={area} className="texto-editavel-area" role="group" aria-label={rotulo} aria-describedby={id + '-como-mudar'} tabIndex={0}
      onClick={clicar} onKeyDown={teclarNoTexto}>
      <TextoFormatado className={className} texto={texto} aoMarcar={aoMarcar} />
    </div>
    <span className="sr" id={id + '-como-mudar'}>{COMO_MUDAR_PELO_TECLADO}</span>
  </div>;
}
