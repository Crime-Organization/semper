// Busca de uma pessoa do cadastro pelo nome, CPF/CNPJ, telefone ou código, com a lista de achados.
// Peça comum: vínculos entre pessoas, liberar acesso (Equipe) e, depois, partes de processos, contratos etc.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { SD, type PessoaLista } from '../dados';
import { fmtDocumento, TIPOS } from '../regras/pessoa';
import { falha } from './avisos';
import { useAtrasado } from './util';

interface Props {
  rotulo: string;
  escolhida: PessoaLista | null;
  aoEscolher: (p: PessoaLista | null) => void;
  /** Motivo para uma pessoa não poder ser escolhida (aparece na lista); null se pode. */
  desativar?: (p: PessoaLista) => string | null;
  placeholder?: string;
  focar?: boolean;
}

export function BuscaPessoa({ rotulo, escolhida, aoEscolher, desativar, placeholder = 'Busque pelo nome, CPF/CNPJ ou telefone', focar }: Props) {
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo, 300);
  const [achados, setAchados] = useState<PessoaLista[] | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { if (focar) campo.current?.focus(); }, [focar]);
  useEffect(() => {
    const t = buscado.trim();
    if (t.length < 2) { setAchados(null); return; }
    let vivo = true;
    SD.pessoasListar({ termo: t, porPagina: 8 }).then(r => { if (vivo) setAchados(r.linhas); }).catch(falha);
    return () => { vivo = false; };
  }, [buscado]);

  if (escolhida) return <label>{rotulo}
    <span className="escolhida"><span>{escolhida.nome}</span>
      <button type="button" className="mini" onClick={() => { aoEscolher(null); setTermo(''); setAchados(null); setTimeout(() => campo.current?.focus(), 0); }}>Trocar</button>
    </span>
  </label>;

  return <div className="busca-pessoa">
    <label>{rotulo}<input ref={campo} placeholder={placeholder} autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)}
      onKeyDown={e => {
        // Enter escolhe o primeiro achado (e não envia o formulário em volta).
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const primeiro = achados?.find(p => !desativar?.(p));
        if (primeiro) aoEscolher(primeiro);
      }} /></label>
    {achados && <ul className="achados">
      {achados.length ? achados.map(p => {
        const motivo = desativar?.(p) || null;
        return <li key={p.id}>
          <button type="button" disabled={!!motivo} onClick={() => aoEscolher(p)}>
            <b>{p.nome}</b><small>{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''}{motivo ? ' · ' + motivo : ''}</small>
          </button>
        </li>;
      }) : <li className="nota" style={{ padding: '10px 12px' }}>Nenhuma pessoa encontrada. <Link className="link" to="/pessoas/nova/">Cadastrar</Link></li>}
    </ul>}
  </div>;
}
