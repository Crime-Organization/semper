// O botão "?" da ajuda da tela, ao lado do título (#85 nas páginas de módulo; #411 nas outras telas). Ele e a tecla "?" abrem a
// mesma janela (mostrarAjuda, em ui/atalhos.tsx): a explicação da tela em cima e os atalhos de teclado embaixo.
// As telas que não são de módulo dizem só qual tela são (regras/ajuda.ts, AJUDA_DAS_TELAS): o título com o "?" é o TituloComAjuda;
// os painéis (Início, Processos, Financeiro) chamam useAjudaDaTela e passam o "abrir" ao CabecaDoPainel.
import type { ReactNode } from 'react';
import { AJUDA_DAS_TELAS, type TelaComAjuda } from '../regras/ajuda';
import { ATALHOS, dicaComAtalho } from '../regras/atalhos';
import { useAtalhosDaPagina, useAtalhosLigados } from './atalhos';
import { Icone } from './Icone';

/** O tamanho do "?" dentro do botão redondo. */
const TAMANHO_DO_ICONE_DA_AJUDA = 15;
/** O nome do botão, para o leitor de tela e a dica. */
const NOME_DO_BOTAO = 'Ajuda desta tela';

/** O botão "?" ao lado do título. Com os atalhos de uma tecla ligados, a dica e o leitor de tela dizem que a tecla "?" faz o mesmo. */
export function BotaoDeAjuda({ aoAbrir }: { aoAbrir: () => void }) {
  const ligados = useAtalhosLigados();
  const dica = ligados ? { title: dicaComAtalho(NOME_DO_BOTAO, 'atalhos'), 'aria-keyshortcuts': ATALHOS.atalhos.nome } : { title: NOME_DO_BOTAO };
  return <button type="button" className="botao-ajuda" aria-label={NOME_DO_BOTAO} aria-haspopup="dialog" {...dica} onClick={aoAbrir}>
    <Icone nome="ajuda" tam={TAMANHO_DO_ICONE_DA_AJUDA} />
  </button>;
}

/**
 * Liga a tecla "?" (e os outros atalhos que a tela tiver, como o "N" do Financeiro) à ajuda de uma tela que não é de módulo, e
 * devolve como abrir a ajuda (para o botão "?"). Uma chamada por tela: duas abririam duas janelas na mesma tecla.
 */
export function useAjudaDaTela(tela: TelaComAjuda, novo?: { rotulo: string; abrir: () => void }) {
  return useAtalhosDaPagina({ tela: AJUDA_DAS_TELAS[tela], novo });
}

/**
 * O título da tela com o "?" ao lado (#411). Sem "children", o título é o da ajuda da tela; com ele (o nome da pessoa no perfil,
 * o "Tempo de…" de quem vê o tempo de outro), o título da página muda e a janela continua com o título da tela.
 */
export function TituloComAjuda({ tela, className, children }: { tela: TelaComAjuda; className?: string; children?: ReactNode }) {
  const abrir = useAjudaDaTela(tela);
  return <div className="cabeca-titulo">
    <h1 className={className ? `titulo ${className}` : 'titulo'}>{children ?? AJUDA_DAS_TELAS[tela].titulo}<span className="ponto">.</span></h1>
    <BotaoDeAjuda aoAbrir={abrir} />
  </div>;
}
