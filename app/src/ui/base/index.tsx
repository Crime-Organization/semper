// Peças básicas do SEMPER (o design system em código; veja DESIGN.md). Cada uma gera o mesmo HTML e as mesmas
// classes que as telas já usam, com as cores e os tamanhos de estilo.css: trocar a marcação de uma tela por elas
// não muda a aparência. Comportamento (ocupado, dois cliques) fica em ../Botoes.tsx, que aceita o mesmo estilo.
import { useId, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { avisoDoBanco } from '../../regras/qualBanco';
import { estiloBotao, type EstiloBotao } from './botao';

export { estiloBotao, type EstiloBotao, type FormaBotao, type VarianteBotao } from './botao';

/** Link com cara de botão (ex.: "Nova pessoa" no cabeçalho do módulo). */
export function BotaoLink({ forma, variante, pequeno, className, ...resto }: ComponentProps<typeof Link> & EstiloBotao) {
  return <Link className={estiloBotao({ forma, variante, pequeno }, className)} {...resto} />;
}

interface PropsCampo {
  /** Texto do rótulo. */
  rotulo: ReactNode;
  /** id do campo (input, select ou textarea) que vai dentro; liga o rótulo, a dica e o erro a ele. */
  para: string;
  obrigatorio?: boolean;
  dica?: ReactNode;
  /** Mensagem de erro; com ela, o campo fica marcado e a mensagem aparece. */
  erro?: ReactNode;
  /** O que vem depois da mensagem de erro (ex.: o resultado de uma busca de CEP). */
  depois?: ReactNode;
  className?: string;
  children: ReactNode;
}
/**
 * Pergunta de formulário: rótulo (com * se obrigatório), dica, o campo e a mensagem de erro.
 * O campo recebe o id indicado em "para"; aria-invalid e aria-describedby ficam a cargo de propsDoCampo().
 */
export function Campo({ rotulo, para, obrigatorio, dica, erro, depois, className, children }: PropsCampo) {
  return <div className={['pergunta', erro ? 'erro' : '', className].filter(Boolean).join(' ')}>
    <label htmlFor={para}>{rotulo}{obrigatorio && <span className="req">*</span>}</label>
    {dica && <p className="dica" id={para + '-dica'}>{dica}</p>}
    {children}
    {erro && <span className="msg-erro" id={para + '-erro'} role="alert">{erro}</span>}
    {depois}
  </div>;
}
/** Props de acessibilidade do campo que vai dentro de <Campo>: id, aria-invalid e aria-describedby (dica e erro). */
export function propsDoCampo(para: string, { dica, erro }: { dica?: ReactNode; erro?: ReactNode } = {}) {
  const descrito = [dica ? para + '-dica' : '', erro ? para + '-erro' : ''].filter(Boolean).join(' ');
  return { id: para, 'aria-invalid': erro ? true : undefined, 'aria-describedby': descrito || undefined };
}

interface PropsEscolhas {
  rotulo: ReactNode;
  obrigatorio?: boolean;
  dica?: ReactNode;
  erro?: ReactNode;
  /** Arranjo das opções: em coluna única (listas longas) ou várias marcáveis lado a lado. */
  arranjo?: 'coluna-unica' | 'multipla';
  children: ReactNode;
}
/** Grupo de opções (rádios ou caixas) com um rótulo comum, como "Gênero" ou "Tipo de cadastro". */
export function Escolhas({ rotulo, obrigatorio, dica, erro, arranjo, children }: PropsEscolhas) {
  const id = useId();
  return <div className={'pergunta' + (erro ? ' erro' : '')} role="group" aria-labelledby={id}>
    <span className="rot" id={id}>{rotulo}{obrigatorio && <span className="req">*</span>}</span>
    {dica && <p className="dica">{dica}</p>}
    <div className={arranjo ? 'escolhas ' + arranjo : 'escolhas'}>{children}</div>
    {erro && <span className="msg-erro" role="alert">{erro}</span>}
  </div>;
}

/** Colunas (de 12) que um campo ocupa na grade de formulário (.grade-form, em estilo.css): p no estreito, m a partir de 560px, g a partir de 860px. */
export type TamanhoNaGrade = { p?: number; m?: number; g?: number };
export const naGrade = (t: TamanhoNaGrade = {}) => ({ '--p': t.p, '--m': t.m, '--g': t.g }) as CSSProperties;

/** Faixa de aviso dentro da tela (não confundir com os avisos do pé da tela, em ../avisos.tsx). */
export function Aviso({ tipo, className, ...resto }: ComponentProps<'div'> & { tipo: 'erro' | 'ok' | 'info' }) {
  return <div className={['aviso', tipo, className].filter(Boolean).join(' ')} role={tipo === 'erro' ? 'alert' : 'status'} {...resto} />;
}

/** Diz em qual banco a pessoa está, só no computador de quem desenvolve. No site publicado, não aparece. */
export function FaixaDoBanco({ modo = import.meta.env.MODE, noComputador = import.meta.env.DEV }: { modo?: string; noComputador?: boolean }) {
  const aviso = avisoDoBanco(modo, noComputador);
  return aviso && <Aviso tipo={aviso.tipo} className="faixa-do-banco">{aviso.texto}</Aviso>;
}

export type TipoSelo = 'ok' | 'erro' | 'pend' | 'arq' | 'escuro';
/** Selo curto em caixa alta (ex.: ATIVO, PENDENTE, ARQUIVADA). */
export function Selo({ tipo, children }: { tipo?: TipoSelo; children: ReactNode }) {
  return <span className={tipo ? 'selo ' + tipo : 'selo'}>{children}</span>;
}

/** Caixa branca com borda fina, para agrupar um conteúdo. */
export function Cartao({ className, ...resto }: ComponentProps<'div'>) {
  return <div className={className ? 'cartao ' + className : 'cartao'} {...resto} />;
}

/** Título de uma seção da página. */
export function TituloSecao({ className, ...resto }: ComponentProps<'h2'>) {
  return <h2 className={className ? 'secao ' + className : 'secao'} {...resto} />;
}

/** Texto de apoio em cinza: nota (explicação de uma seção) ou dica (de um campo). */
export function Nota({ className, ...resto }: ComponentProps<'p'>) {
  return <p className={className ? 'nota ' + className : 'nota'} {...resto} />;
}
export function Dica({ className, ...resto }: ComponentProps<'p'>) {
  return <p className={className ? 'dica ' + className : 'dica'} {...resto} />;
}

/** Enquanto os dados não chegam. */
export function Carregando({ children = 'Carregando…' }: { children?: ReactNode }) {
  return <p className="carregando" role="status">{children}</p>;
}

/** Lista vazia: o que aparece quando não há nada para mostrar (e, de preferência, como acrescentar o primeiro). */
export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}

