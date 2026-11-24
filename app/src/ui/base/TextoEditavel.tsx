// Texto formatado que se muda no próprio lugar (#339), como numa nota do Obsidian: quem pode alterar clica no texto e escreve ali
// mesmo. Desde a #433, a edição é a do texto das anotações em Documentos: o editor ao vivo (EditorAoVivo), sem caixa nem borda, com
// a formatação à vista enquanto se escreve e a mesma barra de formatação no alto; o cursor começa onde a pessoa clicou. Salvar e
// Cancelar logo abaixo; Ctrl+Enter (ou Ctrl+S, como na anotação) salva; Esc e Cancelar cancelam e, com algo mudado, perguntam antes
// de descartar. Como na anotação, a barra de formatação está sempre ali, discreta, também no texto lido (para quem pode mudar): ao
// clicar, o texto não sai do lugar, e o botão apertado na barra do texto lido abre a edição e já vale nela. Sem texto, a dica fica
// no lugar do texto, na letra e na cor da dica da anotação, sem caixa nem borda.
// O clique num link ou numa caixinha de tarefa faz o que sempre fez (abre o link, marca a caixinha) e não abre a edição, nem o
// clique que termina escolhendo um trecho para copiar. Pelo teclado (#385), o próprio texto recebe o foco com o Tab e Enter abre a
// edição, com o cursor no fim; ao cancelar ou salvar, o foco volta a ele. O texto não vira um botão: ele tem links e caixinhas
// dentro, que continuam com o Tab e o Enter (ou o Espaço) deles. Quem só lê vê o texto formatado, e nada vira campo nem recebe o
// foco. Peça comum: desde a #346, nas descrições dos cartões de tarefa e de demanda.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { avisar, falha } from '../avisos';
import { confirmar } from '../janela';
import { estiloBotao } from './botao';
import { EditorAoVivo, prepararEditorAoVivo, type ComecoDoCursor } from './EditorAoVivo';
import { barraDeFormatacao, TextoFormatado } from './TextoFormatado';

/** O que, dentro do texto, tem clique próprio: o clique nele não abre a edição. */
const COM_CLIQUE_PROPRIO = 'a, button, input, label, summary';
/** O que o leitor de tela diz depois do nome do texto, para quem usa o teclado saber como mudá-lo. */
const COMO_MUDAR_PELO_TECLADO = 'Tecle Enter para mudar.';
/** As teclas que, com o Ctrl (ou o Cmd), salvam: o Enter de sempre e o S da anotação. */
const SALVA_COM_CTRL = new Set(['enter', 's']);
/** A dica no editor aberto com o texto vazio, no lugar da dica do texto lido. */
const DICA_AO_ESCREVER = 'Escreva aqui.';

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
  /** A dica no editor aberto com o texto vazio. */
  placeholder?: string;
  /** O que aparece no lugar do texto vazio, para quem só lê. */
  vazio?: ReactNode;
  /** A dica no lugar do texto vazio, para quem pode escrever (é ela que abre a edição). */
  convite?: string;
  /** A classe do texto formatado (ex.: a medida de leitura da anotação). */
  className?: string;
  /** O que a pessoa está escrevendo, a cada tecla (null: fora da edição), para o cartão avisar ao sair sem salvar. */
  aoMudarRascunho?: (rascunho: string | null) => void;
}

