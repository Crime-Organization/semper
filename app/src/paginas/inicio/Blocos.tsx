// Os blocos do painel da página inicial (#319). Todos têm a mesma moldura (Bloco): o título, o número, o "Ver todos" que leva à
// página do módulo, e o que mostrar enquanto carrega, se falhar (o aviso fica só no bloco) e se não houver nada (o bloco não
// some). Cada bloco carrega por conta própria, pela fonte dele (fontes.ts); o que entra em cada um fica em regras/painelInicial.ts.
import { useEffect, useId, useState, type ComponentType, type ReactNode } from 'react';
import { fmtCentavos } from '../../regras/caixa';
import { enderecoDoCartao } from '../../regras/buscaGeral';
import { horarioDoCompromisso, nomeDoCompromisso, TIPOS_COMPROMISSO } from '../../regras/compromisso';
import { clientesPorExtenso } from '../../regras/contrato';
import { rotuloDoPrazoComHora } from '../../regras/demanda';
import { rotuloDoPrazo } from '../../regras/andamentos';
import {
  BLOCOS_DO_PAINEL, comigo, emGrupos, fmtContagem, ITENS_POR_BLOCO, linhaDoEvento, nomeDaColuna, nomeDaParcela, quandoDoPrazo, vazioDasAnotacoes, verTodosDoBloco,
  type BlocoDoPainel, type ModulosLigados
} from '../../regras/painelInicial';
import { fmtData } from '../../regras/pessoa';
import { TIPOS_PROCESSO } from '../../regras/processo';
import { SEM_SITUACAO_TAREFA } from '../../regras/tarefa';
import { Aviso, BotaoLink, Carregando, Cartao, Contador, ListaDeNumeros, Nota, Selo, TituloSecao, Vazio } from '../../ui/base';
import { ItensLigados, type ItemLigado } from '../../ui/ItensLigados';
import { numero, relativo } from '../../ui/util';
import type { FontesDoPainel, ResultadoDoBloco } from './fontes';

/** O que cada bloco recebe da página: as fontes do painel, o dia de hoje (Brasília) e os módulos ligados no escritório. */
export interface PropsDoBloco { fontes: FontesDoPainel; hoje: string; modulos: ModulosLigados }

type Leitura<T> = { estado: 'carregando' } | { estado: 'erro'; erro: string } | { estado: 'pronto'; dados: T };
/** A leitura de um bloco. Lendo de novo (depois de uma mudança), o que já está na tela fica até a resposta nova chegar. */
function useLeitura<T>(carregar: () => Promise<T>): Leitura<T> {
  const [leitura, setLeitura] = useState<Leitura<T>>({ estado: 'carregando' });
  useEffect(() => {
    let vivo = true;
    carregar().then(
      dados => { if (vivo) setLeitura({ estado: 'pronto', dados }); },
      e => { if (vivo) setLeitura({ estado: 'erro', erro: (e as Error)?.message || 'Não foi possível carregar este bloco.' }); }
    );
    return () => { vivo = false; };
  }, [carregar]);
  return leitura;
}

interface PropsDaMoldura<T> {
  bloco: BlocoDoPainel;
  modulos: ModulosLigados;
  carregar: () => Promise<T>;
  /** O número ao lado do título. */
  contar: (dados: T) => string;
  /** Se não há nada para mostrar: o bloco diz isso, em vez de sumir. */
  vazio: (dados: T) => boolean;
  /** O que dizer quando não há nada, se depende do que foi lido (senão, o texto do bloco). */
  textoDoVazio?: (dados: T) => string;
  children: (dados: T) => ReactNode;
}
/** A moldura comum: título, número, "Ver todos" e o corpo de cada estado da leitura. */
function Bloco<T>({ bloco, modulos, carregar, contar, vazio, textoDoVazio, children }: PropsDaMoldura<T>) {
  const id = useId();
  const def = BLOCOS_DO_PAINEL[bloco], verTodos = verTodosDoBloco(bloco, modulos);
  const leitura = useLeitura(carregar);
  const pronto = leitura.estado === 'pronto' ? leitura.dados : null;
  const CORPO: { [E in Leitura<T>['estado']]: (l: Extract<Leitura<T>, { estado: E }>) => ReactNode } = {
    carregando: () => <Carregando />,
    erro: l => <Aviso tipo="erro">{l.erro}</Aviso>,
    pronto: l => vazio(l.dados) ? <Vazio>{textoDoVazio?.(l.dados) ?? def.vazio}</Vazio> : children(l.dados)
  };
  return <Cartao className={'bloco-inicio bloco-' + bloco} role="region" aria-labelledby={id} aria-busy={leitura.estado === 'carregando'}>
    <div className="bloco-inicio-topo">
      <TituloSecao id={id}>{def.titulo}</TituloSecao>
      {pronto !== null && <Contador title="Quantos há">{contar(pronto)}</Contador>}
      {verTodos && <BotaoLink forma="link" className="bloco-inicio-todos" to={verTodos.para}>{verTodos.rotulo}</BotaoLink>}
    </div>
    {(CORPO[leitura.estado] as (l: Leitura<T>) => ReactNode)(leitura)}
  </Cartao>;
}

