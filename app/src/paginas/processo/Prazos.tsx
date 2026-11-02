// Os prazos no cartão do processo: lançar, mudar, marcar como cumprido, excluir e criar a tarefa de cumprir.
import { useState } from 'react';
import { Link } from 'react-router';
import { SD, type DadosPrazo, type Orgao, type PrazoDeProcesso, type Processo } from '../../dados';
import { PRAZOS_DO_PROCESSO } from '../../dados/limites';
import { comoFoiContado, formDoPrazo, naOrdemDosPrazos, prazoNovo, rotuloDoPrazo, SELO_DO_PRAZO, situacaoDoPrazoNoProcesso, tarefaDoPrazo } from '../../regras/andamentos';
import { diaDaSemana } from '../../regras/calendario';
import { fmtData } from '../../regras/pessoa';
import { avisar, falha, feito } from '../../ui/avisos';
import { estiloBotao, Nota, Selo } from '../../ui/base';
import { Botao, BotaoDuplo } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { useCtx } from '../../ui/sessao';
import { hojeISO } from '../../ui/util';
import { FormDoPrazo } from './FormDoPrazo';
import { arquivarTarefaCriada, criarTarefaLigada, quemRecebe } from './tarefaDoProcesso';

/** O que o formulário grava: para desfazer uma mudança sem mexer no que veio depois (cumprido, tarefa). */
const comoEstava = ({ descricao, final, intimacao, dias, contagem, disponibilizacao, sem_recesso, andamento_id }: PrazoDeProcesso): DadosPrazo =>
  ({ descricao, final, intimacao, dias, contagem, disponibilizacao, sem_recesso, andamento_id });

interface Props {
  processo: Processo;
  prazos: PrazoDeProcesso[];
  orgao: Orgao | null;
  somenteLer: boolean;
  /** Relê a lista e o histórico. */
  aoMudar: () => Promise<void>;
}

