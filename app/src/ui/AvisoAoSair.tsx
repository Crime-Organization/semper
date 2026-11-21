// Pergunta antes de sair de um cadastro novo com algo preenchido (#82): pelo X, pelo Esc, pelo menu, por um link ou pelo Voltar do
// navegador. Ao fechar ou recarregar a aba, quem pergunta é o próprio navegador.
// Entra na tela do cadastro novo e, desde a #339, na edição no próprio lugar (o título e o texto da anotação), que diz direto
// se há o que perder ("preenchido"). Desde a #395, também no lápis dos cartões.
// Pode haver mais de um na tela ao mesmo tempo (no mesmo cartão, o lápis aberto e a descrição mudada no lugar): o que eles têm a
// perder se soma, numa pergunta só, e cada um, ao sair da tela, tira só o que é dele. O roteador só segura uma saída de cada
// vez: quem a segura é o primeiro aviso da tela, em nome de todos.
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { NavigationType, useBlocker } from 'react-router';
import { avisar } from './avisos';
import { janela } from './janela';

const perguntarSeSai = () => janela<boolean>({
  titulo: 'Sair sem salvar?',
  corpo: <p>O que você preencheu neste cadastro será perdido.</p>,
  acoes: [{ rotulo: 'Continuar no cadastro', valor: false }, { rotulo: 'Sair sem salvar', valor: true, tipo: 'perigo' }]
});

/** Como a pessoa muda um campo: digitando, escolhendo uma opção, por preenchimento automático ou ditado. */
const EVENTOS_DE_CAMPO = ['input', 'change'] as const;
/** Opção e caixa de marcar: a tela já muda no clique, antes do "input" e do "change". */
const ehOpcaoOuCaixa = (alvo: EventTarget | null) => alvo instanceof HTMLInputElement && (alvo.type === 'radio' || alvo.type === 'checkbox');
/** A entrada do sistema: quem vai para lá já não tem sessão (saiu, a sessão acabou, a conta foi desativada), e não há como continuar. */
const ENTRADA = /^\/entrar\/?$/;
/**
 * A marca, no estado da navegação, de que ela não sai da tela: só troca o endereço dela, no lugar do atual (a anotação nova que
 * acabou de ir ao banco passa a ter o endereço dela, #369). Essa troca não é segurada; o Voltar e os links continuam sendo.
 */
export const SEM_SAIR_DA_TELA = 'semSairDaTela';
const ficaNaTela = (estado: unknown, acao: NavigationType) =>
  acao === NavigationType.Replace && !!estado && typeof estado === 'object' && SEM_SAIR_DA_TELA in estado;

/** Um aviso na tela: o que ele sabe do formulário dele. */
interface Vigia {
  /** Tem algo a perder agora. */
  perde: () => boolean;
  /** Está sendo salvo. */
  salvando: () => boolean;
  /** Grava o que falta, no texto que salva sozinho (undefined: este não grava sozinho). */
  gravar: () => (() => Promise<boolean>) | undefined;
  /** A pessoa escolheu "Sair sem salvar". */
  descartar: () => void;
  /** A saída segurada não aconteceu: a pessoa continua na tela. */
  ficar: () => void;
}
/** Os avisos na tela, na ordem em que entraram. */
const vigias: Vigia[] = [];
const ouvintes = new Set<() => void>();
const assinar = (ouvinte: () => void) => { ouvintes.add(ouvinte); return () => { ouvintes.delete(ouvinte); }; };
const avisarOuvintes = () => ouvintes.forEach(ouvinte => ouvinte());

const temAlgoAPerder = () => vigias.some(v => v.perde());
const salvandoAgora = () => vigias.some(v => v.salvando());
const ficarTodos = () => vigias.forEach(v => v.ficar());
const ESPERE_SALVAR = 'Espere terminar de salvar.';

/**
 * Antes de sair, grava o que salva sozinho. Diz se, com isso, nada mais se perde (true), se algo continua a perder (false), ou
 * null quando nada do que se perde grava sozinho.
 */
async function gravarAntes(aPerder: Vigia[]): Promise<boolean | null> {
  const gravacoes = aPerder.map(v => v.gravar()).filter(g => !!g);
  if (!gravacoes.length) return null;
  const gravou = await Promise.all(gravacoes.map(g => g()));
  return gravou.every(Boolean) && gravacoes.length === aPerder.length;
}

/** Para quem precisa perguntar antes de agir, como o botão Sair do sistema: sem isto, a sessão acabaria antes da pergunta. */
export async function podeSairDoCadastro() {
  // O texto que salva sozinho grava antes de sair; só se a gravação falhar (ou houver mais o que perder), a pergunta aparece.
  const aPerder = vigias.filter(v => v.perde());
  if (aPerder.length && await gravarAntes(aPerder)) return true;
  if (salvandoAgora()) {
    avisar(ESPERE_SALVAR);
    ficarTodos();
    return false;
  }
  const sai = !temAlgoAPerder() || !!await perguntarSeSai();
  if (!sai) ficarTodos();
  return sai;
}

/**
 * A saída que o roteador segurou: grava antes o que salva sozinho, espera o que está sendo salvo e, se ainda houver o que perder,
 * pergunta. Diz se a pessoa sai. Saindo, o que ela mandou descartar é descartado (a tela pode continuar ao fundo: a anotação nova
 * abre por cima do cartão); ficando, todos os avisos sabem que ela ficou.
 */