/** "E mais 3.", quando a lista do bloco foi cortada. */
const OsOutros = ({ total }: { total: number }) => total > ITENS_POR_BLOCO ? <Nota>E mais {numero(total - ITENS_POR_BLOCO)}.</Nota> : null;

/** Itens separados em atraso, hoje e próximos dias, cada grupo com o seu selo e até ITENS_POR_BLOCO itens. */
function EmGrupos<T>({ itens, dataDe, hoje, item }: { itens: T[]; dataDe: (i: T) => string; hoje: string; item: (i: T) => ItemLigado }) {
  return <div className="bloco-inicio-grupos">{emGrupos(itens, dataDe, hoje).map(g => <section key={g.situacao} aria-label={g.titulo}>
    <h3 className="bloco-inicio-grupo"><Selo tipo={g.selo}>{g.titulo}</Selo></h3>
    <ItensLigados itens={g.itens.slice(0, ITENS_POR_BLOCO).map(item)} rotulo={g.titulo} />
    <OsOutros total={g.itens.length} />
  </section>)}</div>;
}

const contarLista = (lista: unknown[]) => fmtContagem(lista.length);
const listaVazia = (lista: unknown[]) => !lista.length;

function Prazos({ fontes, hoje, modulos }: PropsDoBloco) {
  type Lidos = ResultadoDoBloco['prazos'];
  return <Bloco bloco="prazos" modulos={modulos} carregar={fontes.prazos} contar={(p: Lidos) => fmtContagem(p.itens.length, p.completa)} vazio={(p: Lidos) => !p.itens.length}>
    {p => <EmGrupos itens={p.itens} dataDe={p => p.data} hoje={hoje}
      item={p => ({ id: p.chave, para: p.para, codigo: quandoDoPrazo(p, hoje), titulo: p.titulo, detalhe: p.detalhe })} />}
  </Bloco>;
}

function Agenda({ fontes, modulos }: PropsDoBloco) {
  return <Bloco bloco="agenda" modulos={modulos} carregar={fontes.agenda} contar={contarLista} vazio={listaVazia}>
    {compromissos => <><ItensLigados rotulo="Compromissos de hoje" itens={compromissos.slice(0, ITENS_POR_BLOCO).map(c => ({
      id: c.id, para: enderecoDoCartao('compromissos', c.id), codigo: horarioDoCompromisso(c), titulo: nomeDoCompromisso(c),
      detalhe: [TIPOS_COMPROMISSO[c.tipo].nome, c.local, c.geral && 'Agenda geral'].filter(Boolean).join(' · ')
    }))} /><OsOutros total={compromissos.length} /></>}
  </Bloco>;
}

function Tarefas({ fontes, hoje, modulos }: PropsDoBloco) {
  type Lidas = ResultadoDoBloco['tarefas'];
  return <Bloco bloco="tarefas" modulos={modulos} carregar={fontes.tarefas} contar={(t: Lidas) => fmtContagem(t.total)} vazio={(t: Lidas) => !t.total && !t.itens.length}>
    {t => <>
      <ItensLigados rotulo="Tarefas em andamento" itens={t.itens.map(x => ({
        id: x.id, para: enderecoDoCartao('tarefas', x.id), titulo: x.titulo,
        codigo: [nomeDaColuna(t.colunas, x.etapa_id, SEM_SITUACAO_TAREFA), rotuloDoPrazoComHora(x.prazo, x.prazo_hora, hoje)].filter(Boolean).join(' · '),
        detalhe: clientesPorExtenso(x.pessoa_nome) || undefined
      }))} />
      <OsOutros total={t.total} />
    </>}
  </Bloco>;
}

