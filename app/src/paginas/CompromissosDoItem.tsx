// A seção "Compromissos" do cartão de uma tarefa, de uma demanda ou de um contrato (#306): os compromissos ligados a ele que a pessoa
// vê, com o número ao lado do título mesmo com a seção fechada e, no título (#427), o "+" do compromisso novo, que já nasce ligado a este cartão, e a corrente
// "Ligar compromisso existente". Como no cartão do processo, a lista vem de CompromissosLigados.
import { useState } from 'react';
import { SD, type ModuloDoCompromisso } from '../dados';
import { nomeDoCompromisso } from '../regras/compromisso';
import { PARAMETRO_DA_ORIGEM_DO_COMPROMISSO } from '../regras/nascerLigado';
import { AcoesDosLigados } from '../ui/ItensLigados';
import { LigarDoModulo, ligarDoModulo } from '../ui/LigarDoModulo';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { useQuantos } from '../ui/useQuantos';
import { CompromissosLigados } from './CompromissosLigados';
import { ligarCompromissoNoItem, ligarEAvisar } from './ligarNoCartao';

/** O cadastro de compromisso já ligado ao item: /agenda/novo/?demanda=… (o nome do parâmetro é o de cada módulo). */
export const novoCompromissoDoItem = (modulo: ModuloDoCompromisso, id: string) =>
  `/agenda/novo/?${new URLSearchParams({ [PARAMETRO_DA_ORIGEM_DO_COMPROMISSO[modulo]]: id })}`;

/** Os textos de cada cartão. */
const TEXTOS: Record<ModuloDoCompromisso, { vazio: string; novo: string; ja: string }> = {
  tarefas: { vazio: 'Nenhum compromisso ligado a esta tarefa.', novo: 'Novo compromisso desta tarefa', ja: 'Este compromisso já estava ligado a esta tarefa.' },
  demandas: { vazio: 'Nenhum compromisso ligado a esta demanda.', novo: 'Novo compromisso desta demanda', ja: 'Este compromisso já estava ligado a esta demanda.' },
  contratos: { vazio: 'Nenhum compromisso ligado a este contrato.', novo: 'Novo compromisso deste contrato', ja: 'Este compromisso já estava ligado a este contrato.' }
};

interface Props {
  modulo: ModuloDoCompromisso;
  id: string;
  /** Quem pode criar e ligar aqui: quem muda o cartão, com ele ativo (o banco confere que a pessoa também muda o compromisso). */
  podeLigar: boolean;
  /** Muda quando o cartão foi relido (ex.: depois de desfazer): relê a lista e o número. */
  versao?: number;
}

export function CompromissosDoItem({ modulo, id, podeLigar, versao = 0 }: Props) {
  const ctx = useCtx();
  const ligado = !!ctx.escritorio?.modulos?.compromissos;
  // Cada ligação feita aqui relê a lista e o número.
  const [mudou, setMudou] = useState(0);
  const chave = `${id}:${versao}:${mudou}`;
  const quantos = useQuantos(() => SD.compromissosDoItem(modulo, id), chave, ligado);
  if (!ligado) return null;
  const textos = TEXTOS[modulo], para = novoCompromissoDoItem(modulo, id);
  return <Recolhivel titulo="Compromissos" icone="calendario" preferencia={`${modulo}.cartao.compromissos`} contador={quantos}
    ligar={podeLigar ? ligarDoModulo('compromissos') : undefined} novo={podeLigar ? { para, rotulo: textos.novo } : undefined}>
    {/* Lê a lista uma vez: muda a chave quando algo foi ligado ou o cartão relido. */}
    <CompromissosLigados key={chave} carregar={() => SD.compromissosDoItem(modulo, id)} vazio={textos.vazio} />
    {podeLigar && <AcoesDosLigados>
      <LigarDoModulo modulo="compromissos" filtro={async () => ({ fora: (await SD.compromissosDoItem(modulo, id)).map(c => c.id) })}
        aoEscolher={c => ligarEAvisar(() => ligarCompromissoNoItem(modulo, id, c.id),
          { feito: `Compromisso ligado: ${nomeDoCompromisso(c)}.`, oQue: 'ligação do compromisso', ja: textos.ja }, () => setMudou(n => n + 1))} />
    </AcoesDosLigados>}
  </Recolhivel>;
}
