// O botão do lembrete (#299), com o sino, ao lado do campo de data e hora do prazo (tarefas e demandas, no cadastro e no próprio
// cartão). Ele mostra o que foi escolhido ("1 hora antes", ou "Sem lembrete") e abre as opções num menu (<MenuFlutuante>): na hora,
// 30 minutos, 1 hora ou 1 dia antes, ou nenhum, com a nota de quem recebe. Sem prazo, fica desligado (veja lembreteDesligado), mas
// continua no Tab (aria-disabled): o teclado e o leitor de tela chegam nele e ouvem o motivo, que no celular, sem o title, também
// não sumiria. As opções e os textos ficam em regras/lembrete.ts.
import { useId, useState } from 'react';
import type { Lembrete } from '../../dados';
import { LEMBRETE_SEM_PRAZO, LEMBRETES, lembreteDesligado, NOTA_DO_LEMBRETE, OPCOES_DE_LEMBRETE, SEM_LEMBRETE, textoDoLembrete } from '../../regras/lembrete';
import { Icone } from '../Icone';
import { MenuFlutuante } from '../Menu';
import { estiloBotao } from './botao';

/** O tamanho do sino no botão e o da marca da opção escolhida, no menu (o mesmo dos outros menus). */
const TAMANHO_DO_SINO = 18, TAMANHO_DA_MARCA = 15;

interface Props {
  /** O lembrete escolhido, ou null sem lembrete. */
  valor: Lembrete | null;
  aoMudar: (lembrete: Lembrete | null) => void;
  /** O prazo como está no formulário: sem ele (e sem lembrete), o botão fica desligado. */
  prazo: string;
  /** O lembrete está com erro (a mensagem aparece no <Campo> do prazo): o botão fica marcado. */
  comErro?: boolean;
  /** O id da dica e do erro do campo do prazo, que o botão também lê. */
  'aria-describedby'?: string;
}

export function BotaoDoLembrete({ valor, aoMudar, prazo, comErro, 'aria-describedby': descrito }: Props) {
  const [botao, setBotao] = useState<HTMLButtonElement | null>(null);
  const idDoMotivo = useId();
  const desligado = lembreteDesligado(prazo, valor);
  const texto = textoDoLembrete(valor);
  function escolher(lembrete: Lembrete | null) {
    aoMudar(lembrete);
    setBotao(null);
    botao?.focus();
  }
  const opcao = (lembrete: Lembrete | null, nome: string) => <button key={lembrete ?? 'nenhum'} type="button" role="menuitemradio" aria-checked={valor === lembrete}
    onClick={() => escolher(lembrete)}>
    <span className="kmenu-marca">{valor === lembrete && <Icone nome="check" tam={TAMANHO_DA_MARCA} />}</span>{nome}
  </button>;
  const descricao = [desligado ? idDoMotivo : null, descrito].filter(Boolean).join(' ') || undefined;
  return <>
    <button type="button" className={estiloBotao({}, 'botao-do-lembrete')} aria-label={`Lembrete: ${texto}`} aria-haspopup="menu" aria-expanded={!!botao}
      aria-describedby={descricao} data-escolhido={valor !== null || undefined} data-erro={comErro || undefined} aria-disabled={desligado || undefined}
      title={desligado ? LEMBRETE_SEM_PRAZO : undefined}
      onClick={e => { if (desligado) return; const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="sino" tam={TAMANHO_DO_SINO} /><span>{texto}</span>
    </button>
    {desligado && <span className="sr" id={idDoMotivo}>{LEMBRETE_SEM_PRAZO}.</span>}
    {botao && <MenuFlutuante botao={botao} aoFechar={() => setBotao(null)} rotulo="Lembrete">
      {OPCOES_DE_LEMBRETE.map(l => opcao(l, LEMBRETES[l].nome))}
      <hr className="kmenu-divisoria" />
      {opcao(null, SEM_LEMBRETE)}
      <p className="kmenu-nota">{NOTA_DO_LEMBRETE}</p>
    </MenuFlutuante>}
  </>;
}
