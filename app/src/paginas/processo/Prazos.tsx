// Os prazos no cartão do processo: lançar, mudar, marcar como cumprido, excluir e criar a tarefa de cumprir ou ligar uma que já
// existe (#341), deste processo ou sem processo. Um formulário aberto de cada vez (#395): pedir outro (o "Mudar" de outro prazo, o
// "+" ou o "Novo prazo") com o aberto por salvar mantém o aberto e lembra de salvar ou cancelar; o que foi escrito e não lançado é
// avisado ao cartão, que pergunta antes de fechar.
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { SD, type DadosPrazo, type Orgao, type PrazoDeProcesso, type Processo } from '../../dados';
import { PRAZOS_DO_PROCESSO } from '../../dados/limites';
import { comoFoiContado, formDoPrazo, naOrdemDosPrazos, prazoNovo, rotuloDoPrazo, SELO_DO_PRAZO, situacaoDoPrazoNoProcesso, tarefaDoPrazo } from '../../regras/andamentos';
import { diaDaSemana } from '../../regras/calendario';
import { contagemDoProcesso, siglaDoCalendario } from '../../regras/propriedadeIntelectual';
import { fmtData } from '../../regras/pessoa';
import { avisar, falha, feito } from '../../ui/avisos';
import { BotaoDeIcone, estiloBotao, Nota, Selo } from '../../ui/base';
import { Botao, BotaoDuplo } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { usePedidoDeNovo } from '../../ui/Recolhivel';
import { useEdicaoUnica } from '../../ui/useEdicaoUnica';
import { useCtx } from '../../ui/sessao';
import { hojeISO } from '../../ui/util';
import { FormDoPrazo } from './FormDoPrazo';
import { arquivarTarefaCriada, criarTarefaLigada, quemRecebe } from './tarefaDoProcesso';
import { LigarDoModulo } from '../../ui/LigarDoModulo';
import { ligarEAvisar, ligarTarefaNoPrazo } from '../ligarNoCartao';

/** O botão de baixo da seção e o "+" do título dela (#390), com o mesmo nome. */
export const ROTULO_DO_NOVO_PRAZO = 'Novo prazo';
/** A explicação de cada ação da linha do prazo, que só mostra o ícone (#423), ao passar o mouse e no foco do teclado. */
const DICA = { criarTarefa: 'Criar a tarefa de cumprir este prazo', mudar: 'Mudar o prazo', excluir: 'Excluir o prazo' };
/** Na busca da tarefa para ligar ao prazo: o que muda depois. */
const TAREFA_SEGUE_O_PRAZO = 'O prazo da tarefa passa a ser o último dia deste prazo, e muda junto quando ele mudar. A tarefa sem processo passa a ser deste processo.';

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
  /** Avisa o cartão do prazo escrito e ainda não lançado (para perguntar antes de fechar). */
  aoMudarRascunho?: (rascunho: string | null) => void;
}

/** O formulário do prazo novo; os outros são o id do prazo sendo mudado. */
const NOVO = 'novo';

