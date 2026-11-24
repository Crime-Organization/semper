// Seção de dados que se muda no próprio lugar (#428), no jeito do texto que se muda no lugar (TextoEditavel, #339): quem pode
// alterar clica nos dados (ou, pelo teclado, chega neles com o Tab e tecla Enter) e eles viram um formulário ali mesmo, com
// Cancelar e Salvar no pé. O formulário mostra todos os campos, inclusive os vazios; depois de salvar, a seção volta a mostrar só
// os preenchidos (quem a usa decide o que mostrar). Peça comum: começou nos "Dados do processo" e serve aos outros cartões.
// - DadosEditaveis: a seção lida, que abre a edição; com ela aberta, mostra o formulário no lugar dos dados;
// - FormularioDosDados: o formulário aberto. Enter passa ao próximo campo (no último, salva); Esc fecha sem salvar (com algo
//   mudado, pergunta antes de descartar) e nunca fecha o cartão em volta; com algo mudado, sair do cartão pergunta antes
//   (AvisoAoSair). Quem só lê vê os dados, e nada vira formulário nem recebe o foco.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { AvisoAoSair } from '../AvisoAoSair';
import { confirmar } from '../janela';
import { estiloBotao } from './botao';

/** O que, dentro dos dados, tem clique próprio (um link, um botão): o clique nele não abre a edição. */
const COM_CLIQUE_PROPRIO = 'a, button, input, select, textarea, label, summary';
/** A explicação ao passar o mouse e, para o leitor de tela, depois do nome da seção. */
const COMO_MUDAR = 'Clique ou tecle Enter para mudar estes dados.';
/** Os campos que o Enter percorre, na ordem da tela (as opções e as caixas de marcar têm o Enter delas). */
const CAMPOS_DO_ENTER = 'input:not([type="radio"]):not([type="checkbox"]):not([type="hidden"]), select';

interface PropsDaSecao {
  /** O nome dos dados (ex.: "Dados do processo"), para o leitor de tela. */
  rotulo: string;
  /** O formulário está aberto (quem usa guarda isso, para fechá-lo depois de salvar ou cancelar). */
  editando: boolean;
  /** Abre o formulário. Sem isto (quem só lê, o item arquivado), os dados só se leem. */
  aoEditar?: () => void;
  /** O formulário aberto (em geral, um FormularioDosDados). */
  edicao: ReactNode;
  /** Os dados lidos (só os preenchidos). */
  children: ReactNode;
}

export function DadosEditaveis({ rotulo, editando, aoEditar, edicao, children }: PropsDaSecao) {
  const id = useId();
  const area = useRef<HTMLDivElement>(null);
  // Ao fechar o formulário, o foco volta aos dados: o teclado não se perde.
  const estava = useRef(editando);
  useEffect(() => {
    if (estava.current && !editando) area.current?.focus({ preventScroll: true });
    estava.current = editando;
  }, [editando]);

  if (!aoEditar) return <>{children}</>;
  if (editando) return <>{edicao}</>;
  /** Abre pelo clique, a não ser que ele seja num link ou num botão de dentro, ou termine escolhendo um trecho para copiar. */
  function clicar(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(COM_CLIQUE_PROPRIO)) return;
    if (window.getSelection()?.toString()) return;
    aoEditar!();
  }
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
    e.preventDefault();
    aoEditar!();
  }
  // Um grupo com nome que recebe o foco, e não um botão: os links de dentro continuam alcançáveis pelo Tab.
  return <div ref={area} className="dados-editaveis" role="group" aria-label={rotulo} aria-describedby={id} tabIndex={0} title={COMO_MUDAR}
    onClick={clicar} onKeyDown={teclar}>
    {children}
    <span className="sr" id={id}>{COMO_MUDAR}</span>
  </div>;
}

interface PropsDoFormulario {
  /** O nome do formulário para o leitor de tela (ex.: "Editar os dados do processo"). */
  rotulo: string;
  /** Os campos como estão agora: diferentes de como abriram, há o que perder. */
  estado: unknown;
  /** Salvando: os botões ficam desligados, e sair do cartão espera. */
  ocupado: boolean;
  aoSalvar: () => void;
  aoCancelar: () => void;
  /** Avisa quando passa a ter (ou deixa de ter) algo mudado, e false ao fechar (o cartão pergunta antes de abrir o lápis por cima). */
  aoMudarSujo?: (sujo: boolean) => void;
  children: ReactNode;
}

export function FormularioDosDados({ rotulo, estado, ocupado, aoSalvar, aoCancelar, aoMudarSujo, children }: PropsDoFormulario) {
  const form = useRef<HTMLFormElement>(null);
  // O formulário não sai da tela por conta própria: ao salvar ou cancelar, ele só fecha, e o aviso sai junto, sem perguntar.
  const liberada = useRef(false);
  const atual = JSON.stringify(estado);
  const [inicial] = useState(atual);
  const mudou = atual !== inicial;
  const avisarSujo = useRef(aoMudarSujo);
  avisarSujo.current = aoMudarSujo;
  useEffect(() => { avisarSujo.current?.(mudou); }, [mudou]);
  useEffect(() => () => avisarSujo.current?.(false), []);
  // Ao abrir, o cursor vai para o primeiro campo.
  useEffect(() => { form.current?.querySelector<HTMLElement>(CAMPOS_DO_ENTER)?.focus({ preventScroll: true }); }, []);

  async function desistir() {
    if (mudou && !await confirmar('Descartar as mudanças?', 'O que você mudou nestes dados não será salvo.', 'Descartar', true)) return;
    aoCancelar();
  }
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    // Quem já tratou a tecla (a lista de sugestões, o calendário) fica com ela.
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      void desistir();
      return;
    }
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    const campos = [...form.current!.querySelectorAll<HTMLElement>(CAMPOS_DO_ENTER)].filter(x => !x.hasAttribute('disabled'));
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else aoSalvar();
  }

  return <form ref={form} className="form-grade dados-editaveis-edicao" aria-label={rotulo} noValidate autoComplete="off" onKeyDown={teclar}
    onSubmit={e => e.preventDefault()}>
    <AvisoAoSair preenchido={mudou} liberada={liberada} ocupado={ocupado} />
    {children}
    <div className="edicao-rodape">
      <button type="button" className={estiloBotao()} disabled={ocupado} onClick={aoCancelar}>Cancelar</button>
      <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado} onClick={aoSalvar}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
    </div>
  </form>;
}