export interface Aba<T extends string> {
  id: T;
  rotulo: ReactNode;
  /** Quantos itens a aba tem (ex.: "Novos 120"); fica num selo ao lado do rótulo. */
  contador?: number;
}
/** Setas, Home e End levam de uma aba a outra (a aba escolhida já é mostrada), como pede o padrão de abas da WAI-ARIA. */
const TECLAS_DAS_ABAS: Record<string, (atual: number, quantas: number) => number> = {
  ArrowRight: (atual, quantas) => (atual + 1) % quantas,
  ArrowLeft: (atual, quantas) => (atual - 1 + quantas) % quantas,
  Home: () => 0,
  End: (_atual, quantas) => quantas - 1
};
interface PropsAbas<T extends string> {
  /** Nome do grupo de abas, para o leitor de tela (ex.: "Conferência"). */
  rotulo: string;
  abas: readonly Aba<T>[];
  atual: T;
  aoTrocar: (id: T) => void;
  /**
   * O id do painel (role="tabpanel") que mostra a aba escolhida: as abas apontam para ele (aria-controls), e ele se
   * liga à aba escolhida com aria-labelledby={idDaAba(painel, atual)}.
   */
  painel?: string;
}
/** O id de uma aba das Abas ligadas ao painel (para o aria-labelledby do painel). */
export const idDaAba = (painel: string, aba: string) => `${painel}-aba-${aba}`;
/**
 * Abas (como "Equipe" e "Sou cliente" na entrada): uma é a escolhida, e a tela mostra o conteúdo dela logo abaixo.
 * Só a aba escolhida entra na ordem do Tab; as setas passam às outras.
 */