async function decidirASaida(): Promise<boolean> {
  const aPerder = vigias.filter(v => v.perde());
  const gravou = await gravarAntes(aPerder);
  if (gravou) return true;
  if (gravou === null && salvandoAgora()) {
    avisar(ESPERE_SALVAR);
    ficarTodos();
    return false;
  }
  const sai = !!await perguntarSeSai();
  if (sai) aPerder.forEach(v => v.descartar());
  else ficarTodos();
  return sai;
}

/** Segura a saída no roteador, em nome de todos os avisos da tela (o roteador só aceita um). */
function SeguraASaida() {
  // Qualquer navegação perde o preenchido, mesmo para o mesmo endereço: cada abertura do cadastro começa um formulário novo (App.tsx).
  const bloqueio = useBlocker(({ nextLocation, historyAction }) =>
    temAlgoAPerder() && !ENTRADA.test(nextLocation.pathname) && !ficaNaTela(nextLocation.state, historyAction));
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const perguntando = useRef(false);
  useEffect(() => {
    if (bloqueio.state !== 'blocked' || perguntando.current) return;
    perguntando.current = true;
    void decidirASaida().then(sair => {
      perguntando.current = false;
      if (!montado.current) return;   // a sessão acabou com a pergunta aberta: o bloqueio já não existe
      if (sair) bloqueio.proceed();
      else bloqueio.reset();
    });
  }, [bloqueio]);
  return null;
}

interface PropsDoAviso {
  /** Os campos do formulário. Se ficarem diferentes de como estavam quando a pessoa mexeu num campo pela primeira vez, há o que perder. */
  estado?: unknown;
  /**
   * Para quem já sabe se há o que perder (a edição no próprio lugar compara o rascunho com o que está gravado): vale no lugar da
   * comparação de "estado".
   */
  preenchido?: boolean;
  /** O formulário marca como true logo antes de sair por conta própria (salvou, ou a pessoa escolheu ver outro cadastro). */
  liberada: RefObject<boolean>;
  /** Salvando: a saída espera, porque o cadastro pode acabar criado depois de a pessoa ter escolhido sair. */
  ocupado: boolean;
  /**
   * A pessoa escolheu "Sair sem salvar": chamado logo antes de sair. Para a edição no próprio lugar, que pode continuar na tela
   * ao fundo (a anotação nova abre por cima do cartão): o que ela mandou descartar é descartado, e não salvo depois.
   */
  aoDescartar?: () => void;
  /**
   * O texto que salva sozinho (a anotação): ao sair com algo ainda por gravar, grava antes (esperando a gravação que já corre) e
   * só então sai, sem perguntar. Se a gravação falhar, a pergunta de sempre aparece.
   */
  salvarAntes?: () => Promise<boolean>;
  /**
   * A saída segurada não aconteceu: a pessoa escolheu continuar (ou a saída esperou salvar). Para quem adia algo enquanto a saída
   * está segurada: a anotação nova que foi ao banco no meio dela só troca de endereço agora (#369), porque qualquer navegação que
   * termina com a saída segurada desfaz o bloqueio do roteador, e a saída se perderia.
   */
  aoFicar?: () => void;
}

export function AvisoAoSair({ estado, preenchido: jaSabe, liberada, ocupado, aoDescartar, salvarAntes, aoFicar }: PropsDoAviso) {
  const descartar = useRef(aoDescartar);
  descartar.current = aoDescartar;
  const ficar = useRef(aoFicar);
  ficar.current = aoFicar;
  const salvar = useRef(salvarAntes);
  salvar.current = salvarAntes;
  const atual = JSON.stringify(estado);
  // Até a pessoa mexer num campo, o que muda veio do sistema (dados da pessoa escolhida, parâmetros do endereço), e não há o que perder.
  const mexeu = useRef(false);
  const base = useRef(atual);
  if (!mexeu.current) base.current = atual;
  const preenchido = jaSabe ?? atual !== base.current;
  const agora = useRef({ preenchido, ocupado });
  agora.current = { preenchido, ocupado };

  useEffect(() => {
    const marcar = () => { mexeu.current = true; };
    const marcarOpcao = (e: MouseEvent) => { if (ehOpcaoOuCaixa(e.target)) marcar(); };
    // Na captura: fica marcado antes de o formulário mudar os campos.
    for (const evento of EVENTOS_DE_CAMPO) document.addEventListener(evento, marcar, true);
    document.addEventListener('click', marcarOpcao, true);
    return () => {
      for (const evento of EVENTOS_DE_CAMPO) document.removeEventListener(evento, marcar, true);
      document.removeEventListener('click', marcarOpcao, true);
    };
  }, []);

  // Este aviso entra na lista dos da tela e, ao sair, tira só a própria entrada: os outros continuam valendo.
  const [vigia] = useState<Vigia>(() => ({
    perde: () => agora.current.preenchido && !liberada.current,
    salvando: () => agora.current.ocupado,
    gravar: () => salvar.current,
    descartar: () => descartar.current?.(),
    ficar: () => ficar.current?.()
  }));
  useEffect(() => {
    vigias.push(vigia);
    avisarOuvintes();
    return () => {
      const onde = vigias.indexOf(vigia);
      if (onde >= 0) vigias.splice(onde, 1);
      avisarOuvintes();
    };
  }, [vigia]);
  const seguraASaida = useSyncExternalStore(assinar, () => vigias[0] === vigia);

  useEffect(() => {
    if (!preenchido) return;
    const segurar = (e: BeforeUnloadEvent) => { if (!liberada.current) e.preventDefault(); };
    window.addEventListener('beforeunload', segurar);
    return () => window.removeEventListener('beforeunload', segurar);
  }, [preenchido, liberada]);

  return seguraASaida ? <SeguraASaida /> : null;
}
