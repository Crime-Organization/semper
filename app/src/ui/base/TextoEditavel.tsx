// Texto formatado que se muda no próprio lugar (#339), como numa nota do Obsidian: quem pode alterar clica no texto e ele vira
// a caixa de escrever (com a barra de formatação) ali mesmo, com Salvar e Cancelar logo abaixo. Ctrl+Enter salva. O clique num
// link ou numa caixinha de tarefa faz o que sempre fez (abre o link, marca a caixinha) e não abre a edição, nem o clique que
// termina escolhendo um trecho para copiar. Pelo teclado, o botão "Mudar o texto" abre a edição. Quem só lê vê o texto
// formatado, e nada vira campo. Peça comum: a #346 leva o mesmo jeito às descrições dos outros cartões.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { avisar, falha } from '../avisos';
import { Icone } from '../Icone';
import { estiloBotao } from './botao';
import { CaixaFormatada, TextoFormatado } from './TextoFormatado';

/** O que, dentro do texto, tem clique próprio: o clique nele não abre a edição. */
const COM_CLIQUE_PROPRIO = 'a, button, input, label, summary';
/** O tamanho do lápis do botão "Mudar o texto". */
const TAMANHO_DO_LAPIS = 13;

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
  texto, aoSalvar, aoMarcar, conferir, rotulo = 'Texto', maximo, placeholder, vazio, convite = 'Clique para escrever.', className, classeDaCaixa,
  aoMudarRascunho
}: Props) {
  const id = useId();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
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
    setTimeout(() => botao.current?.focus({ preventScroll: true }), 0);
  }
  /** Abre a edição pelo clique no texto, a não ser que o clique seja num link, numa caixinha ou ao escolher um trecho. */
  function clicar(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(COM_CLIQUE_PROPRIO)) return;
    if (window.getSelection()?.toString()) return;
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
  if (!texto.trim()) return <button ref={botao} type="button" className="texto-editavel-vazio" onClick={() => mudar(texto)}>{convite}</button>;
  return <div className="texto-editavel">
    {/* O clique no texto é só um atalho do mouse: pelo teclado, a edição abre pelo botão logo abaixo. */}
    <div className="texto-editavel-area" onClick={clicar}>
      <TextoFormatado className={className} texto={texto} aoMarcar={aoMarcar} />
    </div>
    <button ref={botao} type="button" className={estiloBotao({ forma: 'mini' }, 'texto-editavel-botao')} onClick={() => mudar(texto)}>
      <Icone nome="editar" tam={TAMANHO_DO_LAPIS} /> Mudar o texto
    </button>
  </div>;
}