export function Prazos({ processo: p, prazos, orgao, somenteLer, aoMudar }: Props) {
  const ctx = useCtx();
  const hoje = hojeISO();
  /** 'novo', o id do prazo sendo mudado, ou null. */
  const [editando, setEditando] = useState<string | null>(null);
  // Na hora: a caixa muda já, até a lista voltar do banco como ficou.
  const [marcando, setMarcando] = useState<{ id: string; cumprido: boolean } | null>(null);

  async function lancar(dados: DadosPrazo) {
    const novo = await SD.processoPrazoCriar(p.id, dados);
    feito('Prazo lançado.', 'lançamento do prazo', async () => { await SD.processoPrazoExcluir(novo.id); });
    setEditando(null); await aoMudar();
  }
  /** O último dia mudou: a tarefa de cumprir acompanha. Devolve se ela ficou para trás. */
  async function levarATarefa(z: PrazoDeProcesso, final: string) {
    if (!z.tarefa_id || final === z.final) return false;
    if (!z.tarefa) return true;
    try { await SD.tarefaAtualizar(z.tarefa.id, { prazo: final }); return false; } catch { return true; }
  }
  async function mudar(z: PrazoDeProcesso, dados: DadosPrazo) {
    await SD.processoPrazoAtualizar(z.id, dados);
    const ficouParaTras = await levarATarefa(z, dados.final);
    feito('Prazo atualizado.', 'mudança do prazo', async () => {
      await SD.processoPrazoAtualizar(z.id, comoEstava(z));
      if (z.tarefa && dados.final !== z.final) await SD.tarefaAtualizar(z.tarefa.id, { prazo: z.final });
    });
    if (ficouParaTras) avisar('A tarefa ligada a este prazo continua com o último dia antigo: não foi possível mudá-la.', 'erro');
    setEditando(null); await aoMudar();
  }
  async function cumprir(z: PrazoDeProcesso, cumprido: boolean) {
    setMarcando({ id: z.id, cumprido });
    try {
      await SD.processoPrazoAtualizar(z.id, { concluido_em: cumprido ? new Date().toISOString() : null });
      feito(cumprido ? 'Prazo marcado como cumprido.' : 'Prazo reaberto.', cumprido ? 'prazo cumprido' : 'reabertura do prazo', async () => {
        await SD.processoPrazoAtualizar(z.id, { concluido_em: z.concluido_em });
      });
      await aoMudar();
    } catch (e) { falha(e); }
    setMarcando(null);
  }
  async function excluir(z: PrazoDeProcesso) {
    try {
      await SD.processoPrazoExcluir(z.id);
      feito('Prazo excluído.', 'exclusão do prazo', async () => { await SD.processoPrazoRestaurar(z.id); });
      await aoMudar();
    } catch (e) { falha(e); }
  }
  async function criarTarefa(z: PrazoDeProcesso) {
    try {
      const r = await criarTarefaLigada(tarefaDoPrazo(p, z, quemRecebe(ctx.perfil.id, ctx.equipe)), id => SD.processoPrazoAtualizar(z.id, { tarefa_id: id }));
      feito(`Tarefa ${r.codigo} criada.`, 'criação da tarefa', async () => {
        await SD.processoPrazoAtualizar(z.id, { tarefa_id: null });
        await arquivarTarefaCriada(r.id);
      });
    } catch (e) { falha(e); }
    await aoMudar();
  }

  return <div className="acomp">
    {!prazos.length && editando !== 'novo' && <Nota>Nenhum prazo lançado.</Nota>}
    <ul className="acomp-lista" aria-label="Prazos do processo">
      {naOrdemDosPrazos(prazos).map(z => editando === z.id
        ? <li key={z.id}><FormDoPrazo mudando inicial={formDoPrazo(z, hoje, orgao?.contagem_padrao)} orgao={orgao} siglaDoProcesso={p.orgao} aoSalvar={d => mudar(z, d)} aoCancelar={() => setEditando(null)} /></li>
        : <li key={z.id} className={z.concluido_em ? 'acomp-feito' : undefined}>
          <div className="acomp-topo">
            <label className="acomp-marcar"><input type="checkbox" checked={marcando?.id === z.id ? marcando.cumprido : !!z.concluido_em} disabled={somenteLer || marcando?.id === z.id} aria-label={`Prazo cumprido: ${z.descricao}`} onChange={e => void cumprir(z, e.target.checked)} /><b>{z.descricao}</b></label>
            <Selo tipo={SELO_DO_PRAZO[situacaoDoPrazoNoProcesso(z, hoje)]}>{rotuloDoPrazo(z, hoje)}</Selo>
          </div>
          <p className="nota">Último dia: {diaDaSemana(z.final)}, {fmtData(z.final)}. {comoFoiContado(z)}.</p>
          <div className="acomp-acoes">
            {z.tarefa ? <Link className={estiloBotao({ forma: 'mini' })} to={'/tarefas/?id=' + z.tarefa.id}>Tarefa {z.tarefa.codigo}</Link>
              : z.tarefa_id ? <span className="nota">Tarefa ligada (você não tem acesso a ela)</span>
              : !somenteLer && ctx.escritorio?.modulos?.tarefas && <Botao forma="mini" ocupadoTexto="Criando…" onClick={() => criarTarefa(z)}>Criar tarefa</Botao>}
            {!somenteLer && <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar o prazo ${z.descricao}`} onClick={() => setEditando(z.id)}><Icone nome="editar" tam={13} /> Mudar</button>}
            {!somenteLer && <BotaoDuplo pequeno variante="perigo" confirmar={`Confirmar: excluir ${z.descricao}`} aoConfirmar={() => excluir(z)}><Icone nome="lixeira" tam={13} /> Excluir</BotaoDuplo>}
          </div>
        </li>)}
    </ul>
    {prazos.length >= PRAZOS_DO_PROCESSO && <Nota>Mostrando os {PRAZOS_DO_PROCESSO} prazos de último dia mais novo.</Nota>}
    {editando === 'novo'
      ? <FormDoPrazo inicial={prazoNovo(hoje, orgao?.contagem_padrao)} orgao={orgao} siglaDoProcesso={p.orgao} aoSalvar={lancar} aoCancelar={() => setEditando(null)} />
      : !somenteLer && <div><button type="button" className={estiloBotao()} onClick={() => setEditando('novo')}><Icone nome="mais" tam={15} /> Novo prazo</button></div>}
  </div>;
}
