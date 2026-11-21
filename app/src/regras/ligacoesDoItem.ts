// As ligações de um item com os outros (a demanda e o contrato de uma tarefa, o contrato de uma demanda...), como aparecem fora
// do cartão (#300): no quadro, um ícone de cada tipo e só o código; na tabela, por extenso ("demanda D3A1F09C · contrato
// MA96-0001-2026"). O nome de cada tipo vem do mesmo lugar que o dos cartões (CARTAO_DO_MODULO).
import type { ModuloComentado } from '../dados/tipos';
import { CARTAO_DO_MODULO } from './mensagens';

/** O módulo de uma ligação: os que têm cartão (e código). */
export type ModuloLigado = ModuloComentado;

/** Uma ligação do item: de que módulo ela é e o código do item ligado (vazio quando não há ligação desse tipo). */
export interface LigacaoDoItem {
  modulo: ModuloLigado;
  codigo: string | null | undefined;
}

/** Uma ligação que existe, com o código. */
export interface LigacaoComCodigo {
  modulo: ModuloLigado;
  codigo: string;
}

/** Só as ligações que existem, na ordem em que vieram. */
export function ligacoesComCodigo(ligacoes: readonly LigacaoDoItem[]): LigacaoComCodigo[] {
  return ligacoes.filter((l): l is LigacaoComCodigo => !!l.codigo);
}

/** O nome de uma ligação, para a dica e o leitor de tela: "Demanda D3A1F09C". */
export function nomeDaLigacao(l: LigacaoComCodigo) {
  return `${CARTAO_DO_MODULO[l.modulo].nome} ${l.codigo}`;
}

/** As ligações por extenso, numa linha, para a tabela: "demanda D3A1F09C · contrato MA96-0001-2026" (vazio se não há nenhuma). */
export function ligacoesPorExtenso(ligacoes: readonly LigacaoDoItem[]) {
  return ligacoesComCodigo(ligacoes).map(l => `${CARTAO_DO_MODULO[l.modulo].nome.toLowerCase()} ${l.codigo}`).join(' · ');
}
