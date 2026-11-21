// Painel do cartão, sobre um véu: abre ao lado (desliza da direita) ou numa janela no centro da tela, como no Trello.
// Cada usuário escolhe no botão ao lado do "X", e a escolha fica nas preferências dele (vale para os cartões de todos os
// módulos, em qualquer aparelho). Esc ou clique fora fecham (se não houver janela aberta).
// Na janela no centro há uma coluna à direita: ColunaDoCartao diz onde ela está (no painel ao lado, não há coluna, e o que iria
// para ela fica no pé do cartão, na mesma ordem).
// Com "soNoCentro" (o cadastro novo, numa janela sobre a página), é sempre a janela no centro, sem a coluna e sem a
// troca, e o clique fora não fecha. "rotulo" dá nome à janela para o leitor de tela (padrão: "Cadastro", no cadastro; nos
// outros cartões, só com o rótulo pedido, como "Anotação").
// Com "largo" (um texto para ler e escrever, a anotação), a janela no centro ocupa quase toda a tela, com uma margem estreita em
// volta (no celular, como as outras).
// O que um cartão põe na coluna da direita (NaColunaDoCartao: em todos os cartões, os comentários, as anotações e o histórico, #360, e no processo também os andamentos, #362;
// na anotação, os comentários, "Ligada a" e o histórico) são seções que recolhem, num grupo só delas (pedido do dono de 18/11). Desde a
// #397, no alto da coluna fica uma linha só com três botões redondos, à direita, na altura da linha de cima do cartão: o "Expandir
// tudo" / "Recolher tudo" das seções da coluna, o abrir ao lado / no centro e o X. Os dois últimos são os botões da janela (o grupo
// "Botões da janela"); o "Expandir tudo" continua dentro da coluna, logo antes das seções que abre (a ordem do Tab vai do cartão
// para a coluna), e o estilo o leva para a linha deles (.cartao-coluna .secoes-todas, em estilo.css). Sem a coluna (ao lado, na janela estreita, no celular), o abrir ao lado e o X continuam no alto do cartão, por cima da linha de
// cima, e o "Expandir tudo" dessas seções fica acima da primeira delas, no alto da parte de baixo.
// Uma tela dentro do painel pode travá-lo com useTravarPainel(motivo) (ex.: enquanto grava uma importação): aí o Esc,
// o X e o clique fora não fecham, e o motivo aparece num aviso.
// As seções que recolhem do corpo (a coluna da esquerda) ficam num grupo (GrupoDeSecoes), com o botão "Expandir tudo" sozinho acima da
// primeira (#394), que só abre e fecha as delas. Em volta de tudo, a coluna
// também, o registro das coisas do cartão (ComAtalhosDoCartao, #351, #399): as seções da coluna oferecem as delas ao menu do "+" do topo.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { avisar } from './avisos';
import { Icone, type NomeIcone } from './Icone';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { GrupoDeSecoes } from './Recolhivel';
import { ComAtalhosDoCartao } from './registroDeAtalhos';
import { travarRolagem } from './rolagem';

type FormatoCartao = 'lado' | 'centro';
/** Em cada formato, o botão oferece o outro. */
const FORMATOS: Record<FormatoCartao, { outro: FormatoCartao; rotulo: string; icone: NomeIcone }> = {
  lado: { outro: 'centro', rotulo: 'Abrir no centro da tela', icone: 'centro' },
  centro: { outro: 'lado', rotulo: 'Abrir ao lado', icone: 'lado' }
};
export const PREFERENCIA_FORMATO = 'cartao.formato';
/** O nome da janela do cadastro novo para o leitor de tela, quando quem a abre não dá outro. */
const NOME_DO_CADASTRO = 'Cadastro';
/** A coluna da direita da janela no centro (null no painel ao lado). */
export const ColunaDoCartao = createContext<HTMLElement | null>(null);
/**
 * O nome dos botões da janela (o abrir ao lado / no centro e o X), para o leitor de tela. Os botões do cartão que vão para junto
 * deles (ao lado e na janela estreita: a etiqueta, o lápis e o ⋯) ficam fora desse grupo, no deles.
 */
export const BOTOES_DA_JANELA = 'Botões da janela';
/**
 * O alcance de cada "Expandir tudo" do cartão, no nome dele (#397: são dois, e o leitor de tela precisa distinguir): com a coluna da
 * direita (o centro largo), o de cada coluna; sem ela (ao lado, na janela estreita, no celular), o do alto e o do pé do cartão, onde
 * as seções da coluna ficam. A dica continua só "Expandir tudo".
 */
