// O Concluir (e o Reabrir) ao lado da Situação do cartão (#397), só onde existe concluir (a tarefa e a demanda): um botão redondo,
// do mesmo desenho dos botões do topo (.cartao-botao), só com o ícone (✓ para concluir; a seta de voltar para reabrir). O nome vai
// para o leitor de tela e para a dica ("Concluir", "Reabrir"). O botão é um só: depois da troca, ele muda de ícone e de nome no
// mesmo lugar, e o foco do teclado volta para ele (desligado enquanto grava, ele perderia o foco). No cartão arquivado ou de quem
// só lê, ele aparece só para ver: apagado, com aria-disabled, sem ação, mas ainda no Tab, para a dica dizer o que ele é.
// Qual ação cabe e para onde ela leva vêm de regras/conclusaoNoCartao.ts.
import { useEffect, useRef, useState } from 'react';
import { NOME_DA_ACAO, type AcaoDeConclusao } from '../../regras/conclusaoNoCartao';
import { propsDaDica } from '../base';
import { Icone, ICONE_DO_TOPO, type NomeIcone } from '../Icone';

/** O ícone de cada ação. */
const ICONE_DA_ACAO: Record<AcaoDeConclusao, NomeIcone> = { concluir: 'check', reabrir: 'voltar' };

interface Props {
  /** A ação que cabe agora (null: o quadro não tem a coluna-marco, e o botão não aparece). */
  acao: AcaoDeConclusao | null;
  /** O cartão arquivado ou de quem só lê: o botão aparece, mas não age. */
  soParaVer: boolean;
  /** Faz a ação (leva o item à coluna); o botão espera ela terminar. */
  aoAgir: (acao: AcaoDeConclusao) => Promise<unknown>;
}

export function ConcluirNaSituacao({ acao, soParaVer, aoAgir }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  // Ligado de novo, o botão recebe o foco que perdeu ao ser desligado (já com o nome novo). Espera ele estar na tela: enquanto a ação
  // termina (as perguntas depois de concluir, #355), o quadro pode se reler e o botão sumir por um instante. Não tira o foco de quem
  // já o pôs em outro lugar.
  const devolverFoco = useRef(false);
  useEffect(() => {
    if (ocupado || !devolverFoco.current || !botao.current) return;
    devolverFoco.current = false;
    if (!document.activeElement || document.activeElement === document.body) botao.current.focus();
  });
  if (!acao) return null;
  const nome = NOME_DA_ACAO[acao];

  async function agir() {
    if (soParaVer || ocupado || !acao) return;
    setOcupado(true);
    try {
      await aoAgir(acao);
    } finally {
      devolverFoco.current = true;
      setOcupado(false);
    }
  }

  return <button ref={botao} type="button" className="cartao-botao cartao-concluir" aria-label={nome} {...propsDaDica(nome)}
    aria-disabled={soParaVer || undefined} aria-busy={ocupado || undefined} disabled={ocupado} onClick={() => void agir()}>
    <Icone nome={ICONE_DA_ACAO[acao]} tam={ICONE_DO_TOPO} />
  </button>;
}
