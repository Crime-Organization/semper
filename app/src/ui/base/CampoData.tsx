// O campo de data do SEMPER (#357), em todos os cadastros: no computador, a data se escreve à mão (dd/mm/aaaa, com a máscara de
// sempre, e a colada como aaaa-mm-dd também vale) e um calendário pequeno abre ao clicar no campo, no botão do calendário ou com a
// seta para baixo. O calendário segue o padrão de calendário da WAI-ARIA: uma janela (dialog) com a grade do mês (grid), setas de mês
// anterior e seguinte, hoje marcado, o dia escolhido marcado, e o teclado (setas, Home, End, PageUp, PageDown; Enter escolhe; Esc
// fecha e devolve o foco ao campo). Quando o campo tem hora, ela fica logo abaixo do calendário.
// O calendário flutua por cima da página, logo abaixo do campo (se não couber, a página rola para ele caber; senão, ele abre em
// cima; e, se não couber inteiro em nenhum lado, rola por dentro). Dentro de um formulário pequeno do cartão (a faixa das datas, os
// prazos do processo, #395), ele abre no próprio formulário, no lugar que o formulário reserva (LugarDoCalendario), e empurra o
// que vem embaixo em vez de cobrir: nunca fica por cima da hora, do lembrete, do Cancelar ou do Salvar. Nos dois jeitos, o Tab sai
// do calendário para o campo seguinte (ou, para trás, volta à data), sem fugir do cartão.
// No aparelho de toque (celular, tablet: "pointer: coarse"), o campo é o do próprio aparelho, que abre o calendário dele.
// A lógica do mês, do teclado e dos limites fica em regras/campoData.ts.
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { hojeNaAgenda } from '../../regras/agenda';
import {
  andarComTecla, DIAS_DO_CABECALHO, diaEmFoco, dentroDosLimites, doMes, FORMATOS_DA_DATA, ladoDoCalendario, mesAoAbrir, mesForaDosLimites, nomeDoDia, numeroDoDia,
  primeiroDoMes, semanasDoMes, somarMeses, textoDaDataDigitada, tituloDoMes, type FormatoDaData, type LimitesDaData
} from '../../regras/campoData';
import { fmtData } from '../../regras/pessoa';
import { Icone } from '../Icone';
import { estiloBotao } from './botao';
import { DISTANCIA_DO_BOTAO, MARGEM_DA_TELA } from '../Menu';

/**
 * O aparelho de toque, onde o calendário do próprio aparelho é melhor que o nosso: o que decide é o jeito de apontar (o dedo), e
 * não a largura da janela. Um computador com a janela estreita continua com o calendário pequeno, que funciona com o mouse e o
 * teclado; um tablet deitado, largo, fica com o do aparelho.
 */
export const APARELHO_DE_TOQUE = '(pointer: coarse)';

/**
 * O lugar, dentro de um formulário pequeno do cartão, onde o calendário abre (#395): o formulário põe um elemento vazio logo
 * depois dos campos e o passa aqui; todo CampoData dentro dele abre o calendário ali, no fluxo do formulário, em vez de flutuar.
 */
export const LugarDoCalendario = createContext<HTMLElement | null>(null);

/** O que entra na ordem do Tab. */
const FOCAVEIS = 'a[href], button, input, select, textarea, [tabindex]';
/** O que recebe o foco pelo Tab, na ordem da página. */
const focaveis = (dentro: ParentNode) => [...dentro.querySelectorAll<HTMLElement>(FOCAVEIS)]
  .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert], [hidden]'));

/** A consulta de mídia vale agora? Acompanha as mudanças (ex.: o tablet que ganha um mouse). Sem matchMedia, não vale. */
function useMidia(consulta: string) {
  return useSyncExternalStore(
    avisar => {
      const m = window.matchMedia?.(consulta);
      m?.addEventListener('change', avisar);
      return () => m?.removeEventListener('change', avisar);
    },
    () => window.matchMedia?.(consulta).matches ?? false,
    () => false
  );
}

/** A hora que acompanha a data (hh:mm): no computador, fica logo abaixo do calendário. */
export interface HoraDoCampo { valor: string; aoMudar: (hora: string) => void }

