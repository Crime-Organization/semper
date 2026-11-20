// O texto de um comentário com as menções em destaque (regras/comentarios.ts): @alguém da equipe, com o nome ao passar o mouse, e
// !CODIGO de um item (#297). O item que quem lê vê vira um atalho para o cartão dele, com o título ao lado; o arquivado avisa que está
// arquivado; o que quem lê não vê (ou que não existe mais) fica só com o código e o aviso, sem título e sem abrir. Peça comum dos
// comentários do cartão e da caixa de Mensagens (lá, sem consulta e sem atalho: o trecho inteiro já é o link do comentário).
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { ItemDaAnotacao } from '../dados';
import { enderecoDoItem } from '../regras/anotacao';
import { MOSTRAR_ITEM_MENCIONADO, situacaoDaMencaoDeItem, tipoDoTrecho, trechosDoComentario, type TipoDoTrecho, type Trecho } from '../regras/comentarios';
import { cliquesQueAbrem } from './abrirItem';
import { useCtx } from './sessao';

interface Props {
  texto: string;
  /** Os itens já consultados, pelo código (null: não veio na consulta). Sem ele, os códigos só aparecem em destaque. */
  itens?: ReadonlyMap<string, ItemDaAnotacao | null>;
}

export function TextoComMencoes({ texto, itens }: Props) {
  const { equipe } = useCtx();
  return <>{trechosDoComentario(texto, equipe).map((t, i) => <TrechoDoTexto key={i} t={t} itens={itens} />)}</>;
}

type PropsDoTrecho = { t: Trecho; itens?: ReadonlyMap<string, ItemDaAnotacao | null> };
/** Como cada tipo de trecho aparece. */
const MOSTRAR_TRECHO: Record<TipoDoTrecho, (p: PropsDoTrecho) => ReactNode> = {
  texto: ({ t }) => <span>{t.texto}</span>,
  pessoa: ({ t }) => <span className="mencao" title={t.membro?.nome}>{t.texto}</span>,
  item: p => <MencaoDeItem {...p} />
};
function TrechoDoTexto(p: PropsDoTrecho) {
  return MOSTRAR_TRECHO[tipoDoTrecho(p.t)](p);
}

function MencaoDeItem({ t, itens }: PropsDoTrecho) {
  const codigo = t.codigo ?? '';
  const item = itens?.get(codigo) ?? undefined;
  const mostrar = MOSTRAR_ITEM_MENCIONADO[situacaoDaMencaoDeItem(itens, codigo)];
  // O espaço antes do aviso fica fora do <small>: assim ele conta também no nome do link, que é o texto da tela.
  const aviso = mostrar.aviso && <>{' '}<small className="mencao-aviso">· {mostrar.aviso}</small></>;
  if (mostrar.abre && item) return <AtalhoDoItem item={item} texto={t.texto} explicacao={mostrar.explicacao(item)}>{aviso}</AtalhoDoItem>;
  return <span className="mencao" title={mostrar.explicacao(item)}>{t.texto}{aviso}</span>;
}

/**
 * A menção do item que quem lê vê: o código e o título, como link do cartão (Ctrl+clique abre numa aba nova). O nome do link é o que
 * aparece na tela (quem usa comando de voz diz o que vê, WCAG 2.5.3); o que ele faz ("Abrir Tarefa ...") vem como dica e descrição.
 */
function AtalhoDoItem({ item, texto, explicacao, children }: { item: ItemDaAnotacao; texto: string; explicacao: string; children: ReactNode }) {
  const navegar = useNavigate();
  const para = enderecoDoItem(item);
  return <a className="mencao mencao-item" href={para} title={explicacao} {...cliquesQueAbrem(para, () => navegar(para))}>
    {texto} <span className="mencao-nome">{item.nome}</span>{children}
  </a>;
}
