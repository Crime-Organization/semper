// O prazo do processo que a tarefa cumpre (#355): a tarefa nasceu de um prazo (o "Criar tarefa" do prazo) ou foi ligada a ele.
// Concluir a tarefa, por qualquer caminho (o ✓ do cartão, o círculo da miniatura e da tabela, o menu Situação, o arrastar no
// quadro, a caixa no cartão da demanda), faz o SEMPER perguntar se o prazo foi cumprido; reabrir pergunta se ele volta a ficar
// aberto. Sem tela nem banco: daqui saem a pergunta que cabe, os prazos que ela muda e os textos.
import type { MarcoColuna, PrazoDeProcesso } from '../dados/tipos';
import { colunaComMarco } from './quadro';

/** O que se pergunta: se o prazo foi cumprido (a tarefa chegou à coluna das concluídas) ou se ele volta a ficar aberto (saiu dela). */
export type PerguntaDoPrazo = 'cumprir' | 'reabrir';

type ColunaComMarco = { id: string; marco?: MarcoColuna | null };

/**
 * A pergunta que cabe à tarefa que saiu da coluna `de` e foi para a coluna `para`: cumprir, se ela chegou à das concluídas; reabrir,
 * se saiu dela; nenhuma, se continua do mesmo lado (de uma coluna aberta a outra, ou só mudou de posição).
 */
export function perguntaDoPrazo(colunas: ColunaComMarco[], de: string | null, para: string | null): PerguntaDoPrazo | null {
  const estava = colunaComMarco(colunas, de, 'concluido'), fica = colunaComMarco(colunas, para, 'concluido');
  if (estava === fica) return null;
  return fica ? 'cumprir' : 'reabrir';
}

type PrazoQueMuda = Pick<PrazoDeProcesso, 'descricao' | 'concluido_em'>;

/** O que cada pergunta diz e faz. */
interface ComoPergunta {
  /** Os prazos que a pergunta muda: cumprir, os abertos; reabrir, os cumpridos. */
  muda: (z: PrazoQueMuda) => boolean;
  titulo: string;
  texto: (descricoes: string[]) => string;
  botao: string;
  /** O que o prazo passa a ter em concluido_em (`agora`: o instante da resposta, em ISO). */
  concluidoEm: (agora: string) => string | null;
  /** O aviso no pé da tela e o nome do Desfazer. */
  aviso: (quantos: number) => string;
  oQue: string;
}

/** Os prazos por extenso, entre aspas: "Contestação" ou "Contestação" e "Réplica". */
const porExtenso = (descricoes: string[]) => {
  const aspas = descricoes.map(d => `"${d}"`);
  return aspas.length > 1 ? `${aspas.slice(0, -1).join(', ')} e ${aspas.at(-1)}` : aspas[0] ?? '';
};
const doProcesso = (descricoes: string[]) => descricoes.length > 1 ? `Os prazos ${porExtenso(descricoes)} do processo` : `O prazo ${porExtenso(descricoes)} do processo`;

export const PERGUNTA_DO_PRAZO: Record<PerguntaDoPrazo, ComoPergunta> = {
  cumprir: {
    muda: z => !z.concluido_em,
    titulo: 'O prazo do processo foi cumprido?',
    texto: d => `Esta tarefa cumpre ${d.length > 1 ? 'os prazos' : 'o prazo'} ${porExtenso(d)} do processo. ${d.length > 1 ? 'Eles foram cumpridos' : 'Ele foi cumprido'}? `
      + `Marcado como cumprido, o prazo deixa de aparecer como vencido e de mandar avisos.`,
    botao: 'Sim, foi cumprido',
    concluidoEm: agora => agora,
    aviso: n => n > 1 ? 'Prazos do processo marcados como cumpridos.' : 'Prazo do processo marcado como cumprido.',
    oQue: 'prazo cumprido'
  },
  reabrir: {
    muda: z => !!z.concluido_em,
    titulo: 'O prazo do processo volta a ficar aberto?',
    texto: d => `${doProcesso(d)} ${d.length > 1 ? 'estão marcados como cumpridos' : 'está marcado como cumprido'}. Com a tarefa reaberta, `
      + `${d.length > 1 ? 'eles voltam' : 'ele volta'} a ficar ${d.length > 1 ? 'abertos' : 'aberto'}?`,
    botao: 'Sim, reabrir o prazo',
    concluidoEm: () => null,
    aviso: n => n > 1 ? 'Prazos do processo reabertos.' : 'Prazo do processo reaberto.',
    oQue: 'reabertura do prazo'
  }
};

/** Os prazos que a pergunta muda, entre os ligados à tarefa. */
export const prazosQueMudam = <Z extends PrazoQueMuda>(pergunta: PerguntaDoPrazo, prazos: Z[]) => prazos.filter(PERGUNTA_DO_PRAZO[pergunta].muda);
