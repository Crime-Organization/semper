// Título que se muda no próprio lugar (#339), como numa nota do Obsidian: quem pode alterar clica no título e ele vira um
// campo ali mesmo, com o mesmo tamanho de letra (o campo fica dentro do próprio h1/h2 e herda a letra dele). Enter ou sair do
// campo salva; Esc desfaz. Título em branco não é salvo: o aviso diz por quê. Quem só lê vê o título comum, e nada vira campo.
// Peça comum: desde a #346, também nos títulos dos cartões de tarefa, demanda, processo e compromisso.
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react';
import { avisar, falha } from '../avisos';
import { haJanelaAberta } from '../janela';

/** O nível do título: 1 no alto de uma página, 2 no cartão. */
export type NivelDoTitulo = 1 | 2;
const ELEMENTO: Record<NivelDoTitulo, 'h1' | 'h2'> = { 1: 'h1', 2: 'h2' };
/** O aviso quando quem chama não diz como conferir o título. */
export const TITULO_EM_BRANCO = 'O título não pode ficar em branco.';
/** A dica do título que se muda com um clique. */
const DICA = 'Clique para mudar o título';
/** Quebra de linha no título (colado de outro lugar): vira um espaço, porque o título é uma linha só, que quebra para caber. */
const QUEBRA = /\s*[\r\n]+\s*/g;

/** Como a edição do título fecha: pelo Enter, pelo Esc ou ao sair do campo. */
type Saida = 'enter' | 'esc' | 'saida';

const juntar = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ');

type PropsDoCampo = Omit<ComponentProps<'textarea'>, 'rows' | 'ref'> & {
  nivel?: NivelDoTitulo;
  /** Ao aparecer, o campo recebe o foco, com o cursor no fim do título. */
  focar?: boolean;
};
/**
 * O campo do título dentro do próprio título: o mesmo lugar e o mesmo tamanho de letra do título que ele troca. É uma caixa de
 * uma linha que cresce para baixo, para o título comprido quebrar em linhas como o título lido, em vez de correr para o lado.
 * O Enter fica com quem usa o campo (salvar, descer para o texto). Serve também à anotação nova ("Sem título").
 */
