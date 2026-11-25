// O prazo do cartão numa folhinha de calendário (#442, opção 9 aprovada pelo dono em 25/11; hoje, só o cartão da tarefa a usa): à
// esquerda, a folhinha (o mês, o dia e o dia da semana); ao lado, quanto falta ("Faltam 2 dias", "Venceu há 2 dias" em vermelho,
// "Sem prazo"), embaixo a hora e o lembrete ("Às 18:00 · lembrete 1 h antes") e o link "Mudar prazo" ("Definir prazo", sem prazo).
// O link e a folhinha abrem a mesma janela das datas dos outros cartões (DatasDoCartao, com janelaDoInicioEPrazo): o início fica só
// lá dentro; ela se chama "Prazo", e o Remover, "Tirar o prazo". Na tarefa concluída, a folhinha mostra o dia da conclusão ("Concluída
// em 26/11"), o detalhe diz quanto antes ou depois do prazo, e a folhinha não abre nada (o link continua, para quem altera: a
// concluída também muda de datas e ganha um prazo). "Vence hoje" fica na cor de pendência. Quem só lê vê o mesmo, sem o link.
// A folhinha é só para o mouse (aria-hidden, fora do Tab): o leitor de tela ouve o dia por extenso, e o link leva o resumo antigo
// (o início, a entrega e o lembrete) como descrição. As contas ficam em regras/prazoNaFolhinha.ts.
import type { TipoDeAtalho } from '../../regras/atalhosDoCartao';
import { folhaDoDia, prazoNaFolhinha, type FolhaDoDia } from '../../regras/prazoNaFolhinha';
import { hojeISO } from '../util';
import { estiloBotao } from './botao';
import { janelaDoInicioEPrazo, type DoInicioEPrazo } from './InicioEPrazo';
import { DatasDoCartao, type AbridoresDasDatas } from './JanelaDasDatas';
import './PrazoNaFolhinha.css';

/** O nome do bloco, para o leitor de tela e para os testes. */
export const ROTULO_DO_PRAZO = 'Prazo';
/** O link que abre a janela das datas: com prazo e sem ele. */
export const MUDAR_PRAZO = 'Mudar prazo', DEFINIR_PRAZO = 'Definir prazo';
/** O botão da janela que tira o prazo (nos outros cartões, "Remover"). */
export const TIRAR_O_PRAZO = 'Tirar o prazo';

interface PropsDaFolhinha {
  folha: FolhaDoDia;
  /** Clicar na folhinha faz o mesmo que o link. Sem isto (a concluída, quem só lê), ela não é botão. */
  aoClicar?: () => void;
}

/** A folhinha de calendário: o mês em cima, numa faixa, o dia grande e o dia da semana. Só para o mouse. */
export function Folhinha({ folha, aoClicar }: PropsDaFolhinha) {
  const dentro = <>
    <span className="folhinha-mes">{folha.mes}</span>
    <span className="folhinha-dia">{folha.dia}</span>
    <span className="folhinha-semana">{folha.semana}</span>
  </>;
  return aoClicar
    ? <button type="button" className="folhinha" tabIndex={-1} aria-hidden="true" onClick={aoClicar}>{dentro}</button>
    : <span className="folhinha" aria-hidden="true">{dentro}</span>;
}

interface Props extends DoInicioEPrazo {
  /** O instante da conclusão (com fuso); null ou nada, com o item aberto. */
  concluidaEm?: string | null;
  /** A linha que as datas oferecem ao menu "Acrescentar ao cartão" (#399): o "ver" leva até o link; o "+" abre a janela. */
  atalho?: TipoDeAtalho;
}

/** O bloco do prazo do cartão: a folhinha, quanto falta, a hora e o lembrete e, para quem altera, o link que abre as datas. */
export function PrazoNaFolhinha({ concluidaEm, atalho, ...datas }: Props) {
  const p = prazoNaFolhinha({ ...datas.valor, concluida_em: concluidaEm }, hojeISO());
  const folha = p.dia ? folhaDoDia(p.dia) : null;
  // A janela se chama "Prazo", como o link que a abre, e o Remover diz o que tira (o início continua lá dentro, e não se tira).
  const janela = { ...janelaDoInicioEPrazo(datas), nome: ROTULO_DO_PRAZO, rotuloDoRemover: TIRAR_O_PRAZO };
  // O dia por extenso, para o leitor de tela (a folhinha é só para o mouse).
  const porExtenso = folha && `${concluidaEm ? 'Concluída em' : 'Prazo'}: ${folha.porExtenso}`;
  const bloco = (a?: AbridoresDasDatas) => <div className="prazo-folhinha">
    {folha && <Folhinha folha={folha} aoClicar={a && p.folhinhaAbre ? () => a.ref.current?.click() : undefined} />}
    <div className="prazo-folhinha-texto">
      <p className={`prazo-folhinha-principal ${p.tom}`}>{p.principal}</p>
      {porExtenso && <span className="sr">{porExtenso}</span>}
      {p.detalhe && <p className="prazo-folhinha-detalhe">{p.detalhe}</p>}
      {a && <button ref={a.ref} type="button" className={estiloBotao({ forma: 'link' }, 'prazo-folhinha-mudar')} aria-haspopup="dialog"
        aria-expanded={a.aberta} aria-description={janela.resumo} onClick={a.alternar}>{datas.valor.prazo ? MUDAR_PRAZO : DEFINIR_PRAZO}</button>}
    </div>
  </div>;
  return <div className="prazo-na-folhinha" role="group" aria-label={ROTULO_DO_PRAZO}>
    <DatasDoCartao {...janela} lido={bloco()} atalho={atalho} abridores={bloco} />
  </div>;
}
