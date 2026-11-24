// O texto que já abre em edição e salva sozinho, como uma nota do Obsidian (a anotação de Documentos): quem pode alterar
// encontra a caixa de escrever assim que a abre (o editor ao vivo da #364, em que a formatação aparece enquanto se escreve, como
// no Obsidian, com a barra de formatação da #344), e o que escreve é gravado depois de uma pausa ao digitar (ESPERA_PARA_SALVAR),
// ao sair da caixa e com Ctrl+S. Uma linha discreta diz "Salvando…" ou "Salvo". Sem modo de ler à parte (pedido do dono de
// 18/11): a formatação já aparece enquanto se escreve, as caixinhas se marcam com um clique e os links abrem com Ctrl+clique no
// próprio editor. Quem só lê vê o texto formatado, sem caixa nem barra. Quem usa recebe um controle para gravar o que falta antes
// de sair (o AvisoAoSair o chama antes de trocar de anotação). Peça comum: a TextoEditavel continua nas descrições dos cartões,
// com Salvar e Cancelar.
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { situacaoDoSalvamento, TEXTO_DO_SALVAMENTO } from '../../regras/salvamento';
import { avisar, falha } from '../avisos';
import { ESPERA_PARA_SALVAR } from '../tempos';
import { EditorAoVivo } from './EditorAoVivo';
import { TextoFormatado } from './TextoFormatado';

/** O que quem usa o editor pode pedir a ele. */
export interface ControleDoEditor {
  /** Grava o que falta (e espera a gravação que já corre). Diz se ficou tudo gravado. */
  salvar: () => Promise<boolean>;
}

interface Props {
  /** O texto gravado. */
  texto: string;
  /**
   * Quem pode alterar recebe o texto a gravar (só quando mudou). Se devolver false (quem chama já avisou do problema) ou falhar
   * (o erro aparece no pé da tela), o texto continua na caixa, por salvar. Sem isto, o texto só se lê. `base` é o texto gravado de
   * que a pessoa partiu, para quem grava conferir que ninguém o mudou no banco enquanto ela escrevia (trava otimista).
   */
  aoSalvar?: (texto: string, base: string) => unknown;
  /** O que o texto confere antes de gravar ('' = está certo). */
  conferir?: (texto: string) => string;
  /** O nome da caixa para o leitor de tela. */
  rotulo?: string;
  maximo?: number;
  placeholder?: string;
  /** O que aparece no lugar do texto vazio, para ler. */
  vazio?: ReactNode;
  /** A classe do texto formatado. */
  className?: string;
  /** O que ainda não foi gravado, a cada mudança (null: está tudo gravado), para avisar ao sair. */
  aoMudarRascunho?: (rascunho: string | null) => void;
  /** Para quem usa pedir a gravação do que falta (ao trocar de anotação, por exemplo). */
  controle?: RefObject<ControleDoEditor | null>;
  /** Outra pessoa mudou o texto gravado enquanto esta escrevia: a linha da gravação diz isso, e quem usa oferece a escolha. */
  conflito?: boolean;
  /** O id da caixa, para quem usa pôr o foco nela (o Enter no título da anotação nova desce para o texto). */
  id?: string;
  /** A anotação nova ainda não foi ao banco (#369): sem nada escrito, a linha da gravação diz isso, em vez de "Salvo". */
  aindaNaoGravada?: boolean;
  /**
   * Onde a linha da gravação aparece, quando não é logo abaixo da caixa: a anotação a põe no pé da janela, junto do rodapé (#372).
   * Com null, o lugar ainda não existe, e a linha aparece assim que ele existir.
   */
  lugarDaSituacao?: HTMLElement | null;
  /** O que fica preso no fim de quem rola (o pé da anotação), para a linha do cursor não se esconder embaixo dele (veja EditorAoVivo). */
  folgaEmbaixo?: () => number;
}