export function TextoEditavel({
  texto, aoSalvar, aoMarcar, conferir, rotulo = 'Texto', maximo, placeholder = DICA_AO_ESCREVER, vazio, convite = 'Clique para escrever.', className,
  aoMudarRascunho
}: Props) {
  const id = useId();
  const [rascunho, setRascunho] = useState<string | null>(null);
  /** Onde o cursor começa ao abrir: no ponto clicado do texto, ou no fim (pelo teclado e no texto vazio). */
  const [comeco, setComeco] = useState<ComecoDoCursor>('fim');
  /** O botão da barra que a pessoa apertou no texto lido: o editor o aperta assim que aparece. */
  const [botaoAoChegar, setBotaoAoChegar] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  // Onde a edição abriu (o texto ou o convite do texto vazio): o foco volta para lá ao fechar.
  const area = useRef<HTMLDivElement>(null);
  const botaoDoConvite = useRef<HTMLButtonElement>(null);
  const avisarRascunho = useRef(aoMudarRascunho);
  avisarRascunho.current = aoMudarRascunho;
  // Ao sair da tela no meio da edição, o cartão deixa de esperar este rascunho.
  useEffect(() => () => avisarRascunho.current?.(null), []);
  const editando = rascunho !== null;
  // A barra do texto lido: só se mostra (fora do Tab e do leitor de tela, sem caixa para mudar); o clique num botão dela abre a
  // edição (veja apertarNaLeitura).
  const barraDaLeitura = barraDeFormatacao({ escolha: () => null, trocar: () => undefined, focar: () => undefined, soParaVer: true }).barra;
  const podeMudar = !!aoSalvar;
  // Quem pode mudar já começa a baixar o editor: ao clicar no texto, ele aparece na hora, sem o texto piscar.
  useEffect(() => { if (podeMudar) void prepararEditorAoVivo(); }, [podeMudar]);
  // Se a edição deixa de ser permitida no meio (a anotação foi arquivada, a pessoa perdeu a permissão), o rascunho fecha: não
  // fica nada por salvar que ela não vê, nem a caixa volta aberta com ele depois.
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
  function abrir(onde: ComecoDoCursor, botao?: string) {
    setComeco(onde);
    setBotaoAoChegar(botao);
    mudar(texto);
  }
  function fechar() {
    mudar(null);
    // O foco volta para onde a edição abriu: o teclado não se perde.
    setTimeout(() => (area.current ?? botaoDoConvite.current)?.focus({ preventScroll: true }), 0);
  }
  /**
   * Abre a edição pelo clique no texto, com o cursor no ponto clicado (medido do canto do texto), a não ser que o clique seja num
   * link, numa caixinha ou ao escolher um trecho.
   */
  function clicar(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(COM_CLIQUE_PROPRIO)) return;
    if (window.getSelection()?.toString()) return;
    const canto = (e.currentTarget.firstElementChild ?? e.currentTarget).getBoundingClientRect();
    abrir({ x: e.clientX - canto.left, y: e.clientY - canto.top });
  }
  /** Um botão da barra do texto lido abre a edição, com o cursor no fim, e vale já nela (o B liga o negrito, a Lista começa a lista…). */
  function apertarNaLeitura(e: MouseEvent<HTMLDivElement>) {
    const botao = (e.target as Element).closest('[role="toolbar"] button');
    const nome = botao?.getAttribute('aria-label');
    if (nome) abrir('fim', nome);
  }
  /** Pelo teclado, Enter no próprio texto abre a edição; Enter num link ou numa caixinha de dentro faz o que sempre fez. */
  function teclarNoTexto(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
    e.preventDefault();
    abrir('fim');
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
  /** Cancela: sem mudança, fecha; com mudança, pergunta antes, para nada se perder por engano. */
  async function cancelar() {
    if (rascunho !== texto && !await confirmar('Descartar as mudanças?', 'O que você escreveu não será salvo.', 'Descartar', true)) return;
    fechar();
  }
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && SALVA_COM_CTRL.has(e.key.toLowerCase())) {
      // O Ctrl+S salva o texto, e o navegador não abre a janela de salvar a página.
      e.preventDefault();
      void salvar();
      return;
    }
    if (e.key !== 'Escape') return;
    // Esc nunca fecha o cartão em volta com o texto aberto: ele cancela a edição (perguntando, se há o que perder).
    e.preventDefault();
    e.stopPropagation();
    void cancelar();
  }

  if (editando) return <div className="texto-editavel texto-editavel-edicao" onKeyDown={teclar}>
    <EditorAoVivo id={id} rotulo={rotulo} maximo={maximo} placeholder={placeholder} valor={rascunho} aoMudar={mudar} comecarEm={comeco}
      botaoAoChegar={botaoAoChegar} />
    <div className="texto-editavel-acoes">
      <button type="button" className={estiloBotao({ pequeno: true })} disabled={ocupado} onClick={() => void cancelar()}>Cancelar</button>
      <button type="button" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado} onClick={() => void salvar()}>
        {ocupado ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  </div>;

  // Sem texto, a dica já é o botão que abre a edição.
  if (!texto.trim()) return <div className="texto-editavel">
    <div className="caixa-formatada" onClick={apertarNaLeitura}>
      {barraDaLeitura}
      <button ref={botaoDoConvite} type="button" className="texto-editavel-vazio" onClick={() => abrir('fim')}>{convite}</button>
    </div>
  </div>;
  // O texto é um grupo com nome (o rótulo, ex.: "Descrição") que recebe o foco, e o leitor de tela diz como mudá-lo. Não é um
  // botão: os links e as caixinhas de dentro sumiriam para o leitor de tela e deixariam de ser alcançados pelo Tab.
  return <div className="texto-editavel">
    <div className="caixa-formatada" onClick={apertarNaLeitura}>
      {barraDaLeitura}
      <div ref={area} id={id} className="texto-editavel-area" role="group" aria-label={rotulo} aria-describedby={id + '-como-mudar'} tabIndex={0}
        onClick={clicar} onKeyDown={teclarNoTexto}>
        <TextoFormatado className={className} texto={texto} aoMarcar={aoMarcar} />
      </div>
    </div>
    <span className="sr" id={id + '-como-mudar'}>{COMO_MUDAR_PELO_TECLADO}</span>
  </div>;
}