const ALCANCE_DO_EXPANDIR = {
  comColuna: { corpo: 'da coluna da esquerda', coluna: 'da coluna da direita' },
  semColuna: { corpo: 'do alto do cartão', coluna: 'do pé do cartão' }
} as const;
const alcanceDoExpandir = (comColuna: boolean) => ALCANCE_DO_EXPANDIR[comColuna ? 'comColuna' : 'semColuna'];
/** Se a tela está dentro de NaColunaDoCartao (os comentários da anotação, que já vão no grupo da coluna). */
const DentroDaColuna = createContext(false);
export const useDentroDaColuna = () => useContext(DentroDaColuna);
/**
 * Põe o que vem dentro na coluna da direita, quando há uma; sem a coluna (ao lado e na janela estreita), fica ali mesmo, no fluxo
 * do cartão, antes do rodapé. As seções que recolhem formam sempre um grupo só delas (GrupoDeSecoes), com um "Expandir tudo" /
 * "Recolher tudo" acima da primeira delas, que abre e fecha só as delas (#397): na coluna, o estilo o leva para a linha dos botões
 * da janela, à esquerda do abrir ao lado e do X; no fluxo, ele fica acima da primeira (a primeira da parte de baixo), à direita, no
 * eixo das setas.
 * O que vem dentro fica sempre na mesma caixa, um elemento só, que muda de lugar (vai para a coluna ou para o lugar marcado no
 * fluxo): trocar o formato da janela não desmonta nada, e o comentário que se escrevia, a busca aberta e as seções abertas
 * continuam como estavam.
 */
export function NaColunaDoCartao({ children }: { children: ReactNode }) {
  const coluna = useContext(ColunaDoCartao);
  const lugar = useRef<HTMLDivElement>(null);
  const [caixa] = useState(() => Object.assign(document.createElement('div'), { className: 'cartao-coluna-secoes' }));
  useLayoutEffect(() => {
    (coluna ?? lugar.current)?.append(caixa);
    return () => caixa.remove();
  }, [coluna, caixa]);
  return <>
    <div className="cartao-coluna-lugar" ref={lugar} />
    {createPortal(<DentroDaColuna.Provider value={true}><GrupoDeSecoes alcance={alcanceDoExpandir(!!coluna).coluna}>{children}</GrupoDeSecoes></DentroDaColuna.Provider>, caixa)}
  </>;
}
/**
 * O lugar, na linha dos botões do painel (ao lado do formato e do "X"), para os botões do cartão (a etiqueta, o lápis e o ⋯, #382).
 * Vale no painel ao lado e na janela estreita, onde os botões do painel ficam por cima do cartão; na janela larga
 * (null), eles ficam no próprio cartão, encostados à direita do conteúdo.
 */
export const BotoesNoPainel = createContext<HTMLElement | null>(null);
/** Como travar o painel em que a tela está (fora de um painel, não faz nada). */
export const TravaDoPainel = createContext<(motivo: string | null) => void>(() => {});
/**
 * Enquanto houver motivo, o painel não fecha (Esc, X e clique fora mostram o motivo num aviso). Com null, ou quando
 * a tela sai, o painel volta a fechar.
 */
export function useTravarPainel(motivo: string | null) {
  const travar = useContext(TravaDoPainel);
  useEffect(() => {
    travar(motivo);
    return () => travar(null);
  }, [travar, motivo]);
}
/** Fecha, a não ser que o painel esteja travado: aí só avisa o motivo. */
function tentarFechar(trava: string | null, fechar: () => void) {
  if (trava) avisar(trava, 'erro');
  else fechar();
}
/**
 * Janela estreita: não há a coluna, e o que iria para ela fica no pé do cartão, antes do rodapé, como ao lado (#360). A mesma medida
 * de estilo.css, onde a janela no centro passa a ter uma coluna só.
 */
const JANELA_ESTREITA = '(max-width: 900px)';
function useEstreita() {
  const [estreita, setEstreita] = useState(() => window.matchMedia?.(JANELA_ESTREITA).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(JANELA_ESTREITA);
    if (!m) return;
    const mudou = () => setEstreita(m.matches);
    m.addEventListener('change', mudou);
    return () => m.removeEventListener('change', mudou);
  }, []);
  return estreita;
}
const formatoGuardado = (): FormatoCartao => {
  const f = lerPreferencia<string>(PREFERENCIA_FORMATO, 'lado');
  return f in FORMATOS ? f as FormatoCartao : 'lado';
};

