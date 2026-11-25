// A escolha do papel no processo (#443), a mesma no "Papel do cliente" do cadastro, nas pessoas do processo e na pergunta do papel
// ao pôr um cliente pelo cartão: os papéis fixos, o grupo "Do escritório" (os papéis escritos pela equipe) e, por último,
// "+ Escrever outro papel…", que abre a janela de texto (Enter confirma, Esc desiste), no padrão do "+ Novo tipo de vínculo…".
// As regras (o texto que vira papel fixo, o nome que já está na lista) ficam em regras/papelEscrito.ts.
import type { PapelDaParte } from '../../dados';
import { TAMANHO_PROCESSO } from '../../dados/limites';
import {
  ESCREVER_OUTRO_PAPEL, ESCREVER_PAPEL, GRUPO_DO_ESCRITORIO, OPCAO_ESCREVER, opcoesDoPapel, papelDoTexto, papelDoValor, type PapelEscolhido
} from '../../regras/papelEscrito';
import { PAPEIS_DA_PARTE } from '../../regras/processo';
import { pedirTexto, type OpcaoDaJanela } from '../../ui/janela';

interface Opcoes {
  /** O texto da opção vazia ("Papel do cliente…"). */
  vazio: string;
  /** Os papéis fixos que o processo oferece. */
  fixos: readonly PapelDaParte[];
  /** A lista do escritório (ui/papeisEscritos.ts). */
  lista: readonly string[];
  /** Os nomes já escritos no próprio formulário: aparecem no grupo mesmo fora da lista (o atual que saiu dela). */
  usados?: readonly (string | null | undefined)[];
}

/** As opções do select do papel: a vazia, as fixas, o grupo "Do escritório" (quando há) e a de escrever. */
export function OpcoesDoPapel({ vazio, fixos, lista, usados = [] }: Opcoes) {
  const doEscritorio = opcoesDoPapel(lista, usados);
  return <>
    <option value="">{vazio}</option>
    {fixos.map(x => <option key={x} value={x}>{PAPEIS_DA_PARTE[x]}</option>)}
    {doEscritorio.length > 0 && <optgroup label={GRUPO_DO_ESCRITORIO}>
      {doEscritorio.map(o => <option key={o.valor} value={o.valor}>{o.nome}</option>)}
    </optgroup>}
    <option value={ESCREVER_PAPEL}>{OPCAO_ESCREVER}</option>
  </>;
}

/** As mesmas opções numa lista só, para a janela de escolher (escolherNaJanela), sem a vazia. */
export const opcoesDoPapelNaJanela = (fixos: readonly PapelDaParte[], lista: readonly string[]): OpcaoDaJanela[] => [
  ...fixos.map(x => ({ valor: x, nome: PAPEIS_DA_PARTE[x] })), ...opcoesDoPapel(lista), { valor: ESCREVER_PAPEL, nome: OPCAO_ESCREVER }
];

/** Abre a janela de escrever e devolve o papel do texto; null quando a pessoa desistiu ou deixou vazio. */
export async function escreverPapel(lista: readonly string[], fixos?: readonly PapelDaParte[]): Promise<PapelEscolhido | null> {
  const texto = await pedirTexto(ESCREVER_OUTRO_PAPEL, '', { maximo: TAMANHO_PROCESSO.papelEscrito });
  return texto ? papelDoTexto(texto, lista, fixos) : null;
}

/**
 * O que a escolha no select quer dizer: a de escrever abre a janela (undefined: a pessoa desistiu, nada muda); as outras dão o
 * papel (null: a opção vazia, sem papel).
 */
export async function papelDaEscolha(valor: string, lista: readonly string[], fixos?: readonly PapelDaParte[]): Promise<PapelEscolhido | null | undefined> {
  if (valor !== ESCREVER_PAPEL) return papelDoValor(valor);
  return (await escreverPapel(lista, fixos)) ?? undefined;
}
