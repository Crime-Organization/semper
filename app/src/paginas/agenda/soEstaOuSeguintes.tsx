// A pergunta do compromisso que se repete (#307, #417): a mudança vale só para esta data ou para ela e as seguintes ainda em aberto? A fazem
// o cartão (a data e o horário, o título no próprio lugar, arquivar) e o lápis (o título, o local, a equipe e as pessoas).
import type { CamposDasSeguintes } from '../../dados';
import { perguntaDosCampos } from '../../regras/repeticao';
import { janela } from '../../ui/janela';

/** Pergunta "só esta" ou "esta e as seguintes". null: desistiu, e nada muda. */
export const soEstaOuSeguintes = (titulo: string, texto: string) => janela<'esta' | 'seguintes'>({
  titulo, corpo: <p>{texto}</p>,
  acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Só esta', valor: 'esta' }, { rotulo: 'Esta e as seguintes', valor: 'seguintes', tipo: 'pri' }]
});

/** A pergunta ao mudar o título, o local, a equipe ou as pessoas de uma data da repetição (#417). */
export const perguntarNosCampos = (campos: CamposDasSeguintes) => soEstaOuSeguintes('Mudar o compromisso que se repete', perguntaDosCampos(campos));