type PropsDoInput = Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max'>;
export interface PropsCampoData extends PropsDoInput {
  /** A data como a tela guarda: dd/mm/aaaa como digitado (formato "texto", o padrão) ou aaaa-mm-dd (formato "iso"). */
  valor: string;
  aoMudar: (valor: string) => void;
  formato?: FormatoDaData;
  /** O primeiro e o último dia que se pode escolher no calendário (aaaa-mm-dd). */
  min?: string;
  max?: string;
  hora?: HoraDoCampo;
  /** Abre o calendário assim que o campo aparece, com o foco no dia (ex.: a data de início mudada no próprio cartão). */
  abrirAoAparecer?: boolean;
  /** Avisa que a pessoa escolheu um dia no calendário (depois de aoMudar), com a data como a tela guarda. */
  aoEscolher?: (valor: string) => void;
  /** O Esc fechou o calendário (ou, fechado, foi apertado no campo). */
  aoDesistir?: () => void;
  /** O texto no campo, como a pessoa escreveu (dd/mm/aaaa): para dizer o que está errado numa data que o formato "iso" não passa. */
  aoMudarTexto?: (texto: string) => void;
}

/** Campo de data: o calendário pequeno no computador, o do aparelho no celular. Vai dentro de <Campo>, com propsDoCampo(). */
export function CampoData({ valor, aoMudar, formato = 'texto', min, max, hora, abrirAoAparecer = false, aoEscolher, aoDesistir, aoMudarTexto, onBlur, ...resto }: PropsCampoData) {
  const doAparelho = useMidia(APARELHO_DE_TOQUE);
  const props = { valor, aoMudar, formato, min, max, hora, abrirAoAparecer, aoEscolher, aoDesistir, aoMudarTexto, onBlur, ...resto };
  return doAparelho ? <CampoDoAparelho {...props} /> : <CampoComCalendario {...props} />;
}

/**
 * O campo de data do próprio aparelho, que trabalha com aaaa-mm-dd; a tela continua recebendo a data no formato dela. Faz o mesmo
 * que o calendário pequeno: abre ao aparecer (com o foco nele e o calendário do aparelho aberto), avisa a escolha e aceita o Enter
 * e o Esc de um teclado ligado ao tablet. A hora, no aparelho, fica no campo de hora de quem usa o campo.
 */
function CampoDoAparelho({ valor, aoMudar, formato = 'texto', min, max, hora: _hora, abrirAoAparecer = false, aoEscolher, aoDesistir, aoMudarTexto, onKeyDown,
  placeholder: _placeholder, inputMode: _inputMode, ...resto }: PropsCampoData) {
  const f = FORMATOS_DA_DATA[formato];
  const campo = useRef<HTMLInputElement>(null);
  // Abre o calendário do aparelho logo de cara. O toque que fez o campo aparecer ainda conta como gesto da pessoa, que o navegador
  // exige; sem o showPicker (ou se o navegador recusar), fica o foco no campo, e um toque nele abre o calendário.
  useEffect(() => {
    if (!abrirAoAparecer) return;
    const el = campo.current;
    el?.focus();
    try { el?.showPicker?.(); } catch { /* o navegador não deixou: o foco basta */ }
  }, [abrirAoAparecer]);
  // A escolha vale quando o aparelho a confirma: o "change" do navegador. O onChange do React é o "input", que alguns aparelhos
  // mandam a cada giro da roda do calendário, antes de a pessoa terminar. O aviso espera o React desenhar, para chegar depois do
  // aoMudar (que o React chama no mesmo evento, mas depois deste ouvinte, que está no próprio campo).
  const aoEscolherAgora = useRef(aoEscolher);
  aoEscolherAgora.current = aoEscolher;
  const doIso = f.doIso;
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    const confirmar = () => {
      const escolhido = el.value;
      if (escolhido) setTimeout(() => aoEscolherAgora.current?.(doIso(escolhido)), 0);
    };
    el.addEventListener('change', confirmar);
    return () => el.removeEventListener('change', confirmar);
  }, [doIso]);
  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
    if (!e.defaultPrevented && e.key === 'Escape') aoDesistir?.();
  }
  return <input type="date" {...resto} ref={campo} min={min} max={max} value={f.paraIso(valor) ?? ''} onKeyDown={teclar}
    onChange={e => { aoMudar(e.target.value ? f.doIso(e.target.value) : ''); aoMudarTexto?.(e.target.value ? fmtData(e.target.value) : ''); }} />;
}

