// A bolinha "Acrescentar ao cartão" (#399, pedido do dono de 21/11, no lugar da linha de botões rápidos da #351): um botão redondo
// só, no topo do cartão, ao lado da etiqueta, do lápis e do ⋯ (MoldeDoTopo), que abre um menu com cada coisa que aquele cartão pode
// ter (as datas, os checklists, as anotações, as ligações), na ordem de regras/atalhosDoCartao.ts. Cada linha mostra quantas já
// existem e tem duas ações: ver (o nome da coisa, que vai até ela no cartão e a abre) e acrescentar (o "+", que abre o mesmo
// formulário ou menu do "+" da seção, preso à bolinha). Quem oferece cada linha (veja registroDeAtalhos.tsx) é quem já sabe mostrar
// e abrir a coisa: a seção com `atalho` (Recolhivel) e o dado que se muda no lugar (DadoEditavel). No cartão arquivado ou só para
// ler, ninguém oferece o acrescentar: o menu só tem o ver. Sem nada a oferecer, a bolinha não aparece. Pelo teclado, as setas andam
// pelas ações, e o Esc fecha o menu com o foco de volta na bolinha.
import { useState } from 'react';
import { Link } from 'react-router';
import { coisasDoMenu, NOME_DO_MENU_DE_ATALHOS, NOME_NO_MENU, nomeDoVer, type TipoDeAtalho } from '../regras/atalhosDoCartao';
import { Contador, propsDaDica } from './base';
import { Icone, ICONE_DO_TOPO, type NomeIcone } from './Icone';
import { MenuFlutuante } from './Menu';
import { useAtalhosOferecidos, type CoisaDoCartao } from './registroDeAtalhos';

/** O ícone de cada linha, o mesmo da coisa no cartão. */
const ICONE_DA_COISA: Record<TipoDeAtalho, NomeIcone> = {
  datas: 'calendario',
  checklist: 'check',
  anotacao: 'documentos',
  ligacao: 'vinculo'
};
/** O tamanho dos ícones dentro do menu (como nos outros menus do cartão). */
const ICONE_DO_MENU = 15;

/** Uma linha do menu: o ver e, para quem pode, o "+". */
function LinhaDoMenu({ tipo, coisa, bolinha, fechar }: { tipo: TipoDeAtalho; coisa: CoisaDoCartao; bolinha: HTMLElement; fechar: () => void }) {
  const novo = coisa.acrescentar;
  const mais = <Icone nome="mais" tam={ICONE_DO_MENU} />;
  return <div className="acrescentar-linha" role="none">
    <button type="button" role="menuitem" className="acrescentar-ver" aria-label={nomeDoVer({ tipo, quantidade: coisa.quantidade })}
      onClick={() => { fechar(); coisa.ver(); }}>
      <Icone nome={ICONE_DA_COISA[tipo]} tam={ICONE_DO_MENU} />{NOME_NO_MENU[tipo]}
      {coisa.quantidade !== undefined && <Contador apagado={!coisa.quantidade}>{coisa.quantidade}</Contador>}
    </button>
    {novo && (novo.para
      ? <Link role="menuitem" className="acrescentar-novo" to={novo.para} aria-label={novo.nome} title={novo.nome} onClick={fechar}>{mais}</Link>
      : <button type="button" role="menuitem" className="acrescentar-novo" aria-label={novo.nome} title={novo.nome} aria-haspopup={novo.menu ? 'menu' : undefined}
        onClick={() => { fechar(); novo.abrir?.(bolinha); }}>{mais}</button>)}
  </div>;
}

/** A bolinha e o menu dela (veja o comentário do arquivo). */
export function AcrescentarAoCartao() {
  const [bolinha, setBolinha] = useState<HTMLElement | null>(null);
  // Só as que ainda oferecem: quem deixou de oferecer agora sai do registro só depois deste desenho.
  const oferecidas = useAtalhosOferecidos().map(o => ({ tipo: o.tipo, coisa: o.ler() }))
    .filter((o): o is { tipo: TipoDeAtalho; coisa: CoisaDoCartao } => !!o.coisa)
    .map(o => ({ ...o, quantidade: o.coisa.quantidade }));
  const linhas = coisasDoMenu(oferecidas);
  if (!linhas.length) return null;
  const fechar = () => setBolinha(null);
  return <>
    <button type="button" className="cartao-botao" aria-label={NOME_DO_MENU_DE_ATALHOS} {...propsDaDica(NOME_DO_MENU_DE_ATALHOS)}
      aria-haspopup="menu" aria-expanded={!!bolinha} onClick={e => { const alvo = e.currentTarget; setBolinha(b => b ? null : alvo); }}>
      <Icone nome="mais" tam={ICONE_DO_TOPO} />
    </button>
    {bolinha && <MenuFlutuante botao={bolinha} rotulo={NOME_DO_MENU_DE_ATALHOS} setas aoFechar={fechar}>
      {linhas.map(l => <LinhaDoMenu key={l.tipo} tipo={l.tipo} coisa={l.coisa} bolinha={bolinha} fechar={fechar} />)}
    </MenuFlutuante>}
  </>;
}