interface PropsPainel {
  aoFechar: () => void;
  soNoCentro?: boolean;
  /** Nome da janela para o leitor de tela (ex.: "Importar pessoas", "Anotação"; no cadastro, sem ele, "Cadastro"). */
  rotulo?: string;
  /** A janela no centro fica da altura do que mostra (um formulário curto), em vez de ocupar a tela toda. */
  ajustado?: boolean;
  /** A janela no centro ocupa quase toda a tela (ao lado, o painel continua do tamanho de sempre). */
  largo?: boolean;
  children: ReactNode;
}
export function PainelCartao({ aoFechar, soNoCentro = false, rotulo, ajustado = false, largo = false, children }: PropsPainel) {
  const [on, setOn] = useState(false);
  const [escolhido, setFormato] = useState(formatoGuardado);
  const formato: FormatoCartao = soNoCentro ? 'centro' : escolhido;
  const [coluna, setColuna] = useState<HTMLElement | null>(null);
  const [vaga, setVaga] = useState<HTMLElement | null>(null);
  const estreita = useEstreita();
  const comColuna = formato === 'centro' && !soNoCentro && !estreita;
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  const trava = useRef<string | null>(null);
  const [travar] = useState(() => (motivo: string | null) => { trava.current = motivo; });
  const pedirParaFechar = () => tentarFechar(trava.current, fechar.current);
  useEffect(() => {
    const soltarRolagem = travarRolagem();
    // O foco vai ao painel, a não ser que a tela de dentro já o tenha posto num campo dela (o título da anotação nova, #339).
    const r = requestAnimationFrame(() => {
      setOn(true);
      if (!painel.current?.contains(document.activeElement)) painel.current?.focus();
    });
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.veu-janela')) tentarFechar(trava.current, fechar.current); };
    document.addEventListener('keydown', tecla);
    return () => { cancelAnimationFrame(r); document.removeEventListener('keydown', tecla); soltarRolagem(); };
  }, []);
  function trocarFormato() {
    const outro = FORMATOS[formato].outro;
    setFormato(outro);
    salvarPreferencia(PREFERENCIA_FORMATO, outro);
  }
  const { rotulo: rotuloDoFormato, icone } = FORMATOS[formato];
  return createPortal(<>
    {/* No cadastro, um clique fora não fecha (perderia o que foi digitado): só o X ou o Esc. */}
    <div className={'veu' + (on ? ' on' : '')} onClick={() => { if (!soNoCentro) pedirParaFechar(); }} />
    <aside className={`cartao-painel ${formato}` + (soNoCentro ? ' sem-coluna' : '') + (ajustado ? ' ajustado' : '') + (largo ? ' largo' : '') + (on ? ' on' : '')} role="dialog" aria-modal="true" aria-label={rotulo ?? (soNoCentro ? NOME_DO_CADASTRO : undefined)} tabIndex={-1} ref={painel}>
      <div className="cartao-botoes">
        <span className="cartao-botoes-do-cartao" ref={setVaga} />
        <span className="cartao-botoes-da-janela" role="group" aria-label={BOTOES_DA_JANELA}>
          {!soNoCentro && <button type="button" className="cartao-botao cartao-formato" aria-label={rotuloDoFormato} title={rotuloDoFormato} onClick={trocarFormato}><Icone nome={icone} tam={18} /></button>}
          <button type="button" className="cartao-botao" aria-label="Fechar" onClick={pedirParaFechar}><Icone nome="fechar" tam={18} /></button>
        </span>
      </div>
      <div className="cartao-conteudo">
        <ComAtalhosDoCartao>
        <TravaDoPainel.Provider value={travar}>
          <ColunaDoCartao.Provider value={comColuna ? coluna : null}>
            {/* Sem a coluna, os botões do painel ficam por cima do cartão: os do cartão vão para junto deles. */}
            <BotoesNoPainel.Provider value={formato === 'lado' || estreita ? vaga : null}>
              <GrupoDeSecoes alcance={alcanceDoExpandir(comColuna).corpo}>
                <div className="cartao-corpo">{children}</div>
              </GrupoDeSecoes>
            </BotoesNoPainel.Provider>
          </ColunaDoCartao.Provider>
        </TravaDoPainel.Provider>
        </ComAtalhosDoCartao>
        {comColuna && <div className="cartao-coluna" ref={setColuna} />}
      </div>
    </aside>
  </>, document.body);
}
