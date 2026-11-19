// O texto que salva sozinho (a anotação, como no Obsidian): em que pé está a gravação, para a tela mostrar "Salvando…" ou
// "Salvo" de um jeito discreto, e o que dizer em cada caso; se a gravação pode ir sem apagar o que outra pessoa escreveu
// depois que a anotação abriu (trava otimista); e o histórico com uma sessão de escrita numa linha só. Regra pura: sem tela,
// sem banco.
import type { Historico } from '../dados/tipos';

/**
 * Em que pé está o texto: igual ao gravado, mudado e ainda por gravar, sendo gravado, a última gravação falhou, ou outra
 * pessoa mudou o texto gravado depois que a anotação abriu (e a pessoa precisa escolher qual versão fica). Na anotação nova que ainda
 * não foi ao banco (#369), sem nada escrito, nada foi gravado ainda: não se diz "Salvo".
 */
export type SituacaoDoSalvamento = 'salvo' | 'porSalvar' | 'salvando' | 'naoSalvo' | 'conflito' | 'aindaNaoGravada';

/** O que a tela mostra em cada situação. */
export const TEXTO_DO_SALVAMENTO: Record<SituacaoDoSalvamento, string> = {
  salvo: 'Salvo',
  porSalvar: 'Alterações por salvar',
  salvando: 'Salvando…',
  naoSalvo: 'Não foi salvo. Tente de novo com Ctrl+S.',
  conflito: 'Outra pessoa mudou esta anotação. Escolha qual texto fica.',
  aindaNaoGravada: 'Ainda não gravada'
};

interface EstadoDoTexto {
  /** O que está na caixa agora. */
  valor: string;
  /** O último texto que o banco aceitou. */
  gravado: string;
  /** Uma gravação está a caminho. */
  salvando: boolean;
  /** A última gravação falhou. */
  falhou: boolean;
  /** Outra pessoa mudou o texto gravado depois que a anotação abriu: nada é gravado até a pessoa escolher. */
  conflito?: boolean;
  /** A anotação nova ainda não foi ao banco (#369): ela vai quando a pessoa escreve algo. */
  aindaNaoGravada?: boolean;
}

/**
 * A situação do texto. Gravando, é "salvando", mesmo que a pessoa continue a escrever; igual ao gravado, está salvo (mesmo que
 * uma tentativa anterior tenha falhado e a pessoa tenha voltado ao texto gravado); diferente, ou há conflito, ou falhou, ou
 * ainda vai gravar. Na anotação nova ainda fora do banco, igual ao gravado é "ainda não gravada".
 */
export function situacaoDoSalvamento({ valor, gravado, salvando, falhou, conflito = false, aindaNaoGravada = false }: EstadoDoTexto): SituacaoDoSalvamento {
  if (salvando) return 'salvando';
  if (valor === gravado) return aindaNaoGravada ? 'aindaNaoGravada' : 'salvo';
  if (conflito) return 'conflito';
  return falhou ? 'naoSalvo' : 'porSalvar';
}

/** O que fazer com o texto a gravar: gravar, nada (o banco já tem esse texto) ou parar, porque outra pessoa mudou o texto. */
export type DecisaoDaGravacao = 'gravar' | 'jaGravado' | 'conflito';

interface TextosDaGravacao {
  /** O texto de que a pessoa partiu (o que estava gravado quando ela começou a mudar). */
  base: string;
  /** O texto que está no banco agora. */
  noBanco: string;
  /** O texto que a pessoa quer gravar. */
  novo: string;
}

/**
 * A trava otimista do texto: grava só se o banco ainda tem o texto de que a pessoa partiu. Se o banco já tem o texto novo (a
 * mesma mudança feita noutra aba, por exemplo), não há o que gravar. Se tem outro texto, outra pessoa o mudou depois: gravar
 * por cima apagaria o que ela escreveu, sem aviso.
 */
export function decidirGravacao({ base, noBanco, novo }: TextosDaGravacao): DecisaoDaGravacao {
  if (noBanco === novo) return 'jaGravado';
  return noBanco === base ? 'gravar' : 'conflito';
}

/** A linha do histórico que só diz que o texto mudou (sem título, equipe, pasta...). */
const soOTexto = (h: Historico) => {
  const campos = Object.keys(h.alteracoes);
  return campos.length === 1 && campos[0] === 'texto';
};

/**
 * O histórico (do mais novo para o mais velho) com as gravações seguidas do texto pela mesma pessoa numa linha só: o texto que
 * salva sozinho grava a cada pausa ao digitar, e cada gravação vira uma linha "Texto alterado" no banco. Juntam-se as que vêm
 * até `janela` milissegundos depois da anterior; fica a mais nova (a hora em que a pessoa parou de escrever). Uma mudança de
 * outro campo, ou de outra pessoa, separa as sessões.
 */
export function juntarTextoNoHistorico(historico: Historico[], janela: number): Historico[] {
  const juntas: Historico[] = [];
  /** A linha mais velha da sessão que está sendo juntada: a próxima conta a partir dela. */
  let maisVelha: Historico | null = null;
  for (const h of historico) {
    const ultima = juntas.at(-1);
    const mesmaSessao = !!ultima && !!maisVelha && soOTexto(h) && soOTexto(ultima) && h.feito_por === ultima.feito_por
      && Date.parse(maisVelha.em) - Date.parse(h.em) <= janela;
    if (!mesmaSessao) juntas.push(h);
    maisVelha = h;
  }
  return juntas;
}
