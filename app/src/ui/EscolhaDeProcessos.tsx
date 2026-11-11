// Os processos de um cadastro (demanda, tarefa, contrato), no modelo de EscolhaDaEquipe: aparecem só os escolhidos, cada um
// com o "X" para tirar, e o "+ Ligar processo" abre a busca dos processos que a pessoa pode ligar. Grava ao salvar o
// formulário (no cartão, ProcessosDoCartao grava na hora) (#294).
import { useId, useRef, type ReactNode } from 'react';
import type { ProcessoLigado } from '../dados/tipos';
import { cabeOutroProcesso, detalheDoProcesso, nomeDoProcesso } from '../regras/processo';
import { Nota } from './base';
import { Icone } from './Icone';
import { LigarProcesso } from './LigarProcesso';

/** O processo como o cadastro mostra. A tarefa só traz o número e o tipo; a demanda e o contrato, também o nome. */
export type ProcessoEscolhido = Pick<ProcessoLigado, 'id' | 'codigo' | 'tipo' | 'numero'> & Partial<Pick<ProcessoLigado, 'titulo' | 'cliente_nome'>>;
export const nomeDoEscolhido = (p: ProcessoEscolhido) => nomeDoProcesso({ titulo: p.titulo ?? null, cliente_nome: p.cliente_nome ?? '', numero: p.numero });

interface Props {
  /** "Processos" ou, quando cabe um só, "Processo". */
  rotulo: string;
  dica?: ReactNode;
  escolhidos: ProcessoEscolhido[];
  /** Os ligados que a pessoa não pode abrir: ficam como estão, só contados. */
  ocultos?: number;
  aoMudar: (lista: ProcessoEscolhido[]) => void;
  /** A tarefa tem um processo só. */
  maximo?: number;
}

export function EscolhaDeProcessos({ rotulo, dica, escolhidos, ocultos = 0, aoMudar, maximo }: Props) {
  const id = useId();
  const grupo = useRef<HTMLDivElement>(null);
  // Depois de tirar, o foco vai ao grupo: o botão de tirar sumiu, e o teclado não se perde.
  const tirar = (x: string) => { aoMudar(escolhidos.filter(p => p.id !== x)); setTimeout(() => grupo.current?.focus(), 0); };
  return <div ref={grupo} tabIndex={-1} className="pergunta" role="group" aria-labelledby={id + 'r'}>
    <span className="rot" id={id + 'r'}>{rotulo}</span>
    {dica && <p className="dica">{dica}</p>}
    {escolhidos.length > 0 && <ul className="processos-escolhidos" aria-labelledby={id + 'r'}>
      {escolhidos.map(p => <li key={p.id} className="escolhida">
        <span><b>{nomeDoEscolhido(p)}</b><small>{detalheDoProcesso(p)}</small></span>
        <button type="button" className="icone-btn" aria-label={`Tirar o processo ${nomeDoEscolhido(p)}`} title="Tirar o processo" onClick={() => tirar(p.id)}>
          <Icone nome="fechar" tam={15} />
        </button>
      </li>)}
    </ul>}
    {ocultos > 0 && <Nota>Também há processo ligado que você não tem acesso para abrir. Ele continua ligado.</Nota>}
    {cabeOutroProcesso(escolhidos.length + ocultos, maximo) && <LigarProcesso ligados={escolhidos.map(p => p.id)} aoEscolher={p => aoMudar([...escolhidos, p])} />}
  </div>;
}
