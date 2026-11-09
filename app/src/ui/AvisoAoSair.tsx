// Pergunta antes de sair de um cadastro novo com algo preenchido (#82): pelo X, pelo Esc, pelo menu, por um link ou pelo Voltar do
// navegador. Ao fechar ou recarregar a aba, quem pergunta é o próprio navegador.
// Só entra na tela do cadastro novo: a edição dentro do cartão não usa este aviso.
import { useEffect, useRef, type RefObject } from 'react';
import { useBlocker } from 'react-router';
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

/** Diz se o cadastro aberto agora tem algo a perder. */
let temAlgoAPerder = () => false;
/** Diz se o cadastro aberto está sendo salvo. */
let salvandoAgora = () => false;
const ESPERE_SALVAR = 'Espere terminar de salvar.';

/** Para quem precisa perguntar antes de agir, como o botão Sair do sistema: sem isto, a sessão acabaria antes da pergunta. */
export async function podeSairDoCadastro() {
  if (salvandoAgora()) {
    avisar(ESPERE_SALVAR);
    return false;
  }
  return !temAlgoAPerder() || !!await perguntarSeSai();
}

interface PropsDoAviso {
  /** Os campos do formulário. Se ficarem diferentes de como estavam quando a pessoa mexeu num campo pela primeira vez, há o que perder. */
  estado: unknown;
  /** O formulário marca como true logo antes de sair por conta própria (salvou, ou a pessoa escolheu ver outro cadastro). */
  liberada: RefObject<boolean>;
  /** Salvando: a saída espera, porque o cadastro pode acabar criado depois de a pessoa ter escolhido sair. */
  ocupado: boolean;
}

export function AvisoAoSair({ estado, liberada, ocupado }: PropsDoAviso) {
  const atual = JSON.stringify(estado);
  // Até a pessoa mexer num campo, o que muda veio do sistema (dados da pessoa escolhida, parâmetros do endereço), e não há o que perder.
  const mexeu = useRef(false);
  const base = useRef(atual);
  if (!mexeu.current) base.current = atual;
  const preenchido = atual !== base.current;
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
    return () => { montado.current = false; temAlgoAPerder = () => false; salvandoAgora = () => false; };
  }, [liberada]);

  // Qualquer navegação perde o preenchido, mesmo para o mesmo endereço: cada abertura do cadastro começa um formulário novo (App.tsx).
  const bloqueio = useBlocker(({ nextLocation }) => temAlgoAPerder() && !ENTRADA.test(nextLocation.pathname));
  const perguntando = useRef(false);
  useEffect(() => {
    if (bloqueio.state !== 'blocked' || perguntando.current) return;
    if (agora.current.ocupado) {
      avisar(ESPERE_SALVAR);
      bloqueio.reset();
      return;
    }
    perguntando.current = true;
    void perguntarSeSai().then(sair => {
      perguntando.current = false;
      if (!montado.current) return;   // a sessão acabou com a pergunta aberta: o bloqueio já não existe
      if (sair) bloqueio.proceed();
      else bloqueio.reset();
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
