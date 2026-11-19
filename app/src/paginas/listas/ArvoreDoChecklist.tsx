// A árvore de um checklist (#309): grupos e subgrupos numerados (1. Documentos pessoais › 1.1 RG; 2.1.1 CNIS), cada grupo com a
// seta que abre e fecha e a contagem ("1 de 2 feitos", à vista mesmo fechado), e o "⋯" de cada grupo e item. É a mesma peça no
// cartão (demanda, tarefa e contrato: com as caixas de marcar e a data de entrega) e no editor de modelos (modo "modelo", sem
// elas): um jeito só de montar grupos. Não fala com o banco: quem a usa diz o que cada ação faz (AcoesDaArvore).
import { useId, useRef, useState, type ReactNode } from 'react';
import type { ItemDaLista } from '../../dados';
import { TAMANHO_ITEM, TAMANHO_LISTA } from '../../dados/limites';
import { ROTULOS_PRAZO, SELO_DO_PRAZO } from '../../regras/demanda';
import { descricaoDoNo, emOrdemDeLeitura, type NoDaLista } from '../../regras/gruposDaLista';
import { conferirNomeDoGrupo, conferirTextoDoItem, prazoDoItem } from '../../regras/listas';
import { fmtData } from '../../regras/pessoa';
import { estiloBotao, Selo, TituloEditavel } from '../../ui/base';
import { Icone } from '../../ui/Icone';
import { pedirTexto } from '../../ui/janela';
import { hojeISO } from '../../ui/util';
import { CampoDoItemNovo } from './CampoDoItemNovo';
import { ATRIBUTO_DO_NO, useAcoesDoNo, type AcoesDaArvore } from './useAcoesDoNo';

export type { AcoesDaArvore } from './useAcoesDoNo';
/** Onde a árvore está: no cartão (marca e tem data de entrega) ou no modelo (só monta). */
export type ModoDaArvore = 'cartao' | 'modelo';
/** A dica do nome e do texto que se mudam com um clique. */
export const DICA_RENOMEAR = 'Clique para renomear';
/** O atributo do botão "Adicionar item" de cada grupo, com o id dele: o foco volta a ele quando o campo fecha. */
const ATRIBUTO_DO_ADICIONAR = 'data-adicionar';
/** Como cada modo conta os itens de um grupo. */
const CONTAGEM: Record<ModoDaArvore, (no: Extract<NoDaLista, { tipo: 'grupo' }>) => string> = {
  cartao: no => no.total ? `${no.feitos} de ${no.total} ${no.total === 1 ? 'feito' : 'feitos'}` : 'Sem itens',
  modelo: no => no.total === 1 ? '1 item' : no.total ? `${no.total} itens` : 'Sem itens',
};

interface Props {
  arvore: NoDaLista[];
  modo: ModoDaArvore;
  /** Sem as ações, só se lê: os grupos abrem e fecham, mas não há ⋯, campos nem botões de acrescentar. */
  acoes?: AcoesDaArvore;
  /** O nome do campo de item novo do pé ("Novo item do checklist Documentos"). */
  rotuloDoNovo: string;
  /** Para onde vai o foco quando não sobra nó acima depois de excluir (o nome do checklist ou do modelo). */
  aoFocarNoTopo: () => void;
}

