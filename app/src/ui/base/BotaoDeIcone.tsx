// O botão só com o ícone, nas ações de cada linha de uma lista (#423: os prazos e os andamentos do processo, as tabelas das
// configurações, as contas e os sócios do financeiro...): no lugar de "Mudar", "Excluir", "Criar tarefa" escritos em cada linha, o
// ícone, e a explicação aparece ao passar o mouse e no foco do teclado (a dica, [data-dica] em estilo.css). O nome para o leitor
// de tela (aria-label) é o rótulo, o mesmo texto que o botão tinha antes; a explicação mais longa, quando há, vai também como
// descrição. O comportamento (ocupado, confirmar em dois cliques) fica em ../Botoes.tsx, que usa estas mesmas props.
import type { ComponentProps } from 'react';
import { Icone, ICONE_DO_BOTAO_PEQUENO, type NomeIcone } from '../Icone';
import { estiloBotao, type VarianteBotao } from './botao';

/** O que um botão só de ícone precisa: o desenho, o nome (o texto que o botão teria) e, se o nome não basta, uma explicação. */
export interface SoIcone { icone: NomeIcone; rotulo: string; dica?: string }

/**
 * O nome e a dica de um botão só de ícone: o aria-label é o rótulo; a dica, a explicação (ou o próprio rótulo). A explicação que
 * diz algo além do rótulo vai também ao leitor de tela, como descrição; a que já está no rótulo ("Mudar o prazo", no botão
 * "Mudar o prazo Réplica"), não.
 */
export const propsDoBotaoDeIcone = (rotulo: string, dica?: string) => ({
  'aria-label': rotulo,
  'data-dica': dica || rotulo,
  ...(dica && !rotulo.includes(dica) ? { 'aria-description': dica } : {})
});

/** O ícone do botão, no tamanho dos botões pequenos das listas. */
export const IconeDoBotao = ({ icone }: { icone: NomeIcone }) => <Icone nome={icone} tam={ICONE_DO_BOTAO_PEQUENO} />;

type Props = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & SoIcone & { variante?: VarianteBotao };

/** Botão só de ícone, sem comportamento próprio (ex.: o "Mudar" de cada prazo). */
export function BotaoDeIcone({ icone, rotulo, dica, variante, className, type = 'button', ...resto }: Props) {
  return <button type={type} className={estiloBotao({ forma: 'icone', variante }, className)} {...propsDoBotaoDeIcone(rotulo, dica)} {...resto}>
    <IconeDoBotao icone={icone} />
  </button>;
}