export function CampoDoTitulo({ nivel = 2, className, value, onChange, focar = false, ...campo }: PropsDoCampo) {
  const H = ELEMENTO[nivel];
  const caixa = useRef<HTMLTextAreaElement>(null);
  // A altura acompanha o texto (onde o navegador não faz isso sozinho pelo estilo).
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight) el.style.height = el.scrollHeight + 'px';
  }, [value]);
  useEffect(() => {
    const el = caixa.current;
    if (!focar || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [focar]);
  return <H className={juntar('titulo-editavel', className)}>
    <textarea ref={caixa} rows={1} className="titulo-editavel-campo" autoComplete="off" spellCheck value={value}
      onChange={e => {
        const numaLinha = e.target.value.replace(QUEBRA, ' ');
        if (numaLinha !== e.target.value) e.target.value = numaLinha;
        onChange?.(e);
      }} {...campo} />
  </H>;
}

interface Props {
  /** O título gravado (vazio no item que pode ficar sem título: o campo abre em branco). */
  valor: string;
  /**
   * O que se lê fora da edição, quando não é o próprio título gravado (#346): o processo sem nome mostra os clientes, e o
   * compromisso sem título, o tipo e as pessoas. Sem isto, lê-se o título gravado.
   */
  exibido?: string;
  nivel?: NivelDoTitulo;
  /**
   * Quem pode alterar recebe o título novo, sem os espaços das pontas (só quando ele mudou). Sem isto, o título só se lê. Se a
   * gravação falhar (a promessa recusada), o erro aparece no pé da tela.
   */
  aoSalvar?: (titulo: string) => unknown;
  /** O que o título confere antes de salvar ('' = está certo). Sem isto, só não pode ficar em branco. */
  conferir?: (titulo: string) => string;
  /** O nome do campo para o leitor de tela. */
  rotulo?: string;
  maximo?: number;
  placeholder?: string;
  /** O que a pessoa está escrevendo, a cada tecla (null: fora da edição), para o cartão avisar ao sair sem salvar. */
  aoMudarRascunho?: (rascunho: string | null) => void;
  className?: string;
}

export function TituloEditavel({ valor, exibido, nivel = 2, aoSalvar, conferir, rotulo = 'Título', maximo, placeholder, aoMudarRascunho, className }: Props) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  /** Marcado ao salvar ou desfazer: o campo some, e o "sair do campo" que vem depois não salva de novo. */
  const fechado = useRef(false);
  const botao = useRef<HTMLButtonElement>(null);
  const avisarRascunho = useRef(aoMudarRascunho);
  avisarRascunho.current = aoMudarRascunho;
  // Ao sair da tela no meio da edição, o cartão deixa de esperar este rascunho.
  useEffect(() => () => avisarRascunho.current?.(null), []);
  // Se a edição deixa de ser permitida no meio (a anotação foi arquivada, a pessoa perdeu a permissão), o rascunho fecha.
  const podeMudar = !!aoSalvar, editando = rascunho !== null;
  useEffect(() => {
    if (podeMudar || !editando) return;
    fechado.current = true;
    setRascunho(null);
    avisarRascunho.current?.(null);
  }, [podeMudar, editando]);

  const H = ELEMENTO[nivel];
  if (!aoSalvar) return <H className={className}>{exibido ?? valor}</H>;

  function mudar(texto: string | null) {
    setRascunho(texto);
    avisarRascunho.current?.(texto);
  }
  function entrar() {
    fechado.current = false;
    mudar(valor);
  }
  /** Fecha o campo. Pelo teclado (Enter ou Esc), o foco volta ao título, e quem usa o teclado não se perde no cartão. */
  function desfazer(pelo: Saida) {
    fechado.current = true;
    mudar(null);
    if (pelo !== 'saida') setTimeout(() => botao.current?.focus({ preventScroll: true }), 0);
  }
  /** Salva o que está no campo. Pelo Enter, um título errado deixa o campo aberto; ao sair do campo, volta ao gravado. */
  function salvar(pelo: Exclude<Saida, 'esc'>) {
    if (fechado.current || rascunho === null) return;
    const novo = rascunho.trim();
    if (novo === valor.trim()) { desfazer(pelo); return; }
    const erro = conferir ? conferir(rascunho) : novo ? '' : TITULO_EM_BRANCO;
    if (erro) {
      avisar(erro, 'erro');
      if (pelo === 'saida') desfazer(pelo);
      return;
    }
    desfazer(pelo);
    void Promise.resolve().then(() => aoSalvar!(novo)).catch(falha);
  }
  /**
   * Sair do campo salva, a não ser que o foco tenha ido para uma janela que abriu por cima (como a pergunta "Sair sem salvar?"
   * do Voltar do navegador): aí o título continua em edição, a resposta decide, e o foco volta ao campo quando a janela fecha.
   */
  function sair() {
    if (haJanelaAberta()) return;
    salvar('saida');
  }
  function teclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') { e.preventDefault(); salvar('enter'); }
    // Esc desfaz só o título, sem fechar o cartão em volta.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); desfazer('esc'); }
  }

  // Ao entrar na edição, o cursor vai para o fim do título, como quem continua a escrever.
  if (rascunho !== null) return <CampoDoTitulo focar nivel={nivel} className={className} aria-label={rotulo} value={rascunho} maxLength={maximo}
    placeholder={placeholder} onChange={e => mudar(e.target.value)} onKeyDown={teclar} onBlur={sair} />;
  // O botão leva o próprio título como nome: o título continua sendo lido igual, e o clique (ou Enter) o abre para mudar.
  return <H className={juntar('titulo-editavel', className)}>
    <button ref={botao} type="button" className="titulo-editavel-botao" title={DICA} onClick={entrar}>{exibido ?? valor}</button>
  </H>;
}