function CampoComCalendario({ valor, aoMudar, formato = 'texto', min, max, hora, abrirAoAparecer = false, aoEscolher, aoDesistir, aoMudarTexto, onBlur, onKeyDown,
  className, disabled, ...resto }: PropsCampoData) {
  const f = FORMATOS_DA_DATA[formato];
  const lugar = useContext(LugarDoCalendario);
  const caixa = useRef<HTMLSpanElement>(null), campo = useRef<HTMLInputElement>(null), calendario = useRef<HTMLDivElement>(null);
  const idDoCalendario = useId();
  // O texto no campo: como a pessoa escreveu. Muda sozinho só quando a tela troca a data por outra (ex.: um dia escolhido, o Desfazer).
  const [texto, setTexto] = useState(() => f.paraTexto(valor));
  const [visto, setVisto] = useState(valor);
  if (valor !== visto) {
    setVisto(valor);
    if (f.doTexto(texto) !== valor) setTexto(f.paraTexto(valor));
  }
  // Aberto: null (fechado), ou quantas vezes o foco foi pedido na grade (pelo botão, pela seta ou ao aparecer). 0: aberto pelo clique
  // no campo, e o foco fica nele, para escrever.
  const [aberto, setAberto] = useState<null | number>(abrirAoAparecer ? 1 : null);
  const escolhido = f.paraIso(valor);

  const abrir = (focarDia: boolean) => { if (!disabled) setAberto(atual => focarDia ? (atual ?? 0) + 1 : atual ?? 0); };
  function fechar(devolverFoco: boolean) {
    setAberto(null);
    if (devolverFoco) campo.current?.focus();
  }
  function digitar(t: string) {
    const mostrado = textoDaDataDigitada(t);
    setTexto(mostrado);
    aoMudarTexto?.(mostrado);
    const novo = f.doTexto(mostrado);
    setVisto(novo);
    aoMudar(novo);
  }
  function escolher(iso: string) {
    const novo = f.doIso(iso);
    setTexto(f.paraTexto(novo));
    aoMudarTexto?.(f.paraTexto(novo));
    setVisto(novo);
    aoMudar(novo);
    aoEscolher?.(novo);
    // Com hora, o calendário continua aberto e o foco desce para a hora; sem ela, fecha e o foco volta ao campo.
    if (!hora) fechar(true);
  }
  function teclaNoCampo(e: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); abrir(true); }
    if (e.key === 'Escape' && aberto === null) aoDesistir?.();
  }
  /**
   * O Tab saiu do calendário (#395): para a frente, o foco vai ao que vem depois do campo (a hora, o lembrete, o Salvar); para trás,
   * volta ao campo. Sem isto, o calendário que flutua no fim da página levaria o foco para fora do cartão.
   */
  function sairPeloTab(paraFrente: boolean) {
    const daData = campo.current;
    setAberto(null);
    if (!daData) return;
    const seguintes = focaveis(document).filter(el => !calendario.current?.contains(el));
    (paraFrente ? seguintes[seguintes.indexOf(daData) + 1] ?? daData : daData).focus();
  }
  /** O foco saiu do campo e do calendário (que fica fora dele, por cima da página): fecha, e só então avisa quem usa o campo. */
  function sair(e: FocusEvent<HTMLElement>) {
    const para = e.relatedTarget as Node | null;
    if (para && (caixa.current?.contains(para) || calendario.current?.contains(para))) return;
    setAberto(null);
    onBlur?.(e as FocusEvent<HTMLInputElement>);
  }

  return <span className="campo-data" ref={caixa} onBlur={sair}>
    <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" autoComplete="off" {...resto} ref={campo} className={className} disabled={disabled}
      value={texto} onChange={e => digitar(e.target.value)} onClick={() => abrir(false)} onKeyDown={teclaNoCampo}
      aria-haspopup="dialog" aria-expanded={aberto !== null} aria-controls={aberto !== null ? idDoCalendario : undefined} />
    <button type="button" className="campo-data-botao" tabIndex={-1} disabled={disabled} aria-label="Abrir o calendário" title="Abrir o calendário (ou seta para baixo no campo)"
      onClick={() => { if (aberto !== null) fechar(true); else abrir(true); }}>
      <Icone nome="calendario" tam={18} />
    </button>
    {aberto !== null && createPortal(<Calendario id={idDoCalendario} ref={calendario} ancora={caixa} noLugar={!!lugar} escolhido={escolhido} limites={{ min, max }}
      hora={hora} focarDia={aberto} aoEscolher={escolher} aoSairPeloTab={sairPeloTab}
      aoFechar={() => { fechar(true); aoDesistir?.(); }} aoTerminar={() => fechar(true)} />, lugar ?? document.body)}
  </span>;
}