export function Prazos({ processo: p, prazos, orgao, somenteLer, aoMudar, aoMudarRascunho }: Props) {
  const ctx = useCtx();
  const hoje = hojeISO();
  /** O formulário aberto: NOVO, o id do prazo sendo mudado, ou null. Um de cada vez. */
  const edicao = useEdicaoUnica(), editando = edicao.aberta;
  // Na hora: a caixa muda já, até a lista voltar do banco como ficou.
  const [marcando, setMarcando] = useState<{ id: string; cumprido: boolean } | null>(null);
  const secao = useRef<HTMLDivElement>(null);
  // O "+" do título da seção abre o formulário; com ele no título (#427), o botão daqui não aparece.
  const { peloTitulo, voltarAoTitulo } = usePedidoDeNovo(() => { if (!somenteLer) edicao.pedir(NOVO); });
  /**
   * Fecha o formulário; o foco volta ao botão que o abriu ("Mudar" do prazo, ou o "Novo prazo": o "+" do título, quando ele está lá),
   * e quem usa o teclado não se perde.
   */
  function fechar(id: string) {
    edicao.fechar(id);
    if (id === NOVO && peloTitulo) { voltarAoTitulo(); return; }
    setTimeout(() => secao.current?.querySelector<HTMLElement>(`[data-abre="${id}"]`)?.focus({ preventScroll: true }), 0);
  }
  /** O formulário de um prazo (ou do novo), ligado ao cartão: o que foi escrito vai para ele e para a faixa de um formulário por vez. */
  const doFormulario = (id: string) => ({
    aoCancelar: () => fechar(id), barrados: edicao.barrados,
    aoMudarRascunho: (r: string | null) => { edicao.marcarSujo(id, r !== null); aoMudarRascunho?.(r); }
  });

  async function lancar(dados: DadosPrazo) {
    const novo = await SD.processoPrazoCriar(p.id, dados);
    feito('Prazo lançado.', 'lançamento do prazo', async () => { await SD.processoPrazoExcluir(novo.id); });
    fechar(NOVO); await aoMudar();
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
    fechar(z.id); await aoMudar();
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

  return <div className="acomp" ref={secao}>
    {!prazos.length && editando !== NOVO && <Nota>Nenhum prazo lançado.</Nota>}
    <ul className="acomp-lista" aria-label="Prazos do processo">
      {naOrdemDosPrazos(prazos).map(z => editando === z.id
        ? <li key={z.id}><FormDoPrazo mudando inicial={formDoPrazo(z, hoje, contagemDoProcesso(p, orgao))} orgao={orgao} siglaDoProcesso={siglaDoCalendario(p)} aoSalvar={d => mudar(z, d)} {...doFormulario(z.id)} /></li>
        : <li key={z.id} className={z.concluido_em ? 'acomp-feito' : undefined}>
          <div className="acomp-topo">
            <label className="acomp-marcar"><input type="checkbox" checked={marcando?.id === z.id ? marcando.cumprido : !!z.concluido_em} disabled={somenteLer || marcando?.id === z.id} aria-label={`Prazo cumprido: ${z.descricao}`} onChange={e => void cumprir(z, e.target.checked)} /><b>{z.descricao}</b></label>
            <Selo tipo={SELO_DO_PRAZO[situacaoDoPrazoNoProcesso(z, hoje)]}>{rotuloDoPrazo(z, hoje)}</Selo>
          </div>
          <p className="nota">Último dia: {diaDaSemana(z.final)}, {fmtData(z.final)}. {comoFoiContado(z)}.</p>
          <div className="acomp-acoes">
            {z.tarefa ? <Link className={estiloBotao({ forma: 'mini' })} to={'/tarefas/?id=' + z.tarefa.id}>Tarefa {z.tarefa.codigo}</Link>
              : z.tarefa_id ? <span className="nota">Tarefa ligada (você não tem acesso a ela)</span>
              : !somenteLer && ctx.escritorio?.modulos?.tarefas && <>
                <Botao icone="tarefas" rotulo="Criar tarefa" dica={DICA.criarTarefa} ocupadoTexto="Criando…" onClick={() => criarTarefa(z)} />
                <LigarDoModulo modulo="tarefas" soIcone filtro={{ doProcesso: p.id }} aviso={TAREFA_SEGUE_O_PRAZO}
                  aoEscolher={t => ligarEAvisar(() => ligarTarefaNoPrazo(p.id, z.id, t.id),
                    { feito: `Tarefa ${t.codigo} ligada ao prazo.`, oQue: 'ligação da tarefa', ja: 'Esta tarefa já estava ligada a este prazo.' }, aoMudar)} />
              </>}
            {!somenteLer && <BotaoDeIcone icone="editar" rotulo={`Mudar o prazo ${z.descricao}`} dica={DICA.mudar} data-abre={z.id} onClick={() => edicao.pedir(z.id)} />}
            {!somenteLer && <BotaoDuplo icone="lixeira" rotulo="Excluir" dica={DICA.excluir} variante="perigo" confirmar={`Confirmar: excluir ${z.descricao}`} aoConfirmar={() => excluir(z)} />}
          </div>
        </li>)}
    </ul>
    {prazos.length >= PRAZOS_DO_PROCESSO && <Nota>Mostrando os {PRAZOS_DO_PROCESSO} prazos de último dia mais novo.</Nota>}
    {editando === NOVO
      ? <FormDoPrazo inicial={prazoNovo(hoje, contagemDoProcesso(p, orgao))} orgao={orgao} siglaDoProcesso={siglaDoCalendario(p)} aoSalvar={lancar} {...doFormulario(NOVO)} />
      : !somenteLer && !peloTitulo && <div><button type="button" className={estiloBotao()} data-abre={NOVO} onClick={() => edicao.pedir(NOVO)}><Icone nome="mais" tam={15} /> {ROTULO_DO_NOVO_PRAZO}</button></div>}
  </div>;
}