export function ArvoreDoChecklist({ arvore, modo, acoes, rotuloDoNovo, aoFocarNoTopo }: Props) {
  const base = useId();
  const raiz = useRef<HTMLDivElement>(null);
  /** Os grupos fechados (todos começam abertos; a escolha vale enquanto a árvore está na tela). */
  const [fechados, setFechados] = useState<ReadonlySet<string>>(new Set());
  /** O grupo com o campo de item novo aberto. */
  const [campo, setCampo] = useState<string | null>(null);
  const abrirCampo = (id: string) => { setFechados(f => { const n = new Set(f); n.delete(id); return n; }); setCampo(id); };
  const menu = useAcoesDoNo({ arvore, acoes, raiz, aoFocarNoTopo, abrirCampo });
  const alternar = (id: string) => setFechados(f => { const n = new Set(f); if (!n.delete(id)) n.add(id); return n; });
  const idDe = (parte: string, id: string) => `${base}-${parte}-${id}`;
  const hoje = hojeISO();

  async function novoGrupo() {
    const nome = await pedirTexto('Nome do grupo', '', { maximo: TAMANHO_LISTA });
    if (!nome || !acoes) return;
    const [criado] = await acoes.acrescentar(null, [{ texto: nome, filhos: [] }]);
    if (criado) abrirCampo(criado);
  }
  /** O ⋯ do nó (quem só lê não o vê). */
  const mais = (no: NoDaLista, tam: number) => acoes && <button type="button" className="icone-btn lista-mais" aria-haspopup="menu"
    aria-label={no.tipo === 'grupo' ? `Ações do grupo ${no.grupo.nome}` : `Ações do item ${no.item.texto}`} aria-expanded={menu.menuDe === no.id}
    {...{ [ATRIBUTO_DO_NO]: no.id }} onClick={e => menu.abrir(e.currentTarget, no.id)}><Icone nome="pontos" tam={tam} /></button>;
  const numero = (no: NoDaLista) => <><span className="lista-numero">{no.numero}</span>{' '}</>;

  function linhaDoItem(no: NoDaLista, item: ItemDaLista): ReactNode {
    const prazo = prazoDoItem(item, hoje), descricao = idDe('d', no.id);
    // A caixa marca; o texto, ao lado, se renomeia com um clique (por isso a caixa tem o próprio nome, e não um rótulo em volta do
    // texto). O número e o grupo dela vão na descrição, para o leitor de tela (no fim da árvore, fora da linha).
    return <li key={no.id} className={item.feito_em ? 'feito' : undefined}>
      {modo === 'cartao' && <label className="lista-marcar"><input type="checkbox" aria-label={item.texto} aria-describedby={descricao} checked={!!item.feito_em}
        disabled={!acoes?.marcar} onChange={e => acoes?.marcar?.(item, e.target.checked)} /></label>}
      {numero(no)}
      <TituloEditavel nivel="texto" className="lista-item-texto" valor={item.texto} rotulo="Texto do item" dica={DICA_RENOMEAR} maximo={TAMANHO_ITEM}
        conferir={conferirTextoDoItem} aoSalvar={acoes ? texto => acoes.renomearItem(item, texto) : undefined} />
      {item.prazo && (prazo ? <Selo tipo={SELO_DO_PRAZO[prazo]}>{ROTULOS_PRAZO[prazo]}: {fmtData(item.prazo)}</Selo> : <span className="nota">{fmtData(item.prazo)}</span>)}
      {mais(no, 15)}
    </li>;
  }

  function linhaDoGrupo(no: Extract<NoDaLista, { tipo: 'grupo' }>): ReactNode {
    const aberto = !fechados.has(no.id), nome = `${no.numero} ${no.grupo.nome}`, contagem = idDe('c', no.id), dentro = idDe('g', no.id);
    const completo = modo === 'cartao' && no.total > 0 && no.feitos === no.total;
    return <li key={no.id} className="lista-grupo">
      <div className="lista-grupo-cabeca">
        <button type="button" className="lista-grupo-abrir" aria-expanded={aberto} aria-controls={aberto ? dentro : undefined} aria-describedby={contagem}
          aria-label={`${aberto ? 'Fechar' : 'Abrir'} o grupo ${nome}`} title={aberto ? 'Fechar o grupo' : 'Abrir o grupo'} onClick={() => alternar(no.id)}>
          <Icone nome={aberto ? 'abaixo' : 'direita'} tam={14} /><span className="lista-numero">{no.numero}</span>
        </button>{' '}
        <TituloEditavel nivel="texto" className="lista-grupo-nome" valor={no.grupo.nome} rotulo="Nome do grupo" dica={DICA_RENOMEAR} maximo={TAMANHO_LISTA}
          conferir={conferirNomeDoGrupo} aoSalvar={acoes ? nome => acoes.renomearGrupo(no.grupo, nome) : undefined} />{' '}
        <span id={contagem} className="lista-grupo-contagem">{completo ? <Selo tipo="ok">{CONTAGEM[modo](no)}</Selo> : <span className="nota">{CONTAGEM[modo](no)}</span>}</span>
        {mais(no, 15)}
      </div>
      {aberto && <>
        {no.filhos.length > 0 && <ul id={dentro} aria-label={`Grupo ${nome}`}>{no.filhos.map(linha)}</ul>}
        {acoes && <div className="lista-grupo-pe">
          {campo === no.id
            ? <CampoDoItemNovo key={no.id} focar rotulo={`Novo item do grupo ${nome}`} aoAcrescentar={nova => acoes.acrescentar(no.id, nova)}
              aoFechar={() => { setCampo(null); setTimeout(() => raiz.current?.querySelector<HTMLElement>(`[${ATRIBUTO_DO_ADICIONAR}="${no.id}"]`)?.focus(), 0); }} />
            : <button type="button" className={estiloBotao({ forma: 'mini' })} {...{ [ATRIBUTO_DO_ADICIONAR]: no.id }} aria-label={`Adicionar item no grupo ${nome}`}
              onClick={() => setCampo(no.id)}><Icone nome="mais" tam={13} /> Adicionar item</button>}
        </div>}
      </>}
    </li>;
  }
  const linha = (no: NoDaLista): ReactNode => no.tipo === 'grupo' ? linhaDoGrupo(no) : linhaDoItem(no, no.item);

  return <div className={modo === 'modelo' ? 'checklist-arvore modo-modelo' : 'checklist-arvore'} ref={raiz}>
    {arvore.length > 0 && <ul>{arvore.map(linha)}</ul>}
    {modo === 'cartao' && <div hidden>{emOrdemDeLeitura(arvore).map(no => no.tipo === 'item' && <span key={no.id} id={idDe('d', no.id)}>{descricaoDoNo(no)}</span>)}</div>}
    {acoes && <CampoDoItemNovo rotulo={rotuloDoNovo} aoAcrescentar={nova => acoes.acrescentar(null, nova)}
      depois={<button type="button" className={estiloBotao({ forma: 'mini' })} aria-label="Novo grupo" title="Novo grupo no fim do checklist"
        onClick={() => void novoGrupo()}><Icone nome="mais" tam={13} /> Grupo</button>} />}
    {menu.menu}
  </div>;
}

