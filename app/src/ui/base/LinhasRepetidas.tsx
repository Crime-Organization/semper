// Lista de linhas que a pessoa acrescenta e tira, cada linha com os mesmos campos (ex.: as inscrições na OAB, com
// número e UF; a formação, com curso, instituição e ano). Vai dentro de uma .grade-form e ocupa a linha inteira; os
// campos de cada linha dividem as 12 colunas como os outros campos do formulário (naGrade).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icone } from '../Icone';
import { estiloBotao } from './botao';
import { naGrade, type TamanhoNaGrade } from '.';

/** Um campo de cada linha: o rótulo (que também vai de exemplo no campo vazio), o tamanho e, para escolher, as opções. */
export interface ColunaDaLinha<T> {
  campo: keyof T & string;
  rotulo: string;
  maximo: number;
  tamanho?: TamanhoNaGrade;
  /** Com opções, o campo é uma lista para escolher (ex.: as UFs). */
  opcoes?: readonly string[];
  tipo?: 'text' | 'url';
}

interface PropsLinhas<T extends Record<string, string>> {
  rotulo: ReactNode;
  dica?: ReactNode;
  erro?: ReactNode;
  /** Como se chama cada linha, no singular e em minúsculas (ex.: "inscrição"): "Adicionar inscrição", "Tirar a inscrição 2". */
  item: string;
  /** Artigo do item ("a" ou "o"), para "Tirar a inscrição 2". */
  artigo: 'a' | 'o';
  linhas: T[];
  colunas: ColunaDaLinha<T>[];
  /** A linha nova, em branco. */
  nova: T;
  /** Quantas linhas cabem; com elas todas, "Adicionar" fica desligado. */
  maximo: number;
  aoMudar: (linhas: T[]) => void;
}

export function LinhasRepetidas<T extends Record<string, string>>({ rotulo, dica, erro, item, artigo, linhas, colunas, nova, maximo, aoMudar }: PropsLinhas<T>) {
  const id = useId();
  const lista = useRef<HTMLOListElement>(null);
  // Depois de "Adicionar", o cursor vai para o primeiro campo da linha nova.
  const [focarNova, setFocarNova] = useState(false);
  useEffect(() => {
    if (!focarNova) return;
    lista.current?.querySelector<HTMLElement>('li:last-child input, li:last-child select')?.focus();
    setFocarNova(false);
  }, [focarNova]);
  const mudar = (i: number, campo: keyof T, valor: string) => aoMudar(linhas.map((l, j) => j === i ? { ...l, [campo]: valor } : l));
  return <div className={'campo-form linhas-repetidas' + (erro ? ' com-erro' : '')} role="group" aria-labelledby={id}
    aria-describedby={erro ? id + '-erro' : undefined}>
    <span className="rot" id={id}>{rotulo}</span>
    {dica && <p className="dica">{dica}</p>}
    {linhas.length > 0 && <ol ref={lista}>{linhas.map((linha, i) => <li key={i}>
      <div className="grade-form">{colunas.map(c => {
        const rotuloDoCampo = `${c.rotulo} (${item} ${i + 1})`;
        return <div key={c.campo} style={naGrade(c.tamanho)}>
          {c.opcoes
            ? <select aria-label={rotuloDoCampo} value={linha[c.campo]} onChange={e => mudar(i, c.campo, e.target.value)}>
              <option value="">{c.rotulo}</option>
              {c.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            : <input type="text" inputMode={c.tipo === 'url' ? 'url' : undefined} aria-label={rotuloDoCampo} placeholder={c.rotulo} maxLength={c.maximo}
              value={linha[c.campo]} onChange={e => mudar(i, c.campo, e.target.value)} />}
        </div>;
      })}</div>
      <button type="button" className="icone-btn" aria-label={`Tirar ${artigo} ${item} ${i + 1}`} onClick={() => aoMudar(linhas.filter((_, j) => j !== i))}>
        <Icone nome="fechar" tam={15} />
      </button>
    </li>)}</ol>}
    <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={linhas.length >= maximo} onClick={() => { aoMudar([...linhas, { ...nova }]); setFocarNova(true); }}>
      <Icone nome="mais" tam={13} /> Adicionar {item}
    </button></div>
    {erro && <span className="erro-campo" id={id + '-erro'} role="alert">{erro}</span>}
  </div>;
}
