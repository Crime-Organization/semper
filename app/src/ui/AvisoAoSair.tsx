// Pergunta antes de sair de um cadastro novo com algo preenchido (#82): pelo X, pelo Esc, pelo menu, por um link ou pelo Voltar do
// navegador. Ao fechar ou recarregar a aba, quem pergunta é o próprio navegador.
// Entra na tela do cadastro novo e, desde a #339, na edição no próprio lugar (o título e o texto da anotação), que diz direto
// se há o que perder ("preenchido"). Um só por vez: o roteador só segura uma saída de cada vez.
import { useEffect, useRef, type RefObject } from 'react';
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

/** Diz se o cadastro aberto agora tem algo a perder. */
let temAlgoAPerder = () => false;
/** Diz se o cadastro aberto está sendo salvo. */
let salvandoAgora = () => false;
/** Grava o que falta, no texto que salva sozinho (null: o que está aberto não grava sozinho). */
let salvarAgora: (() => Promise<boolean>) | null = null;
/** Avisa o cadastro aberto de que a saída que ele segurou não aconteceu: a pessoa continua nele. */
let ficarAgora = () => {};
const ESPERE_SALVAR = 'Espere terminar de salvar.';

/** Para quem precisa perguntar antes de agir, como o botão Sair do sistema: sem isto, a sessão acabaria antes da pergunta. */
export async function podeSairDoCadastro() {
  // O texto que salva sozinho grava antes de sair; só se a gravação falhar, a pergunta aparece.
  if (temAlgoAPerder() && salvarAgora && await salvarAgora()) return true;
  if (salvandoAgora()) {
    avisar(ESPERE_SALVAR);
    ficarAgora();
    return false;
  }
  const sai = !temAlgoAPerder() || !!await perguntarSeSai();
  if (!sai) ficarAgora();
  return sai;
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

  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    temAlgoAPerder = () => agora.current.preenchido && !liberada.current;
    salvandoAgora = () => agora.current.ocupado;
    salvarAgora = () => salvar.current?.() ?? Promise.resolve(false);
    ficarAgora = () => ficar.current?.();
    return () => { montado.current = false; temAlgoAPerder = () => false; salvandoAgora = () => false; salvarAgora = null; ficarAgora = () => {}; };
  }, [liberada]);

  // Qualquer navegação perde o preenchido, mesmo para o mesmo endereço: cada abertura do cadastro começa um formulário novo (App.tsx).
  const bloqueio = useBlocker(({ nextLocation, historyAction }) =>
    temAlgoAPerder() && !ENTRADA.test(nextLocation.pathname) && !ficaNaTela(nextLocation.state, historyAction));
  const perguntando = useRef(false);
  useEffect(() => {
    if (bloqueio.state !== 'blocked' || perguntando.current) return;
    const gravarAntes = salvar.current;
    if (gravarAntes) {
      perguntando.current = true;
      void gravarAntes().then(async gravou => {
        const sair = gravou || !!await perguntarSeSai();
        perguntando.current = false;
        if (!montado.current) return;
        if (sair) { if (!gravou) descartar.current?.(); bloqueio.proceed(); }
        else { bloqueio.reset(); ficar.current?.(); }
      });
      return;
    }
    if (agora.current.ocupado) {
      avisar(ESPERE_SALVAR);
      bloqueio.reset();
      ficar.current?.();
      return;
    }
    perguntando.current = true;
    void perguntarSeSai().then(sair => {
      perguntando.current = false;
      if (!montado.current) return;   // a sessão acabou com a pergunta aberta: o bloqueio já não existe
      if (sair) { descartar.current?.(); bloqueio.proceed(); }
      else { bloqueio.reset(); ficar.current?.(); }
    });
  }, [bloqueio]);

  useEffect(() => {
    if (!preenchido) return;
    const segurar = (e: BeforeUnloadEvent) => { if (!liberada.current) e.preventDefault(); };
    window.addEventListener('beforeunload', segurar);
    return () => window.removeEventListener('beforeunload', segurar);
  }, [preenchido, liberada]);

  return null;
}
