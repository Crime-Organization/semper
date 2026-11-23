// O botão "+ Adicionar…" que abre uma busca só na equipe (#282). É a metade de baixo de EscolhaDaEquipe e também a busca de
// participantes do contrato (#348), onde cada escolhido ganha uma linha com o seu %: quem usa diz quem a busca acha
// (`buscar`) e o que fazer com quem foi escolhido (`aoEscolher`). No topo dos cartões (#356), o botão é a bolinha redonda
// com "+", ao lado das bolinhas da equipe, e a busca abre por cima, presa a ela (`bolinha`). A bolinha vazia (o cartão sem
// responsável) usa a mesma busca, no lugar do "+": clicar nela abre direto a escolha. A do responsável abre um menu (#388), e o
// "Trocar o responsável" dele abre esta busca presa à bolinha (BuscaPresa).
// A lista dos achados mostra só os nomes, um embaixo do outro e alinhados à esquerda (a bolinha na frente de cada nome
// atrapalhava a leitura, e a lista centralizava os nomes dentro do painel: veja .achados em estilo.css).
// Com `grupos` (#378: o escritório tem grupos da equipe), a lista vem em duas partes com título, primeiro "Pessoas" e depois
// "Grupos da equipe"; o Enter escolhe a primeira pessoa e só escolhe um grupo quando não há pessoa achada. Sem grupos no
// escritório, a busca fica como sempre, inclusive os textos.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { GrupoDaEquipe, Membro } from '../dados/tipos';
import { estiloBotao, Nota, propsDaDica } from './base';
import { Icone } from './Icone';
import { MenuFlutuante } from './Menu';

/** Tamanho da bolinha ao lado de cada nome escolhido: na lista de escolhidos (EscolhaDaEquipe) e nas linhas dos participantes do
 * contrato. Um número só, para as bolinhas das duas listas terem o mesmo tamanho. (Na busca, desde a #356, só os nomes.) */
export const BOLINHA_DA_EQUIPE = 24;
/** Tamanho do "+" dentro da bolinha redonda do topo do cartão. */
const MAIS_NA_BOLINHA = 16;
/** Quando já estão todos da equipe ativa: no lugar do botão de adicionar, e na dica da bolinha "+" desligada. */
const NINGUEM_MAIS = 'Não há mais ninguém na equipe.';
/** Os títulos das duas partes da lista, com grupos no escritório (#378). */
const PARTE_DAS_PESSOAS = 'Pessoas', PARTE_DOS_GRUPOS = 'Grupos da equipe';
/** Nada achado, com grupos no escritório: nem pessoa nem grupo. */
const NADA_ACHADO_COM_GRUPOS = 'Nenhum grupo ou pessoa com esse nome.';
/** Nada achado em uma das partes, com o termo digitado. */
const NINGUEM_COM_ESSE_NOME = 'Ninguém da equipe com esse nome.', NENHUM_GRUPO_COM_ESSE_NOME = 'Nenhum grupo com esse nome.';
/** Todos os grupos do escritório já estão no item. */
const TODOS_OS_GRUPOS = 'Todos os grupos já estão aqui.';
/** Tamanho do ícone de grupo na frente do nome de cada grupo achado (#378). */
const ICONE_DO_GRUPO = 14;

/** Os grupos da equipe que a busca também acha (#378). */
export interface GruposNaBusca {
  /** Os grupos que ainda podem entrar, pelo termo digitado. */
  buscar: (termo: string) => GrupoDaEquipe[];
  aoEscolher: (g: GrupoDaEquipe) => void;
  /** O nome do botão de cada grupo: "Grupo Núcleo A, 4 pessoas". */
  nome: (g: GrupoDaEquipe) => string;
  /** O que o botão mostra: "Núcleo A · 4". */
  texto: (g: GrupoDaEquipe) => string;
  /** Por que nenhum grupo pode entrar (o item já tem o máximo): o motivo, na parte dos grupos. */
  motivo?: string;
}

