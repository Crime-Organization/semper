// Seção que recolhe e expande (cartões de pessoa, contrato, demanda...). O conteúdo só é montado
// quando aberto: nada é consultado no banco enquanto a seção está fechada.
// Com "preferencia", a escolha de cada usuário fica guardada e vale na próxima vez. Toda seção tem ícone.
import { useId, useState, type ReactNode } from 'react';
import { Icone, type NomeIcone } from './Icone';
import { lerPreferencia, salvarPreferencia } from './preferencias';

interface Props {
  titulo: string;
  icone: NomeIcone;
  /** Chave da preferência que guarda se a seção fica aberta. Sem ela, a seção sempre começa como "padrao". */
  preferencia?: string;
  padrao?: boolean;
  /** Quantidade mostrada ao lado do título (ex.: quantos vínculos), visível mesmo com a seção fechada. */
  contador?: number;
  children: ReactNode;
}

export function Recolhivel({ titulo, icone, preferencia, padrao = false, contador, children }: Props) {
  const [aberto, setAberto] = useState(() => preferencia ? lerPreferencia(preferencia, padrao) : padrao);
  const id = useId();
  const alternar = () => {
    setAberto(!aberto);
    if (preferencia) salvarPreferencia(preferencia, !aberto);
  };
  return <section className="bloco recolhivel">
    <h3>
      <button type="button" className="recolher" aria-expanded={aberto} aria-controls={id} onClick={alternar}>
        <Icone nome={icone} tam={14} />{titulo}
        {!!contador && <span className="recolher-contador">{contador}</span>}
        <span className="recolher-seta"><Icone nome="abaixo" tam={16} /></span>
      </button>
    </h3>
    {aberto && <div className="bloco-corpo" id={id}>{children}</div>}
  </section>;
}
