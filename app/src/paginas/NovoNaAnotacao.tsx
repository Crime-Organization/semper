// O "+ Novo…" da seção "Ligada a" da anotação (#376), ao lado de "Ligar a outro item": abre um menu (<MenuFlutuante>) com um item
// por módulo ligado no escritório (as pessoas sempre; o processo, nunca), e cada um leva ao cadastro do item já ligado à anotação
// (regras/novoNaAnotacao.ts). Na anotação nova, ainda sem ir ao banco, não há a que ligar: o botão fica desligado, mas no Tab
// (aria-disabled), com o motivo na dica e para o leitor de tela, como o botão do lembrete; ele liga sozinho quando ela é gravada.
// Quem mostra o botão confere antes se a pessoa liga itens na anotação e se ela ainda tem lugar (as condições do "Ligar"). Na seção
// com o "+" no título (#427), o botão daqui não aparece: o "+" abre o mesmo menu (e, na anotação nova, fica desligado com o motivo).
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ItemDaAnotacao, ModuloDaAnotacao } from '../dados';
import { cadastroNaAnotacao, modulosDoNovo, NOVO_ESPERA_A_ANOTACAO, NOVO_NA_ANOTACAO, type ModuloDoNovoNaAnotacao } from '../regras/novoNaAnotacao';
import { estiloBotao } from '../ui/base';
import { Icone, ICONE_DO_MODULO } from '../ui/Icone';
import { MenuFlutuante } from '../ui/Menu';
import { usePedidoDeNovo } from '../ui/Recolhivel';

/** O tamanho do "+" no botão (o dos outros botões de baixo das seções) e o do ícone de cada item do menu (o dos outros menus). */
const ICONE_DO_BOTAO = 13, ICONE_DO_MENU = 15;
/**
 * O texto do botão e o nome do menu. O menu dá também o nome do "+" do título de "Ligada a" (#390), que abre o mesmo menu: sozinho,
 * fora da linha de "Ligar a outro item", "Novo…" não diria ao leitor de tela o que é novo.
 */
export const ROTULO_DO_NOVO_NA_ANOTACAO = 'Novo…';
export const NOME_DO_MENU_NOVO_NA_ANOTACAO = 'Novo item ligado a esta anotação';

interface Props {
  /** Os módulos que se podem ligar à anotação (os ligados no escritório e as pessoas). */
  modulos: readonly ModuloDaAnotacao[];
  /** A anotação gravada; null na anotação nova, que ainda não foi ao banco (o botão espera). */
  anotacaoId: string | null;
  /** Os itens já ligados (os que a pessoa vê): com uma pessoa só, ela já vem no cadastro. Na anotação nova, nenhum conta. */
  itens?: readonly Pick<ItemDaAnotacao, 'modulo' | 'id' | 'arquivado_em'>[];
}

export function NovoNaAnotacao({ modulos, anotacaoId, itens = [] }: Props) {
  const navegar = useNavigate();
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const idDoMotivo = useId();
  // O "+" do título da seção abre o mesmo menu, preso a ele (a anotação nova, que espera, não tem o "+").
  const { peloTitulo } = usePedidoDeNovo(alvo => { if (anotacaoId) setBotao(alvo); });
  const opcoes = modulosDoNovo(modulos);
  if (!opcoes.length) return null;
  const esperando = !anotacaoId;
  function abrir(m: ModuloDoNovoNaAnotacao) {
    setBotao(null);
    navegar(cadastroNaAnotacao(m, anotacaoId!, itens));
  }
  return <>
    {!peloTitulo && <><button type="button" className={estiloBotao({ forma: 'mini' })} aria-haspopup="menu" aria-expanded={!!botao} aria-disabled={esperando || undefined}
      aria-describedby={esperando ? idDoMotivo : undefined} title={esperando ? NOVO_ESPERA_A_ANOTACAO : undefined}
      onClick={e => { if (esperando) return; const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="mais" tam={ICONE_DO_BOTAO} /> {ROTULO_DO_NOVO_NA_ANOTACAO}
    </button>
    {esperando && <span className="sr" id={idDoMotivo}>{NOVO_ESPERA_A_ANOTACAO}</span>}</>}
    {botao && <MenuFlutuante botao={botao} aoFechar={() => setBotao(null)} rotulo={NOME_DO_MENU_NOVO_NA_ANOTACAO}>
      {opcoes.map(m => <button key={m} type="button" role="menuitem" onClick={() => abrir(m)}>
        <Icone nome={ICONE_DO_MODULO[m]} tam={ICONE_DO_MENU} /> {NOVO_NA_ANOTACAO[m].rotulo}
      </button>)}
    </MenuFlutuante>}
  </>;
}
