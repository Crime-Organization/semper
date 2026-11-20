// Os botões rápidos do cartão (#351): a linha logo abaixo das datas, com o que se acrescenta ali (as datas, um checklist, uma
// anotação, uma ligação), como a linha de botões do cartão do Trello. Cada botão abre a coisa ali mesmo, sem sair do cartão.
// Quem oferece cada botão (veja registroDeAtalhos.tsx) é quem já sabe abrir a coisa: a seção com o "+" no título (Recolhivel com
// `atalho`, #390), que o botão usa do mesmo jeito (abre a seção, se estiver fechada, e o formulário ou o menu do item novo, preso ao
// botão), e o dado que se muda no lugar (DadoEditavel com `atalho`: o prazo, a data do compromisso), que abre o formulário dele.
// Assim, a linha mostra só o que o cartão tem, e nada no cartão arquivado ou só para ler (sem o "+" nem o dado que se muda, ninguém
// oferece o botão). Nos cartões com a Situação, que foi para o topo (#351), a linha também guarda, à direita, o "Expandir tudo" das
// seções, no eixo das setas e do X (#381, #389).
import { atalhosNaOrdem, NOME_DA_LINHA_DE_ATALHOS, ROTULO_DO_ATALHO, type TipoDeAtalho } from '../regras/atalhosDoCartao';
import { BotaoLink, estiloBotao } from './base';
import { Icone, type NomeIcone } from './Icone';
import { LugarDoExpandirTudo } from './Recolhivel';
import { useAtalhosOferecidos } from './registroDeAtalhos';

/** O ícone de cada botão, o mesmo da coisa que ele abre no cartão. */
const ICONE_DO_ATALHO: Record<TipoDeAtalho, NomeIcone> = {
  datas: 'calendario',
  checklist: 'check',
  anotacao: 'documentos',
  ligacao: 'vinculo'
};
/** O tamanho do ícone dentro do botão (o do "+" das seções). */
const TAMANHO_DO_ICONE = 15;

interface Props {
  /** Guarda à direita o "Expandir tudo" das seções do cartão (padrão: sim). Na anotação, ele continua no alto da coluna. */
  comExpandirTudo?: boolean;
}

/**
 * A linha dos botões rápidos: um botão por tipo oferecido, na ordem de sempre, com o ícone e o nome curto ("Checklist"); o que ele
 * faz por inteiro vai na dica. Sem botões nem "Expandir tudo", a linha não aparece.
 */
export function AtalhosDoCartao({ comExpandirTudo = true }: Props) {
  // Só os que ainda oferecem: quem deixou de oferecer agora (o item foi arquivado) sai do registro só depois deste desenho.
  const oferecidos = useAtalhosOferecidos().map(o => ({ tipo: o.tipo, atalho: o.ler() })).filter(o => o.atalho);
  const botoes = atalhosNaOrdem(oferecidos.map(o => o.tipo)).map(tipo => {
    const atalho = oferecidos.find(o => o.tipo === tipo)!.atalho!;
    const conteudo = <><Icone nome={ICONE_DO_ATALHO[tipo]} tam={TAMANHO_DO_ICONE} />{ROTULO_DO_ATALHO[tipo]}</>;
    return atalho.para
      ? <BotaoLink key={tipo} forma="mini" to={atalho.para} title={atalho.nome}>{conteudo}</BotaoLink>
      : <button key={tipo} type="button" className={estiloBotao({ forma: 'mini' })} title={atalho.nome} aria-haspopup={atalho.menu ? 'menu' : undefined}
        onClick={e => atalho.abrir?.(e.currentTarget)}>{conteudo}</button>;
  });
  if (!botoes.length && !comExpandirTudo) return null;
  return <div className="cartao-atalhos">
    {botoes.length > 0 && <div className="cartao-atalhos-botoes" role="group" aria-label={NOME_DA_LINHA_DE_ATALHOS}>{botoes}</div>}
    {comExpandirTudo && <LugarDoExpandirTudo />}
  </div>;
}
