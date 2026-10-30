// Cartão da demanda (painel ao lado ou janela no centro), no modelo dos cartões de pessoa e de contrato: no topo, o
// título e o prazo em destaque; as ações, a equipe da demanda (responsável e colaboradores) e a situação; depois, cada
// tópico numa seção que recolhe (listas, tarefas, clientes, contrato, comentários, histórico).
// O contrato ligado aparece sempre, mas só abre para quem pode ver o contrato (contrato é controle financeiro).
import { useCallback, useEffect, useState } from 'react';
import { SD, type Demanda, type PessoaResumida } from '../dados';
import { CAMPOS_DEMANDA, motivoSemMencaoNaDemanda, SEM_SITUACAO_DEMANDA, valorLegivelDemanda } from '../regras/demanda';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Botao, BotaoDuplo } from '../ui/Botoes';
import { Aviso, BotaoLink, Carregando, Nota, Selo, Vazio } from '../ui/base';
import { SecaoComentarios } from '../ui/Comentarios';
import { Icone } from '../ui/Icone';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { Recolhivel } from '../ui/Recolhivel';
import { ordemNoFim } from '../ui/quadro/posicao';
import type { Quadro } from '../ui/quadro/useColunas';
import { useCtx } from '../ui/sessao';
import { dataCurta, relativo } from '../ui/util';
import { SeloDoPrazo } from './Demandas';
import { CartoesLigados } from './CartoesLigados';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import { ListasDaDemanda } from './ListasDaDemanda';

interface Props {
  id: string;
  quadro: Quadro;
  /** Avisa a lista de que algo mudou (para recarregar a tabela ou o quadro). */
  aoMudar: () => void;
  aoFechar: () => void;
}

