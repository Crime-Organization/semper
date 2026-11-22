// Os itens de outro módulo ligados no cadastro, quando podem ser vários (as demandas e os contratos da tarefa, #283): cada um numa
// linha, com o botão de tirar, e o "+" que abre a busca de mais um. Sem nenhum, a busca aparece direto, como um campo comum. A busca
// vem pronta de quem usa (a lista de sugestões é de cada módulo); aqui fica só o arranjo.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Campo, CampoDeVarios, estiloBotao } from './base';
import { Icone } from './Icone';

/** Os textos de cada lista. `id` é o do campo da busca (o mesmo que ela usa), para o rótulo e a dica apontarem para ele. */
export interface TextosDosLigados {
  /** O nome do campo ("Demanda"), na lista e na busca, quando ainda não há nenhum. */
  rotulo: string;
  /** O rótulo da busca de mais um ("Mais uma demanda"). */
  maisUm: string;
  /** O botão "+" ("Adicionar demanda"). */
  adicionar: string;
  /** O botão de tirar ("Tirar a demanda"); para o leitor de tela, com o nome de cada um. */
  tirar: string;
  id: string;
  dica: string;
  /** Quantos a lista aceita: cheia, o "+" some. */
  maximo: number;
}

interface Props {
  textos: TextosDosLigados;
  escolhidos: { id: string; texto: string }[];
  aoTirar: (id: string) => void;
  /** O campo da busca (com o `id` de `textos`). */
  busca: ReactNode;
  erro?: string;
}

export function LigadosNoCadastro({ textos, escolhidos, aoTirar, busca, erro }: Props) {
  // A busca de mais um fica aberta até a lista mudar (escolheu um, ou tirou outro).
  const [buscandoCom, setBuscandoCom] = useState<number | null>(null);
  const buscando = buscandoCom === escolhidos.length;
  const lugarDaBusca = useRef<HTMLDivElement>(null);
  useEffect(() => { if (buscando) lugarDaBusca.current?.querySelector('input')?.focus(); }, [buscando]);

  if (!escolhidos.length) return <Campo rotulo={textos.rotulo} para={textos.id} dica={textos.dica} erro={erro}>{busca}</Campo>;
  return <CampoDeVarios rotulo={textos.rotulo} erro={erro}>
    {escolhidos.map(e => <div className="demanda-contrato-escolhido" key={e.id}>
      <span>{e.texto}</span>
      <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`${textos.tirar}: ${e.texto}`} onClick={() => aoTirar(e.id)}>{textos.tirar}</button>
    </div>)}
    {buscando
      ? <div ref={lugarDaBusca}><Campo rotulo={textos.maisUm} para={textos.id} dica={textos.dica}>{busca}</Campo></div>
      : escolhidos.length < textos.maximo && <div>
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setBuscandoCom(escolhidos.length)}>
          <Icone nome="mais" tam={13} /> {textos.adicionar}
        </button>
      </div>}
  </CampoDeVarios>;
}