function Demandas({ fontes, modulos }: PropsDoBloco) {
  type Lidas = ResultadoDoBloco['demandas'];
  return <Bloco bloco="demandas" modulos={modulos} carregar={fontes.demandas} contar={(d: Lidas) => fmtContagem(d.total)} vazio={(d: Lidas) => !d.total}>
    {d => <ListaDeNumeros rotulo="Demandas por situação" linhas={d.situacoes.map(s => ({ ...s, para: comigo('/demandas/') }))} />}
  </Bloco>;
}

function Processos({ fontes, modulos }: PropsDoBloco) {
  type Lidos = ResultadoDoBloco['processos'];
  return <Bloco bloco="processos" modulos={modulos} carregar={fontes.processos} contar={(p: Lidos) => fmtContagem(p.total)} vazio={(p: Lidos) => !p.total && !p.itens.length}>
    {p => <ItensLigados rotulo="Seus processos" itens={p.itens.map(x => ({
      id: x.id, para: x.para, titulo: x.titulo, codigo: [TIPOS_PROCESSO[x.tipo].nome, x.proximo && linhaDoEvento(x.proximo)].filter(Boolean).join(' · ')
    }))} />}
  </Bloco>;
}

function Anotacoes({ fontes, modulos }: PropsDoBloco) {
  type Lidas = ResultadoDoBloco['anotacoes'];
  return <Bloco bloco="anotacoes" modulos={modulos} carregar={fontes.anotacoes} contar={(a: Lidas) => fmtContagem(a.total, a.completa)} vazio={(a: Lidas) => !a.itens.length}
    textoDoVazio={(a: Lidas) => vazioDasAnotacoes(a.completa)}>
    {a => <ItensLigados rotulo="Anotações recentes" itens={a.itens.map(x => ({
      id: x.id, para: enderecoDoCartao('anotacoes', x.id), titulo: x.titulo, codigo: `${x.codigo} · alterada ${relativo(x.atualizado_em)}`
    }))} />}
  </Bloco>;
}

function Parcelas({ fontes, hoje, modulos }: PropsDoBloco) {
  return <Bloco bloco="parcelas" modulos={modulos} carregar={fontes.parcelas} contar={contarLista} vazio={listaVazia}>
    {parcelas => <EmGrupos itens={parcelas} dataDe={p => p.vencimento} hoje={hoje} item={p => ({
      id: p.id, para: enderecoDoCartao('contratos', p.contrato_id), titulo: clientesPorExtenso(p.cliente_nome) || p.contrato_codigo,
      codigo: `${nomeDaParcela(p)} · ${rotuloDoPrazo({ final: p.vencimento, concluido_em: null }, hoje)} · ${fmtData(p.vencimento)}`,
      detalhe: `${p.contrato_codigo} · ${fmtCentavos(p.valor)}`
    })} />}
  </Bloco>;
}

function Pessoas({ fontes, modulos }: PropsDoBloco) {
  type Resumo = ResultadoDoBloco['pessoas'];
  return <Bloco bloco="pessoas" modulos={modulos} carregar={fontes.pessoas} contar={(r: Resumo) => fmtContagem(r.total)} vazio={(r: Resumo) => !r.total && !r.arquivadas}>
    {r => <ListaDeNumeros rotulo="Números de Pessoas" linhas={[
      { chave: 'minhas', n: r.minhas, nome: 'Com você', para: '/pessoas/?responsavel=eu' },
      { chave: 'mes', n: r.mes, nome: 'Cadastradas neste mês' },
      { chave: 'arquivadas', n: r.arquivadas, nome: 'Arquivadas', para: '/pessoas/?situacao=arquivadas' }
    ]} />}
  </Bloco>;
}

/** O componente de cada bloco. */
export const BLOCOS: Record<BlocoDoPainel, ComponentType<PropsDoBloco>> = {
  prazos: Prazos, agenda: Agenda, tarefas: Tarefas, demandas: Demandas, processos: Processos, anotacoes: Anotacoes, parcelas: Parcelas, pessoas: Pessoas
};