export function CartaoDemanda({ id, quadro, aoMudar, aoFechar }: Props) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [d, setD] = useState<Demanda | null | undefined>(undefined);   // undefined: carregando; null: não existe ou não pode ver
  const [erro, setErro] = useState('');
  const [versaoHist, setVersaoHist] = useState(0);
  const nomeDe = (pid: string | null) => ctx.equipe.find(m => m.id === pid)?.nome || 'Usuário removido';

  const carregar = useCallback(() => SD.demandaObter(id).then(x => { setD(x); setErro(''); }).catch(e => setErro((e as Error).message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Depois de desfazer: mostra a demanda como ficou.
  useMudancas(() => { void carregar(); setVersaoHist(v => v + 1); });

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (d === undefined) return <Carregando />;
  if (!d) return <Vazio>Esta demanda não foi encontrada. Ela pode ter sido excluída, ou você não participa dela.</Vazio>;

  const podeExcluir = !!d.arquivado_em && (d.criado_por === eu || ctx.ehAdmin);
  // Responsável e colaboradores são da equipe: cada um no quadrinho que abre o cartão da pessoa ligada ao usuário.
  const daEquipe = (perfilId: string, detalhe: string): ItemLigado => {
    const m = ctx.equipe.find(x => x.id === perfilId);
    return { id: detalhe + perfilId, para: m?.pessoa_id ? '/pessoas/?id=' + m.pessoa_id : undefined, titulo: nomeDe(perfilId), detalhe };
  };
  const equipe = [daEquipe(d.responsavel_id, 'Responsável'), ...d.colaboradores.map(c => daEquipe(c, 'Colaborador'))];
  const cliente = (p: PessoaResumida): ItemLigado => ({ id: 'cliente-' + p.id, para: '/pessoas/?id=' + p.id, codigo: p.codigo, titulo: p.nome,
    detalhe: 'Cliente', selo: p.arquivado_em ? 'Arquivada' : undefined });
  // O contrato abre só para quem pode vê-lo; os outros veem o número, sem o link.
  const contrato: ItemLigado | null = d.contrato
    ? { id: 'contrato', para: '/contratos/?id=' + d.contrato.id, codigo: d.contrato.codigo, titulo: d.contrato.servico, detalhe: 'Contrato' }
    : d.contrato_codigo ? { id: 'contrato', codigo: d.contrato_codigo, titulo: 'Contrato ligado', detalhe: 'Você não tem acesso a este contrato' } : null;

  async function arquivar() {
    const estava = !!d!.arquivado_em;
    try {
      await SD.demandasArquivar([d!.id], !estava);
      feito(estava ? 'Demanda desarquivada.' : 'Demanda arquivada. Arquivadas podem ser excluídas depois.', estava ? 'desarquivamento' : 'arquivamento',
        async () => { await SD.demandasArquivar([d!.id], estava); });
      aoMudar(); await carregar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }
  async function excluir() {
    const r = await SD.demandasExcluir([d!.id]);
    if (r.excluidas) { avisar('Demanda excluída definitivamente.'); aoFechar(); aoMudar(); }
    else falha(new Error(r.motivo || 'Não foi possível excluir.'));
  }
  async function mudarSituacao(valor: string) {
    const etapa = valor || null, de = d!.etapa_id || null, ordemDe = d!.etapa_ordem ?? null, ordem = ordemNoFim();
    try {
      await SD.demandaMover(d!.id, etapa, ordem);
      setD({ ...d!, etapa_id: etapa, etapa_ordem: ordem });
      feito(etapa ? `Movida para "${quadro.nomeDe(etapa)}".` : `Demanda ${SEM_SITUACAO_DEMANDA.toLowerCase()}.`, 'mudança de situação',
        async () => { await SD.demandaMover(d!.id, de, ordemDe); });
      aoMudar(); setVersaoHist(v => v + 1);
    } catch (e) { falha(e); }
  }

  return <>
    <header className="cartao-cabeca">
      <div className="linha">
        <Selo tipo="escuro">Demanda</Selo><span className="codigo">{d.codigo}</span>
        <SeloDoPrazo prazo={d.prazo} />
        {d.arquivado_em && <Selo tipo="arq">Arquivada</Selo>}
      </div>
      <h2>{d.titulo}</h2>
      {d.descricao && <p className="demanda-descricao">{d.descricao}</p>}
    </header>

    <div className="cartao-acoes">
      <BotaoLink variante="principal" pequeno to={'/demandas/nova/?id=' + d.id}><Icone nome="editar" tam={15} /> Atualizar demanda</BotaoLink>
      <Botao pequeno className="acao-arquivar" title={d.arquivado_em ? 'Desarquivar' : 'Arquivar'} aria-label={d.arquivado_em ? 'Desarquivar' : 'Arquivar'} onClick={arquivar}>
        <Icone nome="arquivo" tam={15} /><span className="acao-rotulo">{d.arquivado_em ? 'Desarquivar' : 'Arquivar'}</span>
      </Botao>
    </div>
    {/* A exclusão fica numa linha própria: ao pedir confirmação o botão cresce, e nada sai do lugar. */}
    {d.arquivado_em && <div className="cartao-arquivada">
      <span>{podeExcluir ? 'Demanda arquivada. Se não for mais necessária, pode ser excluída definitivamente.'
        : 'Demanda arquivada. Só quem cadastrou esta demanda ou um administrador pode excluí-la.'}</span>
      {podeExcluir && <BotaoDuplo variante="perigo" pequeno confirmar="Confirmar exclusão definitiva" aoConfirmar={excluir}><Icone nome="lixeira" tam={15} /> Excluir</BotaoDuplo>}
    </div>}

    <section className="bloco">
      <h3><Icone nome="conta" tam={14} />{equipe.length > 1 ? 'Responsável e colaboradores' : 'Responsável'}</h3>
      <ItensLigados itens={equipe} />
    </section>

    <section className="bloco campos">
      <h3><Icone nome="kanban" tam={14} />Situação</h3>
      <select aria-label="Situação da demanda" disabled={!!d.arquivado_em} value={d.etapa_id || ''} onChange={e => mudarSituacao(e.target.value)}>
        <option value="">{SEM_SITUACAO_DEMANDA}</option>
        {quadro.colunas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.oculta ? ' (oculta para você)' : ''}</option>)}
      </select>
    </section>

    <ListasDaDemanda demandaId={d.id} />

    {ctx.escritorio?.modulos?.tarefas && <Recolhivel titulo="Tarefas" icone="tarefas" preferencia="demandas.cartao.tarefas">
      <CartoesLigados modulo="tarefas" carregar={() => SD.tarefasDaDemanda(d.id)} vazio="Nenhuma tarefa nesta demanda ainda."
        nova={{ para: '/tarefas/nova/?demanda=' + d.id, rotulo: 'Nova tarefa desta demanda' }} versao={versaoHist} />
    </Recolhivel>}

    <Recolhivel titulo="Clientes" icone="pessoas" preferencia="demandas.cartao.clientes" contador={d.clientes.length}>
      {d.clientes.length ? <ItensLigados itens={d.clientes.map(cliente)} /> : <Nota>Nenhum cliente ligado a esta demanda.</Nota>}
    </Recolhivel>

    <Recolhivel titulo="Contrato" icone="contratos" preferencia="demandas.cartao.contrato">
      {contrato ? <ItensLigados itens={[contrato]} /> : <Nota>Esta demanda não vem de um contrato.</Nota>}
      {d.objeto && d.objeto !== d.titulo && <Nota>Nasceu do objeto do contrato: <b>{d.objeto}</b>.</Nota>}
    </Recolhivel>

    <SecaoComentarios modulo="demandas" cartaoId={d.id} motivoSemMencao={motivoSemMencaoNaDemanda(d)} />

    <Recolhivel titulo="Histórico de alterações" icone="relogio" preferencia="demandas.cartao.historico">
      <HistoricoDoCartao carregar={() => SD.demandaHistorico(d.id)} campos={CAMPOS_DEMANDA} valor={valorLegivelDemanda} versao={versaoHist} />
    </Recolhivel>

    <footer className="cartao-rodape">
      <span>Criada em {dataCurta(d.criado_em)}{d.criado_por ? ' por ' + nomeDe(d.criado_por) : ''}</span>
      <span>Atualizada {relativo(d.atualizado_em)}</span>
    </footer>
  </>;
}
