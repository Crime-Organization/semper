// Busca de uma pessoa do cadastro pelo nome, CPF/CNPJ, telefone ou código. A lista de achados abre por cima
// do que vem abaixo (não empurra o formulário) e fecha ao clicar fora ou com Esc.
// Peça comum: vínculos entre pessoas, liberar acesso (Equipe) e, depois, partes de processos, contratos etc.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SD, type PessoaLista } from '../dados';
import { ACHADOS_DA_BUSCA } from '../dados/limites';
import { fmtDocumento, TIPOS } from '../regras/pessoa';
import { falha } from './avisos';
import { useAtrasado } from './util';
import { BotaoLink, estiloBotao } from './base';

interface Props {
  rotulo: ReactNode;
  /** A pessoa já escolhida (basta o id e o nome). */
  escolhida: Pick<PessoaLista, 'id' | 'nome'> | null;
  aoEscolher: (p: PessoaLista | null) => void;
  /** Motivo para uma pessoa não poder ser escolhida (aparece na lista); null se pode. */
  desativar?: (p: PessoaLista) => string | null;
  placeholder?: string;
  focar?: boolean;
}

export function BuscaPessoa({ rotulo, escolhida, aoEscolher, desativar, placeholder = 'Busque pelo nome, CPF/CNPJ ou telefone', focar }: Props) {
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo);
  const [achados, setAchados] = useState<PessoaLista[] | null>(null);
  const [aberta, setAberta] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => { if (focar) campo.current?.focus(); }, [focar]);
  useEffect(() => {
    const t = buscado.trim();
    if (t.length < 2) { setAchados(null); return; }
    let vivo = true;
    SD.pessoasListar({ termo: t, porPagina: ACHADOS_DA_BUSCA }).then(r => { if (vivo) setAchados(r.linhas); }).catch(falha);
    return () => { vivo = false; };
  }, [buscado]);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberta(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberta]);

  if (escolhida) return <label>{rotulo}
    <span className="escolhida"><span title={escolhida.nome}>{escolhida.nome}</span>
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => { aoEscolher(null); setTermo(''); setAchados(null); setTimeout(() => campo.current?.focus(), 0); }}>Trocar</button>
    </span>
  </label>;

  return <div className="busca-pessoa" ref={raiz}>
    <label>{rotulo}<input ref={campo} placeholder={placeholder} autoComplete="off" value={termo} aria-expanded={aberta && !!achados}
      onChange={e => { setTermo(e.target.value); setAberta(true); }} onFocus={() => setAberta(true)}
      onKeyDown={e => {
        // Esc fecha só a lista (sem fechar o cartão em volta); Enter escolhe o primeiro achado (e não envia o formulário).
        if (e.key === 'Escape' && aberta && achados) { e.stopPropagation(); setAberta(false); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const primeiro = achados?.find(p => !desativar?.(p));
        if (primeiro) aoEscolher(primeiro);
      }} /></label>
    {aberta && achados && <ul className="achados">
      {achados.length ? achados.map(p => {
        const motivo = desativar?.(p) || null;
        return <li key={p.id}>
          <button type="button" disabled={!!motivo} onClick={() => aoEscolher(p)}>
            <b>{p.nome}</b><small>{TIPOS[p.tipo]}{p.documento ? ' · ' + fmtDocumento(p.documento) : ''}{motivo ? ' · ' + motivo : ''}</small>
          </button>
        </li>;
      }) : <li className="nota" style={{ padding: '10px 12px' }}>Nenhuma pessoa encontrada. <BotaoLink forma="link" to="/pessoas/nova/">Cadastrar</BotaoLink></li>}
    </ul>}
  </div>;
}
