// Os textos da importação que dependem das contagens (a confirmação antes de gravar, o resumo no fim e o aviso no pé
// da tela), num lugar só: a tela e o aviso dizem a mesma coisa do mesmo jeito.
import type { ItemImportacao } from '../../dados';
import type { Classificacao, Decisao, Problema } from '../../regras/importacao';
import type { FalhaDaGravacao, GravacaoConcluida } from '../../ui/gravacaoDaImportacao';
import { numero } from '../../ui/util';

/** "1 pessoa nova", "2 pessoas novas". */
export const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;
/** "a", "a e b", "a, b e c". */
export const listaComE = (itens: string[]) =>
  itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;

export interface ContagemDaConferencia {
  itens: ItemImportacao[];
  classificacoes: Classificacao[];
  decisoes: Record<number, Decisao>;
  problemas: Problema[];
}

/** "2 pessoas novas entram e 1 cadastro é completado. Ficam de fora 1 linha para decidir e 1 linha com erro." */
export function textoDaConfirmacao({ itens, classificacoes, decisoes, problemas }: ContagemDaConferencia): string {
  const novas = itens.filter(i => !i.existente_id).length, completadas = itens.length - novas;
  const entram = ([[novas, 'pessoa nova entra', 'pessoas novas entram'], [completadas, 'cadastro é completado', 'cadastros são completados']] as const)
    .filter(([n]) => n > 0).map(([n, um, varios]) => plural(n, um, varios));
  const decidir = classificacoes.filter(c => c.situacao === 'decidir');
  const comProblema = new Set(problemas.map(p => p.linha));
  const fora = ([
    [decidir.filter(c => !decisoes[c.linha]).length, 'linha para decidir', 'linhas para decidir'],
    [decidir.filter(c => decisoes[c.linha] === 'nao_importar').length, 'linha marcada para não importar', 'linhas marcadas para não importar'],
    [classificacoes.filter(c => c.situacao === 'recusada' || comProblema.has(c.linha)).length, 'linha com erro', 'linhas com erro']
  ] as const).filter(([n]) => n > 0);
  const quantasFora = fora.reduce((soma, [n]) => soma + n, 0);
  const frases = [
    entram.length ? `${listaComE(entram)}.` : '',
    fora.length ? `${quantasFora === 1 ? 'Fica' : 'Ficam'} de fora ${listaComE(fora.map(([n, um, varios]) => plural(n, um, varios)))}.` : ''
  ];
  return frases.filter(Boolean).map(f => f[0].toUpperCase() + f.slice(1)).join(' ');
}

/** "As linhas 202 a 203 não foram gravadas: <motivo>" (sem ponto final). */
export function textoDaFalha({ primeira, ultima, quantas, mensagem }: FalhaDaGravacao): string {
  const quais = quantas === 1 ? `A linha ${primeira} não foi gravada` : `As linhas ${primeira} a ${ultima} não foram gravadas`;
  return `${quais}: ${mensagem.replace(/\.$/, '')}`;
}

/** "Importação concluída: 2 pessoas incluídas, 1 completada, 1 com pendência (marcada como incompleta)." */
export function textoDoResultado({ falha, totais }: GravacaoConcluida): string {
  const partes = [plural(totais.criadas, 'pessoa incluída', 'pessoas incluídas'), plural(totais.completadas, 'completada', 'completadas')];
  if (totais.incompletas) {
    partes.push(`${numero(totais.incompletas)} com pendência (${totais.incompletas === 1 ? 'marcada como incompleta' : 'marcadas como incompletas'})`);
  }
  return `${falha ? 'Importação interrompida' : 'Importação concluída'}: ${partes.join(', ')}.`;
}

/** O aviso no pé da tela ao terminar (a janela pode já estar fechada). */
export const avisoFinal = (fim: GravacaoConcluida) => fim.falha ? `${textoDaFalha(fim.falha)}.` : textoDoResultado(fim);

/** A descrição da importação (guardada com ela, fora do registro de ações): só contagens, nada do conteúdo nem o nome do arquivo (LGPD). */
export const descricaoDaImportacao = (linhas: number, itens: number) =>
  `${plural(linhas, 'linha', 'linhas')} no arquivo, ${numero(itens)} para gravar`;