interface PropsCalendario {
  id: string;
  ref: RefObject<HTMLDivElement | null>;
  /** O campo de onde o calendário abre: ele fica logo abaixo (ou acima, se não couber). */
  ancora: RefObject<HTMLElement | null>;
  /** No lugar que o formulário reservou (LugarDoCalendario): no fluxo dele, sem flutuar. */
  noLugar: boolean;
  /**
   * Sempre aberto, no fluxo de quem o usa (#422, a janela das datas do cartão): não fecha com o Esc (quem fecha é a janela em
   * volta), não rola a página até ele e o Tab segue a ordem da janela.
   */
  fixo?: boolean;
  escolhido: string | null;
  limites: LimitesDaData;
  hora?: HoraDoCampo;
  /** Quantas vezes o foco foi pedido na grade: cada pedido novo leva o foco ao dia (0: fica no campo). */
  focarDia: number;
  aoEscolher: (iso: string) => void;
  /** Esc: fecha sem escolher. */
  aoFechar: () => void;
  /** "Pronto", com a hora: fecha. */
  aoTerminar: () => void;
  /** O Tab saiu do calendário: para a frente (true) ou para trás. */
  aoSairPeloTab: (paraFrente: boolean) => void;
}

/** A caixa que rola (o cartão, a janela, a página) onde o campo está, ou nada. */
function quemRola(el: HTMLElement): HTMLElement | null {
  for (let pai = el.parentElement; pai; pai = pai.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(pai).overflowY) && pai.scrollHeight > pai.clientHeight) return pai;
  }
  return document.scrollingElement as HTMLElement | null;
}
/**
 * Rola a caixa do campo para o calendário caber embaixo dele, sem tirar o campo da tela. Devolve se rolou: não rola quando a caixa
 * não tem para onde ir (o campo já está no fim dela) ou quando o campo sairia por cima.
 */
function rolarParaCaber(campo: HTMLElement, falta: number) {
  const caixa = quemRola(campo);
  if (!caixa) return false;
  const topoVisivel = caixa === document.scrollingElement ? 0 : Math.max(0, caixa.getBoundingClientRect().top);
  const sobra = caixa.scrollHeight - caixa.clientHeight - caixa.scrollTop;
  const ateOTopo = campo.getBoundingClientRect().top - topoVisivel - MARGEM_DA_TELA;
  if (Math.min(sobra, ateOTopo) < falta) return false;
  caixa.scrollTop += Math.ceil(falta);
  return true;
}

/**
 * A posição do calendário que flutua (fixa na tela): abaixo do campo; se não couber, a caixa do campo rola para ele caber (uma vez,
 * ao abrir); se ainda não couber, acima; e, sem espaço inteiro em nenhum lado, no maior, rolando por dentro (regras/campoData.ts).
 * No lugar do formulário (noLugar), não há posição: ele fica no fluxo.
 */
