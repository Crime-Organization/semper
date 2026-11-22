// O filtro dos painéis (#401): de quem é o trabalho mostrado. Só o administrador vê o filtro, discreto, no alto, à direita do
// título: "Meu trabalho", "Equipe toda" ou uma pessoa da equipe. A escolha fica nas preferências de quem escolheu (cada painel com a
// sua chave), e vale em qualquer aparelho. As regras (quem pode escolher, o que fazer com uma escolha velha) ficam em
// regras/filtroDoPainel.ts.
import { useMemo, useState } from 'react';
import type { Membro } from '../../dados';
import { alcanceDoPainel, EQUIPE_TODA, escolhaDoAlcance, MEU_TRABALHO, pessoasDoFiltro, type AlcanceDoPainel } from '../../regras/filtroDoPainel';
import { lerPreferencia, salvarPreferencia } from '../preferencias';
import { useCtx } from '../sessao';

/** O alcance escolhido no painel e como trocar (a troca já fica guardada na preferência "chave"). */
export function useAlcanceDoPainel(chave: string): [AlcanceDoPainel, (escolha: string) => void] {
  const ctx = useCtx();
  const [escolha, setEscolha] = useState<unknown>(() => lerPreferencia<unknown>(chave, MEU_TRABALHO));
  // O mesmo objeto enquanto nada muda: a tela lê o painel de novo só quando o alcance muda de verdade.
  const alcance = useMemo(() => alcanceDoPainel(escolha, { ehAdmin: ctx.ehAdmin, eu: ctx.perfil.id, equipe: ctx.equipe }), [escolha, ctx.ehAdmin, ctx.perfil.id, ctx.equipe]);
  return [alcance, nova => { setEscolha(nova); salvarPreferencia(chave, nova); }];
}

/** A escolha de quem é o trabalho mostrado. A tela só a mostra para o administrador. */
export function FiltroDoPainel({ alcance, equipe, eu, aoEscolher }: { alcance: AlcanceDoPainel; equipe: readonly Membro[]; eu: string; aoEscolher: (escolha: string) => void }) {
  const pessoas = pessoasDoFiltro(equipe, eu);
  return <label className="filtro-do-painel">
    <span>Mostrar</span>
    <select className="filtro" value={escolhaDoAlcance(alcance)} onChange={e => aoEscolher(e.target.value)}>
      <option value={MEU_TRABALHO}>Meu trabalho</option>
      <option value={EQUIPE_TODA}>Equipe toda</option>
      {pessoas.length > 0 && <optgroup label="Uma pessoa da equipe">
        {pessoas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </optgroup>}
    </select>
  </label>;
}
