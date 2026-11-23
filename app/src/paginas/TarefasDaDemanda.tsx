// No cartão da demanda, as tarefas dela como um checklist (pedido do dono do produto, 30/10): marcar a caixa leva a tarefa para
// a coluna "Concluída" do quadro de tarefas (e encerra o cronômetro dela); desmarcar a devolve para "Para fazer". Com a
// última marcada, o sistema oferece concluir a demanda. Só a caixa conclui; o nome da tarefa é o link que abre o cartão
// dela (#298), para ninguém concluir sem querer ao clicar no nome. A tarefa nova da demanda nasce
// pelo "+" no título da seção, no cartão da demanda (#279), como nas seções de tarefas do contrato e da pessoa. As arquivadas ficam de fora.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { SD, type Coluna, type TarefaLigada } from '../dados';
import { rotuloDoPrazoComHora } from '../regras/demanda';
import { progressoDaLista } from '../regras/listas';
import { situacaoDoItem } from '../regras/quadro';
import { SEM_SITUACAO_TAREFA } from '../regras/tarefa';
import { ENVIADA_PARA_APROVACAO } from '../regras/aprovacaoDaTarefa';
import { falha, feito } from '../ui/avisos';
import { Aviso, Carregando, Nota } from '../ui/base';
import { ordemNoFim } from '../ui/quadro/posicao';
import { hojeISO } from '../ui/util';
import { oferecerDepoisDeMudar } from './situacaoDoItem';

interface Props {
  somenteLer?: boolean;
  demandaId: string;
  /** Muda quando o cartão muda: relê a lista. */
  versao: number;
  /** Avisa o cartão de que algo mudou (a demanda pode ter ido para "Concluído"). */
  aoMudar: () => void;
}

export function TarefasDaDemanda({ demandaId, versao, aoMudar, somenteLer = false }: Props) {
  const [tarefas, setTarefas] = useState<TarefaLigada[] | string | null>(null);
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [recarga, setRecarga] = useState(0);
  const navegar = useNavigate();
  useEffect(() => {
    SD.tarefasDaDemanda(demandaId).then(setTarefas).catch(e => setTarefas((e as Error).message));
    SD.colunasListar('tarefas').then(setColunas).catch(() => {});
  }, [demandaId, versao, recarga]);

  const concluida = colunas.find(c => c.marco === 'concluido')?.id ?? null;
  const inicio = colunas.find(c => c.marco === 'inicio')?.id ?? null;
  if (tarefas === null) return <Carregando />;
  if (typeof tarefas === 'string') return <Aviso tipo="erro">{tarefas}</Aviso>;
  const ativas = tarefas.filter(t => !t.arquivado_em);
  const { feitos, total, percentual } = progressoDaLista(ativas.map(t => ({ feito_em: t.etapa_id === concluida ? t.etapa_id : null })));
  const situacao = (etapa: string | null) => situacaoDoItem(colunas, etapa, SEM_SITUACAO_TAREFA);

  async function marcar(t: TarefaLigada, marcada: boolean) {
    const para = marcada ? concluida : inicio, de = t.etapa_id;
    if (!para) return;
    // Na hora: a caixa muda já; se o banco recusar, a lista volta como estava.
    setTarefas(lista => Array.isArray(lista) ? lista.map(x => x.id === t.id ? { ...x, etapa_id: para } : x) : lista);
    try {
      // A tarefa que precisa de aprovação, marcada por quem não aprova, fica na coluna de aprovação (#313): vale onde ela ficou.
      const ficou = await SD.tarefaMover(t.id, para, ordemNoFim());
      const aviso = ficou !== para ? `${t.titulo}: ${ENVIADA_PARA_APROVACAO}` : marcada ? `${t.titulo} foi para "${situacao(para)}".` : `${t.titulo} voltou para "${situacao(para)}".`;
      feito(aviso, 'mudança de situação da tarefa', async () => { await SD.tarefaMover(t.id, de, ordemNoFim()); });
      // As ofertas de quem muda a Situação por qualquer caminho: o prazo do processo da tarefa (#355) e, com a última, a demanda.
      if (await oferecerDepoisDeMudar('tarefas', { id: t.id, titulo: t.titulo, etapa_id: de, etapa_ordem: null, ligadoADemanda: true }, ficou, navegar)) aoMudar();
    } catch (e) { falha(e); }
    setRecarga(x => x + 1);
  }

  return <div className="lista-demanda tarefas-da-demanda" role="region" aria-label="Tarefas da demanda">
    {ativas.length > 0 && <>
      <header><span className="nota">{feitos} de {total} {total === 1 ? 'concluída' : 'concluídas'}</span></header>
      <div className="lista-progresso" role="progressbar" aria-label="Tarefas concluídas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
        <i style={{ width: percentual + '%' }} />
      </div>
      <ul>{ativas.map(t => {
        const feita = t.etapa_id === concluida, prazo = rotuloDoPrazoComHora(t.prazo, t.prazo_hora, hojeISO());
        return <li key={t.id} className={feita ? 'feito' : undefined}>
          <input type="checkbox" checked={feita} disabled={!concluida || somenteLer} aria-label={`Concluir ${t.titulo}`}
            onChange={e => void marcar(t, e.target.checked)} />
          <Link className="tarefa-da-demanda-nome" to={'/tarefas/?id=' + t.id} title="Abrir a tarefa">{t.titulo}</Link>
          <span className="nota tarefa-da-demanda-situacao">{situacao(t.etapa_id)}{prazo && !feita ? ` · ${prazo}` : ''}</span>
        </li>;
      })}</ul>
    </>}
    {!ativas.length && <Nota>Nenhuma tarefa nesta demanda ainda.</Nota>}
  </div>;
}