function usePosicao(ancora: RefObject<HTMLElement | null>, flutuante: RefObject<HTMLElement | null>, noLugar: boolean) {
  const [pos, setPos] = useState<CSSProperties>({ top: -9999, left: 0 });
  useLayoutEffect(() => {
    if (noLugar) return;
    let jaRolou = false;
    const posicionar = () => {
      const campo = ancora.current, el = flutuante.current, a = campo?.getBoundingClientRect();
      if (!campo || !a || !el) return;
      const altura = el.scrollHeight, largura = el.offsetWidth;
      const abaixo = a.bottom + DISTANCIA_DO_BOTAO;
      const espacoAbaixo = window.innerHeight - MARGEM_DA_TELA - abaixo, espacoAcima = a.top - DISTANCIA_DO_BOTAO - MARGEM_DA_TELA;
      // O campo que acabou de aparecer ainda não tem tamanho: a rolagem espera ele estar na página.
      if (altura > espacoAbaixo && !jaRolou && a.height > 0) {
        jaRolou = true;
        if (rolarParaCaber(campo, altura - espacoAbaixo)) { posicionar(); return; }
      }
      const { lado, alturaMaxima } = ladoDoCalendario(altura, espacoAbaixo, espacoAcima);
      const usada = alturaMaxima ?? altura;
      setPos({
        top: Math.max(MARGEM_DA_TELA, lado === 'abaixo' ? abaixo : a.top - DISTANCIA_DO_BOTAO - usada),
        left: Math.max(MARGEM_DA_TELA, Math.min(a.left, window.innerWidth - largura - MARGEM_DA_TELA)),
        ...(alturaMaxima === undefined ? {} : { maxHeight: alturaMaxima, overflowY: 'auto' as const })
      });
    };
    posicionar();
    // O calendário que nasce junto com o campo (abrirAoAparecer) chega aqui antes de o campo estar na página: posiciona de novo
    // logo depois de o navegador desenhar.
    const depois = requestAnimationFrame(posicionar);
    // O cartão e as janelas rolam por dentro: o calendário acompanha o campo (captura: vale a rolagem de qualquer caixa).
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      cancelAnimationFrame(depois);
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [ancora, flutuante, noLugar]);
  return noLugar ? undefined : pos;
}

function Calendario({ id, ref, ancora, noLugar, fixo = false, escolhido, limites, hora, focarDia, aoEscolher, aoFechar, aoTerminar, aoSairPeloTab }: PropsCalendario) {
  const hoje = hojeNaAgenda();
  const [mes, setMes] = useState(() => mesAoAbrir(escolhido, hoje, limites));
  const [foco, setFoco] = useState(() => diaEmFoco(mes, escolhido, hoje, limites));
  // O foco do teclado está na grade (anda com as setas) ou fora dela (no campo, nas setas do mês, na hora).
  const [naGrade, setNaGrade] = useState(focarDia > 0);
  const grade = useRef<HTMLTableElement>(null), campoDaHora = useRef<HTMLInputElement>(null);
  const idDoTitulo = useId();
  const pos = usePosicao(ancora, ref, noLugar || fixo);
  // No lugar do formulário, o calendário que abriu embaixo da tela (a janela baixa) aparece inteiro: a caixa rola até ele.
  useEffect(() => { if (noLugar && !fixo) ref.current?.scrollIntoView?.({ block: 'nearest' }); }, [noLugar, fixo, ref]);
  const aoFecharAgora = useRef(aoFechar);
  aoFecharAgora.current = aoFechar;

  // A data escrita no campo, quando fica inteira, leva o calendário para o mês dela.
  const [escolhidoVisto, setEscolhidoVisto] = useState(escolhido);
  if (escolhido !== escolhidoVisto) {
    setEscolhidoVisto(escolhido);
    if (escolhido) { setMes(primeiroDoMes(escolhido)); setFoco(escolhido); }
  }
  // Cada pedido de foco (o botão, a seta para baixo) leva o foco ao dia; dentro da grade, o foco acompanha o dia das setas.
  const focarNoDia = () => grade.current?.querySelector<HTMLElement>('button[tabindex="0"]')?.focus();
  useEffect(() => { if (focarDia) focarNoDia(); }, [focarDia]);
  useEffect(() => { if (naGrade) focarNoDia(); }, [naGrade, foco]);
  // Esc fecha só o calendário (antes de tudo, na janela: nem a janela nem o cartão onde ele está fecham junto).
  useEffect(() => {
    if (fixo) return;
    const tecla = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); aoFecharAgora.current(); } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [fixo]);

  function irAoMes(novo: string) {
    setMes(novo);
    setFoco(diaEmFoco(novo, escolhido, hoje, limites));
  }
  function teclaNaGrade(e: KeyboardEvent<HTMLButtonElement>) {
    const novo = andarComTecla(foco, e.key, e.shiftKey, limites);
    if (!novo) return;
    e.preventDefault();
    setFoco(novo);
    if (!doMes(novo, mes)) setMes(primeiroDoMes(novo));
  }
  function escolher(dia: string) {
    aoEscolher(dia);
    if (hora) setTimeout(() => campoDaHora.current?.focus(), 0);
  }
  const anterior = somarMeses(mes, -1), seguinte = somarMeses(mes, 1);

  /** O Tab no primeiro (para trás) ou no último (para a frente) do calendário sai dele: para o campo ou para o que vem depois. */
  function tabNasPontas(e: KeyboardEvent<HTMLDivElement>) {
    if (fixo) return;
    const lista = focaveis(e.currentTarget), ponta = e.shiftKey ? lista[0] : lista[lista.length - 1];
    if (!ponta || document.activeElement !== ponta) return;
    e.preventDefault();
    aoSairPeloTab(!e.shiftKey);
  }

  // Sempre aberto (fixo), ele é uma parte da janela em volta (um grupo), e não uma janela própria por cima dela.
  return <div className={noLugar || fixo ? 'campo-data-calendario no-lugar' : 'campo-data-calendario'} role={fixo ? 'group' : 'dialog'} aria-modal={fixo ? undefined : false}
    aria-label="Calendário" id={id}
    ref={ref} tabIndex={-1} style={pos}
    // O Enter fica com o calendário: não passa para o formulário de fora (que iria para o próximo campo ou salvaria).
    onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); if (e.key === 'Tab') tabNasPontas(e); }}>
    <div className="campo-data-topo">
      <button type="button" className="campo-data-mes" aria-label="Mês anterior" disabled={mesForaDosLimites(anterior, limites)} onClick={() => irAoMes(anterior)}>
        <Icone nome="esquerda" tam={18} />
      </button>
      <span className="campo-data-titulo" id={idDoTitulo} aria-live="polite">{tituloDoMes(mes)}</span>
      <button type="button" className="campo-data-mes" aria-label="Próximo mês" disabled={mesForaDosLimites(seguinte, limites)} onClick={() => irAoMes(seguinte)}>
        <Icone nome="direita" tam={18} />
      </button>
    </div>
    <table className="campo-data-grade" role="grid" aria-labelledby={idDoTitulo} ref={grade} onFocus={() => setNaGrade(true)}
      onBlur={e => { if (!grade.current?.contains(e.relatedTarget as Node | null)) setNaGrade(false); }}>
      <thead><tr>{DIAS_DO_CABECALHO.map(d => <th key={d.nome} scope="col" abbr={d.nome}><span aria-hidden="true">{d.inicial}</span><span className="sr">{d.nome}</span></th>)}</tr></thead>
      <tbody>{semanasDoMes(mes).map(semana => <tr key={semana[0]}>
        {semana.map(dia => <Dia key={dia} dia={dia} foco={dia === foco} escolhido={dia === escolhido} hoje={dia === hoje} doMes={doMes(dia, mes)}
          pode={dentroDosLimites(dia, limites)} aoEscolher={() => escolher(dia)} aoTeclar={teclaNaGrade} />)}
      </tr>)}</tbody>
    </table>
    <div className="campo-data-rodape">
      {hora && <label className="campo-data-hora">Hora
        <input type="time" ref={campoDaHora} value={hora.valor} onChange={e => hora.aoMudar(e.target.value)} />
      </label>}
      <span className="campo-data-acoes">
        {dentroDosLimites(hoje, limites) && <BotaoDoRodape aoClicar={() => { irAoMes(primeiroDoMes(hoje)); escolher(hoje); }}>Hoje</BotaoDoRodape>}
        {hora && <BotaoDoRodape aoClicar={aoTerminar}>Pronto</BotaoDoRodape>}
      </span>
    </div>
  </div>;
}