export function EditorDeTexto({
  texto, aoSalvar, conferir, rotulo = 'Texto', maximo, placeholder, vazio, className, aoMudarRascunho, controle, conflito = false, id: idPedido, aindaNaoGravada = false,
  lugarDaSituacao, folgaEmbaixo
}: Props) {
  const idProprio = useId();
  const id = idPedido ?? idProprio;
  const [valor, setValor] = useState(texto);
  const [gravado, setGravado] = useState(texto);
  const [salvando, setSalvando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  // O texto gravado mudou fora daqui (lido de novo, por exemplo depois de outra pessoa mudá-lo): sem nada por gravar, a caixa acompanha.
  const [visto, setVisto] = useState(texto);
  if (texto !== visto) {
    setVisto(texto);
    if (valor === gravado && !salvando) { setValor(texto); setGravado(texto); }
  }
  /** O que está na tela agora, para as gravações da fila, que começam depois de outra. */
  const agora = useRef({ valor, gravado, aoSalvar, conferir });
  agora.current = { valor, gravado, aoSalvar, conferir };
  /** As gravações, uma depois da outra: a de agora espera a que já corre e, se o texto já estiver gravado, não faz nada. */
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));

  async function gravarUmaVez(avisarErro: boolean): Promise<boolean> {
    const { valor: enviado, gravado: atual, aoSalvar: salvar, conferir: conferirAgora } = agora.current;
    if (enviado === atual || !salvar) return true;
    const erro = conferirAgora?.(enviado);
    if (erro) {
      // Na pausa ao digitar, o erro não salta a cada tecla: só quando a pessoa pede (Ctrl+S, ao sair da caixa, ao sair da anotação).
      if (avisarErro) avisar(erro, 'erro');
      setFalhou(true);
      return false;
    }
    setSalvando(true);
    try {
      if (await salvar(enviado, atual) === false) { setFalhou(true); return false; }
      agora.current.gravado = enviado;
      setGravado(enviado);
      setFalhou(false);
      return true;
    } catch (e) {
      falha(e);
      setFalhou(true);
      return false;
    } finally {
      setSalvando(false);
    }
  }
  function gravar(avisarErro: boolean) {
    const vez = fila.current.then(() => gravarUmaVez(avisarErro));
    fila.current = vez;
    return vez;
  }
  /** Grava até não sobrar nada (a pessoa pode ter continuado a escrever durante a gravação). */
  async function gravarTudo(avisarErro = true) {
    let ok = await gravar(avisarErro);
    while (ok && agora.current.valor !== agora.current.gravado) ok = await gravar(avisarErro);
    return ok;
  }
  const gravarDepois = useRef(gravar);
  gravarDepois.current = gravar;
  useEffect(() => {
    if (!controle) return;
    controle.current = { salvar: () => gravarTudo() };
    return () => { controle.current = null; };
  });

  // Depois da pausa ao digitar, o que mudou é gravado.
  const podeMudar = !!aoSalvar;
  useEffect(() => {
    if (!podeMudar || valor === gravado) return;
    const t = setTimeout(() => void gravarDepois.current(false), ESPERA_PARA_SALVAR);
    return () => clearTimeout(t);
  }, [podeMudar, valor, gravado]);

  // Quem usa sabe o que ainda não foi gravado; ao sair da tela, deixa de esperar. Fica sabendo antes de a tela ser desenhada
  // (#420): com o useEffect, a linha já dizia "Salvo" e, por um instante, quem usa ainda segurava a saída (fechar a aba perguntava).
  const avisarRascunho = useRef(aoMudarRascunho);
  avisarRascunho.current = aoMudarRascunho;
  const porGravar = podeMudar && valor !== gravado ? valor : null;
  useLayoutEffect(() => { avisarRascunho.current?.(porGravar); }, [porGravar]);
  useEffect(() => () => avisarRascunho.current?.(null), []);

  // Quem só lê vê o texto formatado.
  if (!podeMudar) return valor.trim() ? <TextoFormatado className={className} texto={valor} /> : <>{vazio}</>;

  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key.toLowerCase() !== 's' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    // Ctrl+S grava na hora, e o navegador não abre a janela de salvar a página.
    e.preventDefault();
    void gravarTudo();
  }
  function sair(e: FocusEvent<HTMLDivElement>) {
    // Saindo da caixa e da barra (para outro lugar da tela), grava; de um botão da barra para a caixa, não.
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    void gravarTudo();
  }
  const situacao = situacaoDoSalvamento({ valor, gravado, salvando, falhou, conflito, aindaNaoGravada });
  const linha = <p className={'editor-de-texto-situacao ' + situacao} role="status" aria-label="Gravação do texto">{TEXTO_DO_SALVAMENTO[situacao]}</p>;
  return <div className="editor-de-texto" onKeyDown={teclar} onBlur={sair}>
    {/* A caixa cresce com o texto, como uma página: quem rola é a página, não a caixa. */}
    <EditorAoVivo id={id} rotulo={rotulo} maximo={maximo} placeholder={placeholder} valor={valor} aoMudar={setValor} folgaEmbaixo={folgaEmbaixo} />
    {lugarDaSituacao === undefined ? linha : lugarDaSituacao && createPortal(linha, lugarDaSituacao)}
  </div>;
}
