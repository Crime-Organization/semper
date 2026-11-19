// O campo de item novo de um checklist (#309): no pé do checklist (o item entra no fim, no primeiro nível) e no fim de cada
// grupo (o item entra no fim do grupo). Enter cria e deixa o campo pronto para o próximo. Colar várias linhas cria um item por
// linha; se a maioria começa com número (1., 2.1), um aviso oferece usar os números como grupos.
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { NoDoModelo } from '../../dados';
import { TAMANHO_ITEM } from '../../dados/limites';
import { arvoreDasLinhas, linhasColadas } from '../../regras/gruposDaLista';
import { avisar } from '../../ui/avisos';
import { Aviso, estiloBotao } from '../../ui/base';

interface Props {
  /** O nome do campo para o leitor de tela ("Novo item do grupo 2.1 Aposentadoria por idade"). */
  rotulo: string;
  /** Acrescenta a árvore (um item, várias linhas, ou grupos com itens) e espera gravar. */
  aoAcrescentar: (nova: NoDoModelo[]) => Promise<unknown>;
  /** Por que a árvore colada com os números como grupos não cabe aqui ('' = cabe): aí nada é criado e o aviso fica. */
  conferir?: (nova: NoDoModelo[]) => string;
  /** Avisa o texto escrito e ainda não adicionado (vazio ao adicionar e ao sair da tela): o editor de modelos trava o salvar. */
  aoMudarTexto?: (texto: string) => void;
  /** Fecha o campo (o do grupo): Esc fecha só ele, sem fechar o cartão em volta. Sem isto, o campo fica sempre aberto. */
  aoFechar?: () => void;
  focar?: boolean;
  /** O que vem ao lado do botão Adicionar (o "+ Grupo" do pé do checklist). */
  depois?: ReactNode;
}

export function CampoDoItemNovo({ rotulo, aoAcrescentar, conferir, aoMudarTexto, aoFechar, focar = false, depois }: Props) {
  const [texto, setTextoNaTela] = useState('');
  /** As linhas coladas com números, à espera da escolha: usar os números como grupos ou manter como itens. */
  const [colado, setColado] = useState<string[] | null>(null);
  const avisarTexto = useRef(aoMudarTexto);
  useEffect(() => { avisarTexto.current = aoMudarTexto; });
  // O campo do grupo some ao fechar (Cancelar, Esc) e o texto dele vai junto: deixa de estar pendente.
  useEffect(() => () => avisarTexto.current?.(''), []);
  const setTexto = (t: string) => { setTextoNaTela(t); avisarTexto.current?.(t.trim()); };
  async function acrescentar() {
    if (!texto.trim()) return;
    await aoAcrescentar([{ texto: texto.trim() }]);
    setTexto('');
  }
  function colar(e: ClipboardEvent<HTMLInputElement>) {
    const { linhas, numeradas } = linhasColadas(e.clipboardData.getData('text'));
    if (linhas.length < 2) return;
    e.preventDefault();
    if (numeradas) setColado(linhas);
    else void aoAcrescentar(arvoreDasLinhas(linhas, false).arvore);
  }
  function usarColado(usarNumeros: boolean) {
    const { arvore, erro } = arvoreDasLinhas(colado ?? [], usarNumeros);
    const motivo = erro || conferir?.(arvore);
    if (motivo) { avisar(motivo, 'erro'); return; }
    setColado(null);
    void aoAcrescentar(arvore);
  }
  // Não é um <form>: o campo também fica dentro do formulário do modelo. Enter cria; Esc fecha só o campo do grupo (sem fechar o
  // cartão em volta, que fecha com Esc).
  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    const tecla = ({ Enter: acrescentar, Escape: aoFechar } as Partial<Record<string, () => unknown>>)[e.key];
    if (!tecla) return;
    e.preventDefault();
    e.stopPropagation();
    void tecla();
  }
  return <>
    <div className="lista-novo-item">
      <input type="text" className="campo" aria-label={rotulo} placeholder="Adicionar um item…" maxLength={TAMANHO_ITEM} autoFocus={focar}
        value={texto} onChange={e => setTexto(e.target.value)} onPaste={colar} onKeyDown={teclar} />
      <button type="button" className={estiloBotao({ pequeno: true })} disabled={!texto.trim()} onClick={() => void acrescentar()}>Adicionar</button>
      {aoFechar && <button type="button" className={estiloBotao({ pequeno: true })} onClick={aoFechar}>Cancelar</button>}
      {depois}
    </div>
    {colado && <Aviso tipo="info" className="lista-colada">
      <p>As {colado.length} linhas coladas têm números, como 1. e 1.1. Usar esses números como grupos?</p>
      <div>
        <button type="button" className={estiloBotao({ variante: 'principal', pequeno: true })} onClick={() => usarColado(true)}>Usar esses números como grupos</button>
        <button type="button" className={estiloBotao({ pequeno: true })} onClick={() => usarColado(false)}>Manter como itens</button>
      </div>
    </Aviso>}
  </>;
}