interface Props {
  /** Quem da equipe a busca acha com o que foi digitado (sem nada digitado, todos os que ainda podem entrar). */
  buscar: (termo: string) => Membro[];
  aoEscolher: (m: Membro) => void;
  /** O texto do botão: "Adicionar participante". */
  adicionar: string;
  /** O id da dica da lista, lida junto com o campo de busca. */
  descricao?: string;
  /** O botão de adicionar, para quem usa poder levar o foco a ele (depois de tirar alguém da lista). */
  botao?: RefObject<HTMLButtonElement | null>;
  /** Para onde vai o foco ao fechar a busca se o botão sumiu (não sobrou ninguém para entrar). */
  focoReserva?: RefObject<HTMLElement | null>;
  /** Para onde vai o foco depois de escolher (o % do participante novo, no contrato); sem isto, volta ao botão. */
  focarAoEscolher?: (m: Membro) => void;
  /** O botão fica desligado (a lista chegou ao máximo). */
  desligado?: boolean;
  /**
   * O botão é a bolinha redonda com "+" do topo do cartão (#356), do tamanho das bolinhas da equipe, e a busca abre num painel
   * por cima dela. `motivoDesligado` diz, na dica do botão desligado, por que não dá para pôr mais ninguém. Sem ninguém que
   * ainda possa entrar, a bolinha fica desligada, com isso na dica. Desligada, ela continua no Tab (aria-disabled), para o foco
   * não se perder quando a pessoa acabou de tirar alguém e o cartão ainda grava.
   * Com `conteudo` (a bolinha do responsável, com as iniciais, ou a vazia), ela fica no lugar do "+", com a `dica` e a `classe`
   * dela, e o `rotulo` dá o nome para o leitor de tela (sem ele, o nome é `adicionar`, que também nomeia o painel).
   * `semCandidatos` é a dica e o nome dessa bolinha quando não há ninguém que a busca ache (a do responsável, sem outra pessoa
   * para assumir): no lugar do "clique para trocar", que ali não vale.
   */
  bolinha?: {
    tamanho: number; motivoDesligado?: string; conteudo?: ReactNode; dica?: string; rotulo?: string; classe?: string;
    semCandidatos?: { dica: string; rotulo: string };
  };
  /** Os grupos da equipe, que a busca acha depois das pessoas (#378). Sem isto (o escritório não tem grupos), só as pessoas. */
  grupos?: GruposNaBusca;
  /** Por que ninguém pode entrar (a lista de pessoas está cheia), na parte das pessoas: a lista cheia não impede os grupos. */
  motivoSemPessoas?: string;
  /**
   * O que vem no alto da busca, antes do campo (na tarefa, #313: a função de quem entra). Fica dentro da busca: ir dele ao campo
   * ou aos achados, pelo clique ou pelo Tab, não a fecha.
   */
  cabeca?: ReactNode;
}

