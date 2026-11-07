// Seção que recolhe e expande (cartões de pessoa, contrato, demanda...). O conteúdo só é montado
// quando aberto: nada é consultado no banco enquanto a seção está fechada.
// Toda seção começa recolhida. Com "preferencia", a escolha de cada usuário (aberta ou fechada) fica guardada e vale
// na próxima vez. Toda seção tem ícone.
// Dentro de um grupo (<GrupoDeSecoes>, que o painel do cartão põe em volta do conteúdo), cada seção se inscreve, e a
// primeira mostra, logo acima dela e alinhado às setas, o botão "Expandir tudo" (ou "Recolher tudo", se já estão todas
// abertas), que abre ou fecha todas de uma vez, sem mudar a escolha guardada de cada uma.
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icone, type NomeIcone } from './Icone';
import { lerPreferencia, salvarPreferencia } from './preferencias';

/** A inscrição, que não muda enquanto o painel está aberto (a seção se inscreve uma vez e mantém a ordem). */
interface Inscricao {
  inscrever: (id: string, definir: (aberta: boolean) => void) => () => void;
  mudou: (id: string, aberta: boolean) => void;
}
/** O que o botão precisa: qual seção é a primeira, se estão todas abertas e como abrir ou fechar todas. */
interface EstadoDoGrupo { primeira: string | null; todasAbertas: boolean; definirTodas: (aberta: boolean) => void }
const InscricaoNoGrupo = createContext<Inscricao | null>(null);
const EstadoDoGrupo = createContext<EstadoDoGrupo | null>(null);

/** Põe as seções de dentro num grupo, com o botão de expandir e recolher todas acima da primeira. */
export function GrupoDeSecoes({ children }: { children: ReactNode }) {
  const secoes = useRef(new Map<string, { aberta: boolean; definir: (aberta: boolean) => void }>());
  // Cada inscrição ou mudança redesenha o grupo (o estado das seções fica na referência).
  const [, setVersao] = useState(0);
  const [inscricao] = useState<Inscricao>(() => ({
    inscrever: (id, definir) => {
      secoes.current.set(id, { aberta: false, definir });
      setVersao(v => v + 1);
      return () => { secoes.current.delete(id); setVersao(v => v + 1); };
    },
    mudou: (id, aberta) => {
      const s = secoes.current.get(id);
      if (s && s.aberta !== aberta) { s.aberta = aberta; setVersao(v => v + 1); }
    }
  }));
  const todas = [...secoes.current.values()];
  const estado: EstadoDoGrupo = {
    primeira: secoes.current.keys().next().value ?? null,
    todasAbertas: todas.length > 0 && todas.every(s => s.aberta),
    definirTodas: aberta => secoes.current.forEach(s => s.definir(aberta))
  };
  return <InscricaoNoGrupo.Provider value={inscricao}>
    <EstadoDoGrupo.Provider value={estado}>{children}</EstadoDoGrupo.Provider>
  </InscricaoNoGrupo.Provider>;
}

/** O botão que abre ou fecha todas as seções do grupo, à direita, na coluna das setas. */
function ExpandirTudo({ estado }: { estado: EstadoDoGrupo }) {
  const rotulo = estado.todasAbertas ? 'Recolher tudo' : 'Expandir tudo';
  return <div className="secoes-todas">
    <button type="button" className="recolher-todas" onClick={() => estado.definirTodas(!estado.todasAbertas)}>
      {rotulo}<Icone nome={estado.todasAbertas ? 'recolher' : 'expandir'} tam={16} />
    </button>
  </div>;
}

interface Props {
  titulo: string;
  icone: NomeIcone;
  /** Chave da preferência que guarda se a seção fica aberta. Sem ela, a seção sempre começa recolhida. */
  preferencia?: string;
  /** Quantidade mostrada ao lado do título (ex.: quantos vínculos), visível mesmo com a seção fechada. */
  contador?: number;
  /**
   * Fica de fora do "Expandir tudo" (ex.: as informações sigilosas: cada abertura é registrada, e só abre quem
   * clicar nela).
   */
  foraDoExpandirTudo?: boolean;
  children: ReactNode;
}

export function Recolhivel({ titulo, icone, preferencia, contador, foraDoExpandirTudo = false, children }: Props) {
  const [aberto, setAberto] = useState(() => preferencia ? lerPreferencia(preferencia, false) : false);
  const id = useId();
  const inscricao = useContext(InscricaoNoGrupo);
  const estado = useContext(EstadoDoGrupo);
  const noGrupo = !!inscricao && !foraDoExpandirTudo;
  useEffect(() => {
    if (!inscricao || foraDoExpandirTudo) return;
    return inscricao.inscrever(id, setAberto);
  }, [inscricao, foraDoExpandirTudo, id]);
  useEffect(() => { if (noGrupo) inscricao.mudou(id, aberto); }, [noGrupo, inscricao, id, aberto]);
  const alternar = () => {
    setAberto(!aberto);
    if (preferencia) salvarPreferencia(preferencia, !aberto);
  };
  return <>
    {noGrupo && estado?.primeira === id && <ExpandirTudo estado={estado} />}
    <section className="bloco recolhivel">
      <h3>
        <button type="button" className="recolher" aria-expanded={aberto} aria-controls={id} onClick={alternar}>
          <Icone nome={icone} tam={14} />{titulo}
          {contador !== undefined && <span className={'recolher-contador' + (contador ? '' : ' vazio')}>{contador}</span>}
          <span className="recolher-seta"><Icone nome="abaixo" tam={16} /></span>
        </button>
      </h3>
      {aberto && <div className="bloco-corpo" id={id}>{children}</div>}
    </section>
  </>;
}