/** Um dia na grade: só o dia em foco entra na ordem do Tab (as setas passam aos outros). */
function Dia({ dia, foco, escolhido, hoje, doMes: doMesMostrado, pode, aoEscolher, aoTeclar }: {
  dia: string; foco: boolean; escolhido: boolean; hoje: boolean; doMes: boolean; pode: boolean; aoEscolher: () => void; aoTeclar: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return <td role="gridcell" aria-selected={escolhido}>
    <button type="button" tabIndex={foco ? 0 : -1} disabled={!pode} aria-label={nomeDoDia(dia) + (hoje ? ' (hoje)' : '')} aria-current={hoje ? 'date' : undefined}
      data-fora-do-mes={doMesMostrado ? undefined : true} onClick={aoEscolher} onKeyDown={aoTeclar}>
      {numeroDoDia(dia)}
    </button>
  </td>;
}

/** Para o calendário fixo, que não fecha nem solta o Tab: nada a fazer. */
const nada = () => undefined;

/**
 * O calendário do mês sempre aberto, no fluxo de quem o usa (#422: a janela das datas do cartão). É o mesmo calendário do campo de
 * data (a grade, o teclado, o "Hoje"), sem o campo: a escolha do dia vai para quem o usa.
 */
export function CalendarioDoMes({ escolhido, aoEscolher, min, max }: { escolhido: string | null; aoEscolher: (iso: string) => void; min?: string; max?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  // A âncora não conta: no fluxo, o calendário não tem posição.
  return <Calendario id={id} ref={ref} ancora={ref} noLugar fixo escolhido={escolhido} limites={{ min, max }} focarDia={0} aoEscolher={aoEscolher}
    aoFechar={nada} aoTerminar={nada} aoSairPeloTab={nada} />;
}

/** "Hoje" e "Pronto", no rodapé do calendário: o botão pequeno de sempre (estiloBotao, forma "mini"). */
function BotaoDoRodape({ aoClicar, children }: { aoClicar: () => void; children: ReactNode }) {
  return <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={aoClicar}>{children}</button>;
}