export function BuscaNaEquipe({ buscar, aoEscolher, adicionar, descricao, botao: botaoDeFora, focoReserva, focarAoEscolher, desligado, bolinha, grupos, motivoSemPessoas, cabeca }: Props) {
  // Na bolinha, a busca aberta fica presa ao botão que a abriu (o painel por cima); no botão "+ Adicionar…", ela toma o lugar dele.
  const [aberta, setAberta] = useState<HTMLElement | null>(null);
  const botaoProprio = useRef<HTMLButtonElement>(null);
  const botao = botaoDeFora ?? botaoProprio;

  const podemEntrar = buscar('');
  const gruposPodem = grupos?.buscar('') ?? [];

  // Ao fechar a busca, o foco vai ao botão de adicionar ou, se não sobrou ninguém para entrar, ao lugar de reserva: o teclado não se perde.
  const focarDepois = () => setTimeout(() => (botao.current ?? focoReserva?.current)?.focus(), 0);
  function fechar() {
    setAberta(null);
    focarDepois();
  }
  function incluir(m: Membro) {
    aoEscolher(m);
    setAberta(null);
    if (focarAoEscolher) setTimeout(() => focarAoEscolher(m), 0); else focarDepois();
  }
  // O grupo escolhido: a busca fecha e o foco volta ao botão, como com a pessoa.
  const comGrupos = grupos && { ...grupos, aoEscolher: (g: GrupoDaEquipe) => { grupos.aoEscolher(g); setAberta(null); focarDepois(); } };

  if (bolinha) {
    const semNinguem = !desligado && !podemEntrar.length && !gruposPodem.length;
    const motivo = desligado ? bolinha.motivoDesligado : semNinguem ? motivoSemPessoas ?? NINGUEM_MAIS : undefined;
    const desligada = !!desligado || semNinguem;
    const { conteudo = <Icone nome="mais" tam={MAIS_NA_BOLINHA} />, classe = 'equipe-mais' } = bolinha;
    // Sem ninguém para achar, a bolinha que tem dica própria (a do responsável) diz só isso, sem o "clique para trocar".
    const semCandidatos = semNinguem ? bolinha.semCandidatos : undefined;
    // A dica: o que a bolinha é (o responsável) e, desligada, por quê; no "+", o motivo toma o lugar do nome.
    const dica = semCandidatos?.dica ?? (bolinha.dica ? [bolinha.dica, motivo].filter(Boolean).join(' · ') : motivo ?? adicionar);
    return <>
      <button ref={botao} type="button" className={classe} style={{ width: bolinha.tamanho, height: bolinha.tamanho }} aria-label={semCandidatos?.rotulo ?? bolinha.rotulo ?? adicionar}
        {...propsDaDica(dica)} aria-description={motivo} aria-haspopup="dialog" aria-expanded={!!aberta} aria-disabled={desligada || undefined}
        onClick={e => { if (desligada) return; const alvo = e.currentTarget; setAberta(a => a ? null : alvo); }}>
        {conteudo}
      </button>
      {/* O painel fecha sozinho no clique fora e no Esc (que devolve o foco à bolinha); sair dele pelo Tab também a devolve. */}
      {aberta && <BuscaPresa botao={aberta} buscar={buscar} adicionar={adicionar} descricao={descricao} aoEscolher={incluir}
        fechar={devolverFoco => devolverFoco ? fechar() : setAberta(null)} grupos={comGrupos} motivoSemPessoas={motivoSemPessoas} cabeca={cabeca} />}
    </>;
  }

  if (!aberta) return podemEntrar.length
    ? <div><button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} disabled={desligado} onClick={e => setAberta(e.currentTarget)}>
      <Icone nome="mais" tam={13} /> {adicionar}
    </button></div>
    : <Nota>{NINGUEM_MAIS}</Nota>;

  return <CaixaDaBusca buscar={buscar} adicionar={adicionar} descricao={descricao} aoEscolher={incluir} aoFechar={fechar} aoSair={() => setAberta(null)} fecharAoClicarFora />;
}

/**
 * A busca aberta num painel por cima de um botão que já está na tela: o da bolinha "+" (acima) e a bolinha do responsável, cujo menu
 * tem "Trocar o responsável" (#388, EquipeDoCartao). `aoEscolher` recebe quem foi escolhido (e fecha a busca). `fechar` é chamado
 * com true quando a pessoa sai dela pelo teclado (Esc ou Tab: quem usa devolve o foco ao botão) e com false no clique fora (o
 * painel já cuida do foco).
 */
export function BuscaPresa({ botao, fechar, ...caixa }: { botao: HTMLElement; fechar: (devolverFoco: boolean) => void } &
  Pick<PropsDaCaixa, 'buscar' | 'adicionar' | 'descricao' | 'aoEscolher' | 'grupos' | 'motivoSemPessoas' | 'cabeca'>) {
  return <MenuFlutuante botao={botao} painel rotulo={caixa.adicionar} aoFechar={() => fechar(false)}>
    <div className="pergunta"><CaixaDaBusca {...caixa} aoFechar={() => fechar(true)} aoSair={() => fechar(true)} /></div>
  </MenuFlutuante>;
}

interface PropsDaCaixa {
  buscar: (termo: string) => Membro[];
  adicionar: string;
  descricao?: string;
  aoEscolher: (m: Membro) => void;
  /** Esc: fecha e devolve o foco ao botão. */
  aoFechar: () => void;
  /** A pessoa saiu da busca (Tab para fora, ou clique fora). */
  aoSair: () => void;
  /** Fecha com o clique fora dela (no painel da bolinha, quem fecha é o próprio painel). */
  fecharAoClicarFora?: boolean;
  grupos?: GruposNaBusca;
  motivoSemPessoas?: string;
  cabeca?: ReactNode;
}