export function Abas<T extends string>({ rotulo, abas, atual, aoTrocar, painel }: PropsAbas<T>) {
  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    const proxima = TECLAS_DAS_ABAS[e.key];
    if (!proxima || !abas.length) return;
    e.preventDefault();
    const indice = proxima(Math.max(0, abas.findIndex(a => a.id === atual)), abas.length);
    aoTrocar(abas[indice].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[indice]?.focus();
  }
  return <div className="abas" role="tablist" aria-label={rotulo} onKeyDown={tecla}>
    {abas.map(a => <button key={a.id} type="button" role="tab" aria-selected={a.id === atual} tabIndex={a.id === atual ? 0 : -1}
      id={painel && idDaAba(painel, a.id)} aria-controls={painel} onClick={() => aoTrocar(a.id)}>
      {a.rotulo}{a.contador !== undefined && <> <span className="recolher-contador num">{a.contador.toLocaleString('pt-BR')}</span></>}
    </button>)}
  </div>;
}

/** O tom do número de um indicador: entrada em verde, saída em vermelho, destaque no cartão escuro. */
export type TomDoIndicador = 'neutro' | 'entrada' | 'saida' | 'alerta' | 'destaque';
/** A grade de indicadores: os cartões dividem a linha e descem quando não cabem. */
export function Indicadores({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="indicadores" role="group" aria-label={rotulo}>{children}</div>;
}
/** Um número grande com o nome e, se houver, uma linha de apoio (ex.: "Entradas", "R$ 12.300,00", "12 lançamentos"). */
export function Indicador({ rotulo, valor, detalhe, tom = 'neutro' }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: TomDoIndicador }) {
  const id = useId();
  return <section className={'indicador ' + tom} aria-labelledby={id}>
    <span className="indicador-rotulo" id={id}>{rotulo}</span>
    <b className="indicador-valor num">{valor}</b>
    {detalhe && <span className="indicador-detalhe">{detalhe}</span>}
  </section>;
}

export interface Segmento<T extends string> { id: T; rotulo: ReactNode; /** Mostra uma bolinha (ex.: o mês tem lançamentos). */ marcado?: boolean; desligado?: boolean }
/** Botões lado a lado em que um está escolhido (ex.: os meses do ano). Rola para o lado quando não cabe. */
export function Segmentos<T extends string>({ rotulo, opcoes, atual, aoEscolher }: { rotulo: string; opcoes: readonly Segmento<T>[]; atual: T; aoEscolher: (id: T) => void }) {
  return <div className="segmentos" role="group" aria-label={rotulo}>
    {opcoes.map(o => <button key={o.id} type="button" aria-pressed={o.id === atual} disabled={o.desligado} onClick={() => aoEscolher(o.id)}>
      {o.rotulo}{o.marcado && <span className="segmento-marca" aria-hidden="true" />}
    </button>)}
  </div>;
}

/** Abas que trocam de página: cada uma é um link, e a da página aberta fica marcada (aria-current). */
export function NavegacaoEmAbas({ rotulo, abas }: { rotulo: string; abas: readonly { para: string; rotulo: ReactNode; atual: boolean }[] }) {
  return <nav className="abas-nav" aria-label={rotulo}>
    {abas.map(a => <Link key={a.para} to={a.para} aria-current={a.atual ? 'page' : undefined}>{a.rotulo}</Link>)}
  </nav>;
}

/** Percentual inteiro de valor em maximo, entre 0 e 100 (com máximo zero, 0). */
export const percentual = (valor: number, maximo: number) => maximo > 0 ? Math.round(100 * Math.min(Math.max(valor, 0), maximo) / maximo) : 0;
/** Barra de progresso (ex.: "Gravadas 400 de 1.234"): o leitor de tela ouve o percentual e a conta. */
export function Progresso({ rotulo, valor, maximo }: { rotulo: string; valor: number; maximo: number }) {
  const feito = percentual(valor, maximo);
  return <div className="progresso" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={feito}
    aria-valuetext={`${valor.toLocaleString('pt-BR')} de ${maximo.toLocaleString('pt-BR')}`}>
    <i style={{ width: feito + '%' }} />
  </div>;
}
