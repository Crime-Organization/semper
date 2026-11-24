// Peças básicas do SEMPER (o design system em código; veja DESIGN.md). Cada uma gera o mesmo HTML e as mesmas
// classes que as telas já usam, com as cores e os tamanhos de estilo.css: trocar a marcação de uma tela por elas
// não muda a aparência. Comportamento (ocupado, dois cliques) fica em ../Botoes.tsx, que aceita o mesmo estilo.
import { useId, useRef, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import { avisoDoBanco } from '../../regras/qualBanco';
import { estiloBotao, type EstiloBotao } from './botao';

export { estiloBotao, type EstiloBotao, type FormaBotao, type VarianteBotao } from './botao';
export { CaixaFormatada, TextoFormatado } from './TextoFormatado';
export { CampoDoTitulo, TituloEditavel, TITULO_EM_BRANCO, type NivelDoTitulo } from './TituloEditavel';
export { TextoEditavel } from './TextoEditavel';
export { DadosEditaveis, FormularioDosDados } from './DadosEditaveis';
export { EditorDeTexto, type ControleDoEditor } from './EditorDeTexto';
export { EditorAoVivo, prepararEditorAoVivo, type PropsEditorAoVivo } from './EditorAoVivo';
export { APARELHO_DE_TOQUE, CalendarioDoMes, CampoData, LugarDoCalendario, type HoraDoCampo, type PropsCampoData } from './CampoData';
export { CampoDataHora, type PropsCampoDataHora } from './CampoDataHora';
export { BotaoDoLembrete } from './BotaoDoLembrete';
export { DataEditavel } from './DataEditavel';
export { DadoDoGrupo, FaixaDasDatas, GrupoDeDatas, LinhaDoGrupo } from './GrupoDeDatas';
export { DatasDoCartao, ResumoDasDatas, type DataDaJanela, type EntregaDaJanela, type RepeticaoDaJanela } from './JanelaDasDatas';
export { InicioEPrazo, MUDAR_AS_DATAS, NOME_DAS_DATAS } from './InicioEPrazo';
export { BotaoDeIcone, IconeDoBotao, propsDoBotaoDeIcone, type SoIcone } from './BotaoDeIcone';
export { BotaoTirar, CONFIRMAR_O_TIRAR, EXPLICACAO_DO_TIRAR, perguntarETirar, rotuloDoTirar, TirarNoCartao, type FormaDoTirar, type PedidoDeTirar } from './BotaoTirar';

/**
 * A dica que aparece junto de um botão pequeno, só de ícone ou de iniciais (as bolinhas da equipe), ao passar o mouse e no foco
 * do teclado, e não só ao passar o mouse, como o title do navegador. O estilo desenha o texto ([data-dica], em estilo.css); o
 * nome para o leitor de tela continua no aria-label de quem usa.
 */
export const propsDaDica = (texto: string) => ({ 'data-dica': texto });

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

/** Os ids do rótulo, da dica e do erro de um <CampoDeVarios>, para as linhas de dentro se ligarem a eles (aria-labelledby, aria-describedby). */
export const idsDoCampoDeVarios = (id: string) => ({ rotulo: id + '-rotulo', dica: id + '-dica', erro: id + '-erro' });

interface PropsCampoDeVarios {
  /** O rótulo, no plural ("Clientes", "Pessoas ligadas"): o campo aceita mais de um item. */
  rotulo: ReactNode;
  obrigatorio?: boolean;
  dica?: ReactNode;
  erro?: ReactNode;
  /** A base dos ids (veja idsDoCampoDeVarios), quando as linhas precisam apontar para o rótulo, a dica ou o erro. */
  id?: string;
  /** O grupo, para receber o foco quando a linha que o tinha some (ao tirar um item): com ele, o grupo aceita o foco pelo código. */
  grupo?: Ref<HTMLDivElement>;
  /** As linhas (uma busca por item, com o botão de tirar) e o botão de acrescentar. */
  children: ReactNode;
}
/**
 * Campo que aceita mais de um item (os clientes de uma demanda, as pessoas ligadas a uma tarefa): o rótulo no plural,
 * uma vez só, e as linhas embaixo. Cada linha tem o próprio nome para o leitor de tela ("Cliente 2"), sem repetir na tela.
 */
export function CampoDeVarios({ rotulo, obrigatorio, dica, erro, id, grupo, children }: PropsCampoDeVarios) {
  const automatico = useId();
  const ids = idsDoCampoDeVarios(id ?? automatico);
  return <div ref={grupo} tabIndex={grupo ? -1 : undefined} className={'pergunta' + (erro ? ' erro' : '')} role="group" aria-labelledby={ids.rotulo}>
    <span className="rot" id={ids.rotulo}>{rotulo}{obrigatorio && <span className="req" aria-hidden="true">*</span>}</span>
    {dica && <p className="dica" id={ids.dica}>{dica}</p>}
    {children}
    {erro && <span className="msg-erro" id={ids.erro} role="alert">{erro}</span>}
  </div>;
}

/**
 * O grupo de um <CampoDeVarios> (passe `grupo` a ele) e a função que o foca depois de tirar uma linha: o botão de tirar some
 * com a linha, e o foco iria parar no começo da página. Com o grupo focado, o leitor de tela diz em que lista a pessoa está.
 */
export function useFocoNoGrupo() {
  const grupo = useRef<HTMLDivElement>(null);
  // setTimeout 0: espera o React desenhar a lista sem a linha tirada.
  const focarNoGrupo = () => { setTimeout(() => grupo.current?.focus(), 0); };
  return { grupo, focarNoGrupo };
}

/**
 * O nível do título de uma seção do formulário: 2 no cadastro (abaixo do título da página, o h1) e 3 no lápis do cartão
 * (abaixo do título do cartão, o h2).
 */
export type NivelDaSecao = 2 | 3;
const TITULO_DA_SECAO: Record<NivelDaSecao, 'h2' | 'h3'> = { 2: 'h2', 3: 'h3' };
interface PropsSecaoDoFormulario {
  titulo: ReactNode;
  /** A frase que explica a seção, embaixo do título (no cadastro por etapas). */
  texto?: ReactNode;
  nivel?: NivelDaSecao;
  /** O título, para receber o foco pelo código quando a seção troca (as etapas da importação): com ele, o título aceita o foco. */
  focoNoTitulo?: Ref<HTMLHeadingElement>;
  /** Os campos da seção. */
  children: ReactNode;
}
/**
 * Uma seção de formulário de cadastro ou de edição (uma etapa do cadastro; todas juntas no lápis do cartão): o título,
 * maior que os rótulos, e os campos agrupados embaixo dele, recuados, para a seção não se confundir com o primeiro campo
 * (#359). O leitor de tela a anuncia como uma região com o nome da seção.
 */
export function SecaoDoFormulario({ titulo, texto, nivel = 2, focoNoTitulo, children }: PropsSecaoDoFormulario) {
  const id = useId();
  const Titulo = TITULO_DA_SECAO[nivel];
  return <section className="etapa ativa" aria-labelledby={id}>
    <header><Titulo id={id} ref={focoNoTitulo} tabIndex={focoNoTitulo ? -1 : undefined}>{titulo}</Titulo>{texto && <p>{texto}</p>}</header>
    <div className="etapa-campos">{children}</div>
  </section>;
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
/**
 * Selo curto em caixa alta (ex.: ATIVO, PENDENTE, ARQUIVADA). Com `para`, o selo é um link para onde aquilo se resolve (ex.: o
 * "Da equipe" do cartão da pessoa leva à Equipe, #327), com a `dica` dizendo aonde vai.
 */
export function Selo({ tipo, para, dica, children }: { tipo?: TipoSelo; para?: string; dica?: string; children: ReactNode }) {
  const classes = tipo ? 'selo ' + tipo : 'selo';
  const comDica = dica ? { ...propsDaDica(dica), 'aria-description': dica } : {};
  return para ? <Link className={classes + ' selo-link'} to={para} {...comDica}>{children}</Link> : <span className={classes}>{children}</span>;
}

/**
 * O código do item no SEMPER (ex.: CA222B4B), em letra miúda. Com `dica`, ela explica o código como as outras dicas (propsDaDica):
 * ao passar o mouse e no foco do teclado (por isso o código com dica entra no Tab); o leitor de tela lê a dica como descrição.
 */
export function Codigo({ dica, children }: { dica?: string; children: ReactNode }) {
  const comDica = dica ? { ...propsDaDica(dica), tabIndex: 0, 'aria-description': dica } : {};
  return <span className="codigo" {...comDica}>{children}</span>;
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

/** Uma tecla do teclado, como na dica de um atalho (Ctrl, K, Esc, N): o mesmo desenho na busca geral e na lista de atalhos. */
export function Tecla({ className, ...resto }: ComponentProps<'kbd'>) {
  return <kbd className={className ? 'tecla ' + className : 'tecla'} {...resto} />;
}

/** Enquanto os dados não chegam. */
export function Carregando({ children = 'Carregando…' }: { children?: ReactNode }) {
  return <p className="carregando" role="status">{children}</p>;
}

/** Lista vazia: o que aparece quando não há nada para mostrar (e, de preferência, como acrescentar o primeiro). */
export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}

/**
 * O número pequeno, numa pílula, ao lado de um nome: quantos itens há numa seção do cartão, numa aba, num bloco do Início.
 * "apagado": sem o fundo, para o zero não chamar a atenção.
 */
export function Contador({ apagado, className, ...resto }: ComponentProps<'span'> & { apagado?: boolean }) {
  return <span className={['recolher-contador num', apagado && 'vazio', className].filter(Boolean).join(' ')} {...resto} />;
}

/** Uma linha da lista de números: quantos há e de quê; com "para", a linha toda leva à página. */
export interface LinhaDeNumero { chave: string; n: number; nome: string; para?: string }
/** Uma lista de números, um embaixo do outro, cada um com o nome ao lado (ex.: as demandas por situação no Início). */
export function ListaDeNumeros({ rotulo, linhas }: { rotulo: string; linhas: readonly LinhaDeNumero[] }) {
  return <ul className="lista-de-numeros" aria-label={rotulo}>{linhas.map(l => {
    const conteudo = <><b className="num">{l.n.toLocaleString('pt-BR')}</b> <span>{l.nome}</span></>;
    return <li key={l.chave}>{l.para ? <Link to={l.para}>{conteudo}</Link> : <span>{conteudo}</span>}</li>;
  })}</ul>;
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
      {a.rotulo}{a.contador !== undefined && <> <Contador>{a.contador.toLocaleString('pt-BR')}</Contador></>}
    </button>)}
  </div>;
}

/** O tom do número de um indicador: entrada em verde, saída em vermelho, destaque no cartão escuro. */
export type TomDoIndicador = 'neutro' | 'entrada' | 'saida' | 'alerta' | 'destaque';
/** A grade de indicadores: os cartões dividem a linha e descem quando não cabem. */
/** Um grupo de indicadores. Com "titulo", o nome do grupo aparece em cima (ex.: "Caixa" e "Desempenho", lado a lado na mesma tela). */
export function Indicadores({ rotulo, titulo, children }: { rotulo: string; titulo?: string; children: ReactNode }) {
  const grupo = <div className="indicadores" role="group" aria-label={rotulo}>{children}</div>;
  return titulo ? <div className="indicadores-bloco"><span className="rotulo-caps" aria-hidden="true">{titulo}</span>{grupo}</div> : grupo;
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