/** O campo de busca e a lista dos achados, com o teclado: Enter escolhe o primeiro, as setas andam na lista, Esc fecha. */
function CaixaDaBusca({ buscar, adicionar, descricao, aoEscolher, aoFechar, aoSair, fecharAoClicarFora = false, grupos, motivoSemPessoas, cabeca }: PropsDaCaixa) {
  const [termo, setTermo] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const sair = useRef(aoSair);
  sair.current = aoSair;
  const achados = buscar(termo);
  const gruposAchados = grupos?.buscar(termo) ?? [];

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    if (!fecharAoClicarFora) return;
    const foraDaBusca = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) sair.current(); };
    document.addEventListener('mousedown', foraDaBusca);
    return () => document.removeEventListener('mousedown', foraDaBusca);
  }, [fecharAoClicarFora]);

  // As setas andam pelos achados (também de uma parte para a outra) e, acima do primeiro, voltam ao campo; Esc fecha só a busca.
  function andar(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); aoFechar(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const lista = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('.achados button') ?? [])];
    const i = lista.indexOf(document.activeElement as HTMLButtonElement);
    (e.key === 'ArrowDown' ? lista[i + 1] : lista[i - 1] ?? campo.current)?.focus();
  }

  return <div className="busca-equipe" ref={raiz} onBlur={e => {
    // Saindo da busca pelo teclado (Tab), ela fecha, para a lista não ficar aberta por cima dos campos seguintes. Sem
    // destino (clique na barra de rolagem da lista, ou no Safari, que não dá foco ao botão clicado), fica aberta: o
    // clique fora já fecha.
    const destino = e.relatedTarget as Node | null;
    if (destino && !raiz.current?.contains(destino)) aoSair();
  }}>
    {cabeca}
    <input ref={campo} type="text" aria-label={`Buscar na equipe: ${adicionar.toLowerCase()}`} aria-describedby={descricao}
      placeholder="Digite o nome" autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)}
      onKeyDown={e => {
        // Esc fecha só a busca (sem fechar o cartão em volta); Enter escolhe o primeiro achado (e não avança o formulário);
        // a seta para baixo leva à lista.
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); aoFechar(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); raiz.current?.querySelector<HTMLButtonElement>('.achados button')?.focus(); return; }
        if (e.key !== 'Enter') return;
        // O Enter fica aqui: nenhum formulário em volta deve tratá-lo (o de pessoa, por exemplo, passaria ao próximo campo).
        e.preventDefault();
        e.stopPropagation();
        if (achados[0]) aoEscolher(achados[0]);
        else if (gruposAchados[0]) grupos?.aoEscolher(gruposAchados[0]);
      }} />
    {grupos
      ? <div className="achados achados-em-partes" onKeyDown={andar}>
        {!achados.length && !gruposAchados.length
          ? <p className="nota sem-achados">{termo.trim() ? NADA_ACHADO_COM_GRUPOS : motivoSemPessoas ?? NINGUEM_MAIS}</p>
          : <>
            <ParteDosAchados titulo={PARTE_DAS_PESSOAS} vazia={termo.trim() ? NINGUEM_COM_ESSE_NOME : motivoSemPessoas ?? NINGUEM_MAIS}>
              {achados.map(m => <li key={m.id}><button type="button" onClick={() => aoEscolher(m)}>{m.nome}</button></li>)}
            </ParteDosAchados>
            <ParteDosAchados titulo={PARTE_DOS_GRUPOS} vazia={grupos.motivo ?? (termo.trim() ? NENHUM_GRUPO_COM_ESSE_NOME : TODOS_OS_GRUPOS)}>
              {gruposAchados.map(g => <li key={g.id}><button type="button" className="achado-grupo" aria-label={grupos.nome(g)} onClick={() => grupos.aoEscolher(g)}>
                <span><Icone nome="equipe" tam={ICONE_DO_GRUPO} />{grupos.texto(g)}</span>
              </button></li>)}
            </ParteDosAchados>
          </>}
      </div>
      : <ul className="achados" aria-label="Equipe" onKeyDown={andar}>
        {achados.length
          ? achados.map(m => <li key={m.id}><button type="button" onClick={() => aoEscolher(m)}>{m.nome}</button></li>)
          : <li className="nota sem-achados">{NINGUEM_COM_ESSE_NOME}</li>}
      </ul>}
  </div>;
}

/** Uma parte da lista de achados, com o título; vazia, o motivo. */
function ParteDosAchados({ titulo, vazia, children }: { titulo: string; vazia: string; children: ReactNode[] }) {
  return <div role="group" aria-label={titulo} className="achados-parte">
    <p className="achados-titulo" aria-hidden="true">{titulo}</p>
    {children.length ? <ul aria-label={titulo}>{children}</ul> : <p className="nota sem-achados">{vazia}</p>}
  </div>;
}
